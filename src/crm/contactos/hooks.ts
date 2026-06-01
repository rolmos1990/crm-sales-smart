"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  obtenerContactoAction,
  crearContacto,
  actualizarContacto,
  eliminarContacto,
} from "./actions";
import { queryKeys } from "@/shared/query-keys";
import type { CrearContactoInput, ActualizarContactoInput } from "./schema";

type ContactoDetalle = NonNullable<Awaited<ReturnType<typeof obtenerContactoAction>>>;

export function useContactoQuery(
  id: string | null,
  initialData?: ContactoDetalle,
) {
  return useQuery({
    queryKey: queryKeys.contactos.detail(id ?? ""),
    queryFn: () => obtenerContactoAction(id!),
    enabled: !!id,
    initialData,
    staleTime: 30_000,
  });
}

export function useCrearContactoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: CrearContactoInput) =>
      crearContacto(datos).then((r) => {
        if (!r.exito) throw new Error(r.error);
        return r.datos;
      }),
    onError: (err) => {
      toast.error(err.message ?? "Error al crear el contacto");
    },
    onSuccess: () => {
      toast.success("Contacto creado");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contactos.all() });
    },
  });
}

export function useActualizarContactoMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: ActualizarContactoInput) =>
      actualizarContacto(id, datos).then((r) => {
        if (!r.exito) throw new Error(r.error);
        return r.datos;
      }),
    onMutate: async (datos) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.contactos.detail(id) });
      const anterior = queryClient.getQueryData<ContactoDetalle>(
        queryKeys.contactos.detail(id),
      );
      if (anterior) {
        queryClient.setQueryData<ContactoDetalle>(queryKeys.contactos.detail(id), {
          ...anterior,
          ...datos,
        });
      }
      return { anterior };
    },
    onError: (_err, _datos, context) => {
      if (context?.anterior) {
        queryClient.setQueryData(queryKeys.contactos.detail(id), context.anterior);
      }
      toast.error("Error al guardar el contacto");
    },
    onSuccess: () => {
      toast.success("Contacto actualizado");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contactos.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.contactos.all() });
    },
  });
}

export function useEliminarContactoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      eliminarContacto(id).then((r) => {
        if (!r.exito) throw new Error(r.error);
      }),
    onError: () => {
      toast.error("Error al eliminar el contacto");
    },
    onSuccess: (_, id) => {
      toast.success("Contacto eliminado");
      queryClient.removeQueries({ queryKey: queryKeys.contactos.detail(id) });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contactos.all() });
    },
  });
}

export type { ContactoDetalle };
