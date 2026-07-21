import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, MetricCard, StatusBadge, Card } from "@/components/ui-bits";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber, shortDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPagination } from "@/components/list-pagination";
import { useClientPagination } from "@/hooks/use-client-pagination";

export const Route = createFileRoute("/_app/api-monitor")({
  head: () => ({ meta: [{ title: "API Monitor — Seltra Ops" }] }),
  component: ApiMonitorPage,
});

type HealthRow = {
  service: string;
  status: string;
  checked_at: string;
};

type EventRow = {
  id: string;
  event_type: string;
  merchant_id: string | null;
  created_at: string;
  merchants: { name: string } | null;
};

function statusDotClass(status: string) {
  const s = status.toLowerCase();
  if (s === "healthy") return "bg-primary";
  if (s === "degraded") return "bg-warning";
  return "bg-destructive";
}

function tickClass(status: string) {
  const s = status.toLowerCase();
  if (s === "healthy") return "bg-primary";
  return "bg-destructive";
}

function eventTypeBadgeClass(eventType: string) {
  const t = eventType.toLowerCase();
  if (t.includes("payment") || t.includes("order")) return "bg-success-soft text-primary";
  if (t.includes("agent")) return "bg-accent text-navy";
  if (t.includes("failed") || t.includes("error")) return "bg-destructive-soft text-destructive";
  if (t.includes("login") || t.includes("store")) return "bg-primary-soft text-primary";
  return "bg-muted text-muted-foreground";
}

function ApiMonitorPage() {
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: healthRows = [], isLoading: healthLoading } = useQuery({
    queryKey: ["api-monitor-health"],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    queryFn: async () =>
      (
        await supabase
          .from("system_health")
          .select("service, status, checked_at")
          .order("checked_at", { ascending: false })
      ).data ?? [],
    refetchInterval: 30000,
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["api-monitor-events"],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    queryFn: async () =>
      (
        await supabase
          .from("platform_events")
          .select("id, event_type, merchant_id, created_at, merchants(name)")
          .order("created_at", { ascending: false })
          .limit(500)
      ).data ?? [],
    refetchInterval: 30000,
  });

  const uptimePct = useMemo(() => {
    if (!healthRows.length) return 0;
    const healthy = healthRows.filter((r: HealthRow) => r.status === "healthy").length;
    return Math.round((healthy / healthRows.length) * 100);
  }, [healthRows]);

  const events24h = useMemo(() => {
    const cutoff = Date.now() - 86400000;
    return (events as EventRow[]).filter((e) => new Date(e.created_at).getTime() >= cutoff).length;
  }, [events]);

  const latestByService = useMemo(() => {
    const latest = new Map<string, HealthRow>();
    (healthRows as HealthRow[]).forEach((row) => {
      if (!latest.has(row.service)) latest.set(row.service, row);
    });
    return Array.from(latest.values()).sort((a, b) => a.service.localeCompare(b.service));
  }, [healthRows]);

  const ticksByService = useMemo(() => {
    const grouped = new Map<string, HealthRow[]>();
    (healthRows as HealthRow[]).forEach((row) => {
      const list = grouped.get(row.service) ?? [];
      list.push(row);
      grouped.set(row.service, list);
    });

    const result = new Map<string, HealthRow[]>();
    grouped.forEach((records, service) => {
      const sorted = [...records].sort(
        (a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime(),
      );
      result.set(service, sorted.slice(-30));
    });
    return result;
  }, [healthRows]);

  const serviceNames = useMemo(() => {
    const names = new Set<string>();
    latestByService.forEach((r) => names.add(r.service));
    ticksByService.forEach((_, service) => names.add(service));
    return Array.from(names).sort();
  }, [latestByService, ticksByService]);

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = events as EventRow[];

    if (q) {
      rows = rows.filter((e) => e.event_type.toLowerCase().includes(q));
    }

    if (methodFilter !== "all") {
      rows = rows.filter((e) => e.event_type.toLowerCase().includes(methodFilter.toLowerCase()));
    }

    if (statusFilter === "4xx" || statusFilter === "5xx") {
      rows = [];
    }

    return rows;
  }, [events, search, methodFilter, statusFilter]);

  const {
    page,
    setPage,
    pageItems: eventPageItems,
    totalPages,
    totalItems,
    pageSize,
  } = useClientPagination(filteredEvents, {
    pageSize: 10,
    resetDeps: [search, methodFilter, statusFilter],
  });

  const isLoading = healthLoading || eventsLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="API monitor"
        subtitle="Real-time health and request log for all platform services"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : (
          <>
            <MetricCard label="Uptime" value={`${uptimePct}%`} delta="across all health checks" />
            <MetricCard label="Avg latency" value="—" delta="not available yet" />
            <MetricCard label="Total events (24h)" value={formatNumber(events24h)} delta="platform events" />
            <MetricCard label="Error rate" value="—" delta="not available yet" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Service health">
          <div className="space-y-4">
            {latestByService.length ? (
              latestByService.map((row) => (
                <div key={row.service} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusDotClass(row.status)}`} />
                    <span className="font-mono text-sm uppercase text-navy">{row.service}</span>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">No health data yet.</div>
            )}
          </div>
        </Card>

        <Card title="30-day uptime history">
          <div className="space-y-4">
            {serviceNames.length ? (
              serviceNames.map((service) => {
                const ticks = ticksByService.get(service) ?? [];
                return (
                  <div key={service}>
                    <div className="mb-2 font-mono text-xs uppercase text-muted-foreground">{service}</div>
                    <div className="flex gap-0.5">
                      {ticks.length ? (
                        ticks.map((tick, i) => (
                          <div
                            key={`${service}-${i}`}
                            className={`h-6 flex-1 min-w-[3px] max-w-[10px] rounded-sm ${tickClass(tick.status)}`}
                            title={`${tick.status} — ${shortDate(tick.checked_at)}`}
                          />
                        ))
                      ) : (
                        <div className="text-xs text-muted-foreground">No history</div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">No uptime history yet.</div>
            )}
          </div>
        </Card>
      </div>

      <Card title="Request log">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <Input
            placeholder="Search event type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs bg-surface-muted border-input"
          />
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="sm:w-36">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="2xx">2xx</SelectItem>
              <SelectItem value="4xx">4xx</SelectItem>
              <SelectItem value="5xx">5xx</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="py-2 pr-4">Event type</th>
              <th className="py-2 pr-4">Endpoint/detail</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Merchant</th>
              <th className="py-2 pr-4">Time</th>
            </tr>
          </thead>
          <tbody>
            {eventPageItems.map((event) => (
              <tr key={event.id} className="border-b border-border hover:bg-surface-muted/50">
                <td className="py-3 pr-4">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium ${eventTypeBadgeClass(event.event_type)}`}
                  >
                    {event.event_type}
                  </span>
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-navy">{event.event_type}</td>
                <td className="py-3 pr-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-success-soft text-primary">
                    200
                  </span>
                </td>
                <td className="py-3 pr-4 text-navy">{event.merchants?.name ?? "—"}</td>
                <td className="py-3 pr-4 text-muted-foreground">{shortDate(event.created_at)}</td>
              </tr>
            ))}
            {!filteredEvents.length && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No events match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {!isLoading && (
          <ListPagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
            itemLabel="events"
            className="mt-4"
          />
        )}
      </Card>
    </div>
  );
}
