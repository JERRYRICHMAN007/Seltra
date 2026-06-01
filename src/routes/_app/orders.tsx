import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, MetricCard, StatusBadge, Card } from "@/components/ui-bits";
import { formatGHS, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_app/orders")({
  head: () => ({ meta: [{ title: "Orders — Seltra Ops" }] }),
  component: OrdersPage,
});

function OrdersPage() {
  const { data: orders = [] } = useQuery({
    queryKey: ["orders-all"],
    queryFn: async () => (await supabase.from("orders").select("*, merchants(name,slug)").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const totals = {
    all: orders.length,
    paid: orders.filter((o: any) => o.status === "paid").length,
    pending: orders.filter((o: any) => o.status === "pending").length,
    failed: orders.filter((o: any) => o.status === "failed").length,
    gmv: orders.filter((o: any) => o.status === "paid").reduce((s: number, o: any) => s + Number(o.total_amount), 0),
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Orders" subtitle="All orders across the platform" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard label="Total" value={totals.all} />
        <MetricCard label="Paid" value={totals.paid} />
        <MetricCard label="Pending" value={totals.pending} accent="warning" />
        <MetricCard label="Failed" value={totals.failed} accent="destructive" />
        <MetricCard label="GMV" value={formatGHS(totals.gmv)} />
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">Order</th><th className="py-2 pr-4">Merchant</th><th className="py-2 pr-4">Customer</th>
                <th className="py-2 pr-4 text-right">Amount</th><th className="py-2 pr-4 text-right">Fee</th>
                <th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Ref</th><th className="py-2 pr-4">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o: any) => (
                <tr key={o.id} className="border-b border-border hover:bg-surface-muted/50">
                  <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{o.id.slice(0, 8)}</td>
                  <td className="py-3 pr-4 text-navy">{o.merchants?.name ?? "—"}</td>
                  <td className="py-3 pr-4">{o.customer_name}</td>
                  <td className="py-3 pr-4 text-right font-mono text-navy">{formatGHS(o.total_amount)}</td>
                  <td className="py-3 pr-4 text-right font-mono text-muted-foreground">{formatGHS(o.seltra_fee)}</td>
                  <td className="py-3 pr-4"><StatusBadge status={o.status} /></td>
                  <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{o.paystack_ref}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{shortDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
