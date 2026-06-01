import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Card } from "@/components/ui-bits";
export const Route = createFileRoute("/_app/payments")({
  head: () => ({ meta: [{ title: "Payments — Seltra Ops" }] }),
  component: () => (<div className="space-y-6">
    <PageHeader title="Payments" subtitle="Master Paystack account — PartechnologiesAndConsult" />
    <Card><div className="py-12 text-center text-sm text-muted-foreground">Scaffolded — ready to build out.</div></Card>
  </div>),
});
