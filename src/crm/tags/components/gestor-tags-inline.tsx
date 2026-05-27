"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { SelectorTags } from "./selector-tags";
import { asignarTagsContacto, asignarTagsOportunidad } from "../actions";
import type { Tag } from "../types";

interface GestorTagsInlineProps {
  entidadId: string;
  tipo: "contacto" | "oportunidad";
  tagIdsActuales: string[];
  todosLosTags: Tag[];
}

export function GestorTagsInline({ entidadId, tipo, tagIdsActuales, todosLosTags }: GestorTagsInlineProps) {
  const [, startTransition] = useTransition();
  const [tagIds, setTagIds] = useOptimistic(tagIdsActuales);

  const handleChange = (nuevosTagIds: string[]) => {
    startTransition(async () => {
      setTagIds(nuevosTagIds);
      const accion = tipo === "contacto" ? asignarTagsContacto : asignarTagsOportunidad;
      const resultado = await accion(entidadId, nuevosTagIds);
      if (!resultado.exito) {
        toast.error(resultado.error ?? "Error al guardar las etiquetas");
      }
    });
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

  return (
    <SelectorTags
      tags={todosLosTags}
      seleccionados={tagIds}
      onChange={handleChange}
    />
  );
}
