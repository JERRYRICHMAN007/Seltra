import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  buildOpsMessageEmail,
  normalizePhone,
  sendEmailsViaResend,
  sendSmsViaMoolre,
  type SendResultItem,
} from "./messaging.server";
import { seltraInternalFetch } from "./seltra-api.server";

export type MessagingAudienceItem = {
  id: string;
  label: string;
  ownerName: string;
  email: string | null;
  phone: string | null;
  source: "application";
  smsEligible: boolean;
};

export type SendMessagingResult = {
  sent: number;
  failed: number;
  recipientCount: number;
  results: SendResultItem[];
};

type SeltraMessagingContact = {
  id: string;
  fullName: string;
  storeName: string;
  email: string | null;
  phoneNumber: string | null;
};

type SeltraMessagingListResponse = {
  success?: boolean;
  message?: string;
  data?: SeltraMessagingContact[] | SeltraMessagingContact;
};

function toAudienceItem(contact: SeltraMessagingContact): MessagingAudienceItem {
  const phone = contact.phoneNumber?.trim() || null;
  return {
    id: contact.id,
    label: contact.storeName || contact.fullName || "Merchant",
    ownerName: contact.fullName || contact.storeName || "—",
    email: contact.email?.trim() || null,
    phone,
    source: "application",
    smsEligible: Boolean(phone && normalizePhone(phone)),
  };
}

function unwrapContactList(payload: unknown): SeltraMessagingContact[] {
  if (Array.isArray(payload)) return payload as SeltraMessagingContact[];
  if (!payload || typeof payload !== "object") return [];

  const root = payload as SeltraMessagingListResponse;
  if (Array.isArray(root.data)) return root.data;
  if (root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
    return [root.data as SeltraMessagingContact];
  }
  return [];
}

function unwrapContact(payload: unknown): SeltraMessagingContact | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as SeltraMessagingListResponse;
  if (root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
    return root.data as SeltraMessagingContact;
  }
  if ("id" in root && ("email" in root || "phoneNumber" in root)) {
    return root as unknown as SeltraMessagingContact;
  }
  return null;
}

async function fetchMessagingContacts(): Promise<MessagingAudienceItem[]> {
  const payload = await seltraInternalFetch<unknown>("/internal/ops/merchants/messaging");
  return unwrapContactList(payload)
    .filter((c) => Boolean(c?.id))
    .map(toAudienceItem);
}

async function fetchMessagingContactById(id: string): Promise<MessagingAudienceItem | null> {
  const payload = await seltraInternalFetch<unknown>(
    `/internal/ops/merchants/${encodeURIComponent(id)}/messaging`,
  );
  const contact = unwrapContact(payload);
  return contact?.id ? toAudienceItem(contact) : null;
}

/** Audience for pickers — from Seltra GET /internal/ops/merchants/messaging */
export const listMessagingAudience = createServerFn({ method: "GET" }).handler(
  async (): Promise<MessagingAudienceItem[]> => fetchMessagingContacts(),
);

async function resolveContactsByIds(ids: string[]): Promise<MessagingAudienceItem[]> {
  if (!ids.length) return [];

  // Prefer list endpoint (one round trip), then filter — fall back to per-id if needed.
  try {
    const all = await fetchMessagingContacts();
    const wanted = new Set(ids);
    const matched = all.filter((c) => wanted.has(c.id));
    if (matched.length) return matched;
  } catch {
    // fall through to per-id
  }

  const settled = await Promise.allSettled(ids.map((id) => fetchMessagingContactById(id)));
  return settled
    .filter((r): r is PromiseFulfilledResult<MessagingAudienceItem | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((c): c is MessagingAudienceItem => Boolean(c));
}

async function resolveEmailRecipients(input: {
  scope: "all" | "selected";
  recipientIds: string[];
}) {
  const contacts =
    input.scope === "selected"
      ? await resolveContactsByIds(input.recipientIds)
      : await fetchMessagingContacts();

  const map = new Map<string, { email: string; name?: string }>();
  for (const c of contacts) {
    if (!c.email) continue;
    map.set(c.email.toLowerCase(), { email: c.email, name: c.ownerName });
  }
  return Array.from(map.values());
}

async function resolveSmsRecipients(input: {
  scope: "all" | "selected";
  recipientIds: string[];
}) {
  const contacts =
    input.scope === "selected"
      ? await resolveContactsByIds(input.recipientIds)
      : await fetchMessagingContacts();

  const map = new Map<string, { phone: string; name?: string }>();
  for (const c of contacts) {
    if (!c.phone) continue;
    const phone = normalizePhone(c.phone);
    if (!phone) continue;
    map.set(phone, { phone, name: c.ownerName });
  }
  return Array.from(map.values());
}

const emailSendSchema = z.object({
  scope: z.enum(["all", "selected"]),
  recipientIds: z.array(z.string()).default([]),
  sourceType: z.enum(["application", "tenant", "mixed"]).default("application"),
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
      throw new Error("No SMS-eligible recipients — contacts with phone numbers only");
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

/** Preview how many recipients a send would hit (server-resolved from Seltra API). */
export const previewMessagingRecipients = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      channel: z.enum(["email", "sms"]),
      scope: z.enum(["all", "selected"]),
      recipientIds: z.array(z.string()).default([]),
      sourceType: z.enum(["application", "tenant", "mixed"]).default("application"),
    }),
  )
  .handler(async ({ data }): Promise<{ count: number }> => {
    if (data.channel === "email") {
      const recipients = await resolveEmailRecipients({
        scope: data.scope,
        recipientIds: data.recipientIds,
      });
      return { count: recipients.length };
    }

    const recipients = await resolveSmsRecipients({
      scope: data.scope,
      recipientIds: data.recipientIds,
    });
    return { count: recipients.length };
  });
