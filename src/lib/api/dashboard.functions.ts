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
import { seltraInternalFetch } from "./seltra-api.server";

export const getDashboardOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardOverview> =>
    seltraInternalFetch<DashboardOverview>("/internal/ops/dashboard/overview"),
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
  async (): Promise<DashboardTopMerchantsResponse> =>
    seltraInternalFetch<DashboardTopMerchantsResponse>("/internal/ops/dashboard/top-merchants?days=30"),
);

export const getDashboardRecentEvents = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardRecentEvent[]> =>
    seltraInternalFetch<DashboardRecentEvent[]>("/internal/ops/dashboard/recent-events"),
);

export const getDashboardSystemStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardSystemStatus> =>
    seltraInternalFetch<DashboardSystemStatus>("/internal/ops/dashboard/system-status"),
);

export const getDashboardRecentApplications = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardRecentApplication[]> =>
    seltraInternalFetch<DashboardRecentApplication[]>("/internal/ops/dashboard/recent-merchant-applications"),
);
