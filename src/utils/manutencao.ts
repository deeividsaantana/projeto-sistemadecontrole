import type { ControleEquipamentoDiario, OrdemServico } from '../types';

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

export const proximoNumeroOrdemServico = (ordens: OrdemServico[]) => {
  const maior = ordens.reduce((maximo, ordem) => {
    const numero = Number(String(ordem.numero).replace(/\D/g, ''));
    return Number.isFinite(numero) && numero > maximo ? numero : maximo;
  }, 0);
  return `OS-${String(maior + 1).padStart(4, '0')}`;
};

interface OrdemAutomaticaDaFrota {
  registro: ControleEquipamentoDiario;
  ordens: OrdemServico[];
  criada: boolean;
}

/**
 * Faz a ponte entre o fechamento operacional da frota e a oficina. Vale para
 * qualquer equipamento — escavadeira, gerador, torre, basculante: se o controle
 * diário marca entrada em manutenção, a oficina precisa da ordem aberta.
 * Uma OS aberta existente sempre vence, evitando que lançamentos diários
 * multipliquem ordens para o mesmo equipamento.
 */
export const garantirOrdemAutomaticaDaFrota = (
  registro: ControleEquipamentoDiario,
  ordens: OrdemServico[],
  responsavel: string,
): OrdemAutomaticaDaFrota => {
  if (!['Em manutenção', 'Aguardando manutenção'].includes(registro.status)) {
    return { registro, ordens, criada: false };
  }

  const aberta = ordens.find(ordem =>
    ordem.equipamentoId === registro.equipamentoId && !isOrdemEncerrada(ordem.status));
  if (aberta) {
    return {
      registro: { ...registro, ordemServicoId: aberta.id },
      ordens,
      criada: false,
    };
  }

  const ordem: OrdemServico = {
    id: `os-frota-${registro.id}`,
    numero: proximoNumeroOrdemServico(ordens),
    equipamentoId: registro.equipamentoId,
    tipo: 'Corretiva',
    prioridade: 'Média',
    descricao: `Entrada em manutenção registrada no controle operacional do ${registro.prefixo}.`,
    status: 'Aberta',
    dataAbertura: registro.data,
    horaAbertura: registro.horaEntradaManutencao || undefined,
    responsavel,
    observacao: 'OS criada automaticamente pelo Controle Operacional de Frotas.',
    motivo: registro.motivoManutencao?.trim() || '',
  };
  return {
    registro: { ...registro, ordemServicoId: ordem.id },
    ordens: [ordem, ...ordens],
    criada: true,
  };
};

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
