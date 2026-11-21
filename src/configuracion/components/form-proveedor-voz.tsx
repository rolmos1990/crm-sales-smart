"use client";

import { useTransition, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from "@/components/ui/input-group";
import { crearProveedorVoz, actualizarProveedorVoz } from "@/configuracion/voz/actions";
import { ProveedorVozSchema, type ProveedorVozInput } from "@/configuracion/voz/schema";
import {
  PROVEEDORES_VOZ_IMPLEMENTADOS,
  MODELOS_POR_PROVEEDOR_VOZ,
  COSTO_HORA_INICIAL_VOZ,
} from "@/voz/proveedores/disponibles";

const ETIQUETA_PROVEEDOR: Record<string, string> = {
  ELEVENLABS: "ElevenLabs",
  OPENAI: "OpenAI",
  GROQ: "Groq",
  LOCAL: "Local",
};

/**
 * Datos de un proveedor ya creado, para precargar el formulario al editar.
 * NUNCA incluye la API key: la query no la devuelve al cliente, y un apiKey
 * vacío al guardar significa "conservar la vigente".
 */
export interface ProveedorVozExistente {
  id: string;
  alias: string;
  proveedor: ProveedorVozInput["proveedor"];
  baseUrl: string | null;
  modelo: string;
  prioridad: number;
  costoPorHora: string | null;
  limiteMinutosDia: number | null;
  timeoutMs: number;
  reintentosMax: number;
}

const VALORES_INICIALES: ProveedorVozInput = {
  alias: "",
  proveedor: "ELEVENLABS",
  apiKey: "",
  baseUrl: "",
  modelo: MODELOS_POR_PROVEEDOR_VOZ.ELEVENLABS[0],
  prioridad: 1,
  costoPorHora: COSTO_HORA_INICIAL_VOZ.ELEVENLABS,
  limiteMinutosDia: null,
  timeoutMs: 30000,
  reintentosMax: 2,
};

export function FormProveedorVoz({
  abierto,
  onOpenChange,
  existente,
  onExito,
}: {
  abierto: boolean;
  onOpenChange: (v: boolean) => void;
  existente?: ProveedorVozExistente | null;
  onExito: () => void;
}) {
  const [guardando, iniciarGuardado] = useTransition();
  const [verClave, setVerClave] = useState(false);
  const esEdicion = Boolean(existente);

  const form = useForm<ProveedorVozInput>({
    resolver: zodResolver(ProveedorVozSchema),
    defaultValues: VALORES_INICIALES,
  });

  useEffect(() => {
    if (!abierto) return;
    form.reset(
      existente
        ? {
            alias: existente.alias,
            proveedor: existente.proveedor,
            apiKey: "",
            baseUrl: existente.baseUrl ?? "",
            modelo: existente.modelo,
            prioridad: existente.prioridad,
            costoPorHora: existente.costoPorHora ? Number(existente.costoPorHora) : null,
            limiteMinutosDia: existente.limiteMinutosDia,
            timeoutMs: existente.timeoutMs,
            reintentosMax: existente.reintentosMax,
          }
        : VALORES_INICIALES,
    );
    setVerClave(false);
  }, [abierto, existente, form]);

  // La firma la impone el Select de base-ui: (value, eventDetails) y el value
  // puede ser null al limpiar la selección.
  function alCambiarProveedor(valor: ProveedorVozInput["proveedor"] | null) {
    if (!valor) return;
    form.setValue("proveedor", valor);
    const sugeridos = MODELOS_POR_PROVEEDOR_VOZ[valor];
    if (sugeridos?.[0]) form.setValue("modelo", sugeridos[0]);
    // El costo también: entre servicios difiere en un orden de magnitud, y
    // arrastrar el del anterior deja un gasto estimado que no se parece al
    // real sin que nada lo señale.
    form.setValue("costoPorHora", COSTO_HORA_INICIAL_VOZ[valor]);
  }

  function onSubmit(datos: ProveedorVozInput) {
    iniciarGuardado(async () => {
      const r = existente
        ? await actualizarProveedorVoz(existente.id, datos)
        : await crearProveedorVoz(datos);

      if (!r.exito) {
        toast.error(r.error);
        return;
      }
      toast.success(esEdicion ? "Proveedor actualizado" : "Proveedor creado");
      onOpenChange(false);
      onExito();
    });
  }

  const modelosSugeridos =
    MODELOS_POR_PROVEEDOR_VOZ[form.watch("proveedor") as keyof typeof MODELOS_POR_PROVEEDOR_VOZ] ?? [];

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Editar proveedor de voz" : "Nuevo proveedor de voz"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="alias"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="ElevenLabs principal" {...field} />
                  </FormControl>
                  <FormDescription>Para distinguirlo si cargás más de uno.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="proveedor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Servicio</FormLabel>
                  {/* `items` es obligatorio: el value no es idéntico a la
                      etiqueta visible y sin esto el trigger mostraría el valor
                      crudo hasta abrir el popup una vez (ver docs/selects.md). */}
                  <Select
                    value={field.value}
                    onValueChange={alCambiarProveedor}
                    items={ETIQUETA_PROVEEDOR}
                    disabled={esEdicion}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PROVEEDORES_VOZ_IMPLEMENTADOS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {ETIQUETA_PROVEEDOR[p] ?? p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {esEdicion && (
                    <FormDescription>
                      El servicio no se puede cambiar. Creá otro proveedor si querés usar uno distinto.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API key</FormLabel>
                  <FormControl>
                    <InputGroup>
                      <InputGroupInput
                        type={verClave ? "text" : "password"}
                        placeholder={esEdicion ? "Dejar vacío para conservar la actual" : "sk-..."}
                        {...field}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          type="button"
                          onClick={() => setVerClave((v) => !v)}
                          aria-label={verClave ? "Ocultar" : "Mostrar"}
                        >
                          {verClave ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                  </FormControl>
                  <FormDescription>
                    Se guarda cifrada y no vuelve a mostrarse.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="modelo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo</FormLabel>
                    <FormControl>
                      <Input list="modelos-voz" {...field} />
                    </FormControl>
                    <datalist id="modelos-voz">
                      {modelosSugeridos.map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="costoPorHora"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Costo por hora</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Sugerido según el servicio. Ajustalo a tu factura; vacío no estima nada.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="prioridad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridad</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>Mayor gana si hay varios activos.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="limiteMinutosDia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tope diario (minutos)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Sin tope"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="baseUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL base (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://api.elevenlabs.io" {...field} />
                  </FormControl>
                  <FormDescription>Solo si usás una región o un proxy distinto.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando}>
                {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {esEdicion ? "Guardar" : "Crear"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
