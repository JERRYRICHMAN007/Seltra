export const DEFAULT_PAGE_SIZE = 10;

export function paginateSlice<T>(items: readonly T[], page: number, pageSize: number) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return { pageItems, totalPages, totalItems, page: safePage, pageSize };
}

/** Page numbers with ellipsis for compact pagination controls. */
export function getVisiblePageNumbers(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 1) return total === 1 ? [1] : [];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: Array<number | "ellipsis"> = [1];

  if (current > 3) pages.push("ellipsis");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let p = start; p <= end; p += 1) {
    pages.push(p);
  }

  if (current < total - 2) pages.push("ellipsis");

  pages.push(total);
  return pages;
}
