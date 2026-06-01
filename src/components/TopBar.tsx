import { Bell, Search, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function TopBar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();
  return (
    <header className="h-14 bg-surface border-b border-border flex items-center px-6 gap-4 sticky top-0 z-20">
      <div className="flex-1 max-w-md relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search merchants, orders, events…"
          className="w-full h-9 pl-9 pr-3 rounded-md bg-surface-muted text-sm focus:outline-none focus:ring-2 focus:ring-ring border border-transparent focus:border-ring"
        />
      </div>
      <button className="relative h-9 w-9 grid place-items-center rounded-md hover:bg-surface-muted">
        <Bell className="h-4 w-4" />
        <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
      </button>
      <div className="flex items-center gap-3 pl-3 border-l border-border">
        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-semibold">{initials}</div>
        <div className="hidden md:block text-xs">
          <div className="font-medium text-foreground">{user?.email}</div>
          <div className="text-muted-foreground">Analyst</div>
        </div>
        <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
