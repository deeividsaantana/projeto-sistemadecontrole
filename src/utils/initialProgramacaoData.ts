import type { PlanejamentoItem, ServicoObra } from '../types';

const AGORA = '2026-11-12T00:00:00.000Z';
const ESTACA = 20;

const SEED = [
  ['RAMO 1400', 'GUIA', 'SILLAME', '2026-11-12', '2026-11-19', 7, 157, 23, 'M', '1401+10', '1409+7'],
  ['RAMO 1400', 'SARJETA', 'SILLAME', '2026-11-12', '2026-11-19', 7, 314, 45, 'M', '1401+10', '1409+7'],
  ['RAMO 1400', 'PASSEIO', 'SILLAME', '2026-11-12', '2026-11-19', 7, 314, 45, 'M', '1401+10', '1409+7'],
  ['RAMO 1400', 'BL', 'SILLAME', '2026-11-12', '2026-11-19', 7, 1, 1, 'UN', '1402+9', '1402+9'],
  ['RAMO 1300', 'TUBO', 'SILLAME E RODRIGO', '2026-11-12', '2026-11-25', 12, 200, 17, 'M', '1305+0', '1315+0'],
  ['RAMO 1300', 'PV E CT', 'SILLAME', '2026-11-19', '2026-12-05', 15, 6, 1, 'UN', '1300+15', '1315+0'],
  ['RAMO 1300', 'BL', 'SILLAME', '2026-11-19', '2026-12-05', 15, 9, 1, 'UN', '1300+15', '1315+0'],
  ['RAMO 1300', 'REF. SUBLEITO', 'RODRIGO', '2026-11-12', '2026-12-05', 21, 285, 14, 'M', '1300+15', '1315+0'],
  ['RAMO 1300', 'SUB BASE', 'RODRIGO', '2026-12-05', '2026-12-09', 4, 285, 72, 'M', '1300+15', '1315+0'],
  ['RAMO 1300', 'BASE', 'RODRIGO', '2026-12-09', '2026-12-12', 4, 285, 72, 'M', '1300+15', '1315+0'],
  ['RAMO 600', 'ATERRO RACHÃO', 'RENILSON', '2026-11-12', '2026-11-25', 12, 100, 9, 'M', '645+0', '650+0'],
  ['RAMO 200A', 'ALA', 'NATALICIO', '2026-11-12', '2026-11-30', 16, 1, 1, 'UN', '206+4,5', '206+4,5'],
  ['RAMO 200A', 'SUB BASE', 'LAGOA', '2026-11-12', '2026-11-15', 3, 158.5, 53, 'M', '206+4,5', '214+3'],
  ['RAMO 200A', 'BASE BGTC', 'LAGOA', '2026-11-15', '2026-11-16', 1, 158.5, 159, 'M', '206+4,5', '214+3'],
  ['RAMO 200A', 'BASE BGS', 'LAGOA', '2026-11-18', '2026-11-20', 3, 158.5, 53, 'M', '206+4,5', '214+3'],
  ['RAMO 200A', 'ENCABEÇAMENTO OAE', 'LAGOA', '2026-11-12', '2026-11-20', 8, 1, 1, 'UN', '214+3', '214+3'],
  ['RAMO 200B', 'ESCAVAÇÃO', 'LAGOA', '2026-11-15', '2026-11-17', 2, 124.5, 63, 'M', '200+0', '206+4,5'],
  ['RAMO 200B', 'REF. SUBLEITO', 'LAGOA', '2026-11-17', '2026-11-18', 2, 124.5, 63, 'M', '200+0', '206+4,5'],
  ['RAMO 200B', 'SUB BASE', 'LAGOA', '2026-11-19', '2026-11-22', 3, 124.5, 42, 'M', '200+0', '206+4,5'],
  ['RAMO 200B', 'DRENO', 'LAGOA', '2026-11-21', '2026-11-21', 1, 124.5, 125, 'M', '200+0', '206+4,5'],
  ['RAMO 200B', 'BASE BGTC', 'LAGOA', '2026-11-23', '2026-11-23', 1, 124.5, 125, 'M', '200+0', '206+4,5'],
  ['RAMO 200B', 'BASE BGS', 'LAGOA', '2026-11-23', '2026-11-25', 3, 124.5, 42, 'M', '200+0', '206+4,5'],
  ['RAMO 200B', 'PAVIMENTO', 'LAGOA', '2026-12-05', '2026-12-05', 1, 124.5, 125, 'M', '200+0', '206+4,5'],
] as const;

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const itens = SEED.map(([frente, descricao, responsavel, dataInicio, dataFim, _dias, quantidade, meta, unidade, estacaInicial, estacaFinal]) => ({
  id: `programacao-${slug(frente)}-${slug(descricao)}`,
  dataInicio,
  dataFim,
  servicoId: `servico-${slug(descricao)}`,
  servicoDescricao: descricao,
  unidade,
  quantidadePlanejada: quantidade,
  frente,
  estacaInicial,
  estacaFinal,
  equipeNome: responsavel,
  responsavel,
  situacao: 'Planejado' as const,
  ativo: true,
  criadoEm: AGORA,
  atualizadoEm: AGORA,
  observacao: `Meta diária: ${meta} ${unidade}. Estacas de ${ESTACA} m.`,
} satisfies PlanejamentoItem));

const servicos = Array.from(new Map(itens.map(item => [item.servicoId, item])).values()).map(item => ({
  id: item.servicoId,
  descricao: item.servicoDescricao,
  unidade: item.unidade,
  quantidadePrevista: itens.filter(linha => linha.servicoId === item.servicoId).reduce((total, linha) => total + linha.quantidadePlanejada, 0),
  situacao: 'Ativo' as const,
  ativo: true,
  criadoEm: AGORA,
  atualizadoEm: AGORA,
} satisfies ServicoObra));

export const INITIAL_PROGRAMACAO = { servicos, itens };

/**
 * A primeira carga na nuvem foi feita sem as estacas da planilha original.
 * Atividade da carga sem estaca mostra as estacas da planilha (só na tela);
 * ao salvar a atividade, elas passam a ficar gravadas nela.
 */
const ESTACAS_DA_CARGA = new Map(itens.map(item => [item.id, { estacaInicial: item.estacaInicial, estacaFinal: item.estacaFinal }]));

export const completarEstacasDaCarga = (item: PlanejamentoItem): PlanejamentoItem => {
  if (item.estacaInicial || item.estacaFinal) return item;
  const estacas = ESTACAS_DA_CARGA.get(item.id);
  return estacas ? { ...item, ...estacas } : item;
};
