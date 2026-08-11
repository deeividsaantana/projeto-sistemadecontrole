import test from 'node:test';
import assert from 'node:assert/strict';
import type { Abastecimento } from '../src/types';
import { buildFuelImportKey, filterNovelFuelImports, isPublishableFuelImport } from '../src/utils/fuelImportIdentity';

const record = (overrides: Partial<Abastecimento> = {}): Abastecimento => ({
  id: 'fuel-1', data: '2026-08-10', hora: '09:32', equipamentoId: '', prefixoInformado: 'EQ123',
  horimetroInicial: 0, kmInicial: 0, bombaInicial: 12500, quantidadeLitros: 150, bombaFinal: 12650,
  tipoCombustivelId: 'diesel-s10', comboioId: '', responsavel: 'Operação', observacao: '', ...overrides,
});

test('normaliza a chave composta sem confundir prefixos diferentes', () => {
  assert.equal(buildFuelImportKey(record()), buildFuelImportKey(record({ prefixoInformado: ' eq123 ', quantidadeLitros: 150.0000 })));
  assert.notEqual(buildFuelImportKey(record()), buildFuelImportKey(record({ prefixoInformado: 'EQ999' })));
});

test('bloqueia linhas vazias ou zeradas antes da gravação', () => {
  assert.equal(isPublishableFuelImport(record({ quantidadeLitros: 0 })), false);
  assert.equal(isPublishableFuelImport(record({ prefixoInformado: '', equipamentoId: '' })), false);
  assert.equal(isPublishableFuelImport(record({ data: '' })), false);
});

test('reimportar o mesmo lote é idempotente', () => {
  const first = filterNovelFuelImports([], [record(), record({ id: 'fuel-2' })]);
  assert.equal(first.accepted.length, 1);
  assert.equal(first.rejected.length, 1);
  const second = filterNovelFuelImports(first.accepted, [record({ id: 'fuel-3' })]);
  assert.equal(second.accepted.length, 0);
  assert.equal(second.rejected.length, 1);
});
