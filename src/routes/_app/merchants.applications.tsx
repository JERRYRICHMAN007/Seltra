import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card, StatusBadge } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { formatCompact, timeAgo, exportCsv } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/merchants/applications")({
  head: () => ({ meta: [{ title: "Applications — Seltra Ops" }] }),
  component: MerchantApplicationsPage,
});

function MerchantApplicationsPage() {
  const queryClient = useQueryClient();
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [credentials, setCredentials] = useState<{ merchantId: string; apiKey: string; storeUrl: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: applications = [] } = useQuery({
    queryKey: ["merchant-applications"],
    queryFn: async () => (await supabase.from("merchant_applications").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const waitlistApplications = useMemo(
    () => applications.filter((app: any) => !app.merchant_id),
    [applications],
  );

  const alreadyOnboarded = useMemo(
    () => applications.filter((app: any) => Boolean(app.merchant_id)),
    [applications],
  );

  const approvedWaitlist = waitlistApplications.filter((app: any) => app.status === "approved");

  async function onboardMerchant(application: any) {
    setIsOnboarding(true);
    const merchantId = crypto.randomUUID();
    const slugSource = application.store_name || application.business_name || application.full_name || merchantId;
    const slug = slugSource
      .toString()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 40);

    const merchantPayload = {
      id: merchantId,
      name: application.business_name || application.store_name || application.full_name || "New Merchant",
      slug: slug || merchantId.slice(0, 8),
      owner_name: application.full_name,
      owner_email: application.email,
      based_in: application.based_in,
      business_type: application.business_type,
      status: "active",
      created_at: new Date().toISOString(),
      onboarded_at: new Date().toISOString(),
    };

    const { error: merchantError } = await supabase.from("merchants").insert(merchantPayload);
    if (merchantError) {
      setIsOnboarding(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("merchant_applications")
      .update({
        status: "approved",
        merchant_id: merchantId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", application.id);

    if (!updateError) {
      setCredentials({
        merchantId,
        apiKey: `seltra_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`,
        storeUrl: `https://seltra.co/${merchantPayload.slug}`,
      });
      queryClient.invalidateQueries(["merchant-applications"]);
      queryClient.invalidateQueries(["merchants"]);
    }

    setIsOnboarding(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        subtitle="Waitlist applicants and merchant onboarding"
        action={
          <div className="flex items-center gap-2">
            <Button onClick={() => exportCsv("merchant-applications.csv", applications as any)}>Export CSV</Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">Add Merchant</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add new merchant</DialogTitle>
                  <DialogDescription>Fill in merchant details to create a new merchant and generate credentials.</DialogDescription>
                </DialogHeader>
                <MerchantCreateForm onCreated={async (m) => {
                  // show credentials and refresh
                  setCredentials(m);
                  queryClient.invalidateQueries(["merchants"]);
                  setCreateOpen(false);
                }} />
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Card title="Waitlist applicants">
        <div className="text-xs text-muted-foreground mb-4">
          Applications from the waitlist are displayed here. In the future, this view will sync directly with <a className="text-primary underline" href="https://www.seltra.co/waitlist" target="_blank" rel="noreferrer">seltra.co/waitlist</a>.
        </div>
        {!waitlistApplications.length ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No waitlist applications found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4">Merchant</th>
                  <th className="py-2 pr-4">Contact</th>
                  <th className="py-2 pr-4">Location</th>
                  <th className="py-2 pr-4">Revenue</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Applied</th>
                </tr>
              </thead>
              <tbody>
                {waitlistApplications.map((app: any) => (
                  <tr key={app.id} className="border-b border-border hover:bg-surface-muted/50">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-navy">{app.store_name || app.business_name || app.full_name}</div>
                      <div className="text-xs text-muted-foreground">{app.what_you_sell}</div>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{app.email || app.phone}</td>
                    <td className="py-3 pr-4 text-navy">{app.based_in || "—"}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{app.monthly_revenue || "—"}</td>
                    <td className="py-3 pr-4"><StatusBadge status={app.status || "pending"} /></td>
                    <td className="py-3 pr-4 text-muted-foreground">{timeAgo(app.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Onboard new merchants">
        <div className="text-xs text-muted-foreground mb-4">
          Approved waitlist applications can be converted into active Seltra merchants. Generating credentials creates a merchant record and returns onboarding details.
        </div>
        {!approvedWaitlist.length ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No approved waitlist applications ready for onboarding.</div>
        ) : (
          <div className="space-y-4">
            {approvedWaitlist.map((app: any) => (
              <div key={app.id} className="rounded-3xl border border-border p-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
                <div>
                  <div className="font-medium text-navy">{app.store_name || app.business_name || app.full_name}</div>
                  <div className="text-xs text-muted-foreground">{app.email || app.phone}</div>
                  <div className="text-xs text-muted-foreground">{app.business_type || "No business type"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => onboardMerchant(app)} disabled={isOnboarding}>
                    {isOnboarding ? "Onboarding..." : "Generate credentials"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {alreadyOnboarded.length ? (
        <Card title="Onboarded merchant applications">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4">Merchant</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Onboarded</th>
                </tr>
              </thead>
              <tbody>
                {alreadyOnboarded.map((app: any) => (
                  <tr key={app.id} className="border-b border-border hover:bg-surface-muted/50">
                    <td className="py-3 pr-4">{app.store_name || app.business_name || app.full_name}</td>
                    <td className="py-3 pr-4"><StatusBadge status={app.status || "approved"} /></td>
                    <td className="py-3 pr-4 text-muted-foreground">{timeAgo(app.approved_at || app.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {credentials ? (
        <Card title="Merchant credentials generated">
          <div className="grid gap-4 text-sm">
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
              <div className="text-primary font-medium">{credentials.storeUrl}</div>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function MerchantCreateForm({ onCreated }: { onCreated?: (creds: { merchantId: string; apiKey: string; storeUrl: string }) => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [basedIn, setBasedIn] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    try {
      const merchantId = crypto.randomUUID();
      const slugSource = slug || name || merchantId;
      const finalSlug = slugSource.toString().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40) || merchantId.slice(0,8);
      const payload = {
        id: merchantId,
        name: name || "New Merchant",
        slug: finalSlug,
        owner_name: ownerName || "",
        owner_email: ownerEmail || "",
        business_type: businessType || null,
        based_in: basedIn || null,
        status: "active",
        created_at: new Date().toISOString(),
        onboarded_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("merchants").insert(payload);
      if (error) throw error;

      const apiKey = `seltra_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
      const creds = { merchantId: payload.id, apiKey, storeUrl: `https://seltra.co/${payload.slug}` };
      queryClient.invalidateQueries(["merchants"]);
      onCreated?.(creds);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className="grid gap-3">
      <div>
        <Label>Store name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <Label>Slug (optional)</Label>
        <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
      </div>
      <div>
        <Label>Owner name</Label>
        <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
      </div>
      <div>
        <Label>Owner email</Label>
        <Input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} type="email" />
      </div>
      <div>
        <Label>Business type</Label>
        <Input value={businessType} onChange={(e) => setBusinessType(e.target.value)} />
      </div>
      <div>
        <Label>Based in</Label>
        <Input value={basedIn} onChange={(e) => setBasedIn(e.target.value)} />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create merchant"}</Button>
      </DialogFooter>
    </form>
  );
}
