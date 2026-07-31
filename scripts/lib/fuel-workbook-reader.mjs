import crypto from 'node:crypto';
import path from 'node:path';
import ExcelJS from 'exceljs';

const normalize = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLowerCase();

const aliases = {
  data: ['data', 'dt'],
  prefixo: ['prefixo', 'frota', 'equipamento', 'codigo'],
  descricaoEquipamento: ['descricaodoequipamento', 'descricaoequipamento', 'descricao', 'equipamentodescricao'],
  kmInicial: ['kminicial', 'km', 'quilometragem'],
  horimetroInicial: ['horimetro', 'horimetroinicial', 'horainicial', 'leitura'],
  quantidadeLitros: ['litros', 'quantidadelitros', 'qtdedelitros', 'qtdelitros', 'qtde', 'qtd', 'quantidade', 'volume'],
  hora: ['hora', 'horario'],
  comboio: ['comboio', 'prefixocomboio'],
  tipoCombustivel: ['tipodecombustivel', 'tipodocombustivel', 'tipocombustivel', 'combustivel', 'produto'],
  empresa: ['empresa', 'contratada'],
  bombaInicial: ['bombainicial', 'iniciobomba', 'leiturainicialbomba', 'bomba'],
  bombaFinal: ['bombafinal', 'fimbomba', 'leiturafinalbomba'],
  custoLitro: ['custolitro', 'custoporlitro', 'valorunitario', 'valorlitro', 'precolitro'],
  responsavel: ['responsavel', 'operador', 'frentista'],
  observacao: ['observacao', 'observacoes', 'obs'],
};

const unwrapCellValue = value => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value;
  if (typeof value !== 'object') return value;
  if ('result' in value) return unwrapCellValue(value.result);
  if ('error' in value) return String(value.error || 'Erro de fórmula');
  if (Array.isArray(value.richText)) return value.richText.map(part => part.text || '').join('');
  if ('text' in value) return value.text;
  return String(value);
};

const textValue = value => {
  const unwrapped = unwrapCellValue(value);
  if (unwrapped instanceof Date) return unwrapped.toISOString();
  return String(unwrapped ?? '').trim();
};

const numberValue = value => {
  const unwrapped = unwrapCellValue(value);
  if (typeof unwrapped === 'number') return Number.isFinite(unwrapped) ? unwrapped : 0;
  const raw = String(unwrapped ?? '').trim();
  if (!raw) return 0;
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(/[^0-9.+-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isNumericValue = value => {
  const unwrapped = unwrapCellValue(value);
  if (typeof unwrapped === 'number') return Number.isFinite(unwrapped);
  const raw = String(unwrapped ?? '').trim();
  if (!raw) return false;
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(/[^0-9.+-]/g, '');
  return normalized !== '' && Number.isFinite(Number(normalized));
};

const dateValue = value => {
  const unwrapped = unwrapCellValue(value);
  if (unwrapped instanceof Date && !Number.isNaN(unwrapped.getTime())) {
    const year = unwrapped.getUTCFullYear();
    const month = String(unwrapped.getUTCMonth() + 1).padStart(2, '0');
    const day = String(unwrapped.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof unwrapped === 'number' && unwrapped > 1) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(unwrapped) * 86_400_000).toISOString().slice(0, 10);
  }
  const raw = String(unwrapped ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const br = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (br) return `${br[3].length === 2 ? `20${br[3]}` : br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  return raw;
};

const timeValue = value => {
  const unwrapped = unwrapCellValue(value);
  if (unwrapped instanceof Date && !Number.isNaN(unwrapped.getTime())) {
    // Horas do Excel são armazenadas sobre a data-base de 1899. Usar o fuso
    // local nessa data aplica o deslocamento histórico de São Paulo (03:06:28),
    // transformando 07:00 em 03:53. A leitura em UTC preserva o valor da célula.
    return `${String(unwrapped.getUTCHours()).padStart(2, '0')}:${String(unwrapped.getUTCMinutes()).padStart(2, '0')}`;
  }
  if (typeof unwrapped === 'number' && unwrapped >= 0 && unwrapped < 1) {
    const minutes = Math.round(unwrapped * 24 * 60) % (24 * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }
  if (typeof unwrapped === 'number' && Number.isInteger(unwrapped) && unwrapped >= 0 && unwrapped <= 2359) {
    const hours = Math.floor(unwrapped / 100);
    const minutes = unwrapped % 100;
    if (hours <= 23 && minutes <= 59) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  const raw = String(unwrapped ?? '').trim();
  const match = raw.match(/^(\d{1,2})(?:[:hH.]?(\d{2}))?(?::\d{2})?$/);
  if (!match) return raw;
  const hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  if (hours > 23 || minutes > 59) return raw;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const findHeader = worksheet => {
  let best = null;
  for (let rowNumber = 1; rowNumber <= Math.min(30, worksheet.rowCount || 30); rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const map = {};
    for (let column = 1; column <= Math.max(20, row.cellCount); column += 1) {
      const header = normalize(textValue(row.getCell(column).value));
      if (!header) continue;
      Object.entries(aliases).forEach(([field, names]) => {
        if (!map[field] && names.includes(header)) map[field] = column;
      });
    }
    const score = ['data', 'prefixo', 'quantidadeLitros', 'hora', 'tipoCombustivel'].filter(field => map[field]).length;
    if (!best || score > best.score) best = { rowNumber, map, score };
  }
  if (!best || best.score < 3) throw new Error('Não foi possível localizar os cabeçalhos da aba Detalhe.');
  return best;
};

const rawAt = (row, column) => column ? unwrapCellValue(row.getCell(column).value) : '';

const selectFuelWorksheet = workbook => {
  const preferredNames = new Set(['detalhe', 'dadoscombustivel']);
  const candidates = workbook.worksheets
    .filter(sheet => preferredNames.has(normalize(sheet.name)) || normalize(sheet.name).includes('combustivel'))
    .flatMap(sheet => {
      try {
        return [{ worksheet: sheet, header: findHeader(sheet) }];
      } catch {
        return [];
      }
    })
    .sort((left, right) => right.header.score - left.header.score
      || Number(preferredNames.has(normalize(right.worksheet.name))) - Number(preferredNames.has(normalize(left.worksheet.name)))
      || right.worksheet.rowCount - left.worksheet.rowCount);
  if (!candidates.length) throw new Error('A planilha não possui uma aba de detalhes de combustível com cabeçalhos reconhecíveis.');
  return candidates[0];
};

export const readFuelWorkbook = async filePath => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const { worksheet, header } = selectFuelWorksheet(workbook);
  const rows = [];
  let warningCount = 0;
  const fileKey = normalize(path.basename(filePath));

  for (let rowNumber = header.rowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const source = worksheet.getRow(rowNumber);
    // As colunas de descrição, empresa e bomba contêm fórmulas copiadas até o fim da aba.
    // Elas não devem transformar linhas visualmente vazias em abastecimentos, mas qualquer
    // conteúdo operacional parcial continua sendo importado para conferência no sistema.
    const operationalFields = ['data', 'prefixo', 'kmInicial', 'horimetroInicial', 'quantidadeLitros', 'hora', 'comboio', 'tipoCombustivel', 'responsavel', 'observacao'];
    const relevantValues = operationalFields.map(field => textValue(rawAt(source, header.map[field])));
    if (!relevantValues.some(Boolean)) continue;

    const dataRaw = rawAt(source, header.map.data);
    const prefixo = textValue(rawAt(source, header.map.prefixo)).toUpperCase();
    const litrosRaw = rawAt(source, header.map.quantidadeLitros);
    const data = dateValue(dataRaw);
    const horaRaw = rawAt(source, header.map.hora);
    const hora = timeValue(horaRaw);
    const quantidadeLitros = numberValue(litrosRaw);
    const bombaInicialRaw = rawAt(source, header.map.bombaInicial);
    const bombaFinalRaw = rawAt(source, header.map.bombaFinal);
    const bombaInicial = numberValue(bombaInicialRaw);
    const bombaFinal = numberValue(bombaFinalRaw);
    const rowWarnings = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) rowWarnings.push('Data ausente ou inválida');
    if (!prefixo) rowWarnings.push('Prefixo ausente');
    if (!textValue(litrosRaw) || quantidadeLitros <= 0) rowWarnings.push('Quantidade ausente ou inválida');
    if (textValue(horaRaw) && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) rowWarnings.push('Hora inválida');
    if (header.map.bombaInicial && textValue(bombaInicialRaw) && !isNumericValue(bombaInicialRaw)) rowWarnings.push('Bomba inicial inválida');
    if (header.map.bombaFinal && textValue(bombaFinalRaw) && !isNumericValue(bombaFinalRaw)) rowWarnings.push('Bomba final inválida');
    if (!textValue(rawAt(source, header.map.comboio))) rowWarnings.push('Comboio ausente');
    if (!textValue(rawAt(source, header.map.tipoCombustivel))) rowWarnings.push('Tipo de combustível ausente');
    warningCount += rowWarnings.length > 0 ? 1 : 0;

    rows.push({
      sourceRowId: `onedrive-${crypto.createHash('sha256').update(`${fileKey}|${normalize(worksheet.name)}|${rowNumber}`).digest('hex').slice(0, 36)}`,
      sourceFile: path.basename(filePath),
      rowNumber,
      sheet: worksheet.name,
      data,
      hora,
      prefixo,
      descricaoEquipamento: textValue(rawAt(source, header.map.descricaoEquipamento)),
      kmInicial: numberValue(rawAt(source, header.map.kmInicial)),
      horimetroInicial: numberValue(rawAt(source, header.map.horimetroInicial)),
      quantidadeLitros,
      quantidadeOriginal: textValue(litrosRaw),
      comboio: textValue(rawAt(source, header.map.comboio)),
      tipoCombustivel: textValue(rawAt(source, header.map.tipoCombustivel)),
      empresa: textValue(rawAt(source, header.map.empresa)),
      bombaInicial,
      bombaFinal,
      custoLitro: numberValue(rawAt(source, header.map.custoLitro)),
      responsavel: textValue(rawAt(source, header.map.responsavel)),
      observacao: textValue(rawAt(source, header.map.observacao)),
      avisos: rowWarnings.join(' | '),
    });
  }

  return { sheetName: worksheet.name, headerRow: header.rowNumber, rows, warningCount };
};
