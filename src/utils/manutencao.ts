import type { OrdemServico } from '../types';

/** Fluxo oficial da ordem de serviço. Cancelada sai do fluxo a qualquer momento. */
export const FLUXO_MANUTENCAO: OrdemServico['status'][] = [
  'Aberta',
  'Em Análise',
  'Em Andamento',
  'Aguardando Peça',
  'Concluída',
];

export const STATUS_ENCERRADOS: OrdemServico['status'][] = ['Concluída', 'Cancelada'];

export const isOrdemEncerrada = (status: OrdemServico['status']) => STATUS_ENCERRADOS.includes(status);

/** Próxima etapa do fluxo, ou undefined quando a OS já está encerrada. */
export const proximoStatusManutencao = (status: OrdemServico['status']): OrdemServico['status'] | undefined => {
  if (isOrdemEncerrada(status)) return undefined;
  const indice = FLUXO_MANUTENCAO.indexOf(status);
  if (indice < 0) return 'Em Análise';
  return FLUXO_MANUTENCAO[indice + 1];
};

const combinarDataHora = (data?: string, hora?: string) => {
  if (!data) return null;
  const momento = new Date(`${data.slice(0, 10)}T${(hora || '00:00').slice(0, 5)}:00`);
  return Number.isNaN(momento.getTime()) ? null : momento;
};

/**
 * Horas em que o equipamento ficou parado por causa da OS. Enquanto a ordem
 * está aberta o valor é corrente (conta até agora); ao concluir, ele congela
 * na diferença entre abertura e liberação.
 */
export const calcularHorasParadas = (
  ordem: Pick<OrdemServico, 'dataAbertura' | 'dataConclusao'> & { horaAbertura?: string; horaConclusao?: string },
  agora: Date = new Date(),
): number | undefined => {
  const inicio = combinarDataHora(ordem.dataAbertura, ordem.horaAbertura);
  if (!inicio) return undefined;
  const fim = ordem.dataConclusao ? combinarDataHora(ordem.dataConclusao, ordem.horaConclusao) : agora;
  if (!fim) return undefined;
  const horas = (fim.getTime() - inicio.getTime()) / 3_600_000;
  // Liberação anterior à abertura é dado inconsistente: não inventa número.
  if (horas < 0) return undefined;
  return Number(horas.toFixed(2));
};
