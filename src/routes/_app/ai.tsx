import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Card } from "@/components/ui-bits";
export const Route = createFileRoute("/_app/ai")({
  head: () => ({ meta: [{ title: "AI & Agents — Seltra Ops" }] }),
  component: () => (<div className="space-y-6">
    <PageHeader title="AI & Agents" subtitle="Agent performance and model usage" />
    <Card><div className="py-12 text-center text-sm text-muted-foreground">Scaffolded — ready to build out.</div></Card>
  </div>),
});
