"use client";

import { createContext, useContext } from "react";
import type { Rol } from "@/generated/prisma/enums";
import { puedeVerModulo, puedeModificar as checkPuedeModificar } from "@/shared/auth/permisos";

type SesionContextValue = {
  rol: Rol;
  puedeVer: (modulo: string) => boolean;
  puedeModificar: (modulo: string) => boolean;
};

const SesionContext = createContext<SesionContextValue>({
  rol: "INVITADO",
  puedeVer: () => false,
  puedeModificar: () => false,
});

export function SesionProvider({
  rol,
  children,
}: {
  rol: Rol;
  children: React.ReactNode;
}) {
  return (
    <SesionContext.Provider
      value={{
        rol,
        puedeVer: (modulo) => puedeVerModulo(rol, modulo),
        puedeModificar: (modulo) => checkPuedeModificar(rol, modulo),
      }}
    >
      {children}
    </SesionContext.Provider>
  );
}

export function useSesion(): SesionContextValue {
  return useContext(SesionContext);
}
