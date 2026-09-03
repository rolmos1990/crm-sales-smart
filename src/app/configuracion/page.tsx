import { redirect } from "next/navigation";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { PageHeader } from "@/shared/ui/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TabEmpresa } from "@/configuracion/components/tab-empresa";
import { TabPreferencias } from "@/configuracion/components/tab-preferencias";
import { TabUsuarios } from "@/configuracion/components/tab-usuarios";
import { TabPlantillas } from "@/configuracion/components/tab-plantillas";
import { TabPlan } from "@/configuracion/components/tab-plan";
import { TabSeguridad } from "@/configuracion/components/tab-seguridad";
import { TabIA } from "@/configuracion/components/tab-ia";
import { TabEnvios } from "@/configuracion/components/tab-envios";
import { obtenerConfiguracionEmpresa } from "@/configuracion/empresa/queries";
import { obtenerPlantillas } from "@/configuracion/plantillas/queries";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const sesion = await requireSesion();

  const { permitido } = verificarAcceso(sesion, "configuracion", "ver");
  if (!permitido) redirect("/acceso-denegado");

  const [configEmpresa, plantillas] = await Promise.all([
    obtenerConfiguracionEmpresa(sesion.instanciaId),
    obtenerPlantillas(sesion.instanciaId),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        titulo="Configuración"
        descripcion="Administra los datos de tu empresa, usuarios, plantillas y seguridad del sistema."
      />

      <Tabs defaultValue="empresa">
        <TabsList variant="line" className="border-b border-stone-200 dark:border-white/8 w-full justify-start rounded-none pb-0 h-auto gap-0">
          {[
            { value: "empresa", etiqueta: "Empresa" },
            { value: "preferencias", etiqueta: "Preferencias" },
            { value: "usuarios", etiqueta: "Usuarios / Agentes" },
            { value: "plantillas", etiqueta: "Plantillas" },
            { value: "plan", etiqueta: "Plan y Facturación" },
            { value: "seguridad", etiqueta: "Seguridad" },
            { value: "ia", etiqueta: "Inteligencia Artificial" },
            { value: "envios", etiqueta: "Envíos" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none px-4 py-2.5 text-sm border-b-2 border-transparent data-active:border-lime-500 dark:data-active:border-lime-400 data-active:text-stone-900 dark:data-active:text-stone-50 text-stone-500 dark:text-stone-400"
            >
              {tab.etiqueta}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="pt-6">
          <TabsContent value="empresa">
            <TabEmpresa instanciaId={sesion.instanciaId} inicial={configEmpresa} />
          </TabsContent>

          <TabsContent value="preferencias">
            <TabPreferencias />
          </TabsContent>

          <TabsContent value="usuarios">
            <TabUsuarios instanciaId={sesion.instanciaId} />
          </TabsContent>

          <TabsContent value="plantillas">
            <TabPlantillas plantillas={plantillas} instanciaId={sesion.instanciaId} />
          </TabsContent>

          <TabsContent value="plan">
            <TabPlan />
          </TabsContent>

          <TabsContent value="seguridad">
            <TabSeguridad />
          </TabsContent>

          <TabsContent value="ia">
            <TabIA instanciaId={sesion.instanciaId} />
          </TabsContent>

          <TabsContent value="envios">
            <TabEnvios instanciaId={sesion.instanciaId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
