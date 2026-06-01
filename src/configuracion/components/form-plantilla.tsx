"use client";

import { useRef, useState } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CrearPlantillaSchema,
  normalizarAlias,
  type CrearPlantillaInput,
} from "@/configuracion/plantillas/schema";
import {
  VARIABLES,
  CATEGORY_LABELS,
  getVariablesByCategory,
  type VariableDefinition,
} from "@/configuracion/plantillas/variable-defs";
import { crearPlantilla, actualizarPlantilla } from "@/configuracion/plantillas/actions";
import type { Plantilla } from "@/configuracion/plantillas/types";
import { MediaUploader } from "@/components/media/media-uploader";
import { vincularMediaArchivo } from "@/lib/media/server-actions";
import {
  EditorContenidoPlantilla,
  type EditorContenidoHandle,
} from "./editor-contenido-plantilla";
import { VistaPreviaPlantilla } from "./vista-previa-plantilla";

interface FormPlantillaProps {
  instanciaId: string;
  inicial?: Plantilla;
  modo?: "crear" | "editar";
  onExito?: () => void;
  onCancelar?: () => void;
}

export function FormPlantilla({
  instanciaId,
  inicial,
  modo = "crear",
  onExito,
  onCancelar,
}: FormPlantillaProps) {
  const [plantillaId, setPlantillaId] = useState<string | null>(inicial?.id ?? null);
  const [pendingMediaId, setPendingMediaId] = useState<string | null>(null);
  const [busquedaVar, setBusquedaVar] = useState("");
  const editorRef = useRef<EditorContenidoHandle>(null);

  const form = useForm<CrearPlantillaInput>({
    resolver: zodResolver(CrearPlantillaSchema),
    defaultValues: {
      nombre: inicial?.nombre ?? "",
      alias: inicial?.alias ?? "",
      descripcion: inicial?.descripcion ?? "",
      tipo: (inicial?.tipo as "TEXTO" | "TEXTO_IMAGEN") ?? "TEXTO",
      contenidoTexto: inicial?.contenidoTexto ?? "",
      imagenUrl: inicial?.imagenUrl ?? "",
      instanciaId,
    },
  });

  const tipo = useWatch({ control: form.control, name: "tipo" });
  const aliasValor = useWatch({ control: form.control, name: "alias" });
  const contenidoTexto = useWatch({ control: form.control, name: "contenidoTexto" }) ?? "";
  const aliasPreview = normalizarAlias(aliasValor ?? "");

  const onSubmit = async (datos: CrearPlantillaInput) => {
    if (modo === "crear") {
      const resultado = await crearPlantilla(datos);
      if (!resultado.exito) { toast.error(resultado.error); return; }
      const nuevoId = resultado.datos!.id;
      setPlantillaId(nuevoId);
      if (pendingMediaId) await vincularMediaArchivo(pendingMediaId, nuevoId, "plantilla");
      toast.success("Plantilla creada");
      form.reset();
      onExito?.();
    } else {
      const resultado = await actualizarPlantilla(inicial!.id, datos);
      if (resultado.exito) {
        toast.success("Plantilla actualizada");
        onExito?.();
      } else {
        toast.error(resultado.error ?? "Error al guardar");
      }
    }
  };

  const handleInsertarVariable = (variable: VariableDefinition) => {
    if (editorRef.current) {
      editorRef.current.insertVariable(variable);
      editorRef.current.focus();
    } else {
      const current = form.getValues("contenidoTexto") ?? "";
      form.setValue("contenidoTexto", current + `{{${variable.key}}}`, { shouldDirty: true });
    }
  };

  const variablesFiltradas = busquedaVar
    ? VARIABLES.filter(
        (v) =>
          v.label.toLowerCase().includes(busquedaVar.toLowerCase()) ||
          v.key.toLowerCase().includes(busquedaVar.toLowerCase()) ||
          v.description.toLowerCase().includes(busquedaVar.toLowerCase())
      )
    : null;

  const categorias = getVariablesByCategory();

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">

        {/* ── Sección 1: campos metadata — 2 columnas ─────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre *</FormLabel>
                  <FormControl><Input placeholder="Bienvenida" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="alias"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alias *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="bienvenida"
                      {...field}
                      onChange={(e) => field.onChange(normalizarAlias(e.target.value))}
                    />
                  </FormControl>
                  {aliasPreview && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-xs text-stone-500">Vista previa:</span>
                      <Badge className="font-mono text-xs bg-lime-500/10 text-lime-700 dark:text-lime-400 border border-lime-500/20 hover:bg-lime-500/10">
                        /{aliasPreview}
                      </Badge>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-3">
            <FormField
              control={form.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input placeholder="Mensaje de bienvenida para nuevos contactos" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de plantilla *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="TEXTO">TEXTO</SelectItem>
                      <SelectItem value="TEXTO_IMAGEN">Texto + imagen adjunta</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* ── Sección 2: tarjeta integrada editor + variables ──────────── */}
        <div>
          <p className="text-sm font-medium mb-1.5">
            Contenido <span className="text-red-400">*</span>
          </p>

          {/* Una sola tarjeta que contiene editor (izq) + variables (der) */}
          <div className="rounded-xl border border-white/10 overflow-hidden flex">

            {/* Columna izquierda: editor + vista previa */}
            <div className="flex-1 min-w-0 flex flex-col">
              <Controller
                control={form.control}
                name="contenidoTexto"
                render={({ field, fieldState }) => (
                  <>
                    {/* El editor sin su propio borde/redondeo — usa el del padre */}
                    <EditorContenidoPlantilla
                      ref={editorRef}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      className="rounded-none border-0 bg-transparent"
                    />
                    {fieldState.error && (
                      <p className="text-xs text-red-400 px-3 pb-2">{fieldState.error.message}</p>
                    )}
                  </>
                )}
              />

              {/* Vista previa integrada dentro de la misma tarjeta */}
              <div className="border-t border-white/8 bg-white/[0.01] px-3 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-stone-500">
                    Vista previa
                  </p>
                  <span className="text-[9px] text-stone-600 italic">
                    valores de ejemplo
                  </span>
                </div>
                <VistaPreviaPlantilla contenido={contenidoTexto} />
              </div>
            </div>

            {/* Columna derecha: panel de variables — pegado al editor */}
            <div className="w-[200px] shrink-0 border-l border-white/10 flex flex-col">
              {/* Header del panel */}
              <div className="px-3 py-2 border-b border-white/10 bg-white/[0.02]">
                <p className="text-[9px] font-bold uppercase tracking-widest text-stone-500">
                  Variables
                </p>
              </div>

              {/* Búsqueda */}
              <div className="px-2 py-2 border-b border-white/8">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-stone-600 pointer-events-none" />
                  <input
                    type="text"
                    value={busquedaVar}
                    onChange={(e) => setBusquedaVar(e.target.value)}
                    placeholder="Buscar…"
                    className="w-full pl-6 pr-2 py-1.5 text-[11px] bg-white/5 border border-white/8 rounded-lg text-stone-200 placeholder:text-stone-600 outline-none focus:border-lime-500/30 transition-colors"
                  />
                </div>
              </div>

              {/* Lista de variables con scroll */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2.5">
                {variablesFiltradas ? (
                  <div className="flex flex-wrap gap-1">
                    {variablesFiltradas.map((v) => (
                      <VariableChip key={v.key} variable={v} onInsert={handleInsertarVariable} />
                    ))}
                    {variablesFiltradas.length === 0 && (
                      <p className="text-xs text-stone-600 px-1">Sin resultados</p>
                    )}
                  </div>
                ) : (
                  categorias.map(([cat, vars]) => (
                    <div key={cat}>
                      <p className="text-[8px] font-bold uppercase tracking-widest text-stone-600 mb-1 px-1">
                        {CATEGORY_LABELS[cat]}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {vars.map((v) => (
                          <VariableChip key={v.key} variable={v} onInsert={handleInsertarVariable} />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Sección 3: imagen (solo TEXTO_IMAGEN) ────────────────────── */}
        {tipo === "TEXTO_IMAGEN" && (
          <FormField
            control={form.control}
            name="imagenUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Imagen adjunta (opcional)</FormLabel>
                <MediaUploader
                  instanciaId={instanciaId}
                  modulo="plantillas"
                  entidadId={plantillaId ?? undefined}
                  entidadTipo="plantilla"
                  value={field.value ?? ""}
                  onChange={(url, mediaId) => {
                    field.onChange(url);
                    if (mediaId) setPendingMediaId(mediaId);
                  }}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
          {onCancelar && (
            <Button type="button" variant="ghost" onClick={onCancelar}>
              Cancelar
            </Button>
          )}
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02]"
          >
            {form.formState.isSubmitting
              ? "Guardando..."
              : modo === "crear"
              ? "Crear plantilla"
              : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function VariableChip({
  variable,
  onInsert,
}: {
  variable: VariableDefinition;
  onInsert: (v: VariableDefinition) => void;
}) {
  return (
    <button
      type="button"
      title={`${variable.description}\nEjemplo: ${variable.sampleValue || "—"}\n{{${variable.key}}}`}
      onClick={() => onInsert(variable)}
      className={cn(
        "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all",
        "bg-white/5 border border-white/10 text-stone-400",
        "hover:bg-lime-500/15 hover:border-lime-500/30 hover:text-lime-300"
      )}
    >
      <span className="text-[11px]">{variable.icon}</span>
      <span>{variable.label}</span>
    </button>
  );
}
