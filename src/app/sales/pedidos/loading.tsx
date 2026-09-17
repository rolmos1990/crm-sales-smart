import { SkeletonFiltros, SkeletonKpiCards, SkeletonPageHeader, SkeletonTabla } from "@/shared/ui/skeletons-pagina";

export default function LoadingPedidos() {
  return (
    <div className="space-y-6 p-6">
      <SkeletonPageHeader />
      <SkeletonFiltros filtros={4} />
      <SkeletonKpiCards />
      <SkeletonTabla filas={8} columnas={7} />
    </div>
  );
}
