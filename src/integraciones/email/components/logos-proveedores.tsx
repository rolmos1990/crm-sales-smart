// Logos de los proveedores de correo para las tarjetas del asistente.
//
// Van como SVG inline y no como dependencia: son tres marcas y una librería de
// íconos de marcas pesa más que todo el asistente. Los colores son los de cada
// marca a propósito —es lo que hace reconocible la tarjeta—, por eso no usan
// tokens del sistema.
import { Server } from "lucide-react";
import type { ClaveProveedor } from "../proveedores";
import { cn } from "@/lib/utils";

function LogoGmail({ className }: { className?: string }) {
  return (
    <svg viewBox="52 42 88 66" className={className} aria-hidden>
      <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
      <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
      <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
      <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92" />
      <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
    </svg>
  );
}

function LogoOutlook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="10" y="4" width="20" height="24" rx="2" fill="#0078d4" />
      <path fill="#28a8ea" d="M10 4h20v8H10z" />
      <path fill="#0364b8" d="M10 12h20v8H10z" />
      <path fill="#14447d" d="M10 20h20v6a2 2 0 0 1-2 2H10z" />
      <path fill="#50d9ff" opacity=".6" d="M30 13 20 19l-10-6v1.5l10 6 10-6z" />
      <rect x="2" y="9" width="15" height="15" rx="2" fill="#0f78d4" />
      <ellipse cx="9.5" cy="16.5" rx="3.6" ry="4.4" fill="none" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

export function LogoProveedor({ clave, className }: { clave: ClaveProveedor; className?: string }) {
  if (clave === "gmail") return <LogoGmail className={cn("h-7 w-7", className)} />;
  if (clave === "outlook") return <LogoOutlook className={cn("h-7 w-7", className)} />;
  return <Server className={cn("h-6 w-6 text-muted-foreground", className)} aria-hidden />;
}
