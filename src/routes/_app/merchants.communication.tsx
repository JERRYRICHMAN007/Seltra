import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, Mail, MessageSquare, Search, Send, Users, X } from "lucide-react";
import { toast } from "sonner";
import {
  listCommunicationRecipients,
  sendMerchantCommunication,
  type CommunicationRecipient,
  type SendCommunicationResult,
} from "@/lib/api/communication.functions";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/merchants/communication")({
  head: () => ({ meta: [{ title: "Communication — Seltra Ops" }] }),
  component: MerchantCommunicationPage,
});

type Channel = "email" | "sms" | "both";
type Audience = "merchants" | "applications" | "all";

const TEMPLATES = [
  {
    id: "welcome",
    label: "Welcome",
    subject: "Welcome to Seltra",
    message:
      "Hi {{name}},\n\nWelcome to Seltra. Your store is live and our ops team is here if you need anything.\n\n— Seltra Ops",
  },
  {
    id: "update",
    label: "Product update",
    subject: "New update from Seltra",
    message:
      "Hi {{name}},\n\nWe shipped an update that may help your store. Reply to this message if you want a walkthrough.\n\n— Seltra Ops",
  },
  {
    id: "nudge",
    label: "Check-in",
    subject: "Quick check-in from Seltra",
    message:
      "Hi {{name}},\n\nJust checking in — how are things going with your store this week?\n\n— Seltra Ops",
  },
];

function MerchantCommunicationPage() {
  const [channel, setChannel] = useState<Channel>("email");
  const [audience, setAudience] = useState<Audience>("merchants");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [extraEmails, setExtraEmails] = useState("");
  const [extraPhones, setExtraPhones] = useState("");
  const [lastResult, setLastResult] = useState<SendCommunicationResult | null>(null);

  const { data: recipients = [], isLoading } = useQuery({
    queryKey: ["communication-recipients"],
    staleTime: 1000 * 60 * 2,
    queryFn: () => listCommunicationRecipients(),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipients.filter((r) => {
      if (audience === "merchants" && r.source !== "merchant") return false;
      if (audience === "applications" && r.source !== "application") return false;
      if (!q) return true;
      return (
        r.storeName.toLowerCase().includes(q) ||
        r.ownerName.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.phone?.includes(q)
      );
    });
  }, [recipients, audience, search]);

  const selectedRecipients = useMemo(
    () => recipients.filter((r) => selectedIds.has(r.id)),
    [recipients, selectedIds],
  );

  const emailReadyCount = selectedRecipients.filter((r) => Boolean(r.email)).length;
  const smsReadyCount = selectedRecipients.filter((r) => Boolean(r.phone)).length;

  const parsedExtraEmails = useMemo(
    () =>
      extraEmails
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter((s) => s.includes("@")),
    [extraEmails],
  );

  const parsedExtraPhones = useMemo(
    () =>
      extraPhones
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    [extraPhones],
  );

  const outboundCount =
    channel === "sms"
      ? smsReadyCount + parsedExtraPhones.length
      : channel === "email"
        ? emailReadyCount + parsedExtraEmails.length
        : emailReadyCount + parsedExtraEmails.length + smsReadyCount + parsedExtraPhones.length;

  const previewName = selectedRecipients[0]?.ownerName ?? "Ama";
  const previewBody = message.replaceAll("{{name}}", previewName) || "Your message preview will appear here…";
  const smsChars = message.replaceAll("{{name}}", previewName).length;

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRecipients.length && !parsedExtraEmails.length && !parsedExtraPhones.length) {
        throw new Error("Select at least one recipient");
      }
      if (!message.trim()) throw new Error("Message is required");

      const channels =
        channel === "both" ? (["email", "sms"] as const) : ([channel] as Array<"email" | "sms">);

      if (channels.includes("email") && !subject.trim()) {
        throw new Error("Email subject is required");
      }

      return sendMerchantCommunication({
        data: {
          channels: [...channels],
          subject: subject.trim() || undefined,
          message: message.trim(),
          recipients: selectedRecipients,
          extraEmails: parsedExtraEmails,
          extraPhones: parsedExtraPhones,
        },
      });
    },
    onSuccess: (result) => {
      setLastResult(result);
      const emailSent = result.email?.sent ?? 0;
      const smsSent = result.sms?.sent ?? 0;
      const emailFailed = result.email?.failed ?? 0;
      const smsFailed = result.sms?.failed ?? 0;
      toast.success(
        `Sent — email ${emailSent}/${emailSent + emailFailed}, SMS ${smsSent}/${smsSent + smsFailed}`,
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filtered.forEach((r) => next.add(r.id));
      return next;
    });
  }

  function applyTemplate(id: string) {
    const template = TEMPLATES.find((t) => t.id === id);
    if (!template) return;
    setSubject(template.subject);
    setMessage(template.message);
    if (channel === "sms") setChannel("email");
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Communication" subtitle="Broadcast email and SMS to merchants" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communication"
        subtitle="Broadcast to merchants and applicants via Resend email and Moolre SMS"
        action={
          <Button
            className="gap-2"
            disabled={sendMutation.isPending || outboundCount === 0}
            onClick={() => sendMutation.mutate()}
          >
            <Send className="h-4 w-4" />
            {sendMutation.isPending ? "Sending…" : `Send to ${outboundCount || 0}`}
          </Button>
        }
      />

      {/* Channel + reach strip — messaging console, not analytics cards */}
      <div
        className="rounded-2xl border border-border overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0b1f1a 0%, #12352c 55%, #0d2430 100%)",
        }}
      >
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-white/50">Broadcast channel</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  { id: "email" as const, label: "Email", icon: Mail, hint: "Resend" },
                  { id: "sms" as const, label: "SMS", icon: MessageSquare, hint: "Moolre" },
                  { id: "both" as const, label: "Both", icon: Send, hint: "Email + SMS" },
                ] as const
              ).map((opt) => {
                const active = channel === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setChannel(opt.id)}
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm transition-all ${
                      active
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "bg-white/5 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{opt.label}</span>
                    <span className={`text-[10px] ${active ? "text-primary-foreground/80" : "text-white/40"}`}>
                      {opt.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-6 text-right">
            <div>
              <div className="text-2xl font-semibold text-white font-mono">{selectedIds.size}</div>
              <div className="text-xs text-white/45">Selected</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-white font-mono">{emailReadyCount}</div>
              <div className="text-xs text-white/45">Email ready</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-white font-mono">{smsReadyCount}</div>
              <div className="text-xs text-white/45">SMS ready</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Compose — primary surface */}
        <section className="xl:col-span-7 rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Compose</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Write once, personalize with {"{{name}}"}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t.id)}
                  className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5 space-y-4">
            {(channel === "email" || channel === "both") && (
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Update from Seltra Ops"
                  className="mt-1.5 bg-surface-muted border-input"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="message">Message</Label>
                {channel !== "email" && (
                  <span className={`text-[11px] font-mono ${smsChars > 160 ? "text-warning" : "text-muted-foreground"}`}>
                    {smsChars}/160 SMS units
                  </span>
                )}
              </div>
              <Textarea
                id="message"
                rows={10}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={"Hi {{name}},\n\nWe have an update for your Seltra store…"}
                className="bg-surface-muted border-input font-normal leading-relaxed"
              />
            </div>

            {(channel === "email" || channel === "both") && (
              <div>
                <Label htmlFor="extraEmails">Extra emails</Label>
                <Input
                  id="extraEmails"
                  value={extraEmails}
                  onChange={(e) => setExtraEmails(e.target.value)}
                  placeholder="optional@email.com, another@email.com"
                  className="mt-1.5 bg-surface-muted border-input"
                />
              </div>
            )}

            {(channel === "sms" || channel === "both") && (
              <div>
                <Label htmlFor="extraPhones">Extra phones</Label>
                <Input
                  id="extraPhones"
                  value={extraPhones}
                  onChange={(e) => setExtraPhones(e.target.value)}
                  placeholder="024… or 233…"
                  className="mt-1.5 bg-surface-muted border-input"
                />
              </div>
            )}

            {/* Live preview */}
            <div className="rounded-xl border border-dashed border-border bg-surface-muted/40 p-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
                Preview · {channel === "sms" ? "SMS" : channel === "both" ? "Email + SMS" : "Email"}
              </div>
              {(channel === "email" || channel === "both") && (
                <div className="text-xs text-muted-foreground mb-1">
                  Subject: <span className="text-navy">{subject || "—"}</span>
                </div>
              )}
              <div className="text-sm text-navy whitespace-pre-wrap leading-relaxed">{previewBody}</div>
            </div>

            {lastResult && (
              <div className="rounded-xl border border-primary/20 bg-primary-soft/40 p-4 text-xs space-y-2">
                <div className="font-medium text-navy flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  Last broadcast
                </div>
                {lastResult.email && (
                  <div className="text-muted-foreground">
                    Email · {lastResult.email.sent} sent · {lastResult.email.failed} failed
                  </div>
                )}
                {lastResult.sms && (
                  <div className="text-muted-foreground">
                    SMS · {lastResult.sms.sent} sent · {lastResult.sms.failed} failed
                  </div>
                )}
                <div className="max-h-28 overflow-y-auto space-y-1 pt-1 border-t border-border/60">
                  {[...(lastResult.email?.results ?? []), ...(lastResult.sms?.results ?? [])].map((r, i) => (
                    <div key={`${r.to}-${i}`} className={r.ok ? "text-muted-foreground" : "text-destructive"}>
                      {r.to} — {r.ok ? "delivered" : r.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Audience picker */}
        <section className="xl:col-span-5 rounded-2xl border border-border bg-card shadow-card overflow-hidden flex flex-col max-h-[42rem]">
          <div className="border-b border-border px-5 py-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Audience
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedIds.size} selected of {filtered.length} shown
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={selectAllFiltered}>
                  All
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
              </div>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search audience…"
                className="pl-9 bg-surface-muted border-input"
              />
            </div>

            <div className="flex gap-1.5">
              {(
                [
                  { id: "merchants" as const, label: "Merchants" },
                  { id: "applications" as const, label: "Applicants" },
                  { id: "all" as const, label: "All" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAudience(opt.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                    audience === opt.id
                      ? "bg-primary-soft text-primary font-medium"
                      : "text-muted-foreground hover:bg-surface-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {selectedRecipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                {selectedRecipients.slice(0, 12).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleOne(r.id, false)}
                    className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] text-primary"
                  >
                    {r.storeName}
                    <X className="h-3 w-3" />
                  </button>
                ))}
                {selectedRecipients.length > 12 && (
                  <span className="text-[11px] text-muted-foreground self-center">
                    +{selectedRecipients.length - 12} more
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {filtered.map((r) => {
              const checked = selectedIds.has(r.id);
              const canEmail = Boolean(r.email);
              const canSms = Boolean(r.phone);
              return (
                <label
                  key={r.id}
                  className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-muted/60 ${
                    checked ? "bg-primary-soft/30" : ""
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => toggleOne(r.id, v === true)}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-navy">{r.storeName}</span>
                      <span className="shrink-0 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {r.source === "merchant" ? "store" : "applicant"}
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground mt-0.5">{r.ownerName}</div>
                    <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                      <span className={canEmail ? "text-primary" : "text-warning"}>
                        {canEmail ? r.email : "no email"}
                      </span>
                      <span className="text-border">·</span>
                      <span className={canSms ? "text-primary" : "text-warning"}>
                        {canSms ? r.phone : "no phone"}
                      </span>
                    </div>
                  </div>
                </label>
              );
            })}
            {!filtered.length && (
              <div className="py-12 text-center text-xs text-muted-foreground">No matches for this audience</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
