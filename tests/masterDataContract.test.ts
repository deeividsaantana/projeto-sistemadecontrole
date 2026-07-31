import assert from 'node:assert/strict';
import {
  assertMasterDataEntity,
  assertRoleCan,
  MASTER_DATA_ENTITY_NAMES,
  normalizeStaffRole,
  resolveOrganizationId,
  sanitizeImportRequest,
  sanitizeMasterImportRequest,
  sanitizeTravelImportRequest,
  sanitizeMasterDataPayload,
  sanitizeSearchTerm,
} from '../netlify/functions/_shared/master-data-contract.js';

assert.equal(MASTER_DATA_ENTITY_NAMES.length, 12);
assert.equal(assertMasterDataEntity('equipment').definition.table, 'equipment');
assert.throws(() => assertMasterDataEntity('abastecimentos'));

assert.equal(normalizeStaffRole('gestor'), 'gestor');
assert.equal(normalizeStaffRole('perfil-legado'), 'admin');
assert.equal(assertRoleCan('operador', 'update'), 'operador');
assert.throws(() => assertRoleCan('operador', 'archive'));
assert.equal(assertRoleCan('leitura', 'read'), 'leitura');
assert.throws(() => assertRoleCan('leitura', 'create'));

assert.equal(
  resolveOrganizationId(
    { organization_id: '8a6b34d6-3362-4da2-9a4f-16db27be1fb2' },
    'c096de6a-5b14-4ef4-86ab-fc89722d7881',
  ),
  '8a6b34d6-3362-4da2-9a4f-16db27be1fb2',
);
assert.equal(
  resolveOrganizationId({}, 'c096de6a-5b14-4ef4-86ab-fc89722d7881'),
  'c096de6a-5b14-4ef4-86ab-fc89722d7881',
);
assert.throws(() => resolveOrganizationId({}, ''));

assert.deepEqual(
  sanitizeMasterDataPayload('companies', {
    legacy_id: 'empresa-1',
    name: 'RENEA Infraestrutura',
    company_type: 'owner',
    active: true,
  }),
  {
    legacy_id: 'empresa-1',
    name: 'RENEA Infraestrutura',
    company_type: 'owner',
    active: true,
  },
);
assert.throws(() => sanitizeMasterDataPayload('companies', { company_type: 'owner' }));
assert.throws(() => sanitizeMasterDataPayload('companies', { name: 'Empresa', campo_inventado: true }));
assert.throws(() => sanitizeMasterDataPayload('equipment', { prefix: 'EQ-01', name: 'Escavadeira', available_hours: -1 }));
assert.deepEqual(
  sanitizeMasterDataPayload('materials', { name: 'Brita 1', default_unit: 'm³', density: '1,55' }),
  { name: 'Brita 1', default_unit: 'm³', density: 1.55 },
);

assert.equal(sanitizeSearchTerm('  Bomba *(01), "S10"  '), 'Bomba 01 S10');

const importRequest = sanitizeImportRequest({
  sourceName: 'CONTROLE DE ESTACAS.xlsx',
  sourceType: 'xlsx',
  entity: 'equipment',
  worksheetName: 'RECEBIMENTO',
  rows: [
    { rowNumber: 8, prefixo: '', aviso: 'Prefixo não localizado' },
    { rowNumber: 9, prefixo: 'EQ-01' },
  ],
});
assert.equal(importRequest.rows.length, 2);
assert.equal(importRequest.rows[0].rowNumber, 8);
assert.equal(importRequest.entity, 'equipment');

const stagedRequest = sanitizeMasterImportRequest({
  sourceName: 'PLANILHA MESTRE DE CADASTROS DE CONTROLE.xlsx',
  sourceType: 'master-workbook',
  entity: 'companies',
  worksheetName: 'CAD_EMPRESAS',
  rows: [{ rowNumber: 2, status: 'ready', raw: { Nome: 'RENEA' } }],
});
assert.equal(stagedRequest.entity, 'companies');
assert.equal(stagedRequest.rows.length, 1);
const stagedEquipment = sanitizeMasterImportRequest({
  sourceName: 'PLANILHA MESTRE.xlsx',
  entity: 'equipment',
  worksheetName: 'CAD_EQUIPAMENTOS',
  rows: [{ rowNumber: 2 }],
});
assert.equal(stagedEquipment.entity, 'equipment');
const stagedTravel = sanitizeTravelImportRequest({
  sourceName: 'VIAGENS JAZIDA SABESP.xlsx',
  worksheetName: 'LIBERAÇÃO + RECEBIMENTO',
  rows: [
    { ticketNumero: '100001', tipoTicket: 'Liberação' },
    { ticketNumero: '100001', tipoTicket: 'Recebimento' },
  ],
});
assert.equal(stagedTravel.entity, 'travel_tickets');
assert.equal(stagedTravel.sourceType, 'travel-system');
assert.equal(stagedTravel.rows.length, 2);
assert.deepEqual(
  sanitizeMasterDataPayload('equipment', {
    prefix: 'CB726',
    name: 'Caminhão Basculante',
    fleet_kind: 'vehicle',
    external_sge_code: '726',
    availability_target: 0.8,
    mobilized: true,
    tank_capacity_liters: 400,
  }),
  {
    prefix: 'CB726',
    name: 'Caminhão Basculante',
    fleet_kind: 'vehicle',
    external_sge_code: '726',
    availability_target: 0.8,
    mobilized: true,
    tank_capacity_liters: 400,
  },
);
