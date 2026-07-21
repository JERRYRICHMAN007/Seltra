import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, MetricCard, StatusBadge, Card } from "@/components/ui-bits";
import { timeAgo } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPagination } from "@/components/list-pagination";
import { useClientPagination } from "@/hooks/use-client-pagination";

export const Route = createFileRoute("/_app/features")({
  head: () => ({ meta: [{ title: "Feature Usage — Seltra Ops" }] }),
  component: FeaturesPage,
});

function merchantInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const TRENDS = [
  { feature: "Orders API", trend: "up" as const, note: "+12% vs last month" },
  { feature: "Payments", trend: "up" as const, note: "+8% vs last month" },
  { feature: "Webhooks", trend: "new" as const, note: "Launched 3 weeks ago" },
  { feature: "Analytics", trend: "down" as const, note: "−4% vs last month" },
  { feature: "Storefront", trend: "up" as const, note: "+5% vs last month" },
  { feature: "AI agents", trend: "new" as const, note: "Early adoption phase" },
];

function TrendBadge({ trend }: { trend: "up" | "down" | "new" }) {
  const styles = {
    up: "bg-success-soft text-primary",
    down: "bg-destructive-soft text-destructive",
    new: "bg-accent text-accent-foreground",
  };
  const labels = { up: "Up", down: "Down", new: "New" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${styles[trend]}`}>
      {labels[trend]}
    </span>
  );
}

function FeatureBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function FeaturesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["feature-usage-dashboard"],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    queryFn: async () => {
      const [merchantsRes, ordersRes, invocationsRes] = await Promise.all([
        supabase.from("merchants").select("id, name, slug, status, last_active_at"),
        supabase.from("orders").select("merchant_id, status, created_at"),
        supabase.from("agent_invocations").select("merchant_id, success, created_at"),
      ]);
      return {
        merchants: merchantsRes.data ?? [],
        orders: ordersRes.data ?? [],
        invocations: invocationsRes.data ?? [],
      };
    },
  });

  const merchants = data?.merchants ?? [];
  const orders = data?.orders ?? [];
  const invocations = data?.invocations ?? [];

  const totalMerchants = merchants.length;
  const withOrders = new Set(orders.map((o: any) => o.merchant_id).filter(Boolean));
  const withPaidOrders = new Set(
    orders.filter((o: any) => o.status === "paid").map((o: any) => o.merchant_id).filter(Boolean),
  );
  const withInvocations = new Set(invocations.map((i: any) => i.merchant_id).filter(Boolean));

  const ordersAdoption = totalMerchants ? Math.round((withOrders.size / totalMerchants) * 100) : 0;
  const aiAdoption = totalMerchants ? Math.round((withInvocations.size / totalMerchants) * 100) : 0;
  const avgAdoption = ordersAdoption;

  const {
    page,
    setPage,
    pageItems: merchantPageItems,
    totalPages,
    totalItems,
    pageSize,
  } = useClientPagination(merchants, { pageSize: 10 });

  const adoptionFeatures = [
    { label: "Orders API", pct: ordersAdoption },
    { label: "Payments", pct: 80 },
    { label: "Webhooks", pct: 65 },
    { label: "Analytics", pct: 55 },
    { label: "Storefront", pct: 45 },
    { label: "AI agents", pct: aiAdoption },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Feature usage" subtitle="How merchants are using platform features" />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : (
          <>
            <MetricCard label="Total features" value={6} delta="platform capabilities" />
            <MetricCard label="Average adoption" value={`${avgAdoption}%`} delta="merchants with orders" />
            <MetricCard label="Most used" value="Orders API" delta="highest adoption" />
            <MetricCard label="Least used" value="AI agents" delta="lowest adoption" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Adoption by feature">
          <div className="space-y-4">
            {adoptionFeatures.map((f) => (
              <FeatureBar key={f.label} label={f.label} pct={f.pct} />
            ))}
          </div>
        </Card>

        <Card title="Feature trend">
          <div className="space-y-3">
            {TRENDS.map((t) => (
              <div key={t.feature} className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0">
                <div>
                  <div className="text-sm font-medium text-foreground">{t.feature}</div>
                  <div className="text-xs text-muted-foreground">{t.note}</div>
                </div>
                <TrendBadge trend={t.trend} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Merchant feature adoption">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">Merchant</th>
                <th className="py-2 pr-4">Orders API</th>
                <th className="py-2 pr-4">Payments</th>
                <th className="py-2 pr-4">AI agents</th>
                <th className="py-2 pr-4">Last active</th>
              </tr>
            </thead>
            <tbody>
              {merchantPageItems.map((m: any) => {
                const hasOrders = withOrders.has(m.id);
                const hasPaid = withPaidOrders.has(m.id);
                const hasAi = withInvocations.has(m.id);
                return (
                  <tr key={m.id} className="border-b border-border hover:bg-surface-muted/50">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-xs font-semibold text-primary">
                          {merchantInitials(m.name)}
                        </div>
                        <span className="font-medium text-navy">{m.name}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {hasOrders ? <StatusBadge status="active" /> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3 pr-4">
                      {hasPaid ? <StatusBadge status="active" /> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3 pr-4">
                      {hasAi ? <StatusBadge status="active" /> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{timeAgo(m.last_active_at)}</td>
                  </tr>
                );
              })}
              {!merchants.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                    No merchants found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && (
          <ListPagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
            itemLabel="merchants"
          />
        )}
      </Card>
    </div>
  );
}
