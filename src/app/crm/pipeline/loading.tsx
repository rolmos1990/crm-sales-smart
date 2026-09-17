import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonKanban } from "@/shared/ui/skeletons-pagina";

export default function LoadingPipeline() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-8 w-48 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>

      <SkeletonKanban columnas={5} tarjetas={3} />
    </div>
  );
}
