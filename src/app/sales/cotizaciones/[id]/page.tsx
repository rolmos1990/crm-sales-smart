import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, FileText, Building2, User } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { obtenerCotizacionPorId } from "@/sales/cotizaciones/queries";
import { cambiarEstadoCotizacion } from "@/sales/cotizaciones/actions";
import { ESTADO_COTIZACION_CONFIG } from "@/sales/cotizaciones/types";
import { cn } from "@/lib/utils";

const TRANSICIONES: Record<string, string[]> = {
  BORRADOR: ["ENVIADA"],
  ENVIADA: ["APROBADA", "RECHAZADA"],
  APROBADA: [],
  RECHAZADA: [],
  VENCIDA: [],
};

export default async function CotizacionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let cotizacion = null;

  try {
    cotizacion = await obtenerCotizacionPorId(id);
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
  const siguientes = TRANSICIONES[cotizacion.estado] ?? [];
  const lineas = (cotizacion as any).lineas ?? [];

  const subtotal = Number(cotizacion.subtotal);
  const impuesto = Number(cotizacion.impuesto);
  const total = Number(cotizacion.total);

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
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {siguientes.map((sig) => {
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
              <span className="text-muted-foreground">IGV (18%)</span>
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
