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

  const results: SendResultItem[] = [];
  let sent = 0;
  let failed = 0;

  const chunkSize = 50;
  for (let i = 0; i < input.recipients.length; i += chunkSize) {
    const chunk = input.recipients.slice(i, i + chunkSize);

    // Prefer batch; fall back to individual sends so one bad address doesn't kill the blast
    const payload = chunk.map((r) => ({
      from: resendFrom,
      to: [r.email],
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
    }));

    try {
      const response = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Fall back to per-recipient sends
        for (const r of chunk) {
          try {
            const single = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: resendFrom,
                to: [r.email],
                subject: input.subject,
                html: input.html,
                ...(input.text ? { text: input.text } : {}),
              }),
            });
            if (!single.ok) {
              const errBody = await single.text().catch(() => "");
              failed += 1;
              results.push({ to: r.email, ok: false, error: errBody || `Resend ${single.status}` });
            } else {
              sent += 1;
              results.push({ to: r.email, ok: true });
            }
          } catch (err) {
            failed += 1;
            results.push({ to: r.email, ok: false, error: err instanceof Error ? err.message : "Send failed" });
          }
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
    } catch (err) {
      for (const r of chunk) {
        failed += 1;
        results.push({
          to: r.email,
          ok: false,
          error: err instanceof Error ? err.message : "Batch send failed",
        });
      }
    }
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

  const messages = input.recipients
    .map((r) => {
      const phone = normalizePhone(r.phone);
      if (!phone) return null;
      return {
        recipient: phone,
        message: input.message.slice(0, 480),
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
