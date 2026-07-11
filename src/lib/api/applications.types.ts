export type ApplicationsListQuery = {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type ApplicationListItem = {
  id: string;
  ownerName: string;
  ownerEmail: string;
  businessName: string;
  businessType: string;
  status: string;
  appliedAt: string;
};

export type ApplicationsListResponse = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  data: ApplicationListItem[];
};

export type ApproveApplicationResponse = {
  applicationId: string;
  merchantId: string;
  email: string;
  status: string;
  credentialsSent: boolean;
};

export type RejectApplicationResponse = {
  applicationId: string;
  status: string;
};

export type ApplicationRow = {
  id: string;
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  businessType: string;
  status: string;
  appliedAt: string;
};

export type ApplicationsListResult = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  rows: ApplicationRow[];
};
