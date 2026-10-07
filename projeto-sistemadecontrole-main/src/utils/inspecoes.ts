import type { GravidadeInspecao, Inspecao } from '../types';

export const INSPECAO_ABERTA: Inspecao['situacao'][] = ['Aberta', 'Em correção'];

const ativas = (inspecoes: Inspecao[]) => inspecoes.filter(item => item.ativo !== false);

/** Só pendência com prazo estourado é atraso; sem prazo não existe atraso. */
export const estaAtrasada = (inspecao: Inspecao, hoje: string) =>
  INSPECAO_ABERTA.includes(inspecao.situacao) && Boolean(inspecao.prazo) && inspecao.prazo! < hoje;

export const diasParaPrazo = (inspecao: Inspecao, hoje: string) => {
  if (!inspecao.prazo) return undefined;
  const umDia = 86_400_000;
  return Math.round((new Date(`${inspecao.prazo}T00:00:00`).getTime() - new Date(`${hoje}T00:00:00`).getTime()) / umDia);
};

export interface PainelInspecoes {
  total: number;
  abertas: number;
  atrasadas: number;
  corrigidas: number;
  porGravidade: Record<GravidadeInspecao, number>;
}

export const painelInspecoes = (inspecoes: Inspecao[], hoje: string): PainelInspecoes => {
  const lista = ativas(inspecoes);
  const abertas = lista.filter(item => INSPECAO_ABERTA.includes(item.situacao));
  return {
    total: lista.length,
    abertas: abertas.length,
    atrasadas: abertas.filter(item => estaAtrasada(item, hoje)).length,
    corrigidas: lista.filter(item => item.situacao === 'Corrigida').length,
    porGravidade: {
      Baixa: abertas.filter(item => item.gravidade === 'Baixa').length,
      Média: abertas.filter(item => item.gravidade === 'Média').length,
      Alta: abertas.filter(item => item.gravidade === 'Alta').length,
    },
  };
};

/**
 * Fechar uma inspeção exige dizer o que foi feito: sem ação corretiva descrita a
 * correção não fica registrada e a não conformidade some sem rastro.
 */
export const validarInspecao = (
  candidata: Pick<Inspecao, 'data' | 'local' | 'descricao' | 'situacao' | 'acaoCorretiva' | 'prazo'>,
): string | null => {
  if (!candidata.data) return 'Informe a data da inspeção.';
  if (!candidata.local.trim()) return 'Informe o local inspecionado.';
  if (!candidata.descricao.trim()) return 'Descreva o que foi observado.';
  if (candidata.prazo && candidata.prazo < candidata.data) return 'O prazo não pode ser anterior à inspeção.';
  if (candidata.situacao === 'Corrigida' && !candidata.acaoCorretiva?.trim()) {
    return 'Descreva a ação corretiva antes de marcar como corrigida.';
  }
  return null;
};

/** Numeração sequencial por ano, no mesmo padrão da FVS e das ordens. */
export const proximoNumeroInspecao = (inspecoes: Inspecao[], ano = new Date().getFullYear()) => {
  const prefixo = `INSP-${ano}-`;
  const ultimo = inspecoes
    .filter(item => item.numero?.startsWith(prefixo))
    .map(item => Number(item.numero.slice(prefixo.length)) || 0)
    .reduce((maior, valor) => Math.max(maior, valor), 0);
  return `${prefixo}${String(ultimo + 1).padStart(4, '0')}`;
};
