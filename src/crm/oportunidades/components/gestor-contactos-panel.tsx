"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Star, Phone, Mail, UserPlus, MoreHorizontal,
  ExternalLink, Trash2, ArrowLeft, Plus, Loader2,
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
} from "../actions";
import { crearContacto } from "@/crm/contactos/actions";

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

  const handleAgregar = async (contactoId: string) => {
    if (!contactoId) return;
    setProcesando("__agregar__");
    const r = await agregarContactoAOportunidad(oportunidadId, contactoId);
    setProcesando(null);
    if (!r.exito) { toast.error(r.error); return; }

    const info = todosContactos.find((c) => c.valor === contactoId);
    const parts = (info?.etiqueta ?? "").split(" ");
    const esPrimero = contactos.length === 0;
    setContactos((prev) => [
      ...prev,
      {
        contactoId,
        principal: esPrimero,
        contacto: {
          id: contactoId,
          nombre: parts[0] ?? "",
          apellido: parts.slice(1).join(" "),
          email: null, telefonoPrincipal: null, telefonoSecundario: null,
          cargo: null, estado: "ACTIVO", notas: null,
        },
      },
    ]);
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

    const esPrimero = contactos.length === 0;
    setContactos((prev) => [
      ...prev,
      {
        contactoId: r.datos.id,
        principal: esPrimero,
        contacto: {
          id: r.datos.id,
          nombre: r.datos.nombre,
          apellido: r.datos.apellido,
          email: r.datos.email,
          telefonoPrincipal: r.datos.telefonoPrincipal,
          telefonoSecundario: r.datos.telefonoSecundario,
          cargo: r.datos.cargo,
          estado: r.datos.estado,
          notas: r.datos.notas,
        },
      },
    ]);
    setModoCrear(false);
    form.reset(DEFAULTS_NUEVO);
    toast.success("Contacto creado y asignado");
  };

  // ── Modo crear nuevo contacto ──────────────────────────────────

  if (modoCrear) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <button
            type="button"
            onClick={() => { setModoCrear(false); form.reset(DEFAULTS_NUEVO); }}
            className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver
          </button>

          <div className="rounded-xl bg-lime-500/8 dark:bg-lime-400/8 border border-lime-500/15 dark:border-lime-400/15 px-4 py-3">
            <p className="text-xs font-semibold text-lime-700 dark:text-lime-400">Nuevo contacto</p>
            <p className="text-xs text-lime-600/70 dark:text-lime-500 mt-0.5">
              Se creará y asignará a esta oportunidad
            </p>
          </div>

          <Form {...form}>
            <form id="form-nuevo-contacto" onSubmit={form.handleSubmit(handleCrearNuevo)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="nombre" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">Nombre</FormLabel>
                    <FormControl><Input className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-9" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="apellido" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">Apellido</FormLabel>
                    <FormControl><Input className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-9" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">Email</FormLabel>
                  <FormControl>
                    <Input type="email" className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-9" placeholder="correo@ejemplo.com" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="telefonoPrincipal" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">Teléfono principal</FormLabel>
                  <FormControl>
                    <PhoneInput value={field.value ?? ""} onChange={field.onChange} defaultCountryCode={defaultCountryCode} placeholder="000 000 0000" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="telefonoSecundario" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">Teléfono secundario</FormLabel>
                  <FormControl>
                    <PhoneInput value={field.value ?? ""} onChange={field.onChange} defaultCountryCode={defaultCountryCode} placeholder="000 000 0000" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="cargo" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">Cargo</FormLabel>
                  <FormControl>
                    <Input className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-9" placeholder="Director, Gerente..." {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="estado" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">Estado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-9"><SelectValue /></SelectTrigger>
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
                  <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">Notas</FormLabel>
                  <FormControl>
                    <Textarea rows={3} className="resize-none bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl text-sm" placeholder="Información adicional..." {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </form>
          </Form>
        </div>

        <div className="flex-shrink-0 border-t border-stone-100 dark:border-white/10 px-6 py-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => { setModoCrear(false); form.reset(DEFAULTS_NUEVO); }} className="rounded-lg">
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-nuevo-contacto"
            size="sm"
            disabled={form.formState.isSubmitting}
            className="bg-lime-500 text-stone-950 hover:bg-lime-400 rounded-xl px-5 font-semibold shadow-sm transition-all"
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
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
            {contactos.length} contacto{contactos.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Empty state */}
      {contactos.length === 0 && !modoAgregar && (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-stone-100 dark:bg-white/5 flex items-center justify-center">
            <svg className="h-5 w-5 text-stone-400 dark:text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-600 dark:text-stone-300">Sin contactos</p>
            <p className="text-xs text-stone-400 dark:text-stone-600 mt-1">Agrega un contacto existente o crea uno nuevo</p>
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
                ? "border-lime-300/60 dark:border-lime-400/25 bg-lime-50/40 dark:bg-lime-400/5"
                : "border-stone-200 dark:border-white/10 bg-stone-50/40 dark:bg-white/4"
            )}
          >
            {/* Loading overlay */}
            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70 dark:bg-stone-950/70 z-10">
                <Loader2 className="h-4 w-4 animate-spin text-lime-500" />
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
                  <span className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                    {c.nombre} {c.apellido}
                  </span>
                  {rel.principal && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-lime-500/10 dark:bg-lime-400/15 border border-lime-400/25 px-1.5 py-0.5 text-[10px] font-bold text-lime-700 dark:text-lime-400 leading-none">
                      <Star className="h-2.5 w-2.5 fill-current" />
                      Principal
                    </span>
                  )}
                </div>

                {c.cargo && (
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{c.cargo}</p>
                )}

                {(c.telefonoPrincipal || c.telefonoSecundario || c.email) && (
                  <div className="flex flex-col gap-1 mt-2.5">
                    {c.telefonoPrincipal && (
                      <a
                        href={`tel:${c.telefonoPrincipal}`}
                        className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300 hover:text-lime-600 dark:hover:text-lime-400 transition-colors w-fit"
                      >
                        <Phone className="h-3 w-3 text-stone-400 dark:text-stone-500 shrink-0" />
                        <span>{c.telefonoPrincipal}</span>
                      </a>
                    )}
                    {c.telefonoSecundario && (
                      <a
                        href={`tel:${c.telefonoSecundario}`}
                        className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 hover:text-lime-600 dark:hover:text-lime-400 transition-colors w-fit"
                      >
                        <Phone className="h-3 w-3 text-stone-400 dark:text-stone-600 shrink-0 opacity-60" />
                        <span>{c.telefonoSecundario}</span>
                        <span className="text-[10px] text-stone-400 dark:text-stone-600">(alt)</span>
                      </a>
                    )}
                    {c.email && (
                      <a
                        href={`mailto:${c.email}`}
                        className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300 hover:text-lime-600 dark:hover:text-lime-400 transition-colors w-fit max-w-full"
                      >
                        <Mail className="h-3 w-3 text-stone-400 dark:text-stone-500 shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-stone-100 dark:hover:bg-white/10 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors flex-shrink-0 outline-none mt-0.5">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {!rel.principal && (
                    <DropdownMenuItem onClick={() => handleHacerPrincipal(rel.contactoId)}>
                      <Star className="h-3.5 w-3.5 mr-2 text-lime-500" />
                      Hacer principal
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => window.open(`/crm/contactos/${c.id}`, "_blank")}>
                    <ExternalLink className="h-3.5 w-3.5 mr-2" />
                    Ver contacto
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-500 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-500/10 focus:text-red-600 dark:focus:text-red-300"
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
          <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Buscar contacto</p>
          <Combobox
            opciones={opcionesDisponibles}
            valor=""
            onChange={handleAgregar}
            placeholder="Buscar por nombre..."
          />
          <button
            type="button"
            onClick={() => setModoAgregar(false)}
            className="text-xs text-stone-400 dark:text-stone-600 hover:text-stone-600 dark:hover:text-stone-400 transition-colors"
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
                "border-stone-300 dark:border-white/15 text-stone-500 dark:text-stone-400",
                "hover:border-lime-400 dark:hover:border-lime-400/50 hover:text-lime-600 dark:hover:text-lime-400 hover:bg-lime-50 dark:hover:bg-lime-400/5"
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
              "border-stone-300 dark:border-white/15 text-stone-500 dark:text-stone-400",
              "hover:border-indigo-400 dark:hover:border-indigo-400/50 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-400/5"
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
