import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, MetricCard, StatusBadge, Card } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { formatGHS, formatNumber, formatCompact, timeAgo } from "@/lib/format";
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart } from "recharts";
import { Suspense, lazy, useEffect, useState } from "react";

const GlobeMap = lazy(() => import("@/components/GlobeMap"));

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Dashboard — Seltra Ops" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
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

  const [showGlobe, setShowGlobe] = useState(true);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Real-time overview of the Seltra platform" />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <MetricCard label="Total Merchants" value={formatNumber(activeMerchants)} delta="↑ active" />
        <MetricCard label="GMV (30d)" value={formatGHS(monthGmv)} delta={`${paidOrders.length} paid orders`} />
        <MetricCard label="Waitlist applicants" value={formatCompact(waitlistApplicants)} delta="seen by Ops" />
        <MetricCard label="Approved to onboard" value={formatCompact(readyToOnboard)} delta="ready for launch" />
        <MetricCard label="Merchant success" value={formatCompact(merchantSuccessCount)} delta="onboarded" />
        <MetricCard label="AI Invocations (24h)" value={formatCompact(todayAgents)} delta="across all merchants" />
      </div>

      <Card
        title="Global merchant footprint"
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowGlobe((prev) => !prev)}
            className="gap-2"
          >
            {showGlobe ? "Collapse" : "Expand"}
            <ChevronDown className={`transition-transform duration-200 ${showGlobe ? "rotate-180" : "rotate-0"}`} />
          </Button>
        }
      >
        {showGlobe ? (
          <Suspense
            fallback={
              <div className="min-h-[460px] rounded-3xl bg-slate-950/10 flex items-center justify-center text-sm text-muted-foreground">
                Loading globe...
              </div>
            }
          >
            <GlobeMap merchants={data?.merchants ?? []} gmvByMerchant={gmvByMerchant} />
          </Suspense>
        ) : (
          <div className="min-h-[240px] rounded-3xl border border-dashed border-border bg-slate-950/10 flex items-center justify-center text-sm text-muted-foreground">
            The globe experience is collapsed. Expand to reveal the merchant footprint.
          </div>
        )}
      </Card>

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
