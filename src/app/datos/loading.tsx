import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPageHeader } from "@/shared/ui/skeletons-pagina";

export default function LoadingDatos() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <SkeletonPageHeader conAccion={false} />

      {/* Pasos del wizard */}
      <div className="flex items-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-1 items-center gap-2">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-3.5 flex-1 max-w-28" />
          </div>
        ))}
      </div>

      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
