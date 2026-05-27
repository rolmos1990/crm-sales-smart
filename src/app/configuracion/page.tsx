import { prisma } from "@/shared/db/prisma";
import { PageHeader } from "@/shared/ui/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TabEmpresa } from "@/configuracion/components/tab-empresa";
import { TabPreferencias } from "@/configuracion/components/tab-preferencias";
import { TabUsuarios } from "@/configuracion/components/tab-usuarios";
import { TabPlantillas } from "@/configuracion/components/tab-plantillas";
import { TabPlan } from "@/configuracion/components/tab-plan";
import { TabSeguridad } from "@/configuracion/components/tab-seguridad";
import { obtenerConfiguracionEmpresa } from "@/configuracion/empresa/queries";
import { obtenerPlantillas } from "@/configuracion/plantillas/queries";

export const dynamic = "force-dynamic";

async function obtenerOCrearInstancia() {
  const instancia = await prisma.instancia.findFirst();
  if (instancia) return instancia;

  return prisma.instancia.create({
    data: { nombre: "Mi Empresa", slug: "mi-empresa" },
  });
}

export default async function ConfiguracionPage() {
  const instancia = await obtenerOCrearInstancia();

  const [configEmpresa, plantillas] = await Promise.all([
    obtenerConfiguracionEmpresa(instancia.id),
    obtenerPlantillas(instancia.id),
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
            <TabEmpresa instanciaId={instancia.id} inicial={configEmpresa} />
          </TabsContent>

          <TabsContent value="preferencias">
            <TabPreferencias />
          </TabsContent>

          <TabsContent value="usuarios">
            <TabUsuarios />
          </TabsContent>

          <TabsContent value="plantillas">
            <TabPlantillas plantillas={plantillas} instanciaId={instancia.id} />
          </TabsContent>

          <TabsContent value="plan">
            <TabPlan />
          </TabsContent>

          <TabsContent value="seguridad">
            <TabSeguridad />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
