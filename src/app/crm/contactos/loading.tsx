import {
  SkeletonFiltros,
  SkeletonKpiCards,
  SkeletonPageHeader,
  SkeletonTabla,
  SkeletonTabs,
} from "@/shared/ui/skeletons-pagina";

export default function LoadingContactos() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <SkeletonPageHeader />
      <SkeletonKpiCards cantidad={5} />
      <SkeletonTabs cantidad={5} />
      <SkeletonFiltros filtros={4} />
      <SkeletonTabla filas={8} columnas={6} />
    </div>
  );
}
