"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelectorPais } from "@/shared/entregas/components/selector-pais";
import { guardarConfiguracionGeografica } from "../actions";

const MODOS = [
  { valor: "UN_SOLO_PAIS", etiqueta: "Un solo país" },
  { valor: "MULTIPAIS", etiqueta: "Multipaís" },
] as const;

interface SeccionModoGeograficoProps {
  modoGeograficoInicial: "UN_SOLO_PAIS" | "MULTIPAIS";
  paisOperacionIdInicial: string | null;
}

// 019-cobertura-geografica-envios — FR-010/FR-011/FR-012. Formulario propio
// (no comparte schema/acción con TabEmpresa) porque afecta un dato distinto:
// cómo se piden país/estado/ciudad en cotización y pedido, no la dirección
// de la propia empresa.
export function SeccionModoGeografico({ modoGeograficoInicial, paisOperacionIdInicial }: SeccionModoGeograficoProps) {
  const [modoGeografico, setModoGeografico] = useState<"UN_SOLO_PAIS" | "MULTIPAIS">(modoGeograficoInicial);
  const [paisOperacionId, setPaisOperacionId] = useState<string | null>(paisOperacionIdInicial);
  const [isPending, startTransition] = useTransition();

  function guardar() {
    startTransition(async () => {
      const resultado = await guardarConfiguracionGeografica({ modoGeografico, paisOperacionId });
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Modo geográfico actualizado");
    });
  }

  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 pb-2 border-b border-stone-100 dark:border-white/8 mb-4 flex items-center gap-1.5">
        <Globe className="h-3.5 w-3.5" /> Cobertura geográfica de envíos
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Determina si al crear una cotización o un pedido se pide país, o solo provincia/estado y ciudad.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Modo</label>
          <Select
            items={Object.fromEntries(MODOS.map((m) => [m.valor, m.etiqueta]))}
            value={modoGeografico}
            onValueChange={(v) => v && setModoGeografico(v as "UN_SOLO_PAIS" | "MULTIPAIS")}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODOS.map((m) => <SelectItem key={m.valor} value={m.valor}>{m.etiqueta}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {modoGeografico === "UN_SOLO_PAIS" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">País de operación</label>
            <SelectorPais value={paisOperacionId} onChange={setPaisOperacionId} />
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <Button type="button" onClick={guardar} disabled={isPending} className="rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400">
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar modo geográfico
        </Button>
      </div>
    </div>
  );
}
