import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, AlertTriangle, CircleCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card, StatusBadge } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatGHS, shortDate, timeAgo } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/merchants/applications")({
  head: () => ({ meta: [{ title: "Applications & Onboarding — Seltra Ops" }] }),
  component: ApplicationsOnboardingPage,
});

const ONBOARDING_STEPS = [
  "Application received",
  "Review & approve",
  "Create merchant",
  "Generate credentials",
  "Send welcome email",
];

const BUSINESS_TYPES = ["Retail", "Food & Beverage", "Technology", "Agriculture", "Logistics", "Other"];
const REVENUE_STAGES = ["Pre-revenue", "0–10k GHS/mo", "10–50k GHS/mo", "50k+ GHS/mo"];
const OFFBOARD_REASONS = [
  "Merchant requested",
  "Violation of terms",
  "Inactivity",
  "Fraud suspected",
  "Other",
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

type Merchant = {
  id: string;
  name: string;
  status: string;
  based_in: string | null;
  last_active_at: string | null;
  owner_name: string | null;
};

type Credentials = {
  merchantId: string;
  apiKey: string;
  storeUrl: string;
};

function slugify(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
  return slug || crypto.randomUUID().slice(0, 8);
}

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
  const [activeTab, setActiveTab] = useState("onboarding");
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [apiKeyWarning, setApiKeyWarning] = useState(false);
  const [sourceApplicationId, setSourceApplicationId] = useState<string | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [offboardReason, setOffboardReason] = useState("");
  const [confirmName, setConfirmName] = useState("");

  const [form, setForm] = useState({
    businessName: "",
    ownerName: "",
    ownerEmail: "",
    businessType: "",
    basedIn: "",
    revenueStage: "",
  });

  const { data: applications = [], isLoading: applicationsLoading } = useQuery({
    queryKey: ["merchant_applications"],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_applications")
        .select("id, business_name, full_name, email, business_type, based_in, monthly_revenue, status, created_at, merchant_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Application[];
    },
  });

  const { data: activeMerchants = [], isLoading: activeMerchantsLoading } = useQuery({
    queryKey: ["merchants", "active"],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("id, name, status, based_in, last_active_at, owner_name")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Merchant[];
    },
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["merchants", "orders-gmv"],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("merchant_id, total_amount, status, created_at")
        .eq("status", "paid");
      if (error) throw error;
      return data ?? [];
    },
  });

  const gmv30dByMerchant = useMemo(() => {
    const map = new Map<string, number>();
    const cutoff = Date.now() - 30 * 86400000;
    for (const o of orders) {
      if (!o.merchant_id || new Date(o.created_at).getTime() < cutoff) continue;
      map.set(o.merchant_id, (map.get(o.merchant_id) ?? 0) + Number(o.total_amount));
    }
    return map;
  }, [orders]);

  const waitlist = useMemo(
    () => applications.filter((a) => !a.merchant_id && a.status !== "onboarded"),
    [applications],
  );

  const isLoading = applicationsLoading || activeMerchantsLoading || ordersLoading;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["merchant_applications"] });
    queryClient.invalidateQueries({ queryKey: ["merchants"] });
  };

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("merchant_applications").update({ status: "approved" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application approved");
      setOnboardingStep(3);
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createMerchantMutation = useMutation({
    mutationFn: async () => {
      const merchantId = crypto.randomUUID();
      const slug = slugify(form.businessName);
      const apiKey = `seltra_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

      const { error: merchantError } = await supabase.from("merchants").insert({
        id: merchantId,
        name: form.businessName,
        slug,
        business_type: form.businessType,
        owner_name: form.ownerName,
        owner_email: form.ownerEmail,
        based_in: form.basedIn,
        monthly_revenue_stage: form.revenueStage,
        status: "active",
        onboarded_at: new Date().toISOString(),
      });
      if (merchantError) throw merchantError;

      const { error: keyError } = await (supabase as any).from("merchant_api_keys").insert({
        merchant_id: merchantId,
        key: apiKey,
        created_at: new Date().toISOString(),
      });
      setApiKeyWarning(Boolean(keyError));

      if (sourceApplicationId) {
        const { error: appError } = await supabase
          .from("merchant_applications")
          .update({ status: "onboarded", merchant_id: merchantId, approved_at: new Date().toISOString() })
          .eq("id", sourceApplicationId);
        if (appError) throw appError;
      }

      return {
        merchantId,
        apiKey,
        storeUrl: `https://seltra.co/${slug}`,
      };
    },
    onSuccess: (creds) => {
      setCredentials(creds);
      setOnboardingStep(4);
      toast.success("Merchant created and credentials generated");
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const offboardMutation = useMutation({
    mutationFn: async (merchant: Merchant) => {
      const { error: updateError } = await supabase
        .from("merchants")
        .update({ status: "offboarded" })
        .eq("id", merchant.id);
      if (updateError) throw updateError;

      const { error: eventError } = await supabase.from("platform_events").insert({
        event_type: "merchant_offboarded",
        merchant_id: merchant.id,
        created_at: new Date().toISOString(),
        payload: { reason: offboardReason },
      });
      if (eventError) throw eventError;
    },
    onSuccess: () => {
      toast.success("Merchant offboarded successfully");
      setSelectedMerchant(null);
      setConfirmName("");
      setOffboardReason("");
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openOnboardForm(app: Application) {
    setSourceApplicationId(app.id);
    setForm({
      businessName: app.business_name || app.full_name,
      ownerName: app.full_name,
      ownerEmail: app.email || "",
      businessType: app.business_type || "",
      basedIn: app.based_in || "",
      revenueStage: app.monthly_revenue || "",
    });
    setCredentials(null);
    setApiKeyWarning(false);
    setOnboardingStep(3);
  }

  function startOffboard(merchant: Merchant) {
    setSelectedMerchant(merchant);
    setConfirmName("");
    setOffboardReason("");
    setActiveTab("offboarding");
  }

  async function copyCredentials() {
    if (!credentials) return;
    const text = `Merchant ID: ${credentials.merchantId}\nAPI Key: ${credentials.apiKey}\nStore URL: ${credentials.storeUrl}`;
    await navigator.clipboard.writeText(text);
    toast.success("Credentials copied to clipboard");
  }

  function renderActiveMerchantsTable(showOffboard: boolean) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="py-2 pr-4">Merchant</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4 text-right">GMV 30d</th>
              <th className="py-2 pr-4">Last active</th>
              <th className="py-2 pr-4">Based in</th>
              <th className="py-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeMerchants.map((m) => (
              <tr key={m.id} className="border-b border-border hover:bg-surface-muted/50">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2.5">
                    <MerchantAvatar name={m.name} />
                    <span className="font-medium text-navy">{m.name}</span>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <StatusBadge status={m.status} />
                </td>
                <td className="py-3 pr-4 text-right font-mono text-navy">
                  {formatGHS(gmv30dByMerchant.get(m.id) ?? 0)}
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{timeAgo(m.last_active_at)}</td>
                <td className="py-3 pr-4 text-muted-foreground">{m.based_in ?? "—"}</td>
                <td className="py-3 pr-4">
                  {showOffboard ? (
                    <Button size="sm" variant="outline" onClick={() => startOffboard(m)}>
                      Offboard
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setSelectedMerchant(m)}>
                      Select
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {!activeMerchants.length && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                  No active merchants found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Applications & Onboarding"
          subtitle="Review applications, onboard merchants, and manage offboarding"
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
        subtitle="Review applications, onboard merchants, and manage offboarding"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="onboarding">Onboarding pipeline</TabsTrigger>
          <TabsTrigger value="active">Active merchants</TabsTrigger>
          <TabsTrigger value="offboarding">Offboarding</TabsTrigger>
        </TabsList>

        <TabsContent value="onboarding" className="mt-4 space-y-6">
          <Card title="Onboarding progress">
            <OnboardingStepper currentStep={onboardingStep} />
          </Card>

          <Card title="Waitlist">
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
                    const businessName = app.business_name || app.full_name;
                    const status = (app.status || "pending").toLowerCase();
                    return (
                      <tr key={app.id} className="border-b border-border hover:bg-surface-muted/50">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2.5">
                            <MerchantAvatar name={businessName} />
                            <span className="font-medium text-navy">{businessName}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <div>{app.full_name}</div>
                          <div className="text-xs text-muted-foreground">{app.email ?? "—"}</div>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">{app.business_type ?? "—"}</td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={app.status} />
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">{shortDate(app.created_at)}</td>
                        <td className="py-3 pr-4">
                          {status === "pending" || status === "applied" || status === "reviewed" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={approveMutation.isPending}
                              onClick={() => approveMutation.mutate(app.id)}
                            >
                              Approve
                            </Button>
                          ) : status === "approved" ? (
                            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => openOnboardForm(app)}>
                              Onboard
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
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

          <Card title="Create merchant">
            <form
              className="grid gap-4 max-w-xl"
              onSubmit={(e) => {
                e.preventDefault();
                createMerchantMutation.mutate();
              }}
            >
              <div>
                <Label htmlFor="businessName">Business name</Label>
                <Input
                  id="businessName"
                  value={form.businessName}
                  onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="ownerName">Owner name</Label>
                <Input
                  id="ownerName"
                  value={form.ownerName}
                  onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="ownerEmail">Owner email</Label>
                <Input
                  id="ownerEmail"
                  type="email"
                  value={form.ownerEmail}
                  onChange={(e) => setForm((f) => ({ ...f, ownerEmail: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label>Business type</Label>
                <Select value={form.businessType} onValueChange={(v) => setForm((f) => ({ ...f, businessType: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="basedIn">Based in</Label>
                <Input
                  id="basedIn"
                  value={form.basedIn}
                  onChange={(e) => setForm((f) => ({ ...f, basedIn: e.target.value }))}
                />
              </div>
              <div>
                <Label>Revenue stage</Label>
                <Select value={form.revenueStage} onValueChange={(v) => setForm((f) => ({ ...f, revenueStage: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {REVENUE_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={createMerchantMutation.isPending}>
                {createMerchantMutation.isPending ? "Creating…" : "Create merchant & generate credentials"}
              </Button>
            </form>
          </Card>

          {credentials && (
            <Card title="Merchant credentials">
              <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-foreground mb-4">
                Save these credentials now — the API key will not be shown again.
              </div>
              {apiKeyWarning && (
                <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-foreground mb-4">
                  API key not persisted — ask backend to create merchant_api_keys table
                </div>
              )}
              <div className="grid gap-4 text-sm max-w-xl">
                <div>
                  <div className="text-xs text-muted-foreground">Merchant ID</div>
                  <div className="font-mono text-navy">{credentials.merchantId}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">API Key</div>
                  <div className="font-mono text-navy break-all">{credentials.apiKey}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Store URL</div>
                  <div className="font-mono text-primary">{credentials.storeUrl}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={copyCredentials}>
                    Copy all
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => toast.info("Email feature coming soon")}
                  >
                    Send to merchant
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="active" className="mt-4">
          <Card title="Active merchants">{renderActiveMerchantsTable(true)}</Card>
        </TabsContent>

        <TabsContent value="offboarding" className="mt-4 space-y-6">
          {!selectedMerchant ? (
            <Card title="Select a merchant to offboard">{renderActiveMerchantsTable(false)}</Card>
          ) : (
            <Card title={`Offboard — ${selectedMerchant.name}`}>
              <p className="text-sm text-muted-foreground mb-6">
                This will deactivate the merchant and log the action. This cannot be undone.
              </p>

              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3 text-sm">
                  <CircleCheck className="h-5 w-5 shrink-0 text-primary" />
                  <span>Merchant status set to offboarded</span>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <CircleCheck className="h-5 w-5 shrink-0 text-primary" />
                  <span>API key revoked</span>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
                  <span>Active orders will remain — review before proceeding</span>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <ShieldAlert className="h-5 w-5 shrink-0 text-warning" />
                  <span>Merchant data retained for 90 days per policy</span>
                </div>
              </div>

              <div className="grid gap-4 max-w-md">
                <div>
                  <Label>Reason</Label>
                  <Select value={offboardReason} onValueChange={setOffboardReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {OFFBOARD_REASONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="confirmName">
                    Type <span className="font-semibold">{selectedMerchant.name}</span> to confirm
                  </Label>
                  <Input
                    id="confirmName"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={selectedMerchant.name}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="destructive"
                    disabled={
                      confirmName !== selectedMerchant.name ||
                      !offboardReason ||
                      offboardMutation.isPending
                    }
                    onClick={() => offboardMutation.mutate(selectedMerchant)}
                  >
                    {offboardMutation.isPending ? "Offboarding…" : "Confirm offboard"}
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedMerchant(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
