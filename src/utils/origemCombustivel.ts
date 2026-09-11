import type { OrigemRegistroCombustivel } from '../types';

/**
 * O OneDrive foi removido do produto, mas lançamentos gravados antes disso
 * continuam chegando da nuvem com `origem: 'OneDrive'`. Eles eram importação
 * de arquivo, então são lidos como 'Planilha'. Apagar o valor sem traduzir
 * deixaria esses registros sem origem na tela de conferência, que é
 * justamente onde a origem importa.
 */
export const normalizarOrigemCombustivel = (valor: unknown): OrigemRegistroCombustivel => {
  const texto = String(valor ?? '').trim();
  if (texto === 'OneDrive') return 'Planilha';
  if (texto === 'Planilha' || texto === 'PDF/Foto IA' || texto === 'Legado Access') return texto;
  return 'Manual';
};
