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

// Cabeçalho tolerante: ignora maiúsculas, acentos, espaços repetidos e "N°"/"Nº".
const chave = value => text(value).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[°º]/g, 'o').replace(/\s+/g, ' ').toLowerCase();
const campo = (row, ...nomes) => {
  const alvo = nomes.map(chave);
  const encontrado = Object.keys(row).find(nome => alvo.includes(chave(nome)));
  return encontrado === undefined ? null : row[encontrado];
};
// Todas as abas: linha 1 título, linha 2 cabeçalho, dados a partir da linha 3.
const COLUNAS = {
  Prioridade: {
    prioridade: ['Prioridade'], data: ['Data'], pedido: ['N° do pedido', 'Pedido'], solicitante: ['Solicitante'],
    item: ['Item'], unidade: ['Unidade'], quantidade: ['Quantidade'], fim: ['Previsão de entrega', 'Previsão'],
    observacao: ['Observação'], status: ['Situação', 'Status'],
  },
  Substituição: {
    data: ['Data'], solicitante: ['Solicitante'], quantidade: ['Quantidade'], unidade: ['Unidade'],
    produto: ['Produto'], frente: ['Frente'], trocado: ['Trocado', 'Trocado em'],
  },
};
const DATAS = new Set(['data', 'fim', 'trocado']);
const porCabecalho = (linhas, colunas) => linhas.map(row => Object.fromEntries(Object.entries(colunas).map(([nome, cabecalhos]) => {
  const valor = campo(row, ...cabecalhos);
  return [nome, valor instanceof Date && DATAS.has(nome) ? isoDate(valor) : valor];
})));

export const parseProcurementWorkbook = async buffer => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheets = Object.fromEntries(workbook.worksheets.map(sheet => {
    const name = sheet.name.trim();
    return [name, COLUNAS[name] ? porCabecalho(rowsFrom(sheet), COLUNAS[name]) : rowsFrom(sheet)];
  }));
  const requests = (sheets['Solicitações'] || []).map(row => ({
    source: 'Solicitações',
    request_date: isoDate(campo(row, 'Data')),
    source_request_number: text(campo(row, 'N° do pedido', 'Pedido')),
    requester_name: text(campo(row, 'Solicitante')),
    item_description: text(campo(row, 'Item')),
    unit: text(campo(row, 'Unidade')),
    quantity_requested: number(campo(row, 'Quantidade')),
    source_purchase_order: text(campo(row, 'Solicitação de compra SC (N°)', 'SC')),
    delivery_deadline: isoDate(campo(row, 'previsão de entrega')),
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

const comDownload = url => `${url}${url.includes('?') ? '&' : '?'}download=1`;
// Link de compartilhamento → endereço de download da API do OneDrive ("u!" + base64url do link).
export const linkDeCompartilhamentoOneDrive = url => `https://api.onedrive.com/v1.0/shares/u!${Buffer.from(url).toString('base64').replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-')}/root/content`;
// .xlsx é um zip: começa com "PK". O OneDrive às vezes manda como application/octet-stream.
const ehPlanilha = (contentType, bytes) => contentType.includes('spreadsheetml.sheet') || (bytes[0] === 0x50 && bytes[1] === 0x4b);

// Google Planilhas: link de compartilhamento → exportação oficial em .xlsx.
export const linkDeExportacaoGoogle = url => {
  const id = /docs\.google\.com\/spreadsheets\/d\/([\w-]+)/.exec(url)?.[1];
  return id ? `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx` : null;
};

export const downloadProcurementWorkbook = async (url = process.env.PROCUREMENT_SPREADSHEET_URL, fetcher = fetch) => {
  if (!url) throw new Error('PROCUREMENT_SPREADSHEET_URL não configurada.');
  const google = linkDeExportacaoGoogle(url);
  if (google) {
    const response = await fetcher(google, { headers: { 'User-Agent': 'RENEA-ERP/1.0' }, redirect: 'follow' });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (response.ok && ehPlanilha(response.headers.get('content-type') || '', bytes)) return bytes;
    throw new Error(`Google Planilhas não entregou a planilha (HTTP ${response.status}). Confira se o compartilhamento está como "Qualquer pessoa com o link: Leitor".`);
  }
  const pedir = endereco => fetcher(endereco, { headers: { 'User-Agent': 'RENEA-ERP/1.0' }, redirect: 'follow' });
  const tentativas = [
    () => comDownload(url),
    // Link curto (1drv.ms) perde o download=1 no redirecionamento: abre o link e pede o download no endereço final.
    async () => comDownload((await pedir(url)).url || url),
    () => linkDeCompartilhamentoOneDrive(url),
  ];
  const respostas = [];
  for (const tentativa of tentativas) {
    try {
      const response = await pedir(await tentativa());
      const bytes = Buffer.from(await response.arrayBuffer());
      if (response.ok && ehPlanilha(response.headers.get('content-type') || '', bytes)) return bytes;
      respostas.push(response.status);
    } catch (error) {
      respostas.push(String(error?.message || error));
    }
  }
  throw new Error(`OneDrive não entregou uma planilha Excel (HTTP ${respostas.join(', ')}). Confira se o link está como "Qualquer pessoa com o link pode exibir".`);
};
