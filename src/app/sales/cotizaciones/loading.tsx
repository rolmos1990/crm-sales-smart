import { SkeletonFiltros, SkeletonPageHeader, SkeletonTabla } from "@/shared/ui/skeletons-pagina";

export default function LoadingCotizaciones() {
  return (
    <div className="space-y-6 p-6">
      <SkeletonPageHeader />
      <SkeletonFiltros filtros={3} />
      <SkeletonTabla filas={8} columnas={6} />
    </div>
  );
}
