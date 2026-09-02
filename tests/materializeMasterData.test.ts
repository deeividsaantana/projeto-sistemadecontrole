import assert from 'node:assert/strict';
import { promoteMasterWorkbook } from '../src/masterData/materializeMasterData';
import {
  analyzeMasterRows,
  type MasterWorkbookAnalysis,
} from '../src/masterData/masterWorkbook';

const rows = analyzeMasterRows({
  equipment: [{
    sheetName: 'CAD_EQUIPAMENTOS',
    rowNumber: 2,
    raw: {
      'ID Mestre': 'EQ-01',
      Prefixo: 'CB-01',
      Placa: 'ABC1D23',
      Equipamento: 'Caminhão Basculante',
      Família: 'Basculantes',
      Empresa: 'RENEA',
      Status: 'MOBILIZADO',
      Mobilizado: 'SIM',
      'Meta disponibilidade': '85%',
      'Operador/Responsável': 'João Motorista',
      'Capacidade tanque (L)': '400',
    },
  }],
  collaborators: [{
    sheetName: 'CAD_COLABORADORES',
    rowNumber: 2,
    raw: {
      'ID Mestre': 'COL-01',
      Matrícula: '100',
      Colaborador: 'João Motorista',
      Função: 'Motorista',
      Empresa: 'RENEA',
      Status: 'ATIVO',
    },
  }],
  companies: [{
    sheetName: 'CAD_EMPRESAS',
    rowNumber: 2,
    raw: { 'ID Empresa': 'EMP-01', Nome: 'RENEA', CNPJ: '12.345.678/0001-90', Status: 'ATIVO' },
  }],
  suppliers: [{
    sheetName: 'CAD_FORNECEDORES',
    rowNumber: 2,
    raw: { 'ID Fornecedor': 'FOR-01', Fornecedor: 'Fornecedor preservado', Status: 'ATIVO' },
  }],
});

const analysis: MasterWorkbookAnalysis = {
  sourceName: 'PLANILHA MESTRE DE CADASTROS DE CONTROLE.xlsx',
  rows,
  summaries: [],
  deferredSheets: [],
  totalMasterRows: rows.length,
  totalDeferredRows: 0,
};

const promoted = promoteMasterWorkbook(analysis, {
  empresas: [],
  obras: [],
  funcionarios: [],
  equipamentos: [],
});

assert.equal(promoted.empresas.length, 2);
assert.equal(promoted.funcionarios.length, 1);
assert.equal(promoted.equipamentos.length, 1);
assert.equal(promoted.equipamentos[0].empresaId, promoted.empresas[0].id);
assert.equal(promoted.equipamentos[0].operadorResponsavelId, promoted.funcionarios[0].id);
assert.equal(promoted.equipamentos[0].metaDisponibilidade, 85);
assert.equal(promoted.equipamentos[0].capacidadeTanqueLitros, 400);
assert.equal(promoted.equipamentos[0].status, 'Mobilizado');
assert.equal(promoted.reviewRows.length, 0);
assert.equal(promoted.empresas.find(item => item.nome === 'Fornecedor preservado')?.tipos?.includes('FORNECEDOR'), true);
