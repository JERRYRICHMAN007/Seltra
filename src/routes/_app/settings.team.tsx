import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Card } from "@/components/ui-bits";
export const Route = createFileRoute("/_app/settings/team")({
  head: () => ({ meta: [{ title: "Team — Seltra Ops" }] }),
  component: () => (<div className="space-y-6">
    <PageHeader title="Team" subtitle="Ops users with access to Seltra Ops" />
    <Card><div className="py-12 text-center text-sm text-muted-foreground">Scaffolded — ready to build out.</div></Card>
  </div>),
});
