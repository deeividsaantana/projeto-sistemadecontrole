import assert from 'node:assert/strict';
import type { ControleEquipamentoDiario } from '../src/types';
import {
  OPERATIONAL_DRIVER_REFERENCE,
  parseDriverList,
  reconcileOperationalDriversDay,
} from '../src/fleet/operationalDriverReference';

const date = '2026-10-16';

const makeRecord = (prefixo: string, codigoFuncionario: string, nomeMotorista: string, extra: Partial<ControleEquipamentoDiario> = {}): ControleEquipamentoDiario => ({
  id: `${prefixo}-${codigoFuncionario}-${extra.data || date}`,
  chave: `${extra.data || date}|${prefixo}`,
  data: date,
  funcionarioId: '',
  codigoFuncionario,
  nomeMotorista,
  equipamentoId: '',
  prefixo,
  familia: 'Basculantes',
  status: 'Em operação',
  horaSaida: '07:10',
  horaEntradaManutencao: '',
  horaLiberacao: '',
  observacao: '',
  origem: 'SISTEMA',
  revisao: [],
  criadoEm: `${date}T08:00:00.000Z`,
  atualizadoEm: `${date}T08:00:00.000Z`,
  ...extra,
});

// Relação padrão: a planilha de 16/10/2026, sem matrícula repetida.
assert.equal(OPERATIONAL_DRIVER_REFERENCE.length, 30);
assert.equal(new Set(OPERATIONAL_DRIVER_REFERENCE.map(item => item.matricula)).size, 30);
assert.equal(OPERATIONAL_DRIVER_REFERENCE.find(item => item.matricula === '102016')?.nome, 'JOSE APARECIDO FIRMINO');
assert.equal(OPERATIONAL_DRIVER_REFERENCE.find(item => item.matricula === '103587')?.nome, 'AGUINALDO BRAZ PAULO');

// Lista colada do Excel: matrícula e nome em qualquer ordem, com ou sem a função.
const colada = parseDriverList([
  'MATRÍCULA\tNOME\tFUNÇÃO',
  '103177\tADILSON PIRES DA CRUZ\tOPERADOR DE CAMINHAO BASCULANTE',
  'Anderson Peixoto da Silva;101671',
  '103038, APARECIDO MEIRA DA SILVA, OPERADOR',
  '103177 ADILSON PIRES DA CRUZ',
  'JOÃO SEM MATRÍCULA',
  '',
].join('\n'));
assert.deepEqual(colada.itens, [
  { matricula: '103177', nome: 'ADILSON PIRES DA CRUZ' },
  { matricula: '101671', nome: 'ANDERSON PEIXOTO DA SILVA' },
  { matricula: '103038', nome: 'APARECIDO MEIRA DA SILVA' },
]);
assert.deepEqual(colada.ignoradas, ['MATRÍCULA\tNOME\tFUNÇÃO', 'JOÃO SEM MATRÍCULA']);

const resultado = reconcileOperationalDriversDay([
  makeRecord('CB726', '103177', 'ADILSON PIRES DA CRUZ'),
  // Mesmo operador em dois caminhões no mesmo dia.
  makeRecord('CB727', '103177', 'ADILSON PIRES DA CRUZ', { horaSaida: '13:00', atualizadoEm: `${date}T13:00:00.000Z` }),
  // Sem matrícula no lançamento, casa pelo nome (com acento e espaço sobrando).
  makeRecord('CB730', '', 'Anderson  Peixoto da Sílva', { status: 'Em manutenção' }),
  // Lançamento excluído e de outro dia não contam.
  { ...makeRecord('CB732', '103038', 'APARECIDO MEIRA DA SILVA'), excluido: true } as ControleEquipamentoDiario,
  makeRecord('CB735', '103038', 'APARECIDO MEIRA DA SILVA', { data: '2026-10-15' }),
  makeRecord('CB738', '999999', 'FULANO FORA DA RELACAO'),
  // Operador de escavadeira não é cobrado na relação de basculantes.
  makeRecord('ES010', '888888', 'OPERADOR DA ESCAVADEIRA', { familia: 'Escavadeira' }),
], date, colada.itens);

assert.equal(resultado.total, 3);
assert.equal(resultado.informed, 2);
assert.equal(resultado.missing, 1);
assert.equal(resultado.operating, 1);
assert.deepEqual(resultado.missingItems.map(item => item.matricula), ['103038']);
assert.deepEqual(resultado.items[0].prefixes, ['CB726', 'CB727']);
assert.equal(resultado.items[0].departureTime, '13:00');
assert.deepEqual(resultado.duplicateDrivers, ['ADILSON PIRES DA CRUZ']);
assert.deepEqual(resultado.unexpectedDrivers, ['FULANO FORA DA RELACAO']);
