import process from "node:process";

export function getMessagingConfig() {
  return {
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    resendFrom: process.env.RESEND_FROM ?? "Seltra <careers@send.seltra.co>",
    resendNotifyTo: process.env.RESEND_NOTIFY_TO ?? "",
    moolreApiUser: process.env.MOOLRE_API_USER ?? "",
    moolreApiKey: process.env.MOOLRE_API_KEY ?? "",
    moolreSenderId: process.env.MOOLRE_SENDER_ID ?? "Seltra",
    vasKey: process.env.VAS_KEY ?? "",
  };
}

export type EmailRecipient = {
  email: string;
  name?: string;
};

export type SmsRecipient = {
  phone: string;
  name?: string;
};

export type SendResultItem = {
  to: string;
  ok: boolean;
  error?: string;
};

/** Normalize Ghana-style numbers to 233XXXXXXXXX when possible. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (!digits) return null;

  if (digits.startsWith("233") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `233${digits.slice(1)}`;
  if (digits.length === 9 && /^[235]/.test(digits)) return `233${digits}`;
  if (digits.length >= 10) return digits;
  return null;
}

export async function sendEmailsViaResend(input: {
  recipients: EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
}): Promise<{ sent: number; failed: number; results: SendResultItem[] }> {
  const { resendApiKey, resendFrom } = getMessagingConfig();
  if (!resendApiKey) throw new Error("Missing RESEND_API_KEY");

  const results: SendResultItem[] = [];
  let sent = 0;
  let failed = 0;

  // Resend batch endpoint accepts up to 100 emails per request
  const chunkSize = 50;
  for (let i = 0; i < input.recipients.length; i += chunkSize) {
    const chunk = input.recipients.slice(i, i + chunkSize);
    const payload = chunk.map((r) => ({
      from: resendFrom,
      to: [r.email],
      subject: input.subject,
      html: personalize(input.html, r.name),
      ...(input.text ? { text: personalize(input.text, r.name) } : {}),
    }));

    const response = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      for (const r of chunk) {
        failed += 1;
        results.push({ to: r.email, ok: false, error: body || `Resend ${response.status}` });
      }
      continue;
    }

    const data = (await response.json().catch(() => null)) as
      | { data?: Array<{ id?: string }>; error?: unknown }
      | Array<{ id?: string }>
      | null;

    const items = Array.isArray(data) ? data : data?.data;
    chunk.forEach((r, index) => {
      const item = items?.[index];
      if (item?.id || response.ok) {
        sent += 1;
        results.push({ to: r.email, ok: true });
      } else {
        failed += 1;
        results.push({ to: r.email, ok: false, error: "Batch item failed" });
      }
    });
  }

  return { sent, failed, results };
}

export async function sendSmsViaMoolre(input: {
  recipients: SmsRecipient[];
  message: string;
}): Promise<{ sent: number; failed: number; results: SendResultItem[] }> {
  const { vasKey, moolreSenderId, moolreApiUser, moolreApiKey } = getMessagingConfig();
  if (!vasKey) throw new Error("Missing VAS_KEY");
  if (!moolreSenderId) throw new Error("Missing MOOLRE_SENDER_ID");

  const messages = input.recipients
    .map((r) => {
      const phone = normalizePhone(r.phone);
      if (!phone) return null;
      return {
        recipient: phone,
        message: personalize(input.message, r.name).slice(0, 480),
        ref: `ops-${Date.now()}-${phone.slice(-4)}`,
      };
    })
    .filter(Boolean) as Array<{ recipient: string; message: string; ref: string }>;

  if (!messages.length) {
    return {
      sent: 0,
      failed: input.recipients.length,
      results: input.recipients.map((r) => ({
        to: r.phone,
        ok: false,
        error: "Invalid phone number",
      })),
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-VASKEY": vasKey,
  };
  if (moolreApiUser) headers["X-API-USER"] = moolreApiUser;
  if (moolreApiKey) headers["X-API-KEY"] = moolreApiKey;

  const response = await fetch("https://api.moolre.com/open/sms/send", {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: 1,
      senderid: moolreSenderId,
      messages,
    }),
  });

  const bodyText = await response.text().catch(() => "");
  let parsed: { status?: number; message?: string; code?: string } | null = null;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    parsed = null;
  }

  const ok = response.ok && (parsed?.status === 1 || parsed?.status === undefined);
  if (!ok) {
    const error = parsed?.message || bodyText || `Moolre ${response.status}`;
    return {
      sent: 0,
      failed: messages.length,
      results: messages.map((m) => ({ to: m.recipient, ok: false, error })),
    };
  }

  return {
    sent: messages.length,
    failed: 0,
    results: messages.map((m) => ({ to: m.recipient, ok: true })),
  };
}

function personalize(template: string, name?: string) {
  return template.replaceAll("{{name}}", name?.trim() || "there");
}
