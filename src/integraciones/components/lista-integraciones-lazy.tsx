"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { IntegracionConEstado } from "../types";

const ListaIntegracionesInterna = dynamic(
  () => import("./lista-integraciones").then((m) => m.ListaIntegraciones),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    ),
  }
);

export function ListaIntegracionesLazy({
  integraciones,
}: {
  integraciones: IntegracionConEstado[];
}) {
  return <ListaIntegracionesInterna integraciones={integraciones} />;
}
