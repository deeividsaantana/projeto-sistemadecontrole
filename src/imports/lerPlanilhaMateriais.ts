import type { MovimentoMaterial } from '../types';
import type { ImportPreview } from './types';
import { readWorkbookFile, type WorkbookTruncatedSheet } from './workbookReader';
import { runImportPipeline } from './runImportPipeline';

export interface LeituraMateriais {
  preview: ImportPreview<unknown>;
  truncatedSheets?: readonly WorkbookTruncatedSheet[];
}

/** Lê a planilha e classifica as linhas; roda no worker ou, sem ele, aqui. */
export const lerPlanilhaMateriaisAqui = async (arquivo: File, movimentos: readonly MovimentoMaterial[]): Promise<LeituraMateriais> => {
  const workbook = await readWorkbookFile(arquivo);
  const preview = runImportPipeline(workbook, domain =>
    domain === 'materials-receipts' || domain === 'materials-movements' ? movimentos : undefined);
  return { preview, truncatedSheets: workbook.truncatedSheets };
};

/**
 * Abrir a planilha de agregados (11 mil viagens) leva vários segundos de
 * ExcelJS. Na tela principal isso congelava o navegador a ponto de parecer
 * travado; no worker a tela segue respondendo enquanto lê.
 */
export const lerPlanilhaMateriais = (arquivo: File, movimentos: readonly MovimentoMaterial[]): Promise<LeituraMateriais> => {
  if (typeof Worker === 'undefined') return lerPlanilhaMateriaisAqui(arquivo, movimentos);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./lerPlanilhaMateriais.worker.ts', import.meta.url), { type: 'module' });
    const encerrar = () => worker.terminate();
    worker.onmessage = (evento: MessageEvent<{ ok: true; leitura: LeituraMateriais } | { ok: false; mensagem: string }>) => {
      encerrar();
      const resposta = evento.data;
      if (resposta.ok === true) resolve(resposta.leitura);
      else reject(new Error(resposta.mensagem));
    };
    worker.onerror = () => {
      // Navegador que não carrega o worker ainda consegue ler, só mais devagar.
      encerrar();
      lerPlanilhaMateriaisAqui(arquivo, movimentos).then(resolve, reject);
    };
    worker.postMessage({ arquivo, movimentos });
  });
};
