import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(import.meta.dirname),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^\.\.\/services\/masterDataApi$/, replacement: path.resolve(import.meta.dirname, 'masterDataApiStub.ts') },
    ],
  },
  server: { port: 4300, host: '0.0.0.0' },
});
