"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { guardarPreferenciaCatalogoVenta } from "@/configuracion/empresa/actions";

type FiltroCatalogoVenta = "TODOS" | "PRODUCTOS" | "COMBOS";

const OPCIONES: { valor: FiltroCatalogoVenta; etiqueta: string }[] = [
  { valor: "TODOS", etiqueta: "Todos" },
  { valor: "PRODUCTOS", etiqueta: "Solo productos" },
  { valor: "COMBOS", etiqueta: "Solo combos" },
];

interface TabPreferenciasProps {
  filtroProductosPedidoInicial?: FiltroCatalogoVenta;
}

// 029-combos-productos-compuestos — primera preferencia real de esta pestaña.
// Mismo patrón de sección autoguardable que SeccionModoGeografico.
export function TabPreferencias({ filtroProductosPedidoInicial = "TODOS" }: TabPreferenciasProps) {
  const [filtro, setFiltro] = useState<FiltroCatalogoVenta>(filtroProductosPedidoInicial);
  const [guardado, setGuardado] = useState<FiltroCatalogoVenta>(filtroProductosPedidoInicial);
  const [isPending, startTransition] = useTransition();

  function guardar() {
    startTransition(async () => {
      const resultado = await guardarPreferenciaCatalogoVenta({ filtroProductosPedido: filtro });
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      setGuardado(filtro);
      toast.success("Preferencia de ventas actualizada");
    });
  }

  return (
    <div className="max-w-2xl">
      <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 pb-2 border-b border-stone-100 dark:border-white/8 mb-4 flex items-center gap-1.5">
        <ShoppingCart className="h-3.5 w-3.5" /> Ventas
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Productos mostrados al crear pedidos</label>
          <Select
            items={Object.fromEntries(OPCIONES.map((o) => [o.valor, o.etiqueta]))}
            value={filtro}
            onValueChange={(v) => v && setFiltro(v as FiltroCatalogoVenta)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {OPCIONES.map((o) => <SelectItem key={o.valor} value={o.valor}>{o.etiqueta}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Button type="button" onClick={guardar} disabled={isPending || filtro === guardado}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Define con qué filtro abre el selector al agregar productos a un pedido o cotización. Siempre se puede cambiar
        el filtro a mano mientras se arma la venta.
      </p>
    </div>
  );
}
