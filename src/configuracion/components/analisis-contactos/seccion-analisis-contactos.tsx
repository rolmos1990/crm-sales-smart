import type { ConfiguracionAnalisis } from "@/crm/contactos/analisis/configuracion/schema";
import { obtenerCriterioParaEdicion } from "@/crm/contactos/analisis/criterio/queries";
import { obtenerAvanceAnalisis } from "@/crm/contactos/analisis/queries";
import { InterruptoresAnalisis } from "./interruptores-analisis";
import { EditorCriterio } from "./editor-criterio";
import { PanelAvance } from "./panel-avance";
import { FormConfiguracionAnalisis } from "./form-configuracion-analisis";

/**
 * 042 — Sección "Análisis de contactos" de Configuración → IA. Server
 * Component: compone los interruptores (FR-030a), el avance (Historia 6), el
 * criterio de la cuenta (Historia 3) y los parámetros (Historia 6).
 */
export async function SeccionAnalisisContactos({
  instanciaId,
  configuracion,
}: {
  instanciaId: string;
  configuracion: ConfiguracionAnalisis;
}) {
  const [criterio, avance] = await Promise.all([obtenerCriterioParaEdicion(instanciaId), obtenerAvanceAnalisis(instanciaId)]);
  return (
    <div className="flex flex-col gap-4">
      <InterruptoresAnalisis inicial={{ habilitado: configuracion.habilitado, historicoPausado: configuracion.historicoPausado }} />
      <PanelAvance avance={avance} />
      <EditorCriterio criterio={criterio} />
      <FormConfiguracionAnalisis inicial={configuracion} />
    </div>
  );
}
