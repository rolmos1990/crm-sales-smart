"use client";

import { ChevronDown, UserRound, type LucideIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { cuentaParaAtencionHumana } from "../atencion-humana";
import { tieneMensajeSinLeer } from "../agrupacion";
import { AvatarContacto } from "./avatar-contacto";
import type { ConversacionResumen, GrupoContacto, EstadoConversacion } from "../types";

/**
 * 035 — Una persona en la lista del Inbox, con sus conversaciones adentro.
 *
 * Dos formas según el grupo:
 * - `esSimple` (una sola conversación): fila igual a la de siempre. Sin
 *   cabecera de persona, sin control de expansión, sin "N conversaciones" —
 *   anidar algo que no tiene hermanos solo agrega ruido (FR-004).
 * - Varias conversaciones: cabecera con la persona y los badges agregados, y
 *   debajo una fila por conversación.
 *
 * El componente no decide qué conversaciones se ven: recibe el grupo ya
 * armado por `agruparPorContacto` sobre la lista filtrada.
 */

interface EstadoCfg {
  dot: string;
  pulse: boolean;
  badgeBg: string;
  badgeText: string;
  badgeLabel: string;
}

interface GrupoContactoInboxProps {
  grupo: GrupoContacto;
  seleccionada: string | null;
  colapsado: boolean;
  onToggleColapsado: (contactoId: string) => void;
  onSeleccionar: (conv: ConversacionResumen) => void;
  /** Config de estado por conversación — la misma tabla que usa el chat. */
  estadoCfg: Record<EstadoConversacion, EstadoCfg>;
  /** Ícono y color por canal — mismo criterio que el resto del Inbox. */
  infoCanal: (canal: string | undefined) => { Icono: LucideIcon; clase: string };
}

function nombreVisible(conv: ConversacionResumen): { nombre: string; sinIdentificar: boolean } {
  const completo = `${conv.contacto.nombre} ${conv.contacto.apellido}`.trim();
  return {
    nombre: completo || conv.contacto.telefonoPrincipal || "Sin nombre",
    sinIdentificar: !completo,
  };
}

function BadgeAtencionHumana({ conv }: { conv: ConversacionResumen }) {
  return (
    <span
      className="flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[9px] font-semibold text-warning"
      title={
        conv.modoAtencion === "HUMANO"
          ? conv.atencionMotivo ?? "La atiende una persona"
          : "Hay una respuesta de la IA esperando aprobación"
      }
    >
      <UserRound className="h-2.5 w-2.5 shrink-0" />
      Atención humana
    </span>
  );
}

/** Fila de una conversación: la unidad que se abre y se responde. */
function FilaConversacion({
  conv,
  activa,
  anidada,
  esGrupoSimple = false,
  onSeleccionar,
  estadoCfg,
  infoCanal,
}: {
  conv: ConversacionResumen;
  activa: boolean;
  /** true cuando cuelga de una cabecera de persona: se sangra y oculta el nombre. */
  anidada: boolean;
  /** Grupo de una sola conversación: esta fila ES el grupo, y se marca como tal. */
  esGrupoSimple?: boolean;
  onSeleccionar: (conv: ConversacionResumen) => void;
  estadoCfg: GrupoContactoInboxProps["estadoCfg"];
  infoCanal: GrupoContactoInboxProps["infoCanal"];
}) {
  const { nombre, sinIdentificar } = nombreVisible(conv);
  const cfg = estadoCfg[conv.estado] ?? estadoCfg.CERRADA;
  const canal = infoCanal(conv.cuentaCanal?.canal);
  const noLeido = tieneMensajeSinLeer(conv);

  return (
    <li data-testid={esGrupoSimple ? "grupo-contacto" : undefined}>
      <button
        type="button"
        data-testid="conversacion-item"
        onClick={() => onSeleccionar(conv)}
        className={cn(
          "w-full text-left flex items-start gap-3 py-3 transition-colors border-l-2",
          anidada ? "pl-8 pr-4" : "px-4",
          activa
            ? "bg-inbox-accent-muted border-l-inbox-accent"
            : "border-l-transparent hover:bg-muted/70",
        )}
      >
        {/* Dentro de un grupo, el avatar ya lo puso la cabecera de la persona:
            repetirlo en cada hijo haría ilegible de quién es cada hilo. */}
        {!anidada && (
          <AvatarContacto
            nombre={conv.contacto.nombre}
            apellido={conv.contacto.apellido}
            avatarUrl={conv.contacto.avatarUrl}
            className="h-9 w-9 text-xs"
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {anidada ? (
                // En el hijo, el encabezado es el canal: es lo que distingue
                // una conversación de la otra dentro de la misma persona.
                <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold truncate", canal.clase)}>
                  <canal.Icono className="h-3 w-3 shrink-0" />
                  {conv.cuentaCanal?.nombre ?? "Sin canal"}
                </span>
              ) : (
                <>
                  <p className={cn("text-xs truncate text-foreground", noLeido ? "font-bold" : "font-semibold")}>
                    {nombre}
                  </p>
                  {sinIdentificar && (
                    <span className="shrink-0 text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-stage-amber-muted text-stage-amber-text border border-stage-amber-border">
                      ?
                    </span>
                  )}
                </>
              )}
            </div>
            <span className="text-[9px] text-muted-foreground shrink-0 whitespace-nowrap">
              {formatDistanceToNow(new Date(conv.actualizadoEn), { addSuffix: false, locale: es })}
            </span>
          </div>

          {/* Asunto: lo único que distingue dos hilos del mismo canal (correo
              agrupado por hilo). Solo se muestra si aporta esa distinción. */}
          {anidada && conv.asunto && (
            <p className="text-[10px] text-text-secondary truncate leading-snug mb-0.5">{conv.asunto}</p>
          )}

          <p className={cn("text-[11px] truncate leading-snug", noLeido ? "text-text-secondary" : "text-muted-foreground")}>
            {conv.ultimoMensaje?.contenido
              ? conv.ultimoMensaje.contenido.slice(0, 55)
              : <span className="italic text-muted-foreground">Sin mensajes</span>}
          </p>

          <div className="flex items-center justify-between mt-1 gap-1">
            {!anidada && conv.cuentaCanal ? (
              <span className={cn("inline-flex items-center gap-1 text-[9px] font-medium truncate", canal.clase)}>
                <canal.Icono className="h-2.5 w-2.5 shrink-0" />
                {conv.cuentaCanal.nombre}
              </span>
            ) : <span />}
            <div className="flex items-center gap-1.5 shrink-0">
              {noLeido && <span className="h-1.5 w-1.5 rounded-full bg-inbox-accent" />}
              {/* Va antes del badge de estado y no lo reemplaza: son dos cosas
                  distintas. "Abierta" dice en qué punto del ciclo está;
                  "Atención humana" dice que no avanza sin una persona. */}
              {cuentaParaAtencionHumana(conv) && <BadgeAtencionHumana conv={conv} />}
              <span
                className={cn(
                  "flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border",
                  cfg.badgeBg,
                  cfg.badgeText,
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot, cfg.pulse && "animate-pulse")} />
                {cfg.badgeLabel}
              </span>
            </div>
          </div>
        </div>
      </button>
    </li>
  );
}

export function GrupoContactoInbox({
  grupo,
  seleccionada,
  colapsado,
  onToggleColapsado,
  onSeleccionar,
  estadoCfg,
  infoCanal,
}: GrupoContactoInboxProps) {
  // Una sola conversación: la fila de siempre, sin envoltorio de grupo.
  if (grupo.esSimple) {
    return (
      <FilaConversacion
        conv={grupo.lider}
        activa={seleccionada === grupo.lider.id}
        anidada={false}
        esGrupoSimple
        onSeleccionar={onSeleccionar}
        estadoCfg={estadoCfg}
        infoCanal={infoCanal}
      />
    );
  }

  const { nombre, sinIdentificar } = nombreVisible(grupo.lider);
  const algunaSeleccionada = grupo.conversaciones.some((c) => c.id === seleccionada);

  return (
    <li data-testid="grupo-contacto">
      {/* Cabecera: la persona. Lo que se ve acá tiene que alcanzar con el
          grupo colapsado — por eso los badges son agregados de los hijos. */}
      <button
        type="button"
        onClick={() => onToggleColapsado(grupo.contactoId)}
        aria-expanded={!colapsado}
        className={cn(
          "w-full text-left flex items-start gap-3 px-4 py-3 transition-colors border-l-2",
          algunaSeleccionada && colapsado
            ? "bg-inbox-accent-muted border-l-inbox-accent"
            : "border-l-transparent hover:bg-muted/70",
        )}
      >
        <AvatarContacto
          nombre={grupo.contacto.nombre}
          apellido={grupo.contacto.apellido}
          avatarUrl={grupo.contacto.avatarUrl}
          className="h-9 w-9 text-xs"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className={cn("text-xs truncate text-foreground", grupo.noLeidos > 0 ? "font-bold" : "font-semibold")}>
                {nombre}
              </p>
              {sinIdentificar && (
                <span className="shrink-0 text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-stage-amber-muted text-stage-amber-text border border-stage-amber-border">
                  ?
                </span>
              )}
            </div>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform",
                colapsado && "-rotate-90",
              )}
            />
          </div>

          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] text-muted-foreground truncate">
              {grupo.totalConversaciones} conversaciones
              {grupo.totalCanales > 1 && ` · ${grupo.totalCanales} canales`}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {grupo.noLeidos > 0 && (
                <span className="flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-inbox-accent text-[9px] font-bold text-background tabular-nums">
                  {grupo.noLeidos}
                </span>
              )}
              {grupo.requiereAtencionHumana && (
                <span
                  className="flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[9px] font-semibold text-warning"
                  title="Alguna conversación de este contacto necesita a una persona"
                >
                  <UserRound className="h-2.5 w-2.5 shrink-0" />
                  Atención humana
                </span>
              )}
            </div>
          </div>

          {/* Íconos de los canales presentes: con el grupo colapsado es la
              única pista de por dónde está hablando esta persona. */}
          {colapsado && (
            <div className="flex items-center gap-1.5 mt-1">
              {grupo.conversaciones.map((conv) => {
                const canal = infoCanal(conv.cuentaCanal?.canal);
                return (
                  <canal.Icono
                    key={conv.id}
                    className={cn("h-2.5 w-2.5 shrink-0", canal.clase)}
                    aria-hidden
                  />
                );
              })}
            </div>
          )}
        </div>
      </button>

      {!colapsado && (
        <ul className="divide-y divide-card-divider border-t border-card-divider bg-background-subtle/40">
          {grupo.conversaciones.map((conv) => (
            <FilaConversacion
              key={conv.id}
              conv={conv}
              activa={seleccionada === conv.id}
              anidada
              onSeleccionar={onSeleccionar}
              estadoCfg={estadoCfg}
              infoCanal={infoCanal}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
