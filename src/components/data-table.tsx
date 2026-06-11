import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
};

export function DataTable<T>({ columns, data, rowKey, emptyMessage = "No rows to display." }: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">{emptyMessage}</div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          {columns.map((col) => (
            <TableHead
              key={col.key}
              className={`py-2 pr-4 text-xs font-mono uppercase tracking-wider text-muted-foreground ${col.headerClassName ?? ""}`}
            >
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={rowKey(row)} className="border-border hover:bg-surface-muted/50">
            {columns.map((col) => (
              <TableCell key={col.key} className={`py-3 pr-4 ${col.className ?? ""}`}>
                {col.cell(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
