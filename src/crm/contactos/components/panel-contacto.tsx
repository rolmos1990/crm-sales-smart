"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarPlus,
  ExternalLink,
  History,
  Mail,
  MessageSquare,
  Phone,
  Sparkles,
  Target,
  User,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { ButtonLink } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { FechaHora } from "@/shared/fechas/fecha-hora";
import { useSesion } from "@/shared/auth/sesion-context";
import { queryKeys } from "@/shared/query-keys";
import { obtenerResumenContactoAction } from "../actions";
import { ETIQUETA_GRUPO_CANAL, grupoDeCanal } from "../segmentacion/canales";
import { AvatarContacto } from "./avatar-contacto";
import { ControlClasificacion } from "./control-clasificacion";
import { SeccionAnalisisIA } from "../analisis/components/seccion-analisis-ia";
import { ETIQUETA_SEGUIMIENTO } from "./contactos-filtros";
import { ETIQUETA_INTERES, InsigniaInteres, InsigniaNoContactar, InsigniaRecomendacion, InsigniaTipo } from "./insignias-contacto";

const ETIQUETA_ORIGEN = { MANUAL: "manual", REGLA: "regla", IA: "IA" } as const;

function Seccion({ titulo, Icono, children }: { titulo: string; Icono: typeof User; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icono className="size-4 text-muted-foreground" aria-hidden />
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{etiqueta}</span>
      <span className="min-w-0 text-right text-foreground">{children}</span>
    </div>
  );
}

function valorHistorial(dimension: "INTERES" | "PREFERENCIA_CONTACTO", valor: string | null) {
  if (!valor) return "—";
  if (dimension === "INTERES") return ETIQUETA_INTERES[valor as keyof typeof ETIQUETA_INTERES] ?? valor;
  return valor === "NO_CONTACTAR" ? "No contactar" : "Contactable";
}

/**
 * 041 — Panel lateral de un contacto. Se abre sobre la lista sin tocar sus
 * filtros ni su página; la ficha completa sigue existiendo y se enlaza desde
 * acá.
 */
export function PanelContacto({ contactoId, onCerrar }: { contactoId: string | null; onCerrar: () => void }) {
  const { puedeModificar } = useSesion();
  const puedeMod = puedeModificar("contactos");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.contactos.resumen(contactoId ?? ""),
    queryFn: () => obtenerResumenContactoAction(contactoId!),
    enabled: Boolean(contactoId),
    // 042 — mientras corre un "Analizar con IA", se consulta hasta que termine (FR-051).
    refetchInterval: (q) => (q.state.data?.ok && q.state.data.resumen.analisis.analizandoAhora ? 3000 : false),
  });

  // Contacto eliminado o ajeno mientras el panel estaba abierto.
  useEffect(() => {
    if (data && !data.ok) {
      toast.error(data.error);
      onCerrar();
      void queryClient.invalidateQueries({ queryKey: queryKeys.contactos.vista() });
    }
  }, [data, onCerrar, queryClient]);

  const resumen = data?.ok ? data.resumen : null;
  const c = resumen?.contacto;
  const nombre = c ? [c.nombre, c.apellido].filter(Boolean).join(" ") || "Sin nombre" : "";

  return (
    <Sheet open={Boolean(contactoId)} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-md">
        {isLoading || !resumen || !c ? (
          <div className="flex flex-col gap-4 p-6">
            <SheetHeader className="p-0">
              <SheetTitle>Cargando contacto…</SheetTitle>
            </SheetHeader>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="flex-row items-center gap-3 border-b border-border-subtle p-5 pr-12">
              <AvatarContacto nombre={c.nombre} apellido={c.apellido} avatarUrl={c.avatarUrl} size="md" />
              <div className="min-w-0">
                <SheetTitle className="truncate">{nombre}</SheetTitle>
                <SheetDescription className="mt-1 flex flex-wrap items-center gap-1">
                  <InsigniaTipo tipo={c.tipo} />
                  <InsigniaInteres interes={c.interes} fijado={c.interesFijado} />
                  {c.noContactar && <InsigniaNoContactar />}
                </SheetDescription>
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-3 p-4">
              <Seccion titulo="Información general" Icono={User}>
                {c.telefonoPrincipal && (
                  <Dato etiqueta="Teléfono">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="size-3.5 text-muted-foreground" aria-hidden />
                      {c.telefonoPrincipal}
                    </span>
                  </Dato>
                )}
                {c.email && (
                  <Dato etiqueta="Email">
                    <span className="inline-flex items-center gap-1 break-all">
                      <Mail className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      {c.email}
                    </span>
                  </Dato>
                )}
                <Dato etiqueta="Canales">
                  {c.canales.length === 0
                    ? "—"
                    : Array.from(new Set(c.canales.map((x) => grupoDeCanal(x.canal)).filter(Boolean)))
                        .map((g) => ETIQUETA_GRUPO_CANAL[g!])
                        .join(", ")}
                </Dato>
                <Dato etiqueta="Empresa">
                  {c.empresa ? (
                    <Link href={`/crm/empresas/${c.empresa.id}`} className="hover:underline">
                      {c.empresa.nombre}
                    </Link>
                  ) : (
                    "—"
                  )}
                </Dato>
                {c.etiquetas.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {c.etiquetas.map((t) => (
                      <span key={t.id} className="rounded-full border border-border-subtle px-2 py-0.5 text-xs text-foreground">
                        {t.nombre}
                      </span>
                    ))}
                  </div>
                )}
                {c.noContactar && (
                  <p className="text-xs text-muted-foreground">
                    No contactar desde <FechaHora valor={c.noContactar.desde} modo="fecha" />
                    {c.noContactar.porNombre ? ` · marcado por ${c.noContactar.porNombre}` : ""}
                  </p>
                )}
              </Seccion>

              <Seccion titulo="Actividad comercial" Icono={BarChart3}>
                <Dato etiqueta="Última compra">
                  {resumen.actividadComercial.ultimaCompra ? (
                    <Link href={`/sales/pedidos/${resumen.actividadComercial.ultimaCompra.pedidoId}`} className="hover:underline">
                      #{resumen.actividadComercial.ultimaCompra.numero} ·{" "}
                      <FechaHora valor={resumen.actividadComercial.ultimaCompra.fecha} modo="fecha" />
                    </Link>
                  ) : (
                    "Sin compras"
                  )}
                </Dato>
                <Dato etiqueta="Oportunidades">
                  {resumen.actividadComercial.oportunidadesAbiertas.length === 0
                    ? "Ninguna abierta"
                    : `${resumen.actividadComercial.oportunidadesAbiertas.length} abierta${resumen.actividadComercial.oportunidadesAbiertas.length === 1 ? "" : "s"}`}
                </Dato>
                {resumen.actividadComercial.oportunidadesAbiertas.map((o) => (
                  <Link
                    key={o.id}
                    href={`/crm/oportunidades/${o.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-1.5 text-xs hover:bg-muted"
                  >
                    <span className="truncate text-foreground">{o.titulo}</span>
                    <span className="shrink-0 text-muted-foreground">{o.etapa}</span>
                  </Link>
                ))}
                <Dato etiqueta="Actividades pendientes">
                  {resumen.actividadComercial.actividadesPendientes.length === 0 ? "Ninguna" : ""}
                </Dato>
                {resumen.actividadComercial.actividadesPendientes.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-1.5 text-xs">
                    <span className="truncate text-foreground">{a.titulo}</span>
                    <span className={a.vencida ? "shrink-0 text-danger-text" : "shrink-0 text-muted-foreground"}>
                      <FechaHora valor={a.fecha} modo="corta" />
                    </span>
                  </div>
                ))}
                <Dato etiqueta="Última actividad">
                  <FechaHora valor={resumen.actividadComercial.ultimaInteraccionEn} modo="relativa" vacio="Sin actividad" />
                </Dato>
                <Dato etiqueta="Seguimiento">{ETIQUETA_SEGUIMIENTO[c.seguimiento]}</Dato>
                <Dato etiqueta="Recomendación">
                  <InsigniaRecomendacion recomendacion={c.recomendacion} />
                </Dato>
              </Seccion>

              <Seccion titulo="Análisis de IA" Icono={Sparkles}>
                <SeccionAnalisisIA
                  contactoId={c.id}
                  analisis={resumen.analisis}
                  puedeModificar={puedeMod}
                  onCambio={() => {
                    void queryClient.invalidateQueries({ queryKey: queryKeys.contactos.resumen(c.id) });
                    void queryClient.invalidateQueries({ queryKey: queryKeys.contactos.vista() });
                  }}
                />
              </Seccion>

              <Seccion titulo="Acciones rápidas" Icono={Zap}>
                <div className="flex flex-wrap gap-2">
                  <ButtonLink size="sm" href={`/crm/contactos/${c.id}`}>
                    <MessageSquare className="size-3.5" aria-hidden />
                    Abrir conversación
                  </ButtonLink>
                  {puedeMod && (
                    <ButtonLink size="sm" variant="outline" href={`/crm/actividades/nueva?contactoId=${c.id}`}>
                      <CalendarPlus className="size-3.5" aria-hidden />
                      Crear actividad
                    </ButtonLink>
                  )}
                  <ButtonLink size="sm" variant="outline" href={`/crm/contactos/${c.id}`}>
                    <Target className="size-3.5" aria-hidden />
                    Ver oportunidades
                  </ButtonLink>
                  <ButtonLink size="sm" variant="ghost" href={`/crm/contactos/${c.id}`}>
                    <ExternalLink className="size-3.5" aria-hidden />
                    Ficha completa
                  </ButtonLink>
                </div>
                {puedeMod && (
                  <div className="border-t border-border-subtle pt-3">
                    <ControlClasificacion
                      contactoId={c.id}
                      interes={c.interes}
                      interesFijado={c.interesFijado}
                      noContactar={Boolean(c.noContactar)}
                    />
                  </div>
                )}
              </Seccion>

              {resumen.historial.length > 0 && (
                <details className="rounded-xl border border-border-subtle bg-card p-4">
                  <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
                    <History className="size-4 text-muted-foreground" aria-hidden />
                    Historial de clasificación
                  </summary>
                  <ul className="mt-3 flex flex-col gap-2">
                    {resumen.historial.map((h, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        <span className="text-foreground">
                          {h.dimension === "INTERES" ? "Interés" : "Preferencia"}: {valorHistorial(h.dimension, h.valorAnterior)} →{" "}
                          {valorHistorial(h.dimension, h.valorNuevo)}
                        </span>{" "}
                        · {ETIQUETA_ORIGEN[h.origen]}
                        {h.usuarioNombre ? ` · ${h.usuarioNombre}` : ""} · <FechaHora valor={h.creadoEn} modo="relativa" />
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
