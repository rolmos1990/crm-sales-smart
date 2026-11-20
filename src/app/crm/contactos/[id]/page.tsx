import { notFound, redirect } from "next/navigation";
import { obtenerContactoPorId, obtenerUmbralesSeguimiento } from "@/crm/contactos/queries";
import { obtenerResumenContacto, type ResumenContacto } from "@/crm/contactos/resumen";
import { calcularCortes } from "@/crm/contactos/segmentacion/cortes";
import { obtenerActividadesPorContacto } from "@/crm/actividades/queries";
import { obtenerTags } from "@/crm/tags/queries";
import { buscarEmpresas } from "@/crm/empresas/queries";
import { obtenerConversacionesResumenPorContacto, obtenerCuentasCanal } from "@/conversaciones/queries";
import { obtenerEtapasFlujoActivo } from "@/sales/flujo-venta/queries";
import { requireSesion } from "@/shared/auth/sesion";
import { puedeModificar, verificarAcceso } from "@/shared/auth/permisos";
import { PanelConversacion } from "@/conversaciones/components/panel-conversacion";
import { FichaContacto, type OportunidadFicha } from "@/crm/contactos/components/ficha-contacto";
import { obtenerPerfil } from "@/ai/perfil-cliente/servicio";
import type { PerfilCliente } from "@/ai/perfil-cliente/tipos";

async function cargarResumen(id: string, instanciaId: string, zonaNegocio: string): Promise<ResumenContacto | null> {
  const [etapas, umbrales] = await Promise.all([
    obtenerEtapasFlujoActivo(instanciaId),
    obtenerUmbralesSeguimiento(instanciaId),
  ]);
  return obtenerResumenContacto(id, instanciaId, etapas, calcularCortes(zonaNegocio, umbrales));
}

export default async function ContactoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "contactos", "ver").permitido) redirect("/acceso-denegado");
  const puedeMod = puedeModificar(sesion.rol, "contactos");
  const puedeModOportunidades = puedeModificar(sesion.rol, "oportunidades");

  const [contacto, actividades, todosLosTags] = await Promise.all([
    obtenerContactoPorId(id, sesion.instanciaId),
    obtenerActividadesPorContacto(id, sesion.instanciaId),
    obtenerTags(sesion.instanciaId),
  ]);

  // 043 — "no existe" solo puede venir de una lectura exitosa sin fila. Antes,
  // un fallo de lectura dejaba `contacto` en null y caía acá: un 404 sobre un
  // contacto que sí existía.
  if (!contacto) notFound();

  // Ninguna de estas secciones bloquea el render si falla (FR-004 de 012).
  const [conversacionesR, cuentasR, resumenR, perfilR, empresasR] = await Promise.allSettled([
    obtenerConversacionesResumenPorContacto(id, sesion.instanciaId),
    obtenerCuentasCanal(sesion.instanciaId),
    cargarResumen(id, sesion.instanciaId, sesion.zonaNegocio),
    obtenerPerfil(id, sesion.instanciaId),
    puedeMod ? buscarEmpresas("", sesion.instanciaId) : Promise.resolve([]),
  ]);
  const conversaciones = conversacionesR.status === "fulfilled" ? conversacionesR.value : [];
  const cuentasCanal = cuentasR.status === "fulfilled" ? cuentasR.value : [];
  const resumen = resumenR.status === "fulfilled" ? resumenR.value : null;
  const perfilCliente: PerfilCliente | null = perfilR.status === "fulfilled" ? perfilR.value : null;
  const empresas = empresasR.status === "fulfilled" ? empresasR.value.map((e) => ({ id: e.id, nombre: e.nombre })) : [];
  if (resumenR.status === "rejected") console.error("[ContactoDetallePage] resumen", resumenR.reason);

  const nombreCompleto = `${contacto.nombre} ${contacto.apellido}`.trim();
  const oportunidades: OportunidadFicha[] = contacto.oportunidades.map(({ oportunidad: o }) => ({
    id: o.id,
    titulo: o.titulo,
    etapa: o.etapa,
    valor: Number(o.valor),
    moneda: o.moneda,
    creadoEn: o.creadoEn,
    pipelineId: o.pipelineId,
    stageId: o.stageId,
    stage: o.stage,
  }));

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      <div className="w-[400px] shrink-0 flex flex-col">
        <PanelConversacion
          oportunidadId=""
          contactoId={id}
          nombreContacto={nombreCompleto}
          telefonoContacto={contacto.telefonoPrincipal}
          cuentas={cuentasCanal}
          conversacionesIniciales={conversaciones}
          puedeMod={puedeMod}
          hrefVolver="/crm/contactos"
          avatarUrl={contacto.avatarUrl}
        />
      </div>

      <div className="flex-1 overflow-y-auto bg-background">
        <div className="mx-auto max-w-5xl p-6">
          <FichaContacto
            contacto={{
              id: contacto.id,
              nombre: contacto.nombre,
              apellido: contacto.apellido,
              email: contacto.email,
              telefonoPrincipal: contacto.telefonoPrincipal,
              telefonoSecundario: contacto.telefonoSecundario,
              cargo: contacto.cargo,
              empresa: contacto.empresa,
              notas: contacto.notas,
              creadoEn: contacto.creadoEn,
            }}
            resumen={resumen}
            oportunidades={oportunidades}
            actividades={actividades}
            tagIdsActuales={contacto.tags.map((t) => t.tagId)}
            todosLosTags={todosLosTags}
            perfil={perfilCliente}
            puedeMod={puedeMod}
            puedeModOportunidades={puedeModOportunidades}
            empresas={empresas}
          />
        </div>
      </div>
    </div>
  );
}
