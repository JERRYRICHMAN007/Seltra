import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, MetricCard, StatusBadge, Card } from "@/components/ui-bits";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatGHS, formatNumber, formatCompact, timeAgo } from "@/lib/format";
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart } from "recharts";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import type { GlobePoint } from "@/components/GlobeMap";

const GlobeMap = lazy(() => import("@/components/GlobeMap"));

const cityCoords: Record<string, { lat: number; lng: number }> = {
  "Accra, Ghana": { lat: 5.6037, lng: -0.1870 },
  "Kumasi, Ghana": { lat: 6.6885, lng: -1.6244 },
  "Cape Coast, Ghana": { lat: 5.1053, lng: -1.2466 },
  "Tema, Ghana": { lat: 5.6698, lng: -0.0166 },
  "Tamale, Ghana": { lat: 9.4035, lng: -0.8423 },
  "Ho, Ghana": { lat: 6.6119, lng: 0.4703 },
  "Ghana": { lat: 7.9465, lng: -1.0232 },
  "Lagos, Nigeria": { lat: 6.5244, lng: 3.3792 },
  "Nairobi, Kenya": { lat: -1.2921, lng: 36.8219 },
  "Johannesburg, South Africa": { lat: -26.2041, lng: 28.0473 },
};

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Dashboard — Seltra Ops" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    queryFn: async () => {
      const [merchants, orders, agents, events, health, apps] = await Promise.all([
        supabase.from("merchants").select("id,name,slug,status,last_active_at,based_in"),
        supabase.from("orders").select("id,merchant_id,total_amount,status,created_at").order("created_at", { ascending: false }),
        supabase.from("agent_invocations").select("id,created_at,success"),
        supabase.from("platform_events").select("id,event_type,merchant_id,created_at").order("created_at", { ascending: false }).limit(20),
        supabase.from("system_health").select("service,status,checked_at").order("checked_at", { ascending: false }).limit(50),
        supabase.from("merchant_applications").select("*").order("created_at", { ascending: false }),
      ]);
      return {
        merchants: merchants.data ?? [],
        orders: orders.data ?? [],
        agents: agents.data ?? [],
        events: events.data ?? [],
        health: health.data ?? [],
        apps: apps.data ?? [],
      };
    },
  });

  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  useEffect(() => { setLiveEvents(data?.events ?? []); }, [data?.events]);
  useEffect(() => {
    const ch = supabase.channel("dash-events").on("postgres_changes", { event: "INSERT", schema: "public", table: "platform_events" }, (p) => {
      setLiveEvents((prev) => [p.new as any, ...prev].slice(0, 20));
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const merchantsById = new Map((data?.merchants ?? []).map((m) => [m.id, m]));
  const activeMerchants = (data?.merchants ?? []).filter((m) => m.status === "active").length;
  const paidOrders = (data?.orders ?? []).filter((o) => o.status === "paid");
  const monthGmv = paidOrders.filter((o) => new Date(o.created_at).getTime() > Date.now() - 30 * 86400 * 1000)
    .reduce((s, o) => s + Number(o.total_amount), 0);
  const todayAgents = (data?.agents ?? []).filter((a) => new Date(a.created_at).getTime() > Date.now() - 86400 * 1000).length;
  const waitlistApplicants = (data?.apps ?? []).filter((a) => !a.merchant_id).length;
  const readyToOnboard = (data?.apps ?? []).filter((a) => a.status === "approved" && !a.merchant_id).length;
  const merchantSuccessCount = (data?.apps ?? []).filter((a) => Boolean(a.merchant_id)).length;

  // GMV by day
  const gmvDays = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i)); d.setHours(0, 0, 0, 0);
    const next = d.getTime() + 86400 * 1000;
    const total = paidOrders.filter((o) => { const t = new Date(o.created_at).getTime(); return t >= d.getTime() && t < next; })
      .reduce((s, o) => s + Number(o.total_amount), 0);
    return { day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), gmv: Math.round(total) };
  });

  const signupsByDay = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i)); d.setHours(0, 0, 0, 0);
    const next = d.getTime() + 86400 * 1000;
    const count = (data?.merchants ?? []).filter((m: any) => {
      const t = new Date(m.last_active_at).getTime();
      return t >= d.getTime() && t < next;
    }).length;
    return { day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), n: count };
  });

  // Top merchants by GMV
  const gmvByMerchant = new Map<string, number>();
  paidOrders.forEach((o) => gmvByMerchant.set(o.merchant_id!, (gmvByMerchant.get(o.merchant_id!) ?? 0) + Number(o.total_amount)));
  const topMerchants = Array.from(gmvByMerchant.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([id, gmv]) => ({ ...(merchantsById.get(id) as any), gmv }));

  // System status: latest per service
  const latestHealth = new Map<string, any>();
  (data?.health ?? []).forEach((h) => { if (!latestHealth.has(h.service)) latestHealth.set(h.service, h); });

  const globeData = useMemo(() => {
    const merchants = data?.merchants ?? [];
    const grouped = merchants.reduce<Record<string, typeof merchants>>((acc, m) => {
      const location = m.based_in || "Unknown";
      if (!acc[location]) acc[location] = [];
      acc[location].push(m);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([location, list]) => {
        const coords = cityCoords[location];
        if (!coords) return null;
        const country = location.includes(",") ? location.split(",").pop()!.trim() : location;
        return {
          lat: coords.lat,
          lng: coords.lng,
          label: location,
          count: list.length,
          country,
        };
      })
      .filter(Boolean);
  }, [data?.merchants]);

  const merchants = data?.merchants ?? [];
  const merchantsByCountry = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const m of merchants) {
      const basedIn = m.based_in || "";
      const country = basedIn.includes(",") ? basedIn.split(",").pop()!.trim() : basedIn;
      if (!country) continue;
      acc[country] = (acc[country] || 0) + 1;
    }
    return acc;
  }, [merchants]);

  const topCountry = Object.entries(merchantsByCountry).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" subtitle="Real-time overview of the Seltra platform" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Real-time overview of the Seltra platform" />

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-4">
          <MetricCard label="Total Merchants" value={formatNumber(activeMerchants)} delta="↑ active" />
          <MetricCard label="GMV (30d)" value={formatGHS(monthGmv)} delta={`${paidOrders.length} paid orders`} />
          <MetricCard label="Waitlist applicants" value={formatCompact(waitlistApplicants)} delta="seen by Ops" />
          <MetricCard label="Approved to onboard" value={formatCompact(readyToOnboard)} delta="ready for launch" />
          <MetricCard label="Merchant success" value={formatCompact(merchantSuccessCount)} delta="onboarded" />
          <MetricCard label="AI Invocations (24h)" value={formatCompact(todayAgents)} delta="across all merchants" />
        </div>

        <div
          className="relative rounded-2xl overflow-hidden border border-border"
          style={{
            background: "linear-gradient(135deg, #0a0f1e 0%, #0d1f2d 50%, #0a1628 100%)",
          }}
        >
          <div
            className="absolute inset-0 dark:opacity-0 opacity-100 pointer-events-none"
            style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}
          />

          <div className="relative flex items-start justify-between px-5 pt-4 pb-1">
            <div>
              <div className="text-2xl font-semibold text-white">Global merchant footprint</div>
              <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                {merchants.length} merchants across {Object.keys(merchantsByCountry).length} countries
              </div>
            </div>
            <div className="flex gap-6 text-right">
              <div>
                <div className="text-xl font-semibold text-white">{merchants.filter((m) => m.status === "active").length}</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Active</div>
              </div>
              <div>
                <div className="text-xl font-semibold" style={{ color: "#1D9E75" }}>{Object.keys(merchantsByCountry).length}</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Countries</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-white">{topCountry}</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Top market</div>
              </div>
            </div>
          </div>

          <Suspense fallback={<div className="px-6"><Skeleton className="h-64 w-full rounded-xl" /></div>}>
            <GlobeMap points={globeData as GlobePoint[]} />
          </Suspense>

          <div className="relative flex flex-wrap gap-2 px-5 pb-4 pt-1">
            {Object.entries(merchantsByCountry)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([country, count]) => (
                <div
                  key={country}
                  style={{
                    background: "rgba(29,158,117,0.15)",
                    border: "1px solid rgba(29,158,117,0.3)",
                    borderRadius: "20px",
                    padding: "4px 12px",
                    fontSize: "12px",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1D9E75", display: "inline-block" }} />
                  {country} · {count}
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="GMV — last 30 days">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={gmvDays}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={4} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompact(v)} />
                <Tooltip />
                <Area type="monotone" dataKey="gmv" stroke="var(--color-primary)" strokeWidth={2} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="New activity — last 30 days">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={signupsByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={4} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="n" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Top merchants by GMV" className="lg:col-span-1">
          <div className="space-y-2">
            {topMerchants.map((m, i) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded bg-primary-soft text-primary grid place-items-center text-xs font-mono">{i + 1}</div>
                  <div>
                    <div className="font-medium text-navy">{m.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{m.slug}</div>
                  </div>
                </div>
                <div className="font-mono text-navy">{formatGHS(m.gmv)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Recent events (live)" className="lg:col-span-1">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {liveEvents.slice(0, 10).map((e) => (
              <div key={e.id} className="text-xs flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="font-mono text-navy">{e.event_type}</span>
                <span className="text-muted-foreground ml-auto">{timeAgo(e.created_at)}</span>
              </div>
            ))}
            {!liveEvents.length && <div className="text-xs text-muted-foreground">No events yet</div>}
          </div>
        </Card>

        <Card title="System status">
          <div className="space-y-3">
            {["api", "agent", "storefront", "payments", "db"].map((s) => {
              const h = latestHealth.get(s);
              const status = h?.status ?? "unknown";
              const color = status === "healthy" ? "bg-primary" : status === "degraded" ? "bg-warning" : "bg-destructive";
              return (
                <div key={s} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${color}`} />
                    <span className="font-mono uppercase text-xs text-navy">{s}</span>
                  </div>
                  <StatusBadge status={status} />
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card title="Recent applications" action={<Button size="sm" variant="ghost">View all</Button>}>
        <div className="space-y-2">
          {(data?.apps ?? []).map((a) => (
            <div key={a.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
              <div>
                <div className="font-medium text-navy">{a.full_name} <span className="text-muted-foreground font-normal">— {a.business_name}</span></div>
                <div className="text-xs text-muted-foreground">{a.what_you_sell}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={a.status} />
                <Button size="sm" variant="outline">Review</Button>
              </div>
            </div>
          ))}
          {!(data?.apps ?? []).length && <div className="text-xs text-muted-foreground">No pending applications</div>}
        </div>
      </Card>
    </div>
  );
}
