import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonKanban, SkeletonPageHeader } from "@/shared/ui/skeletons-pagina";

export default function LoadingPreparacion() {
  return (
    <div className="space-y-6 p-6">
      <SkeletonPageHeader />

      {/* Pestañas de rango + buscador + selector de vista */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Skeleton className="h-11 w-full max-w-md rounded-xl" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-72 rounded-lg" />
          <Skeleton className="h-11 w-36 rounded-xl" />
        </div>
      </div>

      <SkeletonKanban columnas={4} tarjetas={2} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  );
}
