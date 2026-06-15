# Prompt refinado: Integración de Supabase Auth en Vento CRM

## Contexto

Tu prompt original asumía un diseño de tablas "desde cero" (usuarios, instancias, usuarios_instancia, roles, permisos, rol_permisos). Al explorar tu código real encontré que **la mayor parte de esa infraestructura multi-tenant ya existe** en `prisma/schema.prisma`, pero **no hay ningún sistema de autenticación implementado todavía** (NextAuth está en `package.json` pero no se usa en ningún archivo).

Estado actual relevante:
- `Instancia` (tenant): `id, nombre, slug, descripcion, dominio, logoUrl, estado (EstadoInstancia: ACTIVA|INACTIVA|SUSPENDIDA), configuracion, metadata`
- `Usuario`: `id, nombre, email (unique), passwordHash, rol (Rol: OWNER|ADMIN|AGENTE), activo, creadoEn` — **sin** `supabaseUserId`, `estado`, `intentosFallidos`, `bloqueadoHasta`, etc.
- `UsuarioInstancia`: `id, rol (Rol), activo, creadoEn, actualizadoEn, usuarioId, instanciaId` con constraint único `[usuarioId, instanciaId]`
- No existen tablas `roles`, `permisos`, `rol_permisos` — los roles son un enum directo (`OWNER|ADMIN|AGENTE`)
- ~94 archivos dependen de `instanciaId` / `UsuarioInstancia`, resueltos hoy vía `resolverInstanciaId()` en `src/shared/db/instancia.ts` (sin auth: toma la primera instancia activa o `process.env.INSTANCIA_ID`)
- No hay `middleware.ts`, no hay `.env.example`, no hay variables de Supabase configuradas

Decisiones tomadas para ajustar el alcance del prompt original a tu app real:
1. **Mantener el enum `Rol` (OWNER/ADMIN/AGENTE)** en lugar de migrar a tablas `roles/permisos/rol_permisos` — evita tocar los ~94 archivos existentes. Las tablas granulares quedan como posible fase futura.
2. **Registro por invitación de administrador** (no self-signup abierto): un OWNER/ADMIN invita por email, se crea `Usuario` en estado `INVITADO`, se envía invite vía Supabase Admin API, y el usuario completa su registro/password.
3. `passwordHash` deja de ser necesario para login (Supabase lo gestiona), pero puede conservarse como columna nullable por compatibilidad/histórico, o eliminarse — a decidir en implementación.

---

## Prompt refinado (listo para usar)

```
Actúa como arquitecto senior full-stack experto en Next.js 16 (App Router), TypeScript,
Prisma 7, PostgreSQL y Supabase Auth.

CONTEXTO DE MI APP (Vento CRM):
- CRM SaaS multiempresa construido con Next.js 16 App Router + TypeScript + Prisma 7 + PostgreSQL.
- Mi base de datos principal NO está en Supabase (PostgreSQL propio vía Prisma). Supabase
  se usará SOLO para autenticación.
- Ya tengo un esquema multi-tenant funcionando en prisma/schema.prisma:
    - model Instancia (tenant): id, nombre, slug (unique), descripcion, dominio, logoUrl,
      estado (EstadoInstancia: ACTIVA|INACTIVA|SUSPENDIDA), configuracion (Json), metadata (Json)
    - model Usuario: id, nombre, email (unique), passwordHash, rol (Rol: OWNER|ADMIN|AGENTE),
      activo, creadoEn
    - model UsuarioInstancia (tabla puente): id, rol (Rol), activo, creadoEn, actualizadoEn,
      usuarioId -> Usuario, instanciaId -> Instancia, constraint único [usuarioId, instanciaId]
    - enum Rol { OWNER ADMIN AGENTE } -- ya existe, NO crear tablas roles/permisos/rol_permisos nuevas
    - ~94 archivos en src/app, src/crm, src/conversaciones dependen de instanciaId /
      UsuarioInstancia y hoy resuelven la instancia vía resolverInstanciaId()
      (src/shared/db/instancia.ts), SIN ningún tipo de autenticación.
- Prisma se instancia como singleton en src/shared/db/prisma.ts (PrismaPg adapter).
- Actualmente NO existe middleware.ts, NO existe .env.example, NO hay ninguna variable
  de Supabase configurada, y next-auth está en package.json pero NO se usa en ningún archivo
  (se puede desinstalar).
- Convenciones del proyecto: Server Components por defecto, Server Actions en
  src/[dominio]/[entidad]/actions.ts validadas con Zod, queries en queries.ts usando el
  Prisma singleton, nombres de dominio en español (usuario, instancia, rol, etc).

OBJETIVO:
Diseñar e implementar autenticación con Supabase Auth, donde:
- Supabase Auth maneja login, password, sesión/JWT y reseteo de password.
- Toda la autorización (roles, permisos, pertenencia a instancia, estados de usuario)
  vive en mi base de datos y backend, usando el esquema EXISTENTE (Usuario,
  UsuarioInstancia, Instancia, enum Rol) más las extensiones mínimas que definamos.
- El backend valida el JWT de Supabase en cada request a recursos privados.

CAMBIOS DE ESQUEMA PROPUESTOS (extender, no reemplazar, el schema actual):
- Usuario: agregar
    - supabaseUserId String @unique
    - estado EstadoUsuario @default(INVITADO)  // nuevo enum: ACTIVO | INVITADO | SUSPENDIDO | BLOQUEADO
    - intentosFallidos Int @default(0)
    - bloqueadoHasta DateTime?
    - nivelBloqueo Int @default(0)  // 0=ninguno, 1=10min, 2=30min, 3=1 día
    - ultimoLogin DateTime?
    - passwordHash -> evaluar si se vuelve opcional/se elimina (Supabase gestiona el password)
- UsuarioInstancia, Instancia, enum Rol: SIN cambios estructurales.

FLUJO DE REGISTRO/INVITACIÓN:
- Solo invitación por administrador (OWNER/ADMIN de una Instancia):
  1. Admin invita por email desde el CRM -> se crea Usuario con estado INVITADO y
     UsuarioInstancia con el rol asignado.
  2. Backend llama a Supabase Admin API (inviteUserByEmail) usando la SERVICE_ROLE key
     (solo en backend, nunca en frontend).
  3. Usuario recibe email, define password vía Supabase, al completar se vincula
     supabaseUserId al registro existente y estado pasa a ACTIVO.

REGLAS DE BLOQUEO POR INTENTOS FALLIDOS:
- Registrar intentosFallidos en Usuario al fallar login.
- Niveles de bloqueo progresivos: 1° bloqueo = 10 min, 2° = 30 min, 3° = 1 día
  (usar nivelBloqueo + bloqueadoHasta).
- Si bloqueadoHasta expiró, permitir reintentar (resetear el contador del intento actual,
  pero conservar nivelBloqueo para el próximo bloqueo).
- Login exitoso: limpiar intentosFallidos, bloqueadoHasta y resetear nivelBloqueo a 0,
  actualizar ultimoLogin.
- Mensaje de error genérico siempre: "Credenciales inválidas o cuenta temporalmente
  bloqueada." (no revelar si el email existe).
- Esto complementa (no reemplaza) el rate limiting propio de Supabase.

VALIDACIÓN DE TOKEN Y AUTORIZACIÓN (middleware/backend guard):
1. Extraer Bearer token / cookie de sesión de Supabase.
2. Validar el JWT contra Supabase (verificar firma/expiración).
3. Buscar Usuario por supabaseUserId en mi BD.
4. Verificar Usuario.estado === ACTIVO (y que bloqueadoHasta no esté vigente).
5. Resolver instancia activa (selección de instancia, similar al patrón actual de
   resolverInstanciaId pero ahora basado en sesión real).
6. Verificar que exista UsuarioInstancia activo para ese usuario+instancia.
7. Exponer rol (UsuarioInstancia.rol) para checks de permisos por acción
   (ej: solo OWNER/ADMIN puede invitar usuarios).

ENTREGABLES ESPERADOS:
1. Diff del esquema Prisma (solo los campos/enum nuevos sobre Usuario).
2. Diseño de arquitectura: dónde vive cada pieza (middleware.ts, src/shared/auth/,
   src/[dominio]/usuarios/, etc.) respetando la estructura existente del proyecto.
3. Servicios: AuthService (login/logout/sesión), UserService (estado, bloqueos,
   invitación), InstanceService (selección/validación de instancia),
   PermissionService (checks por rol/acción usando el enum Rol existente).
4. Middleware Next.js que valida el JWT de Supabase y resuelve usuario + instancia
   + rol para Server Components/Actions (reemplazo gradual de resolverInstanciaId()).
5. Ejemplos de código: login, logout, obtener sesión actual, selección de instancia
   activa, validación de permisos por acción — siguiendo el estilo del proyecto
   (Server Actions con 'use server', Zod, revalidatePath).
6. Variables de entorno necesarias: NEXT_PUBLIC_SUPABASE_URL,
   NEXT_PUBLIC_SUPABASE_ANON_KEY (frontend), SUPABASE_SERVICE_ROLE_KEY (backend only),
   y actualizar/crear .env.example.
7. Buenas prácticas de seguridad específicas (no exponer service_role, no usar RLS de
   Supabase porque la BD está fuera de Supabase, etc.).
8. Lista concreta de archivos a crear/modificar y orden recomendado de implementación,
   indicando qué hacer con next-auth (desinstalar si no se usa).

RESTRICCIONES:
- No usar Row Level Security de Supabase (la BD principal no está en Supabase).
- No exponer SUPABASE_SERVICE_ROLE_KEY en frontend.
- Toda autorización real vive en backend/BD propia, no en Supabase.
- Mantener convenciones del proyecto: Server Components por defecto, Server Actions con
  Zod, nombres de dominio en español, sin barrel files, sin `any`.
- Código pensado para producción.
```

---

## Cómo usar esto

Este bloque de prompt está listo para pegarlo en una nueva conversación (o seguir en esta
misma) cuando quieras pasar a la fase de diseño/implementación. Como ya conoce el estado
real de tu esquema y código, las respuestas que obtengas serán directamente aplicables
sin reinterpretación.

**Siguiente paso sugerido**: cuando quieras implementar, pide primero solo el diff de
`schema.prisma` + middleware + AuthService, valida que compile y migre bien, y luego
continúa con el resto de servicios y ejemplos — para evitar un cambio masivo de una sola vez.
