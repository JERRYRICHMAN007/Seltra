import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getDashboardActivitySeries,
  getDashboardFootprint,
  getDashboardGmvSeries,
  getDashboardOverview,
  getDashboardRecentApplications,
  getDashboardRecentEvents,
  getDashboardSystemStatus,
  getDashboardTopMerchants,
} from "@/lib/api/dashboard.functions";
import { listMessagingAudience } from "@/lib/api/communication.functions";
import { listMerchants } from "@/lib/api/merchants.functions";
import { merchantsResponseToResult } from "@/lib/api/merchants-mappers";
import { listApplications } from "@/lib/api/applications.functions";
import { applicationsResponseToResult } from "@/lib/api/applications-mappers";

const STALE = 1000 * 60 * 2;
const GC = 1000 * 60 * 5;

const defaultMerchantListQuery = {
  sortBy: "joined" as const,
  sortDir: "desc" as const,
  page: 1,
};

function warm(queryClient: QueryClient, queryKey: unknown[], queryFn: () => Promise<unknown>) {
  return queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime: STALE,
    gcTime: GC,
  });
}

/** Dashboard + globe — highest priority after login. */
export async function prefetchDashboard(queryClient: QueryClient) {
  void import("@/components/GlobeMap");

  await Promise.allSettled([
    warm(queryClient, ["dashboard-overview"], () => getDashboardOverview()),
    warm(queryClient, ["dashboard-footprint"], () => getDashboardFootprint()),
    warm(queryClient, ["dashboard-gmv-series"], () => getDashboardGmvSeries()),
    warm(queryClient, ["dashboard-activity-series"], () => getDashboardActivitySeries()),
    warm(queryClient, ["dashboard-top-merchants"], () => getDashboardTopMerchants()),
    warm(queryClient, ["dashboard-recent-events"], () => getDashboardRecentEvents()),
    warm(queryClient, ["dashboard-system-status"], () => getDashboardSystemStatus()),
    warm(queryClient, ["dashboard-recent-applications"], () => getDashboardRecentApplications()),
    warm(queryClient, ["dashboard-details"], async () => {
      const [merchants, orders, events, health, apps] = await Promise.all([
        supabase.from("merchants").select("id,name,slug,status,last_active_at,based_in"),
        supabase
          .from("orders")
          .select("id,merchant_id,total_amount,status,created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("platform_events")
          .select("id,event_type,merchant_id,created_at")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("system_health")
          .select("service,status,checked_at")
          .order("checked_at", { ascending: false })
          .limit(50),
        supabase.from("merchant_applications").select("*").order("created_at", { ascending: false }),
      ]);
      return {
        merchants: merchants.data ?? [],
        orders: orders.data ?? [],
        events: events.data ?? [],
        health: health.data ?? [],
        apps: apps.data ?? [],
      };
    }),
  ]);
}

export async function prefetchRouteData(queryClient: QueryClient, to: string) {
  const path = to.length > 1 && to.endsWith("/") ? to.slice(0, -1) : to;

  switch (path) {
    case "/":
      return prefetchDashboard(queryClient);

    case "/merchants":
      return warm(queryClient, ["merchants", defaultMerchantListQuery], () =>
        listMerchants({ data: defaultMerchantListQuery }).then(merchantsResponseToResult),
      );

    case "/merchants/applications":
      return warm(queryClient, ["applications", ""], () =>
        listApplications({ data: {} }).then(applicationsResponseToResult),
      );

    case "/merchants/communication":
      return warm(queryClient, ["messaging-audience"], () => listMessagingAudience());

    case "/merchants/success":
      return warm(queryClient, ["merchant-success"], async () => {
        const [applicationsResult, merchantsResult] = await Promise.all([
          supabase
            .from("merchant_applications")
            .select(
              "id, status, created_at, merchant_id, email, business_name, store_name, business_type, full_name",
            ),
          supabase.from("merchants").select("id, name, owner_email, business_type, onboarded_at, orders(id)"),
        ]);
        return {
          applications: applicationsResult.data ?? [],
          merchants: merchantsResult.data ?? [],
        };
      });

    case "/orders":
      return warm(queryClient, ["orders-all"], async () =>
        (
          await supabase
            .from("orders")
            .select("*, merchants(name,slug)")
            .order("created_at", { ascending: false })
            .limit(200)
        ).data ?? [],
      );

    case "/payments":
      return warm(queryClient, ["payments-orders"], async () =>
        (
          await supabase
            .from("orders")
            .select("id, merchant_id, total_amount, status, created_at, merchants(name)")
            .order("created_at", { ascending: false })
        ).data ?? [],
      );

    case "/ai":
      return warm(queryClient, ["agents-dashboard"], async () => {
        const [invocations, agents] = await Promise.all([
          supabase
            .from("agent_invocations")
            .select("id,agent_name,success,latency,created_at")
            .order("created_at", { ascending: false })
            .limit(200),
          supabase.from("agents").select("id,name,created_at").limit(100),
        ]);
        return { invocations: invocations.data ?? [], agents: agents.data ?? [] };
      });

    case "/features":
      return warm(queryClient, ["feature-usage-dashboard"], async () => {
        const [merchantsRes, ordersRes, invocationsRes] = await Promise.all([
          supabase.from("merchants").select("id, name, slug, status, last_active_at"),
          supabase.from("orders").select("merchant_id, status, created_at"),
          supabase.from("agent_invocations").select("merchant_id, success, created_at"),
        ]);
        return {
          merchants: merchantsRes.data ?? [],
          orders: ordersRes.data ?? [],
          invocations: invocationsRes.data ?? [],
        };
      });

    case "/retention":
      return warm(queryClient, ["retention-dashboard"], async () => {
        const [merchantsRes, ordersRes] = await Promise.all([
          supabase.from("merchants").select("id, name, slug, status, last_active_at, created_at"),
          supabase.from("orders").select("merchant_id, total_amount, status, created_at"),
        ]);
        return {
          merchants: merchantsRes.data ?? [],
          orders: ordersRes.data ?? [],
        };
      });

    case "/system":
      return warm(queryClient, ["health"], async () =>
        (
          await supabase
            .from("system_health")
            .select("*")
            .order("checked_at", { ascending: false })
            .limit(200)
        ).data ?? [],
      );

    case "/api-monitor":
      return Promise.allSettled([
        warm(queryClient, ["api-monitor-health"], async () =>
          (
            await supabase
              .from("system_health")
              .select("service, status, checked_at")
              .order("checked_at", { ascending: false })
          ).data ?? [],
        ),
        warm(queryClient, ["api-monitor-events"], async () =>
          (
            await supabase
              .from("platform_events")
              .select("id, event_type, merchant_id, created_at, merchants(name)")
              .order("created_at", { ascending: false })
              .limit(500)
          ).data ?? [],
        ),
      ]);

    case "/settings":
      return warm(queryClient, ["settings-team-members"], async () => {
        const profiles = await supabase
          .from("profiles")
          .select("id, full_name, email, role, created_at")
          .order("created_at", { ascending: true });

        if (!profiles.error && profiles.data?.length) {
          return profiles.data;
        }

        const opsUsers = await supabase
          .from("ops_users")
          .select("id, name, email, role, created_at")
          .order("created_at", { ascending: true });

        return (opsUsers.data ?? []).map((member) => ({
          id: member.id,
          full_name: member.name,
          email: member.email,
          role: member.role,
          created_at: member.created_at,
        }));
      });

    default:
      return;
  }
}

const WARM_ORDER = [
  "/",
  "/merchants",
  "/merchants/applications",
  "/merchants/communication",
  "/merchants/success",
  "/orders",
  "/payments",
  "/system",
  "/api-monitor",
  "/ai",
  "/features",
  "/retention",
] as const;

/** After login: dashboard first, then idle-warm the rest of the sidebar. */
export function warmOpsDataCache(queryClient: QueryClient) {
  void prefetchDashboard(queryClient).then(() => {
    const runNext = (index: number) => {
      if (index >= WARM_ORDER.length) return;
      const path = WARM_ORDER[index];
      if (path === "/") {
        runNext(index + 1);
        return;
      }
      void prefetchRouteData(queryClient, path).finally(() => {
        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
          window.requestIdleCallback(() => runNext(index + 1), { timeout: 2500 });
        } else {
          setTimeout(() => runNext(index + 1), 200);
        }
      });
    };
    runNext(1);
  });
}
