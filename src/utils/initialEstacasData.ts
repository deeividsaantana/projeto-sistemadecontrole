import type { ControleEstacas } from '../types';

// Este arquivo não importa o seed de agosto diretamente: o App.tsx o importa de
// forma estática e isso arrastava os 1,7 MB do seed para o carregamento inicial,
// anulando o import dinâmico usado pelos demais seeds em initialData.ts.
// O valor é preenchido por hydrateInitialOperationalSeedData(), que roda antes
// de qualquer leitura destes dados.
export let INITIAL_CONTROLE_ESTACAS: ControleEstacas = { lotes: [], cravacoes: [] };

export const setInitialControleEstacas = (value: ControleEstacas) => {
  INITIAL_CONTROLE_ESTACAS = value;
};
