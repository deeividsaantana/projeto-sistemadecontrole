import assert from 'node:assert/strict';
import test from 'node:test';
import { diasParaPrazo, estaAtrasada, painelInspecoes, proximoNumeroInspecao, validarInspecao } from '../src/utils/inspecoes';
import type { Inspecao } from '../src/types';

const inspecao = (extra: Partial<Inspecao> = {}): Inspecao => ({
  id: 'i1',
  numero: 'INSP-2026-0001',
  data: '2026-01-05',
  tipo: 'Segurança',
  gravidade: 'Alta',
  situacao: 'Aberta',
  local: 'Frente 1',
  descricao: 'Talude sem sinalização',
  prazo: '2026-01-10',
  inspetor: 'Deivid',
  ativo: true,
  criadoEm: '2026-01-05',
  atualizadoEm: '2026-01-05',
  ...extra,
});

test('atraso vem do prazo, não de um campo salvo', () => {
  assert.equal(estaAtrasada(inspecao(), '2026-01-12'), true);
  assert.equal(estaAtrasada(inspecao(), '2026-01-08'), false);
  assert.equal(estaAtrasada(inspecao({ prazo: undefined }), '2026-01-30'), false);
  assert.equal(estaAtrasada(inspecao({ situacao: 'Corrigida' }), '2026-01-30'), false);
});

test('dias para o prazo funcionam antes e depois do vencimento', () => {
  assert.equal(diasParaPrazo(inspecao(), '2026-01-08'), 2);
  assert.equal(diasParaPrazo(inspecao(), '2026-01-12'), -2);
  assert.equal(diasParaPrazo(inspecao({ prazo: undefined }), '2026-01-08'), undefined);
});

test('painel conta abertas, atrasadas e gravidade', () => {
  const painel = painelInspecoes([
    inspecao(),
    inspecao({ id: 'i2', gravidade: 'Baixa', prazo: '2026-01-30' }),
    inspecao({ id: 'i3', situacao: 'Corrigida' }),
    inspecao({ id: 'i4', ativo: false }),
  ], '2026-01-12');
  assert.equal(painel.total, 3);
  assert.equal(painel.abertas, 2);
  assert.equal(painel.atrasadas, 1);
  assert.equal(painel.corrigidas, 1);
  assert.deepEqual(painel.porGravidade, { Baixa: 1, Média: 0, Alta: 1 });
});

test('fechar sem ação corretiva é recusado e prazo não retrocede', () => {
  assert.match(String(validarInspecao({ ...inspecao(), situacao: 'Corrigida' })), /ação corretiva/);
  assert.equal(validarInspecao({ ...inspecao(), situacao: 'Corrigida', acaoCorretiva: 'Sinalização instalada' }), null);
  assert.match(String(validarInspecao({ ...inspecao({ prazo: '2026-01-01' }) })), /anterior à inspeção/);
});

test('numeração sequencial por ano', () => {
  assert.equal(proximoNumeroInspecao([], 2026), 'INSP-2026-0001');
  assert.equal(proximoNumeroInspecao([inspecao({ numero: 'INSP-2026-0012' })], 2026), 'INSP-2026-0013');
});
