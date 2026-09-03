"use client";

import { useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Tag, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { queryKeys } from "@/shared/query-keys";
import { construirNombreVisible } from "../zonas/normalizar";
import { agregarAliasUbicacion, eliminarAliasUbicacion, listarUbicacionesConAlias } from "../zonas/alias-actions";

interface DialogAliasUbicacionProps {
  zonaEntregaId: string;
  zonaNombre: string;
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
}

// 024-alias-ubicaciones-transportistas — administra los alias de todas las
// ZonaEntregaUbicacion de una zona (US2, FR-002/FR-003/FR-004). Se abre
// desde el nombre de la zona, no por fila de tarifa (research.md §8): una
// zona puede tener varias ubicaciones, y hoy la tabla de tarifas no expone
// el id de cada una individualmente.
export function DialogAliasUbicacion({ zonaEntregaId, zonaNombre, abierto, onOpenChange }: DialogAliasUbicacionProps) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [valoresNuevoAlias, setValoresNuevoAlias] = useState<Record<string, string>>({});

  const queryKey = queryKeys.transportistas.ubicacionesConAlias(zonaEntregaId);
  const { data: ubicaciones, isLoading } = useQuery({
    queryKey,
    queryFn: () => listarUbicacionesConAlias(zonaEntregaId),
    enabled: abierto,
  });

  function handleAgregar(zonaEntregaUbicacionId: string) {
    const valor = (valoresNuevoAlias[zonaEntregaUbicacionId] ?? "").trim();
    if (!valor) return;

    startTransition(async () => {
      const resultado = await agregarAliasUbicacion({ zonaEntregaUbicacionId, valor });
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Alias agregado");
      setValoresNuevoAlias((prev) => ({ ...prev, [zonaEntregaUbicacionId]: "" }));
      queryClient.invalidateQueries({ queryKey });
    });
  }

  function handleEliminar(id: string) {
    startTransition(async () => {
      const resultado = await eliminarAliasUbicacion(id);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey });
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Alias de destinos — {zonaNombre}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : !ubicaciones || ubicaciones.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Esta zona no tiene destinos configurados.</p>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {ubicaciones.map((u) => (
              <div key={u.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {u.nombreVisible || construirNombreVisible(u)}
                </p>

                {u.aliases.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {u.aliases.map((a) => (
                      <Badge key={a.id} variant="outline" className="gap-1 pr-1">
                        {a.valor}
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleEliminar(a.id)}
                          aria-label={`Eliminar alias ${a.valor}`}
                          className="rounded-full p-0.5 hover:bg-muted"
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <Input
                    value={valoresNuevoAlias[u.id] ?? ""}
                    onChange={(e) => setValoresNuevoAlias((prev) => ({ ...prev, [u.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAgregar(u.id);
                      }
                    }}
                    placeholder="Nuevo alias — ej: Chorrera"
                    className="h-8 text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    disabled={isPending || !(valoresNuevoAlias[u.id] ?? "").trim()}
                    onClick={() => handleAgregar(u.id)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
