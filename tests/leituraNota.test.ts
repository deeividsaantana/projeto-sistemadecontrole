import assert from 'node:assert/strict';
import test from 'node:test';
import type { Empresa, Material } from '../src/types';
import { entradasDaNota, fornecedorDaNota, lerTextoNota, materialParecido, numeroBr } from '../src/utils/leituraNota';

const material = (id: string, descricao: string, unidade = 'UN'): Material => ({ id, codigo: id, descricao, categoria: '', unidade, ativo: true, criadoEm: '', atualizadoEm: '' } as Material);
const empresa = (id: string, nome: string, cnpj: string) => ({ id, nome, cnpj, telefone: '', responsavel: '' } as Empresa);

const DANFE = [
  'RECEBEMOS DE PEDRAFORTE MINERACAO LTDA OS PRODUTOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO',
  'NF-e Nº 000.012.345 SÉRIE 1',
  'DANFE',
  'CNPJ 12.345.678/0001-90',
  'DATA DA EMISSÃO 14/10/2026',
  'CÓDIGO DESCRIÇÃO NCM CST CFOP UN QTD V.UNIT V.TOTAL',
  '1020 BRITA 1 25171000 000 5102 M3 32,500 95,00 3.087,50',
  'A77 PEDRA RACHAO 25171000 000 5102 TON 1.200,000 60,50 72.600,00',
].join('\n');

test('número em formato brasileiro', () => {
  assert.equal(numeroBr('1.234,56'), 1234.56);
  assert.equal(numeroBr('12,5'), 12.5);
  assert.equal(numeroBr('80'), 80);
  assert.equal(numeroBr(''), 0);
});

test('lê número, data, fornecedor, CNPJ e itens de uma DANFE', () => {
  const nota = lerTextoNota(DANFE);
  assert.equal(nota.numero, '12345');
  assert.equal(nota.dataEmissao, '2026-10-14');
  assert.equal(nota.fornecedorNome, 'PEDRAFORTE MINERACAO LTDA');
  assert.equal(nota.fornecedorCnpj, '12.345.678/0001-90');
  assert.deepEqual(nota.itens, [
    { descricao: 'BRITA 1', unidade: 'M3', quantidade: 32.5, valorUnitario: 95, valorTotal: 3087.5 },
    { descricao: 'PEDRA RACHAO', unidade: 'TON', quantidade: 1200, valorUnitario: 60.5, valorTotal: 72600 },
  ]);
});

test('texto que não é nota volta vazio em vez de inventar', () => {
  const nota = lerTextoNota('foto borrada sem nada');
  assert.equal(nota.numero, '');
  assert.equal(nota.itens.length, 0);
});

test('acha o material parecido e o fornecedor pelo CNPJ ou nome', () => {
  const materiais = [material('b1', 'BRITA 1', 'M3'), material('b0', 'BRITA 0', 'M3'), material('rc', 'PEDRA RACHÃO', 'TON')];
  assert.equal(materialParecido('BRITA 1', materiais)?.id, 'b1');
  assert.equal(materialParecido('PEDRA RACHAO', materiais)?.id, 'rc');
  assert.equal(materialParecido('CIMENTO CP II', materiais), undefined);
  const empresas = [empresa('pf', 'Pedraforte', '12345678000190'), empresa('dv', 'Dovalle', '')];
  assert.equal(fornecedorDaNota({ fornecedorCnpj: '12.345.678/0001-90', fornecedorNome: '' }, empresas)?.id, 'pf');
  assert.equal(fornecedorDaNota({ fornecedorCnpj: '', fornecedorNome: 'DOVALLE TRANSPORTES' }, empresas)?.id, 'dv');
});

test('monta entradas só das linhas conferidas, com nota e fornecedor', () => {
  const materiais = [material('b1', 'BRITA 1', 'M3')];
  const movimentos = entradasDaNota(
    { numero: '12345', dataEmissao: '2026-10-14' },
    [{ materialId: 'b1', quantidade: 32.5, valorUnitario: 95 }, { materialId: '', quantidade: 3, valorUnitario: 0 }],
    materiais,
    empresa('pf', 'Pedraforte', ''),
    { hoje: '2026-10-16', responsavel: 'Deivid', agora: new Date('2026-10-16T12:00:00Z') },
  );
  assert.equal(movimentos.length, 1);
  assert.equal(movimentos[0].tipo, 'Entrada');
  assert.equal(movimentos[0].data, '2026-10-14');
  assert.equal(movimentos[0].notaFiscal, '12345');
  assert.equal(movimentos[0].fornecedorNome, 'Pedraforte');
  assert.equal(movimentos[0].valorTotal, 3087.5);
});
