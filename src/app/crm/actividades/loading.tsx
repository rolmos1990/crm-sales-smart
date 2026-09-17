import { SkeletonFiltros, SkeletonListaFilas, SkeletonPageHeader } from "@/shared/ui/skeletons-pagina";

export default function LoadingActividades() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <SkeletonPageHeader />
      <SkeletonFiltros filtros={2} />
      <SkeletonListaFilas filas={7} />
    </div>
  );
}
