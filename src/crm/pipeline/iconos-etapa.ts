import {
  CircleDashed, UserRound, Phone, MessageCircle, Mail, CalendarDays,
  Target, Handshake, FileText, Receipt, Bookmark, Flag,
  Truck, PackageCheck, CircleCheck, CircleX, Clock, Star,
  ThumbsUp, Sparkles, Search, Megaphone,
  type LucideIcon,
} from "lucide-react";

/**
 * Catálogo de íconos elegibles por etapa del pipeline (046).
 *
 * Es una lista cerrada, no "cualquier ícono de lucide": lo que se guarda en
 * `PipelineStage.icono` es la clave de este mapa, así que un valor viejo o
 * inventado no rompe el render — cae al ícono por defecto. Eso es también lo
 * que permite que la columna sea un `String?` sin validación en base.
 *
 * El orden es el que se ve en el selector, agrupado por momento del embudo:
 * primero prospección, después contacto, negociación, cierre y post-venta.
 */
export const ICONOS_ETAPA: Record<string, { Icono: LucideIcon; etiqueta: string }> = {
  CircleDashed:  { Icono: CircleDashed,  etiqueta: "Sin definir" },
  Search:        { Icono: Search,        etiqueta: "Prospección" },
  UserRound:     { Icono: UserRound,     etiqueta: "Contacto" },
  Megaphone:     { Icono: Megaphone,     etiqueta: "Campaña" },

  Phone:         { Icono: Phone,         etiqueta: "Llamada" },
  MessageCircle: { Icono: MessageCircle, etiqueta: "Conversación" },
  Mail:          { Icono: Mail,          etiqueta: "Correo" },
  CalendarDays:  { Icono: CalendarDays,  etiqueta: "Seguimiento" },

  Target:        { Icono: Target,        etiqueta: "Oportunidad" },
  Handshake:     { Icono: Handshake,     etiqueta: "Negociación" },
  FileText:      { Icono: FileText,      etiqueta: "Propuesta" },
  Receipt:       { Icono: Receipt,       etiqueta: "Cotización" },

  Bookmark:      { Icono: Bookmark,      etiqueta: "Reservado" },
  Clock:         { Icono: Clock,         etiqueta: "En espera" },
  Star:          { Icono: Star,          etiqueta: "Prioritario" },
  Sparkles:      { Icono: Sparkles,      etiqueta: "Destacado" },

  Truck:         { Icono: Truck,         etiqueta: "En envío" },
  PackageCheck:  { Icono: PackageCheck,  etiqueta: "Entregado" },
  ThumbsUp:      { Icono: ThumbsUp,      etiqueta: "Aprobado" },
  Flag:          { Icono: Flag,          etiqueta: "Hito" },

  CircleCheck:   { Icono: CircleCheck,   etiqueta: "Ganado" },
  CircleX:       { Icono: CircleX,       etiqueta: "Perdido" },
};

export const ICONO_ETAPA_POR_DEFECTO = "CircleDashed";

/**
 * Ícono de una etapa, tolerante a claves desconocidas.
 *
 * Una etapa creada antes de 046 tiene `icono = null`, y una guardada con una
 * clave que después se saque del catálogo quedaría apuntando a algo que no
 * existe. Los dos casos caen al mismo lugar en vez de romper el tablero.
 */
export function obtenerIconoEtapa(icono: string | null | undefined): LucideIcon {
  if (icono && ICONOS_ETAPA[icono]) return ICONOS_ETAPA[icono].Icono;
  return ICONOS_ETAPA[ICONO_ETAPA_POR_DEFECTO].Icono;
}
