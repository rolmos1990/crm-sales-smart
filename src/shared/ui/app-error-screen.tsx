import { type LucideIcon, AlertTriangle } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Anatomía única de toda pantalla de error y de "no encontrado" (044).
 *
 * Hermana de `EmptyState`: mismo contenedor centrado, mismo ícono en caja
 * redondeada, mismo tratamiento de título y descripción. Es a propósito —un
 * fallo y un vacío son estados distintos pero de la misma familia visual— y
 * es lo que evita que las dieciséis pantallas terminen pareciéndose solo de a
 * ratos.
 *
 * **No lleva `'use client'`, y no es un descuido.** El `not-found.tsx` raíz se
 * envía con TODAS las rutas de la aplicación, así que volver cliente este
 * componente arrastraría su bundle a cada página por una pantalla que la
 * mayoría de los usuarios no ve nunca. Por eso las acciones entran ya armadas
 * como nodos: quien necesita un `onClick` lo construye en su propio Client
 * Component (los `error.tsx`, que son cliente por obligación del framework).
 *
 * **Nunca recibe el objeto de error**, solo texto ya resuelto. Así es
 * imposible que una traza o el mensaje crudo de una excepción llegue a la
 * pantalla por descuido (FR-005). Lo único que viaja del error a la UI es
 * `codigoSoporte`, que es el `digest` que genera Next y que sirve para
 * encontrar el evento en los registros del servidor.
 */
interface AppErrorScreenProps {
  titulo: string;
  descripcion?: string;
  Icono?: LucideIcon;
  /** Salida principal. Un `<ButtonLink>` o un `<Button>` ya armado. */
  accion?: ReactNode;
  /** Salida alternativa: siempre debe haber una que no sea reintentar. */
  accionSecundaria?: ReactNode;
  /** `error.digest`. Si llega vacío, la sección no se renderiza. */
  codigoSoporte?: string;
  className?: string;
}

export function AppErrorScreen({
  titulo,
  descripcion,
  Icono = AlertTriangle,
  accion,
  accionSecundaria,
  codigoSoporte,
  className,
}: AppErrorScreenProps) {
  return (
    <div
      data-slot="app-error-screen"
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-4 p-6 py-20 text-center",
        className,
      )}
    >
      <div className="rounded-2xl bg-muted dark:backdrop-blur-sm border border-border p-5 shadow-sm dark:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.4)]">
        <Icono className="h-8 w-8 text-muted-foreground" />
      </div>

      <div className="space-y-1.5 max-w-sm">
        <p className="font-semibold text-foreground">{titulo}</p>
        {descripcion && (
          <p className="text-sm text-muted-foreground leading-relaxed">{descripcion}</p>
        )}
      </div>

      {(accion || accionSecundaria) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {accion}
          {accionSecundaria}
        </div>
      )}

      {codigoSoporte && (
        <p className="text-xs text-muted-foreground">
          Código para soporte:{" "}
          <code className="select-all font-mono text-foreground">{codigoSoporte}</code>
        </p>
      )}
    </div>
  );
}
