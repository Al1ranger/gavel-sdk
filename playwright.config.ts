import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test/browser',
  use: { baseURL: 'http://127.0.0.1:3100', channel: 'msedge' },
  webServer: { command: 'node demo/server.mjs', url: 'http://127.0.0.1:3100', reuseExistingServer: true },
});
