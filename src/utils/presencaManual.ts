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
  // Hora de Brasília, como no link; a parte de hora do ISO é UTC (+3 h) (A15).
  const hora = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;

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

export interface ResumoLancamento {
  total: number;
  presentes: number;
  ausentes: number;
  justificados: number;
  outras: number;
  semConferencia: number;
}

/**
 * Totais do formulário de lançamento. Os grupos não se sobrepõem e somam o
 * total da equipe: quem ainda não foi conferido fica em "semConferencia" e
 * nunca vira falta nem presença.
 */
export const resumirLancamento = (
  pessoaIds: readonly string[],
  situacoes: Readonly<Record<string, SituacaoLancada | undefined>>,
): ResumoLancamento => {
  const resumo: ResumoLancamento = { total: pessoaIds.length, presentes: 0, ausentes: 0, justificados: 0, outras: 0, semConferencia: 0 };
  for (const id of pessoaIds) {
    const status = situacoes[id]?.status;
    if (!status) resumo.semConferencia += 1;
    else if (status === 'Presente') resumo.presentes += 1;
    else if (status === 'Ausente') resumo.ausentes += 1;
    else if (status === 'Falta justificada' || status === 'Atestado') resumo.justificados += 1;
    else resumo.outras += 1;
  }
  return resumo;
};
