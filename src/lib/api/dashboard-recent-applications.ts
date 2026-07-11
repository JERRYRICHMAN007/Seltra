import type { DashboardRecentApplication } from "./dashboard.types";

type ApplicationRow = {
  id: string;
  full_name: string;
  business_name: string | null;
  store_name: string | null;
  status: string;
  what_you_sell?: string | null;
};

/** Fallback when /dashboard/recent-merchant-applications API is unavailable. */
export function recentApplicationsFromSupabase(apps: ApplicationRow[]): DashboardRecentApplication[] {
  return apps.map((app) => ({
    id: app.id,
    fullName: app.full_name,
    businessName: app.business_name ?? "—",
    storeName: app.store_name ?? app.what_you_sell ?? "—",
    status: app.status,
  }));
}
