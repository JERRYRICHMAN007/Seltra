import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card, MetricCard } from "@/components/ui-bits";
import { formatGHS, formatCompact, timeAgo } from "@/lib/format";

export const Route = createFileRoute("/_app/payments")({
  head: () => ({ meta: [{ title: "Payments — Seltra Ops" }] }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const { data } = useQuery({
    queryKey: ["payments-dashboard"],
    queryFn: async () => {
      const [transactions, balances, orders] = await Promise.all([
        supabase.from("payments").select("id,merchant_id,amount,status,provider,created_at").order("created_at", { ascending: false }).limit(50),
        supabase.from("payment_accounts").select("provider,balance").limit(10),
        supabase.from("orders").select("total_amount,status,created_at").order("created_at", { ascending: false }).limit(1000),
      ]);
      return { transactions: transactions.data ?? [], balances: balances.data ?? [], orders: orders.data ?? [] };
    },
  });

  const tx = data?.transactions ?? [];
  const totalProcessed = tx.filter((t: any) => t.status === "success").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const recentFailed = tx.filter((t: any) => t.status !== "success").length;

  const orders = data?.orders ?? [];
  const paidOrders = orders.filter((o:any)=>o.status === 'paid');
  const monthGmv = paidOrders.filter((o:any)=> new Date(o.created_at).getTime() > Date.now() - 30 * 86400 * 1000).reduce((s:number,o:any)=> s + Number(o.total_amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" subtitle="Master Paystack account — PartechnologiesAndConsult" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard label="GMV (30d)" value={formatGHS(monthGmv)} delta={`${paidOrders.length} paid`} />
        <MetricCard label="Processed (recent)" value={formatGHS(totalProcessed)} delta={`${tx.length} tx`} />
        <MetricCard label="Failed (recent)" value={formatCompact(recentFailed)} delta="Investigate" />
        <MetricCard label="Providers" value={formatCompact(data?.balances?.length ?? 0)} delta="Active connectors" />
      </div>

      <Card title="Recent transactions">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">Merchant</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Provider</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">When</th>
              </tr>
            </thead>
            <tbody>
              {tx.map((t: any) => (
                <tr key={t.id} className="border-b border-border hover:bg-surface-muted/50">
                  <td className="py-3 pr-4 font-mono text-xs">{t.id.slice(0, 8)}</td>
                  <td className="py-3 pr-4">{t.merchant_id}</td>
                  <td className="py-3 pr-4 font-mono">{formatGHS(t.amount)}</td>
                  <td className="py-3 pr-4">{t.provider}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{t.status}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{timeAgo(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
