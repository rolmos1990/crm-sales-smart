import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Piezas de esqueleto para los `loading.tsx` de cada módulo.
 *
 * Next.js muestra el `loading.tsx` en cuanto se navega a la ruta, antes de que
 * el Server Component termine de resolver sus consultas. Con la base en otra
 * región eso son cientos de milisegundos en los que, sin esqueleto, la pantalla
 * se queda en la página anterior y la navegación se siente trabada.
 *
 * Cada esqueleto debe parecerse a lo que va a aparecer: si la silueta coincide,
 * el contenido "aterriza" en su lugar en vez de empujar el layout, que es lo que
 * hace que la espera se perciba más corta.
 */

/** Título + descripción, como el <PageHeader> real. */
export function SkeletonPageHeader({
  conAccion = true,
  className,
}: {
  conAccion?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-72" />
      </div>
      {conAccion && <Skeleton className="h-9 w-36 rounded-lg" />}
    </div>
  );
}

/** Grid de tarjetas KPI (mismo grid que usan pedidos, oportunidades y el dashboard). */
export function SkeletonKpiCards({ cantidad = 4 }: { cantidad?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

/** Barra de filtros + buscador. */
export function SkeletonFiltros({ filtros = 3 }: { filtros?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Skeleton className="h-9 w-64 rounded-lg" />
      {Array.from({ length: filtros }, (_, i) => (
        <Skeleton key={i} className="h-9 w-32 rounded-lg" />
      ))}
    </div>
  );
}

/** Tabla de listado: cabecera + filas. */
export function SkeletonTabla({ filas = 8, columnas = 5 }: { filas?: number; columnas?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-4 border-b border-border px-4 py-3">
        {Array.from({ length: columnas }, (_, i) => (
          <Skeleton key={i} className={cn("h-3.5", i === 0 ? "w-28" : "flex-1")} />
        ))}
      </div>
      {Array.from({ length: filas }, (_, f) => (
        <div key={f} className="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-0">
          {Array.from({ length: columnas }, (_, c) => (
            <Skeleton key={c} className={cn("h-4", c === 0 ? "w-28" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Tablero kanban: columnas con tarjetas. */
export function SkeletonKanban({ columnas = 4, tarjetas = 2 }: { columnas?: number; tarjetas?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: columnas }, (_, i) => (
        <div
          key={i}
          className="w-[19rem] shrink-0 space-y-2 rounded-2xl border border-border bg-muted/30 p-2.5"
        >
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: tarjetas }, (_, t) => (
            <Skeleton key={t} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Fila de pestañas. */
export function SkeletonTabs({ cantidad = 4 }: { cantidad?: number }) {
  return (
    <div className="flex gap-2 border-b border-border pb-2">
      {Array.from({ length: cantidad }, (_, i) => (
        <Skeleton key={i} className="h-8 w-28 rounded-lg" />
      ))}
    </div>
  );
}

/** Grid de tarjetas (productos, integraciones). */
export function SkeletonGridCards({
  cantidad = 6,
  alto = "h-36",
  columnas = "sm:grid-cols-2 lg:grid-cols-3",
}: {
  cantidad?: number;
  alto?: string;
  columnas?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-4", columnas)}>
      {Array.from({ length: cantidad }, (_, i) => (
        <Skeleton key={i} className={cn("w-full rounded-2xl", alto)} />
      ))}
    </div>
  );
}

/**
 * Página de detalle: volver + título + bloques de información.
 *
 * Existe porque un `loading.tsx` cubre también las sub-rutas del segmento: sin
 * esto, abrir el detalle de un pedido mostraría el esqueleto de la TABLA de
 * pedidos, y el contenido real aterrizaría en un layout distinto al anunciado.
 */
export function SkeletonDetalle({ bloques = 3 }: { bloques?: number }) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Skeleton className="h-4 w-32" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {Array.from({ length: bloques }, (_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

/** Formulario de alta/edición: título + campos + acciones. */
export function SkeletonFormulario({ campos = 7 }: { campos?: number }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <Skeleton className="h-4 w-32" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: campos }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** Lista simple de filas con avatar/ícono — etiquetas, actividades, panel lateral. */
export function SkeletonListaFilas({ filas = 6 }: { filas?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
