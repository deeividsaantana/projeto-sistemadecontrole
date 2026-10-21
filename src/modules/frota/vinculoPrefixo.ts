import type { Abastecimento, Equipamento } from '../../types';

const chave = (prefixo?: string) => String(prefixo ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[\s-]/g, '').toUpperCase();

/**
 * Abastecimento sem máquina, ou ligado a um cadastro que não existe mais,
 * acha a máquina pelo prefixo digitado. Assim, cadastrar o prefixo depois
 * já liga os lançamentos antigos, sem "NÃO CADASTRADO" no histórico.
 */
export const ligarPeloPrefixo = (abastecimentos: Abastecimento[], equipamentos: Equipamento[]): Abastecimento[] => {
  const ids = new Set(equipamentos.map(item => item.id));
  const porPrefixo = new Map<string, Equipamento>();
  equipamentos.forEach(item => {
    const atual = porPrefixo.get(chave(item.prefixo));
    // Prefixo repetido: fica o ativo.
    if (chave(item.prefixo) && (!atual || (atual.status !== 'Ativo' && item.status === 'Ativo'))) porPrefixo.set(chave(item.prefixo), item);
  });
  return abastecimentos.map(item => {
    if (item.equipamentoId && ids.has(item.equipamentoId)) return item;
    const maquina = porPrefixo.get(chave(item.prefixoInformado));
    return maquina ? { ...item, equipamentoId: maquina.id } : item;
  });
};
