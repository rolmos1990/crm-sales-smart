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
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="rounded-2xl bg-stone-100 dark:bg-white/5 dark:backdrop-blur-sm border border-stone-200 dark:border-white/10 p-5 shadow-sm dark:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.4)]">
        <Icono className="h-8 w-8 text-stone-400 dark:text-stone-500" />
      </div>
      <div className="space-y-1.5 max-w-xs">
        <p className="font-semibold text-stone-900 dark:text-stone-50">{titulo}</p>
        {descripcion && (
          <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
            {descripcion}
          </p>
        )}
      </div>
      {accion}
    </div>
  );
}
