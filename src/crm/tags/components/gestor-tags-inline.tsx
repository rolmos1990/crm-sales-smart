"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SelectorTags } from "./selector-tags";
import { asignarTagsContacto, asignarTagsOportunidad } from "../actions";
import { queryKeys } from "@/shared/query-keys";
import type { Tag } from "../types";

interface GestorTagsInlineProps {
  entidadId: string;
  tipo: "contacto" | "oportunidad";
  tagIdsActuales: string[];
  todosLosTags: Tag[];
}

export function GestorTagsInline({ entidadId, tipo, tagIdsActuales, todosLosTags }: GestorTagsInlineProps) {
  const queryClient = useQueryClient();
  const queryKey = tipo === "contacto"
    ? queryKeys.contactos.detail(entidadId)
    : queryKeys.oportunidades.detail(entidadId);

  const mutation = useMutation({
    mutationFn: (nuevosTagIds: string[]) => {
      const accion = tipo === "contacto" ? asignarTagsContacto : asignarTagsOportunidad;
      return accion(entidadId, nuevosTagIds).then((r) => {
        if (!r.exito) throw new Error(r.error ?? "Error al guardar las etiquetas");
        return nuevosTagIds;
      });
    },
    onMutate: async (nuevosTagIds) => {
      await queryClient.cancelQueries({ queryKey });
      const anterior = queryClient.getQueryData(queryKey);
      return { anterior, tagIdsAnteriores: tagIdsActuales, nuevoTagIds: nuevosTagIds };
    },
    onError: (_err, _nuevos, context) => {
      if (context?.anterior) {
        queryClient.setQueryData(queryKey, context.anterior);
      }
      toast.error("Error al guardar las etiquetas");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const handleChange = (nuevosTagIds: string[]) => {
    mutation.mutate(nuevosTagIds);
  };

  if (todosLosTags.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No hay etiquetas disponibles.{" "}
        <a href="/crm/etiquetas" className="underline hover:text-foreground transition-colors">
          Créalas aquí
        </a>
        .
      </p>
    );
  }

  const tagIdsActualesLocales = mutation.isPending && mutation.variables !== undefined
    ? mutation.variables
    : tagIdsActuales;

  return (
    <SelectorTags
      tags={todosLosTags}
      seleccionados={tagIdsActualesLocales}
      onChange={handleChange}
    />
  );
}
