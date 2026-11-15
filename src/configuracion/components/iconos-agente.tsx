import { cn } from "@/lib/utils";

/**
 * Set cerrado de avatares del agente. Son SVG propios y no iconos de la
 * librería porque hacen falta 8 caras distinguibles entre sí a 20px, y
 * lucide-react solo trae dos robots.
 *
 * La clave se guarda en AgenteIAConfig.iconoAgente, así que NUNCA se renombra
 * una existente: un agente guardado con una clave desconocida cae al avatar
 * por defecto, no rompe.
 */
export type ClaveIconoAgente =
  | "clasico"
  | "visor"
  | "antena"
  | "auriculares"
  | "chispa"
  | "corazon"
  | "rayo"
  | "estrella";

export const ICONO_AGENTE_POR_DEFECTO: ClaveIconoAgente = "clasico";

type PropsSvg = { className?: string };

// Todos comparten viewBox 0 0 24 24, trazo de 1.5 y `currentColor`, para que
// se puedan usar igual que cualquier icono de lucide dentro del modal.
function Svg({ className, children }: PropsSvg & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("h-5 w-5", className)}
    >
      {children}
    </svg>
  );
}

function RobotClasico({ className }: PropsSvg) {
  return (
    <Svg className={className}>
      <rect x="4" y="8" width="16" height="12" rx="3" />
      <path d="M12 5v3" />
      <circle cx="12" cy="4" r="1.2" />
      <circle cx="9" cy="13" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1.1" fill="currentColor" stroke="none" />
      <path d="M9.5 16.5h5" />
    </Svg>
  );
}

function RobotVisor({ className }: PropsSvg) {
  return (
    <Svg className={className}>
      <rect x="3.5" y="6.5" width="17" height="13" rx="4" />
      <rect x="6.5" y="10.5" width="11" height="4" rx="2" fill="currentColor" stroke="none" />
      <path d="M2 12.5v2M22 12.5v2" />
    </Svg>
  );
}

function RobotAntena({ className }: PropsSvg) {
  return (
    <Svg className={className}>
      <rect x="4.5" y="9" width="15" height="11" rx="3.5" />
      <path d="M8 6.5 9.8 9M16 6.5 14.2 9" />
      <circle cx="7.2" cy="5.6" r="1.1" />
      <circle cx="16.8" cy="5.6" r="1.1" />
      <circle cx="9.5" cy="14" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="14" r="1.1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

function RobotAuriculares({ className }: PropsSvg) {
  return (
    <Svg className={className}>
      <rect x="6" y="7" width="12" height="13" rx="3.5" />
      <path d="M3.5 13v-1a8.5 8.5 0 0 1 17 0v1" />
      <rect x="2.5" y="13" width="3" height="4.5" rx="1.5" />
      <rect x="18.5" y="13" width="3" height="4.5" rx="1.5" />
      <path d="M10 15.5h4" />
    </Svg>
  );
}

function RobotChispa({ className }: PropsSvg) {
  return (
    <Svg className={className}>
      <rect x="4.5" y="8.5" width="15" height="11.5" rx="3.5" />
      <circle cx="9.5" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
      <path d="M9.5 17h5" />
      <path d="M12 2.5 13 5.5 16 6.5 13 7.5 12 10.5 11 7.5 8 6.5 11 5.5Z" />
    </Svg>
  );
}

function RobotCorazon({ className }: PropsSvg) {
  return (
    <Svg className={className}>
      <rect x="4.5" y="7.5" width="15" height="12.5" rx="4" />
      <path d="M12 17.5c-2-1.4-3-2.4-3-3.6a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 1.2-1 2.2-3 3.6Z" />
      <path d="M8 4.5 9.5 7.5M16 4.5 14.5 7.5" />
    </Svg>
  );
}

function RobotRayo({ className }: PropsSvg) {
  return (
    <Svg className={className}>
      <rect x="4.5" y="7.5" width="15" height="12.5" rx="3" />
      <path d="M12.6 10.5 10 14h2.2l-.8 3.5 2.6-3.5h-2.2Z" fill="currentColor" stroke="none" />
      <path d="M12 4v3.5" />
      <circle cx="12" cy="3" r="1.1" />
    </Svg>
  );
}

function RobotEstrella({ className }: PropsSvg) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="13.5" r="6.5" />
      <circle cx="9.8" cy="12.8" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.2" cy="12.8" r="1" fill="currentColor" stroke="none" />
      <path d="M10 16.2c1.2.9 2.8.9 4 0" />
      <path d="M12 2.5 12.9 4.6 15 5.5 12.9 6.4 12 8.5 11.1 6.4 9 5.5 11.1 4.6Z" />
    </Svg>
  );
}

export const ICONOS_AGENTE: Record<
  ClaveIconoAgente,
  { etiqueta: string; Svg: (props: PropsSvg) => React.ReactElement }
> = {
  clasico: { etiqueta: "Clásico", Svg: RobotClasico },
  visor: { etiqueta: "Visor", Svg: RobotVisor },
  antena: { etiqueta: "Antenas", Svg: RobotAntena },
  auriculares: { etiqueta: "Auriculares", Svg: RobotAuriculares },
  chispa: { etiqueta: "Chispa", Svg: RobotChispa },
  corazon: { etiqueta: "Corazón", Svg: RobotCorazon },
  rayo: { etiqueta: "Rayo", Svg: RobotRayo },
  estrella: { etiqueta: "Estrella", Svg: RobotEstrella },
};

export const CLAVES_ICONO_AGENTE = Object.keys(ICONOS_AGENTE) as ClaveIconoAgente[];

export function esClaveIconoAgente(valor: unknown): valor is ClaveIconoAgente {
  return typeof valor === "string" && valor in ICONOS_AGENTE;
}

/** Avatar del agente. Una clave nula o desconocida cae al icono por defecto. */
export function IconoAgente({ clave, className }: { clave?: string | null; className?: string }) {
  const { Svg: Icono } = ICONOS_AGENTE[esClaveIconoAgente(clave) ? clave : ICONO_AGENTE_POR_DEFECTO];
  return <Icono className={className} />;
}
