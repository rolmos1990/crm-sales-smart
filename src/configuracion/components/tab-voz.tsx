import { AudioLines, Clock, Wallet } from "lucide-react";
import { obtenerProveedoresVoz, obtenerResumenUsoVoz } from "@/configuracion/voz/queries";
import { fusionarConsumoProveedores } from "@/configuracion/voz/fusion";
import { obtenerConfiguracionEmpresa } from "@/configuracion/empresa/queries";
import { ListaProveedoresVoz } from "./lista-proveedores-voz";
import { InterruptorTranscripcion } from "./interruptor-transcripcion";

interface TabVozProps {
  instanciaId: string;
}

export async function TabVoz({ instanciaId }: TabVozProps) {
  const [proveedores, uso, empresa] = await Promise.all([
    obtenerProveedoresVoz(instanciaId),
    obtenerResumenUsoVoz(instanciaId),
    obtenerConfiguracionEmpresa(instanciaId),
  ]);

  // El desglose por proveedor sale del mismo groupBy que el total del mes, así
  // que la suma de las filas ES el valor de la tarjeta (FR-004).
  const { conConsumo, eliminados } = fusionarConsumoProveedores(proveedores, uso.mesPorProveedor);

  const hayProveedorUtilizable = conConsumo.some((p) => p.activo && p.tieneCredencial);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-muted p-2">
          <AudioLines className="h-5 w-5 text-inbox-accent-icon" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Voz</h2>
          <p className="text-sm text-muted-foreground">
            Convierte las notas de voz de tus conversaciones en texto, para leerlas sin
            escucharlas y para que el agente de IA entienda lo que dijo el cliente.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TarjetaMetrica
          icono={<Clock className="h-4 w-4" />}
          titulo="Minutos transcritos"
          principal={`${uso.mes.minutos} min`}
          detalle={`${uso.hoy.minutos} min hoy · ${uso.mes.transcripciones} notas de voz este mes`}
        />
        <TarjetaMetrica
          icono={<Wallet className="h-4 w-4" />}
          titulo="Costo estimado del mes"
          principal={uso.mes.costo !== null ? uso.mes.costo.toFixed(2) : "—"}
          detalle={
            uso.mes.costo !== null
              ? "Según la tarifa por hora que cargaste"
              : "Cargá el costo por hora del proveedor para verlo"
          }
        />
      </div>

      <InterruptorTranscripcion
        habilitada={empresa?.transcripcionVozHabilitada ?? false}
        hayProveedorUtilizable={hayProveedorUtilizable}
      />

      <ListaProveedoresVoz proveedores={conConsumo} eliminados={eliminados} />
    </div>
  );
}

function TarjetaMetrica({
  icono,
  titulo,
  principal,
  detalle,
}: {
  icono: React.ReactNode;
  titulo: string;
  principal: string;
  detalle: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icono}
        <span className="text-xs font-medium uppercase tracking-wide">{titulo}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{principal}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detalle}</p>
    </div>
  );
}
