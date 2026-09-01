"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
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
import { PhoneInput, PHONE_COUNTRIES } from "@/components/ui/phone-input";
import { ConfiguracionEmpresaSchema, type ConfiguracionEmpresaInput } from "@/configuracion/empresa/schema";
import { guardarConfiguracionEmpresa } from "@/configuracion/empresa/actions";
import { SeccionModoGeografico } from "@/configuracion/empresa/components/seccion-modo-geografico";
import type { ConfigEmpresa } from "@/configuracion/empresa/types";
import { MONEDAS } from "@/shared/moneda/constants";

interface TabEmpresaProps {
  instanciaId: string;
  inicial?: ConfigEmpresa | null;
}

// ─── Datos de referencia ──────────────────────────────────────────────────────

const INDUSTRIAS = [
  "tecnologia", "retail", "manufactura", "servicios", "salud",
  "educacion", "construccion", "financiero", "logistica", "otro",
];

const PAISES = [
  "Panamá", "Perú", "Colombia", "México", "Argentina",
  "Chile", "Ecuador", "Bolivia", "Venezuela", "Paraguay",
  "Uruguay", "Costa Rica", "Guatemala", "Otro",
];

const ZONAS_HORARIAS = [
  { valor: "America/Panama",              etiqueta: "Panamá (UTC-5)" },
  { valor: "America/Lima",                etiqueta: "Lima / Bogotá (UTC-5)" },
  { valor: "America/Bogota",              etiqueta: "Bogotá (UTC-5)" },
  { valor: "America/Mexico_City",         etiqueta: "Ciudad de México (UTC-6)" },
  { valor: "America/Argentina/Buenos_Aires", etiqueta: "Buenos Aires (UTC-3)" },
  { valor: "America/Santiago",            etiqueta: "Santiago (UTC-4/-3)" },
  { valor: "America/Guayaquil",           etiqueta: "Guayaquil (UTC-5)" },
  { valor: "America/La_Paz",              etiqueta: "La Paz (UTC-4)" },
  { valor: "America/Caracas",             etiqueta: "Caracas (UTC-4)" },
  { valor: "UTC",                         etiqueta: "UTC (UTC+0)" },
];


// Mapa de país (nombre) → código ISO para el PhoneInput
const PAIS_A_ISO: Record<string, string> = {
  "Panamá":     "PA",
  "Perú":       "PE",
  "Colombia":   "CO",
  "México":     "MX",
  "Argentina":  "AR",
  "Chile":      "CL",
  "Ecuador":    "EC",
  "Bolivia":    "BO",
  "Venezuela":  "VE",
  "Paraguay":   "PY",
  "Uruguay":    "UY",
  "Costa Rica": "CR",
  "Guatemala":  "GT",
};

function isoFromPais(pais: string | undefined | null): string {
  if (!pais) return "PE";
  return PAIS_A_ISO[pais] ?? "PE";
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 pb-2 border-b border-stone-100 dark:border-white/8 mb-4">
      {children}
    </h3>
  );
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function TabEmpresa({ instanciaId, inicial }: TabEmpresaProps) {
  const form = useForm<ConfiguracionEmpresaInput>({
    resolver: zodResolver(ConfiguracionEmpresaSchema),
    defaultValues: {
      nombreComercial:   inicial?.nombreComercial   ?? "",
      razonSocial:       inicial?.razonSocial       ?? "",
      ruc:               inicial?.ruc               ?? "",
      tipoNegocio:       inicial?.tipoNegocio       ?? "",
      industria:         inicial?.industria         ?? "",
      correoPrincipal:   inicial?.correoPrincipal   ?? "",
      telefonoPrincipal: inicial?.telefonoPrincipal ?? "",
      whatsappPrincipal: inicial?.whatsappPrincipal ?? "",
      sitioWeb:          inicial?.sitioWeb          ?? "",
      pais:              inicial?.pais              ?? "",
      provincia:         inicial?.provincia         ?? "",
      ciudad:            inicial?.ciudad            ?? "",
      direccion:         inicial?.direccion         ?? "",
      zonaHoraria:       inicial?.zonaHoraria       ?? "America/Panama",
      monedaPrincipal:   inicial?.monedaPrincipal   ?? "USD",
      idiomaPrincipal:   inicial?.idiomaPrincipal   ?? "es",
      formatoFecha:      inicial?.formatoFecha      ?? "DD/MM/YYYY",
      formatoHora:       (inicial?.formatoHora as "12h" | "24h") ?? "12h",
    },
  });

  // Observar el país para actualizar el código de área sugerido en los teléfonos
  const paisActual = useWatch({ control: form.control, name: "pais" });
  const defaultPhoneISO = isoFromPais(paisActual);

  const onSubmit = async (datos: ConfiguracionEmpresaInput) => {
    const resultado = await guardarConfiguracionEmpresa(instanciaId, datos);
    if (resultado.exito) {
      toast.success("Configuración guardada correctamente");
    } else {
      toast.error(resultado.error ?? "Error al guardar");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-3xl">

        {/* ── Información general ── */}
        <div>
          <SectionTitle>Información general</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <FormField control={form.control} name="nombreComercial" render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre comercial</FormLabel>
                <FormControl>
                  <Input placeholder="Mi Empresa" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="ruc" render={({ field }) => (
              <FormItem>
                <FormLabel>RUC / NIT / RIF</FormLabel>
                <FormControl>
                  <Input placeholder="20000000000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="razonSocial" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Razón social</FormLabel>
                <FormControl>
                  <Input placeholder="MI EMPRESA SOCIEDAD ANÓNIMA" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="tipoNegocio" render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de negocio</FormLabel>
                <FormControl>
                  <Input placeholder="Distribuidora, Consultora, SaaS…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="industria" render={({ field }) => (
              <FormItem>
                <FormLabel>Industria</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar industria" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {INDUSTRIAS.map((i) => (
                      <SelectItem key={i} value={i}>
                        {i.charAt(0).toUpperCase() + i.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        {/* ── Contacto ── */}
        <div>
          <SectionTitle>Información de contacto</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <FormField control={form.control} name="correoPrincipal" render={({ field }) => (
              <FormItem>
                <FormLabel>Correo principal</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="contacto@miempresa.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="sitioWeb" render={({ field }) => (
              <FormItem>
                <FormLabel>Sitio web</FormLabel>
                <FormControl>
                  <Input placeholder="https://miempresa.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="telefonoPrincipal" render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono principal</FormLabel>
                <FormControl>
                  <PhoneInput
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    defaultCountryCode={defaultPhoneISO}
                    placeholder="000 000 0000"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="whatsappPrincipal" render={({ field }) => (
              <FormItem>
                <FormLabel>WhatsApp principal</FormLabel>
                <FormControl>
                  <PhoneInput
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    defaultCountryCode={defaultPhoneISO}
                    placeholder="000 000 0000"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        {/* ── Ubicación ── */}
        <div>
          <SectionTitle>Ubicación</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <FormField control={form.control} name="pais" render={({ field }) => (
              <FormItem>
                <FormLabel>País</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar país" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PAISES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="provincia" render={({ field }) => (
              <FormItem>
                <FormLabel>Provincia / Estado</FormLabel>
                <FormControl>
                  <Input placeholder="Panamá" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="ciudad" render={({ field }) => (
              <FormItem>
                <FormLabel>Ciudad</FormLabel>
                <FormControl>
                  <Input placeholder="Ciudad de Panamá" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="direccion" render={({ field }) => (
              <FormItem>
                <FormLabel>Dirección</FormLabel>
                <FormControl>
                  <Input placeholder="Av. Principal 123, Piso 4" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        {/* ── Configuración regional ── */}
        <div>
          <SectionTitle>Configuración regional</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <FormField control={form.control} name="zonaHoraria" render={({ field }) => (
              <FormItem>
                <FormLabel>Zona horaria</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ZONAS_HORARIAS.map((z) => (
                      <SelectItem key={z.valor} value={z.valor}>
                        {z.etiqueta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="monedaPrincipal" render={({ field }) => (
              <FormItem>
                <FormLabel>Moneda principal</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {MONEDAS.map((m) => (
                      <SelectItem key={m.valor} value={m.valor}>{m.etiqueta}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="idiomaPrincipal" render={({ field }) => (
              <FormItem>
                <FormLabel>Idioma principal</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="pt">Português</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="formatoFecha" render={({ field }) => (
              <FormItem>
                <FormLabel>Formato de fecha</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="formatoHora" render={({ field }) => (
              <FormItem>
                <FormLabel>Formato de hora</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="12h">12 horas (2:30 PM)</SelectItem>
                    <SelectItem value="24h">24 horas (14:30)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02]"
          >
            {form.formState.isSubmitting ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </form>

      {/* 019-cobertura-geografica-envios — formulario independiente, no
          forma parte de ConfiguracionEmpresaSchema/guardarConfiguracionEmpresa. */}
      <div className="max-w-3xl">
        <SeccionModoGeografico
          modoGeograficoInicial={inicial?.modoGeografico ?? "MULTIPAIS"}
          paisOperacionIdInicial={inicial?.paisOperacionId ?? null}
        />
      </div>
    </Form>
  );
}
