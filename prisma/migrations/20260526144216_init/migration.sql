-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('OWNER', 'ADMIN', 'AGENTE');

-- CreateEnum
CREATE TYPE "EstadoContacto" AS ENUM ('ACTIVO', 'INACTIVO', 'LEAD');

-- CreateEnum
CREATE TYPE "Etapa" AS ENUM ('PROSPECTO', 'CALIFICADO', 'PROPUESTA', 'NEGOCIACION', 'GANADO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "TipoActividad" AS ENUM ('LLAMADA', 'EMAIL', 'REUNION', 'TAREA', 'NOTA', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "EstadoCotizacion" AS ENUM ('BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA', 'VENCIDA');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'EN_PROCESO', 'ENVIADO', 'ENTREGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoCampoPersonalizado" AS ENUM ('TEXTO', 'TEXTO_LARGO', 'NUMERO', 'DECIMAL', 'FECHA', 'BOOLEANO', 'SELECT', 'MULTISELECT', 'EMAIL', 'TELEFONO', 'URL', 'JSON');

-- CreateEnum
CREATE TYPE "EntidadCampoPersonalizado" AS ENUM ('OPORTUNIDAD', 'CONTACTO', 'EMPRESA', 'PEDIDO', 'COTIZACION', 'PRODUCTO');

-- CreateEnum
CREATE TYPE "EstadoInstancia" AS ENUM ('ACTIVA', 'INACTIVA', 'SUSPENDIDA');

-- CreateEnum
CREATE TYPE "EstadoIntegracion" AS ENUM ('INSTALADA', 'ACTIVA', 'INACTIVA', 'ERROR');

-- CreateTable
CREATE TABLE "Instancia" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descripcion" TEXT,
    "dominio" TEXT,
    "logoUrl" TEXT,
    "estado" "EstadoInstancia" NOT NULL DEFAULT 'ACTIVA',
    "configuracion" JSONB,
    "metadata" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instancia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'AGENTE',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioInstancia" (
    "id" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'AGENTE',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "UsuarioInstancia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ruc" TEXT,
    "industria" TEXT,
    "tamano" TEXT,
    "sitioWeb" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT,
    "instanciaId" TEXT,
    "usuarioInstanciaId" TEXT,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contacto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "cargo" TEXT,
    "notas" TEXT,
    "estado" "EstadoContacto" NOT NULL DEFAULT 'LEAD',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "empresaId" TEXT,
    "usuarioId" TEXT,
    "instanciaId" TEXT,
    "usuarioInstanciaId" TEXT,

    CONSTRAINT "Contacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "esDefault" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "instanciaId" TEXT,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "color" TEXT,
    "orden" INTEGER NOT NULL,
    "probabilidad" INTEGER NOT NULL DEFAULT 20,
    "esInicial" BOOLEAN NOT NULL DEFAULT false,
    "esGanado" BOOLEAN NOT NULL DEFAULT false,
    "esPerdido" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "pipelineId" TEXT NOT NULL,

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Oportunidad" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "valor" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "etapa" "Etapa" NOT NULL DEFAULT 'PROSPECTO',
    "probabilidad" INTEGER NOT NULL DEFAULT 20,
    "fechaCierre" TIMESTAMP(3),
    "fechaGanada" TIMESTAMP(3),
    "fechaPerdida" TIMESTAMP(3),
    "notas" TEXT,
    "motivoPerdida" TEXT,
    "metadata" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "empresaId" TEXT,
    "usuarioId" TEXT,
    "instanciaId" TEXT,
    "pipelineId" TEXT,
    "stageId" TEXT,
    "usuarioInstanciaId" TEXT,

    CONSTRAINT "Oportunidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OportunidadContacto" (
    "oportunidadId" TEXT NOT NULL,
    "contactoId" TEXT NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OportunidadContacto_pkey" PRIMARY KEY ("oportunidadId","contactoId")
);

-- CreateTable
CREATE TABLE "OportunidadProducto" (
    "id" TEXT NOT NULL,
    "descripcion" TEXT,
    "cantidad" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "precioUnitario" DECIMAL(65,30) NOT NULL,
    "descuento" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "oportunidadId" TEXT NOT NULL,
    "productoId" TEXT,

    CONSTRAINT "OportunidadProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instanciaId" TEXT,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OportunidadTag" (
    "oportunidadId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "OportunidadTag_pkey" PRIMARY KEY ("oportunidadId","tagId")
);

-- CreateTable
CREATE TABLE "CampoPersonalizado" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" "TipoCampoPersonalizado" NOT NULL,
    "entidad" "EntidadCampoPersonalizado" NOT NULL,
    "requerido" BOOLEAN NOT NULL DEFAULT false,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "opciones" JSONB,
    "validaciones" JSONB,
    "valorDefault" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "instanciaId" TEXT,
    "pipelineId" TEXT,
    "stageId" TEXT,

    CONSTRAINT "CampoPersonalizado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampoPersonalizadoValor" (
    "id" TEXT NOT NULL,
    "valor" JSONB,
    "campoId" TEXT NOT NULL,
    "oportunidadId" TEXT,
    "contactoId" TEXT,
    "empresaId" TEXT,
    "pedidoId" TEXT,
    "cotizacionId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampoPersonalizadoValor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "sku" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "categoria" TEXT,
    "unidad" TEXT NOT NULL DEFAULT 'unidad',
    "imagenUrl" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "manejaStock" BOOLEAN NOT NULL DEFAULT false,
    "cantidadDisponible" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "instanciaId" TEXT,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Actividad" (
    "id" TEXT NOT NULL,
    "tipo" "TipoActividad" NOT NULL DEFAULT 'TAREA',
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "completadaEn" TIMESTAMP(3),
    "metadata" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "contactoId" TEXT,
    "empresaId" TEXT,
    "oportunidadId" TEXT,
    "usuarioId" TEXT,
    "instanciaId" TEXT,
    "usuarioInstanciaId" TEXT,

    CONSTRAINT "Actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cotizacion" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "estado" "EstadoCotizacion" NOT NULL DEFAULT 'BORRADOR',
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3),
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "descuento" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "impuesto" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "notas" TEXT,
    "metadata" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "contactoId" TEXT,
    "empresaId" TEXT,
    "usuarioId" TEXT,
    "oportunidadId" TEXT,
    "instanciaId" TEXT,
    "usuarioInstanciaId" TEXT,

    CONSTRAINT "Cotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CotizacionLinea" (
    "id" TEXT NOT NULL,
    "descripcion" TEXT,
    "cantidad" DECIMAL(65,30) NOT NULL,
    "precioUnitario" DECIMAL(65,30) NOT NULL,
    "descuento" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "impuesto" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "cotizacionId" TEXT NOT NULL,
    "productoId" TEXT,

    CONSTRAINT "CotizacionLinea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'PENDIENTE',
    "nombre" TEXT,
    "apellido" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "ruc" TEXT,
    "empresaNombre" TEXT,
    "fechaPedido" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEntrega" TIMESTAMP(3),
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "descuento" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "impuesto" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "notas" TEXT,
    "metadata" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "contactoId" TEXT,
    "empresaId" TEXT,
    "usuarioId" TEXT,
    "cotizacionId" TEXT,
    "oportunidadId" TEXT,
    "instanciaId" TEXT,
    "usuarioInstanciaId" TEXT,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoLinea" (
    "id" TEXT NOT NULL,
    "descripcion" TEXT,
    "cantidad" DECIMAL(65,30) NOT NULL,
    "precioUnitario" DECIMAL(65,30) NOT NULL,
    "descuento" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "impuesto" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "pedidoId" TEXT NOT NULL,
    "productoId" TEXT,

    CONSTRAINT "PedidoLinea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoLog" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "ocurridoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entidadTipo" TEXT,
    "entidadId" TEXT,
    "usuarioId" TEXT,
    "instanciaId" TEXT,

    CONSTRAINT "EventoLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegracionInstancia" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "estado" "EstadoIntegracion" NOT NULL DEFAULT 'INSTALADA',
    "configuracion" JSONB,
    "metadata" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "instanciaId" TEXT NOT NULL,

    CONSTRAINT "IntegracionInstancia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Instancia_slug_key" ON "Instancia"("slug");

-- CreateIndex
CREATE INDEX "Instancia_slug_idx" ON "Instancia"("slug");

-- CreateIndex
CREATE INDEX "Instancia_estado_idx" ON "Instancia"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "UsuarioInstancia_instanciaId_idx" ON "UsuarioInstancia"("instanciaId");

-- CreateIndex
CREATE INDEX "UsuarioInstancia_usuarioId_idx" ON "UsuarioInstancia"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioInstancia_usuarioId_instanciaId_key" ON "UsuarioInstancia"("usuarioId", "instanciaId");

-- CreateIndex
CREATE INDEX "Empresa_instanciaId_idx" ON "Empresa"("instanciaId");

-- CreateIndex
CREATE INDEX "Empresa_nombre_idx" ON "Empresa"("nombre");

-- CreateIndex
CREATE INDEX "Empresa_ruc_idx" ON "Empresa"("ruc");

-- CreateIndex
CREATE INDEX "Contacto_instanciaId_idx" ON "Contacto"("instanciaId");

-- CreateIndex
CREATE INDEX "Contacto_nombre_idx" ON "Contacto"("nombre");

-- CreateIndex
CREATE INDEX "Contacto_apellido_idx" ON "Contacto"("apellido");

-- CreateIndex
CREATE INDEX "Contacto_email_idx" ON "Contacto"("email");

-- CreateIndex
CREATE INDEX "Pipeline_instanciaId_idx" ON "Pipeline"("instanciaId");

-- CreateIndex
CREATE INDEX "Pipeline_esDefault_idx" ON "Pipeline"("esDefault");

-- CreateIndex
CREATE INDEX "PipelineStage_pipelineId_idx" ON "PipelineStage"("pipelineId");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStage_pipelineId_orden_key" ON "PipelineStage"("pipelineId", "orden");

-- CreateIndex
CREATE INDEX "Oportunidad_instanciaId_idx" ON "Oportunidad"("instanciaId");

-- CreateIndex
CREATE INDEX "Oportunidad_pipelineId_idx" ON "Oportunidad"("pipelineId");

-- CreateIndex
CREATE INDEX "Oportunidad_stageId_idx" ON "Oportunidad"("stageId");

-- CreateIndex
CREATE INDEX "Oportunidad_empresaId_idx" ON "Oportunidad"("empresaId");

-- CreateIndex
CREATE INDEX "Oportunidad_etapa_idx" ON "Oportunidad"("etapa");

-- CreateIndex
CREATE INDEX "Tag_instanciaId_idx" ON "Tag"("instanciaId");

-- CreateIndex
CREATE INDEX "CampoPersonalizado_instanciaId_idx" ON "CampoPersonalizado"("instanciaId");

-- CreateIndex
CREATE INDEX "CampoPersonalizado_entidad_idx" ON "CampoPersonalizado"("entidad");

-- CreateIndex
CREATE INDEX "CampoPersonalizado_pipelineId_idx" ON "CampoPersonalizado"("pipelineId");

-- CreateIndex
CREATE INDEX "CampoPersonalizado_stageId_idx" ON "CampoPersonalizado"("stageId");

-- CreateIndex
CREATE INDEX "CampoPersonalizadoValor_campoId_idx" ON "CampoPersonalizadoValor"("campoId");

-- CreateIndex
CREATE INDEX "CampoPersonalizadoValor_oportunidadId_idx" ON "CampoPersonalizadoValor"("oportunidadId");

-- CreateIndex
CREATE INDEX "CampoPersonalizadoValor_contactoId_idx" ON "CampoPersonalizadoValor"("contactoId");

-- CreateIndex
CREATE INDEX "CampoPersonalizadoValor_empresaId_idx" ON "CampoPersonalizadoValor"("empresaId");

-- CreateIndex
CREATE INDEX "CampoPersonalizadoValor_pedidoId_idx" ON "CampoPersonalizadoValor"("pedidoId");

-- CreateIndex
CREATE INDEX "CampoPersonalizadoValor_cotizacionId_idx" ON "CampoPersonalizadoValor"("cotizacionId");

-- CreateIndex
CREATE INDEX "Producto_instanciaId_idx" ON "Producto"("instanciaId");

-- CreateIndex
CREATE INDEX "Producto_sku_idx" ON "Producto"("sku");

-- CreateIndex
CREATE INDEX "Producto_nombre_idx" ON "Producto"("nombre");

-- CreateIndex
CREATE INDEX "Producto_categoria_idx" ON "Producto"("categoria");

-- CreateIndex
CREATE INDEX "Actividad_instanciaId_idx" ON "Actividad"("instanciaId");

-- CreateIndex
CREATE INDEX "Actividad_fecha_idx" ON "Actividad"("fecha");

-- CreateIndex
CREATE INDEX "Actividad_completada_idx" ON "Actividad"("completada");

-- CreateIndex
CREATE UNIQUE INDEX "Cotizacion_numero_key" ON "Cotizacion"("numero");

-- CreateIndex
CREATE INDEX "Cotizacion_instanciaId_idx" ON "Cotizacion"("instanciaId");

-- CreateIndex
CREATE INDEX "Cotizacion_estado_idx" ON "Cotizacion"("estado");

-- CreateIndex
CREATE INDEX "Cotizacion_oportunidadId_idx" ON "Cotizacion"("oportunidadId");

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_numero_key" ON "Pedido"("numero");

-- CreateIndex
CREATE INDEX "Pedido_instanciaId_idx" ON "Pedido"("instanciaId");

-- CreateIndex
CREATE INDEX "Pedido_estado_idx" ON "Pedido"("estado");

-- CreateIndex
CREATE INDEX "Pedido_telefono_idx" ON "Pedido"("telefono");

-- CreateIndex
CREATE INDEX "Pedido_email_idx" ON "Pedido"("email");

-- CreateIndex
CREATE INDEX "EventoLog_instanciaId_idx" ON "EventoLog"("instanciaId");

-- CreateIndex
CREATE INDEX "EventoLog_entidadTipo_entidadId_idx" ON "EventoLog"("entidadTipo", "entidadId");

-- CreateIndex
CREATE INDEX "EventoLog_tipo_idx" ON "EventoLog"("tipo");

-- CreateIndex
CREATE INDEX "EventoLog_ocurridoEn_idx" ON "EventoLog"("ocurridoEn");

-- CreateIndex
CREATE INDEX "IntegracionInstancia_instanciaId_idx" ON "IntegracionInstancia"("instanciaId");

-- CreateIndex
CREATE INDEX "IntegracionInstancia_clave_idx" ON "IntegracionInstancia"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "IntegracionInstancia_instanciaId_clave_key" ON "IntegracionInstancia"("instanciaId", "clave");

-- AddForeignKey
ALTER TABLE "UsuarioInstancia" ADD CONSTRAINT "UsuarioInstancia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioInstancia" ADD CONSTRAINT "UsuarioInstancia_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_usuarioInstanciaId_fkey" FOREIGN KEY ("usuarioInstanciaId") REFERENCES "UsuarioInstancia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contacto" ADD CONSTRAINT "Contacto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contacto" ADD CONSTRAINT "Contacto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contacto" ADD CONSTRAINT "Contacto_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contacto" ADD CONSTRAINT "Contacto_usuarioInstanciaId_fkey" FOREIGN KEY ("usuarioInstanciaId") REFERENCES "UsuarioInstancia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oportunidad" ADD CONSTRAINT "Oportunidad_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oportunidad" ADD CONSTRAINT "Oportunidad_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oportunidad" ADD CONSTRAINT "Oportunidad_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oportunidad" ADD CONSTRAINT "Oportunidad_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oportunidad" ADD CONSTRAINT "Oportunidad_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oportunidad" ADD CONSTRAINT "Oportunidad_usuarioInstanciaId_fkey" FOREIGN KEY ("usuarioInstanciaId") REFERENCES "UsuarioInstancia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OportunidadContacto" ADD CONSTRAINT "OportunidadContacto_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "Oportunidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OportunidadContacto" ADD CONSTRAINT "OportunidadContacto_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "Contacto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OportunidadProducto" ADD CONSTRAINT "OportunidadProducto_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "Oportunidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OportunidadProducto" ADD CONSTRAINT "OportunidadProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OportunidadTag" ADD CONSTRAINT "OportunidadTag_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "Oportunidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OportunidadTag" ADD CONSTRAINT "OportunidadTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampoPersonalizado" ADD CONSTRAINT "CampoPersonalizado_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampoPersonalizado" ADD CONSTRAINT "CampoPersonalizado_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampoPersonalizado" ADD CONSTRAINT "CampoPersonalizado_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampoPersonalizadoValor" ADD CONSTRAINT "CampoPersonalizadoValor_campoId_fkey" FOREIGN KEY ("campoId") REFERENCES "CampoPersonalizado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampoPersonalizadoValor" ADD CONSTRAINT "CampoPersonalizadoValor_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "Oportunidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampoPersonalizadoValor" ADD CONSTRAINT "CampoPersonalizadoValor_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "Contacto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampoPersonalizadoValor" ADD CONSTRAINT "CampoPersonalizadoValor_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampoPersonalizadoValor" ADD CONSTRAINT "CampoPersonalizadoValor_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampoPersonalizadoValor" ADD CONSTRAINT "CampoPersonalizadoValor_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "Contacto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "Oportunidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_usuarioInstanciaId_fkey" FOREIGN KEY ("usuarioInstanciaId") REFERENCES "UsuarioInstancia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "Contacto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "Oportunidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_usuarioInstanciaId_fkey" FOREIGN KEY ("usuarioInstanciaId") REFERENCES "UsuarioInstancia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionLinea" ADD CONSTRAINT "CotizacionLinea_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionLinea" ADD CONSTRAINT "CotizacionLinea_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "Contacto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "Oportunidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_usuarioInstanciaId_fkey" FOREIGN KEY ("usuarioInstanciaId") REFERENCES "UsuarioInstancia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoLinea" ADD CONSTRAINT "PedidoLinea_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoLinea" ADD CONSTRAINT "PedidoLinea_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoLog" ADD CONSTRAINT "EventoLog_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegracionInstancia" ADD CONSTRAINT "IntegracionInstancia_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "Instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
