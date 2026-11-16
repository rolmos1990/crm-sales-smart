# Contrato: configuración del buzón

**Feature**: 034-canal-correo-electronico

Forma exacta de `CuentaCanal.configuracion` cuando `canal = "email"`, y el esquema que la valida. Vive en
`src/integraciones/email/configuracion.ts` y `src/integraciones/email/schema.ts`.

## 1. Forma almacenada (servidor)

```ts
export type SeguridadCorreo = "SSL_TLS" | "STARTTLS" | "NINGUNA";
export type AgrupacionCorreo = "POR_REMITENTE" | "POR_HILO";

export interface ConexionCorreoAlmacenada {
  servidor: string;
  puerto: number;
  seguridad: SeguridadCorreo;
  usuario: string;
  /** Resultado de cifrarToken(). Nunca el valor plano. Nunca sale al cliente. */
  passwordCifrada: string;
}

export interface ConfiguracionBuzonAlmacenada {
  entrada: ConexionCorreoAlmacenada;
  salida: ConexionCorreoAlmacenada & { nombreRemitente?: string };
  recepcion: {
    agrupacion: AgrupacionCorreo;
    crearContactosAutomaticamente: boolean;
  };
}
```

## 2. Forma que ve el cliente

El navegador **nunca** recibe `passwordCifrada` ni nada derivado de ella.

```ts
export interface BuzonParaCliente {
  id: string;
  nombre: string;
  direccion: string;                 // CuentaCanal.identificador
  activa: boolean;
  entrada:  { servidor: string; puerto: number; seguridad: SeguridadCorreo; usuario: string };
  salida:   { servidor: string; puerto: number; seguridad: SeguridadCorreo; usuario: string;
              nombreRemitente?: string };
  tieneCredenciales: boolean;        // único rastro de la contraseña
  recepcion: { agrupacion: AgrupacionCorreo; crearContactosAutomaticamente: boolean };
  pipelineId: string | null;
  stageId: string | null;
  stageIdRespuestaAutomatica: string | null;
  estado: {
    ultimaLecturaOkEn: Date | null;
    errorCodigo: CodigoErrorCorreo | null;
    errorMensaje: string | null;     // ya traducido, apto para pantalla
  };
}
```

`queries.ts` construye este objeto; no existe ningún camino que devuelva la configuración cruda.

## 3. Esquema de validación (Zod)

```ts
const SchemaConexion = z.object({
  servidor:  z.string().min(1).max(255),
  puerto:    z.number().int().min(1).max(65535),
  seguridad: z.enum(["SSL_TLS", "STARTTLS", "NINGUNA"]),
  usuario:   z.string().min(1).max(320),
  password:  z.string().min(1).max(512).optional(),  // opcional al editar: vacío = conservar
});

export const SchemaBuzonCorreo = z.object({
  nombre:    z.string().min(1).max(60),
  direccion: z.string().email().max(320).transform((v) => v.trim().toLowerCase()),
  entrada:   SchemaConexion,
  salida:    SchemaConexion.extend({ nombreRemitente: z.string().max(120).optional() }),
  recepcion: z.object({
    agrupacion: z.enum(["POR_REMITENTE", "POR_HILO"]).default("POR_REMITENTE"),
    crearContactosAutomaticamente: z.boolean().default(true),
  }),
  pipelineId: z.string().cuid().nullable().optional(),
  stageId:    z.string().cuid().nullable().optional(),
});
```

Al **crear**, `password` es obligatoria en ambas conexiones (se refina con `superRefine`). Al **editar**,
ausente o vacía significa "dejar la que ya está".

## 4. Puertos sugeridos por tipo de seguridad

Solo como ayuda en el formulario; el usuario puede cambiarlos.

| Seguridad | Entrada (IMAP) | Salida (SMTP) |
|---|---|---|
| `SSL_TLS` | 993 | 465 |
| `STARTTLS` | 143 | 587 |
| `NINGUNA` | 143 | 25 |

## 5. Reglas no negociables

1. `passwordCifrada` se produce **solo** con `cifrarToken` y se consume **solo** con `descifrarToken`, en
   el servidor.
2. Ninguna Server Action devuelve la configuración almacenada: siempre `BuzonParaCliente`.
3. Ni las contraseñas ni los cuerpos de correo aparecen en `console.log`. Lo que se loguea de un correo es
   su `Message-ID`, su tamaño y, si se descartó, el motivo.
