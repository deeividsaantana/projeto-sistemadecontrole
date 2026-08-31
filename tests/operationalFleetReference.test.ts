import assert from 'node:assert/strict';
import type { ControleEquipamentoDiario } from '../src/types';
import {
  OPERATIONAL_FLEET_REFERENCE,
  reconcileOperationalFleetDay,
} from '../src/fleet/operationalFleetReference';

const date = '2026-08-31';
const informedPrefixes = OPERATIONAL_FLEET_REFERENCE
  .map(item => item.prefix)
  .filter(prefix => !['CB732', 'CB743', 'CB748', 'CP057', 'CP075', 'CA019', 'CV041'].includes(prefix));

const makeRecord = (prefix: string, id = prefix): ControleEquipamentoDiario => ({
  id,
  chave: `${date}|${prefix}`,
  data: date,
  funcionarioId: '',
  codigoFuncionario: '',
  nomeMotorista: '',
  equipamentoId: '',
  prefixo: prefix,
  familia: prefix.startsWith('CB') ? 'Basculantes' : 'Apoio',
  status: 'Em operação',
  horaSaida: '',
  horaEntradaManutencao: '',
  horaLiberacao: '',
  observacao: '',
  origem: 'SISTEMA',
  revisao: [],
  criadoEm: `${date}T08:00:00.000Z`,
  atualizadoEm: `${date}T08:00:00.000Z`,
});

assert.equal(OPERATIONAL_FLEET_REFERENCE.length, 39);
assert.equal(new Set(OPERATIONAL_FLEET_REFERENCE.map(item => item.prefix)).size, 39);
assert.equal(OPERATIONAL_FLEET_REFERENCE.filter(item => item.group === 'Basculantes').length, 32);
assert.equal(OPERATIONAL_FLEET_REFERENCE.filter(item => item.group === 'Apoio').length, 7);

const result = reconcileOperationalFleetDay([
  ...informedPrefixes.map(prefix => ['CB730', 'CB749', 'CB789', 'CB801'].includes(prefix)
    ? { ...makeRecord(prefix), status: 'Em manutenção' as const }
    : makeRecord(prefix)),
  makeRecord('cb726', 'duplicado-normalizado'),
  makeRecord('XX999', 'fora-da-base'),
  makeRecord('CB732', 'outra-data') as ControleEquipamentoDiario,
].map(record => record.id === 'outra-data' ? { ...record, data: '2026-08-30' } : record), date);

assert.equal(result.total, 39);
assert.equal(result.informed, 32);
assert.equal(result.missing, 7);
assert.equal(result.operating, 28);
assert.equal(result.maintenance, 4);
assert.deepEqual(result.missingItems.map(item => item.prefix), [
  'CB732', 'CB743', 'CB748', 'CP057', 'CP075', 'CA019', 'CV041',
]);
assert.deepEqual(result.duplicatePrefixes, ['CB726']);
assert.deepEqual(result.unexpectedPrefixes, ['XX999']);
