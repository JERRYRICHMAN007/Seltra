import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getVisiblePageNumbers } from "@/lib/pagination";

export type ListPaginationProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  className?: string;
  compact?: boolean;
  /** For dark overlays (e.g. globe country card). */
  tone?: "default" | "dark";
};

export function ListPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = "items",
  className,
  compact = false,
  tone = "default",
}: ListPaginationProps) {
  if (totalItems === 0) return null;
  if (totalPages <= 1 && totalItems <= pageSize) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const pages = getVisiblePageNumbers(page, totalPages);
  const btnSize = compact ? "sm" : "default";
  const isDark = tone === "dark";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between",
        isDark ? "border-white/10" : "border-border",
        className,
      )}
    >
      <p
        className={cn(
          compact ? "text-[11px]" : "text-xs",
          isDark ? "text-white/55" : "text-muted-foreground",
        )}
      >
        Showing {start}–{end} of {totalItems} {itemLabel}
      </p>

      <nav aria-label="Pagination" className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size={btnSize}
          className={cn("gap-1", compact && "h-8 px-2 text-xs")}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          {!compact && <span>Previous</span>}
        </Button>

        <div className="flex items-center gap-0.5">
          {pages.map((p, i) =>
            p === "ellipsis" ? (
              <span
                key={`ellipsis-${i}`}
                className={cn(
                  "flex h-8 w-8 items-center justify-center",
                  isDark ? "text-white/45" : "text-muted-foreground",
                )}
                aria-hidden
              >
                <MoreHorizontal className="h-4 w-4" />
              </span>
            ) : (
              <Button
                key={p}
                type="button"
                variant={p === page ? "secondary" : "ghost"}
                size="icon"
                className={cn(
                  "h-8 w-8 text-xs font-medium",
                  p === page && "pointer-events-none",
                  isDark && p !== page && "text-white/80 hover:bg-white/10 hover:text-white",
                )}
                aria-current={p === page ? "page" : undefined}
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            ),
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size={btnSize}
          className={cn("gap-1", compact && "h-8 px-2 text-xs")}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {!compact && <span>Next</span>}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </nav>
    </div>
  );
}
