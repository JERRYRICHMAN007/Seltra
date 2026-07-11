import type {
  DashboardTopMerchantRow,
  DashboardTopMerchantsResponse,
} from "./dashboard.types";

export function topMerchantsToRows(response: DashboardTopMerchantsResponse): DashboardTopMerchantRow[] {
  return response.data.map((merchant) => ({
    id: merchant.tenantId,
    rank: merchant.rank,
    name: merchant.name,
    slug: merchant.slug,
    gmv: Number(merchant.gmv.amount),
  }));
}

type PaidOrderRow = {
  merchant_id: string | null;
  total_amount: number | string;
};

type MerchantRow = {
  id: string;
  name: string;
  slug: string;
};

/** Fallback when /dashboard/top-merchants API is unavailable. */
export function topMerchantsFromOrders(
  paidOrders: PaidOrderRow[],
  merchantsById: Map<string, MerchantRow>,
  limit = 5,
): DashboardTopMerchantRow[] {
  const gmvByMerchant = new Map<string, number>();

  paidOrders.forEach((order) => {
    if (!order.merchant_id) return;
    gmvByMerchant.set(
      order.merchant_id,
      (gmvByMerchant.get(order.merchant_id) ?? 0) + Number(order.total_amount),
    );
  });

  return Array.from(gmvByMerchant.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, gmv], index) => {
      const merchant = merchantsById.get(id);
      return {
        id,
        rank: index + 1,
        name: merchant?.name ?? id,
        slug: merchant?.slug ?? "—",
        gmv,
      };
    });
}
