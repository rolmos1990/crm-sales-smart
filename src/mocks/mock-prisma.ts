import { mockEmpresas } from "@/mocks/data/empresas";
import { mockContactos } from "@/mocks/data/contactos";
import { mockOportunidades } from "@/mocks/data/oportunidades";
import { mockActividades } from "@/mocks/data/actividades";
import { mockProductos } from "@/mocks/data/productos";
import { mockCotizaciones } from "@/mocks/data/cotizaciones";
import { mockPedidos } from "@/mocks/data/pedidos";
import { mockUsuarios } from "@/mocks/data/usuarios";

type AnyRecord = Record<string, unknown> & { id: string };

function crearModeloMock<T extends AnyRecord>(datos: T[]) {
  return {
    findMany: async (_args?: unknown): Promise<T[]> => [...datos],

    findUnique: async (args: { where: { id?: string } }): Promise<T | null> =>
      datos.find((d) => d.id === args?.where?.id) ?? null,

    findFirst: async (_args?: unknown): Promise<T | null> => datos[0] ?? null,

    count: async (_args?: unknown): Promise<number> => datos.length,

    create: async (args: { data: Partial<T> & { id?: string } }): Promise<T> => {
      const nuevo = {
        ...args.data,
        id: args.data.id ?? `mock-${Date.now()}`,
        creadoEn: new Date(),
        actualizadoEn: new Date(),
      } as T;
      datos.push(nuevo);
      return nuevo;
    },

    update: async (args: { where: { id?: string }; data: Partial<T> }): Promise<T> => {
      const idx = datos.findIndex((d) => d.id === args.where.id);
      if (idx === -1) throw new Error(`Mock: registro no encontrado id=${args.where.id}`);
      datos[idx] = { ...datos[idx], ...args.data, actualizadoEn: new Date() } as T;
      return datos[idx];
    },

    upsert: async (args: {
      where: { id?: string };
      create: Partial<T>;
      update: Partial<T>;
    }): Promise<T> => {
      const idx = datos.findIndex((d) => d.id === args.where.id);
      if (idx !== -1) {
        datos[idx] = { ...datos[idx], ...args.update, actualizadoEn: new Date() } as T;
        return datos[idx];
      }
      const nuevo = {
        ...args.create,
        id: `mock-${Date.now()}`,
        creadoEn: new Date(),
        actualizadoEn: new Date(),
      } as T;
      datos.push(nuevo);
      return nuevo;
    },

    delete: async (args: { where: { id?: string } }): Promise<T> => {
      const idx = datos.findIndex((d) => d.id === args.where.id);
      if (idx === -1) throw new Error(`Mock: registro no encontrado id=${args.where.id}`);
      return datos.splice(idx, 1)[0];
    },

    deleteMany: async (_args?: unknown): Promise<{ count: number }> => ({ count: 0 }),

    updateMany: async (_args?: unknown): Promise<{ count: number }> => ({ count: 0 }),

    aggregate: async (_args?: unknown) => ({
      _count: datos.length,
      _sum: {},
      _avg: {},
      _min: {},
      _max: {},
    }),
  };
}

// Instancias de mock en memoria (persisten durante la sesión del servidor dev)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const empresasMock = mockEmpresas as any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const contactosMock = mockContactos as any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const oportunidadesMock = mockOportunidades as any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const actividadesMock = mockActividades as any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const productosMock = mockProductos as any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cotizacionesMock = mockCotizaciones as any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pedidosMock = mockPedidos as any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const usuariosMock = mockUsuarios as any[];

export const mockPrisma = {
  empresa: crearModeloMock(empresasMock),
  contacto: crearModeloMock(contactosMock),
  oportunidad: crearModeloMock(oportunidadesMock),
  oportunidadContacto: crearModeloMock([] as AnyRecord[]),
  oportunidadProducto: crearModeloMock([] as AnyRecord[]),
  oportunidadTag: crearModeloMock([] as AnyRecord[]),
  actividad: crearModeloMock(actividadesMock),
  producto: crearModeloMock(productosMock),
  cotizacion: crearModeloMock(cotizacionesMock),
  cotizacionLinea: crearModeloMock([] as AnyRecord[]),
  pedido: crearModeloMock(pedidosMock),
  pedidoLinea: crearModeloMock([] as AnyRecord[]),
  usuario: crearModeloMock(usuariosMock),
  usuarioInstancia: crearModeloMock([] as AnyRecord[]),
  instancia: crearModeloMock([] as AnyRecord[]),
  pipeline: crearModeloMock([] as AnyRecord[]),
  pipelineStage: crearModeloMock([] as AnyRecord[]),
  tag: crearModeloMock([] as AnyRecord[]),
  campoPersonalizado: crearModeloMock([] as AnyRecord[]),
  campoPersonalizadoValor: crearModeloMock([] as AnyRecord[]),
  eventoLog: crearModeloMock([] as AnyRecord[]),

  // Prisma transaction stub — ejecuta el callback con el mismo mock
  $transaction: async <T>(
    fn: (tx: typeof mockPrisma) => Promise<T>
  ): Promise<T> => fn(mockPrisma),

  $connect: async () => undefined,
  $disconnect: async () => undefined,
};
