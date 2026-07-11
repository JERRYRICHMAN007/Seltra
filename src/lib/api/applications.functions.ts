import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type {
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
