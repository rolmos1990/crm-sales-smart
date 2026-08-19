-- Nuevo tipo de acción para disparadores del Flujo de Venta (pedidos): al
-- llegar el pedido a la etapa configurada, mueve la oportunidad relacionada
-- a la etapa Ganada o Perdida de su pipeline (resuelta dinámicamente).
ALTER TYPE "TipoAccionDisparador" ADD VALUE 'CERRAR_OPORTUNIDAD';
