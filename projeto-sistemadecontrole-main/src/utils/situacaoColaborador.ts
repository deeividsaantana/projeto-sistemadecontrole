import type { Funcionario } from '../types';

export type SituacaoColaborador = NonNullable<Funcionario['status']>;

/**
 * Mudar a situação de alguém é registro de RH, não um rótulo de tela: quem
 * saiu da obra, quem entrou de férias e quando isso valeu precisa ficar
 * escrito. Por isso a data e o motivo viajam junto, e a desmobilização grava
 * a data de saída em campo próprio.
 */
export const SITUACOES_COLABORADOR: readonly SituacaoColaborador[] = [
  'ATIVO', 'FÉRIAS', 'AFASTADO', 'DESMOBILIZADO', 'INATIVO',
];

/** Quem está nestas situações não conta como efetivo disponível na obra. */
const FORA_DO_EFETIVO: readonly SituacaoColaborador[] = ['INATIVO', 'DESMOBILIZADO'];

export const situacaoAtualDe = (funcionario: Pick<Funcionario, 'status' | 'ativo'>): SituacaoColaborador =>
  funcionario.status || (funcionario.ativo ? 'ATIVO' : 'INATIVO');

export const estaNoEfetivo = (funcionario: Pick<Funcionario, 'status' | 'ativo'>): boolean =>
  !FORA_DO_EFETIVO.includes(situacaoAtualDe(funcionario));

export interface MudancaDeSituacao {
  situacao: SituacaoColaborador;
  /** Data em que a situação passa a valer (YYYY-MM-DD). */
  data: string;
  motivo?: string;
  por?: string;
}

export const aplicarSituacao = (
  funcionario: Funcionario,
  { situacao, data, motivo, por }: MudancaDeSituacao,
  agora: string = new Date().toISOString(),
): Funcionario => {
  const anterior = situacaoAtualDe(funcionario);
  const detalhe = [
    `${anterior} → ${situacao} em ${data}`,
    motivo?.trim(),
    por?.trim() && `por ${por.trim()}`,
  ].filter(Boolean).join(' · ');

  const proximo: Funcionario = {
    ...funcionario,
    status: situacao,
    ativo: estaNoEfetivo({ status: situacao, ativo: funcionario.ativo }),
    situacaoRh: detalhe,
    atualizadoEm: agora,
  };

  if (situacao === 'DESMOBILIZADO') proximo.dataDesmobilizacao = data;
  // Voltar para o efetivo apaga a saída: quem retornou não tem data de saída.
  if (situacao === 'ATIVO') delete proximo.dataDesmobilizacao;

  return proximo;
};

export const descreverMudanca = (funcionario: Funcionario, mudanca: MudancaDeSituacao): string => {
  const anterior = situacaoAtualDe(funcionario);
  const base = `${funcionario.nome}: ${anterior} → ${mudanca.situacao} em ${mudanca.data}`;
  return mudanca.motivo?.trim() ? `${base}. Motivo: ${mudanca.motivo.trim()}` : `${base}.`;
};
