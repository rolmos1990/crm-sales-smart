import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonTabs } from "@/shared/ui/skeletons-pagina";

export default function LoadingFlujoVenta() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>

      <SkeletonTabs cantidad={3} />

      {/* Etapas arrastrables del flujo */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-56" />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3">
            <Skeleton className="size-4 shrink-0 rounded" />
            <Skeleton className="size-2.5 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1 max-w-56" />
            <Skeleton className="size-7 shrink-0 rounded-lg" />
            <Skeleton className="size-7 shrink-0 rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>
    </div>
  );
}
