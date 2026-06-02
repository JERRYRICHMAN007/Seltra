import React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, FileText, Heart, ShoppingCart, CreditCard, Bot, BarChart3, TrendingUp, Activity, Network, Wrench, UserCog, Settings } from "lucide-react";
import {
  SidebarProvider,
  Sidebar as UISidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
} from "@/components/ui/sidebar";

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
    <UISidebar collapsible="offcanvas">
        <SidebarHeader className="px-6 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary grid place-items-center text-primary-foreground font-bold">S</div>
            <div>
              <div className="text-sm font-semibold text-white">Seltra Ops</div>
              <div className="text-[10px] uppercase tracking-wider text-sidebar-muted font-mono">Internal</div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          {groups.map((g) => (
            <SidebarGroup key={g.label} className="mb-5">
              <SidebarGroupLabel className="px-6 mb-2 text-[10px] font-mono uppercase tracking-widest text-sidebar-muted">{g.label}</SidebarGroupLabel>
              <SidebarMenu>
                {g.items.map((it) => {
                  const active = path === it.to || (it.to !== "/" && path.startsWith(it.to));
                  return (
                    <li key={it.to}>
                      <Link to={it.to} className={`block`}>
                        <SidebarMenuButton isActive={active} className="px-6">
                          <it.icon className="h-4 w-4" />
                          <span>{it.label}</span>
                        </SidebarMenuButton>
                      </Link>
                    </li>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="px-6 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div className="text-xs text-sidebar-muted">Toggle sidebar</div>
          </div>
        </SidebarFooter>
      </UISidebar>
  );
}

export default Sidebar;
