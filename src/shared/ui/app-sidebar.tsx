"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useRef, useState, useTransition } from "react";
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

/**
 * Detecta si el contenedor scrollable tiene contenido oculto debajo, para
 * mostrar/ocultar el degradado indicador. Se recalcula al hacer scroll, al
 * cambiar el tamaño del contenedor/ventana y cuando cambian las dependencias
 * (por ejemplo, cuando el menú filtrado por rol cambia de tamaño).
 */
function useScrollFade<T extends HTMLElement>(deps: unknown[]) {
  const ref = useRef<T | null>(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const checkOverflow = () => {
      setHasMoreBelow(
        el.scrollHeight > el.clientHeight &&
          el.scrollTop + el.clientHeight < el.scrollHeight - 2
      );
    };

    checkOverflow();

    el.addEventListener("scroll", checkOverflow, { passive: true });
    window.addEventListener("resize", checkOverflow);

    const resizeObserver = new ResizeObserver(checkOverflow);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", checkOverflow);
      window.removeEventListener("resize", checkOverflow);
      resizeObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ref, hasMoreBelow };
}

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
          ? "bg-nav-active-bg text-nav-active-text shadow-[inset_0_0_0_1px_var(--nav-active-border)]"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      <Icono
        className={cn(
          "h-3.5 w-3.5 flex-shrink-0 transition-colors",
          activo ? "text-nav-active-icon" : "text-muted-foreground"
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
        data-testid="user-menu"
        className={cn(
          "flex-1 min-w-0 flex items-center gap-2 rounded-lg px-2 py-2 transition-colors text-left",
          "hover:bg-muted cursor-pointer",
          isPending && "opacity-60 pointer-events-none"
        )}
      >
        <div className="h-6 w-6 rounded-md bg-primary-muted ring-1 ring-primary-border flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
          {inicialAvatar}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium truncate text-foreground">{nombre}</p>
          <p className="text-[10px] text-muted-foreground truncate">{email}</p>
        </div>
        <ChevronUp className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={4}
        className="w-52 bg-dropdown border border-border shadow-xl rounded-xl p-1"
      >
        <div className="px-2 py-1.5 mb-1">
          <p className="text-[12px] font-medium text-foreground truncate">{nombre}</p>
          <p className="text-[11px] text-muted-foreground truncate">{email}</p>
        </div>
        <div className="h-px bg-border mx-1 mb-1" />
        <DropdownMenuItem
          onClick={handleLogout}
          className="gap-2 text-[12px] text-danger focus:text-danger focus:bg-danger-muted rounded-lg cursor-pointer"
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

  const navItemsCount = navFiltrado.reduce((total, grupo) => total + grupo.items.length, 0);
  const { ref: navRef, hasMoreBelow } = useScrollFade<HTMLElement>([navItemsCount]);

  return (
    <div className="app-gradient-bg flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r border-border bg-sidebar flex-shrink-0">
        {/* Logo */}
        <div className="flex h-[52px] items-center px-4 border-b border-border">
          <Link href="/crm" className="flex items-center gap-2.5 group">
            <div className="rounded-lg bg-primary p-1.5 shadow-[0_0_14px_color-mix(in_oklab,var(--primary)_40%,transparent)] group-hover:shadow-[0_0_20px_color-mix(in_oklab,var(--primary)_55%,transparent)] transition-all duration-200">
              <Leaf className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <div className="flex flex-col leading-none gap-0.5">
              <span className="text-[13px] font-semibold tracking-tight text-foreground">
                KariaApp
              </span>
              <span className="text-[10px] text-muted-foreground tracking-wide font-medium">
                CRM & Sales
              </span>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <div className="relative flex-1 min-h-0">
          <nav
            ref={navRef}
            className="sidebar-scroll absolute inset-0 py-3 px-2.5 space-y-4"
          >
            {navFiltrado.map((grupo) => (
              <div key={grupo.grupo}>
                <p className="px-2.5 mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
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

          {/* Indicador de contenido adicional debajo — degradado sutil, sin iconos */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 h-[50px] transition-opacity duration-150 ease-out motion-reduce:transition-none",
              "bg-gradient-to-t from-sidebar to-transparent",
              "shadow-[0_6px_10px_-6px_rgba(0,0,0,0.12)] dark:shadow-[0_6px_10px_-6px_rgba(0,0,0,0.45)]",
              hasMoreBelow ? "opacity-100" : "opacity-0"
            )}
          />
        </div>

        {/* Footer */}
        <div className="border-t border-border p-2.5">
          <div className="flex items-center gap-1">
            <UserMenuDropdown usuario={usuario ?? null} />
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 border-b border-border flex items-center px-6 gap-4 flex-shrink-0 bg-sidebar/80 dark:backdrop-blur-xl">
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="md:hidden">
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-background">
          <SesionProvider rol={rol ?? "INVITADO"}>
            {children}
          </SesionProvider>
        </main>
      </div>

      <Toaster richColors position="top-right" closeButton />
    </div>
  );
}
