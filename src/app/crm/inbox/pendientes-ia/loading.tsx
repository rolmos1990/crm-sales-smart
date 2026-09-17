import { SkeletonListaFilas, SkeletonPageHeader } from "@/shared/ui/skeletons-pagina";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <SkeletonPageHeader conAccion={false} />
      <SkeletonListaFilas filas={5} />
    </div>
  );
}
