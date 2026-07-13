import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Mail, MessageSquare, Search, Send } from "lucide-react";
import { toast } from "sonner";
import {
  listMessagingAudience,
  previewMessagingRecipients,
  sendOpsEmail,
  sendOpsSms,
  type MessagingAudienceItem,
  type SendMessagingResult,
} from "@/lib/api/communication.functions";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/merchants/communication")({
  head: () => ({ meta: [{ title: "Messaging — Seltra Ops" }] }),
  component: MessagingPage,
});

type Scope = "all" | "selected";

function MessagingPage() {
  const [emailOpen, setEmailOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [lastResult, setLastResult] = useState<{ channel: "email" | "sms"; result: SendMessagingResult } | null>(
    null,
  );

  const {
    data: audience = [],
    isLoading: audienceLoading,
    isError: audienceFailed,
    error: audienceError,
    refetch: refetchAudience,
  } = useQuery({
    queryKey: ["messaging-audience"],
    staleTime: 1000 * 60 * 2,
    retry: 1,
    queryFn: () => listMessagingAudience(),
  });

  const emailEligible = useMemo(() => audience.filter((a) => Boolean(a.email)), [audience]);
  const smsEligible = useMemo(() => audience.filter((a) => a.smsEligible), [audience]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messaging"
        subtitle="Contacts from Seltra merchant applications · email via Resend · SMS via Moolre"
      />

      {audienceFailed && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <div className="font-medium text-navy">Could not load recipients</div>
          <p className="mt-1 text-muted-foreground">
            {audienceError instanceof Error ? audienceError.message : "Audience request failed"}
          </p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => void refetchAudience()}>
            Retry
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setEmailOpen(true)}
          className="group text-left rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:border-primary/40 hover:shadow-md"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-navy">Send Email</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Resend · branded Seltra template · applications with email on file
          </p>
          <p className="mt-4 text-xs font-mono text-muted-foreground">
            {audienceLoading ? "Loading contacts…" : `${emailEligible.length} email-ready contacts`}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setSmsOpen(true)}
          className="group text-left rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:border-primary/40 hover:shadow-md"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <MessageSquare className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-navy">Send SMS</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Moolre · applications with a phone number only
          </p>
          <p className="mt-4 text-xs font-mono text-muted-foreground">
            {audienceLoading ? "Loading contacts…" : `${smsEligible.length} SMS-ready applicants`}
          </p>
        </button>
      </div>

      {lastResult && (
        <div className="rounded-2xl border border-primary/20 bg-primary-soft/30 px-5 py-4 text-sm">
          <div className="font-medium text-navy">
            Last {lastResult.channel === "email" ? "email" : "SMS"} broadcast
          </div>
          <div className="mt-1 text-muted-foreground">
            {lastResult.result.sent} sent · {lastResult.result.failed} failed ·{" "}
            {lastResult.result.recipientCount} resolved
          </div>
        </div>
      )}

      <EmailModal
        open={emailOpen}
        onOpenChange={setEmailOpen}
        audience={audience}
        audienceLoading={audienceLoading}
        onSent={(result) => {
          setLastResult({ channel: "email", result });
          setEmailOpen(false);
        }}
      />

      <SmsModal
        open={smsOpen}
        onOpenChange={setSmsOpen}
        audience={audience}
        audienceLoading={audienceLoading}
        onSent={(result) => {
          setLastResult({ channel: "sms", result });
          setSmsOpen(false);
        }}
      />
    </div>
  );
}

function EmailModal({
  open,
  onOpenChange,
  audience,
  audienceLoading,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audience: MessagingAudienceItem[];
  audienceLoading: boolean;
  onSent: (result: SendMessagingResult) => void;
}) {
  const [scope, setScope] = useState<Scope>("selected");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  const emailPool = useMemo(() => audience.filter((a) => Boolean(a.email)), [audience]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return emailPool;
    return emailPool.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.ownerName.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q),
    );
  }, [emailPool, search]);

  useEffect(() => {
    if (!open) {
      setScope("selected");
      setSearch("");
      setSelectedIds(new Set());
      setTitle("");
      setBody("");
      setConfirmOpen(false);
      setPreviewCount(null);
    }
  }, [open]);

  const previewMutation = useMutation({
    mutationFn: () =>
      previewMessagingRecipients({
        data: {
          channel: "email",
          scope,
          recipientIds: scope === "selected" ? Array.from(selectedIds) : [],
          sourceType: "application",
        },
      }),
    onSuccess: (data) => {
      setPreviewCount(data.count);
      setConfirmOpen(true);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      sendOpsEmail({
        data: {
          scope,
          recipientIds: scope === "selected" ? Array.from(selectedIds) : [],
          sourceType: "application",
          title: title.trim(),
          body: body.trim(),
        },
      }),
    onSuccess: (result) => {
      toast.success(`Email sent to ${result.sent} of ${result.recipientCount}`);
      setConfirmOpen(false);
      onSent(result);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function requestSend() {
    if (!title.trim()) return toast.error("Title is required");
    if (!body.trim()) return toast.error("Body is required");
    if (scope === "selected" && selectedIds.size === 0) {
      return toast.error("Select at least one recipient, or choose All");
    }
    previewMutation.mutate();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Email</DialogTitle>
            <DialogDescription>
              Recipients are resolved on the server from Seltra{" "}
              <span className="font-mono text-[11px]">/internal/ops/merchants/messaging</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <RecipientScope
              scope={scope}
              onScopeChange={setScope}
              search={search}
              onSearchChange={setSearch}
              items={filtered}
              loading={audienceLoading}
              selectedIds={selectedIds}
              onToggle={(id, checked) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (checked) next.add(id);
                  else next.delete(id);
                  return next;
                });
              }}
              onSelectAll={() => setSelectedIds(new Set(filtered.map((i) => i.id)))}
              mode="email"
            />

            <div>
              <Label htmlFor="email-title">Title</Label>
              <Input
                id="email-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Email subject"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="email-body">Body</Label>
              <Textarea
                id="email-body"
                rows={7}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message…"
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-muted-foreground">Line breaks are preserved in the branded email.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="gap-2" disabled={previewMutation.isPending} onClick={requestSend}>
              <Send className="h-4 w-4" />
              {previewMutation.isPending ? "Checking…" : "Review & send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmSendDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        count={previewCount ?? 0}
        channel="email"
        pending={sendMutation.isPending}
        onConfirm={() => sendMutation.mutate()}
      />
    </>
  );
}

function SmsModal({
  open,
  onOpenChange,
  audience,
  audienceLoading,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audience: MessagingAudienceItem[];
  audienceLoading: boolean;
  onSent: (result: SendMessagingResult) => void;
}) {
  const [scope, setScope] = useState<Scope>("selected");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [body, setBody] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  const smsPool = audience;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return smsPool;
    return smsPool.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.ownerName.toLowerCase().includes(q) ||
        a.phone?.includes(q),
    );
  }, [smsPool, search]);

  useEffect(() => {
    if (!open) {
      setScope("selected");
      setSearch("");
      setSelectedIds(new Set());
      setBody("");
      setConfirmOpen(false);
      setPreviewCount(null);
    }
  }, [open]);

  const previewMutation = useMutation({
    mutationFn: () =>
      previewMessagingRecipients({
        data: {
          channel: "sms",
          scope,
          recipientIds: scope === "selected" ? Array.from(selectedIds) : [],
        },
      }),
    onSuccess: (data) => {
      setPreviewCount(data.count);
      setConfirmOpen(true);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      sendOpsSms({
        data: {
          scope,
          recipientIds: scope === "selected" ? Array.from(selectedIds) : [],
          body: body.trim(),
        },
      }),
    onSuccess: (result) => {
      toast.success(`SMS sent to ${result.sent} of ${result.recipientCount}`);
      setConfirmOpen(false);
      onSent(result);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function requestSend() {
    if (!body.trim()) return toast.error("Message body is required");
    if (scope === "selected" && selectedIds.size === 0) {
      return toast.error("Select at least one recipient, or choose All applicants");
    }
    previewMutation.mutate();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send SMS</DialogTitle>
            <DialogDescription>
              Applications with phone numbers only. Contacts without a phone are shown greyed out.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <RecipientScope
              scope={scope}
              onScopeChange={setScope}
              search={search}
              onSearchChange={setSearch}
              items={filtered}
              loading={audienceLoading}
              selectedIds={selectedIds}
              onToggle={(id, checked) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (checked) next.add(id);
                  else next.delete(id);
                  return next;
                });
              }}
              onSelectAll={() =>
                setSelectedIds(new Set(filtered.filter((i) => i.smsEligible).map((i) => i.id)))
              }
              mode="sms"
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="sms-body">Message</Label>
                <span
                  className={`text-[11px] font-mono ${
                    body.length > 160 ? "text-warning" : "text-muted-foreground"
                  }`}
                >
                  {body.length}/160 {body.length > 160 ? "(multi-segment)" : "segment"}
                </span>
              </div>
              <Textarea
                id="sms-body"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="SMS body…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="gap-2" disabled={previewMutation.isPending} onClick={requestSend}>
              <Send className="h-4 w-4" />
              {previewMutation.isPending ? "Checking…" : "Review & send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmSendDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        count={previewCount ?? 0}
        channel="sms"
        pending={sendMutation.isPending}
        onConfirm={() => sendMutation.mutate()}
      />
    </>
  );
}

function RecipientScope({
  scope,
  onScopeChange,
  search,
  onSearchChange,
  items,
  loading,
  selectedIds,
  onToggle,
  onSelectAll,
  mode,
}: {
  scope: Scope;
  onScopeChange: (scope: Scope) => void;
  search: string;
  onSearchChange: (value: string) => void;
  items: MessagingAudienceItem[];
  loading?: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  onSelectAll: () => void;
  mode: "email" | "sms";
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onScopeChange("all")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            scope === "all" ? "bg-primary text-primary-foreground" : "bg-surface-muted text-muted-foreground"
          }`}
        >
          {mode === "sms" ? "All applicants" : "All contacts"}
        </button>
        <button
          type="button"
          onClick={() => onScopeChange("selected")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            scope === "selected" ? "bg-primary text-primary-foreground" : "bg-surface-muted text-muted-foreground"
          }`}
        >
          Select specific
        </button>
      </div>

      {scope === "selected" && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search…"
              className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0 px-0"
            />
            <Button size="sm" variant="ghost" onClick={onSelectAll} disabled={loading}>
              All shown
            </Button>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-border">
            {loading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <>
                {items.map((item) => {
                  const disabled = mode === "sms" && !item.smsEligible;
                  return (
                    <label
                      key={item.id}
                      className={`flex items-start gap-3 px-3 py-2.5 text-sm ${
                        disabled ? "opacity-45 cursor-not-allowed" : "cursor-pointer hover:bg-surface-muted/60"
                      }`}
                    >
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        disabled={disabled}
                        onCheckedChange={(v) => !disabled && onToggle(item.id, v === true)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-navy truncate">{item.label}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {item.ownerName}
                          {mode === "email" && item.email ? ` · ${item.email}` : ""}
                          {mode === "sms" && (item.smsEligible ? ` · ${item.phone}` : " · no phone on file")}
                        </div>
                      </div>
                    </label>
                  );
                })}
                {!items.length && (
                  <div className="py-8 text-center text-xs text-muted-foreground">No matches</div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfirmSendDialog({
  open,
  onOpenChange,
  count,
  channel,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  channel: "email" | "sms";
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirm send</DialogTitle>
          <DialogDescription>
            {channel === "email"
              ? `Send this email to ${count} contact${count === 1 ? "" : "s"}?`
              : `Send this SMS to ${count} applicant${count === 1 ? "" : "s"}?`}
          </DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          This cannot be undone. Recipient contacts are resolved fresh on the server right before send.
        </p>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button className="gap-2" disabled={pending || count === 0} onClick={onConfirm}>
            <Send className="h-4 w-4" />
            {pending ? "Sending…" : `Send to ${count}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
