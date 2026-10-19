import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Equipamento } from '../src/types';
import { buildMacroFuelingRecord } from '../src/utils/fuelMacroForm';

const base = {
  records: [], data: '2026-10-19', hora: '0930', litros: '120', horimetro: '', km: '',
  tipoCombustivelId: 'diesel', comboioId: 'C1', responsavel: 'Deivid', bombaInicialManual: '1.000', nowIso: '2026-10-19T12:30:00.000Z',
};

test('diesel aceita prefixo sem cadastro e guarda o prefixo digitado', () => {
  const registro = buildMacroFuelingRecord({ ...base, id: 'a1', prefixo: ' cb999 ' });
  assert.equal(registro.equipamentoId, '');
  assert.equal(registro.prefixoInformado, 'CB999');
  assert.equal(registro.quantidadeLitros, 120);
  assert.equal(registro.bombaFinal, 1120);
});

test('com cadastro, o prefixo do cadastro vale', () => {
  const equipment = { id: 'eq1', prefixo: 'LO279' } as Equipamento;
  const registro = buildMacroFuelingRecord({ ...base, id: 'a2', equipment, prefixo: 'lo279' });
  assert.equal(registro.equipamentoId, 'eq1');
  assert.equal(registro.prefixoInformado, 'LO279');
});

test('a tela de lançamento não barra mais prefixo sem cadastro', () => {
  const tela = readFileSync('src/components/combustivel/LancamentoCombustivel.tsx', 'utf8');
  assert.doesNotMatch(tela, /if \(!equipamento\) \{ setErro/);
  assert.match(tela, /Pode lançar assim/);
});
