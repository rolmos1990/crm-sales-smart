"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  obtenerEmpresaAction,
  crearEmpresa,
  actualizarEmpresa,
  eliminarEmpresa,
} from "./actions";
import { queryKeys } from "@/shared/query-keys";
import type { CrearEmpresaInput, ActualizarEmpresaInput } from "./schema";

type EmpresaDetalle = NonNullable<Awaited<ReturnType<typeof obtenerEmpresaAction>>>;

export function useEmpresaQuery(
  id: string | null,
  initialData?: EmpresaDetalle,
) {
  return useQuery({
    queryKey: queryKeys.empresas.detail(id ?? ""),
    queryFn: () => obtenerEmpresaAction(id!),
    enabled: !!id,
    initialData,
    staleTime: 30_000,
  });
}

export function useCrearEmpresaMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: CrearEmpresaInput) =>
      crearEmpresa(datos).then((r) => {
        if (!r.exito) throw new Error(r.error);
        return r.datos;
      }),
    onError: (err) => {
      toast.error(err.message ?? "Error al crear la empresa");
    },
    onSuccess: () => {
      toast.success("Empresa creada");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.empresas.all() });
    },
  });
}

export function useActualizarEmpresaMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: ActualizarEmpresaInput) =>
      actualizarEmpresa(id, datos).then((r) => {
        if (!r.exito) throw new Error(r.error);
        return r.datos;
      }),
    onMutate: async (datos) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.empresas.detail(id) });
      const anterior = queryClient.getQueryData<EmpresaDetalle>(
        queryKeys.empresas.detail(id),
      );
      if (anterior) {
        queryClient.setQueryData<EmpresaDetalle>(queryKeys.empresas.detail(id), {
          ...anterior,
          ...datos,
        });
      }
      return { anterior };
    },
    onError: (_err, _datos, context) => {
      if (context?.anterior) {
        queryClient.setQueryData(queryKeys.empresas.detail(id), context.anterior);
      }
      toast.error("Error al guardar la empresa");
    },
    onSuccess: () => {
      toast.success("Empresa actualizada");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.empresas.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.empresas.all() });
    },
  });
}

export function useEliminarEmpresaMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      eliminarEmpresa(id).then((r) => {
        if (!r.exito) throw new Error(r.error);
      }),
    onError: () => {
      toast.error("Error al eliminar la empresa");
    },
    onSuccess: (_, id) => {
      toast.success("Empresa eliminada");
      queryClient.removeQueries({ queryKey: queryKeys.empresas.detail(id) });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.empresas.all() });
    },
  });
}

export type { EmpresaDetalle };
