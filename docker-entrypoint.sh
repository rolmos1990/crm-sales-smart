#!/bin/sh
set -e

# /app/data (sesiones de WhatsApp Lite, wa-sessions/<uuid>) es un volumen
# persistente montado por Coolify en runtime, fuera de este repo — llega con
# el dueño por defecto del host (normalmente root), sin relación con el
# usuario no-root `nextjs` (uid 1001) que corre la app. Sin este paso,
# fs.mkdirSync sobre una subcarpeta NUEVA de wa-sessions (sesion-manager.ts)
# falla con EACCES — los números ya conectados no lo sufren porque su carpeta
# ya existe y el flujo de reconexión solo hace fs.existsSync, nunca mkdir.
mkdir -p /app/data/wa-sessions
chown -R nextjs:nodejs /app/data

exec su-exec nextjs "$@"
