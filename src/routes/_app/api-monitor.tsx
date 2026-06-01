import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Card } from "@/components/ui-bits";
export const Route = createFileRoute("/_app/api-monitor")({
  head: () => ({ meta: [{ title: "API Monitor — Seltra Ops" }] }),
  component: () => (<div className="space-y-6">
    <PageHeader title="API Monitor" subtitle="Endpoint usage across the platform" />
    <Card><div className="py-12 text-center text-sm text-muted-foreground">Scaffolded — ready to build out.</div></Card>
  </div>),
});
