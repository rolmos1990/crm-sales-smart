"use client";

import { useState } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

interface DataTableProps<TData, TValue> {
  columnas: ColumnDef<TData, TValue>[];
  datos: TData[];
  filtroPor?: string;
  placeholderFiltro?: string;
  /** Si se pasa, muestra el selector "Filas por página" con estas opciones (la primera es la inicial). */
  opcionesTamanoPagina?: number[];
}

export function DataTable<TData, TValue>({
  columnas,
  datos,
  filtroPor,
  placeholderFiltro = "Buscar...",
  opcionesTamanoPagina,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const table = useReactTable({
    data: datos,
    columns: columnas,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: { sorting, columnFilters, columnVisibility },
    initialState: { pagination: { pageSize: opcionesTamanoPagina?.[0] ?? 20 } },
  });

  return (
    <div className="space-y-4">
      {filtroPor && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholderFiltro}
            value={(table.getColumn(filtroPor)?.getFilterValue() as string) ?? ""}
            onChange={(e) => table.getColumn(filtroPor)?.setFilterValue(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
      )}

      <div className="rounded-xl border border-card-border overflow-hidden shadow-sm bg-card dark:backdrop-blur-xl dark:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.4)]">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-card-border bg-muted hover:bg-muted"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-muted-foreground font-semibold text-xs uppercase tracking-wide"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-card-divider hover:bg-card-hover transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columnas.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Sin resultados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} registro(s)
        </p>
        <div className="flex items-center gap-2">
          {opcionesTamanoPagina && (
            <div className="mr-2 hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
              Filas por página
              <Select
                items={Object.fromEntries(opcionesTamanoPagina.map((n) => [String(n), String(n)]))}
                value={String(table.getState().pagination.pageSize)}
                onValueChange={(v) => v && table.setPageSize(Number(v))}
              >
                <SelectTrigger size="sm" aria-label="Filas por página" className="w-18">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {opcionesTamanoPagina.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
