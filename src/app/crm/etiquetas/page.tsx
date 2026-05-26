import { Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { obtenerTags } from "@/crm/tags/queries";
import { ListaTags } from "@/crm/tags/components/lista-tags";

export default async function EtiquetasPage() {
  let tags: Awaited<ReturnType<typeof obtenerTags>> = [];

  try {
    tags = await obtenerTags();
  } catch {
    // DB no configurada
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="h-8 w-8 rounded-xl bg-lime-500/10 dark:bg-lime-400/10 flex items-center justify-center">
            <Tag className="h-4 w-4 text-lime-600 dark:text-lime-400" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Etiquetas</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-10.5">
          Gestiona las etiquetas que puedes asignar a oportunidades y contactos.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {tags.length} etiqueta{tags.length !== 1 ? "s" : ""}
          </CardTitle>
          <CardDescription>
            Haz clic en una etiqueta para editarla o eliminarla.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ListaTags tags={tags} />
        </CardContent>
      </Card>
    </div>
  );
}
