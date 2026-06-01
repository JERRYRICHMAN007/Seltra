import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Card } from "@/components/ui-bits";
export const Route = createFileRoute("/_app/retention")({
  head: () => ({ meta: [{ title: "Retention — Seltra Ops" }] }),
  component: () => (<div className="space-y-6">
    <PageHeader title="Retention" subtitle="Cohort retention and churn analysis" />
    <Card><div className="py-12 text-center text-sm text-muted-foreground">Scaffolded — ready to build out.</div></Card>
  </div>),
});
