"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  obtenerOportunidadAction,
  crearOportunidad,
  actualizarOportunidad,
  eliminarOportunidad,
} from "./actions";
import { moverAStage } from "@/crm/pipeline/actions";
import { queryKeys } from "@/shared/query-keys";
import type { Oportunidad } from "./types";
import type { CrearOportunidadInput, ActualizarOportunidadInput } from "./schema";
type OportunidadDetalle = NonNullable<Awaited<ReturnType<typeof obtenerOportunidadAction>>>;

export function useCrearOportunidadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: CrearOportunidadInput) =>
      crearOportunidad(datos).then((r) => {
        if (!r.exito) throw new Error(r.error);
        return r.datos;
      }),
    onError: (err) => {
      toast.error(err.message ?? "Error al crear la oportunidad");
    },
    onSuccess: () => {
      toast.success("Oportunidad creada");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.oportunidades.all() });
    },
  });
}

export function useOportunidadQuery(
  id: string | null,
  initialData?: OportunidadDetalle,
) {
  return useQuery({
    queryKey: queryKeys.oportunidades.detail(id ?? ""),
    queryFn: () => obtenerOportunidadAction(id!),
    enabled: !!id,
    initialData,
    staleTime: 30_000,
  });
}

export function useActualizarOportunidadMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: ActualizarOportunidadInput) =>
      actualizarOportunidad(id, datos).then((r) => {
        if (!r.exito) throw new Error(r.error);
        return r.datos;
      }),
    onMutate: async (datos) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.oportunidades.detail(id) });
      const anterior = queryClient.getQueryData<OportunidadDetalle>(
        queryKeys.oportunidades.detail(id),
      );
      if (anterior) {
        queryClient.setQueryData(queryKeys.oportunidades.detail(id), {
          ...anterior,
          ...(datos.titulo !== undefined && { titulo: datos.titulo }),
          ...(datos.notas !== undefined && { notas: datos.notas }),
          ...(datos.etapa !== undefined && { etapa: datos.etapa }),
          ...(datos.empresaId !== undefined && { empresaId: datos.empresaId || null }),
          ...(datos.fechaCierre !== undefined && { fechaCierre: datos.fechaCierre ?? null }),
        } as OportunidadDetalle);
      }
      return { anterior };
    },
    onError: (_err, _datos, context) => {
      if (context?.anterior) {
        queryClient.setQueryData(queryKeys.oportunidades.detail(id), context.anterior);
      }
      toast.error("Error al guardar la oportunidad");
    },
    onSuccess: () => {
      toast.success("Oportunidad actualizada");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.oportunidades.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.oportunidades.all() });
    },
  });
}

export function useEliminarOportunidadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      eliminarOportunidad(id).then((r) => {
        if (!r.exito) throw new Error(r.error);
      }),
    onError: () => {
      toast.error("Error al eliminar la oportunidad");
    },
    onSuccess: (_, id) => {
      toast.success("Oportunidad eliminada");
      queryClient.removeQueries({ queryKey: queryKeys.oportunidades.detail(id) });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.oportunidades.all() });
    },
  });
}

interface MoverAStageVars {
  oportunidadId: string;
  nuevoStageId: string;
  pipelineId: string;
}

export function useMoverAStageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ oportunidadId, nuevoStageId, pipelineId }: MoverAStageVars) =>
      moverAStage(oportunidadId, nuevoStageId, pipelineId).then((r) => {
        if (!r.exito) throw new Error(r.error);
      }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.oportunidades.all() });
    },
  });
}

export type { OportunidadDetalle, Oportunidad };
