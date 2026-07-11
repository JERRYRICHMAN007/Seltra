import type { DashboardSystemStatus, DashboardSystemStatusRow } from "./dashboard.types";

const SERVICE_KEYS = ["api", "agent", "storefront", "payments", "db"] as const;

export function systemStatusToRows(status: DashboardSystemStatus): DashboardSystemStatusRow[] {
  return SERVICE_KEYS.map((key) => ({
    key,
    status: status[key]?.status ?? "unknown",
  }));
}

type HealthRow = {
  service: string;
  status: string;
};

/** Fallback when /dashboard/system-status API is unavailable. */
export function systemStatusFromHealth(health: HealthRow[]): DashboardSystemStatusRow[] {
  const latest = new Map<string, string>();
  health.forEach((row) => {
    if (!latest.has(row.service)) latest.set(row.service, row.status);
  });

  return SERVICE_KEYS.map((key) => ({
    key,
    status: latest.get(key) ?? "unknown",
  }));
}
