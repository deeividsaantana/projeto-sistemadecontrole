import type { RegistroProducao, ServicoObra } from '../types';

const ativos = (registros: RegistroProducao[]) => registros.filter(item => item.ativo !== false);

const arredondar = (valor: number) => Number(valor.toFixed(3));

/** Quanto já foi executado de um serviço. Soma dos lançamentos, sem contador. */
export const acumuladoDoServico = (registros: RegistroProducao[], servicoId: string, ate?: string) =>
  arredondar(ativos(registros)
    .filter(item => item.servicoId === servicoId && (!ate || item.data <= ate))
    .reduce((total, item) => total + (Number(item.quantidade) || 0), 0));

export interface AvancoServico {
  servico: ServicoObra;
  acumulado: number;
  previsto: number;
  saldo?: number;
  /** Só existe quando há quantidade prevista no contrato. */
  percentual?: number;
  ultimoLancamento?: string;
}

/**
 * Avanço físico por serviço. Sem quantidade prevista não há percentual: o
 * sistema não inventa a meta que o contrato não informou.
 */
export const avancoDosServicos = (
  servicos: ServicoObra[],
  registros: RegistroProducao[],
  ate?: string,
): AvancoServico[] =>
  servicos.map(servico => {
    const doServico = ativos(registros).filter(item => item.servicoId === servico.id && (!ate || item.data <= ate));
    const acumulado = arredondar(doServico.reduce((total, item) => total + (Number(item.quantidade) || 0), 0));
    const previsto = Number(servico.quantidadePrevista) || 0;
    return {
      servico,
      acumulado,
      previsto,
      saldo: previsto > 0 ? arredondar(previsto - acumulado) : undefined,
      percentual: previsto > 0 ? Number(((acumulado / previsto) * 100).toFixed(1)) : undefined,
      ultimoLancamento: doServico.map(item => item.data).sort().at(-1),
    };
  }).sort((a, b) => a.servico.descricao.localeCompare(b.servico.descricao, 'pt-BR'));

/** Produção somada por dia, para a curva de avanço da tela. */
export const producaoPorDia = (registros: RegistroProducao[], servicoId?: string) => {
  const mapa = new Map<string, number>();
  ativos(registros)
    .filter(item => !servicoId || item.servicoId === servicoId)
    .forEach(item => mapa.set(item.data, (mapa.get(item.data) || 0) + (Number(item.quantidade) || 0)));
  return [...mapa.entries()]
    .map(([data, quantidade]) => ({ data, quantidade: arredondar(quantidade) }))
    .sort((a, b) => a.data.localeCompare(b.data));
};

/** Recusa lançamento sem serviço, sem data ou com quantidade não positiva. */
export const validarProducao = (
  candidato: Pick<RegistroProducao, 'data' | 'servicoId' | 'quantidade'>,
): string | null => {
  if (!candidato.data) return 'Informe a data.';
  if (!candidato.servicoId) return 'Selecione o serviço.';
  if (!(Number(candidato.quantidade) > 0)) return 'Informe uma quantidade maior que zero.';
  return null;
};
