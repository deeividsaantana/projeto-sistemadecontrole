import type { ApontamentoOperacional } from '../types';

export const HORAS_MAXIMAS_POR_DIA = 24;

/**
 * Horas já apontadas para a pessoa no dia, ignorando o apontamento que está
 * sendo editado — sem isso, editar um lançamento contaria as horas dele duas
 * vezes e travaria a própria edição.
 */
export const horasNoDia = (
  apontamentos: ApontamentoOperacional[],
  funcionarioId: string,
  data: string,
  ignorarId?: string,
) => apontamentos
  .filter(item => item.funcionarioId === funcionarioId && item.data === data && item.id !== ignorarId)
  .reduce((total, item) => total + (Number(item.horas) || 0), 0);

/** Recusa o lançamento que estouraria o dia da pessoa. */
export const validarApontamento = (
  apontamentos: ApontamentoOperacional[],
  candidato: Pick<ApontamentoOperacional, 'id' | 'funcionarioId' | 'data' | 'horas' | 'atividade'>,
): string | null => {
  if (!candidato.funcionarioId) return 'Selecione o colaborador.';
  if (!candidato.atividade.trim()) return 'Descreva a atividade.';
  if (!(Number(candidato.horas) > 0)) return 'Informe as horas trabalhadas.';
  const total = horasNoDia(apontamentos, candidato.funcionarioId, candidato.data, candidato.id) + Number(candidato.horas);
  if (total > HORAS_MAXIMAS_POR_DIA) {
    return `Total do dia ficaria em ${total.toLocaleString('pt-BR')} h, acima das ${HORAS_MAXIMAS_POR_DIA} h possíveis.`;
  }
  return null;
};

/** Base da produtividade: horas somadas por chave (serviço, frente, equipe...). */
export const horasPor = (
  apontamentos: ApontamentoOperacional[],
  chave: (item: ApontamentoOperacional) => string,
) => {
  const mapa = new Map<string, { chave: string; horas: number; lancamentos: number }>();
  apontamentos.forEach(item => {
    const nome = chave(item) || 'Não informado';
    const atual = mapa.get(nome) || { chave: nome, horas: 0, lancamentos: 0 };
    atual.horas += Number(item.horas) || 0;
    atual.lancamentos += 1;
    mapa.set(nome, atual);
  });
  return Array.from(mapa.values())
    .map(item => ({ ...item, horas: Number(item.horas.toFixed(2)) }))
    .sort((a, b) => b.horas - a.horas);
};
