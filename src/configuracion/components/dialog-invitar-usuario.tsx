"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { UserPlus, Copy, Check, Loader2, Mail } from "lucide-react";
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
import { crearUsuario } from "@/configuracion/usuarios/actions";
import { CrearUsuarioSchema, type CrearUsuarioInput } from "@/configuracion/usuarios/schema";

interface DialogInvitarUsuarioProps {
  abierto: boolean;
  onCerrar: () => void;
  onExito: () => void;
}

export function DialogInvitarUsuario({ abierto, onCerrar, onExito }: DialogInvitarUsuarioProps) {
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<CrearUsuarioInput>({
    resolver: zodResolver(CrearUsuarioSchema),
    defaultValues: {
      nombre: "",
      email: "",
      tipo: "USUARIO",
      rol: "AGENTE",
      cargo: "",
      telefono: "",
    },
  });

  function handleCerrar() {
    form.reset();
    setInviteLink(null);
    setCopiado(false);
    onCerrar();
  }

  function copiarLink() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function onSubmit(datos: CrearUsuarioInput) {
    startTransition(async () => {
      const resultado = await crearUsuario({ ...datos, tipo: "USUARIO" });
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      if (resultado.datos.inviteLink) {
        setInviteLink(resultado.datos.inviteLink);
      }
      toast.success("Usuario invitado correctamente");
      onExito();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={handleCerrar}>
      <DialogContent className="bg-stone-950/95 backdrop-blur-xl border border-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-stone-50">
            <UserPlus className="h-5 w-5 text-lime-400" />
            Invitar usuario
          </DialogTitle>
        </DialogHeader>

        {inviteLink ? (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex gap-2 rounded-lg border border-lime-500/30 bg-lime-500/10 px-3 py-2.5">
              <Mail className="h-4 w-4 text-lime-400 mt-0.5 shrink-0" />
              <p className="text-stone-300 text-sm">
                Se envió un email de invitación a{" "}
                <span className="font-medium text-stone-100">{form.getValues("email")}</span>.
                También puedes compartir el link directamente:
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                readOnly
                value={inviteLink}
                className="bg-white/5 border-white/10 text-stone-400 text-xs font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copiarLink}
                className="shrink-0 border-white/10 bg-white/5 hover:bg-white/10 text-stone-300"
              >
                {copiado ? <Check className="h-4 w-4 text-lime-400" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              onClick={handleCerrar}
              className="rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 font-semibold"
            >
              Cerrar
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-stone-300">Nombre completo</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Juan Pérez"
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
                    <FormLabel className="text-stone-300">Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="juan@empresa.com"
                        className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="rol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-stone-300">Rol</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-white/5 border-white/10 text-stone-50">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="AGENTE">Agente</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cargo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-stone-300">Cargo</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ej: Vendedor"
                          className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="telefono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-stone-300">Teléfono <span className="text-stone-500">(opcional)</span></FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="+51 999 000 000"
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
                  className="flex-1 rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02] font-semibold"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar invitación"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
