"use client";

// Asistente de conexión de un buzón, en 4 pasos.
//
// Antes era un formulario único y largo donde convivían la dirección, las
// credenciales, los dos servidores y las reglas de recepción: el negocio veía
// una veintena de campos de golpe, sin saber cuáles eran obligatorios ni en
// qué orden resolverlos. Partirlo por decisión —a quién conecto, con qué
// datos, cómo entran los correos, confirmar— deja cada paso con una pregunta.
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Inbox,
  Info,
  Layers,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LockOpen,
  Mail,
  Plug,
  Send,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ETIQUETAS_SEGURIDAD,
  PUERTOS_SUGERIDOS,
  type AgrupacionCorreo,
  type BuzonParaCliente,
  type SeguridadCorreo,
} from "../tipos";
import {
  PROVEEDORES,
  detectarProveedor,
  obtenerProveedor,
  type ClaveProveedor,
} from "../proveedores";
import { actualizarBuzon, probarConexionBuzon, registrarBuzon } from "../actions";
import { FilaResumen, IndicadorPasos, Segmentado, TarjetaOpcion } from "./pasos-buzon";
import { LogoProveedor } from "./logos-proveedores";

interface PipelineOpcion {
  id: string;
  nombre: string;
  esDefault: boolean;
  stages: { id: string; nombre: string; orden: number }[];
}

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  buzon?: BuzonParaCliente | null;
  pipelines: PipelineOpcion[];
}

interface FormBuzon {
  nombre: string;
  direccion: string;
  entradaServidor: string;
  entradaPuerto: number;
  entradaSeguridad: SeguridadCorreo;
  entradaUsuario: string;
  entradaPassword: string;
  salidaServidor: string;
  salidaPuerto: number;
  salidaSeguridad: SeguridadCorreo;
  salidaUsuario: string;
  salidaPassword: string;
  nombreRemitente: string;
  agrupacion: AgrupacionCorreo;
  requiereAprobacion: boolean;
  pipelineId: string;
  stageId: string;
  stageIdRespuestaAutomatica: string;
}

type EstadoPrueba =
  | { fase: "sin_probar" }
  | { fase: "probando" }
  | {
      fase: "listo";
      entrada: { ok: boolean; mensaje?: string };
      salida: { ok: boolean; mensaje?: string };
    };

const SIN_PIPELINE = "__sin_pipeline__";
const SIN_ETAPA_RESPUESTA = "__sin_etapa_respuesta__";

const PASOS = [
  { numero: 1, etiqueta: "Correo" },
  { numero: 2, etiqueta: "Servidores" },
  { numero: 3, etiqueta: "Recepción" },
  { numero: 4, etiqueta: "Confirmar" },
];

const OPCIONES_SEGURIDAD = (Object.keys(ETIQUETAS_SEGURIDAD) as SeguridadCorreo[]).map((s) => ({
  valor: s,
  etiqueta: ETIQUETAS_SEGURIDAD[s],
}));

function valoresIniciales(buzon?: BuzonParaCliente | null): FormBuzon {
  return {
    nombre: buzon?.nombre ?? "",
    direccion: buzon?.direccion ?? "",
    entradaServidor: buzon?.entrada.servidor ?? "",
    entradaPuerto: buzon?.entrada.puerto ?? PUERTOS_SUGERIDOS.SSL_TLS.entrada,
    entradaSeguridad: buzon?.entrada.seguridad ?? "SSL_TLS",
    entradaUsuario: buzon?.entrada.usuario ?? "",
    entradaPassword: "",
    salidaServidor: buzon?.salida.servidor ?? "",
    salidaPuerto: buzon?.salida.puerto ?? PUERTOS_SUGERIDOS.SSL_TLS.salida,
    salidaSeguridad: buzon?.salida.seguridad ?? "SSL_TLS",
    salidaUsuario: buzon?.salida.usuario ?? "",
    salidaPassword: "",
    nombreRemitente: buzon?.salida.nombreRemitente ?? "",
    agrupacion: buzon?.recepcion.agrupacion ?? "POR_REMITENTE",
    // En el formulario se expresa como "pedir aprobación", que es el efecto que
    // el negocio ve. En la configuración se guarda al revés.
    requiereAprobacion: buzon ? !buzon.recepcion.crearContactosAutomaticamente : false,
    pipelineId: buzon?.pipelineId ?? SIN_PIPELINE,
    stageId: buzon?.stageId ?? SIN_PIPELINE,
    stageIdRespuestaAutomatica: buzon?.stageIdRespuestaAutomatica ?? SIN_ETAPA_RESPUESTA,
  };
}

export function ModalRegistrarBuzon({ abierto, onCerrar, buzon, pipelines }: Props) {
  const esEdicion = Boolean(buzon);

  const [paso, setPaso] = useState(1);
  const [maximoAlcanzado, setMaximoAlcanzado] = useState(1);
  const [proveedor, setProveedor] = useState<ClaveProveedor>("otro");
  const [prueba, setPrueba] = useState<EstadoPrueba>({ fase: "sin_probar" });
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [verPassword, setVerPassword] = useState(false);

  const { register, handleSubmit, watch, setValue } = useForm<FormBuzon>({
    defaultValues: valoresIniciales(buzon),
  });

  const v = watch();
  const pipelineElegido = pipelines.find((p) => p.id === v.pipelineId);
  const conexionesOk = prueba.fase === "listo" && prueba.entrada.ok && prueba.salida.ok;
  const datosProveedor = obtenerProveedor(proveedor);

  // Cualquier cambio en los datos de conexión invalida la prueba anterior: sin
  // esto se podía probar con éxito, cambiar el servidor y guardar credenciales
  // que nunca se probaron.
  const huellaConexion = [
    v.entradaServidor, v.entradaPuerto, v.entradaSeguridad, v.entradaUsuario, v.entradaPassword,
    v.salidaServidor, v.salidaPuerto, v.salidaSeguridad, v.salidaUsuario, v.salidaPassword,
  ].join("|");
  useEffect(() => {
    setPrueba((actual) => (actual.fase === "sin_probar" ? actual : { fase: "sin_probar" }));
  }, [huellaConexion]);

  function elegirProveedor(clave: ClaveProveedor) {
    setProveedor(clave);
    const datos = obtenerProveedor(clave);
    if (!datos.entrada || !datos.salida) return;
    setValue("entradaServidor", datos.entrada.servidor);
    setValue("entradaPuerto", datos.entrada.puerto);
    setValue("entradaSeguridad", datos.entrada.seguridad);
    setValue("salidaServidor", datos.salida.servidor);
    setValue("salidaPuerto", datos.salida.puerto);
    setValue("salidaSeguridad", datos.salida.seguridad);
  }

  function alEscribirDireccion(valor: string) {
    // El usuario de IMAP/SMTP es la dirección en casi todos los proveedores:
    // se copia mientras el negocio no lo haya cambiado a mano.
    if (!v.entradaUsuario || v.entradaUsuario === v.direccion) {
      setValue("entradaUsuario", valor);
    }
    if (!v.salidaUsuario || v.salidaUsuario === v.direccion) {
      setValue("salidaUsuario", valor);
    }
    if (!esEdicion && proveedor === "otro") {
      const detectado = detectarProveedor(valor);
      if (detectado !== "otro") elegirProveedor(detectado);
    }
  }

  function aplicarSeguridad(lado: "entrada" | "salida", seguridad: SeguridadCorreo) {
    if (lado === "entrada") {
      setValue("entradaSeguridad", seguridad);
      setValue("entradaPuerto", PUERTOS_SUGERIDOS[seguridad].entrada);
    } else {
      setValue("salidaSeguridad", seguridad);
      setValue("salidaPuerto", PUERTOS_SUGERIDOS[seguridad].salida);
    }
  }

  const pasoUnoCompleto = Boolean(v.nombre.trim() && /.+@.+\..+/.test(v.direccion.trim()));
  const datosServidorCompletos = Boolean(
    v.entradaServidor.trim() && v.salidaServidor.trim() &&
    v.entradaUsuario.trim() && v.salidaUsuario.trim() &&
    (esEdicion || (v.entradaPassword && v.salidaPassword)),
  );

  function avanzar() {
    const siguiente = paso + 1;
    setPaso(siguiente);
    setMaximoAlcanzado((m) => Math.max(m, siguiente));
  }

  function aPayload(datos: FormBuzon) {
    return {
      nombre: datos.nombre,
      direccion: datos.direccion,
      entrada: {
        servidor: datos.entradaServidor,
        puerto: Number(datos.entradaPuerto),
        seguridad: datos.entradaSeguridad,
        usuario: datos.entradaUsuario || datos.direccion,
        ...(datos.entradaPassword ? { password: datos.entradaPassword } : {}),
      },
      salida: {
        servidor: datos.salidaServidor,
        puerto: Number(datos.salidaPuerto),
        seguridad: datos.salidaSeguridad,
        usuario: datos.salidaUsuario || datos.direccion,
        ...(datos.salidaPassword ? { password: datos.salidaPassword } : {}),
        ...(datos.nombreRemitente ? { nombreRemitente: datos.nombreRemitente } : {}),
      },
      recepcion: {
        agrupacion: datos.agrupacion,
        crearContactosAutomaticamente: !datos.requiereAprobacion,
      },
      pipelineId: datos.pipelineId === SIN_PIPELINE ? null : datos.pipelineId,
      stageId: datos.stageId === SIN_PIPELINE ? null : datos.stageId,
      stageIdRespuestaAutomatica:
        datos.stageIdRespuestaAutomatica === SIN_ETAPA_RESPUESTA
          ? null
          : datos.stageIdRespuestaAutomatica,
    };
  }

  async function probar() {
    setPrueba({ fase: "probando" });
    setErrorGuardado(null);
    const payload = aPayload(v);

    const resultado = await probarConexionBuzon({
      ...(buzon ? { cuentaCanalId: buzon.id } : {}),
      entrada: payload.entrada,
      salida: payload.salida,
    });

    setPrueba(
      resultado.ok
        ? {
            fase: "listo",
            entrada: { ok: resultado.data.entrada.ok, mensaje: resultado.data.entrada.mensaje },
            salida: { ok: resultado.data.salida.ok, mensaje: resultado.data.salida.mensaje },
          }
        : {
            fase: "listo",
            entrada: { ok: false, mensaje: resultado.error },
            salida: { ok: false, mensaje: resultado.error },
          },
    );
  }

  async function guardar(datos: FormBuzon) {
    setGuardando(true);
    setErrorGuardado(null);

    const payload = aPayload(datos);
    const resultado = esEdicion
      ? await actualizarBuzon({ ...payload, id: buzon!.id })
      : await registrarBuzon(payload);

    setGuardando(false);
    if (!resultado.ok) {
      setErrorGuardado(resultado.error);
      return;
    }
    onCerrar();
  }


  const encabezados: Record<number, { titulo: string; descripcion: string }> = {
    1: {
      titulo: "Conectar buzón de correo",
      descripcion: "Elegí tu proveedor e indicá qué casilla querés atender desde Karia.",
    },
    2: {
      titulo: "Datos de conexión",
      descripcion: "Configurá IMAP y SMTP para recibir y enviar mensajes desde Karia.",
    },
    3: {
      titulo: "Configurá cómo entran los correos",
      descripcion: "Elegí cómo se agrupan, a qué etapa llegan y si requieren aprobación.",
    },
    4: {
      titulo: "Revisá antes de activar",
      descripcion: "Así va a quedar configurado el buzón.",
    },
  };

  const etiquetaPassword = datosProveedor.clave === "otro" ? "Contraseña" : "Contraseña de aplicación";
  const etapaInicialNombre =
    pipelineElegido?.stages.find((s) => s.id === v.stageId)?.nombre ?? "Primera etapa";
  const etapaRespuestaNombre = (() => {
    if (v.stageIdRespuestaAutomatica === SIN_ETAPA_RESPUESTA) return "No mover la oportunidad";
    for (const p of pipelines) {
      const s = p.stages.find((x) => x.id === v.stageIdRespuestaAutomatica);
      if (s) return `${p.nombre} · ${s.nombre}`;
    }
    return "No mover la oportunidad";
  })();

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      {/* `sm:max-w-*` es obligatorio: DialogContent trae `sm:max-w-sm` de base y
          un `max-w-*` sin prefijo pierde contra él desde 640px, que es lo que
          dejaba el asistente angosto y cortado. */}
      <DialogContent className="flex max-h-[min(92vh,900px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 gap-6 px-6 pt-6 pb-5 sm:px-8">
          <div className="flex items-start gap-4 pr-8">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </span>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-xl font-semibold leading-tight">
                {esEdicion ? "Editar buzón" : encabezados[paso].titulo}
              </DialogTitle>
              <DialogDescription>{encabezados[paso].descripcion}</DialogDescription>
            </div>
          </div>

          <div className="mx-auto w-full max-w-3xl">
            <IndicadorPasos pasos={PASOS} actual={paso} maximoAlcanzado={maximoAlcanzado} onIr={setPaso} />
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(guardar)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pt-1 pb-6 sm:px-8">
            {/* ── Paso 1: identidad del buzón ───────────────────────────── */}
            {paso === 1 && (
              <>
                <section className="space-y-3">
                  <TituloSeccion>Proveedor de correo</TituloSeccion>
                  <div
                    role="radiogroup"
                    aria-label="Proveedor de correo"
                    className="grid gap-3 sm:grid-cols-3"
                  >
                    {PROVEEDORES.map((p) => (
                      <TarjetaOpcion
                        key={p.clave}
                        seleccionada={proveedor === p.clave}
                        onSeleccionar={() => elegirProveedor(p.clave)}
                        titulo={p.nombre}
                        descripcion={p.descripcion}
                        icono={<LogoProveedor clave={p.clave} />}
                      />
                    ))}
                  </div>
                  <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Elegir Gmail u Outlook solo completa los servidores y puertos por vos. La
                    conexión sigue siendo con usuario y contraseña: Karia no inicia sesión con tu
                    cuenta de Google ni de Microsoft.
                  </p>
                </section>

                <div className="h-px bg-border" />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="direccion">Correo electrónico</Label>
                    <Input
                      id="direccion"
                      type="email"
                      placeholder="ventas@minegocio.com"
                      autoFocus
                      className={CAMPO}
                      {...register("direccion", {
                        onChange: (e) => alEscribirDireccion(e.target.value),
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre del buzón</Label>
                    <Input id="nombre" placeholder="Ventas" className={CAMPO} {...register("nombre")} />
                    <p className="text-xs text-muted-foreground">Solo para reconocerlo en el Inbox.</p>
                  </div>
                </div>
              </>
            )}

            {/* ── Paso 2: credenciales y servidores ─────────────────────── */}
            {paso === 2 && (
              <>
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                  <LogoProveedor clave={proveedor} className="h-6 w-6" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {v.nombre || "Buzón"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {v.direccion} · {datosProveedor.nombre}
                    </p>
                  </div>
                  {!esEdicion && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setPaso(1)}>
                      Cambiar
                    </Button>
                  )}
                </div>

                {datosProveedor.aviso && (
                  <p className="flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/8 p-3.5 text-xs leading-relaxed text-foreground">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    {datosProveedor.aviso}
                  </p>
                )}

                <div className="grid gap-4 lg:grid-cols-2">
                  <BloqueServidor
                    titulo="Servidor de entrada · IMAP"
                    descripcion="Para recibir correos en Karia."
                    icono={<Inbox className="h-5 w-5" />}
                    idPrefijo="entrada"
                    seguridad={v.entradaSeguridad}
                    onSeguridad={(s) => aplicarSeguridad("entrada", s)}
                    registroServidor={register("entradaServidor")}
                    registroPuerto={register("entradaPuerto", { valueAsNumber: true })}
                    registroUsuario={register("entradaUsuario")}
                    registroPassword={register("entradaPassword", {
                      onChange: (e) => {
                        // Un buzón usa la misma contraseña para leer y enviar
                        // en la enorme mayoría de los casos: se copia a la de
                        // salida mientras no la hayan cambiado a mano.
                        if (!v.salidaPassword || v.salidaPassword === v.entradaPassword) {
                          setValue("salidaPassword", e.target.value);
                        }
                      },
                    })}
                    etiquetaPassword={etiquetaPassword}
                    placeholderServidor="imap.minegocio.com"
                    placeholderPassword={esEdicion ? "Vacío = conservar la actual" : ""}
                    verPassword={verPassword}
                    onAlternarPassword={() => setVerPassword((x) => !x)}
                  />
                  <BloqueServidor
                    titulo="Servidor de salida · SMTP"
                    descripcion="Para enviar correos desde Karia."
                    icono={<Send className="h-5 w-5" />}
                    idPrefijo="salida"
                    seguridad={v.salidaSeguridad}
                    onSeguridad={(s) => aplicarSeguridad("salida", s)}
                    registroServidor={register("salidaServidor")}
                    registroPuerto={register("salidaPuerto", { valueAsNumber: true })}
                    registroUsuario={register("salidaUsuario")}
                    registroPassword={register("salidaPassword")}
                    etiquetaPassword={etiquetaPassword}
                    placeholderServidor="smtp.minegocio.com"
                    placeholderPassword={esEdicion ? "Vacío = conservar la actual" : ""}
                    verPassword={verPassword}
                    onAlternarPassword={() => setVerPassword((x) => !x)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nombreRemitente">Nombre que verá el cliente</Label>
                  <Input
                    id="nombreRemitente"
                    placeholder="Ventas Mi Negocio"
                    className={CAMPO}
                    {...register("nombreRemitente")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Aparece como remitente en los correos que envíes desde Karia.
                  </p>
                </div>

                <ResultadoPrueba estado={prueba} />
              </>
            )}

            {/* ── Paso 3: reglas de recepción ───────────────────────────── */}
            {paso === 3 && (
              <>
                <section className="space-y-3">
                  <TituloSeccion>Cómo se agrupan los correos</TituloSeccion>
                  <div
                    role="radiogroup"
                    aria-label="Agrupación de correos"
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    <TarjetaOpcion
                      seleccionada={v.agrupacion === "POR_REMITENTE"}
                      onSeleccionar={() => setValue("agrupacion", "POR_REMITENTE")}
                      titulo="Una conversación por remitente"
                      descripcion="Todo lo que escriba esa persona cae en la misma conversación, aunque abra asuntos distintos."
                      icono={<UserRound className="h-7 w-7" strokeWidth={1.5} />}
                    />
                    <TarjetaOpcion
                      seleccionada={v.agrupacion === "POR_HILO"}
                      onSeleccionar={() => setValue("agrupacion", "POR_HILO")}
                      titulo="Una conversación por hilo de correo"
                      descripcion="Cada asunto nuevo abre su propia conversación. Útil si la misma persona consulta por temas sin relación."
                      icono={<Layers className="h-7 w-7" strokeWidth={1.5} />}
                    />
                  </div>
                </section>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Pipeline de entrada</Label>
                    <Select
                      items={{
                        [SIN_PIPELINE]: "Pipeline por defecto",
                        ...Object.fromEntries(pipelines.map((p) => [p.id, p.nombre])),
                      }}
                      value={v.pipelineId}
                      onValueChange={(valor) => {
                        setValue("pipelineId", valor as string);
                        setValue("stageId", SIN_PIPELINE);
                      }}
                    >
                      <SelectTrigger className={TRIGGER}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SIN_PIPELINE}>Pipeline por defecto</SelectItem>
                        {pipelines.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Etapa inicial</Label>
                    <Select
                      items={{
                        [SIN_PIPELINE]: "Primera etapa",
                        ...Object.fromEntries(
                          (pipelineElegido?.stages ?? []).map((s) => [s.id, s.nombre]),
                        ),
                      }}
                      value={v.stageId}
                      onValueChange={(valor) => setValue("stageId", valor as string)}
                      disabled={!pipelineElegido}
                    >
                      <SelectTrigger className={TRIGGER}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SIN_PIPELINE}>Primera etapa</SelectItem>
                        {(pipelineElegido?.stages ?? []).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="h-px bg-border" />

                <section
                  className={cn(
                    "space-y-5 rounded-xl border p-5 transition-colors",
                    v.requiereAprobacion
                      ? "border-warning/30 bg-warning/5"
                      : "border-border bg-muted/30",
                  )}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-colors",
                        v.requiereAprobacion
                          ? "border-warning/30 bg-warning/15 text-warning"
                          : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {v.requiereAprobacion ? (
                        <Lock className="h-5 w-5" />
                      ) : (
                        <LockOpen className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0 space-y-1.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md border px-2.5 py-0.5 text-sm font-semibold",
                          v.requiereAprobacion
                            ? "border-warning/30 bg-warning/15 text-warning"
                            : "border-primary/30 bg-primary/10 text-primary",
                        )}
                      >
                        {v.requiereAprobacion ? "Requiere aprobación" : "Entrada automática"}
                      </span>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {v.requiereAprobacion
                          ? "Los correos de direcciones que no están en tu CRM quedan bloqueados: nadie puede responderlos —ni vos, ni el agente de IA, ni un Workflow— hasta aprobar al remitente."
                          : "Cada dirección nueva que escriba se convierte en contacto y oportunidad automáticamente."}
                      </p>
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-center gap-3">
                    <Switch
                      checked={v.requiereAprobacion}
                      onCheckedChange={(x) => setValue("requiereAprobacion", x)}
                    />
                    <span className="text-sm font-medium text-foreground">
                      Aprobar remitentes desconocidos antes de responder
                    </span>
                  </label>
                  {v.requiereAprobacion && (
                    <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">
                      Conviene si tu dirección está publicada y recibís proveedores, facturas o
                      spam. Una vez aprobado un remitente, sus correos siguientes entran solos.
                    </p>
                  )}

                  <div className="space-y-2 border-t border-border pt-4">
                    <Label>Etapa al responder</Label>
                    <Select
                      items={{
                        [SIN_ETAPA_RESPUESTA]: "No mover la oportunidad",
                        ...Object.fromEntries(
                          pipelines.flatMap((p) =>
                            p.stages.map((s) => [s.id, `${p.nombre} · ${s.nombre}`] as const),
                          ),
                        ),
                      }}
                      value={v.stageIdRespuestaAutomatica}
                      onValueChange={(valor) => setValue("stageIdRespuestaAutomatica", valor as string)}
                    >
                      <SelectTrigger className={TRIGGER}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SIN_ETAPA_RESPUESTA}>No mover la oportunidad</SelectItem>
                        {pipelines.flatMap((p) =>
                          p.stages.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {p.nombre} · {s.nombre}
                            </SelectItem>
                          )),
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Al responder por primera vez un correo que está en la etapa inicial, su
                      oportunidad se mueve acá. Aplica siempre, con o sin aprobación.
                    </p>
                  </div>
                </section>
              </>
            )}

            {/* ── Paso 4: confirmación ──────────────────────────────────── */}
            {paso === 4 && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <BloqueResumen titulo="Buzón" icono={<LogoProveedor clave={proveedor} className="h-5 w-5" />}>
                    <FilaResumen etiqueta="Nombre" valor={v.nombre} />
                    <FilaResumen etiqueta="Dirección" valor={v.direccion} />
                    <FilaResumen
                      etiqueta="Entrada"
                      valor={`${v.entradaServidor}:${v.entradaPuerto} · ${ETIQUETAS_SEGURIDAD[v.entradaSeguridad]}`}
                      tenue
                    />
                    <FilaResumen
                      etiqueta="Salida"
                      valor={`${v.salidaServidor}:${v.salidaPuerto} · ${ETIQUETAS_SEGURIDAD[v.salidaSeguridad]}`}
                      tenue
                    />
                    <FilaResumen
                      etiqueta="Conexión"
                      valor={
                        conexionesOk ? (
                          <span className="flex items-center justify-end gap-1 text-success">
                            <CheckCircle2 className="h-4 w-4" />
                            Verificada
                          </span>
                        ) : (
                          <span className="text-destructive">Sin verificar</span>
                        )
                      }
                    />
                  </BloqueResumen>

                  <BloqueResumen titulo="Recepción" icono={<Inbox className="h-5 w-5 text-primary" />}>
                    <FilaResumen
                      etiqueta="Agrupación"
                      valor={v.agrupacion === "POR_HILO" ? "Por hilo de correo" : "Por remitente"}
                    />
                    <FilaResumen
                      etiqueta="Entra en"
                      valor={`${pipelineElegido?.nombre ?? "Pipeline por defecto"} · ${etapaInicialNombre}`}
                    />
                    <FilaResumen etiqueta="Al responder" valor={etapaRespuestaNombre} />
                    <FilaResumen
                      etiqueta="Remitentes desconocidos"
                      valor={
                        v.requiereAprobacion ? (
                          <span className="text-warning">Requieren aprobación</span>
                        ) : (
                          "Se crean automáticamente"
                        )
                      }
                    />
                  </BloqueResumen>
                </div>

                <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Al activar, Karia empieza a leer desde los correos que lleguen de ahora en
                  adelante: lo que ya estaba en la casilla no se importa.
                </p>
              </>
            )}

            {errorGuardado && (
              <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {errorGuardado}
              </p>
            )}
          </div>

          {/* ── Pie ───────────────────────────────────────────────────────── */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-6 py-4 sm:px-8">
            {paso === 1 ? (
              <Button type="button" variant="outline" size="lg" onClick={onCerrar} disabled={guardando}>
                Cancelar
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setPaso(paso - 1)}
                disabled={guardando}
              >
                <ArrowLeft className="h-4 w-4" />
                Atrás
              </Button>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3">
              {paso === 2 && !conexionesOk && (
                <span className="hidden text-xs text-muted-foreground md:inline">
                  Probá la conexión para poder continuar.
                </span>
              )}

              {paso === 2 && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={probar}
                  disabled={prueba.fase === "probando" || !datosServidorCompletos}
                >
                  {prueba.fase === "probando" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plug className="h-4 w-4" />
                  )}
                  Probar conexión
                </Button>
              )}

              {paso < 4 ? (
                <Button
                  type="button"
                  size="lg"
                  className="px-4"
                  onClick={avanzar}
                  disabled={
                    (paso === 1 && !pasoUnoCompleto) ||
                    (paso === 2 && !(datosServidorCompletos && conexionesOk))
                  }
                >
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" size="lg" className="px-4" disabled={guardando || !conexionesOk}>
                  {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
                  {esEdicion ? "Guardar cambios" : "Activar buzón"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Piezas locales ──────────────────────────────────────────────────────────

const CAMPO = "h-10";
// El trigger fija su alto con `data-[size=default]:h-8`; un `h-10` suelto
// pierde por especificidad, así que se pisa la misma variante.
const TRIGGER = "w-full data-[size=default]:h-10";

function TituloSeccion({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground">{children}</h3>;
}

function BloqueResumen({
  titulo,
  icono,
  children,
}: {
  titulo: string;
  icono: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/50">
          {icono}
        </span>
        <p className="text-sm font-semibold text-foreground">{titulo}</p>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

// ── Bloque de un servidor ───────────────────────────────────────────────────

type RegistroCampo = ReturnType<ReturnType<typeof useForm<FormBuzon>>["register"]>;

function BloqueServidor({
  titulo,
  descripcion,
  icono,
  idPrefijo,
  seguridad,
  onSeguridad,
  registroServidor,
  registroPuerto,
  registroUsuario,
  registroPassword,
  etiquetaPassword,
  placeholderServidor,
  placeholderPassword,
  verPassword,
  onAlternarPassword,
}: {
  titulo: string;
  descripcion: string;
  icono: ReactNode;
  idPrefijo: string;
  seguridad: SeguridadCorreo;
  onSeguridad: (s: SeguridadCorreo) => void;
  registroServidor: RegistroCampo;
  registroPuerto: RegistroCampo;
  registroUsuario: RegistroCampo;
  registroPassword: RegistroCampo;
  etiquetaPassword: string;
  placeholderServidor: string;
  placeholderPassword: string;
  verPassword: boolean;
  onAlternarPassword: () => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
          {icono}
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">{titulo}</p>
          <p className="text-xs text-muted-foreground">{descripcion}</p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefijo}-servidor`}>Servidor</Label>
          <Input
            id={`${idPrefijo}-servidor`}
            placeholder={placeholderServidor}
            className={CAMPO}
            {...registroServidor}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefijo}-puerto`}>Puerto</Label>
          <Input id={`${idPrefijo}-puerto`} type="number" className={CAMPO} {...registroPuerto} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Seguridad</Label>
        <Segmentado
          valor={seguridad}
          opciones={OPCIONES_SEGURIDAD}
          onCambiar={onSeguridad}
          etiquetaAccesible={`Seguridad de ${titulo}`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefijo}-usuario`}>Usuario</Label>
          <Input id={`${idPrefijo}-usuario`} className={CAMPO} {...registroUsuario} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefijo}-password`}>{etiquetaPassword}</Label>
          <div className="relative">
            <Input
              id={`${idPrefijo}-password`}
              type={verPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={placeholderPassword}
              className={cn(CAMPO, "pr-10")}
              {...registroPassword}
            />
            <button
              type="button"
              onClick={onAlternarPassword}
              aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Resultado de la prueba ──────────────────────────────────────────────────

function ResultadoPrueba({ estado }: { estado: EstadoPrueba }) {
  if (estado.fase !== "listo") return null;

  const filas = [
    { etiqueta: "Entrada", ...estado.entrada },
    { etiqueta: "Salida", ...estado.salida },
  ];
  const todoOk = filas.every((f) => f.ok);

  return (
    <div
      className={cn(
        "grid gap-2 rounded-xl border p-4 sm:grid-cols-2",
        todoOk ? "border-success/30 bg-success/8" : "border-destructive/30 bg-destructive/5",
      )}
    >
      {filas.map((f) => (
        <div key={f.etiqueta} className="flex items-start gap-2 text-sm">
          {f.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          )}
          <span className="shrink-0 font-medium text-foreground">{f.etiqueta}</span>
          <span className={cn("min-w-0 break-words text-muted-foreground", f.ok && "text-success")}>
            {f.ok ? "Conexión correcta" : (f.mensaje ?? "No se pudo conectar")}
          </span>
        </div>
      ))}
    </div>
  );
}
