import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPageHeader } from "@/shared/ui/skeletons-pagina";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <SkeletonPageHeader conAccion={false} />
      {/* Estado de la conexión + credenciales del canal */}
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
    </div>
  );
}
