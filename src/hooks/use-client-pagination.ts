import { useEffect, useMemo, useState } from "react";
import { DEFAULT_PAGE_SIZE, paginateSlice } from "@/lib/pagination";

type Options = {
  pageSize?: number;
  /** When any value changes, reset to page 1 (e.g. search filters). */
  resetDeps?: readonly unknown[];
};

export function useClientPagination<T>(items: readonly T[], options?: Options) {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const [page, setPage] = useState(1);
  const resetKey = JSON.stringify(options?.resetDeps ?? []);

  useEffect(() => {
    setPage(1);
  }, [resetKey, items.length]);

  const slice = useMemo(() => paginateSlice(items, page, pageSize), [items, page, pageSize]);

  useEffect(() => {
    if (page !== slice.page) setPage(slice.page);
  }, [page, slice.page]);

  return {
    page: slice.page,
    setPage,
    pageItems: slice.pageItems,
    totalPages: slice.totalPages,
    totalItems: slice.totalItems,
    pageSize: slice.pageSize,
  };
}
