import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card, MetricCard, StatusBadge } from "@/components/ui-bits";
import { formatGHS, formatCompact, timeAgo } from "@/lib/format";

export const Route = createFileRoute("/_app/merchants/success")({
  head: () => ({ meta: [{ title: "Merchant Success — Seltra Ops" }] }),
  component: MerchantSuccessPage,
});

function MerchantSuccessPage() {
  const { data: merchants = [] } = useQuery({
    queryKey: ["merchants"],
    queryFn: async () => (await supabase.from("merchants").select("*")).data ?? [],
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["success-orders"],
    queryFn: async () => (await supabase.from("orders").select("merchant_id,total_amount,status,created_at")).data ?? [],
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["merchant-applications"],
    queryFn: async () => (await supabase.from("merchant_applications").select("status,merchant_id,approved_at,created_at")).data ?? [],
  });

  const paidOrders = useMemo(() => orders.filter((o: any) => o.status === "paid"), [orders]);
  const totalGmv = useMemo(() => paidOrders.reduce((sum: number, order: any) => sum + Number(order.total_amount), 0), [paidOrders]);
  const activeMerchants = useMemo(() => merchants.filter((m: any) => m.status === "active").length, [merchants]);
  const churnedMerchants = useMemo(
    () => merchants.filter((m: any) => m.last_active_at && Date.now() - new Date(m.last_active_at).getTime() > 30 * 86400 * 1000).length,
    [merchants],
  );
  const recentlyOnboarded = useMemo(
    () => merchants.filter((m: any) => m.onboarded_at && Date.now() - new Date(m.onboarded_at).getTime() < 30 * 86400 * 1000).length,
    [merchants],
  );
  const waitlistCount = useMemo(() => applications.filter((app: any) => !app.merchant_id).length, [applications]);
  const approvedCount = useMemo(() => applications.filter((app: any) => app.status === "approved" && !app.merchant_id).length, [applications]);

  const merchantPerformance = useMemo(() => {
    const perf = new Map<string, { gmv: number; orders: number; lastOrder: string | null }>();
    paidOrders.forEach((order: any) => {
      const merchantId = order.merchant_id || "unknown";
      const current = perf.get(merchantId) ?? { gmv: 0, orders: 0, lastOrder: null };
      perf.set(merchantId, {
        gmv: current.gmv + Number(order.total_amount),
        orders: current.orders + 1,
        lastOrder: order.created_at > (current.lastOrder || "") ? order.created_at : current.lastOrder,
      });
    });
    return Array.from(perf.entries())
      .sort((a, b) => b[1].gmv - a[1].gmv)
      .slice(0, 5)
      .map(([merchantId, stats]) => ({ merchantId, ...stats }));
  }, [paidOrders]);

  return (
    <div className="space-y-6">
      <PageHeader title="Merchant Success" subtitle="Health, churn risk, and retention" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <MetricCard label="Active merchants" value={formatCompact(activeMerchants)} delta="tracked" />
        <MetricCard label="GMV (paid)" value={formatGHS(totalGmv)} delta={`${paidOrders.length} paid orders`} />
        <MetricCard label="Churn risk" value={formatCompact(churnedMerchants)} delta="30+ days inactive" />
        <MetricCard label="New onboarded" value={formatCompact(recentlyOnboarded)} delta="last 30 days" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Success signals">
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex justify-between"><span>Total GMV</span><span className="font-mono">{formatGHS(totalGmv)}</span></div>
            <div className="flex justify-between"><span>Paid orders</span><span className="font-mono">{formatCompact(paidOrders.length)}</span></div>
            <div className="flex justify-between"><span>Waiting to onboard</span><span className="font-mono">{formatCompact(waitlistCount)}</span></div>
            <div className="flex justify-between"><span>Approved applicants</span><span className="font-mono">{formatCompact(approvedCount)}</span></div>
          </div>
        </Card>

        <Card title="Top merchant performance">
          <div className="space-y-3">
            {merchantPerformance.map((merchant) => (
              <div key={merchant.merchantId} className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-navy">{merchant.merchantId}</div>
                  <div className="text-xs text-muted-foreground">{merchant.orders} orders</div>
                </div>
                <div className="text-right">
                  <div className="font-mono">{formatGHS(merchant.gmv)}</div>
                  <div className="text-xs text-muted-foreground">{timeAgo(merchant.lastOrder)}</div>
                </div>
              </div>
            ))}
            {!merchantPerformance.length && <div className="text-xs text-muted-foreground">No paid merchant data available yet.</div>}
          </div>
        </Card>

        <Card title="Health overview">
          <div className="space-y-3">
            <div className="flex items-center justify-between"><span>Merchant count</span><StatusBadge status={activeMerchants > 0 ? "healthy" : "unknown"} /></div>
            <div className="flex items-center justify-between"><span>Waitlist flow</span><StatusBadge status={waitlistCount > 0 ? "warning" : "healthy"} /></div>
            <div className="flex items-center justify-between"><span>Onboarding pipeline</span><StatusBadge status={approvedCount > 0 ? "warning" : "healthy"} /></div>
          </div>
        </Card>
      </div>

      <Card title="Merchant success pipeline">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">State</th>
                <th className="py-2 pr-4">Count</th>
                <th className="py-2 pr-4">Last updated</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border hover:bg-surface-muted/50">
                <td className="py-3 pr-4">Waitlist applicants</td>
                <td className="py-3 pr-4 font-mono">{formatCompact(waitlistCount)}</td>
                <td className="py-3 pr-4 text-muted-foreground">—</td>
              </tr>
              <tr className="border-b border-border hover:bg-surface-muted/50">
                <td className="py-3 pr-4">Approved for onboarding</td>
                <td className="py-3 pr-4 font-mono">{formatCompact(approvedCount)}</td>
                <td className="py-3 pr-4 text-muted-foreground">—</td>
              </tr>
              <tr className="border-b border-border hover:bg-surface-muted/50">
                <td className="py-3 pr-4">Merchants with paid GMV</td>
                <td className="py-3 pr-4 font-mono">{formatCompact(new Set(paidOrders.map((o: any) => o.merchant_id)).size)}</td>
                <td className="py-3 pr-4 text-muted-foreground">{paidOrders.length ? timeAgo(paidOrders[0].created_at) : "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
