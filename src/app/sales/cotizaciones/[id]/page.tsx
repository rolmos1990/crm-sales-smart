import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, FileText, Building2, User, Pencil, Phone, Mail } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { obtenerCotizacionPorId } from "@/sales/cotizaciones/queries";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { cambiarEstadoCotizacion } from "@/sales/cotizaciones/actions";
import { ESTADO_COTIZACION_CONFIG } from "@/sales/cotizaciones/types";
import { BotonCopiarCotizacion } from "@/sales/cotizaciones/components/boton-copiar-cotizacion";
import { BotonAprobarCotizacion } from "@/sales/cotizaciones/components/boton-aprobar-cotizacion";
import { BotonEliminarCotizacion } from "@/sales/cotizaciones/components/boton-eliminar-cotizacion";
import { BotonReintentarPedido } from "@/sales/cotizaciones/components/boton-reintentar-pedido";
import { cn } from "@/lib/utils";

// Flujo: BORRADOR → REVISADA → APROBADA (genera el pedido) → ENVIADA (estado
// final). RECHAZADA queda disponible desde los estados previos a aprobar.
const TRANSICIONES_MANUALES: Record<string, string[]> = {
  BORRADOR: ["REVISADA", "RECHAZADA"],
  REVISADA: ["RECHAZADA"],
  APROBADA: ["ENVIADA"],
  ENVIADA: [],
  RECHAZADA: [],
  VENCIDA: [],
};

// Solo se puede modificar/descartar una cotización mientras no haya sido enviada
const ESTADOS_EDITABLES = new Set(["BORRADOR"]);

export default async function CotizacionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "cotizaciones", "ver").permitido) redirect("/acceso-denegado");

  let cotizacion = null;

  try {
    cotizacion = await obtenerCotizacionPorId(id, sesion.instanciaId);
  } catch {
    // DB not configured
  }

  if (!cotizacion && process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("placeholder")) {
    notFound();
  }

  if (!cotizacion) {
    return (
      <div className="p-6">
        <ButtonLink variant="ghost" size="icon-sm" href="/sales/cotizaciones"><ArrowLeft className="h-4 w-4" /></ButtonLink>
        <p className="text-muted-foreground mt-4">Cotización no disponible</p>
      </div>
    );
  }

  const estadoConf = ESTADO_COTIZACION_CONFIG[cotizacion.estado];
  const siguientesManuales = TRANSICIONES_MANUALES[cotizacion.estado] ?? [];
  const lineas = (cotizacion as any).lineas ?? [];
  const metadata = (cotizacion as any).metadata as Record<string, unknown> | null;
  const destinatario = metadata?.destinatario as Record<string, string> | undefined;

  const subtotal = Number(cotizacion.subtotal);
  const impuesto = Number(cotizacion.impuesto);
  const total = Number(cotizacion.total);

  const lineasParaCopiar = lineas.map((l: any) => ({
    descripcion: l.descripcion,
    productoNombre: l.producto?.nombre ?? null,
    cantidad: Number(l.cantidad),
    precioUnitario: Number(l.precioUnitario),
    descuento: Number(l.descuento),
    subtotal: Number(l.subtotal),
  }));

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <ButtonLink variant="ghost" size="icon-sm" href="/sales/cotizaciones"><ArrowLeft className="h-4 w-4" /></ButtonLink>
        <span className="text-muted-foreground text-sm">Cotizaciones</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold">{cotizacion.numero}</h1>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={estadoConf.variante}>{estadoConf.etiqueta}</Badge>
            <span className="text-sm text-muted-foreground">
              Emitida {format(new Date(cotizacion.fechaEmision), "dd MMM yyyy", { locale: es })}
            </span>
            {cotizacion.fechaVencimiento && (
              <span className="text-sm text-muted-foreground">
                · Vence {format(new Date(cotizacion.fechaVencimiento), "dd MMM yyyy", { locale: es })}
              </span>
            )}
            {(cotizacion as any).pedidos?.[0] && (
              <Link
                href={`/sales/pedidos/${(cotizacion as any).pedidos[0].id}`}
                className="text-sm text-primary hover:underline"
              >
                · Pedido {(cotizacion as any).pedidos[0].numero}
              </Link>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {ESTADOS_EDITABLES.has(cotizacion.estado) && (
            <ButtonLink href={`/sales/cotizaciones/${id}/editar`} variant="outline" size="sm">
              <Pencil className="h-4 w-4" />Editar
            </ButtonLink>
          )}
          <BotonCopiarCotizacion
            cotizacionId={id}
            numero={cotizacion.numero}
            estado={cotizacion.estado}
            moneda={cotizacion.moneda}
            fechaEmision={cotizacion.fechaEmision}
            fechaVencimiento={cotizacion.fechaVencimiento}
            subtotal={subtotal}
            impuesto={impuesto}
            total={total}
            notas={cotizacion.notas}
            destinatario={destinatario}
            lineas={lineasParaCopiar}
          />
          <BotonAprobarCotizacion cotizacionId={id} estado={cotizacion.estado} />
          {cotizacion.estado === "APROBADA" && (cotizacion as any).pedidos?.length === 0 && (
            <BotonReintentarPedido cotizacionId={id} />
          )}
          <BotonEliminarCotizacion cotizacionId={id} numero={cotizacion.numero} estado={cotizacion.estado} />
          {siguientesManuales.map((sig) => {
            const conf = ESTADO_COTIZACION_CONFIG[sig as keyof typeof ESTADO_COTIZACION_CONFIG];
            return (
              <form key={sig} action={async () => { "use server"; await cambiarEstadoCotizacion(id, sig); }}>
                <Button type="submit" variant="outline" size="sm">
                  Marcar como {conf.etiqueta}
                </Button>
              </form>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cotizacion.empresa && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Empresa</CardTitle></CardHeader>
            <CardContent>
              <Link href={`/crm/empresas/${cotizacion.empresa.id}`} className="font-medium hover:underline text-primary flex items-center gap-1">
                <Building2 className="h-4 w-4" />{cotizacion.empresa.nombre}
              </Link>
            </CardContent>
          </Card>
        )}
        {cotizacion.contacto && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Contacto</CardTitle></CardHeader>
            <CardContent>
              <Link href={`/crm/contactos/${cotizacion.contacto.id}`} className="font-medium hover:underline text-primary flex items-center gap-1">
                <User className="h-4 w-4" />{cotizacion.contacto.nombre} {cotizacion.contacto.apellido}
              </Link>
            </CardContent>
          </Card>
        )}
        {destinatario && (destinatario.nombre || destinatario.telefono || destinatario.email) && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Destinatario</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {(destinatario.nombre || destinatario.apellido) && (
                <p className="font-medium text-sm">
                  {[destinatario.nombre, destinatario.apellido].filter(Boolean).join(" ")}
                </p>
              )}
              {destinatario.telefono && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />{destinatario.telefono}
                </p>
              )}
              {destinatario.email && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />{destinatario.email}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardContent className="pt-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Descripción</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Cant.</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">P. Unit.</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Desc.</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((linea: any) => (
                <tr key={linea.id} className="border-b last:border-0">
                  <td className="py-2 px-2">
                    {linea.producto?.nombre ?? linea.descripcion ?? "—"}
                  </td>
                  <td className="py-2 px-2 text-right">{Number(linea.cantidad)}</td>
                  <td className="py-2 px-2 text-right">{cotizacion.moneda} {Number(linea.precioUnitario).toLocaleString("es-PE", { minimumFractionDigits: 2 })}</td>
                  <td className="py-2 px-2 text-right">{Number(linea.descuento)}%</td>
                  <td className="py-2 px-2 text-right font-medium">{cotizacion.moneda} {Number(linea.subtotal).toLocaleString("es-PE", { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 pt-3 border-t flex flex-col items-end gap-1">
            <div className="flex gap-8 text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{cotizacion.moneda} {subtotal.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex gap-8 text-sm">
              <span className="text-muted-foreground">IGV</span>
              <span>{cotizacion.moneda} {impuesto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
            </div>
            <Separator className="my-1 w-48" />
            <div className="flex gap-8 text-base font-semibold">
              <span>Total</span>
              <span>{cotizacion.moneda} {total.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {cotizacion.notas && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Notas</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{cotizacion.notas}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
