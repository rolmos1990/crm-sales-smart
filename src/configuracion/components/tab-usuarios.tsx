import { obtenerUsuariosInstancia } from "@/configuracion/usuarios/queries";
import { ListaUsuarios } from "./lista-usuarios";

interface TabUsuariosProps {
  instanciaId: string;
}

export async function TabUsuarios({ instanciaId }: TabUsuariosProps) {
  const usuarios = await obtenerUsuariosInstancia(instanciaId);

  return (
    <div className="flex flex-col gap-2">
      <div className="mb-2">
        <h2 className="text-lg font-semibold text-stone-50 tracking-tight">Usuarios y Agentes</h2>
        <p className="text-sm text-stone-400">
          Gestiona los miembros de tu equipo y los agentes del sistema.
        </p>
      </div>
      <ListaUsuarios usuarios={usuarios} />
    </div>
  );
}
