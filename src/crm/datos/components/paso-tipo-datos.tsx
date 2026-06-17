"use client";

import {
  Users,
  Building2,
  TrendingUp,
  ShoppingCart,
  Package,
  CalendarCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { EntidadImportable } from "../types";

const ENTIDADES: {
  clave: EntidadImportable;
  etiqueta: string;
  descripcion: string;
  Icono: React.ElementType;
  color: string;
}[] = [
  {
    clave: "CONTACTO",
    etiqueta: "Contactos",
    descripcion: "Importa personas, clientes, leads o contactos.",
    Icono: Users,
    color: "text-blue-400",
  },
  {
    clave: "EMPRESA",
    etiqueta: "Empresas",
    descripcion: "Importa empresas y organizaciones.",
    Icono: Building2,
    color: "text-purple-400",
  },
  {
    clave: "OPORTUNIDAD",
    etiqueta: "Oportunidades",
    descripcion: "Importa oportunidades y negocios de tu pipeline.",
    Icono: TrendingUp,
    color: "text-amber-400",
  },
  {
    clave: "PEDIDO",
    etiqueta: "Pedidos",
    descripcion: "Importa pedidos y órdenes de compra.",
    Icono: ShoppingCart,
    color: "text-orange-400",
  },
  {
    clave: "PRODUCTO",
    etiqueta: "Productos",
    descripcion: "Importa tu catálogo de productos y servicios.",
    Icono: Package,
    color: "text-cyan-400",
  },
  {
    clave: "ACTIVIDAD",
    etiqueta: "Actividades",
    descripcion: "Importa actividades, tareas, llamadas y reuniones.",
    Icono: CalendarCheck,
    color: "text-lime-400",
  },
];

interface PasoTipoDatosProps {
  onSeleccionar: (entidad: EntidadImportable) => void;
  entidadActual?: EntidadImportable | null;
}

export function PasoTipoDatos({
  onSeleccionar,
  entidadActual,
}: PasoTipoDatosProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-stone-50">
          ¿Qué deseas importar?
        </h2>
        <p className="text-sm text-stone-400 mt-1">
          Selecciona el tipo de datos que vas a importar a tu CRM.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ENTIDADES.map(({ clave, etiqueta, descripcion, Icono, color }) => {
          const seleccionada = entidadActual === clave;
          return (
            <button
              key={clave}
              type="button"
              onClick={() => onSeleccionar(clave)}
              className={cn(
                "flex items-center gap-4 rounded-xl border p-5 text-left transition-all",
                "bg-white/5 backdrop-blur-xl",
                seleccionada
                  ? "border-lime-500/50 bg-lime-500/5 ring-1 ring-lime-500/30"
                  : "border-white/10 hover:border-white/20 hover:bg-white/8",
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-11 h-11 rounded-xl bg-white/8 flex-shrink-0",
                  seleccionada && "bg-lime-500/10",
                )}
              >
                <Icono className={cn("w-5 h-5", seleccionada ? "text-lime-400" : color)} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-stone-100 text-sm">
                  {etiqueta}
                </p>
                <p className="text-xs text-stone-400 mt-0.5 leading-snug">
                  {descripcion}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/4 p-4">
        <Package className="w-4 h-4 text-stone-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-stone-400">
          <span className="text-stone-300 font-medium">Formatos soportados:</span>{" "}
          Puedes importar archivos en formato CSV, XLS o XLSX. Tamaño máximo
          por archivo: 2 MB.
        </p>
      </div>

      {entidadActual && (
        <div className="flex justify-end">
          <Button
            onClick={() => onSeleccionar(entidadActual)}
            className="bg-lime-500/90 text-stone-950 rounded-xl hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02]"
          >
            Continuar
          </Button>
        </div>
      )}
    </div>
  );
}
