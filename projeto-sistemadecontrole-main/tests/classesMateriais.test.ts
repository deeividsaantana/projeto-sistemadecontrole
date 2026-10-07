import assert from 'node:assert/strict';
import test from 'node:test';
import type { Material } from '../src/types';
import { classeDoMaterial, resumoPorTipo, tipoDoMaterial } from '../src/modules/materials/classesMateriais';
import type { MaterialBranchUsage } from '../src/modules/materials/materialUsage';

const material = (id: string, descricao: string, extra: Partial<Material> = {}): Material => ({ id, codigo: id, descricao, categoria: '', unidade: 'MT', ativo: true, criadoEm: '', atualizadoEm: '', ...extra });

test('classe sai do nome: tubo de concreto, PEAD, madeira, agregado e o resto', () => {
  assert.equal(classeDoMaterial(material('a', 'TUBO DE CONCRETO Ø800 PA4 1,50 m')), 'Tubo de concreto');
  assert.equal(classeDoMaterial(material('b', 'TUBO DE CONCRETO PA3 DN1000')), 'Tubo de concreto');
  assert.equal(classeDoMaterial(material('c', 'TUBO PEAD KANANET DN 100')), 'Tubo PEAD e PVC');
  assert.equal(classeDoMaterial(material('d', 'ESTACA MADEIRA C/ PONTA')), 'Madeira');
  assert.equal(classeDoMaterial(material('e', 'CHAPA PLASTIFICADO 18MM')), 'Madeira');
  assert.equal(classeDoMaterial(material('f', 'BRITA 1')), 'Agregados');
  assert.equal(classeDoMaterial(material('g', 'Pedra rachão', { categoria: 'Agregado' })), 'Agregados');
  assert.equal(classeDoMaterial(material('h', 'LUVA DE RASPA')), 'Outros');
});

test('tipo do tubo é o diâmetro, do cadastro ou do nome', () => {
  assert.equal(tipoDoMaterial(material('a', 'TUBO DE CONCRETO Ø800 PA4 1,50 m')), 'Ø800');
  assert.equal(tipoDoMaterial(material('b', 'TUBO DE CONCRETO PA3', { diametroMm: 1200 })), 'Ø1200');
  assert.equal(tipoDoMaterial(material('c', 'ESTACA MADEIRA C/ PONTA')), 'ESTACA MADEIRA C/ PONTA');
});

test('60 tubos Ø800 recebidos e 50 usados em dois ramos somam 83,3% em peças', () => {
  const pa4 = material('pa4', 'TUBO DE CONCRETO Ø800 PA4 1,50 m', { comprimentoPecaM: 1.5 });
  const pa3 = material('pa3', 'TUBO DE CONCRETO Ø800 PA3 1,50 m', { comprimentoPecaM: 1.5 });
  const g1000 = material('g', 'TUBO DE CONCRETO Ø1000 PA2 1,50 m', { comprimentoPecaM: 1.5 });
  const linha = (m: Material, ramo: string, recebido: number, usado: number): MaterialBranchUsage => ({
    materialId: m.id, materialDescription: m.descricao, unit: 'MT', branchId: ramo, branchName: ramo, received: recebido, used: usado, remaining: recebido - usado, percent: null, linkedByText: 0,
  });
  const catalogo = new Map([pa4, pa3, g1000].map(item => [item.id, item]));
  const tipos = resumoPorTipo([linha(pa4, 'r1400', 60, 45), linha(pa3, 'r1300', 30, 30), linha(g1000, 'r1300', 15, 0)], catalogo);
  assert.deepEqual(tipos.map(item => item.tipo), ['Ø800', 'Ø1000']);
  assert.equal(tipos[0].unidade, 'pç');
  assert.equal(tipos[0].recebido, 60);
  assert.equal(tipos[0].usado, 50);
  assert.equal(tipos[0].percentual, 83.3);
  assert.equal(tipos[0].ramos, 2);
  assert.equal(tipos[1].percentual, 0);
  const comUsoSemEntrada = resumoPorTipo([linha(g1000, 'r1300', 15, 0), linha(g1000, 'r1400', 0, 18)], catalogo);
  assert.equal(comUsoSemEntrada[0].percentual, 0);
  assert.equal(comUsoSemEntrada[0].usadoSemEntrada, 12);
});
