import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  approveApplication,
  listApplicationsForWaitlist,
  rejectApplication,
} from "@/lib/api/applications.functions";
import { applicationsFromSupabase, applicationsResponseToResult } from "@/lib/api/applications-mappers";
import type { ApproveApplicationResponse } from "@/lib/api/applications.types";
import { PageHeader, Card, StatusBadge } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { shortDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPagination } from "@/components/list-pagination";
import { useClientPagination } from "@/hooks/use-client-pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_app/merchants/applications")({
  head: () => ({ meta: [{ title: "Applications & Onboarding — Seltra Ops" }] }),
  component: ApplicationsOnboardingPage,
});

const ONBOARDING_STEPS = [
  "Application received",
  "Review & approve",
  "Credentials sent",
];

type Application = {
  id: string;
  business_name: string | null;
  full_name: string;
  email: string | null;
  business_type: string | null;
  based_in: string | null;
  monthly_revenue: string | null;
  status: string;
  created_at: string;
  merchant_id: string | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function OnboardingStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      {ONBOARDING_STEPS.map((label, i) => {
        const step = i + 1;
        const done = step < currentStep;
        const active = step === currentStep;
        return (
          <div key={label} className="flex flex-1 items-start gap-2 min-w-0">
            <div
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold ${
                done
                  ? "border-primary bg-primary text-primary-foreground"
                  : active
                    ? "border-primary bg-background text-primary"
                    : "border-border bg-muted text-muted-foreground"
              }`}
            >
              {done ? <Check className="h-4 w-4" /> : step}
            </div>
            <div className="min-w-0 pt-0.5">
              <div className={`text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
                {label}
              </div>
            </div>
            {step < ONBOARDING_STEPS.length && (
              <div className="hidden md:block flex-1 h-px bg-border mt-4 mx-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function MerchantAvatar({ name }: { name: string }) {
  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-xs font-semibold text-primary">
      {initials(name)}
    </div>
  );
}

const WAITLIST_PAGE_SIZE = 10;

function isWaitlistVisible(status: string) {
  const s = status.toLowerCase();
  return s !== "rejected" && s !== "suspended";
}

type WaitlistRowView = {
  id: string;
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  businessType: string;
  status: string;
  appliedAt: string;
};

function normalizeWaitlistRow(app: Application | { id: string; businessName: string; ownerName: string; ownerEmail: string; businessType: string; status: string; appliedAt: string }): WaitlistRowView {
  if ("full_name" in app) {
    const a = app as Application;
    return {
      id: a.id,
      businessName: a.business_name || a.full_name,
      ownerName: a.full_name,
      ownerEmail: a.email ?? "—",
      businessType: a.business_type ?? "—",
      status: a.status,
      appliedAt: a.created_at,
    };
  }
  return {
    id: app.id,
    businessName: app.businessName,
    ownerName: app.ownerName,
    ownerEmail: app.ownerEmail,
    businessType: app.businessType,
    status: app.status || "pending",
    appliedAt: app.appliedAt,
  };
}

function WaitlistActions({
  status,
  approvePending,
  rejectPending,
  onApprove,
  onReject,
}: {
  status: string;
  appId: string;
  approvePending: boolean;
  rejectPending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const s = status.toLowerCase();
  const canApprove = s === "pending" || s === "applied" || s === "reviewed";
  const isOnboarded = s === "approved" || s === "onboarded";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isOnboarded ? (
        <span className="pointer-events-none inline-flex select-none items-center rounded-md bg-success-soft px-2 py-1 text-xs font-medium text-primary">
          Onboarded
        </span>
      ) : (
        <Button size="sm" variant="outline" disabled={approvePending || !canApprove} onClick={onApprove}>
          Approve
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        className="border-destructive/40 text-destructive hover:bg-destructive hover:text-white"
        disabled={rejectPending}
        onClick={onReject}
      >
        Reject
      </Button>
    </div>
  );
}

function ApplicationsOnboardingPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const opsActor = user?.email ?? "ops@seltra.co";

  const [appSearch, setAppSearch] = useState("");
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [approvalResult, setApprovalResult] = useState<ApproveApplicationResponse | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const waitlistSearch = appSearch.trim() || undefined;

  const { data: applicationsResult, isLoading: applicationsLoading, isError: applicationsApiFailed } = useQuery({
    queryKey: ["applications-waitlist", waitlistSearch],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    retry: false,
    queryFn: () =>
      listApplicationsForWaitlist({ data: { search: waitlistSearch } }).then(applicationsResponseToResult),
  });

  const { data: fallbackApplications = [], isLoading: fallbackApplicationsLoading } = useQuery({
    queryKey: ["merchant_applications"],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    enabled: applicationsApiFailed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_applications")
        .select("id, business_name, full_name, email, business_type, based_in, monthly_revenue, status, created_at, merchant_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Application[];
    },
  });

  const applicationRows = applicationsResult?.rows ?? applicationsFromSupabase(fallbackApplications, { search: appSearch }).rows;

  const waitlistAll = useMemo(() => {
    const priority = (status: string) => {
      const s = status.toLowerCase();
      if (s === "pending" || s === "applied" || s === "reviewed") return 0;
      if (s === "approved" || s === "onboarded") return 1;
      return 2;
    };
    const appliedTime = (row: (typeof applicationRows)[number]) => {
      const raw = "appliedAt" in row ? row.appliedAt : (row as Application).created_at;
      return new Date(raw).getTime() || 0;
    };

    return applicationRows
      .filter((a) => isWaitlistVisible(a.status))
      .slice()
      .sort((a, b) => {
        const byStatus = priority(a.status) - priority(b.status);
        if (byStatus !== 0) return byStatus;
        return appliedTime(b) - appliedTime(a);
      });
  }, [applicationRows]);

  const isLoading = applicationsLoading || (applicationsApiFailed && fallbackApplicationsLoading);

  const {
    page: waitlistPage,
    setPage: setWaitlistPage,
    pageItems: tableRows,
    totalPages: waitlistTotalPages,
    totalItems: waitlistTotalItems,
    pageSize: waitlistPageSize,
  } = useClientPagination(waitlistAll, {
    pageSize: WAITLIST_PAGE_SIZE,
    resetDeps: [appSearch, waitlistAll.length],
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["applications-waitlist"] });
    queryClient.invalidateQueries({ queryKey: ["applications"] });
    queryClient.invalidateQueries({ queryKey: ["merchant_applications"] });
    queryClient.invalidateQueries({ queryKey: ["merchants"] });
  };

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        return await approveApplication({ data: { id, opsActor } });
      } catch {
        const { error } = await supabase.from("merchant_applications").update({ status: "approved" }).eq("id", id);
        if (error) throw error;
        return null;
      }
    },
    onSuccess: (result) => {
      if (result) {
        setApprovalResult(result);
        toast.success(result.credentialsSent ? "Approved — credentials sent" : "Application approved");
        setOnboardingStep(3);
      } else {
        toast.success("Application approved");
        setOnboardingStep(2);
      }
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      try {
        return await rejectApplication({ data: { id, opsActor, reason } });
      } catch {
        const { error } = await supabase
          .from("merchant_applications")
          .update({ status: "rejected" })
          .eq("id", id);
        if (error) throw error;
        return null;
      }
    },
    onSuccess: () => {
      toast.success("Application rejected");
      setRejectOpen(false);
      setRejectTargetId(null);
      setRejectReason("");
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openRejectDialog(id: string) {
    setRejectTargetId(id);
    setRejectReason("");
    setRejectOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications & Onboarding"
        subtitle="Review applications and approve merchants"
      />

      <Card title="Onboarding progress">
        <OnboardingStepper currentStep={onboardingStep} />
      </Card>

      <Card title="Waitlist">
        <div className="mb-4">
          <Input
            placeholder="Search applications…"
            value={appSearch}
            onChange={(e) => setAppSearch(e.target.value)}
            className="w-full max-w-md border-input bg-surface-muted"
          />
        </div>
        {isLoading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : (
        <>
        {/* Mobile cards */}
        <div className="space-y-3 md:hidden">
          {tableRows.map((app) => {
            const row = normalizeWaitlistRow(app);
            return (
              <div key={row.id} className="rounded-lg border border-border bg-surface p-3.5">
                <div className="flex items-start gap-3">
                  <MerchantAvatar name={row.businessName} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{row.businessName}</span>
                      <StatusBadge status={row.status} />
                    </div>
                    <div className="mt-0.5 text-sm text-foreground/90">{row.ownerName}</div>
                    <div className="truncate text-xs text-muted-foreground">{row.ownerEmail}</div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{row.businessType}</span>
                      <span>Applied {shortDate(row.appliedAt)}</span>
                    </div>
                    <div className="mt-3">
                      <WaitlistActions
                        status={row.status}
                        appId={row.id}
                        approvePending={approveMutation.isPending}
                        rejectPending={rejectMutation.isPending}
                        onApprove={() => approveMutation.mutate(row.id)}
                        onReject={() => openRejectDialog(row.id)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {!tableRows.length && (
            <p className="py-8 text-center text-xs text-muted-foreground">No applications in the pipeline.</p>
          )}
        </div>

        {/* Desktop table */}
        <div className="-mx-4 hidden overflow-x-auto md:mx-0 md:block">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <th className="pb-2.5 pr-4 font-medium">Business name</th>
                <th className="pb-2.5 pr-4 font-medium">Owner</th>
                <th className="pb-2.5 pr-4 font-medium">Type</th>
                <th className="pb-2.5 pr-4 font-medium">Status</th>
                <th className="pb-2.5 pr-4 font-medium">Applied</th>
                <th className="pb-2.5 pr-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((app) => {
                const row = normalizeWaitlistRow(app);
                return (
                  <tr key={row.id} className="hover:bg-surface-muted/60">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <MerchantAvatar name={row.businessName} />
                        <span className="font-medium text-foreground">{row.businessName}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="text-foreground">{row.ownerName}</div>
                      <div className="text-xs text-muted-foreground">{row.ownerEmail}</div>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{row.businessType}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{shortDate(row.appliedAt)}</td>
                    <td className="py-3 pr-4">
                      <WaitlistActions
                        status={row.status}
                        appId={row.id}
                        approvePending={approveMutation.isPending}
                        rejectPending={rejectMutation.isPending}
                        onApprove={() => approveMutation.mutate(row.id)}
                        onReject={() => openRejectDialog(row.id)}
                      />
                    </td>
                  </tr>
                );
              })}
              {!tableRows.length && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                    No applications in the pipeline.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
          <ListPagination
            page={waitlistPage}
            totalPages={waitlistTotalPages}
            totalItems={waitlistTotalItems}
            pageSize={waitlistPageSize}
            onPageChange={setWaitlistPage}
            itemLabel="applications"
            className="mt-4 border-t-0 px-0 pt-3"
          />
        </>
        )}
      </Card>

      {approvalResult && (
        <Card title="Approval result">
          <div className="grid gap-4 text-sm max-w-xl">
            <div>
              <div className="text-xs text-muted-foreground">Merchant ID</div>
              <div className="font-mono text-navy">{approvalResult.merchantId}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Email</div>
              <div className="text-navy">{approvalResult.email}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Credentials</div>
              <div className="text-navy">
                {approvalResult.credentialsSent ? "Sent to merchant email" : "Not sent — follow up manually"}
              </div>
            </div>
          </div>
        </Card>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject application</DialogTitle>
            <DialogDescription>Provide a reason for the rejection. This is stored in the audit log.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Label htmlFor="rejectReason">Reason</Label>
            <Textarea
              id="rejectReason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Business information could not be verified."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || !rejectTargetId || rejectMutation.isPending}
              onClick={() => rejectTargetId && rejectMutation.mutate({ id: rejectTargetId, reason: rejectReason.trim() })}
            >
              {rejectMutation.isPending ? "Rejecting…" : "Reject application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
