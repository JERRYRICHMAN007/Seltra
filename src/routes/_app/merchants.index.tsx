import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusBadge, Card } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { formatGHS, timeAgo, shortDate, exportCsv } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/merchants/")({
  head: () => ({ meta: [{ title: "Merchants — Seltra Ops" }] }),
  component: MerchantsPage,
});

function MerchantsPage() {
  const queryClient = useQueryClient();
  const { data: merchants = [], isLoading: merchantsLoading } = useQuery({
    queryKey: ["merchants"],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    queryFn: async () => (await supabase.from("merchants").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["orders-by-merchant"],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    queryFn: async () => (await supabase.from("orders").select("merchant_id,total_amount,status")).data ?? [],
  });
  const isLoading = merchantsLoading || ordersLoading;

  const gmvByMerchant = new Map<string, { gmv: number; count: number }>();
  orders.forEach((o: any) => {
    if (o.status !== "paid") return;
    const prev = gmvByMerchant.get(o.merchant_id) ?? { gmv: 0, count: 0 };
    gmvByMerchant.set(o.merchant_id, { gmv: prev.gmv + Number(o.total_amount), count: prev.count + 1 });
  });

  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  async function handleDelete(id: string) {
    if (!confirm("Delete this merchant? This cannot be undone.")) return;
    const { error } = await supabase.from("merchants").delete().eq("id", id);
    if (error) return console.error(error);
    queryClient.invalidateQueries({ queryKey: ["merchants"] });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Merchants" subtitle="All registered stores on Seltra" />
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
        title="Merchants"
        subtitle="All registered stores on Seltra"
        action={<Button onClick={() => exportCsv("merchants.csv", merchants as any)}>Export CSV</Button>}
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">Store</th>
                <th className="py-2 pr-4">Owner</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Location</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4 text-right">GMV</th>
                <th className="py-2 pr-4 text-right">Orders</th>
                <th className="py-2 pr-4">Last Active</th>
                <th className="py-2 pr-4">Joined</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((m: any) => {
                const stats = gmvByMerchant.get(m.id) ?? { gmv: 0, count: 0 };
                return (
                  <tr key={m.id} className="border-b border-border hover:bg-surface-muted/50 cursor-pointer">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-navy">{m.name}</div>
                      <div className="text-xs font-mono text-muted-foreground">{m.slug}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="text-navy">{m.owner_name}</div>
                      <div className="text-xs text-muted-foreground">{m.owner_email}</div>
                    </td>
                    <td className="py-3 pr-4 text-navy">{m.business_type}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{m.based_in}</td>
                    <td className="py-3 pr-4"><StatusBadge status={m.status} /></td>
                    <td className="py-3 pr-4 text-right font-mono text-navy">{formatGHS(stats.gmv)}</td>
                    <td className="py-3 pr-4 text-right font-mono">{stats.count}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{timeAgo(m.last_active_at)}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{shortDate(m.onboarded_at)}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <Dialog open={editOpen && selected?.id === m.id} onOpenChange={(v) => { setEditOpen(v); if (!v) setSelected(null); }}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" onClick={() => { setSelected(m); setEditOpen(true); }}>Edit</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit merchant</DialogTitle>
                              <DialogDescription>Update merchant details</DialogDescription>
                            </DialogHeader>
                            <MerchantEditForm merchant={m} onSaved={() => { queryClient.invalidateQueries({ queryKey: ["merchants"] }); setEditOpen(false); setSelected(null); }} />
                          </DialogContent>
                        </Dialog>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(m.id)}>Remove</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function MerchantEditForm({ merchant, onSaved }: { merchant: any; onSaved?: () => void }) {
  const [name, setName] = useState(merchant.name || "");
  const [ownerName, setOwnerName] = useState(merchant.owner_name || "");
  const [ownerEmail, setOwnerEmail] = useState(merchant.owner_email || "");
  const [businessType, setBusinessType] = useState(merchant.business_type || "");
  const [basedIn, setBasedIn] = useState(merchant.based_in || "");
  const [loading, setLoading] = useState(false);

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from("merchants").update({
        name,
        owner_name: ownerName,
        owner_email: ownerEmail,
        business_type: businessType,
        based_in: basedIn,
      }).eq("id", merchant.id);
      if (error) throw error;
      onSaved?.();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="grid gap-3">
      <div>
        <Label>Store name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
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
        <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
      </DialogFooter>
    </form>
  );
}
