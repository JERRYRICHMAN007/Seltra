import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type {
  MerchantDetailResponse,
  MerchantPatchBody,
  MerchantRemoveResponse,
  MerchantsListQuery,
  MerchantsListResponse,
} from "./merchants.types";
import { buildSeltraQuery, seltraInternalFetch, seltraInternalFetchText } from "./seltra-api.server";

const merchantsListQuerySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  businessType: z.string().optional(),
  country: z.string().optional(),
  sortBy: z.enum(["gmv", "orders", "lastActive", "joined"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  page: z.number().optional(),
  pageSize: z.number().optional(),
});

const merchantPatchSchema = z.object({
  name: z.string().optional(),
  businessType: z.string().optional(),
  status: z.string().optional(),
  basedIn: z.string().optional(),
});

export const listMerchants = createServerFn({ method: "POST" })
  .inputValidator(merchantsListQuerySchema)
  .handler(async ({ data }): Promise<MerchantsListResponse> => {
    const query = buildSeltraQuery(data as MerchantsListQuery);
    return seltraInternalFetch<MerchantsListResponse>(`/internal/ops/merchants${query}`);
  });

export const exportMerchantsCsv = createServerFn({ method: "POST" })
  .inputValidator(merchantsListQuerySchema.omit({ page: true, pageSize: true }))
  .handler(async ({ data }): Promise<string> => {
    const query = buildSeltraQuery(data as MerchantsListQuery);
    return seltraInternalFetchText(`/internal/ops/merchants/export.csv${query}`);
  });

export const getMerchantDetail = createServerFn({ method: "POST" })
  .inputValidator(z.object({ tenantId: z.string().min(1) }))
  .handler(async ({ data }): Promise<MerchantDetailResponse> =>
    seltraInternalFetch<MerchantDetailResponse>(`/internal/ops/merchants/${data.tenantId}`),
  );

export const patchMerchant = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      tenantId: z.string().min(1),
      opsActor: z.string().min(1),
      patch: merchantPatchSchema,
    }),
  )
  .handler(async ({ data }): Promise<MerchantDetailResponse> => {
    const body: MerchantPatchBody = {
      name: data.patch.name,
      businessType: data.patch.businessType,
      status: data.patch.status,
      basedIn: data.patch.basedIn,
    };

    return seltraInternalFetch<MerchantDetailResponse>(`/internal/ops/merchants/${data.tenantId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Ops-Actor": data.opsActor,
      },
      body: JSON.stringify(body),
    });
  });

export const removeMerchant = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      tenantId: z.string().min(1),
      opsActor: z.string().min(1),
    }),
  )
  .handler(async ({ data }): Promise<MerchantRemoveResponse> =>
    seltraInternalFetch<MerchantRemoveResponse>(`/internal/ops/merchants/${data.tenantId}`, {
      method: "DELETE",
      headers: {
        "X-Ops-Actor": data.opsActor,
      },
    }),
  );
