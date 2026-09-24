import type { GrupoEquipe, PresencaApontamento } from '../types';

export interface PresencaResumo {
  total: number;
  presente: number;
  ausente: number;
  percentual: number;
}

/**
 * Filtra equipes pela frente de serviço selecionada
 */
export function filterEquipesByFrente(
  equipes: GrupoEquipe[],
  frente: string,
): GrupoEquipe[] {
  return equipes.filter(e => e.frenteServico === frente);
}

/**
 * Ordena equipes alfabeticamente por nome
 */
export function sortEquipesByNome(equipes: GrupoEquipe[]): GrupoEquipe[] {
  return [...equipes].sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }),
  );
}

/**
 * Calcula resumo de presença para uma equipe no dia
 */
export function calculatePresencaResumo(
  presenca: PresencaApontamento[],
  grupoId: string,
): PresencaResumo {
  const diaEquipe = presenca.filter(p => p.grupoId === grupoId);
  const presente = diaEquipe.length;
  const total = diaEquipe.length > 0 ? diaEquipe.length : 0;

  return {
    total,
    presente,
    ausente: Math.max(0, total - presente),
    percentual: total > 0 ? (presente / total) * 100 : 0,
  };
}
