import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPageHeader, SkeletonTabs } from "@/shared/ui/skeletons-pagina";

export default function LoadingConfiguracion() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <SkeletonPageHeader conAccion={false} />
      <SkeletonTabs cantidad={5} />

      {/* Formulario de la pestaña activa */}
      <div className="max-w-3xl space-y-5 rounded-2xl border border-border bg-card p-5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
    </div>
  );
}
