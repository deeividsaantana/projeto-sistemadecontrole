import { extractPdfText } from './fuelDocumentParsing';

export type OperationalDocumentType =
  | 'Combustível'
  | 'Ticket de jazida'
  | 'Nota fiscal de material'
  | 'Recebimento de estacas'
  | 'Relatório comercial'
  | 'Documento genérico';

export type DocumentField = {
  field: string;
  label: string;
  value: string;
  confidence: number;
  source: string;
};

export type DocumentAnalysis = {
  type: OperationalDocumentType;
  confidence: number;
  fields: DocumentField[];
  inconsistencies: string[];
  suggestions: string[];
  rawText: string;
  requiresHumanReview: boolean;
};

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

const firstMatch = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
};

const detectType = (text: string): OperationalDocumentType => {
  const normalized = normalize(text);
  if (/HORIMETRO|COMBUSTIVEL|ABASTECIMENTO|BOMBA/.test(normalized)) return 'Combustível';
  if (/AUT\\.?(ORIZACAO)? DESCARTE|N[ºO]? VALE|PESO LIQUIDO|PAGAMENTO/.test(normalized)) return 'Relatório comercial';
  if (/CRAVACAO|ESTACA PRANCHA|PERFIL METALICO|COMPRIMENTO CRAVADO/.test(normalized)) return 'Recebimento de estacas';
  if (/NOTA FISCAL|NF[- Nº:]|CHAVE DE ACESSO|DANFE/.test(normalized)) return 'Nota fiscal de material';
  if (/TICKET|JAZIDA|LIBERACAO|RECEBIMENTO|CACAMBA/.test(normalized)) return 'Ticket de jazida';
  return 'Documento genérico';
};

const buildField = (field: string, label: string, value: string, source: string): DocumentField | null =>
  value ? { field, label, value, confidence: source === 'rótulo explícito' ? 0.94 : 0.78, source } : null;

export const analyzeOperationalText = (rawText: string): DocumentAnalysis => {
  const text = rawText.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').trim();
  const type = detectType(text);
  const fields = [
    buildField('data', 'Data', firstMatch(text, [/\bDATA(?: DO DESCARTE)?\s*[:\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i, /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/]), 'rótulo explícito'),
    buildField('hora', 'Hora', firstMatch(text, [/\bHORA\s*[:\-]?\s*(\d{1,2}:\d{2})/i, /\b(\d{1,2}:\d{2})\b/]), 'rótulo explícito'),
    buildField('notaFiscal', 'Nota fiscal', firstMatch(text, [/\b(?:NOTA FISCAL|NF)\s*(?:N[ºO])?\s*[:\-]?\s*([0-9]{3,})/i]), 'rótulo explícito'),
    buildField('ticket', 'Ticket/Vale', firstMatch(text, [/\b(?:TICKET|N[ºO]? VALE|VALE)\s*[:\-]?\s*([A-Z0-9.-]+)/i]), 'rótulo explícito'),
    buildField('placa', 'Placa', firstMatch(text, [/\bPLACA\s*[:\-]?\s*([A-Z]{3}[- ]?[0-9A-Z][0-9]{2})/i, /\b([A-Z]{3}-?[0-9][A-Z0-9][0-9]{2})\b/i]), 'padrão de placa'),
    buildField('prefixo', 'Prefixo', firstMatch(text, [/\bPREFIXO\s*[:\-]?\s*([A-Z]{1,4}\s*[-]?\s*\d{1,4})/i]), 'rótulo explícito'),
    buildField('material', 'Material', firstMatch(text, [/\b(?:MATERIAL|RES[IÍ]DUO|ITEM)\s*[:\-]?\s*([^\n;]+)/i]), 'rótulo explícito'),
    buildField('quantidade', 'Quantidade/Peso', firstMatch(text, [/\b(?:QUANTIDADE|PESO L[IÍ]QUIDO|PESO)\s*[:\-]?\s*([\d.,]+\s*(?:KG|T|TON|M3|M³|UN)?)\b/i]), 'rótulo explícito'),
    buildField('destino', 'Destino', firstMatch(text, [/\b(?:DESTINO|LOCAL\/DESTINO)\s*[:\-]?\s*([^\n;]+)/i]), 'rótulo explícito'),
    buildField('perfil', 'Perfil', firstMatch(text, [/\bPERFIL(?: \/ MODELO)?\s*[:\-]?\s*([^\n;]+)/i, /\b(AZ\d+(?:-\d+)?)\b/i]), 'rótulo explícito'),
    buildField('comprimento', 'Comprimento', firstMatch(text, [/\bCOMPRIMENTO(?: CRAVADO)?(?: \\(M\\))?\s*[:\-]?\s*([\d.,]+\s*M?)\b/i]), 'rótulo explícito'),
    buildField('valor', 'Valor', firstMatch(text, [/\b(?:VALOR(?: TOTAL)?|TOTAL R\\$)\s*[:\-]?\s*(?:R\\$)?\s*([\d.,]+)/i]), 'rótulo explícito'),
  ].filter((item): item is DocumentField => Boolean(item));

  const inconsistencies: string[] = [];
  if (!text) inconsistencies.push('Documento sem texto legível.');
  if (!fields.some(item => item.field === 'data')) inconsistencies.push('Data não identificada.');
  if (type === 'Ticket de jazida' && !fields.some(item => item.field === 'ticket')) inconsistencies.push('Número do ticket não identificado.');
  if (type === 'Recebimento de estacas' && !fields.some(item => item.field === 'perfil')) inconsistencies.push('Perfil da estaca não identificado.');
  if (type === 'Nota fiscal de material' && !fields.some(item => item.field === 'notaFiscal')) inconsistencies.push('Número da nota fiscal não identificado.');
  const confidence = Math.max(0.15, Math.min(0.99, fields.length / 8 + (type === 'Documento genérico' ? 0 : 0.25)));
  const suggestions = [
    'Confira os campos destacados antes de enviar ao módulo operacional.',
    inconsistencies.length ? 'Resolva as inconsistências ou mantenha o registro como pendente para revisão.' : 'Documento apto para preenchimento assistido.',
    'O processamento local continua disponível sem IA externa.',
  ];

  return {
    type,
    confidence,
    fields,
    inconsistencies,
    suggestions,
    rawText: text,
    requiresHumanReview: confidence < 0.8 || inconsistencies.length > 0,
  };
};

export const readOperationalDocument = async (file: File, pastedText = '') => {
  if (pastedText.trim()) return analyzeOperationalText(pastedText);
  if (file.type.startsWith('text/') || /\.(csv|txt)$/i.test(file.name)) {
    return analyzeOperationalText(await file.text());
  }
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const extractedText = await extractPdfText(file);
    if (extractedText.trim()) return analyzeOperationalText(extractedText);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const decoded = new TextDecoder('latin1').decode(bytes);
  const textFragments = Array.from(decoded.matchAll(/\(([^()]*)\)\s*Tj/g))
    .map(match => match[1].replace(/\\([()\\])/g, '$1'))
    .join('\n');
  return analyzeOperationalText(textFragments);
};
