import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  normalizePhone,
  sendEmailsViaResend,
  sendSmsViaMoolre,
  type SendResultItem,
} from "./messaging.server";

export type CommunicationRecipient = {
  id: string;
  storeName: string;
  ownerName: string;
  email: string | null;
  phone: string | null;
  status: string;
  source: "merchant" | "application";
};

const recipientSchema = z.object({
  id: z.string(),
  storeName: z.string(),
  ownerName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  status: z.string(),
  source: z.enum(["merchant", "application"]),
});

export const listCommunicationRecipients = createServerFn({ method: "GET" }).handler(
  async (): Promise<CommunicationRecipient[]> => {
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

    const merchants: CommunicationRecipient[] = (merchantsRes.data ?? []).map((m) => {
      const email = m.owner_email?.trim() || null;
      const phone =
        phoneByMerchantId.get(m.id) ??
        (email ? phoneByEmail.get(email.toLowerCase()) : undefined) ??
        null;
      return {
        id: m.id,
        storeName: m.name,
        ownerName: m.owner_name ?? m.name,
        email,
        phone,
        status: m.status,
        source: "merchant",
      };
    });

    // Include waitlist applicants not yet linked to a merchant
    const waitlist: CommunicationRecipient[] = apps
      .filter((a) => !a.merchant_id)
      .map((a) => ({
        id: a.id,
        storeName: a.store_name || a.business_name || a.full_name,
        ownerName: a.full_name,
        email: a.email?.trim() || null,
        phone: a.phone?.trim() || null,
        status: a.status,
        source: "application" as const,
      }));

    return [...merchants, ...waitlist];
  },
);

const sendPayloadSchema = z.object({
  channels: z.array(z.enum(["email", "sms"])).min(1),
  subject: z.string().optional(),
  message: z.string().min(1),
  recipients: z.array(recipientSchema).min(1),
  extraEmails: z.array(z.string().email()).optional(),
  extraPhones: z.array(z.string()).optional(),
});

export type SendCommunicationResult = {
  email?: { sent: number; failed: number; results: SendResultItem[] };
  sms?: { sent: number; failed: number; results: SendResultItem[] };
};

export const sendMerchantCommunication = createServerFn({ method: "POST" })
  .inputValidator(sendPayloadSchema)
  .handler(async ({ data }): Promise<SendCommunicationResult> => {
    const result: SendCommunicationResult = {};
    const wantsEmail = data.channels.includes("email");
    const wantsSms = data.channels.includes("sms");

    if (wantsEmail) {
      const subject = data.subject?.trim();
      if (!subject) throw new Error("Email subject is required");

      const emailMap = new Map<string, { email: string; name?: string }>();
      for (const r of data.recipients) {
        if (!r.email) continue;
        emailMap.set(r.email.toLowerCase(), { email: r.email, name: r.ownerName });
      }
      for (const email of data.extraEmails ?? []) {
        emailMap.set(email.toLowerCase(), { email });
      }

      const recipients = Array.from(emailMap.values());
      if (!recipients.length) throw new Error("No valid email recipients selected");

      const html = textToHtml(data.message);
      result.email = await sendEmailsViaResend({
        recipients,
        subject,
        html,
        text: data.message,
      });
    }

    if (wantsSms) {
      const phoneMap = new Map<string, { phone: string; name?: string }>();
      for (const r of data.recipients) {
        if (!r.phone) continue;
        const normalized = normalizePhone(r.phone);
        if (!normalized) continue;
        phoneMap.set(normalized, { phone: normalized, name: r.ownerName });
      }
      for (const phone of data.extraPhones ?? []) {
        const normalized = normalizePhone(phone);
        if (!normalized) continue;
        phoneMap.set(normalized, { phone: normalized });
      }

      const recipients = Array.from(phoneMap.values());
      if (!recipients.length) throw new Error("No valid SMS recipients selected");

      result.sms = await sendSmsViaMoolre({
        recipients,
        message: data.message,
      });
    }

    return result;
  });

function textToHtml(message: string) {
  const escaped = message
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const body = escaped.replaceAll("\n", "<br />");
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#0f172a">${body}</div>`;
}
