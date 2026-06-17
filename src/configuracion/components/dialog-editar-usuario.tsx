"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { editarUsuario } from "@/configuracion/usuarios/actions";
import { EditarUsuarioSchema, type EditarUsuarioInput } from "@/configuracion/usuarios/schema";
import { ROL_LABELS, ROL_DESCRIPCION, ROLES_HUMANOS } from "@/shared/auth/permisos";
import type { UsuarioInstanciaDetalle } from "@/configuracion/usuarios/types";

interface DialogEditarUsuarioProps {
  usuario: UsuarioInstanciaDetalle | null;
  onCerrar: () => void;
  onExito: () => void;
}

export function DialogEditarUsuario({ usuario, onCerrar, onExito }: DialogEditarUsuarioProps) {
  const [isPending, startTransition] = useTransition();
  const esAgente = usuario?.tipo === "AGENTE";

  const form = useForm<EditarUsuarioInput>({
    resolver: zodResolver(EditarUsuarioSchema),
    values: {
      nombre: usuario?.nombre ?? "",
      rol: (usuario?.rol as EditarUsuarioInput["rol"]) ?? "AGENTE_VENTAS",
      cargo: usuario?.cargo ?? "",
      telefono: usuario?.telefono ?? "",
    },
  });

  function handleCerrar() {
    form.reset();
    onCerrar();
  }

  function onSubmit(datos: EditarUsuarioInput) {
    if (!usuario) return;
    startTransition(async () => {
      const resultado = await editarUsuario(usuario.id, datos);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Usuario actualizado");
      onExito();
    });
  }

  return (
    <Dialog open={!!usuario} onOpenChange={handleCerrar}>
      <DialogContent className="bg-stone-950/95 backdrop-blur-xl border border-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-stone-50">
            <Pencil className="h-5 w-5 text-lime-400" />
            Editar {esAgente ? "agente" : "usuario"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1 -mt-2 mb-2">
          <p className="text-xs uppercase tracking-wide text-stone-500">Email</p>
          <p className="text-sm text-stone-300">{usuario?.email}</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-stone-300">Nombre</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!esAgente && (
              <FormField
                control={form.control}
                name="rol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-stone-300">Rol</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-white/5 border-white/10 text-stone-50">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ROLES_HUMANOS.map((r) => (
                          <SelectItem key={r} value={r}>
                            <div className="flex flex-col">
                              <span>{ROL_LABELS[r]}</span>
                              {ROL_DESCRIPCION[r] && (
                                <span className="text-xs text-stone-400">{ROL_DESCRIPCION[r]}</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="cargo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-stone-300">
                    {esAgente ? "Descripción" : "Cargo"} <span className="text-stone-500">(opcional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!esAgente && (
              <FormField
                control={form.control}
                name="telefono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-stone-300">
                      Teléfono <span className="text-stone-500">(opcional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                className="flex-1 rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02] font-semibold"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
