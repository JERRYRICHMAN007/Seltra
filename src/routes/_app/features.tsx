import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Card } from "@/components/ui-bits";
export const Route = createFileRoute("/_app/features")({
  head: () => ({ meta: [{ title: "Feature Usage — Seltra Ops" }] }),
  component: () => (<div className="space-y-6">
    <PageHeader title="Feature Usage" subtitle="Which parts of Seltra merchants actually use" />
    <Card><div className="py-12 text-center text-sm text-muted-foreground">Scaffolded — ready to build out.</div></Card>
  </div>),
});
