import type { DashboardActivityChartPoint, DashboardActivitySeriesPoint } from "./dashboard.types";

export function activitySeriesToChartData(series: DashboardActivitySeriesPoint[]): DashboardActivityChartPoint[] {
  return series.map((point) => ({
    day: new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    n: point.count,
  }));
}

type PlatformEventRow = {
  created_at: string;
};

/** Fallback when /dashboard/activity-series API is unavailable. */
export function activitySeriesFromEvents(events: PlatformEventRow[], days = 30): DashboardActivityChartPoint[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    d.setHours(0, 0, 0, 0);
    const next = d.getTime() + 86400000;

    const count = events.filter((event) => {
      const t = new Date(event.created_at).getTime();
      return t >= d.getTime() && t < next;
    }).length;

    return {
      day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      n: count,
    };
  });
}
