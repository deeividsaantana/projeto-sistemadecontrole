import type { MovimentoMaterial } from '../types';
import { lerPlanilhaMateriaisAqui } from './lerPlanilhaMateriais';

self.onmessage = async (evento: MessageEvent<{ arquivo: File; movimentos: MovimentoMaterial[] }>) => {
  try {
    const leitura = await lerPlanilhaMateriaisAqui(evento.data.arquivo, evento.data.movimentos);
    self.postMessage({ ok: true, leitura });
  } catch (erro) {
    self.postMessage({ ok: false, mensagem: erro instanceof Error ? erro.message : 'Não foi possível ler a planilha selecionada.' });
  }
};
