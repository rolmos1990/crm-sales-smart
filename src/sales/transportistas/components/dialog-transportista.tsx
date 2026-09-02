"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FormTransportista } from "./form-transportista";

// 022-transportistas-zonas-tarifas — recortado a solo nombre/tipo/estado
// (FR-001); al guardar, redirige al panel de configuración completo en vez
// de cerrar el dialog (la edición ya vive en /sales/transportistas/[id]).
export function DialogTransportista() {
  const [abierto, setAbierto] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button
        className="rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02]"
        onClick={() => setAbierto(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Nuevo transportista
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo transportista</DialogTitle>
          </DialogHeader>
          <FormTransportista
            onExito={(transportista) => {
              setAbierto(false);
              router.push(`/sales/transportistas/${transportista.id}`);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
