import type { DashboardGmvChartPoint, DashboardGmvSeriesPoint } from "./dashboard.types";

export function gmvSeriesToChartData(series: DashboardGmvSeriesPoint[]): DashboardGmvChartPoint[] {
  return series.map((point) => ({
    day: new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    gmv: Math.round(Number(point.gmv.amount)),
    orders: point.orders,
  }));
}

type PaidOrderRow = {
  created_at: string;
  total_amount: number | string;
};

/** Fallback when /dashboard/gmv-series API is unavailable. */
export function gmvSeriesFromOrders(paidOrders: PaidOrderRow[], days = 30): DashboardGmvChartPoint[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    d.setHours(0, 0, 0, 0);
    const next = d.getTime() + 86400000;

    const dayOrders = paidOrders.filter((o) => {
      const t = new Date(o.created_at).getTime();
      return t >= d.getTime() && t < next;
    });

    const gmv = dayOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);

    return {
      day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      gmv: Math.round(gmv),
      orders: dayOrders.length,
    };
  });
}
