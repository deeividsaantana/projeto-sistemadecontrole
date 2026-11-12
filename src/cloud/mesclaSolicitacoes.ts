/**
 * Mescla de um mesmo pedido de Solicitações e Compras editado em dois
 * aparelhos. A regra geral (fica a versão mais recente) apagava o lançamento
 * do outro aparelho da linha do tempo, e a linha do tempo é o histórico
 * oficial do pedido (pedido do usuário em 11/11/2026).
 *
 * Aqui a versão mais recente continua mandando nos campos do pedido, mas os
 * registros que só crescem são somados dos dois lados, sem repetir:
 * - eventos (linha do tempo);
 * - reagendamentos;
 * - conferências de cada item.
 */
type Registro = Record<string, unknown>;

const lista = (valor: unknown): Registro[] =>
  (Array.isArray(valor) ? valor.filter(item => item && typeof item === 'object') as Registro[] : []);

const chave = (item: Registro) => JSON.stringify([item.data, item.usuario, item.acao ?? item.situacao ?? item.nova, item.detalhe ?? item.quantidade ?? item.motivo]);

/** Soma dois registros só de acréscimo, em ordem de data, sem repetir. */
const somar = (base: Registro[], outro: Registro[]) => {
  const vistos = new Set(base.map(chave));
  const extras = outro.filter(item => !vistos.has(chave(item)));
  if (!extras.length) return base;
  return [...base, ...extras].sort((a, b) => String(a.data ?? '').localeCompare(String(b.data ?? '')));
};

export const mesclarSolicitacao = (vencedor: unknown, outro: unknown): unknown => {
  if (!vencedor || typeof vencedor !== 'object' || !outro || typeof outro !== 'object') return vencedor;
  const v = vencedor as Registro;
  const o = outro as Registro;
  const itensDoOutro = new Map(lista(o.itens).map(item => [item.itemId, item]));
  return {
    ...v,
    eventos: somar(lista(v.eventos), lista(o.eventos)),
    reagendamentos: somar(lista(v.reagendamentos), lista(o.reagendamentos)),
    itens: lista(v.itens).map(item => {
      const par = itensDoOutro.get(item.itemId);
      if (!par) return item;
      const conferencias = somar(lista(item.conferencias), lista(par.conferencias));
      return conferencias.length ? { ...item, conferencias } : item;
    }),
  };
};

/** Tabelas com regra própria de mescla para o mesmo registro dos dois lados. */
export const MESCLA_DO_MESMO_REGISTRO: Record<string, (vencedor: unknown, outro: unknown) => unknown> = {
  solicitacoes: mesclarSolicitacao,
};
