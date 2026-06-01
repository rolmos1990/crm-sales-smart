"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crearActividad } from "./actions";
import { queryKeys } from "@/shared/query-keys";
import type { CrearActividadInput } from "./schema";

export function useCrearActividadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: CrearActividadInput) =>
      crearActividad(datos).then((r) => {
        if (!r.exito) throw new Error(r.error);
        return r.datos;
      }),
    onError: (err) => {
      toast.error(err.message ?? "Error al crear la actividad");
    },
    onSuccess: (_, datos) => {
      toast.success("Actividad creada");
      queryClient.invalidateQueries({ queryKey: queryKeys.actividades.all() });
      if (datos.contactoId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.actividades.porEntidad("contacto", datos.contactoId),
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.contactos.detail(datos.contactoId) });
      }
      if (datos.empresaId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.actividades.porEntidad("empresa", datos.empresaId),
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.empresas.detail(datos.empresaId) });
      }
      if (datos.oportunidadId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.actividades.porEntidad("oportunidad", datos.oportunidadId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.oportunidades.detail(datos.oportunidadId),
        });
      }
    },
  });
}
