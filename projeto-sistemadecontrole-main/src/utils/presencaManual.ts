import type { Funcionario, GrupoEquipe, PresencaApontamento, PresencaStatus } from '../types';

/**
 * Nem toda equipe usa o link. Chuva, celular sem bateria, encarregado de folga:
 * o apontamento tem de poder ser lançado pelo painel. O que não pode é o
 * lançamento manual se confundir com o que veio do campo — por isso ele nasce
 * marcado, com quem lançou, e some do relatório se for inativado como qualquer
 * outro registro.
 */
export const MARCA_LANCAMENTO_MANUAL = 'manual-painel';

export const veioDoLancamentoManual = (registro: Pick<PresencaApontamento, 'tokenUsado'>): boolean =>
  String(registro.tokenUsado || '').startsWith(MARCA_LANCAMENTO_MANUAL);

export interface SituacaoLancada {
  funcionarioId: string;
  status: PresencaStatus;
  observacao?: string;
}

export interface EntradaPresencaManual {
  grupo: GrupoEquipe;
  funcionarios: Funcionario[];
  data: string;
  situacoes: SituacaoLancada[];
  responsavel: string;
  observacaoDia?: string;
}

/** Um dia por equipe: repetir o lançamento não pode duplicar a lista. */
export const idPresencaManual = (grupoId: string, data: string, funcionarioId: string) =>
  `manual-${grupoId}-${data}-${funcionarioId}`;

export const montarPresencaManual = (
  { grupo, funcionarios, data, situacoes, responsavel, observacaoDia }: EntradaPresencaManual,
  agora: Date = new Date(),
): PresencaApontamento[] => {
  const porId = new Map(funcionarios.map(pessoa => [pessoa.id, pessoa]));
  const iso = agora.toISOString();
  const hora = iso.slice(11, 16);

  return situacoes
    .filter(item => item.status && porId.has(item.funcionarioId))
    .map(item => {
      const pessoa = porId.get(item.funcionarioId)!;
      return {
        id: idPresencaManual(grupo.id, data, item.funcionarioId),
        data,
        horaEnvio: hora,
        grupoId: grupo.id,
        grupoNome: grupo.nome,
        responsavel: responsavel || grupo.responsavel,
        frenteServico: grupo.frenteServico,
        funcionarioId: pessoa.id,
        funcionarioNome: pessoa.nome,
        funcao: pessoa.cargo,
        status: item.status,
        observacao: item.observacao?.trim() || '',
        observacaoDia: observacaoDia?.trim() || undefined,
        tokenUsado: `${MARCA_LANCAMENTO_MANUAL}-${responsavel || 'sistema'}`,
        createdAt: iso,
      } satisfies PresencaApontamento;
    });
};

/**
 * O lançamento manual substitui o que já existe para aquela equipe naquele dia,
 * em vez de somar: relançar um dia é correção, não um segundo apontamento.
 * O que veio do link e não foi relançado permanece.
 */
export const aplicarPresencaManual = (
  existentes: PresencaApontamento[],
  novos: PresencaApontamento[],
): PresencaApontamento[] => {
  if (novos.length === 0) return existentes;
  const grupoId = novos[0].grupoId;
  const data = novos[0].data;
  const substituidos = new Set(novos.map(item => item.funcionarioId));
  const preservados = existentes.filter(item => !(
    item.grupoId === grupoId && item.data === data && substituidos.has(item.funcionarioId)
  ));
  return [...preservados, ...novos];
};
