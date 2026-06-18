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
  puedeMod?: boolean;
}

export function GestorTagsInline({ entidadId, tipo, tagIdsActuales, todosLosTags, puedeMod = true }: GestorTagsInlineProps) {
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

  if (!puedeMod) {
    const tagsSeleccionados = todosLosTags.filter((t) => tagIdsActuales.includes(t.id));
    if (tagsSeleccionados.length === 0) {
      return <p className="text-xs text-stone-400 dark:text-stone-600">Sin etiquetas</p>;
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {tagsSeleccionados.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border"
            style={tag.color
              ? { backgroundColor: `${tag.color}20`, borderColor: `${tag.color}50`, color: tag.color }
              : undefined}
          >
            <span
              className="h-1.5 w-1.5 rounded-full flex-shrink-0"
              style={tag.color ? { backgroundColor: tag.color } : { backgroundColor: "#a8a29e" }}
            />
            {tag.nombre}
          </span>
        ))}
      </div>
    );
  }

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
