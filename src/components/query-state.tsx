import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui-bits";

type QueryStateProps = {
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  loadingFallback?: ReactNode;
  children: ReactNode;
};

export function QueryState({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyMessage = "No data found.",
  loadingFallback,
  children,
}: QueryStateProps) {
  if (isLoading) {
    return <>{loadingFallback ?? <DefaultLoading />}</>;
  }
  if (isError) {
    return (
      <Card>
        <div className="text-sm text-destructive">
          {error?.message ?? "Something went wrong loading this data."}
        </div>
      </Card>
    );
  }
  if (isEmpty) {
    return (
      <Card>
        <div className="text-sm text-muted-foreground text-center py-8">{emptyMessage}</div>
      </Card>
    );
  }
  return <>{children}</>;
}

export function MetricCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-${Math.min(count, 4)} gap-4`} style={{ gridTemplateColumns: `repeat(${Math.min(count, 4)}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card rounded-xl p-5 shadow-card space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function DataTableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = "h-64" }: { height?: string }) {
  return <Skeleton className={`w-full ${height}`} />;
}

function DefaultLoading() {
  return (
    <div className="space-y-4">
      <MetricCardSkeleton />
      <DataTableSkeleton />
    </div>
  );
}
