import assert from 'node:assert/strict';
import test from 'node:test';
import {
  estaAtrasada,
  origensSemTratativa,
  painelNaoConformidades,
  proximoNumeroNc,
  validarNaoConformidade,
} from '../src/utils/naoConformidades';
import type { FichaVerificacaoServico, Inspecao, NaoConformidade } from '../src/types';

const nc = (extra: Partial<NaoConformidade> = {}): NaoConformidade => ({
  id: 'n1',
  numero: 'NC-2026-0001',
  data: '2026-01-05',
  origem: 'Interna',
  descricao: 'Concreto fora da especificação',
  situacao: 'Aberta',
  prazo: '2026-01-10',
  registradoPor: 'Deivid',
  ativo: true,
  criadoEm: '2026-01-05',
  atualizadoEm: '2026-01-05',
  ...extra,
});

const ficha = (extra: Partial<FichaVerificacaoServico> = {}): FichaVerificacaoServico => ({
  id: 'f1',
  numero: 'FVS-2026-0001',
  data: '2026-01-04',
  modeloId: 'm1',
  modeloNome: 'Verificação',
  local: 'Estaca 10',
  itens: [],
  situacao: 'Reprovada',
  responsavel: 'Deivid',
  ativo: true,
  criadoEm: '2026-01-04',
  atualizadoEm: '2026-01-04',
  ...extra,
});

const inspecao = (extra: Partial<Inspecao> = {}): Inspecao => ({
  id: 'i1',
  numero: 'INSP-2026-0001',
  data: '2026-01-03',
  tipo: 'Segurança',
  gravidade: 'Alta',
  situacao: 'Aberta',
  local: 'Frente 1',
  descricao: 'Talude sem sinalização',
  inspetor: 'Deivid',
  ativo: true,
  criadoEm: '2026-01-03',
  atualizadoEm: '2026-01-03',
  ...extra,
});

test('origens pendentes somem quando a NC já existe', () => {
  const pendentes = origensSemTratativa([ficha()], [inspecao()], []);
  assert.deepEqual(pendentes.map(item => item.origem), ['FVS', 'Inspeção']);
  const tratadas = origensSemTratativa([ficha()], [inspecao()], [nc({ origemId: 'f1' })]);
  assert.deepEqual(tratadas.map(item => item.origem), ['Inspeção']);
});

test('inspeção de gravidade baixa não vira pendência automática', () => {
  assert.equal(origensSemTratativa([], [inspecao({ gravidade: 'Baixa' })], []).length, 0);
  assert.equal(origensSemTratativa([ficha({ situacao: 'Aprovada' })], [], []).length, 0);
});

test('atraso e painel derivam do prazo e da situação', () => {
  assert.equal(estaAtrasada(nc(), '2026-01-12'), true);
  assert.equal(estaAtrasada(nc({ situacao: 'Encerrada' }), '2026-01-12'), false);
  const painel = painelNaoConformidades([
    nc(),
    nc({ id: 'n2', situacao: 'Encerrada', eficaz: false }),
    nc({ id: 'n3', ativo: false }),
  ], '2026-01-12');
  assert.deepEqual(painel, { total: 2, abertas: 1, atrasadas: 1, encerradas: 1, ineficazes: 1 });
});

test('encerrar exige causa, ação e veredito de eficácia', () => {
  const base = { data: '2026-01-05', descricao: 'x', situacao: 'Encerrada' as const, prazo: undefined };
  assert.match(String(validarNaoConformidade({ ...base, causaRaiz: '', acaoCorretiva: 'a', eficaz: true })), /causa raiz/);
  assert.match(String(validarNaoConformidade({ ...base, causaRaiz: 'c', acaoCorretiva: '', eficaz: true })), /ação corretiva/);
  assert.match(String(validarNaoConformidade({ ...base, causaRaiz: 'c', acaoCorretiva: 'a', eficaz: undefined })), /eficaz/);
  assert.equal(validarNaoConformidade({ ...base, causaRaiz: 'c', acaoCorretiva: 'a', eficaz: true }), null);
});

test('numeração sequencial por ano', () => {
  assert.equal(proximoNumeroNc([], 2026), 'NC-2026-0001');
  assert.equal(proximoNumeroNc([nc({ numero: 'NC-2026-0004' })], 2026), 'NC-2026-0005');
});
