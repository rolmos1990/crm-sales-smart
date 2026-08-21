import { format } from "date-fns";
import type { Pedido } from "../types";
import { ESTADO_PEDIDO_CONFIG } from "../types";
import { METODO_ENTREGA_LABELS } from "../constantes";

function escaparCelda(valor: string): string {
  if (/[",\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`;
  return valor;
}

export function exportarPedidosCsv(pedidos: Pedido[]) {
  const encabezados = [
    "Número", "Cliente", "Total", "Moneda", "Estado", "Método de envío",
    "Fecha pedido", "Entrega estimada", "Fecha expiración",
  ];

  const filas = pedidos.map((p) => {
    const cliente = p.empresa?.nombre ?? (p.contacto ? `${p.contacto.nombre} ${p.contacto.apellido}` : (p.nombre ? `${p.nombre} ${p.apellido ?? ""}`.trim() : ""));
    const metodo = p.entrega?.metodoEntrega;
    return [
      p.numero,
      cliente,
      p.total.toFixed(2),
      p.moneda,
      ESTADO_PEDIDO_CONFIG[p.estado]?.etiqueta ?? p.estado,
      metodo ? (METODO_ENTREGA_LABELS[metodo] ?? metodo) : "",
      format(new Date(p.fechaPedido), "yyyy-MM-dd"),
      p.fechaEntrega ? format(new Date(p.fechaEntrega), "yyyy-MM-dd") : "",
      p.fechaExpiracion ? format(new Date(p.fechaExpiracion), "yyyy-MM-dd") : "",
    ];
  });

  const contenido = [encabezados, ...filas]
    .map((fila) => fila.map((celda) => escaparCelda(String(celda))).join(","))
    .join("\n");

  // BOM para que Excel detecte UTF-8 correctamente (tildes, ñ)
  const blob = new Blob(["﻿" + contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `pedidos-${format(new Date(), "yyyy-MM-dd")}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}
