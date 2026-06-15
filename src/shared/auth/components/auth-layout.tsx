import type { ReactNode } from "react";
import { Leaf, MessageSquare, KanbanSquare, Sparkles } from "lucide-react";

const BENEFICIOS = [
  {
    Icono: MessageSquare,
    titulo: "Inbox inteligente",
    descripcion: "Centraliza todas tus conversaciones y responde más rápido.",
  },
  {
    Icono: KanbanSquare,
    titulo: "Pipeline visual",
    descripcion: "Visualiza tu embudo de ventas y no pierdas ninguna oportunidad.",
  },
  {
    Icono: Sparkles,
    titulo: "Automatizaciones con IA",
    descripcion: "Automatiza tareas repetitivas y enfócate en lo que importa.",
  },
];

export function Marca({ claro = false }: { claro?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="rounded-xl bg-lime-500 p-1.5 shadow-[0_2px_12px_rgba(101,163,13,0.35)]">
        <Leaf className="h-4 w-4 text-white" />
      </div>
      <span
        className={`text-base font-bold tracking-tight ${claro ? "text-stone-50" : "text-stone-900 dark:text-stone-50"}`}
      >
        Vento
      </span>
    </div>
  );
}

/** Shell de dos columnas reutilizado por /login y /registro: hero con bg-image.png + card flotante. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-stone-950 bg-cover bg-center p-4 lg:p-12"
      style={{ backgroundImage: "url('/bg-image.png')" }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-stone-950/50 via-stone-950/70 to-stone-950/90" />

      <div className="relative flex w-full max-w-6xl items-center justify-center gap-16 lg:justify-between">
        {/* Columna izquierda — branding y propuesta de valor */}
        <div className="hidden w-full max-w-md flex-col gap-10 lg:flex">
          <Marca claro />

          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-stone-50">
              Impulsa tus ventas con{" "}
              <span className="text-lime-400">inteligencia artificial</span>
            </h1>
            <p className="text-base text-stone-400">
              Gestiona conversaciones, oportunidades y clientes en un solo lugar. Automatiza,
              analiza y escala tu negocio.
            </p>
          </div>

          <ul className="space-y-5">
            {BENEFICIOS.map(({ Icono, titulo, descripcion }) => (
              <li key={titulo} className="flex items-start gap-4">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-lime-400/20 bg-lime-400/10 text-lime-400">
                  <Icono className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-stone-50">{titulo}</p>
                  <p className="text-sm text-stone-400">{descripcion}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="text-xs text-stone-500">
            © {new Date().getFullYear()} Vento. Todos los derechos reservados.
          </p>
        </div>

        {/* Card */}
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] dark:bg-stone-950 sm:p-10">
          <div className="mb-8 flex flex-col items-center gap-6 text-center lg:hidden">
            <Marca />
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
