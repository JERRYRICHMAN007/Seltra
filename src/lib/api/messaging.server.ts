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

function dedupeEmailRecipients(recipients: EmailRecipient[]): EmailRecipient[] {
  const map = new Map<string, EmailRecipient>();
  for (const r of recipients) {
    const key = r.email.trim().toLowerCase();
    if (!key) continue;
    if (!map.has(key)) map.set(key, { email: r.email.trim(), name: r.name });
  }
  return Array.from(map.values());
}

function dedupeSmsRecipients(recipients: SmsRecipient[]): SmsRecipient[] {
  const map = new Map<string, SmsRecipient>();
  for (const r of recipients) {
    const phone = normalizePhone(r.phone);
    if (!phone) continue;
    if (!map.has(phone)) map.set(phone, { phone: r.phone, name: r.name });
  }
  return Array.from(map.values());
}

async function sendOneEmailViaResend(input: {
  recipient: EmailRecipient;
  subject: string;
  html: string;
  text?: string;
  resendApiKey: string;
  resendFrom: string;
}): Promise<SendResultItem> {
  const { recipient, subject, html, text, resendApiKey, resendFrom } = input;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [recipient.email],
        subject,
        html,
        ...(text ? { text } : {}),
      }),
    });
    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      return { to: recipient.email, ok: false, error: errBody || `Resend ${response.status}` };
    }
    return { to: recipient.email, ok: true };
  } catch (err) {
    return {
      to: recipient.email,
      ok: false,
      error: err instanceof Error ? err.message : "Send failed",
    };
  }
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Dark header / green accent shell matching Seltra brand emails. */
export function emailShell(innerRowsHtml: string) {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0a0a;padding:32px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;border-collapse:collapse;overflow:hidden;border-radius:12px">
          ${innerRowsHtml}
          <tr>
            <td style="background:#09090b;padding:20px 40px;border-top:1px solid #27272a">
              <p style="margin:0;font-size:11px;color:#71717a;line-height:1.6">
                Sent by Seltra Ops · <a href="https://seltra.co" style="color:#22c55e;text-decoration:none">seltra.co</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildOpsMessageEmail(input: { title: string; body: string }): string {
  const safeBody = escapeHtml(input.body).replace(/\n/g, "<br/>");
  const safeTitle = escapeHtml(input.title);

  return emailShell(`
    <tr><td style="background:#18181b;border-left:3px solid #22c55e;padding:20px 40px">
      <p style="margin:0;font-size:11px;color:#71717a;font-family:monospace;letter-spacing:1px;text-transform:uppercase">// seltra</p>
      <p style="margin:6px 0 0;font-size:18px;font-weight:600;color:#ffffff">${safeTitle}</p>
    </td></tr>
    <tr><td style="background:#ffffff;padding:36px 40px">
      <p style="margin:0;font-size:13px;color:#0a0a0a;line-height:1.8">${safeBody}</p>
    </td></tr>
  `);
}

/** Normalize to E.164 (+233…) when possible. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (!digits) return null;

  let normalized = digits;
  if (digits.startsWith("233") && digits.length >= 12) normalized = digits;
  else if (digits.startsWith("0") && digits.length === 10) normalized = `233${digits.slice(1)}`;
  else if (digits.length === 9 && /^[235]/.test(digits)) normalized = `233${digits}`;
  else if (digits.length >= 10) normalized = digits;
  else return null;

  return `+${normalized}`;
}

export async function sendEmailsViaResend(input: {
  recipients: EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
}): Promise<{ sent: number; failed: number; results: SendResultItem[] }> {
  const { resendApiKey, resendFrom } = getMessagingConfig();
  if (!resendApiKey) throw new Error("Missing RESEND_API_KEY");

  const recipients = dedupeEmailRecipients(input.recipients);
  const results: SendResultItem[] = [];
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const item = await sendOneEmailViaResend({
      recipient,
      subject: input.subject,
      html: input.html,
      text: input.text,
      resendApiKey,
      resendFrom,
    });
    results.push(item);
    if (item.ok) sent += 1;
    else failed += 1;
  }

  return { sent, failed, results };
}

export async function sendSmsViaMoolre(input: {
  recipients: SmsRecipient[];
  message: string;
}): Promise<{ sent: number; failed: number; results: SendResultItem[]; code?: string }> {
  const { vasKey, moolreSenderId, moolreApiUser, moolreApiKey } = getMessagingConfig();
  if (!vasKey) throw new Error("Missing VAS_KEY (X-API-VASKEY)");
  if (!moolreSenderId) throw new Error("Missing MOOLRE_SENDER_ID");

  const uniqueRecipients = dedupeSmsRecipients(input.recipients);
  const sendId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const messages = uniqueRecipients
    .map((r, index) => {
      const phone = normalizePhone(r.phone);
      if (!phone) return null;
      return {
        recipient: phone,
        message: input.message.slice(0, 480),
        ref: `ops-${sendId}-${index}`,
      };
    })
    .filter(Boolean) as Array<{ recipient: string; message: string; ref: string }>;

  if (!messages.length) {
    return {
      sent: 0,
      failed: uniqueRecipients.length,
      results: uniqueRecipients.map((r) => ({
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

  const code = parsed?.code;
  if (code === "ASMS07") {
    throw new Error("Sender ID is not approved in Moolre. Check the Seltra sender ID.");
  }
  if (code === "AIN01" || response.status === 401) {
    throw new Error("Moolre authentication failed — check VAS_KEY.");
  }

  const ok = response.ok && parsed?.status === 1;
  if (!ok) {
    const error = parsed?.message || bodyText || `Moolre ${response.status}`;
    return {
      sent: 0,
      failed: messages.length,
      results: messages.map((m) => ({ to: m.recipient, ok: false, error })),
      code,
    };
  }

  // Moolre returns null data on success — treat whole batch as sent
  return {
    sent: messages.length,
    failed: 0,
    results: messages.map((m) => ({ to: m.recipient, ok: true })),
    code,
  };
}
