import type { DashboardTopMerchant, DashboardTopMerchantsResponse } from "./dashboard.types";

function asMoney(value: unknown): { amount: string; currency: string } {
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const amountRaw = obj.amount;
    const amount =
      typeof amountRaw === "number" && Number.isFinite(amountRaw)
        ? amountRaw.toFixed(2)
        : typeof amountRaw === "string" && amountRaw.trim() !== ""
          ? amountRaw
          : "0.00";
    const currency = typeof obj.currency === "string" && obj.currency ? obj.currency : "GHS";
    return { amount, currency };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return { amount: value.toFixed(2), currency: "GHS" };
  }
  return { amount: "0.00", currency: "GHS" };
}

function normalizeMerchant(row: unknown, index: number): DashboardTopMerchant | null {
  if (!row || typeof row !== "object") return null;
  const obj = row as Record<string, unknown>;
  const tenantId = String(obj.tenantId ?? obj.id ?? obj.tenant_id ?? "");
  const name = String(obj.name ?? obj.storeName ?? obj.store_name ?? "").trim();
  if (!tenantId && !name) return null;

  return {
    rank: typeof obj.rank === "number" ? obj.rank : index + 1,
    tenantId: tenantId || `merchant-${index}`,
    name: name || tenantId || "Unknown",
    slug: String(obj.slug ?? "—"),
    gmv: asMoney(obj.gmv ?? obj.gmv30d ?? obj.totalGmv),
  };
}

/** Normalize GET /internal/ops/dashboard/top-merchants payloads. */
export function normalizeTopMerchantsPayload(payload: unknown): DashboardTopMerchantsResponse | null {
  if (!payload || typeof payload !== "object") return null;

  const root = payload as Record<string, unknown>;
  const nested =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;

  const list = Array.isArray(nested.data)
    ? nested.data
    : Array.isArray(root.data)
      ? root.data
      : Array.isArray(payload)
        ? payload
        : null;

  if (!list) return null;

  const data = list
    .map((row, index) => normalizeMerchant(row, index))
    .filter((row): row is DashboardTopMerchant => Boolean(row));

  return {
    period: typeof nested.period === "string" ? nested.period : typeof root.period === "string" ? root.period : "30d",
    fallback: Boolean(nested.fallback ?? root.fallback),
    data,
  };
}
