import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      target: 'es2022',
      rollupOptions: {
        output: {
          manualChunks(id) {
            // O auxiliar de preload do Vite e usado por todo import dinamico.
            // Sem chunk proprio, o Rollup o acomoda dentro de vendor-pdf, e ai
            // abrir qualquer tela passa a exigir os 412 kB do jsPDF antes.
            if (id.includes('vite/preload-helper')) return 'vendor-preload';
            if (id.includes('node_modules')) {
              if (id.includes('/firebase/') || id.includes('\\firebase\\')) {
                if (id.includes('/storage/') || id.includes('\\storage\\')) return 'vendor-firebase-storage';
                return 'vendor-firebase';
              }
              if (id.includes('/exceljs/') || id.includes('\\exceljs\\')) return 'vendor-excel';
              if (id.includes('/jspdf') || id.includes('\\jspdf')) return 'vendor-pdf';
              if (id.includes('/html2canvas/') || id.includes('\\html2canvas\\')) return 'vendor-canvas';
              if (id.includes('/react/') || id.includes('\\react\\') || id.includes('/react-dom/') || id.includes('\\react-dom\\')) {
                return 'vendor-react';
              }
            }
            if (id.includes('/src/utils/importedAugust2026Seed') || id.includes('\\src\\utils\\importedAugust2026Seed')) {
              return 'seed-august-2026';
            }
            if (id.includes('/src/utils/importedSpreadsheetSeed') || id.includes('\\src\\utils\\importedSpreadsheetSeed')) {
              return 'seed-spreadsheet';
            }
            if (id.includes('/src/utils/initialMateriaisData') || id.includes('\\src\\utils\\initialMateriaisData')) {
              return 'seed-materiais';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // No localhost, encaminha apenas as funções públicas para o backend já publicado.
      // Isso permite testar o link pelo celular sem fazer um novo deploy.
      proxy: {
        '/.netlify/functions': {
          target: process.env.VITE_PUBLIC_FUNCTIONS_PROXY_TARGET || 'https://reneaerp.netlify.app',
          changeOrigin: true,
          secure: true,
        },
      },
    },
  };
});
