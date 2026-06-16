import { Settings2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { requireSesion } from "@/shared/auth/sesion";
import { obtenerFlujoVentaCompleto, inicializarFlujoVentaPorDefecto } from "@/sales/flujo-venta/queries";
import { PanelConfigEtapas } from "@/sales/flujo-venta/components/panel-config-etapas";
import { PanelConfigReglas } from "@/sales/flujo-venta/components/panel-config-reglas";

export default async function FlujoVentaPage() {
  const sesion = await requireSesion();
  let flujo = await obtenerFlujoVentaCompleto(sesion.instanciaId);

  // Si no existe flujo, crear uno por defecto con etapas iniciales
  if (!flujo) {
    await inicializarFlujoVentaPorDefecto(sesion.instanciaId);
    flujo = await obtenerFlujoVentaCompleto(sesion.instanciaId);
  }

  if (!flujo) {
    return <div className="p-6 text-sm text-muted-foreground">Error al cargar el flujo de venta.</div>;
  }

  const etapas = flujo.etapas ?? [];
  const todasLasReglas = etapas.flatMap((e: any) => e.reglas ?? []);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-lime-500/10 dark:bg-lime-400/10 p-2.5">
          <Settings2 className="h-5 w-5 text-lime-600 dark:text-lime-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-50">Flujo de Venta</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Configura las etapas y reglas de transición para tus pedidos.
          </p>
        </div>
      </div>

      <Tabs defaultValue="etapas">
        <TabsList variant="line" className="w-full justify-start border-b border-stone-200 dark:border-white/10 rounded-none pb-0 mb-1 h-auto gap-0">
          <TabsTrigger
            value="etapas"
            className="rounded-none px-4 py-2 text-sm font-medium border-b-2 border-transparent data-active:border-lime-500 dark:data-active:border-lime-400 data-active:text-stone-900 dark:data-active:text-stone-50"
          >
            Etapas
          </TabsTrigger>
          <TabsTrigger
            value="reglas"
            className="rounded-none px-4 py-2 text-sm font-medium border-b-2 border-transparent data-active:border-lime-500 dark:data-active:border-lime-400 data-active:text-stone-900 dark:data-active:text-stone-50"
          >
            Reglas de transición
          </TabsTrigger>
        </TabsList>

        <TabsContent value="etapas" className="pt-5">
          <PanelConfigEtapas flujoVentaId={flujo.id} etapasIniciales={etapas} />
        </TabsContent>

        <TabsContent value="reglas" className="pt-5">
          <PanelConfigReglas etapas={etapas} reglasIniciales={todasLasReglas} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
