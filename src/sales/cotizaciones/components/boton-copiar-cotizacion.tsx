"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cambiarEstadoCotizacion } from "../actions";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface DestinatarioData {
  nombre?: string;
  apellido?: string;
  telefono?: string;
  email?: string;
}

interface LineaData {
  descripcion: string | null;
  productoNombre: string | null;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  subtotal: number;
}

interface BotonCopiarCotizacionProps {
  cotizacionId: string;
  numero: string;
  estado: string;
  moneda: string;
  fechaEmision: Date;
  fechaVencimiento: Date | null;
  subtotal: number;
  impuesto: number;
  total: number;
  notas: string | null;
  destinatario: DestinatarioData | undefined;
  lineas: LineaData[];
}

export function BotonCopiarCotizacion({
  cotizacionId,
  numero,
  estado,
  moneda,
  fechaEmision,
  fechaVencimiento,
  subtotal,
  impuesto,
  total,
  notas,
  destinatario,
  lineas,
}: BotonCopiarCotizacionProps) {
  const [copiado, setCopiado] = useState(false);
  const [cargando, setCargando] = useState(false);

  if (estado !== "BORRADOR" && estado !== "ENVIADA") return null;

  const generarTexto = (): string => {
    const simbol = moneda === "USD" ? "$" : "S/";
    const fmt = (n: number) => n.toLocaleString("es-PE", { minimumFractionDigits: 2 });

    const nombreDest = [destinatario?.nombre, destinatario?.apellido].filter(Boolean).join(" ");
    const linea = "─────────────────────";

    const partes: string[] = [];
    partes.push(`📋 COTIZACIÓN ${numero}`);
    partes.push(`Fecha: ${format(new Date(fechaEmision), "dd/MM/yyyy", { locale: es })}`);
    if (fechaVencimiento) partes.push(`Vence: ${format(new Date(fechaVencimiento), "dd/MM/yyyy", { locale: es })}`);
    partes.push("");

    if (nombreDest) partes.push(`Para: ${nombreDest}`);
    if (destinatario?.telefono) partes.push(`Tel: ${destinatario.telefono}`);
    if (destinatario?.email) partes.push(`Email: ${destinatario.email}`);
    if (nombreDest || destinatario?.telefono || destinatario?.email) partes.push("");

    partes.push("PRODUCTOS:");
    lineas.forEach((l) => {
      const desc = l.productoNombre ?? l.descripcion ?? "—";
      const cantInt = Number.isInteger(l.cantidad) ? l.cantidad : l.cantidad.toFixed(2);
      partes.push(`${cantInt}x ${desc} — ${simbol} ${fmt(l.precioUnitario)}${l.descuento > 0 ? ` (${l.descuento}% dto.)` : ""}`);
    });

    partes.push("");
    partes.push(linea);
    partes.push(`Subtotal:  ${simbol} ${fmt(subtotal)}`);
    partes.push(`IGV:       ${simbol} ${fmt(impuesto)}`);
    partes.push(`TOTAL:     ${simbol} ${fmt(total)}`);
    partes.push(linea);

    if (notas) {
      partes.push("");
      partes.push(`Notas: ${notas}`);
    }

    return partes.join("\n");
  };

  const handleClick = async () => {
    setCargando(true);
    try {
      const texto = generarTexto();
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success("¡Texto copiado al portapapeles!");
      setTimeout(() => setCopiado(false), 2000);

      if (estado === "BORRADOR") {
        const resultado = await cambiarEstadoCotizacion(cotizacionId, "ENVIADA");
        if (resultado.exito) {
          toast.success("Cotización marcada como enviada");
        }
      }
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={cargando}>
      {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {estado === "BORRADOR" ? "Copiar y marcar enviada" : "Copiar texto"}
    </Button>
  );
}
