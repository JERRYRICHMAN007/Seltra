import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell, Key, Shield, User, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader, Card, StatusBadge } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { shortDate } from "@/lib/format";
import { ListPagination } from "@/components/list-pagination";
import { useClientPagination } from "@/hooks/use-client-pagination";

export const Route = createFileRoute("/_app/settings/")({
  head: () => ({ meta: [{ title: "Settings — Seltra Ops" }] }),
  component: SettingsPage,
});

type Section = "profile" | "team" | "notifications" | "api-keys" | "security";

type TeamMember = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  created_at: string;
};

const sections: { id: Section; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "team", label: "Team", icon: Users },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "api-keys", label: "API Keys", icon: Key },
  { id: "security", label: "Security", icon: Shield },
];

function getInitials(name: string | null | undefined, email: string) {
  if (name?.trim()) {
    return name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function SettingsPage() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<Section>("profile");
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [notifications, setNotifications] = useState({
    newApplication: true,
    failedPayments: true,
    systemHealth: true,
    weeklySummary: false,
  });

  const { data: profile } = useQuery({
    queryKey: ["ops-user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("ops_users")
        .select("id, name, email, role, created_at")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: Boolean(user?.id),
  });

  useEffect(() => {
    setDisplayName(profile?.name ?? user?.email?.split("@")[0] ?? "");
  }, [profile?.name, user?.email]);

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["settings-team-members"],
    queryFn: async (): Promise<TeamMember[]> => {
      const profiles = await supabase
        .from("profiles")
        .select("id, full_name, email, role, created_at")
        .order("created_at", { ascending: true });

      if (!profiles.error && profiles.data?.length) {
        return profiles.data as TeamMember[];
      }

      const opsUsers = await supabase
        .from("ops_users")
        .select("id, name, email, role, created_at")
        .order("created_at", { ascending: true });

      return (opsUsers.data ?? []).map((member) => ({
        id: member.id,
        full_name: member.name,
        email: member.email,
        role: member.role,
        created_at: member.created_at,
      }));
    },
  });

  const role = profile?.role ?? "analyst";
  const email = user?.email ?? profile?.email ?? "—";
  const joinedAt = profile?.created_at ?? user?.created_at ?? null;

  const {
    page: teamPage,
    setPage: setTeamPage,
    pageItems: teamPageItems,
    totalPages: teamTotalPages,
    totalItems: teamTotalItems,
    pageSize: teamPageSize,
  } = useClientPagination(teamMembers, { pageSize: 8 });

  async function handleChangePassword() {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: window.location.origin,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password reset email sent");
  }

  function showComingSoon() {
    toast.info("Invite feature coming soon");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Manage your account and platform preferences" />

      <div className="flex gap-6 items-start">
        <nav className="w-[180px] shrink-0 space-y-1">
          {sections.map(({ id, label, icon: Icon }) => {
            const active = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSection(id)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-primary-soft text-primary font-medium"
                    : "text-muted-foreground hover:bg-surface-muted hover:text-navy"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex-1 min-w-0 space-y-4">
          {activeSection === "profile" && (
            <Card title="Profile">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                      {getInitials(displayName, email)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold text-navy">{displayName || email}</div>
                    <div className="text-sm text-muted-foreground">{email}</div>
                    <div className="mt-1">
                      <StatusBadge status={role} />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 max-w-md">
                  <div className="space-y-2">
                    <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Full name</Label>
                    {isEditingName ? (
                      <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                    ) : (
                      <div className="h-9 flex items-center px-3 rounded-md border border-border bg-surface-muted text-sm text-navy">
                        {displayName || "—"}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Email</Label>
                    <div className="h-9 flex items-center px-3 rounded-md border border-border bg-surface-muted text-sm text-muted-foreground">
                      {email}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Role</Label>
                    <div className="h-9 flex items-center px-3">
                      <StatusBadge status={role} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Joined</Label>
                    <div className="h-9 flex items-center px-3 rounded-md border border-border bg-surface-muted text-sm text-muted-foreground">
                      {shortDate(joinedAt)}
                    </div>
                  </div>
                </div>

                <Button variant="outline" onClick={() => setIsEditingName((v) => !v)}>
                  {isEditingName ? "Done" : "Edit name"}
                </Button>
              </div>
            </Card>
          )}

          {activeSection === "team" && (
            <Card
              title="Team"
              action={
                <Button variant="outline" onClick={showComingSoon}>
                  Invite
                </Button>
              }
            >
              <div className="space-y-3">
                {teamMembers.length ? (
                  teamPageItems.map((member) => {
                    const isCurrentUser = member.id === user?.id || member.email === user?.email;
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary-soft text-primary text-xs font-semibold">
                              {getInitials(member.full_name, member.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-medium text-navy truncate">
                              {member.full_name || member.email}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs text-muted-foreground font-normal">(you)</span>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">{member.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={member.role} />
                          {!isCurrentUser && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={showComingSoon}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">No team members found.</div>
                )}
                {teamMembers.length > 0 && (
                  <ListPagination
                    page={teamPage}
                    totalPages={teamTotalPages}
                    totalItems={teamTotalItems}
                    pageSize={teamPageSize}
                    onPageChange={setTeamPage}
                    itemLabel="members"
                    compact
                    className="pt-2"
                  />
                )}
              </div>
            </Card>
          )}

          {activeSection === "notifications" && (
            <Card title="Notifications">
              <div className="space-y-4">
                {[
                  {
                    key: "newApplication" as const,
                    label: "New merchant application",
                    description: "Get notified when a new waitlist application arrives.",
                  },
                  {
                    key: "failedPayments" as const,
                    label: "Failed payments",
                    description: "Alert when a payment fails across any merchant.",
                  },
                  {
                    key: "systemHealth" as const,
                    label: "System health alerts",
                    description: "Notify when a platform service is degraded or down.",
                  },
                  {
                    key: "weeklySummary" as const,
                    label: "Weekly summary email",
                    description: "Receive a weekly digest of platform activity.",
                  },
                ].map(({ key, label, description }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0"
                  >
                    <div>
                      <div className="text-sm font-medium text-navy">{label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
                    </div>
                    <Switch
                      checked={notifications[key]}
                      onCheckedChange={(checked) =>
                        setNotifications((prev) => ({ ...prev, [key]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeSection === "api-keys" && (
            <Card title="API Keys">
              <div className="space-y-4 max-w-lg">
                <p className="text-sm text-muted-foreground">
                  API keys are generated automatically during merchant onboarding. Each approved merchant
                  receives a unique key for integrating with the Seltra platform.
                </p>
                <div className="rounded-lg border border-border bg-surface-muted px-4 py-3">
                  <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
                    Example key format
                  </div>
                  <div className="font-mono text-sm text-navy">seltra_••••••••••••••••••••</div>
                </div>
                <Link to="/merchants/applications">
                  <Button variant="outline">Go to merchant applications</Button>
                </Link>
              </div>
            </Card>
          )}

          {activeSection === "security" && (
            <Card title="Security">
              <div className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Current email
                  </Label>
                  <div className="h-9 flex items-center px-3 rounded-md border border-border bg-surface-muted text-sm text-navy">
                    {email}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  We&apos;ll send a password reset link to your email address.
                </p>
                <Button variant="outline" onClick={handleChangePassword}>
                  Change password
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
