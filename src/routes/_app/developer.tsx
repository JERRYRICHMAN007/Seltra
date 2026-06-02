import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Card } from "@/components/ui-bits";
import { useState } from "react";

export const Route = createFileRoute("/_app/developer")({
  head: () => ({ meta: [{ title: "Developer Tools — Seltra Ops" }] }),
  component: DeveloperPage,
});

function DeveloperPage() {
  const [logMode, setLogMode] = useState("info");

  return (
    <div className="space-y-6">
      <PageHeader title="Developer Tools" subtitle="Internal utilities for the Seltra engineering team" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Quick actions">
          <div className="flex flex-col gap-2">
            <button className="btn">Run migrations</button>
            <button className="btn">Clear cache</button>
            <button className="btn">Rebuild search index</button>
          </div>
        </Card>

        <Card title="Logs">
          <div className="flex items-center gap-2 mb-3">
            <select value={logMode} onChange={(e) => setLogMode(e.target.value)} className="text-sm">
              <option value="info">Info</option>
              <option value="debug">Debug</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div className="h-40 overflow-y-auto text-xs font-mono text-muted-foreground p-2 bg-surface-muted rounded">No logs in this environment</div>
        </Card>

        <Card title="Integrations">
          <div className="text-sm text-muted-foreground">Manage API keys and integration connectors. Use caution — these are powerful tools.</div>
        </Card>
      </div>
    </div>
  );
}
