import assert from 'node:assert/strict';
import test from 'node:test';
import type { EtapaServico, MovimentoMaterial } from '../src/types';
import {
  COR_OUTROS,
  CONTAR_LANCAMENTOS,
  CORES_PIZZA,
  classificadorDeRamo,
  classificarPorFornecedor,
  classificarPorMaterial,
  coresFixas,
  medidasDisponiveis,
  mesesComLancamento,
  montarPizza,
  pizzaDeCusto,
  pizzaPor,
  porcentagensInteiras,
} from '../src/modules/materials/graficosMateriais';

const mov = (id: string, extra: Partial<MovimentoMaterial>): MovimentoMaterial => ({
  id, data: '2026-09-10', tipo: 'Entrada', materialId: 'rachao', materialDescricao: 'RACHÃO PRIMÁRIO', quantidade: 10, unidade: 't',
  responsavel: 'x', criadoEm: id, ...extra,
});

const parte = (chave: string, valor: number) => ({ chave, nome: chave.toUpperCase(), valor, lancamentos: 1 });

test('as porcentagens inteiras sempre somam 100', () => {
  assert.deepEqual(porcentagensInteiras([1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(porcentagensInteiras([0, 0]), [0, 0]);
  const muitas = porcentagensInteiras([7, 13, 29, 3, 48, 0.4]);
  assert.equal(muitas.reduce((soma, valor) => soma + valor, 0), 100);
});

test('cinco partes têm cor, o resto vira "Outros" cinza; sobrando uma, ela fica com o nome', () => {
  const pizza = montarPizza([...['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((chave, indice) => parte(chave, 70 - indice * 10)), parte('h', 0)]);
  assert.equal(pizza.fatias.length, 6);
  assert.equal(pizza.fatias[5].nome, 'Outros (2)');
  assert.equal(pizza.fatias[5].valor, 30);
  assert.equal(pizza.fatias[5].cor, COR_OUTROS);
  assert.deepEqual(pizza.fatias.slice(0, 5).map(fatia => fatia.cor), [...CORES_PIZZA]);
  assert.equal(pizza.todas.length, 7, 'parte com zero não entra');
  assert.equal(pizza.fatias.reduce((soma, fatia) => soma + fatia.percentual, 0), 100);

  const seis = montarPizza(['a', 'b', 'c', 'd', 'e', 'f'].map((chave, indice) => parte(chave, 60 - indice * 10)));
  assert.equal(seis.fatias[5].nome, 'F');
});

test('a cor segue a parte quando o mês muda a ordem', () => {
  const cores = coresFixas(['b', 'z', 'a'], ['a', 'b', 'c']);
  assert.equal(cores.get('a'), CORES_PIZZA[0]);
  assert.equal(cores.get('b'), CORES_PIZZA[1]);
  assert.equal(cores.get('z'), CORES_PIZZA[2], 'quem não tinha cor pega a primeira livre');
});

test('pizza por material não mistura unidades e conta o que ficou de fora', () => {
  const movimentos = [
    mov('a', { quantidade: 30 }),
    mov('b', { materialId: 'brita', materialDescricao: 'BRITA 1', quantidade: 10, unidade: 'ton' }),
    mov('c', { materialId: 'areia', materialDescricao: 'AREIA', quantidade: 8, unidade: 'M³' }),
    mov('d', { data: '2026-08-01', quantidade: 500 }),
    mov('e', { canceladoEm: '2026-09-11', quantidade: 999 }),
    mov('f', { tipo: 'Saída', quantidade: 5 }),
  ];
  const pizza = pizzaPor(movimentos, { tipo: 'Entrada', mes: '2026-09', medida: 't' }, classificarPorMaterial);
  assert.deepEqual(pizza.fatias.map(fatia => [fatia.nome, fatia.valor, fatia.percentual]), [['RACHÃO PRIMÁRIO', 30, 75], ['BRITA 1', 10, 25]]);
  assert.equal(pizza.deFora, 1, 'a areia em m³ fica de fora');

  const contando = pizzaPor(movimentos, { tipo: 'Entrada', mes: '', medida: CONTAR_LANCAMENTOS }, classificarPorMaterial);
  assert.equal(contando.total, 4);
  assert.equal(contando.fatias[0].valor, 2);
});

test('medidas vêm da mais usada, e "contar lançamentos" fica no fim', () => {
  const medidas = medidasDisponiveis([mov('a', {}), mov('b', { unidade: 'TON' }), mov('c', { unidade: 'm3' })]);
  assert.deepEqual(medidas.map(item => [item.medida, item.sigla, item.lancamentos]), [['t', 't', 2], ['m3', 'm³', 1], [CONTAR_LANCAMENTOS, '', 3]]);
});

test('fornecedor, ramo e custo', () => {
  const etapas: EtapaServico[] = [
    { id: 'r9', nome: 'RAMO 900', tipoLocal: 'Ramo' } as EtapaServico,
    { id: 'cs9', nome: 'CS RAMO 900', tipoLocal: 'Frente', ramo: 'RAMO 900' } as EtapaServico,
    { id: 'est', nome: 'ESTOQUE CENTRAL', tipoLocal: 'Estoque' } as EtapaServico,
  ];
  const movimentos = [
    mov('a', { destino: 'CS RAMO 900', fornecedorNome: 'PEDRA FORTE', valorTotal: 1000 }),
    mov('b', { etapaServicoId: 'r9', fornecedorNome: 'PEDRA FORTE', valorUnitario: 50 }),
    mov('c', { destino: 'ESTOQUE CENTRAL', fornecedorNome: 'EMBU' }),
    mov('d', { destino: 'LUGAR NENHUM' }),
  ];
  const filtro = { tipo: 'Entrada' as const, mes: '2026-09', medida: 't' };
  const ramo = pizzaPor(movimentos, filtro, classificadorDeRamo(etapas));
  assert.deepEqual(ramo.fatias.map(fatia => [fatia.nome, fatia.valor]), [['RAMO 900', 20]]);
  assert.equal(ramo.deFora, 2);

  const fornecedor = pizzaPor(movimentos, filtro, classificarPorFornecedor);
  assert.deepEqual(fornecedor.fatias.map(fatia => [fatia.nome, fatia.percentual]), [['PEDRA FORTE', 67], ['EMBU', 33]]);
  assert.equal(fornecedor.deFora, 1);

  const custo = pizzaDeCusto(movimentos, filtro);
  assert.equal(custo.total, 1500);
  assert.equal(custo.deFora, 2);
});

test('meses com lançamento, do mais novo para o mais antigo', () => {
  assert.deepEqual(mesesComLancamento([mov('a', { data: '2026-07-01' }), mov('b', {}), mov('c', { data: '2026-06-01', canceladoEm: 'x' })]), ['2026-09', '2026-07']);
});
