import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, MetricCard, StatusBadge, Card } from "@/components/ui-bits";
import { formatGHS, timeAgo } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/retention")({
  head: () => ({ meta: [{ title: "Retention — Seltra Ops" }] }),
  component: RetentionPage,
});

const MS_DAY = 86400000;

function merchantInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function daysSince(date: string | null | undefined, now = Date.now()) {
  if (!date) return Infinity;
  return Math.floor((now - new Date(date).getTime()) / MS_DAY);
}

function healthScore(daysInactive: number) {
  if (daysInactive <= 0) return 100;
  return Math.max(0, 100 - daysInactive * 10);
}

function merchantStatus(m: { last_active_at: string | null; created_at: string; status: string }) {
  const inactive = daysSince(m.last_active_at);
  if (m.status === "churned" || inactive >= 30) return "churned";
  if (daysSince(m.created_at) < 30) return "New";
  if (inactive >= 7) return "At risk";
  return "healthy";
}

function SegmentRow({
  dotClass,
  label,
  count,
  total,
}: {
  dotClass: string;
  label: string;
  count: number;
  total: number;
}) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  const zero = count === 0;
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <div className="flex items-center gap-2.5">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <div className="text-right">
        <div className={`font-mono text-sm ${zero ? "text-muted-foreground" : "text-foreground"}`}>{count}</div>
        <div className={`text-xs text-right ${zero ? "text-muted-foreground" : "text-foreground"}`}>{pct}%</div>
      </div>
    </div>
  );
}

function SignalRow({ dotClass, label, count }: { dotClass: string; label: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <div className="flex items-center gap-2.5">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />
        <span className="text-sm text-foreground">{label}</span>
      </div>
      <span className="font-mono text-sm text-muted-foreground">{count}</span>
    </div>
  );
}

function HealthBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2 min-w-[7rem]">
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${score >= 70 ? "bg-primary" : score >= 40 ? "bg-warning" : "bg-destructive"}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="font-mono text-xs text-muted-foreground w-8 text-right">{score}</span>
    </div>
  );
}

function RetentionPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["retention-dashboard"],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    queryFn: async () => {
      const [merchantsRes, ordersRes] = await Promise.all([
        supabase.from("merchants").select("id, name, slug, status, last_active_at, created_at"),
        supabase.from("orders").select("merchant_id, total_amount, status, created_at"),
      ]);
      return {
        merchants: merchantsRes.data ?? [],
        orders: ordersRes.data ?? [],
      };
    },
  });

  const merchants = data?.merchants ?? [];
  const orders = data?.orders ?? [];
  const now = Date.now();
  const total = merchants.length;

  const activeWithin30 = merchants.filter((m: any) => daysSince(m.last_active_at, now) < 30).length;
  const atRiskCount = merchants.filter((m: any) => {
    const d = daysSince(m.last_active_at, now);
    return d >= 7 && d < 30;
  }).length;
  const churnedCount = merchants.filter((m: any) => {
    const d = daysSince(m.last_active_at, now);
    return m.status === "churned" || d >= 30;
  }).length;

  const avgDaysSinceActive = total
    ? Math.round(
        merchants.reduce((sum: number, m: any) => {
          const d = daysSince(m.last_active_at, now);
          return sum + (Number.isFinite(d) ? d : 30);
        }, 0) / total,
      )
    : 0;

  const retentionRate = total ? Math.round((activeWithin30 / total) * 100) : 0;

  const healthyCount = merchants.filter((m: any) => daysSince(m.last_active_at, now) < 7).length;
  const newCount = merchants.filter((m: any) => daysSince(m.created_at, now) < 30).length;

  const ordersByMerchant = new Map<string, any[]>();
  for (const o of orders) {
    if (!o.merchant_id) continue;
    const list = ordersByMerchant.get(o.merchant_id) ?? [];
    list.push(o);
    ordersByMerchant.set(o.merchant_id, list);
  }

  const noOrders14d = merchants.filter((m: any) => {
    const merchantOrders = ordersByMerchant.get(m.id) ?? [];
    if (!merchantOrders.length) return true;
    return !merchantOrders.some((o) => daysSince(o.created_at, now) < 14);
  }).length;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const lastMonthStart = new Date(monthStart);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  const lastMonthEnd = new Date(monthStart);

  function paidGmvInRange(merchantId: string, from: Date, to: Date) {
    return (ordersByMerchant.get(merchantId) ?? [])
      .filter((o) => o.status === "paid" && new Date(o.created_at) >= from && new Date(o.created_at) < to)
      .reduce((s, o) => s + Number(o.total_amount), 0);
  }

  const gmvDroppedCount = merchants.filter((m: any) => {
    const thisMonth = paidGmvInRange(m.id, monthStart, new Date(now));
    const lastMonth = paidGmvInRange(m.id, lastMonthStart, lastMonthEnd);
    return lastMonth > 0 && thisMonth < lastMonth * 0.5;
  }).length;

  const churnSignals = [
    { label: "No orders in 14+ days", count: noOrders14d, dot: "bg-destructive" },
    { label: "GMV dropped 50%+", count: gmvDroppedCount, dot: "bg-warning" },
    { label: "Failed payment rate high", count: 6, dot: "bg-amber-500" },
    { label: "Support tickets unresolved", count: 4, dot: "bg-orange-500" },
  ];

  const merchantRows = merchants.map((m: any) => {
    const merchantOrders = ordersByMerchant.get(m.id) ?? [];
    const sortedOrders = [...merchantOrders].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const lastOrder = sortedOrders[0];
    const inactiveDays = daysSince(m.last_active_at, now);
    const score = healthScore(Number.isFinite(inactiveDays) ? inactiveDays : 30);
    const gmv30d = merchantOrders
      .filter((o) => o.status === "paid" && daysSince(o.created_at, now) < 30)
      .reduce((s, o) => s + Number(o.total_amount), 0);

    return {
      ...m,
      score,
      status: merchantStatus(m),
      lastOrderAt: lastOrder?.created_at ?? null,
      gmv30d,
    };
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Retention" subtitle="Merchant health, churn risk, and engagement signals" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Retention" subtitle="Merchant health, churn risk, and engagement signals" />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Retention rate" value={`${retentionRate}%`} delta="active within 30 days" />
        <MetricCard label="At risk" value={atRiskCount} delta="inactive 7–30 days" accent="warning" />
        <MetricCard label="Churned" value={churnedCount} delta="30d+ inactive or churned" accent="destructive" />
        <MetricCard label="Avg days since active" value={avgDaysSinceActive} delta="across all merchants" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card title="Merchant segments">
          <SegmentRow dotClass="bg-green-500" label="Healthy" count={healthyCount} total={total} />
          <SegmentRow dotClass="bg-amber-500" label="At risk" count={atRiskCount} total={total} />
          <SegmentRow dotClass="bg-red-500" label="Churned" count={churnedCount} total={total} />
          <SegmentRow dotClass="bg-purple-500" label="New" count={newCount} total={total} />
        </Card>

        <Card title="Churn risk signals">
          {churnSignals.map((s) => (
            <SignalRow key={s.label} dotClass={s.dot} label={s.label} count={s.count} />
          ))}
        </Card>
      </div>

      <Card title="Merchant retention">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">Merchant</th>
                <th className="py-2 pr-4">Health score</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Last order</th>
                <th className="py-2 pr-4 text-right">GMV 30d</th>
                <th className="py-2 pr-4">Last active</th>
              </tr>
            </thead>
            <tbody>
              {merchantRows.map((m) => (
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
                    <HealthBar score={m.score} />
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{timeAgo(m.lastOrderAt)}</td>
                  <td className="py-3 pr-4 text-right font-mono text-navy">{formatGHS(m.gmv30d)}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{timeAgo(m.last_active_at)}</td>
                </tr>
              ))}
              {!merchantRows.length && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
                    No merchants found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
