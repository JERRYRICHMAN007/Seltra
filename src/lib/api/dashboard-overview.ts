import type { DashboardOverview } from "./dashboard.types";

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

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
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return { amount: Number(value).toFixed(2), currency: "GHS" };
  }
  return { amount: "0.00", currency: "GHS" };
}

/** Unwrap common Nest/API envelopes and normalize overview metrics. */
export function normalizeDashboardOverview(payload: unknown): DashboardOverview | null {
  if (!payload || typeof payload !== "object") return null;

  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;

  // Require at least one primary counter so empty/error HTML isn't treated as metrics.
  const hasShape =
    "totalMerchantsStores" in data ||
    "activeMerchantsStores" in data ||
    "gmv30d" in data ||
    "waitlistApplicants" in data;

  if (!hasShape) return null;

  return {
    totalMerchantsStores: asNumber(data.totalMerchantsStores),
    activeMerchantsStores: asNumber(data.activeMerchantsStores),
    gmv30d: asMoney(data.gmv30d),
    paidOrders30d: asNumber(data.paidOrders30d),
    waitlistApplicants: asNumber(data.waitlistApplicants),
    approvedToOnboard: asNumber(data.approvedToOnboard),
    merchantSuccess: asNumber(data.merchantSuccess),
    aiInvocations24h: asNumber(data.aiInvocations24h),
  };
}
