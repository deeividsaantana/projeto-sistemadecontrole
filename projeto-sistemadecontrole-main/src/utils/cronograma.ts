import type { FrenteServico, PlanejamentoItem, RegistroProducao } from '../types';
import { aderenciaDosPlanos } from './planejamento';

export interface BarraCronograma {
  id: string;
  titulo: string;
  subtitulo?: string;
  inicio: string;
  fim: string;
  /** Avanço físico já executado, de 0 a 100. */
  progresso: number;
  atrasado: boolean;
  origem: 'Plano' | 'Frente';
}

const dia = 86_400_000;

export const diasEntre = (inicio: string, fim: string) =>
  Math.round((new Date(`${fim}T00:00:00`).getTime() - new Date(`${inicio}T00:00:00`).getTime()) / dia);

/**
 * Cronograma montado a partir do que já existe: planos de produção e frentes de
 * serviço com data. Não existe entidade "tarefa de cronograma" — duplicaria o
 * planejamento e as duas versões divergiriam na primeira semana.
 */
export const barrasDoCronograma = (
  planos: PlanejamentoItem[],
  producao: RegistroProducao[],
  frentes: FrenteServico[],
  hoje: string,
): BarraCronograma[] => [
  ...aderenciaDosPlanos(planos, producao, hoje).map(item => ({
    id: `plano-${item.plano.id}`,
    titulo: item.plano.servicoDescricao,
    subtitulo: [item.plano.frente, item.plano.equipeNome].filter(Boolean).join(' · ') || undefined,
    inicio: item.plano.dataInicio,
    fim: item.plano.dataFim,
    progresso: Math.min(100, item.aderencia),
    atrasado: item.atrasado,
    origem: 'Plano' as const,
  })),
  ...frentes
    .filter(frente => frente.dataInicio && frente.dataTerminoPrevisto)
    .map(frente => ({
      id: `frente-${frente.id}`,
      titulo: frente.nome,
      subtitulo: frente.servico || frente.ramoLocal,
      inicio: frente.dataInicio!,
      fim: frente.dataTerminoPrevisto!,
      progresso: frente.situacao === 'Concluída' ? 100 : frente.situacao === 'Em execução' ? 50 : 0,
      atrasado: frente.situacao !== 'Concluída' && frente.dataTerminoPrevisto! < hoje,
      origem: 'Frente' as const,
    })),
].sort((a, b) => a.inicio.localeCompare(b.inicio) || a.titulo.localeCompare(b.titulo, 'pt-BR'));

export interface JanelaCronograma {
  inicio: string;
  fim: string;
  totalDias: number;
}

/** Janela que cobre todas as barras, com folga de um dia em cada ponta. */
export const janelaDoCronograma = (barras: BarraCronograma[], hoje: string): JanelaCronograma => {
  if (barras.length === 0) return { inicio: hoje, fim: hoje, totalDias: 1 };
  const inicio = barras.reduce((menor, item) => item.inicio < menor ? item.inicio : menor, barras[0].inicio);
  const fim = barras.reduce((maior, item) => item.fim > maior ? item.fim : maior, barras[0].fim);
  return { inicio, fim, totalDias: Math.max(1, diasEntre(inicio, fim) + 1) };
};

/** Posição e largura da barra em percentual da janela, para desenhar sem lib. */
export const posicaoDaBarra = (barra: BarraCronograma, janela: JanelaCronograma) => {
  const deslocamento = Math.max(0, diasEntre(janela.inicio, barra.inicio));
  const duracao = Math.max(1, diasEntre(barra.inicio, barra.fim) + 1);
  return {
    esquerda: Number(((deslocamento / janela.totalDias) * 100).toFixed(2)),
    largura: Number(((Math.min(duracao, janela.totalDias - deslocamento) / janela.totalDias) * 100).toFixed(2)),
  };
};

/** Marca de hoje na régua; fora da janela não é desenhada. */
export const posicaoDeHoje = (janela: JanelaCronograma, hoje: string) => {
  if (hoje < janela.inicio || hoje > janela.fim) return undefined;
  return Number(((diasEntre(janela.inicio, hoje) / janela.totalDias) * 100).toFixed(2));
};
