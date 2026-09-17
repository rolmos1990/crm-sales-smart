import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingInbox() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-6 pb-4 pt-5">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-8 w-40 rounded-lg" />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Lista de conversaciones */}
        <div className="w-full shrink-0 space-y-2 border-r border-border p-3 md:w-80">
          <Skeleton className="h-9 w-full rounded-lg" />
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl p-2.5">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>

        {/* Hilo */}
        <div className="hidden flex-1 flex-col justify-end gap-3 p-6 md:flex">
          <Skeleton className="h-16 w-2/3 rounded-2xl" />
          <Skeleton className="h-12 w-1/2 self-end rounded-2xl" />
          <Skeleton className="h-20 w-3/5 rounded-2xl" />
          <Skeleton className="h-12 w-2/5 self-end rounded-2xl" />
          <Skeleton className="mt-2 h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
