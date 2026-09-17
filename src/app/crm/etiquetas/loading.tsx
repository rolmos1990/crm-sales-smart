import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonListaFilas } from "@/shared/ui/skeletons-pagina";

export default function LoadingEtiquetas() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 space-y-2">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-8 rounded-xl" />
          <Skeleton className="h-7 w-40" />
        </div>
        <Skeleton className="h-4 w-64" />
      </div>
      <SkeletonListaFilas filas={6} />
    </div>
  );
}
