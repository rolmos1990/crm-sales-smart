import { type LucideIcon, InboxIcon } from "lucide-react";
import { ReactNode } from "react";

interface EmptyStateProps {
  Icono?: LucideIcon;
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}

export function EmptyState({
  Icono = InboxIcon,
  titulo,
  descripcion,
  accion,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="rounded-full bg-muted p-4">
        <Icono className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1 max-w-sm">
        <p className="font-medium text-foreground">{titulo}</p>
        {descripcion && (
          <p className="text-sm text-muted-foreground">{descripcion}</p>
        )}
      </div>
      {accion}
    </div>
  );
}
