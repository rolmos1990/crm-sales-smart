"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Bot, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { crearUsuario } from "@/configuracion/usuarios/actions";
import { CrearUsuarioSchema, type CrearUsuarioInput } from "@/configuracion/usuarios/schema";

interface DialogNuevoAgenteProps {
  abierto: boolean;
  onCerrar: () => void;
  onExito: () => void;
}

export function DialogNuevoAgente({ abierto, onCerrar, onExito }: DialogNuevoAgenteProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<CrearUsuarioInput>({
    resolver: zodResolver(CrearUsuarioSchema),
    defaultValues: {
      nombre: "",
      email: "",
      tipo: "AGENTE",
      rol: "AGENTE",
      cargo: "",
      telefono: "",
    },
  });

  function handleCerrar() {
    form.reset();
    onCerrar();
  }

  function onSubmit(datos: CrearUsuarioInput) {
    startTransition(async () => {
      const resultado = await crearUsuario({ ...datos, tipo: "AGENTE", rol: "AGENTE" });
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Agente creado correctamente");
      form.reset();
      onExito();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={handleCerrar}>
      <DialogContent className="bg-stone-950/95 backdrop-blur-xl border border-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-stone-50">
            <Bot className="h-5 w-5 text-purple-400" />
            Nuevo agente
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-stone-400 -mt-2">
          Un agente es una identidad del sistema (bot, IA) que puede asignarse a tareas y conversaciones sin necesitar login.
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-stone-300">Nombre del agente</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ej: Bot de ventas"
                      className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-stone-300">
                    Email de referencia <span className="text-stone-500">(identificador interno)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="bot@empresa.com"
                      className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cargo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-stone-300">
                    Descripción <span className="text-stone-500">(opcional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ej: Asistente de atención al cliente"
                      className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCerrar}
                className="flex-1 border-white/10 bg-white/5 hover:bg-white/10 text-stone-300"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="flex-1 rounded-xl bg-purple-500/90 text-stone-50 hover:bg-purple-400 shadow-lg transition-all hover:scale-[1.02] font-semibold"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear agente"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
