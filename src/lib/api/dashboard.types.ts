export type DashboardOverview = {
  totalMerchantsStores: number;
  activeMerchantsStores: number;
  gmv30d: {
    amount: string;
    currency: string;
  };
  paidOrders30d: number;
  waitlistApplicants: number;
  approvedToOnboard: number;
  merchantSuccess: number;
  aiInvocations24h: number;
};

export type DashboardFootprintCity = {
  city: string;
  count: number;
};

export type DashboardFootprintCountry = {
  country: string;
  count: number;
  cities: DashboardFootprintCity[];
};

export type DashboardFootprint = {
  totalMerchants: number;
  activeMerchants: number;
  countries: DashboardFootprintCountry[];
  topMarket: string;
};

export type DashboardGmvSeriesPoint = {
  date: string;
  gmv: {
    amount: string;
    currency: string;
  };
  orders: number;
};

export type DashboardGmvChartPoint = {
  day: string;
  gmv: number;
  orders: number;
};

export type DashboardActivitySeriesPoint = {
  date: string;
  count: number;
};

export type DashboardActivityChartPoint = {
  day: string;
  n: number;
};

export type DashboardTopMerchant = {
  rank: number;
  tenantId: string;
  name: string;
  slug: string;
  gmv: {
    amount: string;
    currency: string;
  };
};

export type DashboardTopMerchantsResponse = {
  period: string;
  fallback: boolean;
  data: DashboardTopMerchant[];
};

export type DashboardTopMerchantRow = {
  id: string;
  rank: number;
  name: string;
  slug: string;
  gmv: number;
};

export type DashboardRecentEvent = {
  id: string;
  type: string;
  tenantSlug: string;
  howLongAgo: string;
  meta?: Record<string, unknown>;
  createdAt: string;
};

export type DashboardRecentEventRow = {
  id: string;
  type: string;
  timeLabel: string;
};

export type DashboardSystemStatusCheck = {
  status: string;
  lastCheckedAt: string;
  reason?: string;
  latencyMs?: number;
};

export type DashboardSystemStatus = {
  api: DashboardSystemStatusCheck;
  agent: DashboardSystemStatusCheck;
  storefront: DashboardSystemStatusCheck;
  payments: DashboardSystemStatusCheck;
  db: DashboardSystemStatusCheck;
};

export type DashboardSystemStatusRow = {
  key: string;
  status: string;
};

export type DashboardRecentApplication = {
  id: string;
  fullName: string;
  businessName: string;
  storeName: string;
  status: string;
};
