import { ShieldCheck } from "lucide-react";

export function TabSeguridad() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="p-4 rounded-2xl bg-stone-100 dark:bg-white/5">
        <ShieldCheck className="h-8 w-8 text-stone-400 dark:text-stone-500" />
      </div>
      <div>
        <p className="font-semibold text-stone-700 dark:text-stone-300">Seguridad</p>
        <p className="text-sm text-stone-400 dark:text-stone-500 mt-1">
          Configuración de seguridad y accesos. Estará disponible próximamente.
        </p>
      </div>
    </div>
  );
}
