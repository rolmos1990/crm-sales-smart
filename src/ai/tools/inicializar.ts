// Importar cada provider provoca su registro como efecto lateral
import "@/ai/tools/providers/product.tool";
import "@/ai/tools/providers/customer.tool";
import "@/ai/tools/providers/transfer.tool";
import "@/ai/tools/providers/crear-cotizacion.tool";
import "@/ai/tools/providers/crear-pedido.tool";
import "@/ai/tools/providers/agregar-etiqueta-contacto.tool";
import "@/ai/tools/providers/actualizar-info-contacto.tool";
// 015-herramientas-operativas-inventario-envios-acciones
import "@/ai/tools/providers/consultar-disponibilidad.tool";
import "@/ai/tools/providers/consultar-precio-actual.tool";
import "@/ai/tools/providers/consultar-promociones.tool";
import "@/ai/tools/providers/validar-combinacion-productos.tool";
import "@/ai/tools/providers/obtener-metodos-entrega.tool";
import "@/ai/tools/providers/calcular-costo-envio.tool";
import "@/ai/tools/providers/estimar-fecha-entrega.tool";
import "@/ai/tools/providers/validar-cobertura.tool";
import "@/ai/tools/providers/obtener-ubicaciones-retiro.tool";
import "@/ai/tools/providers/agregar-productos-oportunidad.tool";
// 024-alias-ubicaciones-transportistas
import "@/ai/tools/providers/consultar-opciones-envio.tool";
import "@/ai/tools/providers/finalizar-atencion-workflow.tool";
// Ciclo de vida: mover la oportunidad de etapa según las reglas del negocio
import "@/ai/tools/providers/actualizar-etapa-oportunidad.tool";
// 033-documentacion-vector-store-openai — se registra siempre, pero solo se le
// ofrece al agente que tiene documentación indexada (ver herramientas-agente.ts)
import "@/ai/tools/providers/buscar-en-documentacion.tool";
