import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormEmpresa } from "@/crm/empresas/components/form-empresa";

export default function NuevaEmpresaPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Nueva empresa</h1>
        <p className="text-muted-foreground text-sm mt-1">Completa los datos de la nueva empresa</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información de la empresa</CardTitle>
        </CardHeader>
        <CardContent>
          <FormEmpresa />
        </CardContent>
      </Card>
    </div>
  );
}
