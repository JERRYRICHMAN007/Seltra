import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Card } from "@/components/ui-bits";

function makeStub(title: string, subtitle: string) {
  return function StubPage() {
    return (
      <div className="space-y-6">
        <PageHeader title={title} subtitle={subtitle} />
        <Card>
          <div className="py-12 text-center">
            <div className="text-sm text-muted-foreground">This page is scaffolded and ready to be built out.</div>
            <div className="text-xs font-mono text-muted-foreground mt-2">Data sources are seeded — ask Lovable to flesh out this view next.</div>
          </div>
        </Card>
      </div>
    );
  };
}

export const Route = createFileRoute("/_app/merchants/applications")({
  head: () => ({ meta: [{ title: "Applications — Seltra Ops" }] }),
  component: makeStub("Applications", "Founding merchant applications"),
});
