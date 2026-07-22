import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type {
  ApplicationListItem,
  ApplicationsListQuery,
  ApplicationsListResponse,
  ApproveApplicationResponse,
  RejectApplicationResponse,
} from "./applications.types";
import { buildSeltraQuery, seltraInternalFetch } from "./seltra-api.server";

const applicationsListQuerySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  page: z.number().optional(),
  pageSize: z.number().optional(),
});

const WAITLIST_FETCH_PAGE_SIZE = 50;
const WAITLIST_MAX_API_PAGES = 40;

async function fetchApplicationsPage(params: ApplicationsListQuery): Promise<ApplicationsListResponse> {
  const query = buildSeltraQuery(params);
  return seltraInternalFetch<ApplicationsListResponse>(`/internal/ops/applications${query}`);
}

/** Load every application page from Seltra (API totals/page counts are often wrong). */
export const listApplicationsForWaitlist = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      search: z.string().optional(),
    }),
  )
  .handler(async ({ data }): Promise<ApplicationsListResponse> => {
    const search = data.search?.trim() || undefined;
    const byId = new Map<string, ApplicationListItem>();

    for (let page = 1; page <= WAITLIST_MAX_API_PAGES; page += 1) {
      const response = await fetchApplicationsPage({
        search,
        page,
        pageSize: WAITLIST_FETCH_PAGE_SIZE,
      });
      const batch = response.data ?? [];
      if (!batch.length) break;

      for (const item of batch) {
        if (item?.id) byId.set(item.id, item);
      }

      if (batch.length < WAITLIST_FETCH_PAGE_SIZE) break;
    }

    const merged = Array.from(byId.values()).sort(
      (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime(),
    );

    return {
      page: 1,
      pageSize: merged.length,
      total: merged.length,
      totalPages: 1,
      data: merged,
    };
  });

export const listApplications = createServerFn({ method: "POST" })
  .inputValidator(applicationsListQuerySchema)
  .handler(async ({ data }): Promise<ApplicationsListResponse> => {
    const query = buildSeltraQuery(data as ApplicationsListQuery);
    return seltraInternalFetch<ApplicationsListResponse>(`/internal/ops/applications${query}`);
  });

export const approveApplication = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().min(1),
      opsActor: z.string().min(1),
    }),
  )
  .handler(async ({ data }): Promise<ApproveApplicationResponse> =>
    seltraInternalFetch<ApproveApplicationResponse>(`/internal/ops/applications/${data.id}/approve`, {
      method: "POST",
      headers: {
        "X-Ops-Actor": data.opsActor,
      },
    }),
  );

export const rejectApplication = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().min(1),
      opsActor: z.string().min(1),
      reason: z.string().min(1),
    }),
  )
  .handler(async ({ data }): Promise<RejectApplicationResponse> =>
    seltraInternalFetch<RejectApplicationResponse>(`/internal/ops/applications/${data.id}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Ops-Actor": data.opsActor,
      },
      body: JSON.stringify({ reason: data.reason }),
    }),
  );
