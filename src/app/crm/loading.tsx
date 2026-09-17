import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonKpiCards } from "@/shared/ui/skeletons-pagina";

export default function LoadingDashboard() {
  return (
    <div className="flex max-w-screen-xl flex-col gap-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>

      <SkeletonKpiCards />

      {/* Últimas oportunidades + Actividades de hoy */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-6 w-20 rounded-lg" />
            </div>
            <div className="space-y-1 p-3">
              {[0, 1, 2, 3].map((f) => (
                <div key={f} className="flex items-center justify-between px-3 py-2.5">
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div>
        <Skeleton className="mb-3 h-3 w-28" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
