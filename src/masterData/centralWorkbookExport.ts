import ExcelJS from 'exceljs';
import type { Empresa, Equipamento, Funcionario, ObraLocal } from '../types';
import { isSupplier, isVehicle } from './centralRegistry';

interface CentralWorkbookData {
  empresas: Empresa[];
  obras: ObraLocal[];
  equipamentos: Equipamento[];
  funcionarios: Funcionario[];
}

export const CENTRAL_EXPORT_SHEETS = [
  'INSTRUÇÕES',
  'LISTAS_AUX',
  'PAINEL GERAL',
  'CAD_EQUIPAMENTOS',
  'CAD_VEICULOS',
  'CAD_COLABORADORES',
  'CAD_EMPRESAS',
  'CAD_FORNECEDORES',
  'CAD_LOCAIS',
] as const;

const rowsFor = (data: CentralWorkbookData) => ({
  'CAD_EQUIPAMENTOS': data.equipamentos.filter(item => !isVehicle(item)).map(item => [item.id, item.prefixo, item.placa || '', item.nome, item.familia || item.tipo, data.empresas.find(company => company.id === item.empresaId)?.nome || '', item.status.toUpperCase(), item.mobilizado ? '1' : '0', (item.metaDisponibilidade ?? 80) / 100, item.dataMobilizacao || '', item.dataDesmobilizacao || '', item.operadorResponsavelNome || '', item.combustivelId || '', item.capacidadeTanqueLitros || '']),
  'CAD_VEICULOS': data.equipamentos.filter(isVehicle).map(item => [item.id, item.prefixo, item.placa || item.seriePlaca || '', item.nome, item.familia || item.tipo, data.empresas.find(company => company.id === item.empresaId)?.nome || '', item.status.toUpperCase(), item.operadorResponsavelNome || '']),
  'CAD_COLABORADORES': data.funcionarios.map(item => [item.id, item.matricula || '', item.nome, item.cargo, item.divisao || '', item.secao || '', item.liderMatricula || '', item.liderNome || '', item.area || '', item.responsavelArea || '', data.empresas.find(company => company.id === item.empresaId)?.nome || '', item.status || (item.ativo ? 'ATIVO' : 'INATIVO'), item.dataMobilizacao || '', item.dataDesmobilizacao || '', item.situacaoRh || '', item.observacao || '']),
  'CAD_EMPRESAS': data.empresas.map(item => [item.id, item.nome, (item.tipos || ['EMPRESA']).join(', '), item.cnpj, item.status || 'ATIVO']),
  'CAD_FORNECEDORES': data.empresas.filter(isSupplier).map(item => [item.id, item.nome, item.cnpj, item.status || 'ATIVO']),
  'CAD_LOCAIS': data.obras.map(item => [item.id, item.nome, 'LOCAL', item.status === 'Concluída' ? 'INATIVO' : 'ATIVO']),
});

const headers: Record<keyof ReturnType<typeof rowsFor>, string[]> = {
  CAD_EQUIPAMENTOS: ['ID Mestre', 'Prefixo', 'Placa', 'Equipamento', 'Família', 'Empresa', 'Status', 'Mobilizado', 'Meta disponibilidade', 'Data mobilização', 'Data desmobilização', 'Operador/Responsável', 'Combustível', 'Capacidade tanque (L)'],
  CAD_VEICULOS: ['ID Veículo', 'Prefixo', 'Placa', 'Equipamento', 'Família', 'Empresa', 'Status', 'Operador/Responsável'],
  CAD_COLABORADORES: ['ID Mestre', 'Matrícula', 'Colaborador', 'Função', 'Divisão', 'Seção', 'Matrícula líder', 'Nome líder', 'Área', 'Responsável', 'Empresa', 'Status', 'Data mobilização', 'Data desmobilização', 'Situação RH', 'Observação'],
  CAD_EMPRESAS: ['ID Empresa', 'Nome', 'Tipo(s)', 'CNPJ', 'Status'],
  CAD_FORNECEDORES: ['ID Fornecedor', 'Fornecedor', 'CNPJ', 'Status'],
  CAD_LOCAIS: ['ID Local', 'Local', 'Tipo', 'Status'],
};

export const createCentralRegistryWorkbook = (data: CentralWorkbookData): ExcelJS.Workbook => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema RENEA — Base Central';
  workbook.created = new Date();
  const instructions = workbook.addWorksheet('INSTRUÇÕES');
  instructions.addRows([
    ['BASE_CADASTROS — exportação oficial do webapp'],
    ['Gerado em', new Date().toLocaleString('pt-BR')],
    ['Fluxo', 'WEBAPP → BASE_CADASTROS → POWER QUERY → PLANILHAS OPERACIONAIS'],
    ['Segurança', 'Registros inativos permanecem na base para preservar histórico e vínculos.'],
    ['Escopo', 'O arquivo CONTROLE DE MATERIAIS COMPLEXO ALTO TIETE POR RAMO.xlsx não é lido, alterado ou integrado por esta rotina.'],
  ]);
  instructions.mergeCells('A1:F1');
  instructions.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  instructions.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
  instructions.getColumn(1).width = 22;
  instructions.getColumn(2).width = 90;

  const lists = workbook.addWorksheet('LISTAS_AUX');
  lists.addRows([
    ['Grupo', 'Valor'],
    ['STATUS_EQUIPAMENTO', 'ATIVO'], ['STATUS_EQUIPAMENTO', 'INATIVO'], ['STATUS_EQUIPAMENTO', 'MANUTENÇÃO'], ['STATUS_EQUIPAMENTO', 'PARADO'], ['STATUS_EQUIPAMENTO', 'DESMOBILIZADO'],
    ['STATUS_COLABORADOR', 'ATIVO'], ['STATUS_COLABORADOR', 'INATIVO'], ['STATUS_COLABORADOR', 'FÉRIAS'], ['STATUS_COLABORADOR', 'AFASTADO'], ['STATUS_COLABORADOR', 'DESMOBILIZADO'],
  ]);

  const summary = workbook.addWorksheet('PAINEL GERAL');
  summary.addRows([
    ['Indicador', 'Quantidade'],
    ['Colaboradores', data.funcionarios.length],
    ['Equipamentos', data.equipamentos.filter(item => !isVehicle(item)).length],
    ['Veículos', data.equipamentos.filter(isVehicle).length],
    ['Empresas', data.empresas.length],
    ['Fornecedores', data.empresas.filter(isSupplier).length],
    ['Locais', data.obras.length],
  ]);

  const sourceRows = rowsFor(data);
  for (const sheetName of Object.keys(sourceRows) as Array<keyof typeof sourceRows>) {
    const sheet = workbook.addWorksheet(sheetName);
    sheet.addRow(headers[sheetName]);
    sheet.addRows(sourceRows[sheetName]);
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers[sheetName].length } };
    sheet.getRow(1).height = 28;
    sheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    sheet.columns.forEach(column => { column.width = Math.min(34, Math.max(14, ...(column.values || []).map(value => String(value ?? '').length + 2))); });
  }
  return workbook;
};

export const downloadCentralRegistryWorkbook = async (data: CentralWorkbookData): Promise<void> => {
  const workbook = createCentralRegistryWorkbook(data);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `BASE_CADASTROS_WEBAPP_${new Date().toISOString().slice(0, 10)}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
};
