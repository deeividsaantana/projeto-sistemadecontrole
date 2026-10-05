import assert from 'node:assert/strict';
import test from 'node:test';
import { alertasDoSistema } from '../src/utils/alertas';
import type { DocumentoArquivo, Inspecao } from '../src/types';

const contexto = { hoje: '2026-01-15', inicio: '2026-01-01', fim: '2026-01-31' };

const documentoVencido: DocumentoArquivo = {
  id: 'd1', titulo: 'CNH', tipo: 'CNH', vinculo: 'Colaborador', vinculoId: 'c1',
  validade: '2026-01-01', responsavel: 'D', ativo: true, criadoEm: '', atualizadoEm: '',
};

const inspecaoAtrasada: Inspecao = {
  id: 'i1', numero: 'INSP-1', data: '2026-01-02', tipo: 'Segurança', gravidade: 'Alta',
  situacao: 'Aberta', local: 'F1', descricao: 'x', prazo: '2026-01-05', inspetor: 'D',
  ativo: true, criadoEm: '', atualizadoEm: '',
};

test('só gravidade alta vira alerta do sino', () => {
  const alertas = alertasDoSistema({
    ...contexto,
    documentos: [documentoVencido, { ...documentoVencido, id: 'd2', validade: '2026-02-01' }],
  });
  assert.deepEqual(alertas.map(item => item.id), ['documentos-vencidos']);
  assert.equal(alertas[0].quantidade, 1);
  assert.equal(alertas[0].tab, 'documentos');
});

test('alerta some quando a origem é resolvida', () => {
  assert.equal(alertasDoSistema({ ...contexto, inspecoes: [inspecaoAtrasada] }).length, 2);
  assert.equal(alertasDoSistema({ ...contexto, inspecoes: [{ ...inspecaoAtrasada, situacao: 'Corrigida' }] }).length, 0);
});

test('sem dados não existe alerta', () => {
  assert.deepEqual(alertasDoSistema(contexto), []);
});
