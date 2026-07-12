import type { DashboardSystemStatus, DashboardSystemStatusCheck } from "./dashboard.types";

const SERVICE_KEYS = ["api", "agent", "storefront", "payments", "db"] as const;

function normalizeCheck(value: unknown): DashboardSystemStatusCheck {
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return {
      status: String(obj.status ?? "unknown"),
      lastCheckedAt: String(obj.lastCheckedAt ?? obj.last_checked_at ?? ""),
      reason: typeof obj.reason === "string" ? obj.reason : undefined,
      latencyMs: typeof obj.latencyMs === "number" ? obj.latencyMs : undefined,
    };
  }
  if (typeof value === "string") {
    return { status: value, lastCheckedAt: "" };
  }
  return { status: "unknown", lastCheckedAt: "" };
}

/** Normalize GET /internal/ops/dashboard/system-status payloads. */
export function normalizeSystemStatusPayload(payload: unknown): DashboardSystemStatus | null {
  if (!payload || typeof payload !== "object") return null;

  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;

  const hasShape = SERVICE_KEYS.some((key) => key in data);
  if (!hasShape) return null;

  return {
    api: normalizeCheck(data.api),
    agent: normalizeCheck(data.agent),
    storefront: normalizeCheck(data.storefront),
    payments: normalizeCheck(data.payments),
    db: normalizeCheck(data.db),
  };
}
