export interface EventoDominio<P extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  tipo: string;
  payload: P;
  ocurridoEn: Date;
  version: number;
}

export type HandlerEvento<P extends Record<string, unknown> = Record<string, unknown>> = (
  evento: EventoDominio<P>
) => void | Promise<void>;

export interface IBusEventos {
  publicar<P extends Record<string, unknown>>(tipo: string, payload: P): EventoDominio<P>;
  suscribir<P extends Record<string, unknown>>(tipo: string, handler: HandlerEvento<P>): void;
  desuscribir<P extends Record<string, unknown>>(tipo: string, handler: HandlerEvento<P>): void;
  suscribirTodos(handler: HandlerEvento): void;
}
