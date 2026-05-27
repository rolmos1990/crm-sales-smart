import { Users } from "lucide-react";

export function TabUsuarios() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="p-4 rounded-2xl bg-stone-100 dark:bg-white/5">
        <Users className="h-8 w-8 text-stone-400 dark:text-stone-500" />
      </div>
      <div>
        <p className="font-semibold text-stone-700 dark:text-stone-300">Usuarios y Agentes</p>
        <p className="text-sm text-stone-400 dark:text-stone-500 mt-1">
          Gestión de usuarios del equipo. Estará disponible próximamente.
        </p>
      </div>
    </div>
  );
}
