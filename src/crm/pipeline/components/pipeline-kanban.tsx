"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Building2, TrendingUp, MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cambiarEtapa } from "@/crm/oportunidades/actions";
import type { Oportunidad, Etapa } from "@/crm/oportunidades/types";
import { ETAPAS_PIPELINE } from "@/crm/oportunidades/types";
import { cn } from "@/lib/utils";

const ETAPAS_ACTIVAS = ETAPAS_PIPELINE.filter(e => e.valor !== "GANADO" && e.valor !== "PERDIDO");

const formatearMoneda = (valor: number, moneda: string) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: moneda, maximumFractionDigits: 0 }).format(valor);

function TarjetaOportunidad({ oportunidad }: { oportunidad: Oportunidad }) {
  const router = useRouter();
  const etapaActual = ETAPAS_PIPELINE.findIndex(e => e.valor === oportunidad.etapa);

  const moverA = async (etapa: Etapa) => {
    const resultado = await cambiarEtapa(oportunidad.id, { etapa });
    if (resultado.exito) toast.success(`Movido a ${ETAPAS_PIPELINE.find(e => e.valor === etapa)?.etiqueta}`);
    else toast.error(resultado.error);
  };

  const etapasSiguientes = ETAPAS_ACTIVAS.filter((_, i) => i > etapaActual && i < ETAPAS_ACTIVAS.length);

  return (
    <Card className="mb-2 cursor-pointer hover:shadow-md transition-shadow group">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-1">
          <Link
            href={`/crm/oportunidades/${oportunidad.id}`}
            className="text-sm font-medium leading-tight hover:underline line-clamp-2"
          >
            {oportunidad.titulo}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex size-6 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 flex-shrink-0 hover:bg-muted hover:text-foreground transition-all outline-none">
              <MoreHorizontal className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => router.push(`/crm/oportunidades/${oportunidad.id}`)}>
                Ver detalle
              </DropdownMenuItem>
              {etapasSiguientes.map(etapa => (
                <DropdownMenuItem key={etapa.valor} onClick={() => moverA(etapa.valor)}>
                  → {etapa.etiqueta}
                </DropdownMenuItem>
              ))}
              {etapaActual < ETAPAS_ACTIVAS.length - 1 && (
                <>
                  <DropdownMenuItem onClick={() => moverA("GANADO")} className="text-green-600">
                    ✓ Marcar ganado
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => moverA("PERDIDO")} className="text-destructive">
                    ✗ Marcar perdido
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="text-base font-semibold text-primary tabular-nums">
          {formatearMoneda(oportunidad.valor, oportunidad.moneda)}
        </div>

        <div className="space-y-1">
          {oportunidad.empresa && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span className="truncate">{oportunidad.empresa.nombre}</span>
            </div>
          )}
          {oportunidad.fechaCierre && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {format(new Date(oportunidad.fechaCierre), "dd MMM", { locale: es })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{oportunidad.probabilidad}% prob.</span>
          <div className="w-16 bg-muted rounded-full h-1.5">
            <div
              className="bg-primary rounded-full h-1.5 transition-all"
              style={{ width: `${oportunidad.probabilidad}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface PipelineKanbanProps {
  oportunidades: Map<Etapa, Oportunidad[]>;
}

export function PipelineKanban({ oportunidades }: PipelineKanbanProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {ETAPAS_ACTIVAS.map((etapaConfig) => {
        const items = oportunidades.get(etapaConfig.valor) ?? [];
        const totalValor = items.reduce((sum, o) => sum + o.valor, 0);

        return (
          <div key={etapaConfig.valor} className="flex-shrink-0 w-72">
            <Card className="h-full">
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", etapaConfig.color)}>
                      {etapaConfig.etiqueta}
                    </span>
                    <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                  </div>
                  <Link href={`/crm/oportunidades/nueva?etapa=${etapaConfig.valor}`}>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
                {items.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />
                    {formatearMoneda(totalValor, "PEN")}
                  </div>
                )}
              </CardHeader>
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="px-3 pb-3">
                  {items.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      Sin oportunidades
                    </div>
                  ) : (
                    items.map((oportunidad) => (
                      <TarjetaOportunidad key={oportunidad.id} oportunidad={oportunidad} />
                    ))
                  )}
                </div>
              </ScrollArea>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
