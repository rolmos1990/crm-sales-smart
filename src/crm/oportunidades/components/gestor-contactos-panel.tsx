"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Star, Phone, Mail, UserPlus, MoreHorizontal,
  ExternalLink, Trash2, ArrowLeft, Plus, Loader2,
  Pencil, Check, X, MessageCircle, Camera,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Combobox, type OpcionCombobox } from "@/shared/ui/combobox";
import { PhoneInput } from "@/components/ui/phone-input";
import { cn } from "@/lib/utils";
import {
  agregarContactoAOportunidad,
  removerContactoDeOportunidad,
  marcarContactoPrincipal,
  obtenerContactosDeOportunidadAction,
} from "../actions";
import { crearContacto, actualizarContacto } from "@/crm/contactos/actions";

// ── Types ─────────────────────────────────────────────────────────

export interface ContactoEnPanel {
  contactoId: string;
  principal: boolean;
  contacto: {
    id: string;
    nombre: string;
    apellido: string;
    email: string | null;
    telefonoPrincipal: string | null;
    telefonoSecundario: string | null;
    cargo: string | null;
    estado: string;
    notas: string | null;
    identificadoresCanal?: Array<{ canal: string; identificador: string; handle: string | null }>;
  };
}

interface GestorContactosPanelProps {
  oportunidadId: string;
  contactosIniciales: ContactoEnPanel[];
  todosContactos: OpcionCombobox[];
  defaultCountryCode?: string;
}

// ── Helpers ───────────────────────────────────────────────────────

const AVATAR_PALETTES = [
  "bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-400/15 dark:text-pink-300",
];

function avatarPalette(nombre: string) {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = (hash + nombre.charCodeAt(i)) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[hash];
}

// ── Campo editable inline ─────────────────────────────────────────

function CampoContacto({
  label,
  valor,
  placeholder,
  tipo,
  onGuardar,
}: {
  label: string;
  valor: string | null | undefined;
  placeholder: string;
  tipo: "tel" | "email";
  onGuardar: (v: string) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [val, setVal] = useState(valor ?? "");
  const [guardando, startGuardando] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(valor ?? ""); }, [valor]);

  const guardar = () => {
    if (val === (valor ?? "")) { setEditando(false); return; }
    startGuardando(async () => {
      await onGuardar(val);
      setEditando(false);
    });
  };

  if (editando) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg bg-input-bg border border-input-focus/50 px-2.5 py-1.5">
        <input
          ref={inputRef}
          autoFocus
          type={tipo}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={guardar}
          onKeyDown={(e) => {
            if (e.key === "Enter") guardar();
            if (e.key === "Escape") { setVal(valor ?? ""); setEditando(false); }
          }}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent text-xs text-foreground outline-none placeholder:text-input-placeholder"
        />
        {guardando ? (
          <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
        ) : (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); guardar(); }}
            className="text-primary hover:text-primary-hover shrink-0"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); setVal(valor ?? ""); setEditando(false); }}
          className="text-muted-foreground hover:text-text-secondary shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  const waHref = tipo === "tel" && valor ? `https://wa.me/${valor.replace(/\D/g, "")}` : null;
  const actionHref = valor ? (tipo === "tel" ? `tel:${valor}` : `mailto:${valor}`) : null;

  return (
    <div className="flex items-center gap-0.5 group min-w-0 rounded-lg px-1 py-1 hover:bg-muted transition-colors">
      {/* Botones de acción — siempre visibles */}
      {waHref && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir en WhatsApp"
          onClick={(e) => e.stopPropagation()}
          className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-success hover:bg-success-muted transition-colors shrink-0"
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </a>
      )}
      {actionHref && (
        <a
          href={actionHref}
          title={tipo === "tel" ? "Llamar" : "Enviar email"}
          onClick={(e) => e.stopPropagation()}
          className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary-muted transition-colors shrink-0"
        >
          {tipo === "tel" ? <Phone className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
        </a>
      )}
      {/* Valor o placeholder */}
      <span className={cn(
        "flex-1 text-xs truncate mx-0.5",
        valor ? "text-text-secondary" : "text-muted-foreground italic"
      )}>
        {valor || placeholder}
      </span>
      {/* Botón editar — aparece al hover */}
      <button
        type="button"
        title={`Editar ${label}`}
        onClick={() => { setEditando(true); }}
        className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-text-secondary hover:bg-muted transition-all shrink-0"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── Create-new schema ─────────────────────────────────────────────

const ContactoNuevoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  apellido: z.string().min(1, "El apellido es requerido"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefonoPrincipal: z.string().max(30).optional().or(z.literal("")),
  telefonoSecundario: z.string().max(30).optional().or(z.literal("")),
  cargo: z.string().max(100).optional().or(z.literal("")),
  notas: z.string().max(2000).optional().or(z.literal("")),
  estado: z.enum(["ACTIVO", "INACTIVO", "LEAD"]),
});
type ContactoNuevoInput = z.infer<typeof ContactoNuevoSchema>;

const DEFAULTS_NUEVO: ContactoNuevoInput = {
  nombre: "", apellido: "", email: "", telefonoPrincipal: "",
  telefonoSecundario: "", cargo: "", notas: "", estado: "ACTIVO",
};

// ── Component ─────────────────────────────────────────────────────

export function GestorContactosPanel({
  oportunidadId,
  contactosIniciales,
  todosContactos,
  defaultCountryCode = "PA",
}: GestorContactosPanelProps) {
  const [contactos, setContactos] = useState<ContactoEnPanel[]>(
    [...contactosIniciales].sort((a, b) => Number(b.principal) - Number(a.principal))
  );
  const [procesando, setProcesando] = useState<string | null>(null);
  const [modoAgregar, setModoAgregar] = useState(false);
  const [modoCrear, setModoCrear] = useState(false);

  const form = useForm<ContactoNuevoInput>({
    resolver: zodResolver(ContactoNuevoSchema),
    defaultValues: DEFAULTS_NUEVO,
  });

  const idsActuales = new Set(contactos.map((c) => c.contactoId));
  const opcionesDisponibles = todosContactos.filter((c) => !idsActuales.has(c.valor));

  // ── Handlers ──────────────────────────────────────────────────

  // Relee del servidor la lista real de contactos de la oportunidad. Se usa
  // en vez de construir el estado "a mano" en el cliente para que, si algo
  // falla en el guardado (permisos, condición de carrera, etc.), la UI
  // refleje de inmediato la verdad del servidor en vez de un éxito falso.
  const refrescarContactos = async () => {
    try {
      const frescos = await obtenerContactosDeOportunidadAction(oportunidadId);
      setContactos(frescos as ContactoEnPanel[]);
    } catch {
      // El guardado ya se confirmó antes de llamar esto — si el refetch
      // falla no revertimos nada, solo no se refresca la vista al instante.
    }
  };

  const handleAgregar = async (contactoId: string) => {
    if (!contactoId) return;
    setProcesando("__agregar__");
    const r = await agregarContactoAOportunidad(oportunidadId, contactoId);
    setProcesando(null);
    if (!r.exito) { toast.error(r.error); return; }

    await refrescarContactos();
    setModoAgregar(false);
    toast.success("Contacto agregado");
  };

  const handleRemover = async (contactoId: string) => {
    setProcesando(contactoId);
    const r = await removerContactoDeOportunidad(oportunidadId, contactoId);
    setProcesando(null);
    if (!r.exito) { toast.error(r.error); return; }

    setContactos((prev) => {
      const eraPrincipal = prev.find((c) => c.contactoId === contactoId)?.principal ?? false;
      const updated = prev.filter((c) => c.contactoId !== contactoId);
      if (eraPrincipal && updated.length > 0) {
        updated[0] = { ...updated[0], principal: true };
      }
      return updated;
    });
    toast.success("Contacto removido");
  };

  const handleHacerPrincipal = async (contactoId: string) => {
    setProcesando(contactoId);
    const r = await marcarContactoPrincipal(oportunidadId, contactoId);
    setProcesando(null);
    if (!r.exito) { toast.error(r.error); return; }

    setContactos((prev) =>
      [...prev.map((c) => ({ ...c, principal: c.contactoId === contactoId }))]
        .sort((a, b) => Number(b.principal) - Number(a.principal))
    );
    toast.success("Marcado como contacto principal");
  };

  const handleCrearNuevo = async (datos: ContactoNuevoInput) => {
    const r = await crearContacto({
      nombre: datos.nombre, apellido: datos.apellido,
      email: datos.email || undefined,
      telefonoPrincipal: datos.telefonoPrincipal || undefined,
      telefonoSecundario: datos.telefonoSecundario || undefined,
      cargo: datos.cargo || undefined,
      notas: datos.notas || undefined,
      estado: datos.estado,
    });
    if (!r.exito) { toast.error(r.error); return; }

    const ra = await agregarContactoAOportunidad(oportunidadId, r.datos.id);
    if (!ra.exito) { toast.error(ra.error); return; }

    await refrescarContactos();
    setModoCrear(false);
    form.reset(DEFAULTS_NUEVO);
    toast.success("Contacto creado y asignado");
  };

  // Actualización parcial de un campo del contacto
  const handleActualizarCampo = async (
    contactoId: string,
    campo: "telefonoPrincipal" | "email",
    valor: string
  ) => {
    const r = await actualizarContacto(contactoId, { [campo]: valor || undefined });
    if (!r.exito) { toast.error(r.error); throw new Error(r.error); }

    setContactos((prev) =>
      prev.map((rel) =>
        rel.contactoId === contactoId
          ? { ...rel, contacto: { ...rel.contacto, [campo]: valor || null } }
          : rel
      )
    );
    toast.success("Guardado");
  };

  // ── Modo crear nuevo contacto ──────────────────────────────────

  if (modoCrear) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <button
            type="button"
            onClick={() => { setModoCrear(false); form.reset(DEFAULTS_NUEVO); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver
          </button>

          <div className="rounded-xl bg-primary-muted border border-primary-border px-4 py-3">
            <p className="text-xs font-semibold text-primary">Nuevo contacto</p>
            <p className="text-xs text-primary/70 mt-0.5">
              Se creará y asignará a esta oportunidad
            </p>
          </div>

          <Form {...form}>
            {/*
              Este panel se renderiza dentro del <form> del workspace de la oportunidad
              (edición de datos generales). Un <form> anidado es HTML inválido — el
              navegador lo mal-interpreta y el botón "Crear y asignar" termina sin
              disparar handleCrearNuevo (o dispara el submit del form exterior).
              Por eso aquí usamos un <div> y disparamos la validación/envío por JS.
            */}
            <div
              className="space-y-4"
              onKeyDown={(e) => {
                // Sin <form> propio, Enter burbujearía y dispararía el submit
                // del form exterior (guardar oportunidad) en vez de crear el contacto.
                if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
                  e.preventDefault();
                  form.handleSubmit(handleCrearNuevo)();
                }
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="nombre" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nombre</FormLabel>
                    <FormControl><Input className="bg-input-bg border-input rounded-xl h-9" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="apellido" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Apellido</FormLabel>
                    <FormControl><Input className="bg-input-bg border-input rounded-xl h-9" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</FormLabel>
                  <FormControl>
                    <Input type="email" className="bg-input-bg border-input rounded-xl h-9" placeholder="correo@ejemplo.com" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="telefonoPrincipal" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Teléfono principal</FormLabel>
                  <FormControl>
                    <PhoneInput value={field.value ?? ""} onChange={field.onChange} defaultCountryCode={defaultCountryCode} placeholder="000 000 0000" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="telefonoSecundario" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Teléfono secundario</FormLabel>
                  <FormControl>
                    <PhoneInput value={field.value ?? ""} onChange={field.onChange} defaultCountryCode={defaultCountryCode} placeholder="000 000 0000" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="cargo" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cargo</FormLabel>
                  <FormControl>
                    <Input className="bg-input-bg border-input rounded-xl h-9" placeholder="Director, Gerente..." {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="estado" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-input-bg border-input rounded-xl h-9"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ACTIVO">Activo</SelectItem>
                      <SelectItem value="INACTIVO">Inactivo</SelectItem>
                      <SelectItem value="LEAD">Lead</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="notas" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notas</FormLabel>
                  <FormControl>
                    <Textarea rows={3} className="resize-none bg-input-bg border-input rounded-xl text-sm" placeholder="Información adicional..." {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </Form>
        </div>

        <div className="flex-shrink-0 border-t border-border px-6 py-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => { setModoCrear(false); form.reset(DEFAULTS_NUEVO); }} className="rounded-lg">
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={form.handleSubmit(handleCrearNuevo)}
            size="sm"
            disabled={form.formState.isSubmitting}
            className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-xl px-5 font-semibold shadow-sm transition-all"
          >
            {form.formState.isSubmitting ? "Creando..." : "Crear y asignar"}
          </Button>
        </div>
      </div>
    );
  }

  // ── Lista de contactos ─────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
      {/* Header count */}
      {contactos.length > 0 && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {contactos.length} contacto{contactos.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Empty state */}
      {contactos.length === 0 && !modoAgregar && (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
            <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-text-secondary">Sin contactos</p>
            <p className="text-xs text-muted-foreground mt-1">Agrega un contacto existente o crea uno nuevo</p>
          </div>
        </div>
      )}

      {/* Contact cards */}
      {contactos.map((rel) => {
        const c = rel.contacto;
        const initials = `${c.nombre[0] ?? ""}${c.apellido[0] ?? ""}`.toUpperCase();
        const palette = avatarPalette(c.nombre);
        const isProcessing = procesando === rel.contactoId;

        return (
          <div
            key={rel.contactoId}
            className={cn(
              "relative rounded-2xl border p-3.5 transition-all",
              rel.principal
                ? "border-primary-border bg-primary-muted/60"
                : "border-border bg-muted/60"
            )}
          >
            {/* Loading overlay */}
            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-surface-1/70 z-10">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            )}

            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5", palette)}>
                {initials}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground truncate">
                    {c.nombre} {c.apellido}
                  </span>
                  {rel.principal && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-muted border border-primary-border px-1.5 py-0.5 text-[10px] font-bold text-primary leading-none">
                      <Star className="h-2.5 w-2.5 fill-current" />
                      Principal
                    </span>
                  )}
                </div>

                {c.cargo && (
                  <p className="text-xs text-muted-foreground mt-0.5">{c.cargo}</p>
                )}

                {/* @usuario/ID de Instagram — referencia no editable, igual que en el Inbox */}
                {(() => {
                  const ig = c.identificadoresCanal?.find((i) => i.canal === "instagram");
                  if (!ig) return null;
                  return (
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground min-w-0">
                      <Camera className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="font-mono truncate">
                        {ig.handle ? `@${ig.handle}` : `ID: ${ig.identificador}`}
                      </span>
                    </div>
                  );
                })()}

                {/* Edición rápida de contacto */}
                <div className="mt-2.5 space-y-0.5 border-t border-border-subtle pt-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground px-1 mb-1">
                    Editar rápido
                  </p>

                  <CampoContacto
                    label="Teléfono principal"
                    valor={c.telefonoPrincipal}
                    placeholder="Agregar teléfono"
                    tipo="tel"
                    onGuardar={(v) => handleActualizarCampo(rel.contactoId, "telefonoPrincipal", v)}
                  />

                  <CampoContacto
                    label="Correo electrónico"
                    valor={c.email}
                    placeholder="Agregar correo"
                    tipo="email"
                    onGuardar={(v) => handleActualizarCampo(rel.contactoId, "email", v)}
                  />
                </div>
              </div>

              {/* Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-text-secondary transition-colors flex-shrink-0 outline-none mt-0.5">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {!rel.principal && (
                    <DropdownMenuItem onClick={() => handleHacerPrincipal(rel.contactoId)}>
                      <Star className="h-3.5 w-3.5 mr-2 text-primary" />
                      Hacer principal
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => window.open(`/crm/contactos/${c.id}`, "_blank")}>
                    <ExternalLink className="h-3.5 w-3.5 mr-2" />
                    Ver contacto
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-danger focus:bg-danger-muted focus:text-danger-text"
                    onClick={() => handleRemover(rel.contactoId)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Quitar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}

      {/* Agregar existente */}
      {modoAgregar ? (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-muted-foreground font-medium">Buscar contacto</p>
          <Combobox
            opciones={opcionesDisponibles}
            valor=""
            onChange={handleAgregar}
            placeholder="Buscar por nombre..."
          />
          <button
            type="button"
            onClick={() => setModoAgregar(false)}
            className="text-xs text-muted-foreground hover:text-text-secondary transition-colors"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 pt-2">
          {opcionesDisponibles.length > 0 && (
            <button
              type="button"
              onClick={() => setModoAgregar(true)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-2.5 text-xs font-semibold transition-all w-full",
                "border-border text-muted-foreground",
                "hover:border-primary-border hover:text-primary hover:bg-primary-muted"
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar contacto existente
            </button>
          )}
          <button
            type="button"
            onClick={() => setModoCrear(true)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-2.5 text-xs font-semibold transition-all w-full",
              "border-border text-muted-foreground",
              "hover:border-stage-purple-border hover:text-stage-purple-text hover:bg-stage-purple-muted"
            )}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Crear nuevo contacto
          </button>
        </div>
      )}
    </div>
  );
}
