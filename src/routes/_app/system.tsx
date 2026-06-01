import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusBadge, Card } from "@/components/ui-bits";
import { timeAgo } from "@/lib/format";

export const Route = createFileRoute("/_app/system")({
  head: () => ({ meta: [{ title: "System Health — Seltra Ops" }] }),
  component: SystemPage,
});

function SystemPage() {
  const { data: rows = [] } = useQuery({
    queryKey: ["health"],
    queryFn: async () => (await supabase.from("system_health").select("*").order("checked_at", { ascending: false }).limit(200)).data ?? [],
    refetchInterval: 30000,
  });
  const latest = new Map<string, any>();
  rows.forEach((r: any) => { if (!latest.has(r.service)) latest.set(r.service, r); });
  const services = ["api", "agent", "storefront", "payments", "db"];
  return (
    <div className="space-y-6">
      <PageHeader title="System Health" subtitle="Real-time status of all Seltra services" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {services.map((s) => {
          const h = latest.get(s); const status = h?.status ?? "unknown";
          const dot = status === "healthy" ? "bg-primary" : status === "degraded" ? "bg-warning" : "bg-destructive";
          return (
            <Card key={s}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                <span className="font-mono uppercase text-xs text-navy">{s}</span>
                <span className="ml-auto"><StatusBadge status={status} /></span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Latency</span><span className="font-mono">{h?.latency_ms ?? 0}ms</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Error rate</span><span className="font-mono">{Number(h?.error_rate ?? 0).toFixed(2)}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Checked</span><span className="font-mono">{timeAgo(h?.checked_at)}</span></div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
