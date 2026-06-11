import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Card, PageWrapper } from "@/components/ui-bits";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_app/developer")({
  head: () => ({ meta: [{ title: "Developer Tools — Seltra Ops" }] }),
  component: DeveloperPage,
});

function DeveloperPage() {
  const [logMode, setLogMode] = useState("info");

  return (
    <PageWrapper>
      <PageHeader title="Developer Tools" subtitle="Internal utilities for the Seltra engineering team" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Quick actions">
          <div className="flex flex-col gap-2">
            <Button variant="outline" disabled title="Coming soon">
              Run migrations
            </Button>
            <Button variant="outline" disabled title="Coming soon">
              Clear cache
            </Button>
            <Button variant="outline" disabled title="Coming soon">
              Rebuild search index
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              These actions will be wired to server functions in a future release.
            </p>
          </div>
        </Card>

        <Card title="Logs">
          <div className="flex items-center gap-2 mb-3">
            <Select value={logMode} onValueChange={setLogMode}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="h-40 overflow-y-auto text-xs font-mono text-muted-foreground p-2 bg-surface-muted rounded">
            No logs in this environment
          </div>
        </Card>

        <Card title="Integrations">
          <div className="text-sm text-muted-foreground">
            Manage API keys and integration connectors. Use caution — these are powerful tools.
          </div>
        </Card>
      </div>
    </PageWrapper>
  );
}
