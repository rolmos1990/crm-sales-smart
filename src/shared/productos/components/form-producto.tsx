"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CampoCodigoLicencia } from "@/shared/ui/campo-codigo-licencia";
import { crearProducto, actualizarProducto } from "../actions";
import { CrearProductoSchema, type CrearProductoInput } from "../schema";
import { TIPO_PRODUCTO_LABELS, type Producto, type TipoProducto } from "../types";
import { MediaUploader } from "@/components/media/media-uploader";
import { vincularMediaArchivo } from "@/lib/media/server-actions";

const METODO_ENTREGA_DIGITAL_LABELS: Record<string, string> = {
  EMAIL: "Email",
  LINK: "Link",
  DESCARGA: "Descarga",
  ACCESO: "Acceso",
  LICENCIA: "Licencia",
  MANUAL: "Manual",
  OTRO: "Otro",
};

interface FormProductoProps {
  instanciaId: string;
  inicial?: Partial<Producto>;
  modo?: "crear" | "editar";
  monedaDefault?: string;
}

export function FormProducto({ instanciaId, inicial, modo = "crear", monedaDefault = "PEN" }: FormProductoProps) {
  const router = useRouter();
  const [productoId, setProductoId] = useState<string | null>(inicial?.id ?? null);
  const [pendingMediaId, setPendingMediaId] = useState<string | null>(null);

  const form = useForm<CrearProductoInput>({
    resolver: zodResolver(CrearProductoSchema),
    defaultValues: {
      sku: inicial?.sku ?? "",
      nombre: inicial?.nombre ?? "",
      descripcion: inicial?.descripcion ?? "",
      precio: inicial?.precio ?? 0,
      moneda: inicial?.moneda ?? monedaDefault,
      categoria: inicial?.categoria ?? "",
      tipo: inicial?.tipo ?? "FISICO",
      unidad: inicial?.unidad ?? "",
      imagenUrl: inicial?.imagenUrl ?? "",
      activo: inicial?.activo ?? true,
      manejaStock: inicial?.manejaStock ?? false,
      cantidadDisponible: inicial?.cantidadDisponible ?? 0,
      entregaDigital: {
        metodo: inicial?.entregaDigital?.metodo ?? undefined,
        url: inicial?.entregaDigital?.url ?? "",
        archivo: inicial?.entregaDigital?.archivo ?? "",
        usuarioAcceso: inicial?.entregaDigital?.usuarioAcceso ?? "",
        instrucciones: inicial?.entregaDigital?.instrucciones ?? "",
        observaciones: inicial?.entregaDigital?.observaciones ?? "",
        requiereSeguimiento: inicial?.entregaDigital?.requiereSeguimiento ?? false,
        tipoSeguimiento: inicial?.entregaDigital?.tipoSeguimiento ?? "",
        // Sin acción todavía — el componente solo la usa si ya hay código.
        codigoAccion: inicial?.entregaDigital?.tieneCodigoConfigurado ? "CONSERVAR" : undefined,
        codigoNuevo: "",
      },
    },
  });

  const tipo = form.watch("tipo") ?? "FISICO";
  const codigoAccion = form.watch("entregaDigital.codigoAccion") ?? "CONSERVAR";
  const codigoNuevo = form.watch("entregaDigital.codigoNuevo") ?? "";

  const onSubmit = async (datos: CrearProductoInput) => {
    if (modo === "crear") {
      const resultado = await crearProducto(datos);
      if (!resultado.exito) { toast.error(resultado.error); return; }
      const nuevoId = resultado.datos.id;
      setProductoId(nuevoId);
      if (pendingMediaId) {
        await vincularMediaArchivo(pendingMediaId, nuevoId, "producto");
      }
      toast.success("Producto creado");
      router.push("/productos");
    } else {
      const resultado = await actualizarProducto(inicial!.id!, datos);
      if (resultado.exito) {
        toast.success("Producto actualizado");
        router.push("/productos");
      } else {
        toast.error(resultado.error);
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

        {/* SKU + Nombre */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FormField control={form.control} name="sku" render={({ field }) => (
            <FormItem>
              <FormLabel>SKU / Código</FormLabel>
              <FormControl>
                <Input
                  placeholder="PROD-001"
                  {...field}
                  value={field.value ?? ""}
                  className="font-mono"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <div className="md:col-span-3">
            <FormField control={form.control} name="nombre" render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre *</FormLabel>
                <FormControl>
                  <Input placeholder="Servicio de consultoría..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        {/* Precio + Moneda + Unidad */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField control={form.control} name="precio" render={({ field }) => (
            <FormItem>
              <FormLabel>Precio *</FormLabel>
              <FormControl>
                <Input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={field.value ?? ""}
                  onChange={(e) => {
                    const valor = e.target.valueAsNumber;
                    field.onChange(Number.isNaN(valor) ? undefined : valor);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="moneda" render={({ field }) => (
            <FormItem>
              <FormLabel>Moneda</FormLabel>
              {/* value controlled para evitar hydration mismatch */}
              <Select onValueChange={field.onChange} value={field.value ?? "PEN"}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="PEN">PEN (S/)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )} />
          <FormField control={form.control} name="unidad" render={({ field }) => (
            <FormItem>
              <FormLabel>Unidad</FormLabel>
              <FormControl>
                <Input placeholder="unid, hora, kg..." {...field} value={field.value ?? ""} />
              </FormControl>
            </FormItem>
          )} />
        </div>

        {/* Tipo + Categoría */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="tipo" render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo</FormLabel>
              {/* Determina qué bloque de cumplimiento usa la Cotización/Pedido
                  que incluya este producto (Entrega / Servicio / Entrega
                  digital y seguimiento) — ver form-cotizacion.tsx. */}
              <Select onValueChange={field.onChange} value={field.value ?? "FISICO"}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {(Object.keys(TIPO_PRODUCTO_LABELS) as TipoProducto[]).map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>{TIPO_PRODUCTO_LABELS[tipo]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )} />
          <FormField control={form.control} name="categoria" render={({ field }) => (
            <FormItem>
              <FormLabel>Categoría</FormLabel>
              <FormControl>
                <Input placeholder="Software, Consultoría, Hardware..." {...field} value={field.value ?? ""} />
              </FormControl>
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="descripcion" render={({ field }) => (
          <FormItem>
            <FormLabel>Descripción</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Descripción detallada del producto o servicio..."
                className="resize-none"
                rows={3}
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
          </FormItem>
        )} />

        {/* Imagen */}
        <FormField control={form.control} name="imagenUrl" render={({ field }) => (
          <FormItem>
            <FormLabel>Imagen del producto</FormLabel>
            <MediaUploader
              instanciaId={instanciaId}
              modulo="productos"
              entidadId={productoId ?? undefined}
              entidadTipo="producto"
              value={field.value ?? ""}
              onChange={(url, mediaId) => {
                field.onChange(url);
                if (mediaId) setPendingMediaId(mediaId);
              }}
            />
            <FormMessage />
          </FormItem>
        )} />

        {/* Entrega digital — solo cuando tipo = DIGITAL. Estos son los
            valores por defecto (plantilla) que se copian a cada línea de
            Cotización/Pedido que use este producto; el agente los puede
            personalizar después sin afectar al producto. */}
        {tipo === "DIGITAL" && (
          <div className="rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 p-4 space-y-4">
            <p className="text-sm font-medium text-stone-700 dark:text-stone-300">
              Entrega digital
              <span className="text-xs font-normal text-stone-400 dark:text-stone-500 ml-1">
                (valores por defecto — se copian a cada cotización/pedido)
              </span>
            </p>

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
              <FormItem>
                <FormLabel>Código / Licencia <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                <CampoCodigoLicencia
                  origen="producto"
                  tieneCodigoConfigurado={inicial?.entregaDigital?.tieneCodigoConfigurado ?? false}
                  accion={codigoAccion === "REEMPLAZAR" ? "REEMPLAZAR" : "CONSERVAR"}
                  onAccionChange={(a) => form.setValue("entregaDigital.codigoAccion", a)}
                  valorNuevo={codigoNuevo}
                  onValorNuevoChange={(v) => {
                    form.setValue("entregaDigital.codigoNuevo", v);
                    // Escribir acá siempre implica "usar este valor" — tanto si
                    // reemplaza uno existente como si es el primero que se configura.
                    form.setValue("entregaDigital.codigoAccion", "REEMPLAZAR");
                  }}
                />
              </FormItem>
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
              <FormField control={form.control} name="entregaDigital.usuarioAcceso" render={({ field }) => (
                <FormItem>
                  <FormLabel>Usuario / Referencia <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="Usuario de acceso..." {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="entregaDigital.tipoSeguimiento" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de seguimiento <span className="text-stone-400 font-normal">(opcional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Activación" {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="entregaDigital.requiereSeguimiento" render={({ field }) => (
                <FormItem>
                  <FormLabel>Requiere seguimiento</FormLabel>
                  <div className="h-9 flex items-center">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={field.value}
                      onClick={() => field.onChange(!field.value)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        field.value ? "bg-lime-500 dark:bg-lime-500" : "bg-stone-300 dark:bg-white/20"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        field.value ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </button>
                  </div>
                </FormItem>
              )} />
            </div>

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
                  <Textarea placeholder="Notas adicionales..." rows={2} className="resize-none" {...field} value={field.value ?? ""} />
                </FormControl>
              </FormItem>
            )} />
          </div>
        )}

        {/* Control de stock */}
        <div className="rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-stone-400" />
                Control de inventario
              </p>
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                Activar para validar stock al crear pedidos
              </p>
            </div>
            <FormField control={form.control} name="manejaStock" render={({ field }) => (
              <button
                type="button"
                role="switch"
                aria-checked={field.value}
                onClick={() => field.onChange(!field.value)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  field.value
                    ? "bg-lime-500 dark:bg-lime-500"
                    : "bg-stone-300 dark:bg-white/20"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  field.value ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            )} />
          </div>

          {form.watch("manejaStock") && (
            <FormField control={form.control} name="cantidadDisponible" render={({ field }) => (
              <FormItem>
                <FormLabel>Cantidad disponible en stock</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={field.value ?? 0}
                    onChange={(e) => {
                      const valor = e.target.valueAsNumber;
                      field.onChange(Number.isNaN(valor) ? undefined : valor);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          )}
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? (modo === "crear" ? "Creando..." : "Guardando...")
              : (modo === "crear" ? "Crear producto" : "Guardar cambios")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
