import type { DashboardRecentEvent, DashboardRecentEventRow } from "./dashboard.types";
import { timeAgo } from "@/lib/format";

export function recentEventsToRows(events: DashboardRecentEvent[]): DashboardRecentEventRow[] {
  return events.map((event) => ({
    id: event.id,
    type: event.type,
    timeLabel: event.howLongAgo || timeAgo(event.createdAt),
  }));
}

type PlatformEventRow = {
  id: string;
  event_type: string;
  created_at: string;
};

/** Fallback when /dashboard/recent-events API is unavailable. */
export function recentEventsFromPlatformEvents(events: PlatformEventRow[], limit = 10): DashboardRecentEventRow[] {
  return events.slice(0, limit).map((event) => ({
    id: event.id,
    type: event.event_type,
    timeLabel: timeAgo(event.created_at),
  }));
}
