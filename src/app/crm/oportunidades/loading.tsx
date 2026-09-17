import { SkeletonFiltros, SkeletonKpiCards, SkeletonPageHeader, SkeletonTabla } from "@/shared/ui/skeletons-pagina";

export default function LoadingOportunidades() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <SkeletonPageHeader />
      <SkeletonFiltros filtros={3} />
      <SkeletonKpiCards />
      <SkeletonTabla filas={8} columnas={6} />
    </div>
  );
}
