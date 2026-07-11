export type MerchantSortBy = "gmv" | "orders" | "lastActive" | "joined";
export type SortDir = "asc" | "desc";

export type MerchantsListQuery = {
  search?: string;
  status?: string;
  businessType?: string;
  country?: string;
  sortBy?: MerchantSortBy;
  sortDir?: SortDir;
  page?: number;
  pageSize?: number;
};

export type MerchantListItem = {
  tenantId: string;
  storeName: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  businessType: string;
  status: string;
  gmv: { amount: string; currency: string };
  orderCount: number;
  lastActive: string;
  joinedAt: string;
};

export type MerchantsListResponse = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  data: MerchantListItem[];
};

export type MerchantDetail = {
  tenantId: string;
  storeName: string;
  ownerName: string;
  ownerEmail: string;
  businessType: string;
  basedIn: string;
};

export type MerchantDetailResponse = {
  data: MerchantDetail;
};

export type MerchantPatchBody = {
  name?: string;
  businessType?: string;
  status?: string;
  basedIn?: string;
};

export type MerchantRemoveResponse = {
  tenantId: string;
  status: string;
};

export type MerchantRow = {
  id: string;
  storeName: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  businessType: string;
  basedIn: string;
  status: string;
  gmv: number;
  orderCount: number;
  lastActive: string;
  joinedAt: string;
};

export type MerchantsListResult = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  rows: MerchantRow[];
};
