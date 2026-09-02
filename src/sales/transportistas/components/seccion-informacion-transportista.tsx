"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { editarTransportista, toggleTransportista } from "../actions";
import { EditarTransportistaSchema, type EditarTransportistaInput } from "../schema";
import { TIPO_TRANSPORTISTA_LABELS } from "../types";
import type { Transportista } from "../types";

const TIPOS = Object.entries(TIPO_TRANSPORTISTA_LABELS) as [string, string][];
const TIPOS_ITEMS = Object.fromEntries(TIPOS);

interface SeccionInformacionTransportistaProps {
  transportista: Transportista;
  puedeModificar: boolean;
}

// 022-transportistas-zonas-tarifas — pestaña "Información" del panel
// (FR-004/FR-005/FR-008).
export function SeccionInformacionTransportista({ transportista, puedeModificar }: SeccionInformacionTransportistaProps) {
  const [isPending, startTransition] = useTransition();
  const [isTogglePending, startToggleTransition] = useTransition();

  const form = useForm<EditarTransportistaInput>({
    resolver: zodResolver(EditarTransportistaSchema),
    defaultValues: {
      id: transportista.id,
      nombre: transportista.nombre,
      tipo: transportista.tipo as EditarTransportistaInput["tipo"],
      personaContacto: transportista.personaContacto ?? "",
      telefono: transportista.telefono ?? "",
      correoElectronico: transportista.correoElectronico ?? "",
      notasInternas: transportista.notasInternas ?? "",
    },
  });

  const onSubmit = (valores: EditarTransportistaInput) => {
    startTransition(async () => {
      const resultado = await editarTransportista(valores);
      if (!resultado.exito) toast.error(resultado.error);
      else toast.success("Cambios guardados");
    });
  };

  const handleToggle = () => {
    startToggleTransition(async () => {
      const resultado = await toggleTransportista(transportista.id);
      if (!resultado.exito) toast.error(resultado.error);
      else toast.success(transportista.activo ? "Transportista desactivado" : "Transportista activado");
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 max-w-xl">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="nombre"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input {...field} disabled={!puedeModificar} />
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
                <FormLabel>Tipo</FormLabel>
                <Select items={TIPOS_ITEMS} value={field.value} onValueChange={field.onChange} disabled={!puedeModificar}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TIPOS.map(([valor, etiqueta]) => <SelectItem key={valor} value={valor}>{etiqueta}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="personaContacto"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Persona de contacto</FormLabel>
                <FormControl>
                  <Input {...field} disabled={!puedeModificar} placeholder="Opcional" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="telefono"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono</FormLabel>
                <FormControl>
                  <Input {...field} disabled={!puedeModificar} placeholder="Opcional" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="correoElectronico"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Correo electrónico</FormLabel>
              <FormControl>
                <Input {...field} disabled={!puedeModificar} placeholder="Opcional" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notasInternas"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas internas</FormLabel>
              <FormControl>
                <Textarea {...field} disabled={!puedeModificar} placeholder="Solo visibles para tu equipo" rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {puedeModificar && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5 text-danger"
              disabled={isTogglePending}
              onClick={handleToggle}
            >
              {isTogglePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
              {transportista.activo ? "Desactivar transportista" : "Activar transportista"}
            </Button>

            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
