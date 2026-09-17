import { SkeletonFormulario } from "@/shared/ui/skeletons-pagina";

export default function Loading() {
  // Alta de pedido: datos del comprador + líneas de producto + totales.
  return <SkeletonFormulario campos={10} />;
}
