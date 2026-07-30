import assert from 'node:assert/strict';
import test from 'node:test';
import {
  commitStorageBatch,
  isReneaStoredValueValid,
  parseReneaStoredJson,
} from '../src/utils/resilientStorage';
import { describeInvalidBackup, validateSystemBackup } from '../src/utils/systemBackup';

test('armazenamento resiliente aceita somente listas JSON nas tabelas operacionais', () => {
  assert.equal(isReneaStoredValueValid('renea_abastecimentos', '[{"id":"1"}]'), true);
  assert.equal(isReneaStoredValueValid('renea_abastecimentos', '{"id":"1"}'), false);
  assert.equal(isReneaStoredValueValid('renea_abastecimentos', '[quebrado'), false);
  assert.equal(isReneaStoredValueValid('renea_auto_sync', 'true'), true);
});

test('leitura segura devolve o fallback sem lançar erro', () => {
  const fallback = [{ id: 'seguro' }];
  assert.deepEqual(parseReneaStoredJson('[quebrado', fallback), fallback);
  assert.deepEqual(parseReneaStoredJson('[{"id":"ok"}]', fallback), [{ id: 'ok' }]);
});

test('backup parcial antigo é aceito quando mantém as tabelas mínimas', () => {
  const validation = validateSystemBackup({
    empresas: [],
    equipamentos: [],
    abastecimentos: [],
  });
  assert.equal(validation.valid, true);
});

test('backup rejeita uma tabela conhecida com formato incorreto', () => {
  const validation = validateSystemBackup({
    empresas: [],
    equipamentos: [],
    abastecimentos: [],
    ticketsJazida: 'não é lista',
  });
  assert.equal(validation.valid, false);
  assert.match(describeInvalidBackup(validation), /ticketsJazida/);
});

test('gravação em lote reverte as chaves anteriores quando uma escrita falha', () => {
  const values = new Map<string, string>([['a', 'anterior-a'], ['b', 'anterior-b']]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (key === 'b' && value === 'novo-b') throw new Error('quota');
      values.set(key, value);
    },
    removeItem: (key: string) => { values.delete(key); },
  };

  assert.throws(() => commitStorageBatch(storage, [
    { key: 'a', value: 'novo-a' },
    { key: 'b', value: 'novo-b' },
  ]), /Nenhuma alteração parcial/);
  assert.equal(values.get('a'), 'anterior-a');
  assert.equal(values.get('b'), 'anterior-b');
});
