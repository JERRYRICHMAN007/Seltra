import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";

export const Route = createFileRoute("/_app/settings/team")({
  head: () => ({ meta: [{ title: "Team — Seltra Ops" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { data: members = [] } = useQuery({
    queryKey: ["ops-users"],
    queryFn: async () => (await supabase.from("ops_users").select("id,name,email,role,last_login_at,created_at").order("name", { ascending: true })).data ?? [],
  });

  const admins = (members ?? []).filter((m:any) => m.role === 'admin');

  return (
    <div className="space-y-6">
      <PageHeader title="Team" subtitle="Ops users with access to Seltra Ops" action={<Button>Add member</Button>} />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Last active</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.length ? admins.map((m:any)=> (
                <tr key={m.id} className="border-b border-border hover:bg-surface-muted/50">
                  <td className="py-3 pr-4">{m.name ?? m.email}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{m.email}</td>
                  <td className="py-3 pr-4">{m.role}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{timeAgo(m.last_login_at)}</td>
                  <td className="py-3 pr-4"><Button size="sm" variant="ghost">Edit</Button></td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">No admin users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
