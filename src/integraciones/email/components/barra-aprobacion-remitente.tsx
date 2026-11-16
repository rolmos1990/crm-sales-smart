"use client";

// Aviso de bloqueo en el Inbox, con las dos formas de aprobar (FR-034, FR-035).
//
// Mientras esto está en pantalla, la conversación no puede emitir ningún
// mensaje: el corte real está en el servidor (envio.ts, el orquestador de IA y
// el motor de Workflows). Esto solo lo explica y ofrece la salida.
import { useState, useTransition } from "react";
import { AlertCircle, Loader2, ShieldAlert, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  aprobarRemitenteConContactoExistente,
  aprobarRemitenteConContactoNuevo,
} from "../aprobacion/actions";

interface ContactoSugerido {
  id: string;
  nombre: string;
  apellido: string;
  email: string | null;
}

interface Props {
  conversacionId: string;
  /** Dirección por la que escribió el remitente, para que el agente la vea. */
  direccion: string | null;
  /** Nombre visible que trajo el correo, si lo trajo. */
  nombreSugerido?: string | null;
  /** Contactos del CRM que podrían ser esta persona. */
  sugerencias?: ContactoSugerido[];
  onAprobado?: () => void;
}

type Modo = "cerrado" | "nuevo" | "existente";

export function BarraAprobacionRemitente({
  conversacionId,
  direccion,
  nombreSugerido,
  sugerencias = [],
  onAprobado,
}: Props) {
  const [modo, setModo] = useState<Modo>("cerrado");
  const [nombre, setNombre] = useState(nombreSugerido ?? "");
  const [apellido, setApellido] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciarTransicion] = useTransition();

  function aprobarNuevo() {
    setError(null);
    iniciarTransicion(async () => {
      const r = await aprobarRemitenteConContactoNuevo({ conversacionId, nombre, apellido });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setModo("cerrado");
      onAprobado?.();
    });
  }

  function aprobarExistente(contactoId: string) {
    setError(null);
    iniciarTransicion(async () => {
      const r = await aprobarRemitenteConContactoExistente({ conversacionId, contactoId });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setModo("cerrado");
      onAprobado?.();
    });
  }

  return (
    <div className="border-b border-warning/25 bg-warning/8 px-4 py-3">
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-warning" />

        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Remitente pendiente de aprobación
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {direccion ? <span className="font-medium">{direccion}</span> : "Este remitente"} no
              está en tu CRM. No se puede responder este correo —ni vos, ni el agente de IA— hasta
              que lo apruebes.
            </p>
          </div>

          {modo === "cerrado" && (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" onClick={() => setModo("nuevo")} disabled={pendiente}>
                <UserPlus className="h-3.5 w-3.5" />
                Crear contacto
              </Button>
              {sugerencias.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setModo("existente")}
                  disabled={pendiente}
                >
                  <Users className="h-3.5 w-3.5" />
                  Asociar a un contacto
                </Button>
              )}
            </div>
          )}

          {modo === "nuevo" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="aprob-nombre" className="text-xs">
                    Nombre
                  </Label>
                  <Input
                    id="aprob-nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Juan"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="aprob-apellido" className="text-xs">
                    Apellido
                  </Label>
                  <Input
                    id="aprob-apellido"
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                    placeholder="Pérez"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" onClick={aprobarNuevo} disabled={pendiente || !nombre.trim()}>
                  {pendiente && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Aprobar y habilitar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setModo("cerrado")}
                  disabled={pendiente}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {modo === "existente" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Elegí a quién corresponde esta dirección:
              </p>
              <div className="space-y-1.5">
                {sugerencias.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={pendiente}
                    onClick={() => aprobarExistente(c.id)}
                    className="w-full text-left rounded-lg border border-border bg-card px-3 py-2 hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <p className="text-sm text-foreground">
                      {c.nombre} {c.apellido}
                    </p>
                    {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setModo("cerrado")}
                disabled={pendiente}
              >
                Cancelar
              </Button>
            </div>
          )}

          {error && (
            <p className="flex items-start gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
