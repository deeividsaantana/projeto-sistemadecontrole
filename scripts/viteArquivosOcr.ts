import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Plugin } from 'vite';

/**
 * O leitor de texto das notas (tesseract.js) baixa o próprio worker, o motor
 * e o idioma em tempo de uso. Por padrão vinha de CDN de terceiros, que pode
 * cair ou ser bloqueada na rede da obra. Aqui os arquivos saem de node_modules
 * e são servidos pelo próprio app em /ocr/, com nome fixo.
 */
const exigir = createRequire(import.meta.url);
const ARQUIVOS: Record<string, string> = {
  'ocr/worker.min.js': 'tesseract.js/dist/worker.min.js',
  'ocr/tesseract-core-simd-lstm.wasm.js': 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'ocr/tesseract-core-lstm.wasm.js': 'tesseract.js-core/tesseract-core-lstm.wasm.js',
  'ocr/por.traineddata.gz': '@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz',
};

export default function arquivosOcr(): Plugin {
  return {
    name: 'renea-arquivos-ocr',
    configureServer(servidor) {
      servidor.middlewares.use((pedido, resposta, seguir) => {
        const caminho = (pedido.url || '').split('?')[0].replace(/^\//, '');
        const origem = ARQUIVOS[caminho];
        if (!origem) { seguir(); return; }
        resposta.setHeader('Content-Type', caminho.endsWith('.gz') ? 'application/gzip' : 'text/javascript');
        resposta.end(readFileSync(exigir.resolve(origem)));
      });
    },
    generateBundle() {
      for (const [fileName, origem] of Object.entries(ARQUIVOS)) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(exigir.resolve(origem)) });
      }
    },
  };
}
