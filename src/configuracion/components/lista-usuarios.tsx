"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Pencil,
  KeyRound,
  Link2,
  UserCheck,
  UserX,
  Copy,
  Check,
  Bot,
  User,
  UserPlus,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  cambiarEstadoUsuario,
  resetearPassword,
  generarLinkAcceso,
} from "@/configuracion/usuarios/actions";
import { DialogEditarUsuario } from "./dialog-editar-usuario";
import { DialogInvitarUsuario } from "./dialog-invitar-usuario";
import { DialogNuevoAgente } from "./dialog-nuevo-agente";
import type { UsuarioInstanciaDetalle } from "@/configuracion/usuarios/types";

interface ListaUsuariosProps {
  usuarios: UsuarioInstanciaDetalle[];
}

type Filtro = "todos" | "usuarios" | "agentes";

function badgeTipo(tipo: "USUARIO" | "AGENTE") {
  if (tipo === "AGENTE")
    return (
      <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 gap-1">
        <Bot className="h-3 w-3" /> Agente
      </Badge>
    );
  return (
    <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 gap-1">
      <User className="h-3 w-3" /> Usuario
    </Badge>
  );
}

function badgeEstado(estado: string, activo: boolean) {
  if (!activo || estado === "SUSPENDIDO")
    return <Badge className="bg-red-500/20 text-red-300 border-red-500/30">Suspendido</Badge>;
  if (estado === "INVITADO")
    return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">Invitado</Badge>;
  if (estado === "BLOQUEADO")
    return <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30">Bloqueado</Badge>;
  return <Badge className="bg-green-500/20 text-green-300 border-green-500/30">Activo</Badge>;
}

function badgeRol(rol: string) {
  if (rol === "OWNER")
    return <Badge className="bg-lime-500/20 text-lime-300 border-lime-500/30">Owner</Badge>;
  if (rol === "ADMIN")
    return <Badge className="bg-stone-400/20 text-stone-300 border-stone-400/30">Admin</Badge>;
  return <Badge variant="outline" className="text-stone-400 border-stone-600">Agente</Badge>;
}

function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function ListaUsuarios({ usuarios: usuariosIniciales }: ListaUsuariosProps) {
  const [usuarios, setUsuarios] = useState(usuariosIniciales);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [usuarioEditar, setUsuarioEditar] = useState<UsuarioInstanciaDetalle | null>(null);
  const [abrirInvitar, setAbrirInvitar] = useState(false);
  const [abrirAgente, setAbrirAgente] = useState(false);
  const [linkDialog, setLinkDialog] = useState<{ link: string; nombre: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [isPending, startTransition] = useTransition();

  const filtrados =
    filtro === "todos"
      ? usuarios
      : usuarios.filter((u) =>
          filtro === "usuarios" ? u.tipo === "USUARIO" : u.tipo === "AGENTE",
        );

  function recargar() {
    // Fuerza re-fetch vía router.refresh en el Server Component padre
    window.location.reload();
  }

  function handleCambiarEstado(u: UsuarioInstanciaDetalle) {
    startTransition(async () => {
      const activar = !u.activo || u.estado === "SUSPENDIDO";
      const resultado = await cambiarEstadoUsuario(u.id, activar);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success(activar ? "Usuario activado" : "Usuario suspendido");
      setUsuarios((prev) =>
        prev.map((x) =>
          x.id === u.id
            ? { ...x, activo: activar, estado: activar ? "ACTIVO" : "SUSPENDIDO" }
            : x,
        ),
      );
    });
  }

  function handleResetPassword(u: UsuarioInstanciaDetalle) {
    startTransition(async () => {
      const resultado = await resetearPassword(u.email);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success(`Email de reset enviado a ${u.email}`);
    });
  }

  function handleGenerarLink(u: UsuarioInstanciaDetalle) {
    startTransition(async () => {
      const resultado = await generarLinkAcceso(u.id);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      setLinkDialog({ link: resultado.datos.link, nombre: u.nombre });
    });
  }

  function copiarLink() {
    if (!linkDialog) return;
    navigator.clipboard.writeText(linkDialog.link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header con filtros y acciones */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
          {(["todos", "usuarios", "agentes"] as Filtro[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-lg transition-all capitalize",
                filtro === f
                  ? "bg-stone-800 text-stone-50 shadow"
                  : "text-stone-400 hover:text-stone-200",
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAbrirAgente(true)}
            className="gap-1.5 border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 rounded-xl"
          >
            <Bot className="h-4 w-4" /> Nuevo agente
          </Button>
          <Button
            size="sm"
            onClick={() => setAbrirInvitar(true)}
            className="gap-1.5 rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-lg font-semibold"
          >
            <UserPlus className="h-4 w-4" /> Invitar usuario
          </Button>
        </div>
      </div>

      {/* Tabla */}
      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="p-4 rounded-2xl bg-white/5">
            <UserPlus className="h-7 w-7 text-stone-500" />
          </div>
          <p className="text-stone-400 text-sm">No hay miembros en esta categoría</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-stone-400 font-medium">Miembro</TableHead>
                <TableHead className="text-stone-400 font-medium">Tipo</TableHead>
                <TableHead className="text-stone-400 font-medium">Rol</TableHead>
                <TableHead className="text-stone-400 font-medium">Estado</TableHead>
                <TableHead className="text-stone-400 font-medium">Último acceso</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((u) => (
                <TableRow key={u.id} className="border-white/10 hover:bg-white/3">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback
                          className={cn(
                            "text-xs font-semibold",
                            u.tipo === "AGENTE"
                              ? "bg-purple-500/20 text-purple-300"
                              : "bg-lime-500/20 text-lime-300",
                          )}
                        >
                          {iniciales(u.nombre)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-stone-100 truncate">{u.nombre}</span>
                        <span className="text-xs text-stone-500 truncate">{u.email}</span>
                        {u.cargo && (
                          <span className="text-xs text-stone-500 italic truncate">{u.cargo}</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{badgeTipo(u.tipo)}</TableCell>
                  <TableCell>{badgeRol(u.rol)}</TableCell>
                  <TableCell>{badgeEstado(u.estado, u.activo)}</TableCell>
                  <TableCell className="text-xs text-stone-500">
                    {u.ultimoLogin
                      ? new Intl.DateTimeFormat("es", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }).format(new Date(u.ultimoLogin))
                      : u.tipo === "AGENTE"
                        ? "—"
                        : "Sin acceso"}
                  </TableCell>
                  <TableCell>
                    {u.rol !== "OWNER" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:text-stone-200 hover:bg-white/8 transition-all outline-none disabled:opacity-50"
                            disabled={isPending}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-stone-900/95 backdrop-blur border-white/10"
                        >
                          <DropdownMenuItem
                            onClick={() => setUsuarioEditar(u)}
                            className="text-stone-200 focus:bg-white/8 cursor-pointer gap-2"
                          >
                            <Pencil className="h-4 w-4" /> Editar
                          </DropdownMenuItem>

                          {u.tipo === "USUARIO" && (
                            <>
                              <DropdownMenuItem
                                onClick={() => handleGenerarLink(u)}
                                className="text-stone-200 focus:bg-white/8 cursor-pointer gap-2"
                              >
                                <Link2 className="h-4 w-4" /> Copiar link de acceso
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleResetPassword(u)}
                                className="text-stone-200 focus:bg-white/8 cursor-pointer gap-2"
                              >
                                <KeyRound className="h-4 w-4" /> Resetear contraseña
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-white/10" />
                            </>
                          )}

                          {u.tipo === "AGENTE" && <DropdownMenuSeparator className="bg-white/10" />}

                          <DropdownMenuItem
                            onClick={() => handleCambiarEstado(u)}
                            className={cn(
                              "cursor-pointer gap-2",
                              u.activo && u.estado !== "SUSPENDIDO"
                                ? "text-red-400 focus:bg-red-500/10"
                                : "text-green-400 focus:bg-green-500/10",
                            )}
                          >
                            {u.activo && u.estado !== "SUSPENDIDO" ? (
                              <>
                                <UserX className="h-4 w-4" /> Suspender
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-4 w-4" /> Activar
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialogs */}
      <DialogEditarUsuario
        usuario={usuarioEditar}
        onCerrar={() => setUsuarioEditar(null)}
        onExito={() => {
          setUsuarioEditar(null);
          recargar();
        }}
      />

      <DialogInvitarUsuario
        abierto={abrirInvitar}
        onCerrar={() => setAbrirInvitar(false)}
        onExito={() => {
          setAbrirInvitar(false);
          recargar();
        }}
      />

      <DialogNuevoAgente
        abierto={abrirAgente}
        onCerrar={() => setAbrirAgente(false)}
        onExito={() => {
          setAbrirAgente(false);
          recargar();
        }}
      />

      {/* Dialog link copiable */}
      <Dialog open={!!linkDialog} onOpenChange={() => setLinkDialog(null)}>
        <DialogContent className="bg-stone-950/95 backdrop-blur-xl border border-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-stone-50">
              <Link2 className="h-5 w-5 text-lime-400" />
              Link de acceso — {linkDialog?.nombre}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-stone-400">
            Este link permite al usuario iniciar sesión directamente (expira en 24h). Compártelo
            por WhatsApp, email u otro canal.
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={linkDialog?.link ?? ""}
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
            onClick={() => setLinkDialog(null)}
            className="rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 font-semibold"
          >
            Cerrar
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
