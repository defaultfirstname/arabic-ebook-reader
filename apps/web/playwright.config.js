import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4180';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  use: {
    baseURL,
    browserName: 'chromium',
    viewport: { width: 960, height: 720 }
  },
  webServer: {
    command: 'pnpm preview --host 127.0.0.1 --port 4180 --strictPort',
    url: `${baseURL}/manage`
  }
});
