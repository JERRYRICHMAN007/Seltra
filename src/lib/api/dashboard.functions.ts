import { createServerFn } from "@tanstack/react-start";

import type {
  DashboardActivitySeriesPoint,
  DashboardFootprint,
  DashboardGmvSeriesPoint,
  DashboardOverview,
  DashboardRecentApplication,
  DashboardRecentEvent,
  DashboardSystemStatus,
  DashboardTopMerchantsResponse,
} from "./dashboard.types";
import { normalizeFootprintPayload } from "./dashboard-footprint";
import { normalizeDashboardOverview } from "./dashboard-overview";
import { normalizeRecentEventsPayload } from "./dashboard-recent-events-normalize";
import { normalizeSystemStatusPayload } from "./dashboard-system-status-normalize";
import { normalizeTopMerchantsPayload } from "./dashboard-top-merchants-normalize";
import { seltraInternalFetch } from "./seltra-api.server";

export const getDashboardOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardOverview> => {
    const payload = await seltraInternalFetch<unknown>("/internal/ops/dashboard/overview");
    const overview = normalizeDashboardOverview(payload);
    if (!overview) {
      throw new Error("Invalid overview payload from Seltra API");
    }
    return overview;
  },
);

export const getDashboardFootprint = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardFootprint> => {
    const payload = await seltraInternalFetch<unknown>("/internal/ops/dashboard/footprint");
    const footprint = normalizeFootprintPayload(payload);
    if (!footprint) {
      throw new Error("Invalid footprint payload from Seltra API");
    }
    return footprint;
  },
);

export const getDashboardGmvSeries = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardGmvSeriesPoint[]> =>
    seltraInternalFetch<DashboardGmvSeriesPoint[]>("/internal/ops/dashboard/gmv-series"),
);

export const getDashboardActivitySeries = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardActivitySeriesPoint[]> =>
    seltraInternalFetch<DashboardActivitySeriesPoint[]>("/internal/ops/dashboard/activity-series"),
);

export const getDashboardTopMerchants = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardTopMerchantsResponse> => {
    const payload = await seltraInternalFetch<unknown>("/internal/ops/dashboard/top-merchants?days=30");
    const response = normalizeTopMerchantsPayload(payload);
    if (!response) {
      throw new Error("Invalid top-merchants payload from Seltra API");
    }
    return response;
  },
);

export const getDashboardRecentEvents = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardRecentEvent[]> => {
    const payload = await seltraInternalFetch<unknown>("/internal/ops/dashboard/recent-events");
    const events = normalizeRecentEventsPayload(payload);
    if (!events) {
      throw new Error("Invalid recent-events payload from Seltra API");
    }
    return events;
  },
);

export const getDashboardSystemStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardSystemStatus> => {
    const payload = await seltraInternalFetch<unknown>("/internal/ops/dashboard/system-status");
    const status = normalizeSystemStatusPayload(payload);
    if (!status) {
      throw new Error("Invalid system-status payload from Seltra API");
    }
    return status;
  },
);

export const getDashboardRecentApplications = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardRecentApplication[]> =>
    seltraInternalFetch<DashboardRecentApplication[]>("/internal/ops/dashboard/recent-merchant-applications"),
);
