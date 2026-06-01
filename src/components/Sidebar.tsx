import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, FileText, Heart, ShoppingCart, CreditCard, Bot, BarChart3, TrendingUp, Activity, Network, Wrench, UserCog, Settings } from "lucide-react";

const groups = [
  { label: "Overview", items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }] },
  { label: "Merchants", items: [
    { to: "/merchants", label: "All Merchants", icon: Users },
    { to: "/merchants/applications", label: "Applications", icon: FileText },
    { to: "/merchants/success", label: "Merchant Success", icon: Heart },
  ]},
  { label: "Commerce", items: [
    { to: "/orders", label: "Orders", icon: ShoppingCart },
    { to: "/payments", label: "Payments", icon: CreditCard },
  ]},
  { label: "Intelligence", items: [
    { to: "/ai", label: "AI & Agents", icon: Bot },
    { to: "/features", label: "Feature Usage", icon: BarChart3 },
    { to: "/retention", label: "Retention", icon: TrendingUp },
  ]},
  { label: "Platform", items: [
    { to: "/system", label: "System Health", icon: Activity },
    { to: "/api-monitor", label: "API Monitor", icon: Network },
    { to: "/developer", label: "Developer Tools", icon: Wrench },
  ]},
  { label: "Settings", items: [
    { to: "/settings/team", label: "Team", icon: UserCog },
    { to: "/settings", label: "Settings", icon: Settings },
  ]},
];

export function Sidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-screen sticky top-0">
      <div className="px-6 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary grid place-items-center text-primary-foreground font-bold">S</div>
          <div>
            <div className="text-sm font-semibold text-white">Seltra Ops</div>
            <div className="text-[10px] uppercase tracking-wider text-sidebar-muted font-mono">Internal</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        {groups.map((g) => (
          <div key={g.label} className="mb-5">
            <div className="px-6 mb-2 text-[10px] font-mono uppercase tracking-widest text-sidebar-muted">{g.label}</div>
            {g.items.map((it) => {
              const active = path === it.to || (it.to !== "/" && path.startsWith(it.to));
              return (
                <Link key={it.to} to={it.to}
                  className={`flex items-center gap-3 px-6 py-2 text-sm border-l-2 transition-colors ${
                    active
                      ? "border-primary bg-sidebar-active-bg text-white"
                      : "border-transparent text-sidebar-foreground hover:bg-sidebar-active-bg/40 hover:text-white"
                  }`}>
                  <it.icon className="h-4 w-4" />
                  <span>{it.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
