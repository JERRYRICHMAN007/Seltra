import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  exportMerchantsCsv,
  getMerchantDetail,
  listMerchants,
  patchMerchant,
  removeMerchant,
} from "@/lib/api/merchants.functions";
import { merchantsFromSupabase, merchantsResponseToResult } from "@/lib/api/merchants-mappers";
import type { MerchantRow, MerchantSortBy, SortDir } from "@/lib/api/merchants.types";
import { PageHeader, StatusBadge, Card } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { downloadTextFile, exportCsv, formatGHS, shortDate } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPagination } from "@/components/list-pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_app/merchants/")({
  head: () => ({ meta: [{ title: "Merchants — Seltra Ops" }] }),
  component: MerchantsPage,
});

function MerchantsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const opsActor = user?.email ?? "ops@seltra.co";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [businessTypeFilter, setBusinessTypeFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [sortBy, setSortBy] = useState<MerchantSortBy>("joined");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<MerchantRow | null>(null);

  const listQuery = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      businessType: businessTypeFilter.trim() || undefined,
      country: countryFilter.trim() || undefined,
      sortBy,
      sortDir,
      page,
    }),
    [search, statusFilter, businessTypeFilter, countryFilter, sortBy, sortDir, page],
  );

  const { data: merchantsResult, isLoading: merchantsLoading, isError: merchantsApiFailed } = useQuery({
    queryKey: ["merchants", listQuery],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    retry: false,
    queryFn: () => listMerchants({ data: listQuery }).then(merchantsResponseToResult),
  });

  const { data: fallbackData, isLoading: fallbackLoading } = useQuery({
    queryKey: ["merchants-fallback"],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    enabled: merchantsApiFailed,
    queryFn: async () => {
      const [merchants, orders] = await Promise.all([
        supabase.from("merchants").select("*").order("created_at", { ascending: false }),
        supabase.from("orders").select("merchant_id,total_amount,status"),
      ]);
      return {
        merchants: merchants.data ?? [],
        orders: orders.data ?? [],
      };
    },
  });

  const resolvedResult = useMemo(() => {
    if (merchantsResult) return merchantsResult;
    if (!fallbackData) return null;
    return merchantsFromSupabase(fallbackData.merchants, fallbackData.orders, listQuery);
  }, [merchantsResult, fallbackData, listQuery]);

  const isLoading = merchantsLoading || (merchantsApiFailed && fallbackLoading);

  const merchantRows = resolvedResult?.rows ?? [];

  async function handleExport() {
    try {
      const csv = await exportMerchantsCsv({
        data: {
          search: listQuery.search,
          status: listQuery.status,
          businessType: listQuery.businessType,
          country: listQuery.country,
          sortBy: listQuery.sortBy,
          sortDir: listQuery.sortDir,
        },
      });
      downloadTextFile("merchants.csv", csv);
      return;
    } catch {
      if (!merchantRows.length) {
        toast.error("No merchants to export");
        return;
      }
      exportCsv(
        "merchants.csv",
        merchantRows.map((m) => ({
          store: m.storeName,
          slug: m.slug,
          owner_name: m.ownerName,
          owner_email: m.ownerEmail,
          type: m.businessType,
          status: m.status,
          gmv: m.gmv.toFixed(2),
          orders: m.orderCount,
          last_active: m.lastActive,
          joined: m.joinedAt,
        })),
      );
    }
  }

  async function handleDelete(merchant: MerchantRow) {
    if (!confirm(`Remove ${merchant.storeName}? This soft-removes the store.`)) return;
    try {
      await removeMerchant({ data: { tenantId: merchant.id, opsActor } });
      toast.success("Merchant removed");
      queryClient.invalidateQueries({ queryKey: ["merchants"] });
      return;
    } catch {
      const { error } = await supabase.from("merchants").delete().eq("id", merchant.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Merchant removed");
      queryClient.invalidateQueries({ queryKey: ["merchants"] });
      queryClient.invalidateQueries({ queryKey: ["merchants-fallback"] });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Merchants"
        subtitle="All registered stores on Seltra"
        action={
          <Button variant="outline" onClick={handleExport}>
            Export CSV
          </Button>
        }
      />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            placeholder="Search store, slug, or owner email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-sm bg-surface-muted border-input"
          />
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="removed">Removed</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Business type"
            value={businessTypeFilter}
            onChange={(e) => {
              setBusinessTypeFilter(e.target.value);
              setPage(1);
            }}
            className="max-w-[160px] bg-surface-muted border-input"
          />
          <Input
            placeholder="Country"
            value={countryFilter}
            onChange={(e) => {
              setCountryFilter(e.target.value);
              setPage(1);
            }}
            className="max-w-[160px] bg-surface-muted border-input"
          />
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as MerchantSortBy)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="joined">Joined</SelectItem>
              <SelectItem value="gmv">GMV</SelectItem>
              <SelectItem value="orders">Orders</SelectItem>
              <SelectItem value="lastActive">Last active</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortDir} onValueChange={(value) => setSortDir(value as SortDir)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Desc</SelectItem>
              <SelectItem value="asc">Asc</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isLoading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : (
        <>
        {/* Mobile cards */}
        <div className="space-y-3 lg:hidden">
          {merchantRows.map((m) => (
            <div key={m.id} className="rounded-lg border border-border bg-surface p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground">{m.storeName}</div>
                  <div className="truncate text-xs text-muted-foreground">{m.slug}</div>
                </div>
                <StatusBadge status={m.status} />
              </div>
              <div className="mt-2 text-sm text-foreground">{m.ownerName}</div>
              <div className="truncate text-xs text-muted-foreground">{m.ownerEmail}</div>
              <div className="mt-2 line-clamp-2 text-xs text-muted-foreground" title={m.businessType}>
                {m.businessType}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono text-foreground">{formatGHS(m.gmv)}</span>
                <span>{m.orderCount} orders</span>
                <span>{m.lastActive}</span>
                <span>Joined {shortDate(m.joinedAt)}</span>
              </div>
              <div className="mt-3 flex flex-nowrap items-center gap-2">
                <Dialog
                  open={editOpen && selected?.id === m.id}
                  onOpenChange={(open) => {
                    setEditOpen(open);
                    if (!open) setSelected(null);
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => {
                        setSelected(m);
                        setEditOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit merchant</DialogTitle>
                      <DialogDescription>Update merchant store metadata</DialogDescription>
                    </DialogHeader>
                    <MerchantEditForm
                      merchant={m}
                      opsActor={opsActor}
                      onSaved={() => {
                        queryClient.invalidateQueries({ queryKey: ["merchants"] });
                        queryClient.invalidateQueries({ queryKey: ["merchants-fallback"] });
                        setEditOpen(false);
                        setSelected(null);
                      }}
                    />
                  </DialogContent>
                </Dialog>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleDelete(m)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="-mx-4 hidden overflow-x-auto lg:mx-0 lg:block">
          <table className="ops-table w-full min-w-[960px] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <th className="pb-2.5 pr-4 font-medium">Store</th>
                <th className="pb-2.5 pr-4 font-medium">Owner</th>
                <th className="pb-2.5 pr-4 font-medium">Type</th>
                <th className="pb-2.5 pr-4 font-medium">Status</th>
                <th className="pb-2.5 pr-4 text-right font-medium">GMV</th>
                <th className="pb-2.5 pr-4 text-right font-medium">Orders</th>
                <th className="pb-2.5 pr-4 font-medium">Last Active</th>
                <th className="pb-2.5 pr-4 font-medium">Joined</th>
                <th className="pb-2.5 pr-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {merchantRows.map((m) => (
                <tr key={m.id} className="hover:bg-surface-muted/50">
                  <td className="py-3 pr-4">
                    <div className="max-w-[180px] truncate font-medium text-foreground" title={m.storeName}>
                      {m.storeName}
                    </div>
                    <div className="max-w-[180px] truncate text-xs text-muted-foreground" title={m.slug}>
                      {m.slug}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="truncate text-foreground">{m.ownerName}</div>
                    <div className="max-w-[180px] truncate text-xs text-muted-foreground" title={m.ownerEmail}>
                      {m.ownerEmail}
                    </div>
                  </td>
                  <td className="max-w-[160px] truncate py-3 pr-4 text-muted-foreground" title={m.businessType}>
                    {m.businessType}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-right font-mono text-foreground">{formatGHS(m.gmv)}</td>
                  <td className="whitespace-nowrap py-3 pr-4 text-right font-mono">{m.orderCount}</td>
                  <td className="whitespace-nowrap py-3 pr-4 text-muted-foreground">{m.lastActive}</td>
                  <td className="whitespace-nowrap py-3 pr-4 text-muted-foreground">{shortDate(m.joinedAt)}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <div className="flex flex-nowrap items-center gap-1.5">
                      <Dialog
                        open={editOpen && selected?.id === m.id}
                        onOpenChange={(open) => {
                          setEditOpen(open);
                          if (!open) setSelected(null);
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => {
                              setSelected(m);
                              setEditOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit merchant</DialogTitle>
                            <DialogDescription>Update merchant store metadata</DialogDescription>
                          </DialogHeader>
                          <MerchantEditForm
                            merchant={m}
                            opsActor={opsActor}
                            onSaved={() => {
                              queryClient.invalidateQueries({ queryKey: ["merchants"] });
                              queryClient.invalidateQueries({ queryKey: ["merchants-fallback"] });
                              setEditOpen(false);
                              setSelected(null);
                            }}
                          />
                        </DialogContent>
                      </Dialog>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleDelete(m)}
                      >
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
        )}
        {!isLoading && !merchantRows.length && (
          <div className="py-8 text-center text-xs text-muted-foreground">No merchants found</div>
        )}
        {!isLoading && resolvedResult && (
          <ListPagination
            page={resolvedResult.page}
            totalPages={resolvedResult.totalPages}
            totalItems={resolvedResult.total}
            pageSize={resolvedResult.pageSize}
            onPageChange={setPage}
            itemLabel="merchants"
            className="px-0"
          />
        )}
      </Card>
    </div>
  );
}

function MerchantEditForm({
  merchant,
  opsActor,
  onSaved,
}: {
  merchant: MerchantRow;
  opsActor: string;
  onSaved?: () => void;
}) {
  const [name, setName] = useState(merchant.storeName);
  const [businessType, setBusinessType] = useState(merchant.businessType);
  const [status, setStatus] = useState(merchant.status);
  const [basedIn, setBasedIn] = useState(merchant.basedIn === "—" ? "" : merchant.basedIn);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getMerchantDetail({ data: { tenantId: merchant.id } })
      .then((response) => setBasedIn(response.data.basedIn ?? ""))
      .catch(() => undefined);
  }, [merchant.id]);

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    try {
      await patchMerchant({
        data: {
          tenantId: merchant.id,
          opsActor,
          patch: { name, businessType, status, basedIn },
        },
      });
      toast.success("Merchant updated");
      onSaved?.();
    } catch {
      const { error } = await supabase
        .from("merchants")
        .update({
          name,
          business_type: businessType,
          status,
          based_in: basedIn,
        })
        .eq("id", merchant.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Merchant updated");
      onSaved?.();
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
        <Label>Owner</Label>
        <Input value={`${merchant.ownerName} · ${merchant.ownerEmail}`} disabled />
      </div>
      <div>
        <Label>Business type</Label>
        <Input value={businessType} onChange={(e) => setBusinessType(e.target.value)} />
      </div>
      <div>
        <Label>Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="removed">Removed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Based in</Label>
        <Input value={basedIn} onChange={(e) => setBasedIn(e.target.value)} />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
