import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/game-sfx-generator-web/' : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: resolve(rootDir, 'src/test/setup.ts'),
  },
}));