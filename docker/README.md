# Docker — Base de datos local

PostgreSQL 16 para desarrollo local de **CRM Sales Smart**.

---

## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y corriendo

---

## Comandos

### Levantar la base de datos

```bash
cd docker
docker compose up -d
```

> El flag `-d` corre el contenedor en background. La primera vez descarga la imagen de PostgreSQL (~80 MB).

---

### Verificar que está corriendo

```bash
docker compose ps
```

Deberías ver el contenedor `crm_sales_smart_db` con estado `healthy`.

---

### Ver los logs en tiempo real

```bash
docker compose logs -f postgres
```

Útil para confirmar que el servidor arrancó sin errores. Salir con `Ctrl + C`.

---

### Conectarse a la base de datos (psql interactivo)

```bash
docker compose exec postgres psql -U usuario -d crm_sales_smart
```

---

### Bajar el contenedor (datos persistidos)

```bash
docker compose down
```

Los datos quedan guardados en el volumen `crm_sales_smart_postgres_data`. Al volver a hacer `up -d` el estado se restaura.

---

### Bajar el contenedor y borrar todos los datos

```bash
docker compose down -v
```

> **Destructivo** — elimina el volumen con toda la data. Útil para reset completo.

---

### Reiniciar el contenedor

```bash
docker compose restart postgres
```

---

## Flujo completo de primera vez

```bash
# 1. Levantar postgres
cd docker
docker compose up -d

# 2. Esperar a que esté healthy (~5 segundos)
docker compose ps

# 3. Volver a la raíz del proyecto y correr migraciones
cd ..
npm run db:migrate

# 4. Poblar con datos de prueba
npm run db:seed

# 5. (Opcional) Abrir Prisma Studio para explorar los datos
npm run db:studio
```

---

## Cadena de conexión

```
postgresql://usuario:password@localhost:5432/crm_sales_smart?schema=public
```

Esta URL ya está configurada en `.env.local` y `.env` del proyecto.

---

## Puertos

| Servicio  | Puerto local | Puerto contenedor |
|-----------|-------------|-------------------|
| PostgreSQL | `5432`      | `5432`            |

Si el puerto `5432` ya está en uso, cambia el mapeo en `docker-compose.yml`:

```yaml
ports:
  - "5433:5432"   # usa el puerto 5433 localmente
```

Y actualiza `DATABASE_URL` en `.env.local` con el nuevo puerto.
