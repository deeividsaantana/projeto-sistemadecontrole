import type { Abastecimento, Equipamento } from '../../types';

const diaCurto = (dia: string) => (/^\d{4}-\d{2}-\d{2}$/.test(dia) ? `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}` : dia || 'sem data');

/**
 * Como o abastecimento aparece na Lixeira e no histórico de ações (A17):
 * data, hora, prefixo e litros, para quem procura saber o que saiu.
 */
export const rotuloAbastecimento = (
  item: Pick<Abastecimento, 'data' | 'hora' | 'equipamentoId' | 'prefixoInformado' | 'quantidadeLitros'>,
  equipamentos: ReadonlyArray<Pick<Equipamento, 'id' | 'prefixo'>>,
) => {
  const prefixo = equipamentos.find(eq => eq.id === item.equipamentoId)?.prefixo || item.prefixoInformado || 'sem prefixo';
  const litros = Number(item.quantidadeLitros || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return [diaCurto(item.data), item.hora, prefixo, `${litros} L`].filter(Boolean).join(' · ');
};
