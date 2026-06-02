import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/ui-bits";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/features")({
  head: () => ({ meta: [{ title: "Feature Usage — Seltra Ops" }] }),
  component: FeaturesPage,
});

function FeaturesPage() {
  const { data } = useQuery({
    queryKey: ["feature-usage"],
    queryFn: async () => (await supabase.from("feature_metrics").select("feature,uses").order("uses", { ascending: false })).data ?? [],
  });

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Feature Usage" subtitle="Which parts of Seltra merchants actually use" />

      <Card title="Top features by usage">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="feature" type="category" tick={{ fontSize: 11 }} width={160} />
              <Tooltip />
              <Bar dataKey="uses" fill="var(--color-primary)" radius={[4, 4, 4, 4]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
