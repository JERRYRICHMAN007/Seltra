import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  approveApplication,
  listApplications,
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

  const { data: applicationsResult, isLoading: applicationsLoading, isError: applicationsApiFailed } = useQuery({
    queryKey: ["applications", appSearch],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    retry: false,
    queryFn: () =>
      listApplications({ data: { search: appSearch.trim() || undefined } }).then(applicationsResponseToResult),
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

  const waitlist = useMemo(() => {
    const isVisible = (status: string) => {
      const s = status.toLowerCase();
      return s !== "rejected" && s !== "suspended";
    };

    if (applicationsApiFailed) {
      return fallbackApplications.filter((a) => isVisible(a.status));
    }
    return applicationRows.filter((a) => isVisible(a.status));
  }, [applicationsApiFailed, fallbackApplications, applicationRows]);

  const isLoading = applicationsLoading || (applicationsApiFailed && fallbackApplicationsLoading);

  const invalidateAll = () => {
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Applications & Onboarding"
          subtitle="Review applications and approve merchants"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
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
            className="max-w-sm bg-surface-muted border-input"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">Business name</th>
                <th className="py-2 pr-4">Owner</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Applied</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {waitlist.map((app) => {
                const isFallbackApp = "full_name" in app;
                const businessName = isFallbackApp
                  ? (app as Application).business_name || (app as Application).full_name
                  : app.businessName;
                const ownerName = isFallbackApp ? (app as Application).full_name : app.ownerName;
                const ownerEmail = isFallbackApp ? (app as Application).email ?? "—" : app.ownerEmail;
                const businessType = isFallbackApp ? (app as Application).business_type ?? "—" : app.businessType;
                const appliedAt = isFallbackApp ? (app as Application).created_at : app.appliedAt;
                const status = (isFallbackApp ? (app as Application).status : app.status || "pending").toLowerCase();
                const appId = app.id;

                return (
                  <tr key={appId} className="border-b border-border hover:bg-surface-muted/50">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <MerchantAvatar name={businessName} />
                        <span className="font-medium text-navy">{businessName}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div>{ownerName}</div>
                      <div className="text-xs text-muted-foreground">{ownerEmail}</div>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{businessType}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={isFallbackApp ? (app as Application).status : app.status} />
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{shortDate(appliedAt)}</td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {status === "pending" || status === "applied" || status === "reviewed" ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={approveMutation.isPending}
                              onClick={() => approveMutation.mutate(appId)}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive border-destructive hover:bg-destructive hover:text-white"
                              disabled={rejectMutation.isPending}
                              onClick={() => openRejectDialog(appId)}
                            >
                              Reject
                            </Button>
                          </>
                        ) : status === "approved" || status === "onboarded" ? (
                          <>
                            <span className="inline-flex items-center rounded-md bg-success-soft px-2 py-1 text-xs font-medium text-primary pointer-events-none select-none">
                              Onboarded
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive border-destructive hover:bg-destructive hover:text-white"
                              disabled={rejectMutation.isPending}
                              onClick={() => openRejectDialog(appId)}
                            >
                              Reject
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={approveMutation.isPending}
                              onClick={() => approveMutation.mutate(appId)}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive border-destructive hover:bg-destructive hover:text-white"
                              disabled={rejectMutation.isPending}
                              onClick={() => openRejectDialog(appId)}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!waitlist.length && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                    No applications in the pipeline.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
