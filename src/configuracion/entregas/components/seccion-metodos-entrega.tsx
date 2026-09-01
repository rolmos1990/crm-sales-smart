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
  guardarZonaCoberturaMetodo,
  guardarUbicacionRetiro,
} from "@/configuracion/entregas/actions";

const METODOS = [
  { valor: "COURIER_EXTERNO", etiqueta: "Courier externo" },
  { valor: "MENSAJERO_PROPIO", etiqueta: "Mensajero propio" },
  { valor: "RETIRO_TIENDA", etiqueta: "Retiro en tienda" },
  { valor: "DIGITAL", etiqueta: "Digital" },
  { valor: "INSTALACION_SERVICIO", etiqueta: "Instalación / servicio" },
] as const;

// 019-cobertura-geografica-envios
const MODOS_COBERTURA = [
  { valor: "TODOS_LADOS_CON_EXCEPCIONES", etiqueta: "Entrega a todos lados (con excepciones)" },
  { valor: "SOLO_ZONAS_EVALUADAS", etiqueta: "Solo zonas evaluadas caso por caso" },
] as const;

interface ZonaMetodoRow {
  id: string;
  zonaCoberturaId: string;
  zonaNombre: string;
  cubierta: boolean;
  esExcepcion: boolean;
}
interface MetodoRow {
  id: string;
  metodoEntrega: string;
  activo: boolean;
  costoBase: number;
  diasEstimadosMin: number | null;
  diasEstimadosMax: number | null;
  modoCobertura: string;
  zonas: ZonaMetodoRow[];
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

// Solo tiene efecto observable para métodos de delivery propio — un
// COURIER_EXTERNO ya se cubre por transportista/país/estado (Historia 1).
function esMetodoDelivery(metodoEntrega: string) {
  return metodoEntrega !== "COURIER_EXTERNO";
}

function FilaMetodo({ metodo, zonasDisponibles }: { metodo: MetodoRow; zonasDisponibles: ZonaRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [zonaElegida, setZonaElegida] = useState<string>("");

  const zonasSinAsignar = zonasDisponibles.filter(
    (z) => !metodo.zonas.some((zm) => zm.zonaCoberturaId === z.id)
  );

  function cambiarModoCobertura(nuevoModo: string) {
    startTransition(async () => {
      const resultado = await guardarMetodoEntregaConfig({
        metodoEntrega: metodo.metodoEntrega,
        activo: metodo.activo,
        costoBase: metodo.costoBase,
        diasEstimadosMin: metodo.diasEstimadosMin,
        diasEstimadosMax: metodo.diasEstimadosMax,
        modoCobertura: nuevoModo,
      });
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Modo de cobertura actualizado");
      location.reload();
    });
  }

  function asignarZona(esExcepcion: boolean) {
    if (!zonaElegida) return;
    startTransition(async () => {
      const resultado = await guardarZonaCoberturaMetodo({
        zonaCoberturaId: zonaElegida,
        metodoEntregaConfigId: metodo.id,
        cubierta: !esExcepcion,
        esExcepcion,
      });
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success(esExcepcion ? "Excepción agregada" : "Zona cubierta agregada");
      setZonaElegida("");
      location.reload();
    });
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-white/8 bg-white/3 px-3 py-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-stone-200">{METODOS.find((x) => x.valor === metodo.metodoEntrega)?.etiqueta ?? metodo.metodoEntrega}</span>
        <span className="text-stone-400">S/ {metodo.costoBase.toFixed(2)}</span>
      </div>

      {esMetodoDelivery(metodo.metodoEntrega) && (
        <div className="flex flex-col gap-2 pl-1 border-l-2 border-white/10">
          <div className="flex items-center gap-2 pl-2">
            <span className="text-xs text-stone-500">Cobertura:</span>
            <Select
              items={Object.fromEntries(MODOS_COBERTURA.map((m) => [m.valor, m.etiqueta]))}
              value={metodo.modoCobertura}
              onValueChange={(v) => v && v !== metodo.modoCobertura && cambiarModoCobertura(v)}
            >
              <SelectTrigger className="w-64 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODOS_COBERTURA.map((m) => <SelectItem key={m.valor} value={m.valor}>{m.etiqueta}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {metodo.zonas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pl-2">
              {metodo.zonas.map((z) => (
                <span
                  key={z.id}
                  className={
                    "text-xs px-2 py-0.5 rounded-full border " +
                    (z.esExcepcion
                      ? "border-red-400/30 text-red-400 bg-red-400/5"
                      : "border-lime-400/30 text-lime-400 bg-lime-400/5")
                  }
                >
                  {z.esExcepcion ? "✕ " : "✓ "}{z.zonaNombre}
                </span>
              ))}
            </div>
          )}

          {zonasSinAsignar.length > 0 && (
            <div className="flex items-center gap-2 pl-2">
              <Select
                items={Object.fromEntries(zonasSinAsignar.map((z) => [z.id, z.nombre]))}
                value={zonaElegida}
                onValueChange={(v) => setZonaElegida(v ?? "")}
              >
                <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Elegir zona..." /></SelectTrigger>
                <SelectContent>
                  {zonasSinAsignar.map((z) => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" size="sm" variant="outline" disabled={isPending || !zonaElegida} onClick={() => asignarZona(false)} className="h-8 text-xs border-lime-400/30 text-lime-400 hover:bg-lime-400/10">
                Marcar cubierta
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={isPending || !zonaElegida} onClick={() => asignarZona(true)} className="h-8 text-xs border-red-400/30 text-red-400 hover:bg-red-400/10">
                Marcar excepción
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
  );
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
              <FilaMetodo key={m.id} metodo={m} zonasDisponibles={zonasIniciales} />
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
        <p className="text-stone-300 text-xs uppercase tracking-wide flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Zonas de cobertura (aproximadas, para delivery propio)</p>
        {zonasIniciales.length === 0 ? (
          <p className="text-stone-500 text-sm">Sin zonas configuradas.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {zonasIniciales.map((z) => <span key={z.id} className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-stone-300">{z.nombre}</span>)}
          </div>
        )}
        <div className="flex gap-2">
          <Input value={zonaNombre} onChange={(e) => setZonaNombre(e.target.value)} placeholder="Ej. Zona Norte" className="flex-1 bg-white/5 border-white/10 text-stone-50" />
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
