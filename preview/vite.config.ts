import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(import.meta.dirname),
  // As variaveis VITE_ ficam na raiz do projeto, nao em preview/.
  envDir: path.resolve(import.meta.dirname, '..'),
  plugins: [react(), tailwindcss()],
  resolve: {
    // O root e preview/, entao o Vite pode resolver duas copias de React e
    // quebrar qualquer hook. Dedupe amarra tudo na copia do projeto.
    dedupe: ['react', 'react-dom', '@gsap/react', 'gsap'],
    alias: [
      { find: /^\.\.\/services\/masterDataApi$/, replacement: path.resolve(import.meta.dirname, 'masterDataApiStub.ts') },
    ],
  },
  server: { port: 4300, host: '0.0.0.0' },
});
