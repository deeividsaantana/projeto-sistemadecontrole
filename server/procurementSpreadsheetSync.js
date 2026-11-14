import ExcelJS from 'exceljs';

const text = value => String(value ?? '').trim();
const number = value => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};
const isoDate = value => value instanceof Date
  ? value.toISOString().slice(0, 10)
  : text(value);

const rowsFrom = (sheet, headers, firstDataRow = 3) => {
  const names = headers || sheet.getRow(2).values.slice(1).map(text);
  return Array.from({ length: Math.max(0, sheet.rowCount - firstDataRow + 1) }, (_, offset) => {
    const values = sheet.getRow(offset + firstDataRow).values.slice(1);
    return Object.fromEntries(names.map((header, index) => [header, values[index] ?? null]));
  }).filter(row => Object.values(row).some(value => text(value)));
};

export const parseProcurementWorkbook = async buffer => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheets = Object.fromEntries(workbook.worksheets.map(sheet => {
    const name = sheet.name.trim();
    if (name === 'Prioridade') return [name, rowsFrom(sheet, ['prioridade', 'data', 'pedido', 'solicitante', 'item', 'unidade', 'quantidade', 'inicio', 'fim', 'observacao', 'status'], 2)];
    if (name === 'Substituição') return [name, rowsFrom(sheet, ['data', 'solicitante', 'quantidade', 'unidade', 'produto', 'frente', 'trocado'], 3)];
    return [name, rowsFrom(sheet)];
  }));
  const requests = (sheets['Solicitações'] || []).map(row => ({
    source: 'Solicitações',
    request_date: isoDate(row['Data']),
    source_request_number: text(row['N° do pedido']),
    requester_name: text(row['Solicitante']),
    item_description: text(row['Item']),
    unit: text(row['Unidade']),
    quantity_requested: number(row['Quantidade']),
    source_purchase_order: text(row['Solicitação de compra SC  (N°)']),
    delivery_deadline: isoDate(row['previsão de entrega']),
  }));
  return {
    sheets: Object.keys(sheets),
    requests,
    priority: sheets['Prioridade'] || [],
    substitutions: sheets['Substituição'] || [],
    allRows: [
      ...requests,
      ...(sheets['Prioridade'] || []).map(row => ({ source: 'Prioridade', ...row })),
      ...(sheets['Substituição'] || []).map(row => ({ source: 'Substituição', ...row })),
    ],
  };
};

export const downloadProcurementWorkbook = async (url = process.env.PROCUREMENT_SPREADSHEET_URL) => {
  if (!url) throw new Error('PROCUREMENT_SPREADSHEET_URL não configurada.');
  const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}download=1`, {
    headers: { 'User-Agent': 'RENEA-ERP/1.0' },
    redirect: 'follow',
  });
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('spreadsheetml.sheet')) {
    throw new Error(`OneDrive não entregou uma planilha Excel (HTTP ${response.status}).`);
  }
  return Buffer.from(await response.arrayBuffer());
};
