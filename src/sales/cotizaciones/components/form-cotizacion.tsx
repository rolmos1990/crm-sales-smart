"use client";

import { useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus, Trash2, Minus, X, FileText, Mail, Phone, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Combobox, type OpcionCombobox } from "@/shared/ui/combobox";
import { SelectorProductoLinea } from "@/shared/productos/components/selector-producto-linea";
import { PhoneInput } from "@/components/ui/phone-input";
import type { ProductoCatalogo, TipoProducto } from "@/shared/productos/types";
import { buscarContactosAction } from "@/crm/contactos/actions";
import { crearCotizacion, actualizarCotizacion } from "../actions";
import { CrearCotizacionSchema, type CrearCotizacionInput, type DestinatarioCotizacionInput } from "../schema";
import {
  METODO_ENTREGA_LABELS, ESTADO_ENTREGA_LABELS, METODOS_SIN_RASTREO,
  MODALIDAD_SERVICIO_LABELS, METODO_ENTREGA_DIGITAL_LABELS,
} from "@/sales/pedidos/constantes";

// Etiqueta de la sección #3 según qué bloque de cumplimiento corresponde —
// ver tipoCumplimiento más abajo (derivado, no elegible a mano).
const ETIQUETA_SECCION_CUMPLIMIENTO: Record<TipoProducto, string> = {
  FISICO: "Entrega y seguimiento",
  SERVICIO: "Servicio y seguimiento",
  DIGITAL: "Entrega digital y seguimiento",
};

export interface ContactoResumen {
  id: string;
  nombre: string;
  apellido: string;
  email: string | null;
  telefonoPrincipal: string | null;
}

export interface TransportistaResumen {
  id: string;
  nombre: string;
  tipo: string;
  activo: boolean;
}

interface FormCotizacionProps {
  contactos: OpcionCombobox[];
  contactosDetalle?: ContactoResumen[];
  empresas: OpcionCombobox[];
  productos?: ProductoCatalogo[];
  transportistas?: TransportistaResumen[];
  oportunidadId?: string;
  cotizacionId?: string;
  numero?: string;
  defaultValues?: Partial<CrearCotizacionInput>;
  onSuccess?: () => void;
  /** Cierra el sheet (modal) o navega atrás (página) — unifica ambas experiencias. */
  onCerrar?: () => void;
  /** Datos del contacto de la oportunidad para el toggle "Usar información del contacto" */
  contactoOrigen?: Partial<DestinatarioCotizacionInput>;
  /** Cuando viene del pipeline, el contacto ya está fijado y no se puede cambiar */
  contactoFijo?: boolean;
  /** Cuando viene del pipeline, la empresa ya está fijada y no se puede cambiar */
  empresaFija?: boolean;
  /** Moneda preferida de la instancia; se usa solo al crear */
  monedaDefault?: string;
}

const tieneContactoOrigen = (c?: Partial<DestinatarioCotizacionInput>) =>
  !!(c?.nombre || c?.apellido || c?.telefono || c?.email);

// Determina si el destinatario guardado/por defecto coincide con los datos
// actuales del contacto — así se puede inferir si "Usar información del
// contacto seleccionado" estaba marcado sin tener que persistir ese booleano
// aparte (al editar, se compara contra el contacto vigente, no contra una
// copia vieja).
const normalizarTexto = (v?: string | null) => (v ?? "").trim();
const destinatarioCoincideConContacto = (
  destinatario: Partial<DestinatarioCotizacionInput> | undefined,
  contacto: Partial<DestinatarioCotizacionInput> | undefined
) =>
  normalizarTexto(destinatario?.nombre) === normalizarTexto(contacto?.nombre) &&
  normalizarTexto(destinatario?.apellido) === normalizarTexto(contacto?.apellido) &&
  normalizarTexto(destinatario?.telefono) === normalizarTexto(contacto?.telefono) &&
  normalizarTexto(destinatario?.email) === normalizarTexto(contacto?.email);

const inicial = (nombre?: string | null) => (nombre?.trim()?.[0] ?? "?").toUpperCase();

// `contactos`/`contactosDetalle` llegan con un límite inicial (ver
// buscarContactos) — esto busca en el servidor sobre el total cuando el
// usuario escribe, para poder encontrar contactos que no entraron en ese
// límite (ej. "Robson Grisales" si no está entre los primeros resultados).
async function buscarContactosComoOpciones(query: string): Promise<OpcionCombobox[]> {
  const resultados = await buscarContactosAction(query);
  return resultados.map((c) => ({
    valor: c.id,
    etiqueta: `${c.nombre} ${c.apellido}`.trim(),
    subtitulo: c.telefonoPrincipal ?? c.email ?? undefined,
    busqueda: [c.email, c.telefonoPrincipal].filter((v): v is string => !!v),
  }));
}

function scrollASeccion(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const SECCIONES = [
  { id: "seccion-info", numero: 1, etiqueta: "Información general" },
  { id: "seccion-productos", numero: 2, etiqueta: "Productos y precios" },
  { id: "seccion-entrega", numero: 3, etiqueta: "Entrega y seguimiento" },
] as const;

export function FormCotizacion({
  contactos,
  contactosDetalle = [],
  empresas,
  productos = [],
  transportistas = [],
  oportunidadId,
  cotizacionId,
  numero,
  defaultValues,
  onSuccess,
  onCerrar,
  contactoOrigen,
  contactoFijo = false,
  empresaFija = false,
  monedaDefault = "PEN",
}: FormCotizacionProps) {
  const router = useRouter();
  const hayContactoOrigen = tieneContactoOrigen(contactoOrigen);
  const modoEdicion = !!cotizacionId;

  // Al crear, `defaultValues.destinatario` siempre nace igual a `contactoOrigen`
  // (ver <SheetNuevaCotizacion>), así que esto da checked por defecto como antes.
  // Al editar, compara el destinatario guardado contra el contacto vigente: si
  // coinciden, el checkbox estaba marcado cuando se guardó → mostrar la
  // tarjeta del contacto; si no, se había editado a mano → mostrar el
  // formulario con esos datos propios.
  const coincideConContacto = hayContactoOrigen && destinatarioCoincideConContacto(defaultValues?.destinatario, contactoOrigen);

  const [editandoCliente, setEditandoCliente] = useState(
    hayContactoOrigen
      ? !coincideConContacto
      : !!(defaultValues?.destinatario?.nombre || defaultValues?.destinatario?.apellido ||
           defaultValues?.destinatario?.telefono || defaultValues?.destinatario?.email) &&
        !defaultValues?.contactoId
  );
  const [usarInfoContacto, setUsarInfoContacto] = useState(coincideConContacto);

  const form = useForm<CrearCotizacionInput>({
    resolver: zodResolver(CrearCotizacionSchema),
    defaultValues: {
      estado: "BORRADOR",
      moneda: monedaDefault,
      // Nueva cotización siempre arranca en 0% — para edición, `defaultValues`
      // (pasado por la página de editar) trae el % real y pisa este valor.
      impuesto: 0,
      notas: "",
      contactoId: "",
      empresaId: "",
      oportunidadId: oportunidadId ?? "",
      destinatario: { nombre: "", apellido: "", telefono: "", email: "" },
      entrega: { metodoEntrega: "COURIER_EXTERNO", estadoEntrega: "PENDIENTE", costoEnvio: 0 },
      servicio: { hora: "", duracion: "", ubicacion: "", direccion: "", responsable: "", instrucciones: "", observaciones: "" },
      entregaDigital: { email: "", url: "", archivo: "", codigo: "", usuarioAcceso: "", instrucciones: "", observaciones: "" },
      lineas: [{ descripcion: "", productoId: "", cantidad: 1, precioUnitario: 0, descuento: 0 }],
      ...defaultValues,
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lineas" });

  const lineas = form.watch("lineas");
  const impuesto = form.watch("impuesto") ?? 0;
  const moneda = form.watch("moneda") ?? "PEN";
  const contactoIdSeleccionado = form.watch("contactoId");
  const metodoEntrega = form.watch("entrega.metodoEntrega") ?? "COURIER_EXTERNO";
  const conRastreo = !METODOS_SIN_RASTREO.has(metodoEntrega);

  const costoEnvio = form.watch("entrega.costoEnvio") ?? 0;

  // Igual que en el servidor (ver resolverTipoCumplimiento en actions.ts):
  // primera línea con producto vinculado decide el bloque; sin producto en
  // ninguna línea, Físico por defecto. Solo para mostrar el bloque correcto
  // en este formulario — el servidor vuelve a resolverlo al guardar.
  const productoTipoPorId = useMemo(
    () => new Map(productos.map((p) => [p.id, p.tipo])),
    [productos]
  );
  const tipoCumplimiento = useMemo<TipoProducto>(() => {
    const primeraConProducto = lineas.find((l) => l.productoId && productoTipoPorId.has(l.productoId));
    if (!primeraConProducto?.productoId) return "FISICO";
    return productoTipoPorId.get(primeraConProducto.productoId) ?? "FISICO";
  }, [lineas, productoTipoPorId]);

  const subtotal = lineas.reduce((acc, l) => {
    const base = (l.cantidad ?? 0) * (l.precioUnitario ?? 0);
    return acc + base * (1 - (l.descuento ?? 0) / 100);
  }, 0);
  const impuestoMonto = subtotal * (impuesto / 100);
  const total = subtotal + impuestoMonto + costoEnvio;

  // Contacto para la tarjeta compacta: el de la oportunidad (contactoFijo) o,
  // si el usuario lo eligió del combobox, el que coincide en contactosDetalle.
  const contactoCompacto = useMemo(() => {
    if (hayContactoOrigen) {
      return {
        nombre: [contactoOrigen?.nombre, contactoOrigen?.apellido].filter(Boolean).join(" ") || "Contacto",
        telefono: contactoOrigen?.telefono || null,
        email: contactoOrigen?.email || null,
      };
    }
    const c = contactosDetalle.find((x) => x.id === contactoIdSeleccionado);
    if (!c) return null;
    return { nombre: `${c.nombre} ${c.apellido}`.trim(), telefono: c.telefonoPrincipal, email: c.email };
  }, [hayContactoOrigen, contactoOrigen, contactosDetalle, contactoIdSeleccionado]);

  const handleToggleInfoContacto = (checked: boolean) => {
    setUsarInfoContacto(checked);
    if (checked && contactoOrigen) {
      form.setValue("destinatario.nombre", contactoOrigen.nombre ?? "");
      form.setValue("destinatario.apellido", contactoOrigen.apellido ?? "");
      form.setValue("destinatario.telefono", contactoOrigen.telefono ?? "");
      form.setValue("destinatario.email", contactoOrigen.email ?? "");
    }
  };

  const transportistasFiltrados = transportistas.filter((t) => t.activo && t.tipo === metodoEntrega);

  const guardar = async (datos: CrearCotizacionInput) => {
    if (modoEdicion) {
      const resultado = await actualizarCotizacion(cotizacionId!, datos);
      if (resultado.exito) {
        toast.success("Cotización actualizada correctamente");
        if (onSuccess) onSuccess();
        else router.push(`/sales/cotizaciones/${cotizacionId}`);
      } else {
        toast.error(resultado.error);
      }
    } else {
      const resultado = await crearCotizacion(datos);
      if (resultado.exito) {
        toast.success("Cotización creada correctamente");
        if (onSuccess) onSuccess();
        else if (oportunidadId) router.push(`/crm/oportunidades/${oportunidadId}`);
        else router.push("/sales/cotizaciones");
      } else {
        toast.error(resultado.error);
      }
    }
  };

  const cerrar = () => (onCerrar ? onCerrar() : router.back());

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(guardar)} className="flex flex-col flex-1 min-h-0">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-stone-100 dark:border-white/5 bg-white/95 dark:bg-stone-950/95 backdrop-blur px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-lg bg-lime-500/10 dark:bg-lime-400/10 p-1.5 flex-shrink-0">
              <FileText className="h-4 w-4 text-lime-600 dark:text-lime-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                {modoEdicion ? `Editar ${numero ?? "cotización"}` : "Nueva cotización"}
              </h2>
              {contactoCompacto && (
                <p className="text-xs text-stone-400 dark:text-stone-500 truncate">{contactoCompacto.nombre}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button type="submit" variant="outline" size="sm" disabled={form.formState.isSubmitting}>
              Guardar borrador
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={form.formState.isSubmitting}
              className="bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-sm transition-all hover:scale-[1.02]"
            >
              {form.formState.isSubmitting
                ? modoEdicion ? "Guardando..." : "Creando..."
                : modoEdicion ? "Guardar cambios" : "Crear cotización"}
            </Button>
            <button
              type="button"
              onClick={cerrar}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/5 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Nav de secciones (solo scroll, no wizard) ─────────────── */}
        <div className="flex items-center gap-2 px-6 py-2.5 text-xs text-stone-400 dark:text-stone-500 border-b border-stone-100 dark:border-white/5 flex-shrink-0 overflow-x-auto">
          {SECCIONES.map((s, i) => (
            <span key={s.id} className="flex items-center gap-2 whitespace-nowrap">
              {i > 0 && <span className="text-stone-300 dark:text-white/10">—</span>}
              <button
                type="button"
                onClick={() => scrollASeccion(s.id)}
                className="flex items-center gap-1.5 hover:text-lime-600 dark:hover:text-lime-400 transition-colors"
              >
                <span className="flex items-center justify-center h-4 w-4 rounded-full border border-current text-[10px]">
                  {s.numero}
                </span>
                {s.id === "seccion-entrega" ? ETIQUETA_SECCION_CUMPLIMIENTO[tipoCumplimiento] : s.etiqueta}
              </button>
            </span>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* ── 1. Información general ─────────────────────────────── */}
          <section id="seccion-info" className="space-y-4 scroll-mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="moneda" render={({ field }) => (
                <FormItem>
                  <FormLabel>Moneda</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "PEN"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue>{(field.value ?? "PEN") === "USD" ? "USD ($)" : "PEN (S/)"}</SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PEN">PEN (S/)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="impuesto" render={({ field }) => (
                <FormItem>
                  <FormLabel>IGV (%)</FormLabel>
                  <FormControl>
                    <DecimalInput value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <p className="text-[11px] text-stone-400 dark:text-stone-600">Por defecto 0%</p>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="fechaVencimiento" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de vencimiento</FormLabel>
                  <FormControl>
                    <SmartDatePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Selecciona fecha"
                      presets={["today", "plus5", "plus15", "plus1m", "custom"]}
                    />
                  </FormControl>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="empresaId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                  <FormControl>
                    <Combobox
                      opciones={empresas}
                      valor={field.value}
                      onChange={field.onChange}
                      placeholder="Seleccionar empresa..."
                      disabled={empresaFija}
                    />
                  </FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="contactoId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contacto *</FormLabel>
                  <FormControl>
                    <Combobox
                      opciones={contactos}
                      valor={field.value}
                      onChange={field.onChange}
                      placeholder="Seleccionar contacto..."
                      placeholderBusqueda="Buscar por nombre, teléfono o email..."
                      disabled={contactoFijo}
                      onBuscar={buscarContactosComoOpciones}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Tarjeta compacta del contacto, o campos completos si se está editando */}
            {contactoCompacto && !editandoCliente ? (
              <div className="flex items-center justify-between gap-4 rounded-xl bg-stone-50 dark:bg-white/[0.03] border border-stone-200/70 dark:border-white/5 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-lime-500/15 dark:bg-lime-400/10 text-lime-700 dark:text-lime-400 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    {inicial(contactoCompacto.nombre)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-800 dark:text-stone-200 truncate">{contactoCompacto.nombre}</p>
                    <div className="flex items-center gap-3 text-xs text-stone-400 dark:text-stone-500 truncate">
                      {contactoCompacto.telefono && (
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{contactoCompacto.telefono}</span>
                      )}
                      {contactoCompacto.email && (
                        <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{contactoCompacto.email}</span>
                      )}
                    </div>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditandoCliente(true)} className="gap-1.5 flex-shrink-0">
                  <Pencil className="h-3 w-3" />
                  Editar contacto
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-stone-200/70 dark:border-white/5 px-4 py-4 space-y-4">
                {hayContactoOrigen && (
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={usarInfoContacto}
                      onChange={(e) => handleToggleInfoContacto(e.target.checked)}
                      className="h-4 w-4 rounded border-stone-300 dark:border-white/20 text-lime-600 focus:ring-lime-500 accent-lime-500"
                    />
                    <span className="text-sm text-stone-600 dark:text-stone-400">
                      Usar información del contacto seleccionado
                    </span>
                  </label>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="destinatario.nombre" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Juan" {...field} value={field.value ?? ""} disabled={usarInfoContacto && hayContactoOrigen} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="destinatario.apellido" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellido</FormLabel>
                      <FormControl>
                        <Input placeholder="García" {...field} value={field.value ?? ""} disabled={usarInfoContacto && hayContactoOrigen} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="destinatario.telefono" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <PhoneInput value={field.value ?? ""} onChange={field.onChange} disabled={usarInfoContacto && hayContactoOrigen} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="destinatario.email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="juan@email.com" {...field} value={field.value ?? ""} disabled={usarInfoContacto && hayContactoOrigen} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                {contactoCompacto && (
                  <button type="button" onClick={() => setEditandoCliente(false)} className="text-xs text-stone-400 hover:text-lime-600 dark:hover:text-lime-400 transition-colors">
                    Volver a la vista compacta
                  </button>
                )}
              </div>
            )}
          </section>

          {/* ── 2. Productos y precios ─────────────────────────────── */}
          <section id="seccion-productos" className="space-y-3 scroll-mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Productos y precios</h3>
              <Button type="button" size="sm" variant="outline" onClick={() => append({ descripcion: "", productoId: "", cantidad: 1, precioUnitario: 0, descuento: 0 })}>
                <Plus className="h-4 w-4" />Agregar producto
              </Button>
            </div>

            <div className="rounded-xl border border-stone-200/70 dark:border-white/5 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 dark:bg-white/[0.03]">
                  <tr className="text-xs text-stone-500 dark:text-stone-400">
                    <th className="text-left px-3 py-2 font-medium">Producto / Descripción</th>
                    <th className="text-center px-3 py-2 font-medium w-32">Cantidad</th>
                    <th className="text-right px-3 py-2 font-medium w-24">Precio</th>
                    <th className="text-right px-3 py-2 font-medium w-20">Descuento</th>
                    <th className="text-right px-3 py-2 font-medium w-20">Impuesto</th>
                    <th className="text-right px-3 py-2 font-medium w-28">Subtotal</th>
                    <th className="w-9" />
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, idx) => {
                    const cantidad = lineas[idx]?.cantidad ?? 0;
                    const precio = lineas[idx]?.precioUnitario ?? 0;
                    const descuento = lineas[idx]?.descuento ?? 0;
                    const subLinea = cantidad * precio * (1 - descuento / 100);

                    return (
                      <tr key={field.id} className="border-t border-stone-100 dark:border-white/5">
                        <td className="px-2 py-1.5 min-w-[180px]">
                          {productos.length > 0 && (
                            <SelectorProductoLinea
                              productos={productos}
                              productoId={lineas[idx]?.productoId ?? ""}
                              onSeleccionar={(p) => {
                                form.setValue(`lineas.${idx}.productoId`, p.id);
                                form.setValue(`lineas.${idx}.descripcion`, p.nombre);
                                form.setValue(`lineas.${idx}.precioUnitario`, p.precio);
                              }}
                              onLimpiar={() => form.setValue(`lineas.${idx}.productoId`, "")}
                            />
                          )}
                          <Input
                            placeholder="Buscar producto o escribir descripción..."
                            className="h-8 text-sm"
                            {...form.register(`lineas.${idx}.descripcion`)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1 justify-center">
                            <button
                              type="button"
                              onClick={() => form.setValue(`lineas.${idx}.cantidad`, Math.max(0.01, Math.round((cantidad - 1) * 100) / 100))}
                              className="h-7 w-7 flex-shrink-0 rounded-md border border-stone-200 dark:border-white/10 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-white/5 flex items-center justify-center transition-colors"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <DecimalInput
                              className="h-7 w-14 text-sm text-center px-1"
                              value={lineas[idx]?.cantidad}
                              onChange={(valor) => form.setValue(`lineas.${idx}.cantidad`, valor)}
                            />
                            <button
                              type="button"
                              onClick={() => form.setValue(`lineas.${idx}.cantidad`, Math.round((cantidad + 1) * 100) / 100)}
                              className="h-7 w-7 flex-shrink-0 rounded-md border border-stone-200 dark:border-white/10 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-white/5 flex items-center justify-center transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <DecimalInput
                            className="h-8 text-sm text-right"
                            value={lineas[idx]?.precioUnitario}
                            onChange={(valor) => form.setValue(`lineas.${idx}.precioUnitario`, valor)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-0.5">
                            <DecimalInput
                              className="h-8 text-sm text-right"
                              value={lineas[idx]?.descuento}
                              onChange={(valor) => form.setValue(`lineas.${idx}.descuento`, valor)}
                            />
                            <span className="text-xs text-stone-400">%</span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right text-xs text-stone-400 dark:text-stone-500">
                          {impuesto}%
                        </td>
                        <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                          {moneda} {subLinea.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-1.5">
                          <Button
                            type="button" variant="ghost" size="icon"
                            className="h-7 w-7 text-stone-400 hover:text-destructive"
                            disabled={fields.length === 1}
                            onClick={() => remove(idx)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="border-t border-stone-100 dark:border-white/5 bg-stone-50/60 dark:bg-white/[0.02] px-4 py-3 flex flex-col items-end gap-1">
                <div className="flex gap-8 text-sm">
                  <span className="text-stone-500 dark:text-stone-400">Subtotal</span>
                  <span className="tabular-nums text-stone-700 dark:text-stone-300">{moneda} {subtotal.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex gap-8 text-sm">
                  <span className="text-stone-500 dark:text-stone-400">Impuesto ({impuesto}%)</span>
                  <span className="tabular-nums text-stone-700 dark:text-stone-300">{moneda} {impuestoMonto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
                </div>
                {costoEnvio > 0 && (
                  <div className="flex gap-8 text-sm">
                    <span className="text-stone-500 dark:text-stone-400">Costo de envío</span>
                    <span className="tabular-nums text-stone-700 dark:text-stone-300">{moneda} {costoEnvio.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex gap-8 items-baseline mt-1">
                  <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">Total</span>
                  <span className="text-lg font-bold tabular-nums text-stone-900 dark:text-stone-50">{moneda} {total.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <FormField control={form.control} name="notas" render={({ field }) => (
              <FormItem>
                <FormLabel>Notas</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Condiciones, términos de pago, notas adicionales..."
                    rows={2}
                    className="resize-none"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
              </FormItem>
            )} />
          </section>

          {/* ── 3. Entrega / Servicio / Entrega digital y seguimiento ── */}
          <section id="seccion-entrega" className="space-y-4 scroll-mt-4">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              {ETIQUETA_SECCION_CUMPLIMIENTO[tipoCumplimiento]}
            </h3>

            {tipoCumplimiento === "FISICO" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="entrega.metodoEntrega" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Método de entrega</FormLabel>
                      <Select
                        onValueChange={(v) => {
                          field.onChange(v);
                          const actual = transportistas.find((t) => t.id === form.getValues("entrega.transportistaId"));
                          if (actual && actual.tipo !== v) form.setValue("entrega.transportistaId", null);
                        }}
                        value={field.value ?? "COURIER_EXTERNO"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue>{METODO_ENTREGA_LABELS[field.value ?? "COURIER_EXTERNO"] ?? field.value}</SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(METODO_ENTREGA_LABELS).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-stone-400 dark:text-stone-600">Selecciona el método de entrega</p>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="entrega.estadoEntrega" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado de entrega</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? "PENDIENTE"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue>{ESTADO_ENTREGA_LABELS[field.value ?? "PENDIENTE"] ?? field.value}</SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(ESTADO_ENTREGA_LABELS).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>

                {/* Transportista: solo tiene sentido con métodos que sí implican envío rastreable */}
                {conRastreo && transportistasFiltrados.length > 0 && (
                  <FormField control={form.control} name="entrega.transportistaId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transportista</FormLabel>
                      <Select onValueChange={(v) => field.onChange(v === "__ninguno__" ? null : v)} value={field.value ?? "__ninguno__"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue>
                              {field.value ? (transportistas.find((t) => t.id === field.value)?.nombre ?? "Sin transportista") : "Sin transportista"}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__ninguno__">Sin transportista</SelectItem>
                          {transportistasFiltrados.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                )}

                {/* numeroGuia y urlSeguimiento no se capturan en la cotización —
                    todavía no existen a esa altura; se completan recién en el
                    Pedido al aprobar (ver aprobarCotizacion). */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="entrega.fechaEstimada" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha estimada de entrega <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                      <FormControl>
                        <SmartDatePicker
                          value={field.value ?? undefined}
                          onChange={field.onChange}
                          placeholder="Seleccionar fecha"
                          presets={["today", "plus5", "plus15", "custom"]}
                        />
                      </FormControl>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="entrega.costoEnvio" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Costo de envío <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                      <FormControl>
                        <DecimalInput
                          value={field.value ?? 0}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <p className="text-[11px] text-stone-400 dark:text-stone-600">Se suma al total, no cuenta como ganancia en reportes</p>
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="entrega.observaciones" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observaciones <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                    <FormControl>
                      <Textarea placeholder="Notas sobre la entrega..." rows={2} className="resize-none" {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )} />
              </>
            )}

            {tipoCumplimiento === "SERVICIO" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="servicio.modalidad" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modalidad <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? "__ninguna__"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue>{field.value ? MODALIDAD_SERVICIO_LABELS[field.value] : "Sin especificar"}</SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__ninguna__">Sin especificar</SelectItem>
                          {Object.entries(MODALIDAD_SERVICIO_LABELS).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="servicio.fecha" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                      <FormControl>
                        <SmartDatePicker
                          value={field.value ?? undefined}
                          onChange={field.onChange}
                          placeholder="Seleccionar fecha"
                          presets={["today", "plus5", "plus15", "custom"]}
                        />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="servicio.hora" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hora / franja horaria <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="10:00 am, mañana..." {...field} value={field.value ?? ""} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="servicio.duracion" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duración <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="1 hora, 2 sesiones..." {...field} value={field.value ?? ""} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="servicio.responsable" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsable / Técnico <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre del responsable..." {...field} value={field.value ?? ""} />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="servicio.ubicacion" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ubicación <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre del lugar..." {...field} value={field.value ?? ""} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="servicio.direccion" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Dirección completa..." {...field} value={field.value ?? ""} />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="servicio.instrucciones" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instrucciones <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                    <FormControl>
                      <Textarea placeholder="Instrucciones para el técnico o responsable..." rows={2} className="resize-none" {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="servicio.observaciones" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observaciones <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                    <FormControl>
                      <Textarea placeholder="Notas sobre el servicio..." rows={2} className="resize-none" {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )} />
              </>
            )}

            {tipoCumplimiento === "DIGITAL" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="entregaDigital.metodo" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Método <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? "__ninguno__"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue>{field.value ? METODO_ENTREGA_DIGITAL_LABELS[field.value] : "Sin especificar"}</SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__ninguno__">Sin especificar</SelectItem>
                          {Object.entries(METODO_ENTREGA_DIGITAL_LABELS).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="entregaDigital.email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="cliente@email.com" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="entregaDigital.url" render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL / Link <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} value={field.value ?? ""} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="entregaDigital.archivo" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Archivo / Recurso <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre del archivo o recurso..." {...field} value={field.value ?? ""} />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="entregaDigital.codigo" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código / Licencia <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Código de activación..." {...field} value={field.value ?? ""} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="entregaDigital.usuarioAcceso" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuario / Referencia <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Usuario de acceso..." {...field} value={field.value ?? ""} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="entregaDigital.fechaEntrega" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de entrega <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                      <FormControl>
                        <SmartDatePicker
                          value={field.value ?? undefined}
                          onChange={field.onChange}
                          placeholder="Seleccionar fecha"
                          presets={["today", "plus5", "plus15", "custom"]}
                        />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="entregaDigital.fechaExpiracion" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de expiración <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                    <FormControl>
                      <SmartDatePicker
                        value={field.value ?? undefined}
                        onChange={field.onChange}
                        placeholder="Seleccionar fecha"
                        presets={["today", "plus5", "plus15", "plus1m", "custom"]}
                      />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField control={form.control} name="entregaDigital.instrucciones" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instrucciones <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                    <FormControl>
                      <Textarea placeholder="Instrucciones de acceso o uso..." rows={2} className="resize-none" {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="entregaDigital.observaciones" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observaciones <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                    <FormControl>
                      <Textarea placeholder="Notas sobre la entrega digital..." rows={2} className="resize-none" {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )} />
              </>
            )}
          </section>
        </div>
      </form>
    </Form>
  );
}
