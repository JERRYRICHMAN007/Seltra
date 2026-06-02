import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/ui-bits";
import { formatCompact, timeAgo } from "@/lib/format";

export const Route = createFileRoute("/_app/api-monitor")({
  head: () => ({ meta: [{ title: "API Monitor — Seltra Ops" }] }),
  component: ApiMonitorPage,
});

function ApiMonitorPage() {
  const { data } = useQuery({
    queryKey: ["api-monitor"],
    queryFn: async () => (await supabase.from("api_metrics").select("endpoint,requests,errors,last_seen").order("requests", { ascending: false })).data ?? [],
    refetchInterval: 15000,
  });

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="API Monitor" subtitle="Endpoint usage across the platform" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Top endpoints">
          <div className="space-y-2">
            {rows.slice(0, 10).map((r:any) => (
              <div key={r.endpoint} className="flex items-center justify-between">
                <div className="font-mono text-sm truncate w-56">{r.endpoint}</div>
                <div className="font-mono text-sm">{formatCompact(r.requests)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Recent errors">
          <div className="space-y-2 text-sm text-muted-foreground">
            {rows.filter((r:any)=>r.errors>0).slice(0,8).map((r:any)=> (
              <div key={r.endpoint} className="flex justify-between">
                <div className="truncate w-56">{r.endpoint}</div>
                <div className="font-mono">{r.errors}</div>
              </div>
            ))}
            {!rows.filter((r:any)=>r.errors>0).length && <div className="text-xs">No recent errors</div>}
          </div>
        </Card>

        <Card title="Last seen">
          <div className="space-y-2 text-sm text-muted-foreground">
            {rows.slice(0,8).map((r:any)=> (
              <div key={r.endpoint} className="flex justify-between">
                <div className="truncate w-56">{r.endpoint}</div>
                <div className="font-mono">{timeAgo(r.last_seen)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
