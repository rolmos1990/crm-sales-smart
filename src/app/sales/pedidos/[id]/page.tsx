import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft, ShoppingCart, Building2, User, FileText,
  Mail, Phone, Hash, Briefcase, Globe, ExternalLink,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { obtenerPedidoPorId } from "@/sales/pedidos/queries";
import { requireSesion } from "@/shared/auth/sesion";
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

function formatearValorCampo(cv: any): string {
  if (cv.valor === null || cv.valor === undefined) return "—";
  const tipo = cv.campo?.tipo;
  if (tipo === "BOOLEANO") return cv.valor ? "Sí" : "No";
  if (tipo === "FECHA") {
    try { return format(new Date(cv.valor as string), "dd MMM yyyy", { locale: es }); } catch { return String(cv.valor); }
  }
  if (tipo === "MULTISELECT" && Array.isArray(cv.valor)) return cv.valor.join(", ");
  return String(cv.valor);
}

export default async function PedidoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let pedido = null;

  try {
    const sesion = await requireSesion();
    pedido = await obtenerPedidoPorId(id, sesion.instanciaId);
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
  const contacto = (pedido as any).contacto ?? null;
  const empresa = (pedido as any).empresa ?? null;
  const cotizacion = (pedido as any).cotizacion ?? null;
  // Oportunidad accesible directamente o a través de la cotización
  const oportunidad = (pedido as any).oportunidad ?? (pedido as any).cotizacion?.oportunidad ?? null;
  // Los valores de campos dinámicos se guardan en oportunidad.metadata (JSON)
  // Las definiciones vienen del pipeline.campos de la oportunidad
  const metadataOportunidad = (oportunidad?.metadata ?? {}) as Record<string, unknown>;
  const definicionesCampos: any[] = oportunidad?.pipeline?.campos ?? [];
  // Solo mostrar campos que tengan valor en metadata
  const camposOportunidad = definicionesCampos.filter(
    (c) => metadataOportunidad[c.clave] !== undefined && metadataOportunidad[c.clave] !== null && metadataOportunidad[c.clave] !== ""
  );

  const tieneCompradorManual = !contacto && !empresa && (pedido.nombre || pedido.empresaNombre);

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

      {/* ── Cotización vinculada ──────────────────────────────────── */}
      {cotizacion && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>Cotización:</span>
          <Link href={`/sales/cotizaciones/${cotizacion.id}`} className="text-primary hover:underline font-medium">
            {cotizacion.numero}
          </Link>
        </div>
      )}

      {/* ── Información del cliente ───────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {empresa && (
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-2">
              <Link
                href={`/crm/empresas/${empresa.id}`}
                className="text-base font-semibold hover:underline text-primary flex items-center gap-1.5"
              >
                {empresa.nombre}
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              <div className="grid grid-cols-1 gap-y-1.5 mt-1">
                {empresa.ruc && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Hash className="h-3.5 w-3.5 shrink-0" />
                    <span>RUC: {empresa.ruc}</span>
                  </div>
                )}
                {empresa.industria && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Briefcase className="h-3.5 w-3.5 shrink-0" />
                    <span>{empresa.industria}</span>
                  </div>
                )}
                {empresa.telefono && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <a href={`tel:${empresa.telefono}`} className="hover:underline text-primary">{empresa.telefono}</a>
                  </div>
                )}
                {empresa.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <a href={`mailto:${empresa.email}`} className="hover:underline text-primary truncate">{empresa.email}</a>
                  </div>
                )}
                {empresa.sitioWeb && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <a href={empresa.sitioWeb} target="_blank" rel="noopener noreferrer" className="hover:underline text-primary truncate">
                      {empresa.sitioWeb.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {contacto && (
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Contacto
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-2">
              <Link
                href={`/crm/contactos/${contacto.id}`}
                className="text-base font-semibold hover:underline text-primary flex items-center gap-1.5"
              >
                {contacto.nombre} {contacto.apellido}
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              <div className="grid grid-cols-1 gap-y-1.5 mt-1">
                {contacto.cargo && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Briefcase className="h-3.5 w-3.5 shrink-0" />
                    <span>{contacto.cargo}</span>
                  </div>
                )}
                {contacto.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <a href={`mailto:${contacto.email}`} className="hover:underline text-primary truncate">{contacto.email}</a>
                  </div>
                )}
                {contacto.telefonoPrincipal && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <a href={`tel:${contacto.telefonoPrincipal}`} className="hover:underline text-primary">{contacto.telefonoPrincipal}</a>
                  </div>
                )}
                {contacto.telefonoSecundario && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <a href={`tel:${contacto.telefonoSecundario}`} className="hover:underline text-primary">
                      {contacto.telefonoSecundario}
                      <span className="ml-1 text-[10px] text-muted-foreground">(alt)</span>
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {tieneCompradorManual && (
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Comprador
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-2">
              {(pedido.nombre || pedido.apellido) && (
                <p className="text-base font-semibold">{pedido.nombre} {pedido.apellido}</p>
              )}
              <div className="grid grid-cols-1 gap-y-1.5 mt-1">
                {pedido.empresaNombre && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span>{pedido.empresaNombre}</span>
                  </div>
                )}
                {pedido.ruc && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Hash className="h-3.5 w-3.5 shrink-0" />
                    <span>RUC: {pedido.ruc}</span>
                  </div>
                )}
                {pedido.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <a href={`mailto:${pedido.email}`} className="hover:underline text-primary truncate">{pedido.email}</a>
                  </div>
                )}
                {pedido.telefono && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <a href={`tel:${pedido.telefono}`} className="hover:underline text-primary">{pedido.telefono}</a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Líneas del pedido ─────────────────────────────────────── */}
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

      {/* ── Campos adicionales de la oportunidad ─────────────────── */}
      {camposOportunidad.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              Campos adicionales
            </CardTitle>
            {oportunidad?.titulo && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Capturados de la oportunidad{" "}
                <Link href={`/crm/oportunidades/${oportunidad.id}`} className="text-primary hover:underline">
                  {oportunidad.titulo}
                </Link>{" "}
                — solo lectura
              </p>
            )}
          </CardHeader>
          <CardContent className="pb-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {camposOportunidad.map((c: any) => (
                <div key={c.id}>
                  <dt className="text-xs font-medium text-muted-foreground mb-0.5">{c.nombre}</dt>
                  <dd className="text-sm text-foreground">
                    {formatearValorCampo({ valor: metadataOportunidad[c.clave], campo: c })}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
