"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useTransition } from "react";
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
  LogOut,
  ChevronUp,
  GitBranch,
  Database,
  Truck,
} from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cerrarSesion } from "@/shared/auth/auth-service";
import { puedeVerModulo } from "@/shared/auth/permisos";
import { SesionProvider } from "@/shared/auth/sesion-context";
import type { Rol } from "@/generated/prisma/enums";

const NAVEGACION = [
  {
    grupo: "CRM",
    items: [
      { href: "/crm", etiqueta: "Dashboard", Icono: LayoutDashboard, exact: true, modulo: "dashboard" },
      { href: "/crm/pipeline", etiqueta: "Pipeline", Icono: KanbanSquare, modulo: "pipeline" },
      { href: "/crm/inbox", etiqueta: "Inbox", Icono: MessageSquare, modulo: "inbox" },
      { href: "/crm/contactos", etiqueta: "Contactos", Icono: Users, modulo: "contactos" },
      { href: "/crm/empresas", etiqueta: "Empresas", Icono: Building2, modulo: "empresas" },
      { href: "/crm/oportunidades", etiqueta: "Oportunidades", Icono: TrendingUp, modulo: "oportunidades" },
      { href: "/crm/actividades", etiqueta: "Actividades", Icono: CalendarCheck, modulo: "actividades" },
      { href: "/crm/etiquetas", etiqueta: "Etiquetas", Icono: Tag, modulo: "etiquetas" },
    ],
  },
  {
    grupo: "Ventas",
    items: [
      { href: "/sales/cotizaciones", etiqueta: "Cotizaciones", Icono: FileText, modulo: "cotizaciones" },
      { href: "/sales/pedidos", etiqueta: "Pedidos", Icono: ShoppingCart, modulo: "pedidos" },
      { href: "/sales/flujo-venta", etiqueta: "Flujo de venta", Icono: GitBranch, modulo: "flujo-venta" },
      { href: "/sales/transportistas", etiqueta: "Transportistas", Icono: Truck, modulo: "transportistas" },
    ],
  },
  {
    grupo: "Catálogo",
    items: [{ href: "/productos", etiqueta: "Productos", Icono: Package, modulo: "productos" }],
  },
  {
    grupo: "Sistema",
    items: [
      { href: "/integraciones", etiqueta: "Integraciones", Icono: Puzzle, modulo: "integraciones" },
      { href: "/configuracion", etiqueta: "Configuración", Icono: Settings, modulo: "configuracion" },
      { href: "/datos", etiqueta: "Datos", Icono: Database, modulo: "datos" },
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
        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-all duration-150",
        activo
          ? "bg-lime-500/[0.12] dark:bg-lime-400/[0.1] text-lime-700 dark:text-lime-400 shadow-[inset_0_0_0_1px_rgba(132,204,22,0.2)]"
          : "text-stone-600 dark:text-white/40 hover:text-stone-900 dark:hover:text-white/80 hover:bg-stone-100 dark:hover:bg-white/[0.04]"
      )}
    >
      <Icono
        className={cn(
          "h-3.5 w-3.5 flex-shrink-0 transition-colors",
          activo ? "text-lime-600 dark:text-lime-400" : "text-stone-400 dark:text-white/30"
        )}
      />
      {etiqueta}
    </Link>
  );
}

type UsuarioMenu = { nombre: string; email: string } | null;

function UserMenuDropdown({ usuario }: { usuario: UsuarioMenu }) {
  const [isPending, startTransition] = useTransition();

  const inicialAvatar = usuario?.nombre?.[0]?.toUpperCase() ?? "?";
  const nombre = usuario?.nombre ?? "Usuario";
  const email = usuario?.email ?? "";

  const handleLogout = () => {
    startTransition(async () => {
      await cerrarSesion();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex-1 min-w-0 flex items-center gap-2 rounded-lg px-2 py-2 transition-colors text-left",
          "hover:bg-stone-50 dark:hover:bg-white/[0.04] cursor-pointer",
          isPending && "opacity-60 pointer-events-none"
        )}
      >
        <div className="h-6 w-6 rounded-md bg-lime-500/15 dark:bg-lime-400/10 ring-1 ring-lime-500/25 dark:ring-lime-400/20 flex items-center justify-center text-[10px] font-bold text-lime-700 dark:text-lime-400 flex-shrink-0">
          {inicialAvatar}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium truncate text-stone-900 dark:text-white">{nombre}</p>
          <p className="text-[10px] text-stone-400 dark:text-white/30 truncate">{email}</p>
        </div>
        <ChevronUp className="h-3 w-3 text-stone-400 dark:text-white/25 flex-shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={4}
        className="w-52 bg-white dark:bg-[oklch(0.110_0.003_264)] border border-stone-200 dark:border-white/[0.08] shadow-xl rounded-xl p-1"
      >
        <div className="px-2 py-1.5 mb-1">
          <p className="text-[12px] font-medium text-stone-900 dark:text-stone-50 truncate">{nombre}</p>
          <p className="text-[11px] text-stone-400 dark:text-stone-500 truncate">{email}</p>
        </div>
        <div className="h-px bg-stone-100 dark:bg-white/[0.06] mx-1 mb-1" />
        <DropdownMenuItem
          onClick={handleLogout}
          className="gap-2 text-[12px] text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-500/10 rounded-lg cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppLayout({
  children,
  usuario,
  rol,
}: {
  children: ReactNode;
  usuario?: UsuarioMenu;
  rol?: Rol;
}) {
  const navFiltrado = NAVEGACION.map((grupo) => ({
    ...grupo,
    items: grupo.items.filter((item) =>
      rol ? puedeVerModulo(rol, item.modulo) : true,
    ),
  })).filter((grupo) => grupo.items.length > 0);

  return (
    <div className="app-gradient-bg flex h-screen overflow-hidden bg-stone-50 dark:bg-[oklch(0.063_0.002_264)]">
      {/* Sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r border-stone-200 dark:border-white/[0.06] bg-white dark:bg-[oklch(0.085_0.002_264)] flex-shrink-0">
        {/* Logo */}
        <div className="flex h-[52px] items-center px-4 border-b border-stone-200 dark:border-white/[0.06]">
          <Link href="/crm" className="flex items-center gap-2.5 group">
            <div className="rounded-lg bg-lime-500 p-1.5 shadow-[0_0_14px_rgba(132,204,22,0.4)] group-hover:shadow-[0_0_20px_rgba(132,204,22,0.55)] transition-all duration-200">
              <Leaf className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="flex flex-col leading-none gap-0.5">
              <span className="text-[13px] font-semibold tracking-tight text-stone-900 dark:text-white">
                Vento
              </span>
              <span className="text-[10px] text-stone-400 dark:text-white/30 tracking-wide font-medium">
                CRM & Sales
              </span>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
          {navFiltrado.map((grupo) => (
            <div key={grupo.grupo}>
              <p className="px-2.5 mb-1 text-[10px] font-semibold text-stone-400 dark:text-white/25 uppercase tracking-[0.08em]">
                {grupo.grupo}
              </p>
              <div className="space-y-px">
                {grupo.items.map((item) => (
                  <NavItem key={item.href} {...item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-stone-200 dark:border-white/[0.06] p-2.5">
          <div className="flex items-center gap-1">
            <UserMenuDropdown usuario={usuario ?? null} />
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 border-b border-stone-200 dark:border-white/[0.06] flex items-center px-6 gap-4 flex-shrink-0 bg-white/80 dark:bg-[oklch(0.085_0.002_264)]/80 dark:backdrop-blur-xl">
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="md:hidden">
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-stone-50/90 dark:bg-transparent">
          <SesionProvider rol={rol ?? "INVITADO"}>
            {children}
          </SesionProvider>
        </main>
      </div>

      <Toaster richColors position="top-right" closeButton />
    </div>
  );
}
