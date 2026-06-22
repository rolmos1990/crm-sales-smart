import { test as base, Page } from '@playwright/test';
import * as path from 'path';

const AUTH_DIR = path.join(process.cwd(), '.auth');

export const authFile = {
  owner: path.join(AUTH_DIR, 'owner.json'),
  admin: path.join(AUTH_DIR, 'admin.json'),
  agenteVentas: path.join(AUTH_DIR, 'agente_ventas.json'),
  ejecutivoVentas: path.join(AUTH_DIR, 'ejecutivo_ventas.json'),
  supervisor: path.join(AUTH_DIR, 'supervisor.json'),
  agenteSoporte: path.join(AUTH_DIR, 'agente_soporte.json'),
  invitado: path.join(AUTH_DIR, 'invitado.json'),
};

export { test, expect } from '@playwright/test';
