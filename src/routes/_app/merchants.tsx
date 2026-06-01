import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusBadge, Card } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { formatGHS, timeAgo, shortDate, exportCsv } from "@/lib/format";

export const Route = createFileRoute("/_app/merchants")({
  head: () => ({ meta: [{ title: "Merchants — Seltra Ops" }] }),
  component: MerchantsPage,
});

function MerchantsPage() {
  const { data: merchants = [] } = useQuery({
    queryKey: ["merchants"],
    queryFn: async () => (await supabase.from("merchants").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: orders = [] } = useQuery({
    queryKey: ["orders-by-merchant"],
    queryFn: async () => (await supabase.from("orders").select("merchant_id,total_amount,status")).data ?? [],
  });

  const gmvByMerchant = new Map<string, { gmv: number; count: number }>();
  orders.forEach((o: any) => {
    if (o.status !== "paid") return;
    const prev = gmvByMerchant.get(o.merchant_id) ?? { gmv: 0, count: 0 };
    gmvByMerchant.set(o.merchant_id, { gmv: prev.gmv + Number(o.total_amount), count: prev.count + 1 });
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Merchants"
        subtitle="All registered stores on Seltra"
        action={<Button onClick={() => exportCsv("merchants.csv", merchants as any)}>Export CSV</Button>}
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">Store</th>
                <th className="py-2 pr-4">Owner</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Location</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4 text-right">GMV</th>
                <th className="py-2 pr-4 text-right">Orders</th>
                <th className="py-2 pr-4">Last Active</th>
                <th className="py-2 pr-4">Joined</th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((m: any) => {
                const stats = gmvByMerchant.get(m.id) ?? { gmv: 0, count: 0 };
                return (
                  <tr key={m.id} className="border-b border-border hover:bg-surface-muted/50 cursor-pointer">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-navy">{m.name}</div>
                      <div className="text-xs font-mono text-muted-foreground">{m.slug}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="text-navy">{m.owner_name}</div>
                      <div className="text-xs text-muted-foreground">{m.owner_email}</div>
                    </td>
                    <td className="py-3 pr-4 text-navy">{m.business_type}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{m.based_in}</td>
                    <td className="py-3 pr-4"><StatusBadge status={m.status} /></td>
                    <td className="py-3 pr-4 text-right font-mono text-navy">{formatGHS(stats.gmv)}</td>
                    <td className="py-3 pr-4 text-right font-mono">{stats.count}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{timeAgo(m.last_active_at)}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{shortDate(m.onboarded_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
