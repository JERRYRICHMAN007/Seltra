import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, MetricCard, StatusBadge, Card } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatGHS, formatNumber, formatCompact, shortDate, exportCsv } from "@/lib/format";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/payments")({
  head: () => ({ meta: [{ title: "Payments — Seltra Ops" }] }),
  component: PaymentsPage,
});

type OrderRow = {
  id: string;
  merchant_id: string | null;
  total_amount: number;
  status: string;
  created_at: string;
  merchants: { name: string } | null;
};

function txnRef(id: string) {
  return `TXN-${id.replace(/-/g, "").slice(0, 5).toUpperCase()}`;
}

function PaymentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");

  const { data: orders = [] } = useQuery({
    queryKey: ["payments-orders"],
    queryFn: async () =>
      (
        await supabase
          .from("orders")
          .select("id, merchant_id, total_amount, status, created_at, merchants(name)")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const paidOrders = useMemo(() => orders.filter((o: OrderRow) => o.status === "paid"), [orders]);
  const pendingOrders = useMemo(() => orders.filter((o: OrderRow) => o.status === "pending"), [orders]);
  const failedOrders = useMemo(() => orders.filter((o: OrderRow) => o.status === "failed"), [orders]);

  const totalVolume = useMemo(
    () => paidOrders.reduce((sum, o) => sum + Number(o.total_amount), 0),
    [paidOrders],
  );

  const dailyRevenue = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      d.setHours(0, 0, 0, 0);
      const next = d.getTime() + 86400000;
      const revenue = paidOrders
        .filter((o) => {
          const t = new Date(o.created_at).getTime();
          return t >= d.getTime() && t < next;
        })
        .reduce((sum, o) => sum + Number(o.total_amount), 0);
      return {
        day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        revenue: Math.round(revenue),
      };
    });
  }, [paidOrders]);

  const volumeByStatus = useMemo(() => {
    const statuses = [
      { key: "paid", label: "Paid", color: "bg-primary" },
      { key: "pending", label: "Pending", color: "bg-warning" },
      { key: "failed", label: "Failed", color: "bg-destructive" },
    ] as const;
    return statuses.map(({ key, label, color }) => ({
      key,
      label,
      color,
      volume: orders
        .filter((o: OrderRow) => o.status === key)
        .reduce((sum, o) => sum + Number(o.total_amount), 0),
    }));
  }, [orders]);

  const totalStatusVolume = volumeByStatus.reduce((sum, s) => sum + s.volume, 0);
  const successRate = orders.length ? Math.round((paidOrders.length / orders.length) * 100) : 0;

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const rangeMs =
      dateRange === "7" ? 7 * 86400000 : dateRange === "14" ? 14 * 86400000 : dateRange === "30" ? 30 * 86400000 : null;

    return (orders as OrderRow[]).filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (rangeMs !== null && now - new Date(o.created_at).getTime() > rangeMs) return false;
      if (!q) return true;
      const merchantName = o.merchants?.name?.toLowerCase() ?? "";
      const ref = txnRef(o.id).toLowerCase();
      return merchantName.includes(q) || ref.includes(q) || o.id.toLowerCase().includes(q);
    });
  }, [orders, search, statusFilter, dateRange]);

  function handleExport() {
    exportCsv(
      "payments.csv",
      filteredOrders.map((o) => ({
        merchant: o.merchants?.name ?? "—",
        reference: txnRef(o.id),
        amount: o.total_amount,
        status: o.status,
        date: shortDate(o.created_at),
      })),
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        subtitle="All transactions across merchants"
        action={<Button variant="outline" onClick={handleExport}>Export CSV</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Total volume" value={formatGHS(totalVolume)} delta={`${formatNumber(paidOrders.length)} paid orders`} />
        <MetricCard label="Paid" value={formatNumber(paidOrders.length)} delta="successful transactions" />
        <MetricCard label="Pending" value={formatNumber(pendingOrders.length)} delta="awaiting payment" accent="warning" />
        <MetricCard label="Failed" value={formatNumber(failedOrders.length)} delta="unsuccessful" accent="destructive" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Daily revenue — last 14 days">
          <ResponsiveContainer width="100%" height={256}>
            <LineChart data={dailyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={1} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompact(v)} />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Volume by status">
          <div className="space-y-4">
            <div className="flex h-4 w-full rounded-full bg-muted">
              {volumeByStatus.map((s) => {
                const pct = totalStatusVolume ? (s.volume / totalStatusVolume) * 100 : 0;
                if (pct <= 0) return null;
                return (
                  <div
                    key={s.key}
                    className={`${s.color} h-full first:rounded-l-full last:rounded-r-full`}
                    style={{ width: `${pct}%` }}
                    title={`${s.label}: ${formatGHS(s.volume)}`}
                  />
                );
              })}
            </div>
            <div className="space-y-2">
              {volumeByStatus.map((s) => (
                <div key={s.key} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${s.color}`} />
                    <span className="text-navy">{s.label}</span>
                  </div>
                  <span className="font-mono text-navy">{formatGHS(s.volume)}</span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Success rate</span>
              <span className="text-2xl font-semibold font-mono text-primary">{successRate}%</span>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Transactions">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <Input
            placeholder="Search merchant or reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs bg-surface-muted border-input"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="sm:w-36">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="py-2 pr-4">Merchant</th>
              <th className="py-2 pr-4">Reference</th>
              <th className="py-2 pr-4 text-right">Amount</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((o) => (
              <tr key={o.id} className="border-b border-border hover:bg-surface-muted/50">
                <td className="py-3 pr-4 font-medium text-navy">{o.merchants?.name ?? "—"}</td>
                <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{txnRef(o.id)}</td>
                <td className="py-3 pr-4 text-right font-mono text-navy">{formatGHS(o.total_amount)}</td>
                <td className="py-3 pr-4"><StatusBadge status={o.status} /></td>
                <td className="py-3 pr-4 text-muted-foreground">{shortDate(o.created_at)}</td>
              </tr>
            ))}
            {!filteredOrders.length && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No transactions match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
