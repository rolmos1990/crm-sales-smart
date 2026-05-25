import { ReactNode } from "react";

interface PageHeaderProps {
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}

export function PageHeader({ titulo, descripcion, accion }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 pb-6 border-b">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {descripcion && (
          <p className="text-sm text-muted-foreground">{descripcion}</p>
        )}
      </div>
      {accion && <div className="flex-shrink-0">{accion}</div>}
    </div>
  );
}
