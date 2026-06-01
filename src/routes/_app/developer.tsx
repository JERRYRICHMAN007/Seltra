import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Card } from "@/components/ui-bits";
export const Route = createFileRoute("/_app/developer")({
  head: () => ({ meta: [{ title: "Developer Tools — Seltra Ops" }] }),
  component: () => (<div className="space-y-6">
    <PageHeader title="Developer Tools" subtitle="Internal utilities for the Seltra engineering team" />
    <Card><div className="py-12 text-center text-sm text-muted-foreground">Scaffolded — ready to build out.</div></Card>
  </div>),
});
