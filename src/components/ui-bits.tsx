import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function MetricCard({ label, value, delta, accent }: { label: string; value: ReactNode; delta?: string; accent?: "primary" | "warning" | "destructive" }) {
  const accentClass = accent === "warning" ? "text-warning" : accent === "destructive" ? "text-destructive" : "text-primary";
  return (
    <div className="bg-card rounded-xl p-5 shadow-card card-interactive">
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-foreground font-mono">{value}</div>
      {delta && <div className={`mt-1 text-xs ${accentClass}`}>{delta}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const map: Record<string, string> = {
    active: "bg-success-soft text-primary",
    paid: "bg-success-soft text-primary",
    success: "bg-success-soft text-primary",
    healthy: "bg-success-soft text-primary",
    approved: "bg-success-soft text-primary",
    paused: "bg-warning-soft text-warning",
    pending: "bg-warning-soft text-warning",
    degraded: "bg-warning-soft text-warning",
    reviewed: "bg-warning-soft text-warning",
    applied: "bg-accent text-accent-foreground",
    suspended: "bg-destructive-soft text-destructive",
    failed: "bg-destructive-soft text-destructive",
    down: "bg-destructive-soft text-destructive",
    rejected: "bg-destructive-soft text-destructive",
    cancelled: "bg-muted text-muted-foreground",
    churned: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium capitalize ${map[s] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}

export function Card({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`bg-card rounded-xl shadow-card card-interactive ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
