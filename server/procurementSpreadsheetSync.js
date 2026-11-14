import ExcelJS from 'exceljs';

const text = value => String(value ?? '').trim();
const number = value => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};
const isoDate = value => value instanceof Date
  ? value.toISOString().slice(0, 10)
  : text(value);

const rowsFrom = sheet => {
  const headers = sheet.getRow(2).values.slice(1).map(text);
  return Array.from({ length: Math.max(0, sheet.rowCount - 2) }, (_, offset) => {
    const values = sheet.getRow(offset + 3).values.slice(1);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? null]));
  }).filter(row => Object.values(row).some(value => text(value)));
};

export const parseProcurementWorkbook = async buffer => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheets = Object.fromEntries(workbook.worksheets.map(sheet => [sheet.name.trim(), rowsFrom(sheet)]));
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
