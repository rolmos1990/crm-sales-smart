import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonListaFilas } from "@/shared/ui/skeletons-pagina";

export default function LoadingWorkflows() {
  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="mb-6 space-y-2">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-8 rounded-xl" />
          <Skeleton className="h-7 w-40" />
        </div>
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="mb-4 flex justify-between">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-36" />
      </div>
      <SkeletonListaFilas filas={5} />
    </div>
  );
}
