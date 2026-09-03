"use client";

import Link from "next/link";
import { ArrowLeft, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeccionCondicionesTransportista } from "./seccion-condiciones-transportista";
import { SeccionInformacionTransportista } from "./seccion-informacion-transportista";
import { SeccionZonasTarifas } from "./seccion-zonas-tarifas";
import { TIPO_TRANSPORTISTA_LABELS } from "../types";
import type { TransportistaConPais, CondicionesTransportista } from "../types";

interface PanelTransportistaProps {
  transportista: TransportistaConPais & { zonasActivas: number };
  servicios: { id: string; nombre: string }[];
  condiciones: CondicionesTransportista | null;
  zonas: { id: string; nombre: string }[];
  tarifas: Parameters<typeof SeccionZonasTarifas>[0]["tarifas"];
  promedio: { costoPromedio: number; margenPromedio: number; cantidad: number };
  puedeVerCostos: boolean;
  puedeModificar: boolean;
}

// 022-transportistas-zonas-tarifas — panel de configuración completo
// (FR-003): encabezado + pestañas Información/Zonas y tarifas/Condiciones.
export function PanelTransportista({
  transportista, servicios, condiciones, zonas, tarifas, promedio, puedeVerCostos, puedeModificar,
}: PanelTransportistaProps) {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/sales/transportistas" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="rounded-xl bg-primary-subtle p-2.5">
          <Truck className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{transportista.nombre}</h1>
            {transportista.pais ? (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                {transportista.pais.banderaEmoji && <span>{transportista.pais.banderaEmoji}</span>}
                {transportista.pais.nombre}
              </span>
            ) : (
              <Badge variant="outline" className="text-[10px] rounded-full border-warning/30 text-warning bg-warning/5">
                País pendiente
              </Badge>
            )}
            <Badge variant={transportista.activo ? "default" : "outline"}>{transportista.activo ? "Activo" : "Inactivo"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {TIPO_TRANSPORTISTA_LABELS[transportista.tipo] ?? transportista.tipo} · {transportista.zonasActivas} zona{transportista.zonasActivas !== 1 ? "s" : ""} configurada{transportista.zonasActivas !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <Tabs defaultValue="informacion">
        <TabsList>
          <TabsTrigger value="informacion">Información</TabsTrigger>
          <TabsTrigger value="zonas-tarifas">Zonas y tarifas</TabsTrigger>
          <TabsTrigger value="condiciones">Condiciones</TabsTrigger>
        </TabsList>

        <TabsContent value="informacion" className="mt-5">
          <SeccionInformacionTransportista transportista={transportista} puedeModificar={puedeModificar} />
        </TabsContent>

        <TabsContent value="zonas-tarifas" className="mt-5">
          <SeccionZonasTarifas
            transportistaId={transportista.id}
            pais={transportista.pais}
            paisId={transportista.paisId}
            zonasIniciales={zonas}
            servicios={servicios}
            tarifas={tarifas}
            promedio={promedio}
            puedeVerCostos={puedeVerCostos}
            puedeModificar={puedeModificar}
          />
        </TabsContent>

        <TabsContent value="condiciones" className="mt-5">
          <SeccionCondicionesTransportista
            transportistaId={transportista.id}
            transportistaNombre={transportista.nombre}
            condiciones={condiciones}
            puedeModificar={puedeModificar}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
