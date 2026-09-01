"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FormTransportista } from "./form-transportista";
import { SeccionCoberturaGeografica } from "./seccion-cobertura-geografica";
import type { Transportista } from "../types";

interface DialogCrearTransportistaProps {
  tipo: "crear";
}

interface DialogEditarTransportistaProps {
  tipo: "editar";
  transportista: Transportista;
}

type DialogTransportistaProps = DialogCrearTransportistaProps | DialogEditarTransportistaProps;

export function DialogTransportista(props: DialogTransportistaProps) {
  const [abierto, setAbierto] = useState(false);
  const esEditar = props.tipo === "editar";

  // 019-cobertura-geografica-envios — al EDITAR un transportista ya
  // existente, la sección de cobertura geográfica queda visible de
  // inmediato (mismo diálogo, sin pasos extra). Al CREAR, el diálogo
  // conserva exactamente su comportamiento original (se cierra al guardar,
  // ver tests/e2e/sales/transportistas.spec.ts) — para agregar cobertura a
  // uno recién creado, el negocio lo abre de nuevo con "Editar" (FR-001
  // sigue cumplido: "al crear o al editar" no exige que sea en la misma
  // apertura del diálogo).

  return (
    <>
      {esEditar ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={() => setAbierto(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button
          className="rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02]"
          onClick={() => setAbierto(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo transportista
        </Button>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {esEditar ? "Editar transportista" : "Nuevo transportista"}
            </DialogTitle>
          </DialogHeader>
          <FormTransportista
            transportista={esEditar ? props.transportista : undefined}
            onExito={() => setAbierto(false)}
          />
          {esEditar && <SeccionCoberturaGeografica transportistaId={props.transportista.id} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
