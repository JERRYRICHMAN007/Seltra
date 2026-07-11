import type {
  MerchantListItem,
  MerchantRow,
  MerchantsListResponse,
  MerchantsListResult,
} from "./merchants.types";
import { timeAgo } from "@/lib/format";

export function merchantListItemToRow(item: MerchantListItem): MerchantRow {
  return {
    id: item.tenantId,
    storeName: item.storeName,
    slug: item.slug,
    ownerName: item.ownerName,
    ownerEmail: item.ownerEmail,
    businessType: item.businessType,
    basedIn: "—",
    status: item.status,
    gmv: Number(item.gmv.amount),
    orderCount: item.orderCount,
    lastActive: item.lastActive,
    joinedAt: item.joinedAt,
  };
}

export function merchantsResponseToResult(response: MerchantsListResponse): MerchantsListResult {
  return {
    page: response.page,
    pageSize: response.pageSize,
    total: response.total,
    totalPages: response.totalPages,
    rows: response.data.map(merchantListItemToRow),
  };
}

type SupabaseMerchantRow = {
  id: string;
  name: string;
  slug: string;
  owner_name: string | null;
  owner_email: string | null;
  business_type: string | null;
  based_in: string | null;
  status: string;
  last_active_at: string | null;
  onboarded_at: string | null;
  created_at: string;
};

type PaidOrderRow = {
  merchant_id: string | null;
  total_amount: number | string;
  status: string;
};

/** Fallback when /merchants API is unavailable. */
export function merchantsFromSupabase(
  merchants: SupabaseMerchantRow[],
  orders: PaidOrderRow[],
  query: { search?: string; status?: string; businessType?: string; country?: string },
): MerchantsListResult {
  const gmvByMerchant = new Map<string, { gmv: number; count: number }>();
  orders.forEach((order) => {
    if (order.status !== "paid" || !order.merchant_id) return;
    const prev = gmvByMerchant.get(order.merchant_id) ?? { gmv: 0, count: 0 };
    gmvByMerchant.set(order.merchant_id, {
      gmv: prev.gmv + Number(order.total_amount),
      count: prev.count + 1,
    });
  });

  const search = query.search?.trim().toLowerCase();
  const filtered = merchants.filter((merchant) => {
    if (query.status && merchant.status !== query.status) return false;
    if (query.businessType && merchant.business_type !== query.businessType) return false;
    if (query.country && !merchant.based_in?.toLowerCase().includes(query.country.toLowerCase())) return false;
    if (!search) return true;
    return (
      merchant.name?.toLowerCase().includes(search) ||
      merchant.slug?.toLowerCase().includes(search) ||
      merchant.owner_name?.toLowerCase().includes(search) ||
      merchant.owner_email?.toLowerCase().includes(search)
    );
  });

  const rows: MerchantRow[] = filtered.map((merchant) => {
    const stats = gmvByMerchant.get(merchant.id) ?? { gmv: 0, count: 0 };
    return {
      id: merchant.id,
      storeName: merchant.name,
      slug: merchant.slug,
      ownerName: merchant.owner_name ?? "—",
      ownerEmail: merchant.owner_email ?? "—",
      businessType: merchant.business_type ?? "—",
      basedIn: merchant.based_in ?? "—",
      status: merchant.status,
      gmv: stats.gmv,
      orderCount: stats.count,
      lastActive: timeAgo(merchant.last_active_at),
      joinedAt: merchant.onboarded_at ?? merchant.created_at,
    };
  });

  return {
    page: 1,
    pageSize: rows.length,
    total: rows.length,
    totalPages: 1,
    rows,
  };
}
