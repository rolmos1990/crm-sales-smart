import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, ShoppingCart, Building2, User, FileText } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { obtenerPedidoPorId } from "@/sales/pedidos/queries";
import { actualizarEstadoPedido } from "@/sales/pedidos/actions";
import { ESTADO_PEDIDO_CONFIG } from "@/sales/pedidos/types";
import { cn } from "@/lib/utils";

const TRANSICIONES: Record<string, string[]> = {
  PENDIENTE: ["CONFIRMADO", "CANCELADO"],
  CONFIRMADO: ["EN_PROCESO", "CANCELADO"],
  EN_PROCESO: ["ENVIADO"],
  ENVIADO: ["ENTREGADO"],
  ENTREGADO: [],
  CANCELADO: [],
};

export default async function PedidoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let pedido = null;

  try {
    pedido = await obtenerPedidoPorId(id);
  } catch {
    // DB not configured
  }

  if (!pedido && process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("placeholder")) {
    notFound();
  }

  if (!pedido) {
    return (
      <div className="p-6">
        <ButtonLink variant="ghost" size="icon-sm" href="/sales/pedidos"><ArrowLeft className="h-4 w-4" /></ButtonLink>
        <p className="text-muted-foreground mt-4">Pedido no disponible</p>
      </div>
    );
  }

  const estadoConf = ESTADO_PEDIDO_CONFIG[pedido.estado];
  const siguientes = TRANSICIONES[pedido.estado] ?? [];
  const lineas = (pedido as any).lineas ?? [];
  const subtotal = Number(pedido.subtotal);
  const impuesto = Number(pedido.impuesto);
  const total = Number(pedido.total);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <ButtonLink variant="ghost" size="icon-sm" href="/sales/pedidos"><ArrowLeft className="h-4 w-4" /></ButtonLink>
        <span className="text-muted-foreground text-sm">Pedidos</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold">{pedido.numero}</h1>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge className={cn("text-xs", estadoConf.color)}>{estadoConf.etiqueta}</Badge>
            <span className="text-sm text-muted-foreground">
              Pedido {format(new Date(pedido.fechaPedido), "dd MMM yyyy", { locale: es })}
            </span>
            {pedido.fechaEntrega && (
              <span className="text-sm text-muted-foreground">
                · Entrega {format(new Date(pedido.fechaEntrega), "dd MMM yyyy", { locale: es })}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {siguientes.map((sig) => {
            const conf = ESTADO_PEDIDO_CONFIG[sig as keyof typeof ESTADO_PEDIDO_CONFIG];
            return (
              <form key={sig} action={async () => { "use server"; await actualizarEstadoPedido(id, sig); }}>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className={sig === "CANCELADO" ? "text-destructive border-destructive hover:bg-destructive/10" : ""}
                >
                  {conf.etiqueta}
                </Button>
              </form>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pedido.empresa && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Empresa</CardTitle></CardHeader>
            <CardContent>
              <Link href={`/crm/empresas/${pedido.empresa.id}`} className="font-medium hover:underline text-primary flex items-center gap-1">
                <Building2 className="h-4 w-4" />{pedido.empresa.nombre}
              </Link>
            </CardContent>
          </Card>
        )}
        {pedido.contacto && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Contacto</CardTitle></CardHeader>
            <CardContent>
              <Link href={`/crm/contactos/${pedido.contacto.id}`} className="font-medium hover:underline text-primary flex items-center gap-1">
                <User className="h-4 w-4" />{pedido.contacto.nombre} {pedido.contacto.apellido}
              </Link>
            </CardContent>
          </Card>
        )}
        {(pedido as any).cotizacion && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Cotización</CardTitle></CardHeader>
            <CardContent>
              <Link href={`/sales/cotizaciones/${(pedido as any).cotizacion.id}`} className="font-medium hover:underline text-primary flex items-center gap-1">
                <FileText className="h-4 w-4" />{(pedido as any).cotizacion.numero}
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
                  <td className="py-2 px-2">{linea.producto?.nombre ?? linea.descripcion ?? "—"}</td>
                  <td className="py-2 px-2 text-right">{Number(linea.cantidad)}</td>
                  <td className="py-2 px-2 text-right">{pedido.moneda} {Number(linea.precioUnitario).toLocaleString("es-PE", { minimumFractionDigits: 2 })}</td>
                  <td className="py-2 px-2 text-right">{Number(linea.descuento)}%</td>
                  <td className="py-2 px-2 text-right font-medium">{pedido.moneda} {Number(linea.subtotal).toLocaleString("es-PE", { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 pt-3 border-t flex flex-col items-end gap-1">
            <div className="flex gap-8 text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{pedido.moneda} {subtotal.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex gap-8 text-sm">
              <span className="text-muted-foreground">IGV (18%)</span>
              <span>{pedido.moneda} {impuesto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
            </div>
            <Separator className="my-1 w-48" />
            <div className="flex gap-8 text-base font-semibold">
              <span>Total</span>
              <span>{pedido.moneda} {total.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {pedido.notas && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Notas</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{pedido.notas}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
