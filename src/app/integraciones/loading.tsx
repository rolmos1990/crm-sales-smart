import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonGridCards } from "@/shared/ui/skeletons-pagina";

export default function LoadingIntegraciones() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-80" />
      </div>
      <SkeletonGridCards cantidad={6} alto="h-44" />
    </div>
  );
}
