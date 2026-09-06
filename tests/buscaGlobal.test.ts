import assert from 'node:assert/strict';
import test from 'node:test';
import { buscarGlobal } from '../src/utils/buscaGlobal';
import type { Equipamento, Funcionario, NaoConformidade } from '../src/types';

const equipamento = {
  id: 'e1', prefixo: 'ESC-01', nome: 'Escavadeira', tipo: 'Escavadeira', marca: 'CAT',
  modelo: '320D', seriePlaca: 'ABC1D23', empresaId: 'emp1', localAtualId: 'o1',
  status: 'Ativo', observacao: '',
} as unknown as Equipamento;

const funcionario = {
  id: 'f1', nome: 'João da Silva', matricula: '1234', cargo: 'Operador',
  telefone: '', empresaId: 'emp1', ativo: true,
} as unknown as Funcionario;

const nc: NaoConformidade = {
  id: 'n1', numero: 'NC-2026-0001', data: '2026-01-05', origem: 'Interna',
  descricao: 'Concreto fora da especificação', situacao: 'Aberta',
  registradoPor: 'D', ativo: true, criadoEm: '', atualizadoEm: '',
};

test('termo curto não dispara busca', () => {
  assert.deepEqual(buscarGlobal('e', { equipamentos: [equipamento] }), []);
});

test('busca ignora acento e caixa e aponta para a tela de origem', () => {
  const resultados = buscarGlobal('joao', { funcionarios: [funcionario] });
  assert.equal(resultados[0].titulo, 'João da Silva');
  assert.equal(resultados[0].tab, 'colaboradores');
  assert.equal(buscarGlobal('ESPECIFICACAO', { naoConformidades: [nc] })[0].tab, 'nao-conformidades');
});

test('registro inativo não aparece na busca', () => {
  assert.equal(buscarGlobal('joao', { funcionarios: [{ ...funcionario, ativo: false }] }).length, 0);
  assert.equal(buscarGlobal('concreto', { naoConformidades: [{ ...nc, ativo: false }] }).length, 0);
});

test('busca varre vários tipos ao mesmo tempo', () => {
  const resultados = buscarGlobal('01', { equipamentos: [equipamento], naoConformidades: [nc] });
  assert.deepEqual([...new Set(resultados.map(item => item.tipo))].sort(), ['Equipamento', 'Não conformidade']);
});
