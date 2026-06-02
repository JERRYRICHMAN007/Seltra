import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card, MetricCard } from "@/components/ui-bits";
import { formatCompact, timeAgo } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/ai")({
  head: () => ({ meta: [{ title: "AI & Agents — Seltra Ops" }] }),
  component: AgentsPage,
});

function AgentsPage() {
  const { data } = useQuery({
    queryKey: ["agents-dashboard"],
    queryFn: async () => {
      const [invocations, agents] = await Promise.all([
        supabase.from("agent_invocations").select("id,agent_name,success,latency,created_at").order("created_at", { ascending: false }).limit(200),
        supabase.from("agents").select("id,name,created_at").limit(100),
      ]);
      return { invocations: invocations.data ?? [], agents: agents.data ?? [] };
    },
  });

  const inv = data?.invocations ?? [];
  const successRate = inv.length ? Math.round((inv.filter((i:any)=>i.success).length / inv.length) * 100) : 0;

  const activityByHour = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, n: inv.filter((i:any)=>new Date(i.created_at).getHours()===h).length }));

  return (
    <div className="space-y-6">
      <PageHeader title="AI & Agents" subtitle="Agent performance and model usage" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="Invocations (recent)" value={formatCompact(inv.length)} delta="Live" />
        <MetricCard label="Success rate" value={`${successRate}%`} delta="per last 200" />
        <MetricCard label="Deployed agents" value={formatCompact(data?.agents?.length ?? 0)} delta="active" />
      </div>

      <Card title="Invocation activity">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={activityByHour}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line dataKey="n" stroke="var(--color-primary)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Recent invocations">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">Agent</th>
                <th className="py-2 pr-4">Latency</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">When</th>
              </tr>
            </thead>
            <tbody>
              {inv.map((i:any)=> (
                <tr key={i.id} className="border-b border-border hover:bg-surface-muted/50">
                  <td className="py-3 pr-4">{i.agent_name}</td>
                  <td className="py-3 pr-4 font-mono">{i.latency}ms</td>
                  <td className="py-3 pr-4 text-muted-foreground">{i.success ? 'success' : 'error'}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{timeAgo(i.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
