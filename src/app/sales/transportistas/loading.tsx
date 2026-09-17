import { SkeletonListaFilas, SkeletonPageHeader } from "@/shared/ui/skeletons-pagina";

export default function LoadingTransportistas() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <SkeletonPageHeader />
      <SkeletonListaFilas filas={5} />
    </div>
  );
}
