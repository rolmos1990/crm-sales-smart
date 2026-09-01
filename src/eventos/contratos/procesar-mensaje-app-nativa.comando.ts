// Mismo shape que ProcesarEntrante — un mensaje detectado por eco desde la
// app nativa del canal se resuelve con la misma información (contacto,
// contenido, media) que un mensaje entrante normal. Se re-exporta en vez de
// duplicar el DTO (ver specs/020-fix-mensajes-app-nativa/research.md, R6).
export type { ComandoProcesarEntrantePayload as ComandoProcesarMensajeAppNativaPayload } from "./procesar-entrante.comando";
