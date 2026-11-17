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
    <div className="space-y-3">
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

      <div className="overflow-hidden rounded-xl border border-card-border bg-card shadow-sm dark:backdrop-blur-xl dark:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.4)]">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-card-border bg-surface-2 hover:bg-surface-2"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-11 px-4 text-xs font-semibold tracking-wide text-text-secondary uppercase"
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
                  className="border-card-divider transition-colors hover:bg-card-hover"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columnas.length}
                  className="h-24 px-4 text-center text-muted-foreground"
                >
                  Sin resultados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pie dentro del mismo recuadro: el conteo y la paginación hablan de
            la tabla que tienen encima, no son una fila suelta de la página. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-card-divider bg-surface-2 px-4 py-2">
          <p className="text-xs text-muted-foreground tabular-nums">
            {table.getFilteredRowModel().rows.length} registro(s)
          </p>
          <div className="ml-auto flex items-center gap-2">
            {opcionesTamanoPagina && (
              <div className="mr-1 hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
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
            <span className="text-xs text-muted-foreground tabular-nums">
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
    </div>
  );
}
