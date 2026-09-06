import type { ImpactoOcorrencia, Ocorrencia, TipoOcorrencia } from '../types';

const ativas = (ocorrencias: Ocorrencia[]) => ocorrencias.filter(item => item.ativo !== false);

export const OCORRENCIA_EM_ABERTO: Ocorrencia['situacao'][] = ['Registrada', 'Em análise'];

/** Ocorrências de um dia, para o diário de obra e o painel do período. */
export const ocorrenciasDoDia = (ocorrencias: Ocorrencia[], dia: string) =>
  ativas(ocorrencias)
    .filter(item => item.data === dia)
    .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

export interface PainelOcorrencias {
  total: number;
  emAberto: number;
  horasParadas: number;
  acidentes: number;
  porTipo: Array<{ tipo: TipoOcorrencia; quantidade: number; horasParadas: number }>;
}

/** Painel do período. Horas paradas somam só o que a ocorrência informou. */
export const painelOcorrencias = (ocorrencias: Ocorrencia[], inicio?: string, fim?: string): PainelOcorrencias => {
  const lista = ativas(ocorrencias)
    .filter(item => (!inicio || item.data >= inicio) && (!fim || item.data <= fim));
  const porTipo = new Map<TipoOcorrencia, { quantidade: number; horasParadas: number }>();
  lista.forEach(item => {
    const atual = porTipo.get(item.tipo) || { quantidade: 0, horasParadas: 0 };
    porTipo.set(item.tipo, {
      quantidade: atual.quantidade + 1,
      horasParadas: atual.horasParadas + (Number(item.horasParadas) || 0),
    });
  });
  return {
    total: lista.length,
    emAberto: lista.filter(item => OCORRENCIA_EM_ABERTO.includes(item.situacao)).length,
    horasParadas: Number(lista.reduce((total, item) => total + (Number(item.horasParadas) || 0), 0).toFixed(2)),
    acidentes: lista.filter(item => item.tipo === 'Acidente').length,
    porTipo: [...porTipo.entries()]
      .map(([tipo, dados]) => ({ tipo, ...dados, horasParadas: Number(dados.horasParadas.toFixed(2)) }))
      .sort((a, b) => b.quantidade - a.quantidade),
  };
};

/** Impacto sugerido; a decisão continua de quem registra. */
export const impactoSugerido = (tipo: TipoOcorrencia, horasParadas: number): ImpactoOcorrencia => {
  if (tipo === 'Acidente') return 'Alto';
  if (horasParadas >= 4) return 'Alto';
  if (horasParadas >= 1) return 'Médio';
  if (horasParadas > 0) return 'Baixo';
  return 'Sem impacto';
};

/**
 * Acidente e ocorrência resolvida precisam dizer o que foi feito: sem
 * providência registrada a ocorrência fecha sem deixar rastro do tratamento.
 */
export const validarOcorrencia = (
  candidata: Pick<Ocorrencia, 'data' | 'descricao' | 'tipo' | 'situacao' | 'providencia' | 'horasParadas'>,
): string | null => {
  if (!candidata.data) return 'Informe a data da ocorrência.';
  if (!candidata.descricao.trim()) return 'Descreva a ocorrência.';
  if (Number(candidata.horasParadas) < 0) return 'Horas paradas não podem ser negativas.';
  if (Number(candidata.horasParadas) > 24) return 'Horas paradas não podem passar de 24 horas em um dia.';
  if ((candidata.situacao === 'Resolvida' || candidata.tipo === 'Acidente') && !candidata.providencia?.trim()) {
    return 'Descreva a providência tomada.';
  }
  return null;
};

export const proximoNumeroOcorrencia = (ocorrencias: Ocorrencia[], ano = new Date().getFullYear()) => {
  const prefixo = `OC-${ano}-`;
  const ultimo = ocorrencias
    .filter(item => item.numero?.startsWith(prefixo))
    .map(item => Number(item.numero.slice(prefixo.length)) || 0)
    .reduce((maior, valor) => Math.max(maior, valor), 0);
  return `${prefixo}${String(ultimo + 1).padStart(4, '0')}`;
};
