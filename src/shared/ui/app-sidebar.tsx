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
  FileText,
  Package,
  ShoppingCart,
  ChevronRight,
} from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";

const NAVEGACION = [
  {
    grupo: "CRM",
    items: [
      { href: "/crm", etiqueta: "Dashboard", Icono: LayoutDashboard, exact: true },
      { href: "/crm/pipeline", etiqueta: "Pipeline", Icono: KanbanSquare },
      { href: "/crm/contactos", etiqueta: "Contactos", Icono: Users },
      { href: "/crm/empresas", etiqueta: "Empresas", Icono: Building2 },
      { href: "/crm/oportunidades", etiqueta: "Oportunidades", Icono: TrendingUp },
      { href: "/crm/actividades", etiqueta: "Actividades", Icono: CalendarCheck },
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
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        activo
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      <Icono className="h-4 w-4 flex-shrink-0" />
      {etiqueta}
    </Link>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden md:flex w-56 flex-col border-r bg-muted/30 flex-shrink-0">
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/crm" className="flex items-center gap-2 font-semibold">
            <div className="rounded-md bg-primary p-1">
              <KanbanSquare className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm">CRM Smart</span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-4">
          {NAVEGACION.map((grupo) => (
            <div key={grupo.grupo}>
              <p className="px-3 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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

        <div className="border-t p-3">
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">Admin</p>
              <p className="text-xs text-muted-foreground truncate">admin@empresa.com</p>
            </div>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b flex items-center px-6 gap-4 flex-shrink-0 bg-background">
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>CRM Sales Smart</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      <Toaster richColors position="top-right" />
    </div>
  );
}
