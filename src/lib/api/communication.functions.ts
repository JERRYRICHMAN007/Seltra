import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildOpsMessageEmail,
  normalizePhone,
  sendEmailsViaResend,
  sendSmsViaMoolre,
  type SendResultItem,
} from "./messaging.server";

export type MessagingAudienceItem = {
  id: string;
  label: string;
  ownerName: string;
  email: string | null;
  phone: string | null;
  source: "application" | "tenant";
  smsEligible: boolean;
};

export type SendMessagingResult = {
  sent: number;
  failed: number;
  recipientCount: number;
  results: SendResultItem[];
};

async function loadMessagingAudience(): Promise<MessagingAudienceItem[]> {
  const [merchantsRes, appsRes] = await Promise.all([
    supabaseAdmin
      .from("merchants")
      .select("id, name, owner_name, owner_email, status")
      .order("name", { ascending: true }),
    supabaseAdmin
      .from("merchant_applications")
      .select("id, full_name, business_name, store_name, email, phone, status, merchant_id")
      .order("created_at", { ascending: false }),
  ]);

  if (merchantsRes.error) throw new Error(merchantsRes.error.message);
  if (appsRes.error) throw new Error(appsRes.error.message);

  const apps = appsRes.data ?? [];
  const phoneByMerchantId = new Map<string, string>();
  const phoneByEmail = new Map<string, string>();

  for (const app of apps) {
    const phone = app.phone?.trim();
    if (!phone) continue;
    if (app.merchant_id && !phoneByMerchantId.has(app.merchant_id)) {
      phoneByMerchantId.set(app.merchant_id, phone);
    }
    if (app.email) {
      const key = app.email.toLowerCase();
      if (!phoneByEmail.has(key)) phoneByEmail.set(key, phone);
    }
  }

  const tenants: MessagingAudienceItem[] = (merchantsRes.data ?? []).map((m) => {
    const email = m.owner_email?.trim() || null;
    const phone =
      phoneByMerchantId.get(m.id) ??
      (email ? phoneByEmail.get(email.toLowerCase()) ?? null : null);
    return {
      id: m.id,
      label: m.name,
      ownerName: m.owner_name ?? m.name,
      email,
      phone,
      source: "tenant" as const,
      smsEligible: Boolean(phone && normalizePhone(phone)),
    };
  });

  const applications: MessagingAudienceItem[] = apps.map((a) => {
    const phone = a.phone?.trim() || null;
    return {
      id: a.id,
      label: a.store_name || a.business_name || a.full_name,
      ownerName: a.full_name,
      email: a.email?.trim() || null,
      phone,
      source: "application" as const,
      smsEligible: Boolean(phone && normalizePhone(phone)),
    };
  });

  return [...applications, ...tenants];
}

/** Audience for pickers — applications always; tenants for email (often no phone). */
export const listMessagingAudience = createServerFn({ method: "GET" }).handler(
  async (): Promise<MessagingAudienceItem[]> => loadMessagingAudience(),
);

async function resolveEmailRecipients(input: {
  scope: "all" | "selected";
  recipientIds: string[];
  sourceType: "application" | "tenant" | "mixed";
}) {
  // Re-fetch fresh contact rows by ID — never trust client-submitted addresses
  if (input.scope === "selected") {
    if (!input.recipientIds.length) return [];

    const wantApps = input.sourceType === "application" || input.sourceType === "mixed";
    const wantTenants = input.sourceType === "tenant" || input.sourceType === "mixed";

    const [appsFresh, tenantsFresh] = await Promise.all([
      wantApps
        ? supabaseAdmin
            .from("merchant_applications")
            .select("id, full_name, email")
            .in("id", input.recipientIds)
        : Promise.resolve({ data: [], error: null }),
      wantTenants
        ? supabaseAdmin
            .from("merchants")
            .select("id, owner_name, name, owner_email")
            .in("id", input.recipientIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (appsFresh.error) throw new Error(appsFresh.error.message);
    if (tenantsFresh.error) throw new Error(tenantsFresh.error.message);

    const map = new Map<string, { email: string; name?: string }>();
    for (const a of appsFresh.data ?? []) {
      if (!a.email?.trim()) continue;
      map.set(a.email.toLowerCase(), { email: a.email.trim(), name: a.full_name });
    }
    for (const t of tenantsFresh.data ?? []) {
      if (!t.owner_email?.trim()) continue;
      map.set(t.owner_email.toLowerCase(), {
        email: t.owner_email.trim(),
        name: t.owner_name ?? t.name,
      });
    }
    return Array.from(map.values());
  }

  // scope === all
  let appsQuery = supabaseAdmin.from("merchant_applications").select("id, full_name, email");
  let tenantsQuery = supabaseAdmin.from("merchants").select("id, owner_name, name, owner_email");

  if (input.sourceType === "application") {
    const { data, error } = await appsQuery;
    if (error) throw new Error(error.message);
    const map = new Map<string, { email: string; name?: string }>();
    for (const a of data ?? []) {
      if (!a.email?.trim()) continue;
      map.set(a.email.toLowerCase(), { email: a.email.trim(), name: a.full_name });
    }
    return Array.from(map.values());
  }

  if (input.sourceType === "tenant") {
    const { data, error } = await tenantsQuery;
    if (error) throw new Error(error.message);
    const map = new Map<string, { email: string; name?: string }>();
    for (const t of data ?? []) {
      if (!t.owner_email?.trim()) continue;
      map.set(t.owner_email.toLowerCase(), {
        email: t.owner_email.trim(),
        name: t.owner_name ?? t.name,
      });
    }
    return Array.from(map.values());
  }

  const [apps, tenants] = await Promise.all([appsQuery, tenantsQuery]);
  if (apps.error) throw new Error(apps.error.message);
  if (tenants.error) throw new Error(tenants.error.message);

  const map = new Map<string, { email: string; name?: string }>();
  for (const a of apps.data ?? []) {
    if (!a.email?.trim()) continue;
    map.set(a.email.toLowerCase(), { email: a.email.trim(), name: a.full_name });
  }
  for (const t of tenants.data ?? []) {
    if (!t.owner_email?.trim()) continue;
    map.set(t.owner_email.toLowerCase(), {
      email: t.owner_email.trim(),
      name: t.owner_name ?? t.name,
    });
  }
  return Array.from(map.values());
}

async function resolveSmsRecipients(input: {
  scope: "all" | "selected";
  recipientIds: string[];
}) {
  // SMS v1: applications only (tenants have no reliable phone field)
  let query = supabaseAdmin
    .from("merchant_applications")
    .select("id, full_name, phone, store_name, business_name");

  if (input.scope === "selected") {
    if (!input.recipientIds.length) return [];
    query = query.in("id", input.recipientIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const map = new Map<string, { phone: string; name?: string }>();
  for (const row of data ?? []) {
    if (!row.phone?.trim()) continue;
    const phone = normalizePhone(row.phone);
    if (!phone) continue;
    map.set(phone, {
      phone,
      name: row.full_name || row.store_name || row.business_name || undefined,
    });
  }
  return Array.from(map.values());
}

const emailSendSchema = z.object({
  scope: z.enum(["all", "selected"]),
  recipientIds: z.array(z.string()).default([]),
  sourceType: z.enum(["application", "tenant", "mixed"]).default("mixed"),
  title: z.string().min(1),
  body: z.string().min(1),
});

const smsSendSchema = z.object({
  scope: z.enum(["all", "selected"]),
  recipientIds: z.array(z.string()).default([]),
  body: z.string().min(1),
});

export const sendOpsEmail = createServerFn({ method: "POST" })
  .inputValidator(emailSendSchema)
  .handler(async ({ data }): Promise<SendMessagingResult> => {
    if (data.scope === "selected" && !data.recipientIds.length) {
      throw new Error("Select at least one recipient");
    }

    const recipients = await resolveEmailRecipients({
      scope: data.scope,
      recipientIds: data.recipientIds,
      sourceType: data.sourceType,
    });

    if (!recipients.length) throw new Error("No valid email recipients resolved");

    const html = buildOpsMessageEmail({ title: data.title.trim(), body: data.body.trim() });
    const result = await sendEmailsViaResend({
      recipients,
      subject: data.title.trim(),
      html,
      text: data.body.trim(),
    });

    return {
      sent: result.sent,
      failed: result.failed,
      recipientCount: recipients.length,
      results: result.results,
    };
  });

export const sendOpsSms = createServerFn({ method: "POST" })
  .inputValidator(smsSendSchema)
  .handler(async ({ data }): Promise<SendMessagingResult> => {
    if (data.scope === "selected" && !data.recipientIds.length) {
      throw new Error("Select at least one recipient");
    }

    const recipients = await resolveSmsRecipients({
      scope: data.scope,
      recipientIds: data.recipientIds,
    });

    if (!recipients.length) {
      throw new Error("No SMS-eligible recipients — applications with phone numbers only");
    }

    const result = await sendSmsViaMoolre({
      recipients,
      message: data.body.trim(),
    });

    return {
      sent: result.sent,
      failed: result.failed,
      recipientCount: recipients.length,
      results: result.results,
    };
  });

/** Preview how many recipients a send would hit (server-resolved). */
export const previewMessagingRecipients = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      channel: z.enum(["email", "sms"]),
      scope: z.enum(["all", "selected"]),
      recipientIds: z.array(z.string()).default([]),
      sourceType: z.enum(["application", "tenant", "mixed"]).default("mixed"),
    }),
  )
  .handler(async ({ data }): Promise<{ count: number }> => {
    if (data.channel === "email") {
      const recipients = await resolveEmailRecipients({
        scope: data.scope,
        recipientIds: data.recipientIds,
        sourceType: data.sourceType,
      });
      return { count: recipients.length };
    }

    const recipients = await resolveSmsRecipients({
      scope: data.scope,
      recipientIds: data.recipientIds,
    });
    return { count: recipients.length };
  });
