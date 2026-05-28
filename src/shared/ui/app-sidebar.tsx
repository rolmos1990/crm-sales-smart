"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  Building2,
  TrendingUp,
  CalendarCheck,
  KanbanSquare,
  MessageSquare,
  FileText,
  Package,
  ShoppingCart,
  Leaf,
  Puzzle,
  Tag,
  Settings,
} from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

const NAVEGACION = [
  {
    grupo: "CRM",
    items: [
      { href: "/crm", etiqueta: "Dashboard", Icono: LayoutDashboard, exact: true },
      { href: "/crm/pipeline", etiqueta: "Pipeline", Icono: KanbanSquare },
      { href: "/crm/inbox", etiqueta: "Inbox", Icono: MessageSquare },
      { href: "/crm/contactos", etiqueta: "Contactos", Icono: Users },
      { href: "/crm/empresas", etiqueta: "Empresas", Icono: Building2 },
      { href: "/crm/oportunidades", etiqueta: "Oportunidades", Icono: TrendingUp },
      { href: "/crm/actividades", etiqueta: "Actividades", Icono: CalendarCheck },
      { href: "/crm/etiquetas", etiqueta: "Etiquetas", Icono: Tag },
    ],
  },
  {
    grupo: "Ventas",
    items: [
      { href: "/sales/cotizaciones", etiqueta: "Cotizaciones", Icono: FileText },
      { href: "/sales/pedidos", etiqueta: "Pedidos", Icono: ShoppingCart },
    ],
  },
  {
    grupo: "Catálogo",
    items: [{ href: "/productos", etiqueta: "Productos", Icono: Package }],
  },
  {
    grupo: "Sistema",
    items: [
      { href: "/integraciones", etiqueta: "Integraciones", Icono: Puzzle },
      { href: "/configuracion", etiqueta: "Configuración", Icono: Settings },
    ],
  },
];

function NavItem({
  href,
  etiqueta,
  Icono,
  exact,
}: {
  href: string;
  etiqueta: string;
  Icono: React.ElementType;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const activo = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150",
        activo
          ? "bg-lime-500/10 dark:bg-lime-400/10 text-lime-700 dark:text-lime-400 border border-lime-500/25 dark:border-lime-400/25 shadow-[0_0_12px_-4px_rgba(163,230,53,0.2)]"
          : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-white/5 border border-transparent"
      )}
    >
      <Icono
        className={cn(
          "h-4 w-4 flex-shrink-0 transition-colors",
          activo ? "text-lime-600 dark:text-lime-400" : "text-stone-400 dark:text-stone-500"
        )}
      />
      {etiqueta}
    </Link>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-gradient-bg flex h-screen overflow-hidden bg-stone-50 dark:bg-stone-950">
      {/* Sidebar */}
      <aside className="hidden md:flex w-58 flex-col border-r border-stone-200 dark:border-white/8 bg-white dark:bg-stone-950/80 dark:backdrop-blur-xl flex-shrink-0">
        {/* Logo */}
        <div className="flex h-16 items-center px-4 border-b border-stone-200 dark:border-white/8">
          <Link href="/crm" className="flex items-center gap-2.5 group">
            <div className="rounded-xl bg-lime-600 dark:bg-lime-500 p-1.5 shadow-[0_2px_12px_rgba(101,163,13,0.35)] group-hover:shadow-[0_2px_18px_rgba(101,163,13,0.5)] group-hover:bg-lime-500 dark:group-hover:bg-lime-400 transition-all duration-200">
              <Leaf className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-bold text-stone-900 dark:text-stone-50 tracking-tight">
                CRM Smart
              </span>
              <span className="text-[0.6rem] text-stone-400 dark:text-stone-500 tracking-wide mt-0.5">
                Sales Management
              </span>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {NAVEGACION.map((grupo) => (
            <div key={grupo.grupo}>
              <p className="px-3 mb-1.5 text-[0.6rem] font-bold text-stone-400 dark:text-stone-600 uppercase tracking-widest">
                {grupo.grupo}
              </p>
              <div className="space-y-0.5">
                {grupo.items.map((item) => (
                  <NavItem key={item.href} {...item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-stone-200 dark:border-white/8 p-3">
          <div className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-stone-50 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <div className="h-7 w-7 rounded-full bg-lime-600/10 dark:bg-lime-400/15 ring-1 ring-lime-600/20 dark:ring-lime-400/30 flex items-center justify-center text-xs font-bold text-lime-700 dark:text-lime-400 flex-shrink-0">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate text-stone-900 dark:text-stone-50">Admin</p>
              <p className="text-xs text-stone-400 dark:text-stone-500 truncate">admin@empresa.com</p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-stone-200 dark:border-white/8 flex items-center px-6 gap-4 flex-shrink-0 bg-white/80 dark:bg-stone-950/50 dark:backdrop-blur-xl">
          <div className="flex-1" />
          <div className="flex items-center gap-3 text-sm text-stone-500 dark:text-stone-400">
            <span className="hidden sm:block text-xs">CRM Sales Smart</span>
            <div className="md:hidden">
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-stone-50/90 dark:bg-transparent">
          {children}
        </main>
      </div>

      <Toaster richColors position="top-right" closeButton />
    </div>
  );
}
