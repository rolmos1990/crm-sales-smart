"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { crearTag, actualizarTag, eliminarTag } from "../actions";
import type { Tag } from "../types";
import { COLORES_TAG } from "../types";

interface ListaTagsProps {
  tags: Tag[];
}

function ColorSelector({ valor, onChange }: { valor: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLORES_TAG.map((c) => (
        <button
          key={c.valor}
          type="button"
          title={c.etiqueta}
          onClick={() => onChange(c.valor)}
          className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
          style={{
            backgroundColor: c.valor,
            borderColor: valor === c.valor ? "white" : "transparent",
            boxShadow: valor === c.valor ? `0 0 0 2px ${c.valor}` : "none",
          }}
        />
      ))}
    </div>
  );
}

function FilaTag({
  tag,
  onActualizado,
  onEliminado,
}: {
  tag: Tag;
  onActualizado: (tag: Tag) => void;
  onEliminado: (id: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(tag.nombre);
  const [color, setColor] = useState(tag.color ?? "");
  const [cargando, setCargando] = useState(false);

  const guardar = async () => {
    if (!nombre.trim()) return;
    setCargando(true);
    const r = await actualizarTag(tag.id, { nombre: nombre.trim(), color });
    setCargando(false);
    if (r.exito && r.datos) {
      toast.success("Etiqueta actualizada");
      setEditando(false);
      onActualizado(r.datos);
    } else {
      toast.error(r.error);
    }
  };

  const eliminar = async () => {
    if (!confirm(`¿Eliminar la etiqueta "${tag.nombre}"?`)) return;
    const r = await eliminarTag(tag.id);
    if (r.exito) {
      toast.success("Etiqueta eliminada");
      onEliminado(tag.id);
    } else {
      toast.error(r.error);
    }
  };

  if (editando) {
    return (
      <div className="flex flex-col gap-2 p-3 rounded-xl border border-lime-400/30 bg-lime-400/5">
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre de la etiqueta"
          className="h-8 text-sm"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && guardar()}
        />
        <ColorSelector valor={color} onChange={setColor} />
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setNombre(tag.nombre);
              setColor(tag.color ?? "");
              setEditando(false);
            }}
          >
            <X className="h-3.5 w-3.5 mr-1" /> Cancelar
          </Button>
          <Button size="sm" onClick={guardar} disabled={cargando}>
            <Check className="h-3.5 w-3.5 mr-1" /> Guardar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-white/8 bg-white/3 hover:bg-white/6 transition-colors group">
      <div className="flex items-center gap-2.5">
        <span
          className="h-3 w-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: tag.color ?? "#a8a29e" }}
        />
        <span className="text-sm font-medium text-stone-800 dark:text-stone-100">{tag.nombre}</span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon-sm" variant="ghost" onClick={() => setEditando(true)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon-sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={eliminar}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function FormNuevoTag({ onCreado }: { onCreado: (tag: Tag) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState<string>(COLORES_TAG[0].valor);
  const [cargando, setCargando] = useState(false);

  const guardar = async () => {
    if (!nombre.trim()) return;
    setCargando(true);
    const r = await crearTag({ nombre: nombre.trim(), color });
    setCargando(false);
    if (r.exito && r.datos) {
      toast.success("Etiqueta creada");
      setNombre("");
      setColor(COLORES_TAG[0].valor);
      setAbierto(false);
      onCreado(r.datos);
    } else {
      toast.error(r.error);
    }
  };

  if (!abierto) {
    return (
      <Button size="sm" onClick={() => setAbierto(true)} className="w-full">
        <Plus className="h-4 w-4 mr-2" /> Nueva etiqueta
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl border border-lime-400/30 bg-lime-400/5">
      <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Nueva etiqueta</p>
      <Input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Ej: Urgente, VIP, Seguimiento..."
        className="h-8 text-sm"
        autoFocus
        onKeyDown={(e) => e.key === "Enter" && guardar()}
      />
      <ColorSelector valor={color} onChange={setColor} />
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={() => setAbierto(false)}>
          <X className="h-3.5 w-3.5 mr-1" /> Cancelar
        </Button>
        <Button size="sm" onClick={guardar} disabled={cargando || !nombre.trim()}>
          <Check className="h-3.5 w-3.5 mr-1" /> Crear
        </Button>
      </div>
    </div>
  );
}

export function ListaTags({ tags: tagsIniciales }: ListaTagsProps) {
  // Estado propio en vez de depender de `tagsIniciales` directamente: los
  // Server Actions ya llaman a revalidatePath, pero eso solo invalida el
  // caché de Next para la próxima navegación — no vuelve a renderizar este
  // Client Component ya montado. Sin este estado, crear/editar/eliminar
  // "se guarda" (el toast lo confirma) pero la lista se queda con los datos
  // viejos hasta que el usuario recarga la página a mano.
  const [tags, setTags] = useState(tagsIniciales);

  const handleCreado = (tag: Tag) => {
    setTags((prev) => [...prev, tag].sort((a, b) => a.nombre.localeCompare(b.nombre)));
  };

  const handleActualizado = (tag: Tag) => {
    setTags((prev) => prev.map((t) => (t.id === tag.id ? tag : t)));
  };

  const handleEliminado = (id: string) => {
    setTags((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {tags.length} etiqueta{tags.length !== 1 ? "s" : ""}
        </CardTitle>
        <CardDescription>
          Haz clic en una etiqueta para editarla o eliminarla.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tags.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No hay etiquetas creadas todavía.
            </p>
          )}
          {tags.map((tag) => (
            <FilaTag key={tag.id} tag={tag} onActualizado={handleActualizado} onEliminado={handleEliminado} />
          ))}
          <div className="pt-2">
            <FormNuevoTag onCreado={handleCreado} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
