import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export default defineConfig({
  globalSetup: './tests/setup/global-setup.ts',
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    // Proyecto de setup: hace login con cada rol y guarda storageState
    {
      name: 'setup',
      testDir: './tests/setup',
      testMatch: /auth\.setup\.ts/,
      timeout: 60000,
      use: { ...devices['Desktop Chrome'] },
    },

    // Tests de autenticación (no requieren sesión previa)
    {
      name: 'auth',
      testMatch: /auth\/autenticacion\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // Todos los demás tests (dependen del setup de auth)
    {
      name: 'chromium',
      testIgnore: [/auth\/autenticacion\.spec\.ts/, /setup\//],
      use: {
        ...devices['Desktop Chrome'],
        // Por defecto usa el storageState del owner (acceso total)
        storageState: '.auth/owner.json',
      },
      dependencies: ['setup'],
    },
  ],
});
