import assert from 'node:assert/strict';
import {
  analyzeMasterRows,
  type ExistingMasterIndex,
  type MasterWorkbookSourceRow,
} from '../src/masterData/masterWorkbook';

const existingIndex: ExistingMasterIndex = {
  companies: new Map(),
  suppliers: new Map(),
  materials: new Map(),
  locations: new Map([['canteiro central', ['obra-1']]]),
  work_branches: new Map(),
  collaborators: new Map(),
  equipment: new Map(),
  vehicles: new Map(),
};

const row = (
  sheetName: string,
  rowNumber: number,
  raw: Record<string, string>,
): MasterWorkbookSourceRow => ({ sheetName, rowNumber, raw });

const rows = analyzeMasterRows({
  companies: [
    row('CAD_EMPRESAS', 2, { 'ID Empresa': 'EMP-1', Nome: 'RENEA', CNPJ: '12.345.678/0001-90', Status: 'ATIVO' }),
    row('CAD_EMPRESAS', 3, { 'ID Empresa': 'EMP-2', Nome: 'Renea Infraestrutura', CNPJ: '12.345.678/0001-90', Status: 'ATIVO' }),
  ],
  suppliers: [
    row('CAD_FORNECEDORES', 2, { 'ID Fornecedor': 'FOR-1', Fornecedor: '', CNPJ: '', Status: 'ATIVO' }),
  ],
  materials: [
    row('CAD_MATERIAIS', 2, { 'ID Mestre': 'MAT-1', 'Código original': 'BR-01', 'Descrição completa': 'Brita 1', 'Unidade padrão': '' }),
  ],
  locations: [
    row('CAD_LOCAIS', 2, { 'ID Local': 'LOC-1', Local: 'Canteiro Central', Tipo: 'CANTEIRO', Status: 'ATIVO' }),
  ],
}, existingIndex);

assert.equal(rows.length, 5);

const companies = rows.filter(item => item.entity === 'companies');
assert.equal(companies.length, 2);
assert.equal(companies[0].status, 'duplicate');
assert.equal(companies[1].status, 'duplicate');
assert.deepEqual(companies[0].aliases, ['RENEA', 'Renea Infraestrutura']);
assert.equal(companies[0].canonicalKey, '12345678000190');

const supplier = rows.find(item => item.entity === 'suppliers');
assert.equal(supplier?.status, 'invalid');
assert.match(supplier?.reviewNote || '', /Fornecedor não informado/);

const material = rows.find(item => item.entity === 'materials');
assert.equal(material?.status, 'invalid');
assert.match(material?.reviewNote || '', /Unidade padrão não informada/);

const location = rows.find(item => item.entity === 'locations');
assert.equal(location?.status, 'matched');
assert.deepEqual(location?.candidateRecordIds, ['obra-1']);

const fleetRows = analyzeMasterRows({
  equipment: [
    row('SGE', 2, {
      Frota: 'CB726',
      Dpara: '726',
      Equipamento: 'Caminhão Basculante',
      Familia: 'Basculantes',
      Mobilizado: 'TRUE',
      MetaDispMec: '0,8',
      Empresa: 'Renea',
      Status: 'Ativo',
    }),
  ],
  vehicles: [
    row('CAD_VEICULOS', 2, {
      'ID Veículo': 'VEI-1',
      Prefixo: 'CB726',
      Placa: 'EFO7547',
      Equipamento: 'Caminhão Basculante',
      Família: 'Basculantes',
      Empresa: 'Renea',
      Status: 'ATIVO',
    }),
    row('CAD_VEICULOS', 3, {
      'ID Veículo': 'VEI-2',
      Prefixo: 'CB740',
      Placa: 'EFO7547',
      Equipamento: 'Caminhão Basculante',
      Família: 'Basculantes',
      Empresa: 'Renea',
      Status: 'ATIVO',
    }),
  ],
}, existingIndex);

const sgeEquipment = fleetRows.find(item => item.entity === 'equipment');
assert.equal(sgeEquipment?.status, 'ready');
assert.equal(sgeEquipment?.normalized.external_sge_code, '726');
assert.equal(sgeEquipment?.normalized.availability_target, 0.8);
assert.equal(sgeEquipment?.normalized.fleet_kind, 'vehicle');

const vehicles = fleetRows.filter(item => item.entity === 'vehicles');
assert.equal(vehicles.length, 2);
assert.equal(vehicles[0].status, 'duplicate');
assert.equal(vehicles[1].status, 'duplicate');
assert.match(vehicles[0].reviewNote, /Placa repetida/);
