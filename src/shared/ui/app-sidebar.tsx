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
  Menu,
  X,
} from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
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

// Breakpoint en el que el sidebar fijo de escritorio pasa a ser un drawer
// móvil — 1024px (Tailwind `lg`), no `md` (768px): tablets en portrait
// también deben recibir el comportamiento de drawer.
const MOBILE_DRAWER_BREAKPOINT = "(min-width: 1024px)";

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

type GrupoNav = (typeof NAVEGACION)[number];

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

/**
 * Cierra el drawer móvil apenas el viewport cruza a escritorio (>=1024px) —
 * sin esto, si alguien lo dejó abierto en móvil y gira la pantalla o
 * redimensiona la ventana, el overlay/drawer quedarían montados de más.
 * Solo corre en el cliente (matchMedia no existe en SSR) y no participa del
 * primer render, así que no genera mismatch de hidratación.
 */
function useCerrarAlLlegarAEscritorio(cerrar: () => void) {
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_DRAWER_BREAKPOINT);
    const handler = (e: MediaQueryList | MediaQueryListEvent) => {
      if (e.matches) cerrar();
    };
    handler(mq);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function NavItem({
  href,
  etiqueta,
  Icono,
  exact,
  onNavigate,
}: {
  href: string;
  etiqueta: string;
  Icono: React.ElementType;
  exact?: boolean;
  /** Se llama al hacer click — usado por el drawer móvil para cerrarse al navegar. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const activo = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      onClick={onNavigate}
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
      <span className="flex-1 min-w-0 truncate">{etiqueta}</span>
    </Link>
  );
}

/**
 * Lista de navegación agrupada — única fuente de verdad tanto para el
 * sidebar fijo de escritorio como para el drawer móvil (ver `AppLayout`).
 * No calcula scroll ni layout propio: quien la use decide el contenedor.
 */
function SidebarNavList({
  navFiltrado,
  navRef,
  onNavigate,
}: {
  navFiltrado: GrupoNav[];
  navRef?: React.Ref<HTMLElement>;
  onNavigate?: () => void;
}) {
  return (
    <nav ref={navRef} className="sidebar-scroll absolute inset-0 py-3 px-2.5 space-y-4">
      {navFiltrado.map((grupo) => (
        <div key={grupo.grupo}>
          <p className="px-2.5 mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
            {grupo.grupo}
          </p>
          <div className="space-y-px">
            {grupo.items.map((item) => (
              <NavItem key={item.href} {...item} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

/** Logo + nombre de la app. En el drawer móvil recibe `onClose` y suma el botón X. */
function SidebarLogo({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex h-[52px] items-center justify-between px-4 border-b border-border">
      <Link href="/crm" className="flex items-center gap-2.5 group" onClick={onClose}>
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

      {onClose && (
        <SheetClose
          aria-label="Cerrar menú principal"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors -mr-2"
        >
          <X className="h-4 w-4" />
        </SheetClose>
      )}
    </div>
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

/** Bloque de usuario fijo al pie del sidebar — igual en escritorio y en el drawer móvil. */
function SidebarUserFooter({ usuario }: { usuario?: UsuarioMenu }) {
  return (
    <div className="border-t border-border p-2.5 flex-shrink-0">
      <div className="flex items-center gap-1">
        <UserMenuDropdown usuario={usuario ?? null} />
        <ThemeToggle />
      </div>
    </div>
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
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const navFiltrado = NAVEGACION.map((grupo) => ({
    ...grupo,
    items: grupo.items.filter((item) =>
      rol ? puedeVerModulo(rol, item.modulo) : true,
    ),
  })).filter((grupo) => grupo.items.length > 0);

  const navItemsCount = navFiltrado.reduce((total, grupo) => total + grupo.items.length, 0);
  const { ref: navRef, hasMoreBelow } = useScrollFade<HTMLElement>([navItemsCount]);
  const { ref: navRefMovil, hasMoreBelow: hasMoreBelowMovil } = useScrollFade<HTMLElement>([
    navItemsCount,
    mobileOpen,
  ]);

  // Cerrar el drawer al cambiar de ruta (incluye seleccionar un ítem de nav).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // `<main>` es un contenedor de scroll propio (overflow-y-auto), no la
  // ventana — App Router solo resetea el scroll de `window` al navegar, así
  // que sin esto una sección larga (ej. Dashboard) deja `<main>` scrolleado
  // y la siguiente sección (ej. Pipeline) aparece "cortada" desde la mitad.
  // Depende solo de `pathname` (no de los searchParams): un cambio de
  // sección real lo dispara, pero un `router.refresh()` (auto-refresh del
  // Pipeline) no cambia el pathname y por lo tanto no entra acá — el scroll
  // de esa actualización en segundo plano se preserva tal cual ya funciona.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  // Evita que el navegador intente restaurar por su cuenta una posición de
  // scroll previa (p. ej. al usar atrás/adelante) que quede en conflicto con
  // el reinicio manual de arriba — práctica estándar al manejar el scroll a
  // mano en una SPA. Se fija una sola vez, no depende de `pathname`.
  useEffect(() => {
    if (typeof window === "undefined" || !("scrollRestoration" in window.history)) return;
    const anterior = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = anterior;
    };
  }, []);

  useCerrarAlLlegarAEscritorio(() => setMobileOpen(false));

  return (
    <div className="app-gradient-bg flex h-screen overflow-hidden bg-background">
      {/* Sidebar fijo — solo escritorio (>=1024px) */}
      <aside className="hidden lg:flex w-56 flex-col border-r border-border bg-sidebar flex-shrink-0">
        <SidebarLogo />

        <div className="relative flex-1 min-h-0">
          <SidebarNavList navFiltrado={navFiltrado} navRef={navRef} />
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

        <SidebarUserFooter usuario={usuario} />
      </aside>

      {/* Drawer móvil/tablet (<1024px) — reutiliza Sheet (base-ui Dialog):
          focus trap, aria-modal, Escape, click-fuera y bloqueo de scroll
          del body ya vienen resueltos por la primitiva, no se reimplementan
          acá. Solo se personaliza el ancho/animación para que se sienta
          como un drawer (slide completo), no como el sheet lateral genérico
          que usa el resto de la app. */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          id="sidebar-drawer-movil"
          side="left"
          showCloseButton={false}
          aria-label="Menú principal"
          // base-ui ya aplica el comportamiento modal real (focus trap,
          // scroll lock, `inert` en el fondo) pero no emite el atributo
          // aria-modal — se agrega a mano para cumplir el contrato de
          // accesibilidad explícito (lectores de pantalla que sí lo leen).
          aria-modal="true"
          className={cn(
            "p-0 flex flex-col gap-0 bg-sidebar border-border",
            "data-[side=left]:w-[min(82vw,360px)] data-[side=left]:max-w-none data-[side=left]:sm:max-w-none",
            "data-[side=left]:data-starting-style:translate-x-[-100%] data-[side=left]:data-ending-style:translate-x-[-100%]",
            "transition-[transform,opacity] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
            "motion-reduce:transition-none"
          )}
        >
          <SidebarLogo onClose={() => setMobileOpen(false)} />

          <div className="relative flex-1 min-h-0">
            <SidebarNavList
              navFiltrado={navFiltrado}
              navRef={navRefMovil}
              onNavigate={() => setMobileOpen(false)}
            />
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-x-0 bottom-0 h-[50px] transition-opacity duration-150 ease-out motion-reduce:transition-none",
                "bg-gradient-to-t from-sidebar to-transparent",
                hasMoreBelowMovil ? "opacity-100" : "opacity-0"
              )}
            />
          </div>

          <SidebarUserFooter usuario={usuario} />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-[52px] border-b border-border flex items-center px-4 lg:px-6 gap-3 flex-shrink-0 bg-sidebar/80 dark:backdrop-blur-xl">
          {/* Hamburguesa + logo compacto — solo <1024px */}
          <div className="flex lg:hidden items-center gap-2 min-w-0">
            <button
              type="button"
              aria-label="Abrir menú principal"
              aria-expanded={mobileOpen}
              aria-controls="sidebar-drawer-movil"
              onClick={() => setMobileOpen(true)}
              className="flex h-11 w-11 -ml-2 items-center justify-center rounded-lg text-foreground hover:bg-muted transition-colors flex-shrink-0"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/crm" className="flex items-center gap-2 min-w-0">
              <div className="rounded-md bg-primary p-1 flex-shrink-0">
                <Leaf className="h-3 w-3 text-primary-foreground" />
              </div>
              <span className="text-[13px] font-semibold tracking-tight text-foreground truncate">
                KariaApp
              </span>
            </Link>
          </div>

          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>
        <main ref={mainRef} className="flex-1 overflow-y-auto bg-background">
          <SesionProvider rol={rol ?? "INVITADO"}>
            {children}
          </SesionProvider>
        </main>
      </div>

      <Toaster richColors position="top-right" closeButton />
    </div>
  );
}
