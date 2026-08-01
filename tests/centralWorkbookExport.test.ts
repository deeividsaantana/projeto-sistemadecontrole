import assert from 'node:assert/strict';
import { CENTRAL_EXPORT_SHEETS, createCentralRegistryWorkbook } from '../src/masterData/centralWorkbookExport';

const workbook = createCentralRegistryWorkbook({
  empresas: [{ id: 'FOR-0001', nome: 'Pedra Forte', cnpj: '', telefone: '', responsavel: '', tipos: ['FORNECEDOR'], status: 'ATIVO' }],
  obras: [{ id: 'LOC-0001', nome: 'Ramo 200', endereco: '', responsavel: '', status: 'Ativa' }],
  equipamentos: [{ id: 'VEI-0001', prefixo: 'CB1005', placa: 'FEJ6753', nome: 'Caminhão', tipo: 'Basculante', marca: '', modelo: '', seriePlaca: '', empresaId: 'FOR-0001', status: 'Ativo', localAtualId: 'LOC-0001', observacao: '', categoriaFrota: 'Veículo' }],
  funcionarios: [{ id: 'COL-0001', matricula: '100787', nome: 'Colaborador', cargo: 'Motorista', telefone: '', empresaId: 'FOR-0001', ativo: true, status: 'ATIVO' }],
  ramos: [{ id: 'RAM-001', canteiroNome: 'Alto Tietê', ramoNome: 'Ramo 200', responsavel: '', token: 'token', status: 'ativo', linkAtivo: true }],
});

assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), [...CENTRAL_EXPORT_SHEETS]);
const collaboratorHeaderValues = workbook.getWorksheet('CAD_COLABORADORES')?.getRow(1).values;
assert.ok(Array.isArray(collaboratorHeaderValues));
assert.deepEqual(collaboratorHeaderValues.slice(1), ['ID Mestre', 'Matrícula', 'Colaborador', 'Função', 'Divisão', 'Seção', 'Matrícula líder', 'Nome líder', 'Área', 'Responsável', 'Empresa', 'Status', 'Data mobilização', 'Data desmobilização', 'Situação RH', 'Observação']);
assert.equal(workbook.getWorksheet('CAD_MATERIAIS'), undefined);
