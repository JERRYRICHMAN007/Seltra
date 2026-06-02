import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/ui-bits";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatCompact } from "@/lib/format";

export const Route = createFileRoute("/_app/retention")({
  head: () => ({ meta: [{ title: "Retention — Seltra Ops" }] }),
  component: RetentionPage,
});

function RetentionPage() {
  const { data } = useQuery({
    queryKey: ["retention"],
    queryFn: async () => (await supabase.from("cohort_metrics").select("period,retention_rate,count").order("period", { ascending: true })).data ?? [],
  });

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Retention" subtitle="Cohort retention and churn analysis" />
      <Card title="Retention over time">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v:any) => (typeof v === 'number' ? `${Math.round(v * 100)}%` : v)} />
              <Area dataKey="retention_rate" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.12} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
