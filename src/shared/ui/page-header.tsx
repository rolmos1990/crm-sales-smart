import { ReactNode } from "react";

interface PageHeaderProps {
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}

export function PageHeader({ titulo, descripcion, accion }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 pb-6">
      <div className="space-y-0.5">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          {titulo}
        </h1>
        {descripcion && (
          <p className="text-sm text-stone-400 dark:text-stone-500">{descripcion}</p>
        )}
      </div>
      {accion && <div className="flex-shrink-0 mt-0.5">{accion}</div>}
    </div>
  );
}
