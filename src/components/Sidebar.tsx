import React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  FileText,
  Heart,
  Megaphone,
  ShoppingCart,
  CreditCard,
  Bot,
  BarChart2,
  TrendingUp,
  Activity,
  Zap,
  Globe,
  Settings,
} from "lucide-react";
import {
  Sidebar as UISidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const groups = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Merchants",
    items: [
      { to: "/merchants/communication", label: "Messaging", icon: Megaphone },
      { to: "/merchants", label: "All Merchants", icon: Users },
      { to: "/merchants/applications", label: "Merchant Applications", icon: FileText },
      { to: "/merchants/success", label: "Merchant Success", icon: Heart },
    ],
  },
  {
    label: "Commerce",
    items: [
      { to: "/orders", label: "Orders", icon: ShoppingCart },
      { to: "/payments", label: "Payments", icon: CreditCard },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { to: "/ai", label: "AI & Agents", icon: Bot },
      { to: "/features", label: "Feature Usage", icon: BarChart2 },
      { to: "/retention", label: "Retention", icon: TrendingUp },
    ],
  },
  {
    label: "Platform",
    items: [
      { to: "/system", label: "System Health", icon: Activity },
      { to: "/api-monitor", label: "API Monitor", icon: Zap },
      { to: "/network-domains", label: "Network & Domains", icon: Globe },
    ],
  },
  {
    label: "Settings",
    items: [{ to: "/settings", label: "Settings", icon: Settings }],
  },
];

const allNavRoutes = groups.flatMap((g) => g.items.map((i) => i.to));

function normalizePath(p: string) {
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
  return p;
}

function isNavActive(currentPath: string, to: string) {
  const path = normalizePath(currentPath);
  const route = normalizePath(to);

  const matches = allNavRoutes.filter((candidate) => {
    const target = normalizePath(candidate);
    if (target === "/") return path === "/";
    return path === target || path.startsWith(`${target}/`);
  });

  matches.sort((a, b) => normalizePath(b).length - normalizePath(a).length);
  return normalizePath(matches[0] ?? "") === route;
}

export function Sidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <UISidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-6 py-4 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary font-bold text-primary-foreground">
            S
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="text-sm font-semibold text-white">Seltra Ops</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-sidebar-muted">Internal</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 overflow-y-auto py-2">
        {groups.map((g) => (
          <SidebarGroup key={g.label} className="mb-1 p-0">
            <SidebarGroupLabel className="mb-0.5 h-6 px-6 font-mono text-[10px] uppercase tracking-widest text-slate-400 dark:text-sidebar-muted">
              {g.label}
            </SidebarGroupLabel>
            <SidebarMenu>
              {g.items.map((it) => {
                const active = isNavActive(path, it.to);
                return (
                  <SidebarMenuItem key={it.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={it.label}
                      className="group mx-2 h-9 rounded-lg px-4 transition-colors duration-200 ease-out hover:bg-sidebar-active-bg hover:text-white data-[active=true]:bg-sidebar-active-bg data-[active=true]:font-medium data-[active=true]:text-sidebar-active group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:px-2"
                    >
                      <Link to={it.to} preload="intent" className="cursor-pointer">
                        <it.icon className="h-4 w-4 pointer-events-none dark:text-slate-300 dark:group-hover:text-white" />
                        <span className="group-data-[collapsible=icon]:hidden">{it.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-6 py-3 group-data-[collapsible=icon]:px-2">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <SidebarTrigger />
          <div className="text-xs text-sidebar-muted group-data-[collapsible=icon]:hidden">Toggle sidebar</div>
        </div>
      </SidebarFooter>
    </UISidebar>
  );
}

export default Sidebar;
