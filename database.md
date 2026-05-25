# CRM + Sales System Multiempresa - Prisma Schema Base

Este schema está diseñado para:

- NextJS + React
- Prisma
- PostgreSQL
- CRM dinámico
- Multiempresa / Multi-tenant
- Separación de datos por instancia
- Pipelines configurables por empresa
- Stages configurables
- Campos personalizados por empresa/pipeline
- Tags reutilizables por empresa
- Cotizaciones
- Pedidos manuales o generados desde oportunidad/cotización

## Concepto principal

El sistema debe soportar múltiples empresas dentro de la misma base de datos.

Ejemplo:

- SupleNut
- Decorstorekt
- Otra tienda o negocio

Cada empresa será una `Instancia`.

Todas las tablas principales deben tener `instanciaId` para separar la información.

```txt
Instancia
  ├── Usuarios
  ├── Contactos
  ├── Empresas / Clientes corporativos
  ├── Pipelines
  ├── Stages
  ├── Oportunidades
  ├── Productos
  ├── Cotizaciones
  ├── Pedidos
  ├── Tags
  └── Campos personalizados
```

---

# schema.prisma

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// =====================
// ENUMS
// =====================

enum Rol {
  OWNER
  ADMIN
  AGENTE
}

enum EstadoContacto {
  ACTIVO
  INACTIVO
  LEAD
}

enum TipoActividad {
  LLAMADA
  EMAIL
  REUNION
  TAREA
  NOTA
  WHATSAPP
}

enum EstadoCotizacion {
  BORRADOR
  ENVIADA
  APROBADA
  RECHAZADA
  VENCIDA
}

enum EstadoPedido {
  PENDIENTE
  CONFIRMADO
  EN_PROCESO
  ENVIADO
  ENTREGADO
  CANCELADO
}

enum TipoCampoPersonalizado {
  TEXTO
  TEXTO_LARGO
  NUMERO
  DECIMAL
  FECHA
  BOOLEANO
  SELECT
  MULTISELECT
  EMAIL
  TELEFONO
  URL
  JSON
}

enum EntidadCampoPersonalizado {
  OPORTUNIDAD
  CONTACTO
  EMPRESA
  PEDIDO
  COTIZACION
  PRODUCTO
}

enum EstadoInstancia {
  ACTIVA
  INACTIVA
  SUSPENDIDA
}

// =====================
// INSTANCIA / TENANT
// =====================

model Instancia {
  id            String          @id @default(cuid())
  nombre        String
  slug          String          @unique
  descripcion   String?
  dominio       String?
  logoUrl       String?
  estado        EstadoInstancia @default(ACTIVA)
  configuracion Json?
  metadata      Json?
  creadoEn      DateTime        @default(now())
  actualizadoEn DateTime        @updatedAt

  usuarios      UsuarioInstancia[]
  empresas      Empresa[]
  contactos     Contacto[]
  pipelines     Pipeline[]
  oportunidades Oportunidad[]
  productos     Producto[]
  actividades   Actividad[]
  cotizaciones  Cotizacion[]
  pedidos       Pedido[]
  tags          Tag[]
  campos        CampoPersonalizado[]
  eventos       EventoLog[]

  @@index([slug])
  @@index([estado])
}

// =====================
// USUARIOS
// =====================

model Usuario {
  id             String   @id @default(cuid())
  nombre         String
  email          String   @unique
  passwordHash   String
  activo         Boolean  @default(true)
  creadoEn       DateTime @default(now())
  actualizadoEn  DateTime @updatedAt

  instancias     UsuarioInstancia[]
}

model UsuarioInstancia {
  id           String   @id @default(cuid())
  rol          Rol      @default(AGENTE)
  activo       Boolean  @default(true)
  creadoEn     DateTime @default(now())
  actualizadoEn DateTime @updatedAt

  usuarioId String
  usuario   Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)

  instanciaId String
  instancia   Instancia @relation(fields: [instanciaId], references: [id], onDelete: Cascade)

  oportunidades Oportunidad[]
  actividades   Actividad[]
  cotizaciones  Cotizacion[]
  pedidos       Pedido[]
  empresas      Empresa[]
  contactos     Contacto[]

  @@unique([usuarioId, instanciaId])
  @@index([instanciaId])
  @@index([usuarioId])
}

// =====================
// CRM BASE
// =====================

model Empresa {
  id            String   @id @default(cuid())
  nombre        String
  ruc           String?
  industria     String?
  tamano        String?
  sitioWeb      String?
  telefono      String?
  email         String?
  notas         String?
  activo        Boolean  @default(true)
  metadata      Json?
  creadoEn      DateTime @default(now())
  actualizadoEn DateTime @updatedAt

  instanciaId String
  instancia   Instancia @relation(fields: [instanciaId], references: [id], onDelete: Cascade)

  usuarioInstanciaId String?
  usuarioInstancia   UsuarioInstancia? @relation(fields: [usuarioInstanciaId], references: [id])

  contactos     Contacto[]
  oportunidades Oportunidad[]
  actividades   Actividad[]
  cotizaciones  Cotizacion[]
  pedidos       Pedido[]
  campos        CampoPersonalizadoValor[]

  @@index([instanciaId])
  @@index([nombre])
  @@index([ruc])
  @@unique([instanciaId, ruc])
}

model Contacto {
  id            String         @id @default(cuid())
  nombre        String
  apellido      String
  email         String?
  telefono      String?
  cargo         String?
  notas         String?
  estado        EstadoContacto @default(LEAD)
  activo        Boolean        @default(true)
  metadata      Json?
  creadoEn      DateTime       @default(now())
  actualizadoEn DateTime       @updatedAt

  instanciaId String
  instancia   Instancia @relation(fields: [instanciaId], references: [id], onDelete: Cascade)

  empresaId String?
  empresa   Empresa? @relation(fields: [empresaId], references: [id])

  usuarioInstanciaId String?
  usuarioInstancia   UsuarioInstancia? @relation(fields: [usuarioInstanciaId], references: [id])

  oportunidades OportunidadContacto[]
  actividades   Actividad[]
  cotizaciones  Cotizacion[]
  pedidos       Pedido[]
  campos        CampoPersonalizadoValor[]

  @@index([instanciaId])
  @@index([nombre])
  @@index([apellido])
  @@index([email])
  @@index([telefono])
}

// =====================
// PIPELINES DINÁMICOS
// =====================

model Pipeline {
  id            String   @id @default(cuid())
  nombre        String
  descripcion   String?
  esDefault     Boolean  @default(false)
  activo        Boolean  @default(true)
  creadoEn      DateTime @default(now())
  actualizadoEn DateTime @updatedAt

  instanciaId String
  instancia   Instancia @relation(fields: [instanciaId], references: [id], onDelete: Cascade)

  stages         PipelineStage[]
  oportunidades Oportunidad[]
  campos         CampoPersonalizado[]

  @@index([instanciaId])
  @@index([esDefault])
  @@unique([instanciaId, nombre])
}

model PipelineStage {
  id            String   @id @default(cuid())
  nombre        String
  descripcion   String?
  color         String?
  orden         Int
  probabilidad  Int      @default(20)
  esInicial     Boolean  @default(false)
  esGanado      Boolean  @default(false)
  esPerdido     Boolean  @default(false)
  activo        Boolean  @default(true)
  creadoEn      DateTime @default(now())
  actualizadoEn DateTime @updatedAt

  pipelineId String
  pipeline   Pipeline @relation(fields: [pipelineId], references: [id], onDelete: Cascade)

  oportunidades Oportunidad[]

  @@unique([pipelineId, orden])
  @@index([pipelineId])
}

// =====================
// OPORTUNIDADES
// =====================

model Oportunidad {
  id            String   @id @default(cuid())
  titulo        String
  descripcion   String?
  valor         Decimal  @default(0)
  moneda        String   @default("USD")
  probabilidad  Int      @default(20)
  fechaCierre   DateTime?
  fechaGanada   DateTime?
  fechaPerdida  DateTime?
  motivoPerdida String?
  notas         String?
  metadata      Json?
  creadoEn      DateTime @default(now())
  actualizadoEn DateTime @updatedAt

  instanciaId String
  instancia   Instancia @relation(fields: [instanciaId], references: [id], onDelete: Cascade)

  pipelineId String
  pipeline   Pipeline @relation(fields: [pipelineId], references: [id])

  stageId String
  stage   PipelineStage @relation(fields: [stageId], references: [id])

  empresaId String?
  empresa   Empresa? @relation(fields: [empresaId], references: [id])

  usuarioInstanciaId String?
  usuarioInstancia   UsuarioInstancia? @relation(fields: [usuarioInstanciaId], references: [id])

  contactos    OportunidadContacto[]
  productos    OportunidadProducto[]
  actividades  Actividad[]
  cotizaciones Cotizacion[]
  pedidos      Pedido[]
  tags         OportunidadTag[]
  campos       CampoPersonalizadoValor[]

  @@index([instanciaId])
  @@index([pipelineId])
  @@index([stageId])
  @@index([empresaId])
  @@index([usuarioInstanciaId])
}

model OportunidadContacto {
  oportunidadId String
  contactoId    String
  principal     Boolean @default(false)

  oportunidad Oportunidad @relation(fields: [oportunidadId], references: [id], onDelete: Cascade)
  contacto    Contacto    @relation(fields: [contactoId], references: [id], onDelete: Cascade)

  @@id([oportunidadId, contactoId])
}

model OportunidadProducto {
  id             String  @id @default(cuid())
  descripcion    String?
  cantidad       Decimal @default(1)
  precioUnitario Decimal
  descuento      Decimal @default(0)
  subtotal       Decimal @default(0)

  oportunidadId String
  oportunidad   Oportunidad @relation(fields: [oportunidadId], references: [id], onDelete: Cascade)

  productoId String?
  producto   Producto? @relation(fields: [productoId], references: [id])
}

// =====================
// TAGS POR INSTANCIA
// =====================

model Tag {
  id        String   @id @default(cuid())
  nombre    String
  color     String?
  activo    Boolean  @default(true)
  creadoEn  DateTime @default(now())

  instanciaId String
  instancia   Instancia @relation(fields: [instanciaId], references: [id], onDelete: Cascade)

  oportunidades OportunidadTag[]

  @@unique([instanciaId, nombre])
  @@index([instanciaId])
}

model OportunidadTag {
  oportunidadId String
  tagId         String

  oportunidad Oportunidad @relation(fields: [oportunidadId], references: [id], onDelete: Cascade)
  tag          Tag         @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([oportunidadId, tagId])
}

// =====================
// CAMPOS PERSONALIZADOS
// =====================

model CampoPersonalizado {
  id            String                  @id @default(cuid())
  nombre        String
  clave         String
  descripcion   String?
  tipo          TipoCampoPersonalizado
  entidad       EntidadCampoPersonalizado
  requerido     Boolean                 @default(false)
  activo        Boolean                 @default(true)
  orden         Int                     @default(0)

  opciones      Json?
  validaciones  Json?
  valorDefault  Json?

  creadoEn      DateTime @default(now())
  actualizadoEn DateTime @updatedAt

  instanciaId String
  instancia   Instancia @relation(fields: [instanciaId], references: [id], onDelete: Cascade)

  pipelineId String?
  pipeline   Pipeline? @relation(fields: [pipelineId], references: [id], onDelete: Cascade)

  valores CampoPersonalizadoValor[]

  @@unique([instanciaId, entidad, pipelineId, clave])
  @@index([instanciaId])
  @@index([entidad])
  @@index([pipelineId])
}

model CampoPersonalizadoValor {
  id    String @id @default(cuid())
  valor Json?

  campoId String
  campo   CampoPersonalizado @relation(fields: [campoId], references: [id], onDelete: Cascade)

  oportunidadId String?
  oportunidad   Oportunidad? @relation(fields: [oportunidadId], references: [id], onDelete: Cascade)

  contactoId String?
  contacto   Contacto? @relation(fields: [contactoId], references: [id], onDelete: Cascade)

  empresaId String?
  empresa   Empresa? @relation(fields: [empresaId], references: [id], onDelete: Cascade)

  pedidoId String?
  pedido   Pedido? @relation(fields: [pedidoId], references: [id], onDelete: Cascade)

  cotizacionId String?
  cotizacion   Cotizacion? @relation(fields: [cotizacionId], references: [id], onDelete: Cascade)

  creadoEn      DateTime @default(now())
  actualizadoEn DateTime @updatedAt

  @@index([campoId])
  @@index([oportunidadId])
  @@index([contactoId])
  @@index([empresaId])
  @@index([pedidoId])
  @@index([cotizacionId])
}

model Producto {
  id            String   @id @default(cuid())
  sku           String?
  nombre        String
  descripcion   String?
  precio        Decimal  @default(0)
  moneda        String   @default("USD")
  categoria     String?
  unidad        String   @default("unidad")
  imagenUrl     String?
  activo        Boolean  @default(true)

  manejaStock        Boolean @default(false)
  cantidadDisponible Decimal @default(0)

  metadata      Json?
  creadoEn      DateTime @default(now())
  actualizadoEn DateTime @updatedAt

  instanciaId String
  instancia   Instancia @relation(fields: [instanciaId], references: [id], onDelete: Cascade)

  oportunidadLineas OportunidadProducto[]
  cotizacionLineas  CotizacionLinea[]
  pedidoLineas      PedidoLinea[]

  @@unique([instanciaId, sku])
  @@index([instanciaId])
  @@index([nombre])
  @@index([categoria])
}

// =====================
// ACTIVIDADES
// =====================

model Actividad {
  id            String        @id @default(cuid())
  tipo          TipoActividad @default(TAREA)
  titulo        String
  descripcion   String?
  fecha         DateTime
  completada    Boolean       @default(false)
  completadaEn  DateTime?
  metadata      Json?
  creadoEn      DateTime      @default(now())
  actualizadoEn DateTime      @updatedAt

  instanciaId String
  instancia   Instancia @relation(fields: [instanciaId], references: [id], onDelete: Cascade)

  contactoId String?
  contacto   Contacto? @relation(fields: [contactoId], references: [id])

  empresaId String?
  empresa   Empresa? @relation(fields: [empresaId], references: [id])

  oportunidadId String?
  oportunidad   Oportunidad? @relation(fields: [oportunidadId], references: [id])

  usuarioInstanciaId String?
  usuarioInstancia   UsuarioInstancia? @relation(fields: [usuarioInstanciaId], references: [id])

  @@index([instanciaId])
  @@index([fecha])
  @@index([completada])
}

// =====================
// COTIZACIONES
// =====================

model Cotizacion {
  id               String           @id @default(cuid())
  numero           String
  estado           EstadoCotizacion @default(BORRADOR)
  fechaEmision     DateTime         @default(now())
  fechaVencimiento DateTime?
  subtotal         Decimal          @default(0)
  descuento        Decimal          @default(0)
  impuesto         Decimal          @default(0)
  total            Decimal          @default(0)
  moneda           String           @default("USD")
  notas            String?
  metadata         Json?
  creadoEn         DateTime         @default(now())
  actualizadoEn    DateTime         @updatedAt

  instanciaId String
  instancia   Instancia @relation(fields: [instanciaId], references: [id], onDelete: Cascade)

  oportunidadId String?
  oportunidad   Oportunidad? @relation(fields: [oportunidadId], references: [id])

  contactoId String?
  contacto   Contacto? @relation(fields: [contactoId], references: [id])

  empresaId String?
  empresa   Empresa? @relation(fields: [empresaId], references: [id])

  usuarioInstanciaId String?
  usuarioInstancia   UsuarioInstancia? @relation(fields: [usuarioInstanciaId], references: [id])

  lineas  CotizacionLinea[]
  pedidos Pedido[]
  campos  CampoPersonalizadoValor[]

  @@unique([instanciaId, numero])
  @@index([instanciaId])
  @@index([estado])
  @@index([oportunidadId])
}

model CotizacionLinea {
  id             String  @id @default(cuid())
  descripcion    String?
  cantidad       Decimal
  precioUnitario Decimal
  descuento      Decimal @default(0)
  impuesto       Decimal @default(0)
  subtotal       Decimal
  total          Decimal @default(0)
  orden          Int     @default(0)
  metadata       Json?

  cotizacionId String
  cotizacion   Cotizacion @relation(fields: [cotizacionId], references: [id], onDelete: Cascade)

  productoId String?
  producto   Producto? @relation(fields: [productoId], references: [id])
}

// =====================
// PEDIDOS
// =====================

model Pedido {
  id            String       @id @default(cuid())
  numero        String
  estado        EstadoPedido @default(PENDIENTE)

  nombre        String
  apellido      String
  telefono      String
  email         String?
  ruc           String?
  empresaNombre String?

  fechaPedido   DateTime     @default(now())
  fechaEntrega  DateTime?
  subtotal      Decimal      @default(0)
  descuento     Decimal      @default(0)
  impuesto      Decimal      @default(0)
  total         Decimal      @default(0)
  moneda        String       @default("USD")
  notas         String?
  metadata      Json?
  creadoEn      DateTime     @default(now())
  actualizadoEn DateTime     @updatedAt

  instanciaId String
  instancia   Instancia @relation(fields: [instanciaId], references: [id], onDelete: Cascade)

  oportunidadId String?
  oportunidad   Oportunidad? @relation(fields: [oportunidadId], references: [id])

  cotizacionId String?
  cotizacion   Cotizacion? @relation(fields: [cotizacionId], references: [id])

  contactoId String?
  contacto   Contacto? @relation(fields: [contactoId], references: [id])

  empresaId String?
  empresa   Empresa? @relation(fields: [empresaId], references: [id])

  usuarioInstanciaId String?
  usuarioInstancia   UsuarioInstancia? @relation(fields: [usuarioInstanciaId], references: [id])

  lineas PedidoLinea[]
  campos CampoPersonalizadoValor[]

  @@unique([instanciaId, numero])
  @@index([instanciaId])
  @@index([estado])
  @@index([telefono])
  @@index([email])
}

model PedidoLinea {
  id             String  @id @default(cuid())
  descripcion    String?
  cantidad       Decimal
  precioUnitario Decimal
  descuento      Decimal @default(0)
  impuesto       Decimal @default(0)
  subtotal       Decimal
  total          Decimal @default(0)
  orden          Int     @default(0)
  metadata       Json?

  pedidoId String
  pedido   Pedido @relation(fields: [pedidoId], references: [id], onDelete: Cascade)

  productoId String?
  producto   Producto? @relation(fields: [productoId], references: [id])
}

// =====================
// EVENTOS / AUDITORÍA
// =====================

model EventoLog {
  id          String   @id @default(cuid())
  tipo        String
  payload     Json
  ocurridoEn  DateTime @default(now())
  entidadTipo String?
  entidadId   String?
  usuarioId   String?

  instanciaId String
  instancia   Instancia @relation(fields: [instanciaId], references: [id], onDelete: Cascade)

  @@index([instanciaId])
  @@index([entidadTipo, entidadId])
  @@index([tipo])
  @@index([ocurridoEn])
}
```

---

# Reglas importantes para Claude

## 1. Toda consulta debe filtrar por instancia

Toda búsqueda, creación, edición o eliminación debe estar limitada por `instanciaId`.

Ejemplo:

```ts
await prisma.oportunidad.findMany({
  where: {
    instanciaId,
  },
});
```

Nunca hacer:

```ts
await prisma.oportunidad.findMany();
```

---

## 2. El usuario puede pertenecer a varias instancias

El usuario no debe tener un solo rol global.

El rol depende de la instancia.

Ejemplo:

```txt
ramon@email.com
  ├── SupleNut: OWNER
  └── Decorstorekt: ADMIN
```

Por eso existe:

```prisma
UsuarioInstancia
```

---

## 3. Datos únicos deben ser únicos por instancia

Correcto:

```prisma
@@unique([instanciaId, numero])
@@unique([instanciaId, sku])
@@unique([instanciaId, nombre])
```

Incorrecto:

```prisma
numero String @unique
sku String @unique
nombre String @unique
```

Porque dos empresas diferentes pueden tener:

```txt
Pedido #0001
SKU MAGNESIO-001
Pipeline Ventas
```

---

## 4. Pipeline por defecto por instancia

Cada instancia debe tener su propio pipeline por defecto.

Ejemplo:

```txt
SupleNut
  └── Pipeline: Ventas SupleNut

Decorstorekt
  └── Pipeline: Ventas Decorstorekt
```

---

## 5. Campos personalizados por instancia

Los campos personalizados deben poder variar por empresa.

Ejemplo:

```txt
SupleNut:
  - Tipo de suplemento
  - Meta de salud
  - Frecuencia de consumo

Decorstorekt:
  - Tipo de decoración
  - Medidas
  - Estilo preferido
```

---

## 6. Tags por instancia

Los tags no son globales.

Ejemplo:

```txt
SupleNut:
  - Cliente frecuente
  - Compra magnesio
  - Interesado en colágeno

Decorstorekt:
  - Proyecto residencial
  - Cliente mayorista
  - Cotización pendiente
```

---

## 7. Pedido manual

El pedido puede crearse sin oportunidad y sin cotización.

Campos mínimos requeridos:

```txt
nombre
apellido
telefono
```

Campos opcionales:

```txt
email
ruc
empresaNombre
empresaId
contactoId
oportunidadId
cotizacionId
```

---

## 8. Flujo comercial recomendado

```txt
Instancia
  ↓
Pipeline
  ↓
Stage
  ↓
Oportunidad
  ↓
Cotización
  ↓
Pedido
```

También permitido:

```txt
Instancia
  ↓
Pedido manual
```

---

## 9. Recomendación técnica para NextJS

En sesión o JWT guardar:

```ts
{
  usuarioId: string;
  instanciaId: string;
  rol: "OWNER" | "ADMIN" | "AGENTE";
}
```

Y en cada acción del sistema usar siempre:

```ts
const instanciaId = session.instanciaId;
```

---

## 10. Recomendación de nombre visual

En UI puedes manejarlo así:

```txt
Instancia = Empresa activa / Workspace / Negocio
```

Ejemplo en selector:

```txt
Workspace actual: SupleNut
Cambiar a: Decorstorekt
```

---

# Objetivo final

El sistema debe permitir que una misma aplicación y una misma base de datos manejen varias empresas sin mezclar información.

La separación principal será:

```prisma
instanciaId String
```

en todas las entidades operativas.