import assert from 'node:assert/strict';
import test from 'node:test';
import { contarPor, ehSensivel, filtrarLogs, resumoAuditoria, telasDosLogs } from '../src/utils/auditoria';
import type { HistoryLog } from '../src/types';

const log = (extra: Partial<HistoryLog> = {}): HistoryLog => ({
  id: 'l1',
  timestamp: '2026-01-10T10:00:00.000Z',
  usuario: 'deivid',
  acao: 'Editou',
  tela: 'Frota',
  descricao: 'Alterou o prefixo',
  ...extra,
});

test('ação destrutiva e tela sensível marcam o log como sensível', () => {
  assert.equal(ehSensivel(log()), false);
  assert.equal(ehSensivel(log({ acao: 'Excluiu' })), true);
  assert.equal(ehSensivel(log({ tela: 'Medições' })), true);
});

test('filtros combinam período, usuário, tela e busca sem acento', () => {
  const logs = [
    log(),
    log({ id: 'l2', timestamp: '2026-01-12T08:00:00.000Z', usuario: 'ana', tela: 'Medições', descricao: 'Aprovou a medição MED-2026-001' }),
    log({ id: 'l3', timestamp: '2025-12-31T10:00:00.000Z' }),
  ];
  assert.deepEqual(filtrarLogs(logs, { inicio: '2026-01-01' }).map(item => item.id), ['l2', 'l1']);
  assert.deepEqual(filtrarLogs(logs, { usuario: 'ana' }).map(item => item.id), ['l2']);
  assert.deepEqual(filtrarLogs(logs, { busca: 'medicao' }).map(item => item.id), ['l2']);
  assert.deepEqual(filtrarLogs(logs, { somenteSensiveis: true }).map(item => item.id), ['l2']);
});

test('resumo e contagens saem do próprio log, sem contador salvo', () => {
  const logs = [log(), log({ id: 'l2', acao: 'Excluiu' }), log({ id: 'l3', usuario: 'ana', tela: 'Custos' })];
  assert.deepEqual(resumoAuditoria(logs), { total: 3, sensiveis: 2, exclusoes: 1, usuarios: 2, telas: 2 });
  assert.deepEqual(contarPor(logs, item => item.usuario)[0], { grupo: 'deivid', quantidade: 2 });
  assert.deepEqual(telasDosLogs(logs), ['Custos', 'Frota']);
});
