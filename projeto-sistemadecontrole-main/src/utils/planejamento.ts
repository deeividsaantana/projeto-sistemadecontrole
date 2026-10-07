import type { PlanejamentoItem, RegistroProducao } from '../types';

const arredondar = (valor: number) => Number(valor.toFixed(3));

/**
 * Produção que atende ao plano: mesmo serviço, dentro do período e — quando o
 * plano nomeia frente ou equipe — só o que veio daquela frente ou equipe.
 */
export const producaoDoPlano = (plano: PlanejamentoItem, registros: RegistroProducao[]) =>
  registros.filter(item => item.ativo !== false
    && item.servicoId === plano.servicoId
    && item.data >= plano.dataInicio
    && item.data <= plano.dataFim
    && (!plano.grupoId || item.grupoId === plano.grupoId)
    && (!plano.frente || item.frente === plano.frente));

export interface AderenciaPlano {
  plano: PlanejamentoItem;
  planejado: number;
  realizado: number;
  saldo: number;
  /** Percentual do planejado que foi executado. */
  aderencia: number;
  atrasado: boolean;
}

/** Planejado x realizado. `hoje` decide o que já passou do prazo sem concluir. */
export const aderenciaDosPlanos = (
  planos: PlanejamentoItem[],
  registros: RegistroProducao[],
  hoje: string,
): AderenciaPlano[] =>
  planos.filter(plano => plano.ativo !== false).map(plano => {
    const planejado = Number(plano.quantidadePlanejada) || 0;
    const realizado = arredondar(producaoDoPlano(plano, registros)
      .reduce((total, item) => total + (Number(item.quantidade) || 0), 0));
    return {
      plano,
      planejado,
      realizado,
      saldo: arredondar(planejado - realizado),
      aderencia: planejado > 0 ? Number(((realizado / planejado) * 100).toFixed(1)) : 0,
      atrasado: plano.situacao !== 'Concluído' && plano.situacao !== 'Cancelado'
        && plano.dataFim < hoje && realizado < planejado,
    };
  }).sort((a, b) => a.plano.dataInicio.localeCompare(b.plano.dataInicio)
    || a.plano.servicoDescricao.localeCompare(b.plano.servicoDescricao, 'pt-BR'));

/** Planos que tocam o intervalo pedido, não só os que começam dentro dele. */
export const planosNoPeriodo = (planos: PlanejamentoItem[], inicio: string, fim: string) =>
  planos.filter(plano => plano.ativo !== false && plano.dataInicio <= fim && plano.dataFim >= inicio);

/** Recusa plano sem serviço, sem quantidade ou com período invertido. */
export const validarPlano = (
  candidato: Pick<PlanejamentoItem, 'dataInicio' | 'dataFim' | 'servicoId' | 'quantidadePlanejada'>,
): string | null => {
  if (!candidato.servicoId) return 'Selecione o serviço.';
  if (!candidato.dataInicio || !candidato.dataFim) return 'Informe o período do plano.';
  if (candidato.dataFim < candidato.dataInicio) return 'A data final não pode ser anterior à inicial.';
  if (!(Number(candidato.quantidadePlanejada) > 0)) return 'Informe a quantidade planejada.';
  return null;
};
