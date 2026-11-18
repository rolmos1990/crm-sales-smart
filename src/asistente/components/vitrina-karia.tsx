"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { KariaAvatar, type KariaAvatarProps } from "@/asistente/karia/karia-avatar";
import { usarAsistenteKaria } from "@/asistente/contexto-asistente";

const INSTANCIAS: { titulo: string; props: KariaAvatarProps }[] = [
  { titulo: 'state="idle" emotion="neutral"', props: { state: "idle", emotion: "neutral" } },
  { titulo: 'state="idle" emotion="happy"', props: { state: "idle", emotion: "happy" } },
  { titulo: 'state="idle" emotion="calm"', props: { state: "idle", emotion: "calm" } },
  { titulo: 'state="thinking"', props: { state: "thinking" } },
  { titulo: "blinking={false}", props: { state: "idle", blinking: false } },
  { titulo: "size={48}", props: { size: 48 } },
  { titulo: "size={128} floating={false}", props: { size: 128, floating: false } },
];

export function VitrinaKaria() {
  const { state, pensar, celebrar, reposar } = usarAsistenteKaria();
  const [reinicioExito, setReinicioExito] = useState(0);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 p-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Vitrina de Karia</h1>
        <p className="text-sm text-muted-foreground">Solo desarrollo. Spec 038.</p>
      </header>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium text-foreground">
          Flotante — estado actual: <code data-testid="estado-flotante">{state}</code>
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={pensar}>
            Pensar
          </Button>
          <Button variant="outline" onClick={celebrar}>
            Celebrar
          </Button>
          <Button variant="outline" onClick={reposar}>
            Reposar
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-4 text-sm font-medium text-foreground">Instancias</h2>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4" data-testid="instancias-karia">
          {INSTANCIAS.map(({ titulo, props }) => (
            <figure key={titulo} className="flex flex-col items-center gap-3">
              <div className="flex h-36 items-end">
                <KariaAvatar size={96} {...props} label={titulo} />
              </div>
              <figcaption className="text-center font-mono text-xs text-muted-foreground">{titulo}</figcaption>
            </figure>
          ))}
          <figure className="flex flex-col items-center gap-3">
            <div className="flex h-36 items-end">
              <KariaAvatar size={96} state="success" reinicio={reinicioExito} label='state="success"' />
            </div>
            <Button size="sm" variant="ghost" onClick={() => setReinicioExito((n) => n + 1)}>
              Repetir success
            </Button>
          </figure>
        </div>
      </section>
    </div>
  );
}
