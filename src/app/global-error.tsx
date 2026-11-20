"use client";

/**
 * 044 — El último recurso: captura lo que falla en el `app/layout.tsx` raíz.
 *
 * **No importa nada del producto, y es a propósito.** Este archivo reemplaza
 * el layout raíz, así que no recibe `globals.css` (es decir, nada de Tailwind
 * ni de los tokens semánticos) ni el `ThemeProvider`. Importar `AppErrorScreen`
 * o cualquier componente de Karia daría una pantalla sin estilos, que es peor
 * que una pantalla simple bien hecha.
 *
 * De ahí que los estilos vayan embebidos y el modo oscuro se resuelva con
 * `prefers-color-scheme`: el tema que el usuario eligió en la aplicación no
 * llega hasta acá. Se va a ver distinta del resto de la familia y eso está
 * previsto — cuanto más arriba está el fallback, menos puede apoyarse en el
 * producto que acaba de fallar.
 *
 * Tampoco admite `export const metadata` por ser Client Component; el título
 * se pone con el componente `<title>` de React.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const codigoSoporte = error instanceof Error ? error.digest : undefined;

  return (
    <html lang="es">
      <body>
        <title>Error — KariaApp</title>
        <style>{`
          :root { color-scheme: light dark; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
            font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
            background: #fafaf9;
            color: #1c1917;
          }
          .caja { max-width: 28rem; text-align: center; }
          .titulo { margin: 0 0 .5rem; font-size: 1.125rem; font-weight: 600; }
          .texto { margin: 0 0 1.5rem; font-size: .875rem; line-height: 1.6; color: #57534e; }
          .boton {
            font: inherit; font-size: .875rem; font-weight: 500;
            padding: .5rem 1rem; border-radius: .5rem; border: 0;
            background: #1c1917; color: #fafaf9; cursor: pointer;
          }
          .codigo {
            margin: 1.5rem 0 0; font-size: .75rem; color: #78716c;
          }
          .codigo code { user-select: all; font-family: ui-monospace, SFMono-Regular, monospace; }
          @media (prefers-color-scheme: dark) {
            body { background: #0c0a09; color: #fafaf9; }
            .texto { color: #a8a29e; }
            .boton { background: #fafaf9; color: #0c0a09; }
            .codigo { color: #a8a29e; }
          }
        `}</style>

        <div className="caja">
          <h1 className="titulo">Karia no pudo iniciarse</h1>
          <p className="texto">
            Hubo un problema al cargar la aplicación. Probá de nuevo; si sigue pasando,
            pasale el código de abajo a soporte.
          </p>
          <button className="boton" onClick={() => reset()}>
            Reintentar
          </button>
          {codigoSoporte && (
            <p className="codigo">
              Código para soporte: <code>{codigoSoporte}</code>
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
