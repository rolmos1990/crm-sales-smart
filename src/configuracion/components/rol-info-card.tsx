"use client";

import { Shield, Eye } from "lucide-react";
import type { Rol } from "@/generated/prisma/enums";
import { ROL_LABELS, ROL_DESCRIPCION, ROL_PERMISOS } from "@/shared/auth/permisos";
import type { NivelAcceso } from "@/shared/auth/permisos";

const MODULO_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  pipeline: "Pipeline",
  inbox: "Bandeja",
  contactos: "Contactos",
  empresas: "Empresas",
  oportunidades: "Oportunidades",
  actividades: "Actividades",
  cotizaciones: "Cotizaciones",
  pedidos: "Pedidos",
  productos: "Productos",
  configuracion: "Configuración",
  datos: "Datos",
};

const MODULOS_VISIBLES = Object.keys(MODULO_LABELS);

interface ModuloItemProps {
  label: string;
  nivel: NivelAcceso;
}

function ModuloItem({ label, nivel }: ModuloItemProps) {
  if (nivel === "none") return null;

  const esEscritura = nivel === "rw";

  return (
    <div className="flex items-center gap-1.5">
      {esEscritura ? (
        <Shield className="h-3 w-3 text-lime-400 shrink-0" />
      ) : (
        <Eye className="h-3 w-3 text-blue-400 shrink-0" />
      )}
      <span className={`text-xs ${esEscritura ? "text-stone-200" : "text-stone-400"}`}>
        {label}
      </span>
    </div>
  );
}

interface RolInfoCardProps {
  rol: Rol;
}

export function RolInfoCard({ rol }: RolInfoCardProps) {
  const permisos = ROL_PERMISOS[rol];
  const descripcion = ROL_DESCRIPCION[rol];

  const modulosRW = MODULOS_VISIBLES.filter((m) => permisos[m as keyof typeof permisos] === "rw");
  const modulosR = MODULOS_VISIBLES.filter((m) => permisos[m as keyof typeof permisos] === "r");
  const tieneAcceso = modulosRW.length > 0 || modulosR.length > 0;

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs uppercase tracking-wide text-stone-500 font-medium">
          {ROL_LABELS[rol]}
        </span>
        {descripcion && (
          <span className="text-xs text-stone-300">{descripcion}</span>
        )}
      </div>

      {tieneAcceso ? (
        <div className="flex flex-col gap-1">
          {modulosRW.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-lime-500/70 font-medium">
                Lectura y escritura
              </span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {modulosRW.map((m) => (
                  <ModuloItem key={m} label={MODULO_LABELS[m]} nivel="rw" />
                ))}
              </div>
            </div>
          )}

          {modulosR.length > 0 && (
            <div className="flex flex-col gap-1 mt-1">
              <span className="text-[10px] uppercase tracking-wide text-blue-500/70 font-medium">
                Solo lectura
              </span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {modulosR.map((m) => (
                  <ModuloItem key={m} label={MODULO_LABELS[m]} nivel="r" />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <span className="text-xs text-stone-500 italic">Sin acceso a módulos</span>
      )}
    </div>
  );
}
