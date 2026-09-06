import assert from 'node:assert/strict';
import test from 'node:test';
import {
  impactoSugerido,
  ocorrenciasDoDia,
  painelOcorrencias,
  proximoNumeroOcorrencia,
  validarOcorrencia,
} from '../src/utils/ocorrencias';
import type { Ocorrencia } from '../src/types';

const ocorrencia = (extra: Partial<Ocorrencia> = {}): Ocorrencia => ({
  id: 'o1',
  numero: 'OC-2026-0001',
  data: '2026-01-05',
  tipo: 'Quebra de equipamento',
  impacto: 'Médio',
  situacao: 'Registrada',
  descricao: 'Escavadeira parou por falha hidráulica',
  horasParadas: 3,
  registradoPor: 'Deivid',
  ativo: true,
  criadoEm: '2026-01-05',
  atualizadoEm: '2026-01-05',
  ...extra,
});

test('ocorrências do dia ignoram inativas e ordenam por hora', () => {
  const lista = ocorrenciasDoDia([
    ocorrencia({ id: 'o1', hora: '14:00' }),
    ocorrencia({ id: 'o2', hora: '08:00' }),
    ocorrencia({ id: 'o3', data: '2026-01-06' }),
    ocorrencia({ id: 'o4', ativo: false }),
  ], '2026-01-05');
  assert.deepEqual(lista.map(item => item.id), ['o2', 'o1']);
});

test('painel soma horas paradas e agrupa por tipo no período', () => {
  const painel = painelOcorrencias([
    ocorrencia(),
    ocorrencia({ id: 'o2', tipo: 'Clima', horasParadas: 2, situacao: 'Resolvida' }),
    ocorrencia({ id: 'o3', tipo: 'Acidente', horasParadas: 0, providencia: 'CAT emitida' }),
    ocorrencia({ id: 'o4', data: '2026-02-01', horasParadas: 10 }),
  ], '2026-01-01', '2026-01-31');
  assert.equal(painel.total, 3);
  assert.equal(painel.emAberto, 2);
  assert.equal(painel.horasParadas, 5);
  assert.equal(painel.acidentes, 1);
  assert.equal(painel.porTipo[0].quantidade, 1);
});

test('impacto sugerido cresce com as horas paradas e acidente é sempre alto', () => {
  assert.equal(impactoSugerido('Clima', 0), 'Sem impacto');
  assert.equal(impactoSugerido('Clima', 0.5), 'Baixo');
  assert.equal(impactoSugerido('Clima', 2), 'Médio');
  assert.equal(impactoSugerido('Clima', 6), 'Alto');
  assert.equal(impactoSugerido('Acidente', 0), 'Alto');
});

test('acidente e resolvida exigem providência; horas paradas têm limite', () => {
  assert.match(String(validarOcorrencia({ ...ocorrencia({ tipo: 'Acidente' }) })), /providência/);
  assert.match(String(validarOcorrencia({ ...ocorrencia({ situacao: 'Resolvida' }) })), /providência/);
  assert.match(String(validarOcorrencia({ ...ocorrencia({ horasParadas: 30 }) })), /24 horas/);
  assert.equal(validarOcorrencia({ ...ocorrencia({ situacao: 'Resolvida', providencia: 'Mangueira trocada' }) }), null);
});

test('numeração sequencial por ano', () => {
  assert.equal(proximoNumeroOcorrencia([], 2026), 'OC-2026-0001');
  assert.equal(proximoNumeroOcorrencia([ocorrencia({ numero: 'OC-2026-0021' })], 2026), 'OC-2026-0022');
});
