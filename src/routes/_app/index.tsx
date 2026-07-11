import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDashboardActivitySeries, getDashboardFootprint, getDashboardGmvSeries, getDashboardOverview, getDashboardRecentApplications, getDashboardRecentEvents, getDashboardSystemStatus, getDashboardTopMerchants } from "@/lib/api/dashboard.functions";
import type { DashboardOverview } from "@/lib/api/dashboard.types";
import { activitySeriesFromEvents, activitySeriesToChartData } from "@/lib/api/dashboard-activity";
import { gmvSeriesFromOrders, gmvSeriesToChartData } from "@/lib/api/dashboard-gmv";
import { recentApplicationsFromSupabase } from "@/lib/api/dashboard-recent-applications";
import { recentEventsFromPlatformEvents, recentEventsToRows } from "@/lib/api/dashboard-recent-events";
import { systemStatusFromHealth, systemStatusToRows } from "@/lib/api/dashboard-system-status";
import { topMerchantsFromOrders, topMerchantsToRows } from "@/lib/api/dashboard-top-merchants";
import { footprintCountriesMap, footprintFromMerchants, footprintToGlobePoints } from "@/lib/api/dashboard-footprint";
import { PageHeader, MetricCard, StatusBadge, Card } from "@/components/ui-bits";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatGHS, formatNumber, formatCompact } from "@/lib/format";
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart } from "recharts";
import { Suspense, lazy, useMemo } from "react";
import type { GlobePoint } from "@/components/GlobeMap";
import { ClientOnly } from "@/components/client-only";

const GlobeMap = lazy(() => import("@/components/GlobeMap"));

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Dashboard — Seltra Ops" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: overview, isLoading: overviewLoading, isError: overviewApiFailed } = useQuery({
    queryKey: ["dashboard-overview"],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    retry: false,
    queryFn: () => getDashboardOverview(),
  });

  const { data: footprint, isLoading: footprintLoading, isError: footprintApiFailed } = useQuery({
    queryKey: ["dashboard-footprint"],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    retry: false,
    queryFn: () => getDashboardFootprint(),
  });

  const { data: gmvSeries, isLoading: gmvSeriesLoading, isError: gmvSeriesApiFailed } = useQuery({
    queryKey: ["dashboard-gmv-series"],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    retry: false,
    queryFn: () => getDashboardGmvSeries(),
  });

  const { data: activitySeries, isLoading: activitySeriesLoading, isError: activitySeriesApiFailed } = useQuery({
    queryKey: ["dashboard-activity-series"],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    retry: false,
    queryFn: () => getDashboardActivitySeries(),
  });

  const { data: topMerchantsResponse, isLoading: topMerchantsLoading, isError: topMerchantsApiFailed } = useQuery({
    queryKey: ["dashboard-top-merchants"],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    retry: false,
    queryFn: () => getDashboardTopMerchants(),
  });

  const { data: recentEvents, isLoading: recentEventsLoading, isError: recentEventsApiFailed } = useQuery({
    queryKey: ["dashboard-recent-events"],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    retry: false,
    queryFn: () => getDashboardRecentEvents(),
  });

  const { data: systemStatus, isLoading: systemStatusLoading, isError: systemStatusApiFailed } = useQuery({
    queryKey: ["dashboard-system-status"],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    retry: false,
    queryFn: () => getDashboardSystemStatus(),
  });

  const { data: recentApplications, isLoading: recentApplicationsLoading, isError: recentApplicationsApiFailed } = useQuery({
    queryKey: ["dashboard-recent-applications"],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    retry: false,
    queryFn: () => getDashboardRecentApplications(),
  });

  const { data, isLoading: detailsLoading } = useQuery({
    queryKey: ["dashboard-details"],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    queryFn: async () => {
      const [merchants, orders, agents, events, health, apps] = await Promise.all([
        supabase.from("merchants").select("id,name,slug,status,last_active_at,based_in"),
        supabase.from("orders").select("id,merchant_id,total_amount,status,created_at").order("created_at", { ascending: false }),
        supabase.from("agent_invocations").select("id,created_at"),
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

  const isLoading = overviewLoading || detailsLoading;

  const merchantsById = new Map((data?.merchants ?? []).map((m) => [m.id, m]));
  const paidOrders = (data?.orders ?? []).filter((o) => o.status === "paid");
  const paidOrders30d = paidOrders.filter(
    (o) => new Date(o.created_at).getTime() > Date.now() - 30 * 86400000,
  );
  const monthGmv = paidOrders30d.reduce((sum, o) => sum + Number(o.total_amount), 0);

  const fallbackOverview = useMemo((): DashboardOverview | null => {
    if (!data) return null;
    const merchants = data.merchants;
    const apps = data.apps;
    return {
      totalMerchantsStores: merchants.length,
      activeMerchantsStores: merchants.filter((m) => m.status === "active").length,
      gmv30d: { amount: monthGmv.toFixed(2), currency: "GHS" },
      paidOrders30d: paidOrders30d.length,
      waitlistApplicants: apps.filter((a) => !a.merchant_id).length,
      approvedToOnboard: apps.filter((a) => a.status === "approved" && !a.merchant_id).length,
      merchantSuccess: apps.filter((a) => Boolean(a.merchant_id)).length,
      aiInvocations24h: (data.agents ?? []).filter(
        (a) => new Date(a.created_at).getTime() > Date.now() - 86400000,
      ).length,
    };
  }, [data, monthGmv, paidOrders30d.length]);

  const metrics = overview ?? fallbackOverview;
  const metricsUnavailable = !metrics && overviewApiFailed && !detailsLoading;

  const resolvedFootprint = useMemo(() => {
    if (footprint) return footprint;
    // Only fall back after the footprint API has failed — map is powered by /dashboard/footprint
    if (footprintApiFailed && data?.merchants.length) {
      return footprintFromMerchants(data.merchants);
    }
    return null;
  }, [footprint, footprintApiFailed, data?.merchants]);

  const footprintFromApi = Boolean(footprint);

  const gmvDays = useMemo(() => {
    if (gmvSeries?.length) return gmvSeriesToChartData(gmvSeries);
    if (paidOrders.length) return gmvSeriesFromOrders(paidOrders);
    return [];
  }, [gmvSeries, paidOrders]);

  const activityByDay = useMemo(() => {
    if (activitySeries?.length) return activitySeriesToChartData(activitySeries);
    if (data?.events.length) return activitySeriesFromEvents(data.events);
    return [];
  }, [activitySeries, data?.events]);

  const topMerchants = useMemo(() => {
    if (topMerchantsResponse?.data.length) return topMerchantsToRows(topMerchantsResponse);
    if (paidOrders.length) return topMerchantsFromOrders(paidOrders, merchantsById);
    return [];
  }, [topMerchantsResponse, paidOrders, merchantsById]);

  const topMerchantsTitle = topMerchantsResponse?.fallback
    ? "Top merchants by GMV · all-time"
    : topMerchantsResponse?.period
      ? `Top merchants by GMV · ${topMerchantsResponse.period}`
      : "Top merchants by GMV";

  const recentEventRows = useMemo(() => {
    if (recentEvents?.length) return recentEventsToRows(recentEvents);
    if (data?.events.length) return recentEventsFromPlatformEvents(data.events);
    return [];
  }, [recentEvents, data?.events]);

  const systemStatusRows = useMemo(() => {
    if (systemStatus) return systemStatusToRows(systemStatus);
    if (data?.health.length) return systemStatusFromHealth(data.health);
    return [];
  }, [systemStatus, data?.health]);

  const applicationRows = useMemo(() => {
    if (recentApplications?.length) return recentApplications;
    if (data?.apps.length) return recentApplicationsFromSupabase(data.apps);
    return [];
  }, [recentApplications, data?.apps]);

  const globeData = useMemo(
    () => (resolvedFootprint ? footprintToGlobePoints(resolvedFootprint) : []),
    [resolvedFootprint],
  );

  const merchantsByCountry = useMemo(
    () => (resolvedFootprint ? footprintCountriesMap(resolvedFootprint) : {}),
    [resolvedFootprint],
  );

  const footprintStats = {
    totalMerchants: resolvedFootprint?.totalMerchants ?? 0,
    activeMerchants: resolvedFootprint?.activeMerchants ?? 0,
    countryCount: resolvedFootprint?.countries.length ?? 0,
    topMarket: resolvedFootprint?.topMarket ?? "—",
  };

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
          <MetricCard
            label="Total Merchants Stores"
            value={metrics ? formatNumber(metrics.totalMerchantsStores) : "—"}
            delta={
              metrics
                ? `${formatCompact(metrics.activeMerchantsStores)} active`
                : metricsUnavailable
                  ? "unavailable"
                  : overviewLoading
                    ? "loading…"
                    : "—"
            }
          />
          <MetricCard
            label="GMV (30d)"
            value={metrics ? formatGHS(Number(metrics.gmv30d.amount)) : "—"}
            delta={
              metrics
                ? `${formatCompact(metrics.paidOrders30d)} paid orders`
                : metricsUnavailable
                  ? "unavailable"
                  : overviewLoading
                    ? "loading…"
                    : "—"
            }
          />
          <MetricCard
            label="Waitlist applicants"
            value={metrics ? formatCompact(metrics.waitlistApplicants) : "—"}
            delta={metrics ? "seen by Ops" : metricsUnavailable ? "unavailable" : overviewLoading ? "loading…" : "—"}
          />
          <MetricCard
            label="Approved to onboard"
            value={metrics ? formatCompact(metrics.approvedToOnboard) : "—"}
            delta={metrics ? "ready for launch" : metricsUnavailable ? "unavailable" : overviewLoading ? "loading…" : "—"}
          />
          <MetricCard
            label="Merchant success"
            value={metrics ? formatCompact(metrics.merchantSuccess) : "—"}
            delta={metrics ? "onboarded" : metricsUnavailable ? "unavailable" : overviewLoading ? "loading…" : "—"}
          />
          <MetricCard
            label="AI Invocations (24h)"
            value={metrics ? formatCompact(metrics.aiInvocations24h) : "—"}
            delta={metrics ? "across all merchants" : metricsUnavailable ? "unavailable" : overviewLoading ? "loading…" : "—"}
          />
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
                {footprintLoading && !resolvedFootprint
                  ? "Loading footprint from Seltra API…"
                  : footprintFromApi
                    ? `${footprintStats.totalMerchants} merchants across ${footprintStats.countryCount} countries`
                    : footprintApiFailed && resolvedFootprint
                      ? `${footprintStats.totalMerchants} merchants across ${footprintStats.countryCount} countries`
                      : footprintApiFailed
                        ? "Footprint API unavailable — start Seltra backend on :3001"
                        : "No footprint data yet"}
              </div>
            </div>
            <div className="flex gap-6 text-right">
              <div>
                <div className="text-xl font-semibold text-white">{formatCompact(footprintStats.activeMerchants)}</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Active</div>
              </div>
              <div>
                <div className="text-xl font-semibold" style={{ color: "#1D9E75" }}>{footprintStats.countryCount}</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Countries</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-white">{footprintStats.topMarket}</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Top market</div>
              </div>
            </div>
          </div>

          <ClientOnly fallback={<div className="px-6"><Skeleton className="h-64 w-full rounded-xl" /></div>}>
            <Suspense fallback={<div className="px-6"><Skeleton className="h-64 w-full rounded-xl" /></div>}>
              {footprintLoading && !resolvedFootprint ? (
                <div className="px-6 pb-4"><Skeleton className="h-64 w-full rounded-xl" /></div>
              ) : (
                <GlobeMap points={globeData as GlobePoint[]} />
              )}
            </Suspense>
          </ClientOnly>

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
            {gmvSeriesLoading && !gmvDays.length ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : (
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
            )}
          </div>
        </Card>
        <Card title="New activity — last 30 days">
          <div className="h-64">
            {activitySeriesLoading && !activityByDay.length ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={4} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="n" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title={topMerchantsTitle} className="lg:col-span-1">
          <div className="space-y-2">
            {topMerchantsLoading && !topMerchants.length ? (
              <Skeleton className="h-32 w-full rounded-lg" />
            ) : (
              topMerchants.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded bg-primary-soft text-primary grid place-items-center text-xs font-mono">{m.rank}</div>
                    <div>
                      <div className="font-medium text-navy">{m.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{m.slug}</div>
                    </div>
                  </div>
                  <div className="font-mono text-navy">{formatGHS(m.gmv)}</div>
                </div>
              ))
            )}
            {!topMerchantsLoading && !topMerchants.length && (
              <div className="text-xs text-muted-foreground">No merchant GMV data yet</div>
            )}
          </div>
        </Card>

        <Card title="Recent events" className="lg:col-span-1">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentEventsLoading && !recentEventRows.length ? (
              <Skeleton className="h-32 w-full rounded-lg" />
            ) : (
              recentEventRows.slice(0, 10).map((e) => (
                <div key={e.id} className="text-xs flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="font-mono text-navy">{e.type}</span>
                  <span className="text-muted-foreground ml-auto">{e.timeLabel}</span>
                </div>
              ))
            )}
            {!recentEventsLoading && !recentEventRows.length && (
              <div className="text-xs text-muted-foreground">No events yet</div>
            )}
          </div>
        </Card>

        <Card title="System status">
          <div className="space-y-3">
            {systemStatusLoading && !systemStatusRows.length ? (
              <Skeleton className="h-32 w-full rounded-lg" />
            ) : (
              systemStatusRows.map(({ key, status }) => {
                const color = status === "healthy" ? "bg-primary" : status === "degraded" ? "bg-warning" : "bg-destructive";
                return (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${color}`} />
                      <span className="font-mono uppercase text-xs text-navy">{key}</span>
                    </div>
                    <StatusBadge status={status} />
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      <Card
        title="Recent applications"
        action={<Button size="sm" variant="ghost">View all</Button>}
      >
        <div className="space-y-2">
          {recentApplicationsLoading && !applicationRows.length ? (
            <Skeleton className="h-32 w-full rounded-lg" />
          ) : (
            applicationRows.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                <div>
                  <div className="font-medium text-navy">
                    {a.fullName} <span className="text-muted-foreground font-normal">— {a.businessName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{a.storeName}</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={a.status} />
                  <Button size="sm" variant="outline">Review</Button>
                </div>
              </div>
            ))
          )}
          {!recentApplicationsLoading && !applicationRows.length && (
            <div className="text-xs text-muted-foreground">No pending applications</div>
          )}
        </div>
      </Card>
    </div>
  );
}
