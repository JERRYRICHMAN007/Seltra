import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/settings/")({
  head: () => ({ meta: [{ title: "Settings — Seltra Ops" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => (await supabase.from("platform_settings").select("id,site_name,support_email").limit(1)).data ?? [],
  });

  const row = Array.isArray(data) && data.length ? (data as any[])[0] : {};
  const [siteName, setSiteName] = useState<string>(row.site_name ?? "");
  const [supportEmail, setSupportEmail] = useState<string>(row.support_email ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await supabase.from("platform_settings").upsert({ id: row.id ?? undefined, site_name: siteName, support_email: supportEmail });
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Platform configuration" />

      <Card title="Platform">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-mono text-muted-foreground">Site name</label>
            <input className="w-full mt-1 p-2 rounded border border-border" value={siteName} onChange={(e)=>setSiteName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground">Support email</label>
            <input className="w-full mt-1 p-2 rounded border border-border" value={supportEmail} onChange={(e)=>setSupportEmail(e.target.value)} />
          </div>
          <div>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
