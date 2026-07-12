import type { DashboardRecentEvent } from "./dashboard.types";

function normalizeEvent(row: unknown, index: number): DashboardRecentEvent | null {
  if (!row || typeof row !== "object") return null;
  const obj = row as Record<string, unknown>;
  const id = String(obj.id ?? `event-${index}`);
  const type = String(obj.type ?? obj.event_type ?? obj.eventType ?? "").trim();
  if (!type) return null;

  return {
    id,
    type,
    tenantSlug: String(obj.tenantSlug ?? obj.tenant_slug ?? obj.slug ?? ""),
    howLongAgo: String(obj.howLongAgo ?? obj.how_long_ago ?? ""),
    meta: obj.meta && typeof obj.meta === "object" ? (obj.meta as Record<string, unknown>) : undefined,
    createdAt: String(obj.createdAt ?? obj.created_at ?? ""),
  };
}

/** Normalize GET /internal/ops/dashboard/recent-events payloads. */
export function normalizeRecentEventsPayload(payload: unknown): DashboardRecentEvent[] | null {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)
      ? ((payload as { data: unknown[] }).data)
      : null;

  if (!list) return null;

  return list
    .map((row, index) => normalizeEvent(row, index))
    .filter((row): row is DashboardRecentEvent => Boolean(row));
}
