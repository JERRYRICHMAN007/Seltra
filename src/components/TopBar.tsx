import { Bell, LogOut, Moon, PanelLeft, Search, Sun } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useNavigate } from "@tanstack/react-router";
import { useSidebar } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

export function TopBar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  const { data: profile } = useQuery({
    queryKey: ["topbar-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("ops_users")
        .select("name, role")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: Boolean(user?.id),
  });

  let sidebarToggle: ReturnType<typeof useSidebar> | null = null;
  try {
    // useSidebar may throw if SidebarProvider is not mounted yet; guard it.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    sidebarToggle = useSidebar();
  } catch {
    sidebarToggle = null;
  }

  const displayName = profile?.name ?? user?.email?.split("@")[0] ?? "User";
  const role = profile?.role ?? "analyst";
  const { theme, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-20 flex h-[60px] shrink-0 items-center border-b border-border bg-surface/95 px-4 md:px-6 backdrop-blur supports-[backdrop-filter]:bg-surface/80 shadow-[0_1px_0_0_rgb(16_24_40/0.04),0_4px_12px_-6px_rgb(16_24_40/0.08)]">
      {/* Left: toggle + search */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          className="hidden shrink-0 md:grid place-items-center rounded-md p-1.5 text-slate-500 transition-colors hover:bg-muted hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          onClick={() => sidebarToggle?.toggleSidebar?.()}
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>

        <div className="relative w-full max-w-xl">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search merchants, orders, events…"
            className="h-10 w-full rounded-xl border border-border/60 bg-surface-muted/80 pl-10 pr-4 text-sm text-navy shadow-sm transition-all placeholder:text-muted-foreground focus:border-primary/30 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </div>
      </div>

      {/* Right: actions + profile — pinned to far end */}
      <div className="ml-4 flex shrink-0 items-center gap-2 md:gap-3">
        <button
          type="button"
          className="relative grid place-items-center rounded-md p-1.5 text-slate-500 transition-colors hover:bg-muted hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-surface" />
        </button>

        <button
          type="button"
          onClick={toggle}
          className="grid place-items-center rounded-md p-1.5 text-slate-500 transition-colors hover:bg-muted hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>

        <div className="hidden h-8 w-px bg-border md:block" />

        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-surface-muted/40 py-1.5 pl-1.5 pr-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
            {initials}
          </div>
          <div className="hidden min-w-0 md:block pr-1">
            <div className="truncate text-sm font-medium leading-tight text-navy">{displayName}</div>
            <div className="truncate text-[11px] leading-tight text-muted-foreground">{user?.email}</div>
          </div>
          <span className="hidden lg:inline-flex rounded-full border border-border bg-transparent px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
            {role}
          </span>
        </div>

        <button
          type="button"
          className="grid shrink-0 place-items-center rounded-md p-1.5 text-slate-500 transition-colors hover:bg-muted hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          onClick={async () => {
            await signOut();
            navigate({ to: "/login" });
          }}
          aria-label="Sign out"
        >
          <LogOut className="h-[18px] w-[18px]" />
        </button>
      </div>
    </header>
  );
}
