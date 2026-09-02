import type { TransportistaModel } from "@/generated/prisma/models/Transportista";
import type { ServicioTransportistaModel } from "@/generated/prisma/models/ServicioTransportista";
import type { CondicionesTransportistaModel } from "@/generated/prisma/models/CondicionesTransportista";
import type { PaisModel } from "@/generated/prisma/models/Pais";

export type Transportista = TransportistaModel;
export type ServicioTransportista = ServicioTransportistaModel;
export type CondicionesTransportista = CondicionesTransportistaModel;
export type PaisTransportista = PaisModel;

// 023-transportistas-por-pais — forma devuelta por queries.ts (Transportista
// + país incluido + flag de bloqueo), usada por los componentes de lista y
// del panel de detalle.
export type TransportistaConPais = Transportista & {
  pais: PaisTransportista | null;
  tienePaisBloqueado: boolean;
};

export type ResultadoAccion<T = void> =
  | { exito: true; data?: T; advertencia?: string }
  | { exito: false; error: string };

export const TIPO_TRANSPORTISTA_LABELS: Record<string, string> = {
  COURIER_EXTERNO:     "Courier externo",
  MENSAJERO_PROPIO:    "Mensajero propio",
  RETIRO_TIENDA:       "Retiro en tienda",
  DIGITAL:             "Entrega digital",
  INSTALACION_SERVICIO: "Instalación / Servicio",
};

// 022-transportistas-zonas-tarifas — sembrados al crear un transportista
// (T026); editables/extensibles después (FR-016).
export const SERVICIOS_TRANSPORTISTA_INICIALES = ["Estándar", "Express", "Personalizado"] as const;
