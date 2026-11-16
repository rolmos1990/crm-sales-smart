"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { AlertCircle, CheckCircle2, Loader2, Plug } from "lucide-react";
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
  ETIQUETAS_AGRUPACION,
  ETIQUETAS_SEGURIDAD,
  PUERTOS_SUGERIDOS,
  type AgrupacionCorreo,
  type BuzonParaCliente,
  type SeguridadCorreo,
} from "../tipos";
import { actualizarBuzon, probarConexionBuzon, registrarBuzon } from "../actions";

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
  crearContactosAutomaticamente: boolean;
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

// El mapa valor → etiqueta que exige el <Select> de Base UI (ver docs/selects.md):
// sin esto el trigger muestra "SSL_TLS" crudo hasta que el usuario abre el popup.
const ITEMS_SEGURIDAD: Record<string, string> = ETIQUETAS_SEGURIDAD;
const ITEMS_AGRUPACION: Record<string, string> = ETIQUETAS_AGRUPACION;

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
    crearContactosAutomaticamente: buzon?.recepcion.crearContactosAutomaticamente ?? true,
    pipelineId: buzon?.pipelineId ?? SIN_PIPELINE,
    stageId: buzon?.stageId ?? SIN_PIPELINE,
    stageIdRespuestaAutomatica: buzon?.stageIdRespuestaAutomatica ?? SIN_PIPELINE,
  };
}

export function ModalRegistrarBuzon({ abierto, onCerrar, buzon, pipelines }: Props) {
  const esEdicion = Boolean(buzon);
  const [prueba, setPrueba] = useState<EstadoPrueba>({ fase: "sin_probar" });
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);

  const form = useForm<FormBuzon>({ defaultValues: valoresIniciales(buzon) });
  const { register, handleSubmit, watch, setValue, formState } = form;

  const valores = watch();
  const pipelineElegido = pipelines.find((p) => p.id === valores.pipelineId);
  const conexionesOk = prueba.fase === "listo" && prueba.entrada.ok && prueba.salida.ok;

  const itemsPipeline: Record<string, string> = {
    [SIN_PIPELINE]: "Pipeline por defecto de la cuenta",
    ...Object.fromEntries(pipelines.map((p) => [p.id, p.nombre])),
  };
  const itemsEtapa: Record<string, string> = {
    [SIN_PIPELINE]: "Primera etapa del pipeline",
    ...Object.fromEntries((pipelineElegido?.stages ?? []).map((s) => [s.id, s.nombre])),
  };
  // La etapa de respuesta puede estar en cualquier pipeline, igual que en los
  // canales de mensajería: el pipeline destino se deriva del stage.
  const todasLasEtapas = pipelines.flatMap((p) =>
    p.stages.map((s) => [s.id, `${p.nombre} · ${s.nombre}`] as const),
  );
  const itemsEtapaRespuesta: Record<string, string> = {
    [SIN_PIPELINE]: "No mover la oportunidad",
    ...Object.fromEntries(todasLasEtapas),
  };

  function aplicarSeguridad(lado: "entrada" | "salida", seguridad: SeguridadCorreo) {
    if (lado === "entrada") {
      setValue("entradaSeguridad", seguridad);
      setValue("entradaPuerto", PUERTOS_SUGERIDOS[seguridad].entrada);
    } else {
      setValue("salidaSeguridad", seguridad);
      setValue("salidaPuerto", PUERTOS_SUGERIDOS[seguridad].salida);
    }
    // Cambió la conexión: la prueba anterior ya no vale.
    setPrueba({ fase: "sin_probar" });
  }

  function aPayload(v: FormBuzon) {
    return {
      nombre: v.nombre,
      direccion: v.direccion,
      entrada: {
        servidor: v.entradaServidor,
        puerto: Number(v.entradaPuerto),
        seguridad: v.entradaSeguridad,
        usuario: v.entradaUsuario || v.direccion,
        ...(v.entradaPassword ? { password: v.entradaPassword } : {}),
      },
      salida: {
        servidor: v.salidaServidor,
        puerto: Number(v.salidaPuerto),
        seguridad: v.salidaSeguridad,
        usuario: v.salidaUsuario || v.direccion,
        ...(v.salidaPassword ? { password: v.salidaPassword } : {}),
        ...(v.nombreRemitente ? { nombreRemitente: v.nombreRemitente } : {}),
      },
      recepcion: {
        agrupacion: v.agrupacion,
        crearContactosAutomaticamente: v.crearContactosAutomaticamente,
      },
      pipelineId: v.pipelineId === SIN_PIPELINE ? null : v.pipelineId,
      stageId: v.stageId === SIN_PIPELINE ? null : v.stageId,
      stageIdRespuestaAutomatica:
        v.stageIdRespuestaAutomatica === SIN_PIPELINE ? null : v.stageIdRespuestaAutomatica,
    };
  }

  async function probar() {
    setPrueba({ fase: "probando" });
    setErrorGuardado(null);
    const payload = aPayload(valores);

    const resultado = await probarConexionBuzon({
      ...(buzon ? { cuentaCanalId: buzon.id } : {}),
      entrada: payload.entrada,
      salida: payload.salida,
    });

    if (!resultado.ok) {
      setPrueba({
        fase: "listo",
        entrada: { ok: false, mensaje: resultado.error },
        salida: { ok: false, mensaje: resultado.error },
      });
      return;
    }

    setPrueba({
      fase: "listo",
      entrada: { ok: resultado.data.entrada.ok, mensaje: resultado.data.entrada.mensaje },
      salida: { ok: resultado.data.salida.ok, mensaje: resultado.data.salida.mensaje },
    });
  }

  async function guardar(v: FormBuzon) {
    setGuardando(true);
    setErrorGuardado(null);

    const payload = aPayload(v);
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

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Editar buzón" : "Agregar buzón de correo"}</DialogTitle>
          <DialogDescription>
            {esEdicion
              ? "Dejá las contraseñas vacías para conservar las que ya están guardadas."
              : "Necesitás los datos IMAP y SMTP de tu proveedor de correo. Si pide contraseña de aplicación, generala antes."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(guardar)} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" placeholder="Ventas" {...register("nombre", { required: true })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                type="email"
                placeholder="ventas@minegocio.com"
                {...register("direccion", { required: true })}
              />
            </div>
          </div>

          <ConexionCampos
            titulo="Entrada (recepción)"
            lado="entrada"
            seguridad={valores.entradaSeguridad}
            onSeguridad={(s) => aplicarSeguridad("entrada", s)}
            registroServidor={register("entradaServidor", { required: true })}
            registroPuerto={register("entradaPuerto", { required: true, valueAsNumber: true })}
            registroUsuario={register("entradaUsuario")}
            registroPassword={register("entradaPassword")}
            placeholderServidor="imap.minegocio.com"
            passwordRequerida={!esEdicion}
            direccion={valores.direccion}
          />

          <ConexionCampos
            titulo="Salida (envío)"
            lado="salida"
            seguridad={valores.salidaSeguridad}
            onSeguridad={(s) => aplicarSeguridad("salida", s)}
            registroServidor={register("salidaServidor", { required: true })}
            registroPuerto={register("salidaPuerto", { required: true, valueAsNumber: true })}
            registroUsuario={register("salidaUsuario")}
            registroPassword={register("salidaPassword")}
            placeholderServidor="smtp.minegocio.com"
            passwordRequerida={!esEdicion}
            direccion={valores.direccion}
          />

          <div className="space-y-1.5">
            <Label htmlFor="nombreRemitente">Nombre que ve el cliente</Label>
            <Input
              id="nombreRemitente"
              placeholder="Ventas Mi Negocio"
              {...register("nombreRemitente")}
            />
          </div>

          <div className="space-y-3 rounded-xl border border-border p-4">
            <p className="text-sm font-medium text-foreground">Recepción</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Pipeline de entrada</Label>
                <Select
                  items={itemsPipeline}
                  value={valores.pipelineId}
                  onValueChange={(v) => {
                    setValue("pipelineId", v as string);
                    setValue("stageId", SIN_PIPELINE);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_PIPELINE}>Pipeline por defecto de la cuenta</SelectItem>
                    {pipelines.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Etapa de entrada</Label>
                <Select
                  items={itemsEtapa}
                  value={valores.stageId}
                  onValueChange={(v) => setValue("stageId", v as string)}
                  disabled={!pipelineElegido}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_PIPELINE}>Primera etapa del pipeline</SelectItem>
                    {(pipelineElegido?.stages ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Etapa al responder</Label>
              <Select
                items={itemsEtapaRespuesta}
                value={valores.stageIdRespuestaAutomatica}
                onValueChange={(v) => setValue("stageIdRespuestaAutomatica", v as string)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_PIPELINE}>No mover la oportunidad</SelectItem>
                  {pipelines.flatMap((p) =>
                    p.stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {p.nombre} · {s.nombre}
                      </SelectItem>
                    )),
                  )}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Al responder por primera vez un correo que está en la etapa inicial, la oportunidad
                se mueve acá.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Agrupación de correos</Label>
              <Select
                items={ITEMS_AGRUPACION}
                value={valores.agrupacion}
                onValueChange={(v) => setValue("agrupacion", v as AgrupacionCorreo)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ETIQUETAS_AGRUPACION) as AgrupacionCorreo[]).map((a) => (
                    <SelectItem key={a} value={a}>
                      {ETIQUETAS_AGRUPACION[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start justify-between gap-4 pt-1">
              <div>
                <p className="text-sm text-foreground">Crear contactos automáticamente</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Si lo desactivás, los correos de remitentes desconocidos quedan pendientes de
                  aprobación y no se pueden responder hasta aprobarlos.
                </p>
              </div>
              <Switch
                checked={valores.crearContactosAutomaticamente}
                onCheckedChange={(v) => setValue("crearContactosAutomaticamente", v)}
              />
            </div>
          </div>

          <ResultadoPrueba estado={prueba} />

          {errorGuardado && (
            <p className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {errorGuardado}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={probar}
              disabled={prueba.fase === "probando" || guardando}
            >
              {prueba.fase === "probando" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plug className="h-4 w-4" />
              )}
              Probar conexión
            </Button>

            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={onCerrar} disabled={guardando}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!conexionesOk || guardando || !formState.isValid}>
                {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
                {esEdicion ? "Guardar cambios" : "Agregar buzón"}
              </Button>
            </div>
          </div>

          {!conexionesOk && (
            <p className="text-xs text-muted-foreground text-right">
              Probá la conexión antes de guardar.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Bloque de una conexión ──────────────────────────────────────────────────

type RegistroCampo = ReturnType<ReturnType<typeof useForm<FormBuzon>>["register"]>;

function ConexionCampos(props: {
  titulo: string;
  lado: "entrada" | "salida";
  seguridad: SeguridadCorreo;
  onSeguridad: (s: SeguridadCorreo) => void;
  registroServidor: RegistroCampo;
  registroPuerto: RegistroCampo;
  registroUsuario: RegistroCampo;
  registroPassword: RegistroCampo;
  placeholderServidor: string;
  passwordRequerida: boolean;
  direccion: string;
}) {
  const id = props.lado;
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <p className="text-sm font-medium text-foreground">{props.titulo}</p>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-servidor`}>Servidor</Label>
          <Input
            id={`${id}-servidor`}
            placeholder={props.placeholderServidor}
            {...props.registroServidor}
          />
        </div>
        <div className="space-y-1.5 w-24">
          <Label htmlFor={`${id}-puerto`}>Puerto</Label>
          <Input id={`${id}-puerto`} type="number" {...props.registroPuerto} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Seguridad</Label>
        <Select
          items={ITEMS_SEGURIDAD}
          value={props.seguridad}
          onValueChange={(v) => props.onSeguridad(v as SeguridadCorreo)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ETIQUETAS_SEGURIDAD) as SeguridadCorreo[]).map((s) => (
              <SelectItem key={s} value={s}>
                {ETIQUETAS_SEGURIDAD[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-usuario`}>Usuario</Label>
          <Input
            id={`${id}-usuario`}
            placeholder={props.direccion || "usuario"}
            {...props.registroUsuario}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-password`}>Contraseña</Label>
          <Input
            id={`${id}-password`}
            type="password"
            placeholder={props.passwordRequerida ? "" : "Sin cambios"}
            autoComplete="new-password"
            {...props.registroPassword}
          />
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

  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      {filas.map((f) => (
        <div key={f.etiqueta} className="flex items-start gap-2 text-sm">
          {f.ok ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
          )}
          <span className="font-medium text-foreground w-16 shrink-0">{f.etiqueta}</span>
          <span className={cn("text-muted-foreground", f.ok && "text-emerald-500")}>
            {f.ok ? "Conexión correcta" : (f.mensaje ?? "No se pudo conectar")}
          </span>
        </div>
      ))}
    </div>
  );
}
