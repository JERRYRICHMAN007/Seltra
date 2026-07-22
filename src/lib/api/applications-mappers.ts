import type {
  ApplicationListItem,
  ApplicationRow,
  ApplicationsListResponse,
  ApplicationsListResult,
} from "./applications.types";

export function applicationListItemToRow(item: ApplicationListItem): ApplicationRow {
  return {
    id: item.id,
    businessName: item.businessName,
    ownerName: item.ownerName,
    ownerEmail: item.ownerEmail,
    businessType: item.businessType,
    status: item.status,
    appliedAt: item.appliedAt,
  };
}

export function applicationsResponseToResult(response: ApplicationsListResponse): ApplicationsListResult {
  const page = Number(response.page) || 1;
  const pageSize = Number(response.pageSize) || 10;
  const total = Number(response.total) || response.data?.length || 0;
  const totalPages =
    Number(response.totalPages) ||
    Math.max(1, Math.ceil(total / Math.max(pageSize, 1)));

  return {
    page,
    pageSize,
    total,
    totalPages,
    rows: (response.data ?? []).map(applicationListItemToRow),
  };
}

type SupabaseApplicationRow = {
  id: string;
  business_name: string | null;
  full_name: string;
  email: string | null;
  business_type: string | null;
  status: string;
  created_at: string;
  merchant_id: string | null;
};

/** Fallback when /applications API is unavailable. */
export function applicationsFromSupabase(
  apps: SupabaseApplicationRow[],
  query: { status?: string; search?: string },
): ApplicationsListResult {
  const search = query.search?.trim().toLowerCase();
  const filtered = apps.filter((app) => {
    if (query.status && app.status !== query.status) return false;
    if (!search) return true;
    const businessName = app.business_name ?? app.full_name;
    return (
      businessName.toLowerCase().includes(search) ||
      app.full_name.toLowerCase().includes(search) ||
      app.email?.toLowerCase().includes(search)
    );
  });

  const rows: ApplicationRow[] = filtered.map((app) => ({
    id: app.id,
    businessName: app.business_name ?? app.full_name,
    ownerName: app.full_name,
    ownerEmail: app.email ?? "—",
    businessType: app.business_type ?? "—",
    status: app.status,
    appliedAt: app.created_at,
  }));

  return {
    page: 1,
    pageSize: rows.length,
    total: rows.length,
    totalPages: 1,
    rows,
  };
}
