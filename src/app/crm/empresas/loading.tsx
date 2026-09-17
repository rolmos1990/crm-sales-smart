import { SkeletonFiltros, SkeletonPageHeader, SkeletonTabla } from "@/shared/ui/skeletons-pagina";

export default function LoadingEmpresas() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <SkeletonPageHeader />
      <SkeletonFiltros filtros={2} />
      <SkeletonTabla filas={8} columnas={4} />
    </div>
  );
}
