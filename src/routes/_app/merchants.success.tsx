import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card, MetricCard } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { formatCompact, shortDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPagination } from "@/components/list-pagination";
import { useClientPagination } from "@/hooks/use-client-pagination";

export const Route = createFileRoute("/_app/merchants/success")({
  head: () => ({ meta: [{ title: "Merchant Success — Seltra Ops" }] }),
  component: MerchantSuccessPage,
});

type ApplicationRow = {
  id: string;
  status: string;
  created_at: string;
  merchant_id: string | null;
  email: string | null;
  business_name: string | null;
  store_name: string | null;
  business_type: string | null;
  full_name: string;
};

type MerchantRow = {
  id: string;
  name: string;
  owner_email: string | null;
  business_type: string | null;
  onboarded_at: string | null;
  orders: { id: string }[] | null;
};

const MS_PER_DAY = 86400000;

function daysBetween(start: string, end: string) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / MS_PER_DAY));
}

function MerchantSuccessPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["merchant-success"],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    queryFn: async () => {
      const [applicationsResult, merchantsResult] = await Promise.all([
        supabase
          .from("merchant_applications")
          .select("id, status, created_at, merchant_id, email, business_name, store_name, business_type, full_name"),
        supabase.from("merchants").select("id, name, owner_email, business_type, onboarded_at, orders(id)"),
      ]);

      return {
        applications: (applicationsResult.data ?? []) as ApplicationRow[],
        merchants: (merchantsResult.data ?? []) as MerchantRow[],
      };
    },
  });

  const applications = data?.applications ?? [];
  const merchants = data?.merchants ?? [];

  const merchantsById = useMemo(() => new Map(merchants.map((m) => [m.id, m])), [merchants]);

  const onboardingPipeline = useMemo(
    () => applications.filter((a) => a.status === "approved" || a.status === "applied").length,
    [applications],
  );

  const successfullyOnboarded = useMemo(
    () => merchants.filter((m) => m.onboarded_at != null).length,
    [merchants],
  );

  const avgTimeToOnboard = useMemo(() => {
    const durations = applications
      .filter((a) => a.merchant_id)
      .map((a) => {
        const merchant = merchantsById.get(a.merchant_id!);
        if (!merchant?.onboarded_at) return null;
        return daysBetween(a.created_at, merchant.onboarded_at);
      })
      .filter((d): d is number => d != null);

    if (!durations.length) return null;
    const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    return Math.round(avg);
  }, [applications, merchantsById]);

  const stageBreakdown = useMemo(() => {
    const applied = applications.filter((a) => a.status === "applied").length;
    const approved = applications.filter((a) => a.status === "approved").length;
    const onboarded = applications.filter((a) => a.status === "onboarded").length;
    const max = Math.max(applied, approved, onboarded, 1);
    return [
      { label: "Applied", count: applied, pct: (applied / max) * 100 },
      { label: "Approved", count: approved, pct: (approved / max) * 100 },
      { label: "Onboarded", count: onboarded, pct: (onboarded / max) * 100 },
    ];
  }, [applications]);

  const recentOnboarded = useMemo(
    () =>
      merchants
        .filter((m) => m.onboarded_at)
        .sort((a, b) => new Date(b.onboarded_at!).getTime() - new Date(a.onboarded_at!).getTime()),
    [merchants],
  );

  const needsAttention = useMemo(() => {
    const cutoff = Date.now() - 7 * MS_PER_DAY;
    return merchants
      .filter((m) => {
        if (!m.onboarded_at) return false;
        if (new Date(m.onboarded_at).getTime() > cutoff) return false;
        return !(m.orders?.length ?? 0);
      })
      .map((m) => ({
        ...m,
        daysSinceOnboarded: daysBetween(m.onboarded_at!, new Date().toISOString()),
      }))
      .sort((a, b) => b.daysSinceOnboarded - a.daysSinceOnboarded);
  }, [merchants]);

  const onboardedPagination = useClientPagination(recentOnboarded, { pageSize: 5 });
  const attentionPagination = useClientPagination(needsAttention, { pageSize: 5 });

  return (
    <div className="space-y-6">
      <PageHeader title="Merchant Success" subtitle="Onboarding health and platform success overview" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : (
          <>
            <MetricCard
              label="Onboarding pipeline"
              value={formatCompact(onboardingPipeline)}
              delta="approved or applied"
            />
            <MetricCard
              label="Successfully onboarded"
              value={formatCompact(successfullyOnboarded)}
              delta="live merchants"
            />
            <MetricCard
              label="Avg time to onboard"
              value={avgTimeToOnboard != null ? `${avgTimeToOnboard} days` : "—"}
              delta={avgTimeToOnboard != null ? "application to go-live" : "no completed onboardings yet"}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Onboarding stage breakdown">
          <div className="space-y-5">
            {stageBreakdown.map((stage) => (
              <div key={stage.label}>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium text-foreground">{stage.label}</span>
                  <span className="font-mono text-muted-foreground">{formatCompact(stage.count)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${stage.pct}%` }}
                  />
                </div>
              </div>
            ))}
            {!applications.length && (
              <p className="text-xs text-muted-foreground">No applications in the pipeline yet.</p>
            )}
          </div>
        </Card>

        <Card title="Recent onboarding activity">
          <div className="space-y-4">
            {onboardedPagination.pageItems.map((merchant) => (
              <div key={merchant.id} className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <div className="font-medium text-navy truncate">{merchant.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{merchant.owner_email ?? "—"}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 capitalize">{merchant.business_type ?? "—"}</div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {shortDate(merchant.onboarded_at)}
                </div>
              </div>
            ))}
            {!recentOnboarded.length && (
              <p className="text-xs text-muted-foreground">No merchants onboarded yet.</p>
            )}
          </div>
          {recentOnboarded.length > 0 && (
            <ListPagination
              page={onboardedPagination.page}
              totalPages={onboardedPagination.totalPages}
              totalItems={onboardedPagination.totalItems}
              pageSize={onboardedPagination.pageSize}
              onPageChange={onboardedPagination.setPage}
              itemLabel="merchants"
              compact
              className="pt-3 mt-2"
            />
          )}
        </Card>
      </div>

      <Card title="Needs attention">
        <div className="space-y-4">
          {attentionPagination.pageItems.map((merchant) => (
            <div
              key={merchant.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4 last:border-0 last:pb-0"
            >
              <div className="min-w-0">
                <div className="font-medium text-navy truncate">{merchant.name}</div>
                <div className="text-xs text-muted-foreground truncate">{merchant.owner_email ?? "—"}</div>
                <div className="text-xs text-warning mt-1">
                  {merchant.daysSinceOnboarded} days since onboarded · zero orders
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => toast.info("Email feature coming soon")}
              >
                Email
              </Button>
            </div>
          ))}
          {!needsAttention.length && (
            <p className="text-xs text-muted-foreground">
              No onboarded merchants are inactive without orders beyond 7 days.
            </p>
          )}
        </div>
        {needsAttention.length > 0 && (
          <ListPagination
            page={attentionPagination.page}
            totalPages={attentionPagination.totalPages}
            totalItems={attentionPagination.totalItems}
            pageSize={attentionPagination.pageSize}
            onPageChange={attentionPagination.setPage}
            itemLabel="merchants"
            compact
            className="pt-3 mt-2"
          />
        )}
      </Card>
    </div>
  );
}
