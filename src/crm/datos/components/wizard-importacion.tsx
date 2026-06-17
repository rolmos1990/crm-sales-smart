"use client";

import { useState, useTransition } from "react";
import { IndicadorPasos } from "./indicador-pasos";
import { PasoTipoDatos } from "./paso-tipo-datos";
import { PasoArchivo } from "./paso-archivo";
import { PasoVistaPrevia } from "./paso-vista-previa";
import { PasoMapeo } from "./paso-mapeo";
import { PasoValidacion } from "./paso-validacion";
import { PasoImportacion } from "./paso-importacion";
import { importarRegistrosAction, obtenerCamposEntidadAction } from "../actions";
import { validarRegistros } from "../utils/validar-registros";
import { obtenerCamposEntidad } from "../utils/campos-entidad";
import type {
  EstadoWizard,
  EntidadImportable,
  DatosArchivo,
  MapeoColumna,
  CampoPersonalizadoResumen,
} from "../types";

const ORDEN_PASOS: EstadoWizard["paso"][] = [
  "tipo-datos",
  "archivo",
  "vista-previa",
  "mapeo",
  "validacion",
  "importacion",
];

const ESTADO_INICIAL: EstadoWizard = {
  paso: "tipo-datos",
  entidad: null,
  archivo: null,
  mapeos: [],
  soloValidos: false,
  validacion: null,
  resultado: null,
  cargando: false,
};

interface WizardImportacionProps {
  camposPersonalizados: CampoPersonalizadoResumen[];
}

export function WizardImportacion({
  camposPersonalizados: camposPersonalizadosIniciales,
}: WizardImportacionProps) {
  const [estado, setEstado] = useState<EstadoWizard>(ESTADO_INICIAL);
  const [camposPersonalizados, setCamposPersonalizados] = useState<
    CampoPersonalizadoResumen[]
  >(camposPersonalizadosIniciales);
  const [isPending, startTransition] = useTransition();

  const pasoIndex = ORDEN_PASOS.indexOf(estado.paso);

  const seleccionarEntidad = async (entidad: EntidadImportable) => {
    setEstado((e) => ({
      ...e,
      entidad,
      archivo: null,
      mapeos: [],
      validacion: null,
      resultado: null,
      paso: "archivo",
    }));

    const campos = await obtenerCamposEntidadAction(entidad);
    setCamposPersonalizados(campos);
  };

  const seleccionarArchivo = (archivo: DatosArchivo) => {
    setEstado((e) => ({ ...e, archivo, paso: "vista-previa" }));
  };

  const confirmarVistaPrevia = () => {
    setEstado((e) => ({ ...e, paso: "mapeo" }));
  };

  const confirmarMapeo = (mapeos: MapeoColumna[]) => {
    const camposStd = obtenerCamposEntidad(estado.entidad!);
    const validacion = validarRegistros(
      estado.archivo!.filas,
      mapeos,
      camposStd,
      estado.entidad!,
    );
    setEstado((e) => ({ ...e, mapeos, validacion, paso: "validacion" }));
  };

  const confirmarValidacion = (soloValidos: boolean) => {
    setEstado((e) => ({ ...e, soloValidos, paso: "importacion" }));
  };

  const ejecutarImportacion = () => {
    startTransition(async () => {
      setEstado((e) => ({ ...e, cargando: true }));

      const filasParaImportar = estado.soloValidos
        ? estado.validacion!.filasValidas
        : [
            ...estado.validacion!.filasValidas,
            ...estado.validacion!.filasConError,
          ];

      const resultado = await importarRegistrosAction({
        entidad: estado.entidad!,
        archivoNombre: estado.archivo!.nombre,
        archivoTipo: estado.archivo!.tipo,
        archivoPeso: estado.archivo!.peso,
        registros: filasParaImportar,
        mapeos: estado.mapeos,
      });

      if (resultado.exito) {
        setEstado((e) => ({
          ...e,
          resultado: resultado.datos,
          cargando: false,
        }));
      } else {
        setEstado((e) => ({ ...e, cargando: false }));
      }
    });
  };

  const reiniciar = () => {
    setEstado(ESTADO_INICIAL);
    setCamposPersonalizados(camposPersonalizadosIniciales);
  };

  const filasAImportar = estado.soloValidos
    ? (estado.validacion?.filasValidas ?? [])
    : [
        ...(estado.validacion?.filasValidas ?? []),
        ...(estado.validacion?.filasConError ?? []),
      ];

  // Para Pedidos mostramos el número de pedidos únicos (grupos), no de filas
  const registrosAImportar =
    estado.entidad === "PEDIDO"
      ? new Set(
          filasAImportar
            .map((f) => String((f as Record<string, unknown>).idPedido ?? "").trim())
            .filter(Boolean),
        ).size
      : filasAImportar.length;

  return (
    <div className="flex flex-col gap-8">
      <IndicadorPasos pasoActual={pasoIndex} />

      <div className="rounded-2xl border border-white/10 bg-white/4 backdrop-blur-xl p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.4)]">
        {estado.paso === "tipo-datos" && (
          <PasoTipoDatos
            onSeleccionar={seleccionarEntidad}
            entidadActual={estado.entidad}
          />
        )}

        {estado.paso === "archivo" && estado.entidad && (
          <PasoArchivo
            entidad={estado.entidad}
            onArchivoParsed={seleccionarArchivo}
            onAtras={() => setEstado((e) => ({ ...e, paso: "tipo-datos" }))}
          />
        )}

        {estado.paso === "vista-previa" && estado.archivo && (
          <PasoVistaPrevia
            archivo={estado.archivo}
            onConfirmar={confirmarVistaPrevia}
            onAtras={() => setEstado((e) => ({ ...e, paso: "archivo" }))}
          />
        )}

        {estado.paso === "mapeo" && estado.entidad && estado.archivo && (
          <PasoMapeo
            entidad={estado.entidad}
            encabezados={estado.archivo.encabezados}
            camposPersonalizados={camposPersonalizados}
            mapeoInicial={estado.mapeos}
            onConfirmar={confirmarMapeo}
            onAtras={() => setEstado((e) => ({ ...e, paso: "vista-previa" }))}
          />
        )}

        {estado.paso === "validacion" && estado.validacion && (
          <PasoValidacion
            validacion={estado.validacion}
            onConfirmar={confirmarValidacion}
            onAtras={() => setEstado((e) => ({ ...e, paso: "mapeo" }))}
          />
        )}

        {estado.paso === "importacion" && (
          <PasoImportacion
            resultado={estado.resultado}
            registrosAImportar={registrosAImportar}
            etiquetaRegistro={estado.entidad === "PEDIDO" ? "pedidos" : "registros"}
            cargando={isPending}
            onEjecutar={ejecutarImportacion}
            onReiniciar={reiniciar}
          />
        )}
      </div>
    </div>
  );
}
