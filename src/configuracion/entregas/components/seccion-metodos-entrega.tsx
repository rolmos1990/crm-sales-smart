"use client";

// 015-herramientas-operativas-inventario-envios-acciones — configuración de
// métodos de entrega, zonas de cobertura y ubicaciones de retiro. Sin esto,
// el agente no puede consultar costo/cobertura/fecha estimada reales
// (FR-005, FR-006).

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Truck, MapPin, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  guardarMetodoEntregaConfig,
  guardarZonaCobertura,
  guardarUbicacionRetiro,
} from "@/configuracion/entregas/actions";

const METODOS = [
  { valor: "COURIER_EXTERNO", etiqueta: "Courier externo" },
  { valor: "MENSAJERO_PROPIO", etiqueta: "Mensajero propio" },
  { valor: "RETIRO_TIENDA", etiqueta: "Retiro en tienda" },
  { valor: "DIGITAL", etiqueta: "Digital" },
  { valor: "INSTALACION_SERVICIO", etiqueta: "Instalación / servicio" },
] as const;

interface MetodoRow {
  id: string;
  metodoEntrega: string;
  activo: boolean;
  costoBase: number;
  diasEstimadosMin: number | null;
  diasEstimadosMax: number | null;
}
interface ZonaRow {
  id: string;
  nombre: string;
}
interface UbicacionRow {
  id: string;
  nombre: string;
  direccion: string;
  activo: boolean;
}

interface SeccionMetodosEntregaProps {
  metodosIniciales: MetodoRow[];
  zonasIniciales: ZonaRow[];
  ubicacionesIniciales: UbicacionRow[];
}

export function SeccionMetodosEntrega({ metodosIniciales, zonasIniciales, ubicacionesIniciales }: SeccionMetodosEntregaProps) {
  const [metodoNuevo, setMetodoNuevo] = useState<string>(METODOS[0].valor);
  const [costoBase, setCostoBase] = useState("0");
  const [zonaNombre, setZonaNombre] = useState("");
  const [ubicacionNombre, setUbicacionNombre] = useState("");
  const [ubicacionDireccion, setUbicacionDireccion] = useState("");
  const [isPending, startTransition] = useTransition();

  function agregarMetodo() {
    startTransition(async () => {
      const resultado = await guardarMetodoEntregaConfig({ metodoEntrega: metodoNuevo, costoBase: Number(costoBase), activo: true });
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Método de entrega guardado");
      location.reload();
    });
  }

  function agregarZona() {
    if (!zonaNombre.trim()) return;
    startTransition(async () => {
      const resultado = await guardarZonaCobertura({ nombre: zonaNombre.trim() });
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Zona agregada");
      setZonaNombre("");
      location.reload();
    });
  }

  function agregarUbicacion() {
    if (!ubicacionNombre.trim() || !ubicacionDireccion.trim()) return;
    startTransition(async () => {
      const resultado = await guardarUbicacionRetiro({ nombre: ubicacionNombre.trim(), direccion: ubicacionDireccion.trim(), activo: true });
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Ubicación de retiro agregada");
      setUbicacionNombre("");
      setUbicacionDireccion("");
      location.reload();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-stone-400" />
        <h3 className="text-sm font-semibold text-stone-200 uppercase tracking-wide">Datos y herramientas — Entregas</h3>
      </div>

      {/* Métodos de entrega */}
      <div className="flex flex-col gap-2">
        <p className="text-stone-300 text-xs uppercase tracking-wide">Métodos de entrega</p>
        {metodosIniciales.length === 0 ? (
          <p className="text-stone-500 text-sm">Sin métodos configurados — el agente no podrá informar costos ni cobertura reales.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {metodosIniciales.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/3 px-3 py-2 text-sm">
                <span className="text-stone-200">{METODOS.find((x) => x.valor === m.metodoEntrega)?.etiqueta ?? m.metodoEntrega}</span>
                <span className="text-stone-400">S/ {m.costoBase.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Select items={Object.fromEntries(METODOS.map((m) => [m.valor, m.etiqueta]))} value={metodoNuevo} onValueChange={(v) => v && setMetodoNuevo(v)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {METODOS.map((m) => <SelectItem key={m.valor} value={m.valor}>{m.etiqueta}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="number" min={0} value={costoBase} onChange={(e) => setCostoBase(e.target.value)} placeholder="Costo base" className="w-32 bg-white/5 border-white/10 text-stone-50" />
          <Button type="button" onClick={agregarMetodo} disabled={isPending} className="bg-lime-500/90 text-stone-950 hover:bg-lime-400 font-semibold">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Zonas de cobertura */}
      <div className="flex flex-col gap-2">
        <p className="text-stone-300 text-xs uppercase tracking-wide flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Zonas de cobertura</p>
        {zonasIniciales.length === 0 ? (
          <p className="text-stone-500 text-sm">Sin zonas configuradas.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {zonasIniciales.map((z) => <span key={z.id} className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-stone-300">{z.nombre}</span>)}
          </div>
        )}
        <div className="flex gap-2">
          <Input value={zonaNombre} onChange={(e) => setZonaNombre(e.target.value)} placeholder="Ej. Lima Metropolitana" className="flex-1 bg-white/5 border-white/10 text-stone-50" />
          <Button type="button" onClick={agregarZona} disabled={isPending} variant="outline" className="border-white/10 text-stone-300 hover:bg-white/10">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Ubicaciones de retiro */}
      <div className="flex flex-col gap-2">
        <p className="text-stone-300 text-xs uppercase tracking-wide flex items-center gap-1.5"><Store className="h-3.5 w-3.5" /> Ubicaciones de retiro</p>
        {ubicacionesIniciales.length === 0 ? (
          <p className="text-stone-500 text-sm">Sin ubicaciones configuradas.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {ubicacionesIniciales.map((u) => (
              <li key={u.id} className="rounded-lg border border-white/8 bg-white/3 px-3 py-2 text-sm">
                <p className="text-stone-200">{u.nombre}</p>
                <p className="text-stone-500 text-xs">{u.direccion}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input value={ubicacionNombre} onChange={(e) => setUbicacionNombre(e.target.value)} placeholder="Nombre" className="flex-1 bg-white/5 border-white/10 text-stone-50" />
          <Input value={ubicacionDireccion} onChange={(e) => setUbicacionDireccion(e.target.value)} placeholder="Dirección" className="flex-1 bg-white/5 border-white/10 text-stone-50" />
          <Button type="button" onClick={agregarUbicacion} disabled={isPending} variant="outline" className="border-white/10 text-stone-300 hover:bg-white/10">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
