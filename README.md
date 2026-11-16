# Karia CRM

CRM multitenancy con módulo de ventas, conversaciones omnicanal (WhatsApp, Instagram) y pipeline Kanban.

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router) |
| Lenguaje | TypeScript 5 |
| Base de datos | PostgreSQL + Prisma 7 |
| UI | Tailwind CSS v4 + shadcn/ui |
| Auth | Supabase Auth |
| Bus de eventos | RabbitMQ (amqplib) |
| Storage | Cloudflare R2 / S3 |
| Email | Resend / SendGrid / SMTP |

---

## Prerrequisitos

- Node.js >= 20.19.0
- PostgreSQL 14+
- RabbitMQ 3.x (ver sección de inicio)
- Cuenta Supabase (solo auth)

---

## Variables de entorno

Copia `.env.example` a `.env.local` y completa los valores:

```env
# ─── Base de datos ────────────────────────────────────────────────────────────
DATABASE_URL="postgresql://usuario:password@localhost:5432/crm_sales_smart_dev"

# ─── Supabase Auth (solo autenticación) ──────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_..."
SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."   # Solo backend — nunca exponer al frontend

# ─── RabbitMQ ────────────────────────────────────────────────────────────────
RABBITMQ_URL="amqp://guest:guest@localhost:5672"

# ─── URL pública de la app (para media y webhooks) ───────────────────────────
APP_URL="https://tu-dominio.com"            # producción
STORAGE_URL="https://tu-dominio.com"        # URL base para resolver URLs de media
                                             # en dev: http://localhost:3000

# ─── Storage (Cloudflare R2 o S3 compatible) ──────────────────────────────────
STORAGE_PROVIDER="r2"                        # r2 | s3 | local
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="vento-media"
R2_PUBLIC_URL="https://pub-xxxx.r2.dev"

# ─── Email transaccional ─────────────────────────────────────────────────────
EMAIL_PROVIDER="resend"                      # resend | sendgrid | smtp | console
EMAIL_FROM="Karia CRM <noreply@tudominio.com>"
RESEND_API_KEY="re_..."

# ─── Webhooks Meta (WhatsApp / Instagram vía Facebook Login — flujo heredado) ─
WEBHOOK_VERIFY_TOKEN="token-secreto-para-meta"
META_APP_ID="..."
META_APP_SECRET="..."

# ─── Instagram Login (Business Login for Instagram) ──────────────────────────
# App aparte en Meta for Developers, tipo "Instagram" — NO reutiliza
# META_APP_ID/META_APP_SECRET, que pertenecen a la app de Facebook Login.
# Ver docs/instagram-login.md (o la sección "Instagram" de este README) para
# el detalle de configuración en Meta Developers.
META_INSTAGRAM_APP_ID="..."
META_INSTAGRAM_APP_SECRET="..."
# Opcional — solo si el redirect_uri registrado en Meta difiere de
# `${APP_URL}/api/integraciones/instagram/login/callback`
META_INSTAGRAM_REDIRECT_URI=""
# Opcional — solo si se configuró un hub.verify_token distinto al de
# WEBHOOK_VERIFY_TOKEN para el webhook de esta app en Meta Developers.
# Si no se define, el webhook de Instagram acepta WEBHOOK_VERIFY_TOKEN igual
# que antes (recomendado: usar el mismo valor en ambas apps de Meta).
META_INSTAGRAM_VERIFY_TOKEN=""

# ─── WhatsApp Lite (Baileys) ──────────────────────────────────────────────────
WA_AUTH_PATH="./data/wa-sessions"            # ruta donde se guardan las sesiones WA

# ─── Documentación del agente IA (OpenAI File Search) ────────────────────────
# Los archivos que el negocio sube para su agente se indexan en un vector store
# de OpenAI y el agente los consulta con `buscar_en_documentacion`.
#
# OJO: esta key es de la cuenta OpenAI de KARIA, no del ProveedorIA de cada
# instancia. Es a propósito: así la funcionalidad anda para toda cuenta, aunque
# su agente corra sobre Anthropic o DeepSeek y no tenga key de OpenAI.
#
# Cada instancia tiene su PROPIO vector store dentro de esa organización, creado
# solo la primera vez que la cuenta sube un documento. No hay nada que
# pre-crear ni ningún id que configurar acá.
# Ver docs/documentacion-agente-aislamiento.md.
#
# Sin la key, la funcionalidad queda apagada: la herramienta no se le ofrece al
# agente y la UI explica el motivo en vez de ofrecer una carga que fallaría.
OPENAI_DOCUMENTACION_API_KEY="sk-..."
OPENAI_DOCUMENTACION_MODELO="gpt-6-luna"   # modelo que sintetiza la respuesta de búsqueda
# Tarifas para el costo estimado de UsoIA. NO afectan el conteo de tokens, que
# sale siempre del `usage` real de OpenAI. Sin ellas el costo queda vacío, que
# es preferible a registrar un número incorrecto.
#
# ⚠️ El valor es POR CADA 1.000 TOKENS, y OpenAI publica sus precios por cada
# 1.000.000. Hay que dividir por 1.000, o el costo registrado queda inflado
# 1000x. Valores al 2026-11 (short context):
#
#   modelo          por 1M in / out     POR MIL  →  INPUT    / OUTPUT
#   gpt-6-luna      $0,10  / $0,50               0.0001   / 0.0005
#   gpt-5.4-mini    $0,75  / $4,50               0.00075  / 0.0045
#   gpt-6.1-sol     $2,00  / $10,00              0.002    / 0.01
#   gpt-6-astra     $10,00 / $50,00              0.01     / 0.05
#
# Nota: a esto el sistema le suma USD 0,0025 por llamada (tarifa de file search
# de OpenAI, ya hardcodeada). Para los modelos baratos esa tarifa pesa MÁS que
# los tokens, así que el modelo se elige por calidad, no por costo.
OPENAI_DOCUMENTACION_COSTO_INPUT_POR_MIL="0.0001"
OPENAI_DOCUMENTACION_COSTO_OUTPUT_POR_MIL="0.0005"

# ─── Cifrado de credenciales de canal ─────────────────────────────────────────
# Cifra en reposo los tokens y contraseñas que el negocio guarda en sus canales
# (access token de Instagram/Messenger, contraseñas IMAP/SMTP del buzón de
# correo). 32 bytes en base64: generar con `openssl rand -base64 32`.
#
# DEBE estar definida TAMBIÉN en el worker: es quien descifra para leer buzones
# y enviar mensajes. Sin ella, conectar un canal falla a propósito.
TOKENS_CIFRADO_KEY="..."

# ─── Canal de correo electrónico (IMAP/SMTP) ─────────────────────────────────
# No lleva variables propias: las credenciales de cada buzón las carga el
# negocio desde Integraciones → Correo electrónico y se guardan cifradas con
# TOKENS_CIFRADO_KEY.
#
# Sí tiene dos requisitos de entorno:
#   1. El WORKER es quien lee los buzones (la app Next.js no lee ninguno), así
#      que necesita salida de red a los puertos IMAP y SMTP de los proveedores
#      de correo de los clientes: 993/143 y 465/587.
#   2. TOKENS_CIFRADO_KEY definida en el worker, igual que en la app.
#
# No confundir con el "Email transaccional" de más arriba (Resend): ese manda
# los correos que Karia le escribe al usuario del CRM. Este es el canal de
# atención con el cliente final. Ver src/integraciones/email/.
```

---

## Instalación

```bash
npm install

# Crear tablas en la base de datos
npx prisma db push

# Si es la primera vez (sin data)
npx prisma migrate deploy

# (Opcional) Poblar con datos de prueba
npm run db:seed
```

---

## Modos de inicio

### Modo desarrollo — Sin RabbitMQ (mock / UI solamente)

Útil para trabajar en UI, formularios y lógica CRM sin necesitar RabbitMQ.  
Los eventos de mensajería y SSE **no funcionarán** en este modo.

```bash
npm run dev
```

El servidor arranca en `http://localhost:3000`.

---

### Modo desarrollo — Con RabbitMQ completo

Para trabajar con conversaciones (WhatsApp / Instagram), SSE en tiempo real y procesamiento de mensajes.

**1. Levantar RabbitMQ con Docker:**

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

Esto descarga la imagen la primera vez (~200 MB) y arranca el contenedor. En cuanto el puerto 5672 esté disponible, el worker se conecta automáticamente y verás:

```
[RabbitMQ] Conectado
[EnviarMensajeSuscriptor] Suscrito → crm.comando.mensaje.enviar
...
[Suscriptores] Todos activos
```

> Las próximas veces que reinicies tu máquina el contenedor ya existe — solo ejecuta `docker start rabbitmq`.

Management UI disponible en `http://localhost:15672` (usuario: `guest`, contraseña: `guest`) — aquí puedes ver las queues, mensajes pendientes y dead-letters.

**2. Iniciar Next.js + Worker en paralelo:**

```bash
npm run dev:full
```

Este comando usa `concurrently` para ejecutar simultáneamente:
- `next dev` — Next.js con `SSERelaySuscriptor` (retransmite eventos RabbitMQ → browser SSE)
- `tsx src/worker/disparadores.ts` — Worker standalone con todos los suscriptores activos

**O bien, en terminales separadas:**

```bash
# Terminal 1 — Next.js
npm run dev

# Terminal 2 — Worker
npm run dev:worker
```

#### Qué hace cada proceso

| Proceso | Script | Responsabilidad |
|---------|--------|-----------------|
| Next.js | `npm run dev` | App web + `SSERelaySuscriptor` (RabbitMQ → browser) |
| Worker | `npm run dev:worker` | 7 suscriptores RabbitMQ + polling disparadores pipeline |

#### Suscriptores activos en el Worker

| Queue RabbitMQ | Suscriptor | Función |
|----------------|-----------|---------|
| `crm.comando.mensaje.enviar` | `EnviarMensajeSuscriptor` | Envía mensajes por WhatsApp / Instagram |
| `crm.comando.mensaje.entrante` | `ProcesarEntranteSuscriptor` | Procesa mensajes entrantes y crea conversaciones |
| `crm.comando.mensaje.leido` | `MarcarLeidoSuscriptor` | Marca mensajes como leídos en el canal |
| `crm.comando.email` | `EnviarEmailSuscriptor` | Envía emails transaccionales |
| `crm.comando.sistema` | `InicializarInstanciaSuscriptor` | Inicializa pipeline y config de nuevas instancias |
| `crm.pedido.historial` | `PedidoCreadoSuscriptor` | Registra historial al crear pedidos |
| `crm.pedido.historial` | `PedidoActualizadoSuscriptor` | Registra historial al actualizar pedidos |

El `SSERelaySuscriptor` corre dentro de Next.js y escucha la queue `crm.sse` para reenviar eventos al browser en tiempo real.

---

### Modo producción

```bash
# Build
npm run build

# Iniciar Next.js
npm start

# Iniciar Worker (en un proceso separado — PM2, systemd, contenedor, etc.)
node -r dotenv/config dist-worker/disparadores.js
# o con tsx en producción:
npx tsx src/worker/disparadores.ts
```

> En producción asegúrate de tener RabbitMQ disponible y `RABBITMQ_URL` apuntando a tu instancia.  
> El worker y Next.js deben correr como procesos separados y reconectarán automáticamente si RabbitMQ se reinicia (backoff exponencial: 1s → 2s → 4s → 8s → 16s → 30s).

---

## Comandos útiles

```bash
# Base de datos
npm run db:migrate        # Ejecutar migraciones Prisma (dev)
npm run db:seed           # Poblar datos de prueba
npm run db:studio         # Abrir Prisma Studio (UI para explorar BD)

# Desarrollo
npm run dev               # Solo Next.js
npm run dev:worker        # Solo Worker
npm run dev:full          # Ambos en paralelo
npm run dev:mock          # Next.js con mock de Prisma (sin BD real)

# Scripts de utilidad
npm run script:cleanup              # Limpiar datos de la BD (conserva configuración)
npm run script:crear-primer-usuario # Crear primer usuario administrador
npm run script:reparar-pipeline     # Reparar oportunidades sin pipeline asignado
```

---

## Arquitectura de eventos

```
Next.js                              Worker standalone
───────────────────────────────      ──────────────────────────────────
actions.ts                           disparadores.ts
  └─ publicadorEventos                 └─ registrarTodosSuscriptores()
       └─ RabbitMQ Exchange               └─ 7 suscriptores activos
            crm.x (topic)            + polling DisparadorJob cada 10s
                 │
     ┌───────────┼────────────┐
     ▼           ▼            ▼
  crm.sse   crm.pedido.*  crm.comando.*
     │
     └─ SSERelaySuscriptor (Next.js)
          └─ manejadorSSE.emitir()
               └─ Browser SSE
```

**Flujo de un mensaje entrante (WhatsApp / Instagram):**

```
Webhook → POST /api/webhooks/[canal]
  → publicadorEventos.publicar(PROCESAR_ENTRANTE, ...)
  → RabbitMQ queue: crm.comando.mensaje.entrante
  → [Worker] ProcesarEntranteSuscriptor
  → procesarMensajeEntrante() → guarda en BD
  → publicadorEventos.publicar(MENSAJE_RECIBIDO, ...)
  → RabbitMQ queue: crm.sse
  → [Next.js] SSERelaySuscriptor
  → manejadorSSE.emitir() → Browser
```

---

## Estructura del proyecto

```
src/
├── app/                    # Next.js App Router (páginas y layouts)
│   ├── crm/               # Módulo CRM (contactos, empresas, oportunidades, pipeline)
│   ├── sales/             # Módulo Ventas (cotizaciones, pedidos)
│   └── productos/         # Catálogo de productos
├── crm/                   # Lógica de dominio CRM
│   └── [entidad]/
│       ├── actions.ts     # Server Actions (mutations)
│       ├── queries.ts     # Queries Prisma
│       ├── schema.ts      # Esquemas Zod
│       └── components/    # Componentes del módulo
├── sales/                 # Lógica de dominio Ventas
├── suscriptores/          # Suscriptores RabbitMQ (lógica del worker)
│   ├── registrar.ts       # registrarTodosSuscriptores()
│   ├── mensajes/          # Envío, recepción y lectura de mensajes
│   ├── email/             # Envío de emails transaccionales
│   ├── sistema/           # Inicialización de instancias
│   ├── pedidos/           # Historial de pedidos
│   └── sse/               # Relay SSE (corre en Next.js)
├── shared/
│   ├── rabbitmq/          # Infraestructura RabbitMQ (conexión, publicador, consumidor)
│   ├── eventos/           # Tipos de eventos y registro
│   └── db/                # Instancia Prisma compartida
├── worker/
│   └── disparadores.ts    # Entry point del worker standalone
└── integraciones/
    └── whatsapp-lite/     # Integración WhatsApp vía Baileys
```
