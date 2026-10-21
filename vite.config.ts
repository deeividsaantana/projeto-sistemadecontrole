import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import arquivosOcr from './scripts/viteArquivosOcr';

type InfoModulo = {
  isEntry: boolean;
  code: string | null;
  importedIds: readonly string[];
  dynamicallyImportedIds: readonly string[];
};
type LerModulo = (id: string) => InfoModulo | null;

const INDICE_LUCIDE = /[\\/]lucide-react[\\/]dist[\\/]esm[\\/]lucide-react\.js$/;
const ARQUIVO_DE_ICONE = /[\\/]lucide-react[\\/]dist[\\/]esm[\\/]icons[\\/]([^\\/]+\.js)$/;

// Arquivos de ícone (lucide-react/dist/esm/icons/*.js) usados pelos módulos que
// partem das raízes. As telas importam do índice 'lucide-react', então o grafo
// não diz qual ícone cada uma usa: lê os nomes importados e traduz pelo índice.
const iconesUsadosA = (lerModulo: LerModulo, raizes: string[], indice: string, seguirDinamicos: boolean): Set<string> => {
  const nomes = new Set<string>();
  const vistos = new Set<string>();
  const fila = [...raizes];
  while (fila.length) {
    const id = fila.pop()!;
    if (vistos.has(id) || id.includes('node_modules')) continue;
    vistos.add(id);
    const info = lerModulo(id);
    if (!info) continue;
    for (const [, lista] of (info.code ?? '').matchAll(/import\s*\{([^}]*)\}\s*from\s*["']lucide-react["']/g)) {
      for (const parte of lista.split(',')) {
        const nome = parte.trim().split(/\s+as\s+/)[0];
        if (nome) nomes.add(nome);
      }
    }
    fila.push(...info.importedIds, ...(seguirDinamicos ? info.dynamicallyImportedIds : []));
  }
  const arquivos = new Set<string>();
  for (const [, lista, arquivo] of indice.matchAll(/export\s*\{([^}]*)\}\s*from\s*'\.\/icons\/([^']+)'/g)) {
    if (lista.split(',').some(parte => nomes.has(parte.trim().replace(/^default\s+as\s+/, '')))) arquivos.add(arquivo);
  }
  return arquivos;
};

// Ícones que não podem ir para o pedaço único das telas: os do carregamento
// inicial (entrariam todos antes do login) e os dos links públicos (o celular
// em campo baixaria os ícones do ERP inteiro).
let iconesSeparados: { inicio: Set<string>; publicos: Set<string> } | null = null;
const lerIconesSeparados = (lerModulo: LerModulo, ids: Iterable<string>) => {
  if (iconesSeparados) return iconesSeparados;
  const todos = [...ids];
  const idIndice = todos.find(id => INDICE_LUCIDE.test(id));
  const indice = (idIndice && lerModulo(idIndice)?.code) || '';
  const entradas = todos.filter(id => lerModulo(id)?.isEntry);
  const publicos = todos.filter(id => /[\\/]src[\\/]PublicLinksApp\.tsx$/.test(id));
  iconesSeparados = {
    inicio: iconesUsadosA(lerModulo, entradas, indice, false),
    publicos: iconesUsadosA(lerModulo, publicos, indice, true),
  };
  return iconesSeparados;
};

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), arquivosOcr()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // A leitura de planilha de Materiais roda num worker que carrega o ExcelJS
    // sob demanda; worker em IIFE não aceita esse carregamento dividido.
    worker: { format: 'es' },
    build: {
      target: 'es2022',
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
        },
        output: {
          manualChunks(id, { getModuleInfo, getModuleIds }) {
            // O auxiliar de preload do Vite e usado por todo import dinamico.
            // Sem chunk proprio, o Rollup o acomoda dentro de vendor-pdf, e ai
            // abrir qualquer tela passa a exigir os 412 kB do jsPDF antes.
            if (id.includes('vite/preload-helper')) return 'vendor-preload';
            if (id.includes('node_modules')) {
              // Ícones das telas do ERP num pedaço só, em vez de dezenas de
              // arquivos de 1 kB. A base que desenha os ícones e os do
              // carregamento inicial ficam num pedaço pequeno à parte (sem isso
              // o Rollup juntava tudo e os ícones de todas as telas entravam
              // antes do login); os dos links públicos, noutro pedaço pequeno.
              if (/[\\/]lucide-react[\\/]/.test(id)) {
                const icone = id.match(ARQUIVO_DE_ICONE)?.[1];
                const { inicio, publicos } = lerIconesSeparados(getModuleInfo as LerModulo, getModuleIds());
                if (!icone || inicio.has(icone)) return 'vendor-icones-base';
                return publicos.has(icone) ? 'vendor-icones-publicos' : 'vendor-icones';
              }
              if (id.includes('/@supabase/') || id.includes('\\@supabase\\')) return 'vendor-supabase';
              if (id.includes('/exceljs/') || id.includes('\\exceljs\\')) return 'vendor-excel';
              if (id.includes('/jspdf') || id.includes('\\jspdf')) return 'vendor-pdf';
              if (id.includes('/html2canvas/') || id.includes('\\html2canvas\\')) return 'vendor-canvas';
              if (id.includes('/react/') || id.includes('\\react\\') || id.includes('/react-dom/') || id.includes('\\react-dom\\')) {
                return 'vendor-react';
              }
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
        '/api': {
          target: process.env.VITE_PUBLIC_FUNCTIONS_PROXY_TARGET || 'https://renea-erp.onrender.com',
          changeOrigin: true,
          secure: true,
        },
      },
    },
  };
});
