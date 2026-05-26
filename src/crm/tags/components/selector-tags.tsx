"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X, Tag as TagIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Tag } from "../types";

interface SelectorTagsProps {
  tags: Tag[];
  seleccionados: string[];
  onChange: (tagIds: string[]) => void;
  placeholder?: string;
}

export function SelectorTags({ tags, seleccionados, onChange, placeholder = "Agregar etiquetas..." }: SelectorTagsProps) {
  const [abierto, setAbierto] = useState(false);

  const toggleTag = (tagId: string) => {
    if (seleccionados.includes(tagId)) {
      onChange(seleccionados.filter((id) => id !== tagId));
    } else {
      onChange([...seleccionados, tagId]);
    }
  };

  const removerTag = (e: React.MouseEvent, tagId: string) => {
    e.stopPropagation();
    onChange(seleccionados.filter((id) => id !== tagId));
  };

  const tagsSeleccionados = tags.filter((t) => seleccionados.includes(t.id));

  return (
    <div className="space-y-2">
      {tagsSeleccionados.length > 0 && (
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
              <button
                type="button"
                onClick={(e) => removerTag(e, tag.id)}
                className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-full justify-between font-normal",
            tagsSeleccionados.length > 0 && "mt-1"
          )}
        >
          <span className={cn("flex items-center gap-2", tagsSeleccionados.length === 0 && "text-muted-foreground")}>
            <TagIcon className="h-3.5 w-3.5" />
            {tagsSeleccionados.length > 0
              ? `${tagsSeleccionados.length} etiqueta${tagsSeleccionados.length > 1 ? "s" : ""} seleccionada${tagsSeleccionados.length > 1 ? "s" : ""}`
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar etiqueta..." />
            <CommandList>
              <CommandEmpty>No hay etiquetas disponibles.</CommandEmpty>
              <CommandGroup>
                {tags.map((tag) => {
                  const activa = seleccionados.includes(tag.id);
                  return (
                    <CommandItem key={tag.id} value={tag.nombre} onSelect={() => toggleTag(tag.id)}>
                      <Check className={cn("mr-2 h-4 w-4", activa ? "opacity-100" : "opacity-0")} />
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0 mr-2"
                        style={{ backgroundColor: tag.color ?? "#a8a29e" }}
                      />
                      {tag.nombre}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
