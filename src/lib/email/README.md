# Sistema de Emails Transaccionales

Sistema de envío asíncrono de emails del sistema usando la base de datos como cola de jobs y un worker que procesa los envíos con el proveedor configurado.

## Flujo de funcionamiento

```
Server Action
    │
    ▼
encolarEmail()           ← inserta JobEmail con estado PENDIENTE
    │
    ▼
JobEmail (PostgreSQL)    ← almacenamiento persistente de la cola
    │
    ▼ (cada 5 segundos)
WorkerEmail              ← SELECT FOR UPDATE SKIP LOCKED → PROCESANDO
    │
    ├─ renderTemplate()  ← genera subject + html + text desde TypeScript
    │
    └─ IEmailProvider.enviar()
            │
            ▼
        ResendProvider   ← HTTP POST a api.resend.com
            │
            ▼
        JobEmail.estado = COMPLETADO (o FALLIDO tras maxIntentos reintentos)
```

## Variables de entorno requeridas

| Variable         | Descripción                                      | Ejemplo                             |
|------------------|--------------------------------------------------|-------------------------------------|
| `EMAIL_PROVIDER` | Proveedor activo                                 | `resend`                            |
| `EMAIL_FROM`     | Dirección "from" por defecto para todos los envíos | `Vento CRM <noreply@tudominio.com>` |
| `RESEND_API_KEY` | API Key de Resend (solo si `EMAIL_PROVIDER=resend`) | `re_xxxxxxxxxxxxxxxxxxxx`           |

## Uso desde una server action

```typescript
import { encolarEmail } from "@/lib/email"

// En una server action (el archivo ya tiene "use server"):
await encolarEmail(
  { tipo: "BIENVENIDA", data: { nombreUsuario: "Juan", email: "juan@ejemplo.com", urlLogin: "https://app.tudominio.com" } },
  { destinatario: "juan@ejemplo.com" }
)

// Email de notificación vinculado a una instancia:
await encolarEmail(
  { tipo: "NOTIFICACION", data: { titulo: "Oportunidad ganada", cuerpo: "La oportunidad XYZ fue marcada como ganada." } },
  { destinatario: "gerente@empresa.com", instanciaId: sesion.instanciaId }
)
```

## Agregar una nueva plantilla de email

1. **Agregar el tipo al enum** en `prisma/schema.prisma`:
   ```prisma
   enum TipoJobEmail {
     BIENVENIDA
     NOTIFICACION
     RESET_PASSWORD   // ← nuevo
   }
   ```
   Luego ejecutar `npx prisma migrate dev --name add_tipo_reset_password`.

2. **Agregar el payload** en [templates/types.ts](./templates/types.ts):
   ```typescript
   export interface PayloadResetPassword {
     nombreUsuario: string
     urlReset: string
     expiraEn: string
   }

   export type TemplatePayload =
     | { tipo: "BIENVENIDA";      data: PayloadBienvenida }
     | { tipo: "NOTIFICACION";    data: PayloadNotificacion }
     | { tipo: "RESET_PASSWORD";  data: PayloadResetPassword }  // ← nuevo
   ```

3. **Crear la función de render** en `templates/reset-password.template.ts`:
   ```typescript
   export function renderResetPassword(data: PayloadResetPassword): EmailTemplate { ... }
   ```

4. **Agregar el case** en [templates/index.ts](./templates/index.ts):
   ```typescript
   case "RESET_PASSWORD":
     return renderResetPassword(input.data)
   ```
   Si olvidás este paso, TypeScript reportará un error de compilación en el bloque `default: { const _never: never = input }`.

## Agregar un nuevo proveedor de email

1. **Crear la implementación** en `providers/nuevo.provider.ts` implementando `IEmailProvider`:
   ```typescript
   export class NuevoProvider implements IEmailProvider {
     readonly nombre = "sendgrid" as const
     async enviar(params: EnviarEmailParams): Promise<EnviarEmailResult> { ... }
   }
   ```

2. **Registrar en el factory** [providers/factory.ts](./providers/factory.ts):
   ```typescript
   case "sendgrid":
     _instance = new NuevoProvider()
     break
   ```

3. **Actualizar el tipo** `EmailProveedor` en [types.ts](./types.ts):
   ```typescript
   export type EmailProveedor = "resend" | "sendgrid" | "smtp" | "console"
   ```

4. Cambiar `EMAIL_PROVIDER=sendgrid` en `.env`.

## Desarrollo local sin API key real

Agrega un `ConsoleEmailProvider` en `providers/console.provider.ts`:

```typescript
export class ConsoleEmailProvider implements IEmailProvider {
  readonly nombre = "console" as const
  async enviar(params: EnviarEmailParams): Promise<EnviarEmailResult> {
    console.log("[ConsoleEmailProvider] EMAIL:", JSON.stringify(params, null, 2))
    return { idExterno: `console-${Date.now()}` }
  }
}
```

Registrarlo en `factory.ts` y configurar `EMAIL_PROVIDER=console` en `.env.local`.

## Estructura de archivos

```
src/lib/email/
├── README.md                 ← este archivo
├── index.ts                  ← exports públicos
├── config.ts                 ← lectura de env vars (EMAIL_PROVIDER, EMAIL_FROM, RESEND_API_KEY)
├── types.ts                  ← interfaz IEmailProvider
├── encolar-email.ts          ← encolarEmail() — única API de escritura
├── providers/
│   ├── resend.provider.ts    ← implementación Resend
│   └── factory.ts            ← singleton factory, selecciona proveedor por env var
└── templates/
    ├── types.ts              ← TemplatePayload union + interfaces por plantilla
    ├── bienvenida.template.ts
    ├── notificacion.template.ts
    └── index.ts              ← renderTemplate() con exhaustividad TypeScript

src/shared/workers/
└── worker-email.ts           ← worker que procesa JobEmail (SELECT FOR UPDATE SKIP LOCKED)
```
