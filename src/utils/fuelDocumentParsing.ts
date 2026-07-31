import { cleanImportValue, normalizeImportText, parseImportNumber, toImportIsoDate } from './importHelpers';

interface FuelDocumentCatalogs {
  equipamentos: string[];
  combustiveis: string[];
  comboios: string[];
}

export interface LocalFuelDocumentAnalysis {
  tipoDocumento: string;
  dataDocumento?: string | null;
  paginas: number;
  avisosDocumento: string[];
  registros: Array<Record<string, any>>;
  analiseOperacional?: OperationalAnalysis;
}

export interface OperationalIndicator {
  nome: string;
  valor: string;
  interpretacao: string;
}

export interface OperationalAction {
  acao: string;
  impacto: string;
  dificuldade: string;
  tempoEstimado: string;
  ganhoEsperado: string;
}

export interface OperationalAnalysis {
  resumoExecutivo: string[];
  principaisProblemas: string[];
  oportunidadesMelhoria: string[];
  automacoesRecomendadas: string[];
  indicadores: OperationalIndicator[];
  planoAcao: OperationalAction[];
  proximosPassos: string[];
  confianca: 'Alta' | 'Média' | 'Baixa';
}

const FIELD_ALIASES: Record<string, string[]> = {
  data: ['data', 'dia', 'dt'],
  hora: ['hora', 'hr', 'horario', 'horário'],
  prefixo: ['prefixo', 'frota', 'equipamento', 'maquina', 'máquina', 'veiculo', 'veículo'],
  horimetroInicial: ['horimetro', 'horímetro', 'hori', 'hm', 'horimetro inicial', 'horímetro inicial'],
  kmInicial: ['km', 'quilometragem', 'odometro', 'odômetro', 'hodometro', 'hodômetro'],
  bombaInicial: ['bomba inicial', 'b inicial', 'bi', 'enc inicial', 'inicial bomba', 'inicial'],
  bombaFinal: ['bomba final', 'b final', 'bf', 'enc final', 'final bomba', 'final'],
  quantidadeLitros: ['litros', 'litro', 'qtd', 'qtde', 'quantidade', 'volume', 'abastecido'],
  tipoCombustivel: ['combustivel', 'combustível', 'produto', 'diesel', 'tipo'],
  comboio: ['comboio', 'posto', 'tanque', 'bomba'],
  responsavel: ['responsavel', 'responsável', 'motorista', 'frentista', 'operador'],
  observacao: ['obs', 'observacao', 'observação', 'descricao', 'descrição'],
};

const decodePdfLiteralString = (input: string) => input
  .replace(/\\([nrtbf()\\])/g, (_, escaped) => {
    const map: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
    return map[escaped] || escaped;
  })
  .replace(/\\(\d{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
  .replace(/\s+/g, ' ')
  .trim();

const decodePdfHexString = (input: string) => {
  const clean = input.replace(/[^0-9a-f]/gi, '');
  const bytes: number[] = [];
  for (let index = 0; index < clean.length; index += 2) {
    bytes.push(parseInt(clean.slice(index, index + 2).padEnd(2, '0'), 16));
  }
  try {
    return new TextDecoder('utf-16be').decode(new Uint8Array(bytes)).replace(/\0/g, '').trim();
  } catch {
    return String.fromCharCode(...bytes).replace(/\0/g, '').trim();
  }
};

const extractTextFromPdfStream = (streamText: string) => {
  const chunks: string[] = [];
  const blockPattern = /BT([\s\S]*?)ET/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockPattern.exec(streamText))) {
    const block = blockMatch[1];
    const arrayPattern = /\[([\s\S]*?)\]\s*TJ/g;
    let arrayMatch: RegExpExecArray | null;
    while ((arrayMatch = arrayPattern.exec(block))) {
      const arrayText = arrayMatch[1];
      const parts = [
        ...Array.from(arrayText.matchAll(/\((?:\\.|[^\\)])*\)/g)).map(match => decodePdfLiteralString(match[0].slice(1, -1))),
        ...Array.from(arrayText.matchAll(/<([0-9a-fA-F\s]+)>/g)).map(match => decodePdfHexString(match[1])),
      ].filter(Boolean);
      if (parts.length) chunks.push(parts.join(' '));
    }

    const textPattern = /\((?:\\.|[^\\)])*\)\s*(?:Tj|'|")/g;
    let textMatch: RegExpExecArray | null;
    while ((textMatch = textPattern.exec(block))) {
      chunks.push(decodePdfLiteralString(textMatch[0].replace(/\s*(?:Tj|'|")$/, '').slice(1, -1)));
    }

    const hexPattern = /<([0-9a-fA-F\s]+)>\s*Tj/g;
    let hexMatch: RegExpExecArray | null;
    while ((hexMatch = hexPattern.exec(block))) {
      const decoded = decodePdfHexString(hexMatch[1]);
      if (decoded) chunks.push(decoded);
    }
  }
  return chunks.filter(Boolean).join('\n');
};

const bytesToBinaryString = (bytes: Uint8Array) => {
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.slice(index, index + chunkSize)));
  }
  return chunks.join('');
};

const binaryStringToBytes = (value: string) => {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index) & 0xff;
  return bytes;
};

const inflatePdfStream = async (bytes: Uint8Array) => {
  const Decompression = (globalThis as any).DecompressionStream;
  if (!Decompression) return '';
  try {
    const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(new Decompression('deflate'));
    const inflated = new Uint8Array(await new Response(stream).arrayBuffer());
    return new TextDecoder('latin1').decode(inflated);
  } catch {
    return '';
  }
};

export const extractPdfText = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const binary = bytesToBinaryString(bytes);
  const candidates = [binary];
  const streamPattern = /(<<[\s\S]{0,2200}?>>)\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g;
  let streamMatch: RegExpExecArray | null;
  while ((streamMatch = streamPattern.exec(binary))) {
    const dictionary = streamMatch[1];
    const body = binaryStringToBytes(streamMatch[2]);
    if (/\/FlateDecode\b/.test(dictionary)) {
      const inflated = await inflatePdfStream(body);
      if (inflated) candidates.push(inflated);
    } else {
      candidates.push(streamMatch[2]);
    }
  }
  return candidates.map(extractTextFromPdfStream).filter(Boolean).join('\n');
};

const splitStructuredLine = (line: string) => {
  if (/[;\t|]/.test(line)) return line.split(/[;\t|]/).map(cleanImportValue);
  return line.split(/\s{2,}/).map(cleanImportValue).filter(Boolean);
};

const findFieldFromHeader = (header: string) => {
  const normalized = normalizeImportText(header);
  return Object.entries(FIELD_ALIASES).find(([, aliases]) =>
    aliases.some(alias => {
      const normalizedAlias = normalizeImportText(alias);
      return normalized === normalizedAlias || normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized);
    }),
  )?.[0];
};

const getHeaderMap = (cells: string[]) => {
  const mapped = cells.map(findFieldFromHeader);
  const score = new Set(mapped.filter(Boolean)).size;
  return score >= 3 ? mapped : null;
};

const parseDateFromText = (value: string) => {
  const iso = toImportIsoDate(value);
  if (iso) return iso;
  const match = value.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  return match ? toImportIsoDate(match[0]) : '';
};

const parseTimeFromText = (value: string) => {
  const colon = value.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (colon) return `${colon[1].padStart(2, '0')}:${colon[2]}`;
  const compact = value.match(/\b([01]?\d|2[0-3])([0-5]\d)\b/);
  return compact ? `${compact[1].padStart(2, '0')}:${compact[2]}` : '';
};

const resolveCatalogText = (raw: string, catalog: string[]) => {
  const normalized = normalizeImportText(raw);
  if (!normalized) return '';
  const exact = catalog.find(item => normalizeImportText(item) === normalized);
  if (exact) return exact;
  const partial = catalog.filter(item => {
    const itemNorm = normalizeImportText(item);
    return itemNorm && (itemNorm.includes(normalized) || normalized.includes(itemNorm));
  });
  return partial.length === 1 ? partial[0] : raw;
};

const extractPrefix = (line: string, equipamentos: string[]) => {
  const byCatalog = equipamentos
    .slice()
    .sort((a, b) => b.length - a.length)
    .find(prefix => {
      const normalizedPrefix = normalizeImportText(prefix);
      return normalizedPrefix.length >= 2 && normalizeImportText(line).includes(normalizedPrefix);
    });
  if (byCatalog) return byCatalog;
  return line.match(/\b[A-Z]{1,4}[- ]?\d{1,5}[A-Z]?\b/i)?.[0]?.replace(/\s+/g, '').toUpperCase() || '';
};

const numericTokens = (line: string) => Array.from(line.matchAll(/-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:[.,]\d+)?/g))
  .map(match => parseImportNumber(match[0]))
  .filter(value => Number.isFinite(value));

const recordFromStructuredValues = (
  values: Record<string, string>,
  index: number,
  defaultDate: string,
  catalogs: FuelDocumentCatalogs,
) => {
  const pumpStart = parseImportNumber(values.bombaInicial);
  const pumpEndRaw = parseImportNumber(values.bombaFinal);
  const litersRaw = parseImportNumber(values.quantidadeLitros);
  const liters = litersRaw || (pumpEndRaw > pumpStart ? Number((pumpEndRaw - pumpStart).toFixed(2)) : 0);
  const pumpEnd = pumpEndRaw || (pumpStart > 0 && liters > 0 ? Number((pumpStart + liters).toFixed(2)) : 0);
  const date = parseDateFromText(values.data || '') || defaultDate;
  const time = parseTimeFromText(values.hora || '') || values.hora || '';
  const uncertain = [
    !values.prefixo && 'prefixo',
    !date && 'data',
    !time && 'hora',
    !liters && 'quantidadeLitros',
  ].filter(Boolean) as string[];

  if (!values.prefixo && !liters && !pumpStart && !pumpEnd) return null;

  return {
    pagina: 1,
    linha: index + 1,
    prefixo: resolveCatalogText(values.prefixo || '', catalogs.equipamentos),
    data: date,
    hora: time,
    horimetroInicial: parseImportNumber(values.horimetroInicial),
    kmInicial: parseImportNumber(values.kmInicial),
    bombaInicial: pumpStart,
    bombaFinal: pumpEnd,
    quantidadeLitros: liters,
    tipoCombustivel: resolveCatalogText(values.tipoCombustivel || '', catalogs.combustiveis),
    comboio: resolveCatalogText(values.comboio || '', catalogs.comboios),
    responsavel: values.responsavel || '',
    observacao: values.observacao || 'Extração local sem IA; conferir contra o documento.',
    confiancaGeral: uncertain.length ? 0.58 : 0.72,
    camposIncertos: uncertain,
    transcricaoOriginal: Object.values(values).filter(Boolean).join(' | '),
  };
};

const recordFromLooseLine = (line: string, index: number, defaultDate: string, catalogs: FuelDocumentCatalogs) => {
  const prefixo = extractPrefix(line, catalogs.equipamentos);
  const data = parseDateFromText(line) || defaultDate;
  const hora = parseTimeFromText(line);
  let working = line
    .replace(/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/g, ' ')
    .replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, ' ');
  if (prefixo) working = working.replace(new RegExp(prefixo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ');
  const numbers = numericTokens(working).filter(value => value > 0);
  if (!prefixo || numbers.length < 2) return null;

  let horimetroInicial = 0;
  let kmInicial = 0;
  let bombaInicial = 0;
  let bombaFinal = 0;
  let quantidadeLitros = 0;
  const text = normalizeImportText(line);
  const hasKm = /\bkm\b|quilometr|odomet|hodomet/.test(text);
  const hasHorimeter = /horimet|hori|\bhm\b/.test(text);

  if (numbers.length >= 4) {
    const meter = numbers[0];
    if (hasKm || (!hasHorimeter && meter > 20000)) kmInicial = meter;
    else horimetroInicial = meter;
    [bombaInicial, bombaFinal, quantidadeLitros] = numbers.slice(-3);
  } else if (numbers.length === 3) {
    [bombaInicial, bombaFinal, quantidadeLitros] = numbers;
  } else {
    [bombaInicial, bombaFinal] = numbers;
    quantidadeLitros = Math.max(0, Number((bombaFinal - bombaInicial).toFixed(2)));
  }

  if (!quantidadeLitros && bombaFinal > bombaInicial) quantidadeLitros = Number((bombaFinal - bombaInicial).toFixed(2));
  if (!bombaFinal && bombaInicial && quantidadeLitros) bombaFinal = Number((bombaInicial + quantidadeLitros).toFixed(2));

  return {
    pagina: 1,
    linha: index + 1,
    prefixo,
    data,
    hora,
    horimetroInicial,
    kmInicial,
    bombaInicial,
    bombaFinal,
    quantidadeLitros,
    tipoCombustivel: '',
    comboio: '',
    responsavel: '',
    observacao: 'Linha interpretada por extração local; conferir campos antes de gravar.',
    confiancaGeral: 0.5,
    camposIncertos: ['produto', 'comboio', 'responsavel'],
    transcricaoOriginal: line,
  };
};

const parseFuelRowsFromText = (text: string, defaultDate: string, catalogs: FuelDocumentCatalogs) => {
  const lines = text
    .replace(/\u0000/g, ' ')
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line.length >= 4);
  const documentDate = lines.map(parseDateFromText).find(Boolean) || defaultDate;
  const registros: Array<Record<string, any>> = [];
  let headerMap: Array<string | undefined> | null = null;

  lines.forEach((line, index) => {
    const cells = splitStructuredLine(line);
    const possibleHeader = getHeaderMap(cells);
    if (possibleHeader) {
      headerMap = possibleHeader;
      return;
    }

    if (headerMap && cells.length >= 2) {
      const values = cells.reduce<Record<string, string>>((acc, value, cellIndex) => {
        const field = headerMap?.[cellIndex];
        if (field) acc[field] = value;
        return acc;
      }, {});
      const structured = recordFromStructuredValues(values, registros.length, documentDate, catalogs);
      if (structured) {
        registros.push(structured);
        return;
      }
    }

    const loose = recordFromLooseLine(line, registros.length, documentDate, catalogs);
    if (loose) registros.push(loose);
  });

  return { documentDate, registros };
};

export const buildFuelOperationalAnalysis = (
  registros: Array<Record<string, any>>,
  avisosDocumento: string[] = [],
): OperationalAnalysis => {
  const totalRegistros = registros.length;
  const totalLitros = registros.reduce((sum, item) => sum + Number(item.quantidadeLitros || 0), 0);
  const registrosSemPrefixo = registros.filter(item => !cleanImportValue(item.prefixo)).length;
  const registrosSemData = registros.filter(item => !cleanImportValue(item.data)).length;
  const registrosSemHora = registros.filter(item => !cleanImportValue(item.hora)).length;
  const registrosSemLeitura = registros.filter(item => Number(item.horimetroInicial || 0) <= 0 && Number(item.kmInicial || 0) <= 0).length;
  const registrosSemResponsavel = registros.filter(item => !cleanImportValue(item.responsavel)).length;
  const registrosSemComboio = registros.filter(item => !cleanImportValue(item.comboio)).length;
  const baixaConfianca = registros.filter(item => Number(item.confiancaGeral || 0) < 0.75).length;
  const bombaDivergente = registros.filter(item => {
    const bombaInicial = Number(item.bombaInicial || 0);
    const bombaFinal = Number(item.bombaFinal || 0);
    const litros = Number(item.quantidadeLitros || 0);
    return bombaInicial > 0 && bombaFinal > 0 && litros > 0 && Math.abs((bombaInicial + litros) - bombaFinal) > 0.5;
  }).length;
  const duplicates = new Set<string>();
  const duplicateKeys = new Set<string>();
  registros.forEach(item => {
    const key = [item.data, item.hora, item.prefixo, Number(item.quantidadeLitros || 0).toFixed(2)].join('|');
    if (duplicateKeys.has(key)) duplicates.add(key);
    else duplicateKeys.add(key);
  });

  const problems = [
    registrosSemPrefixo ? `${registrosSemPrefixo} registro(s) sem prefixo confiável.` : '',
    registrosSemData ? `${registrosSemData} registro(s) sem data reconhecida.` : '',
    registrosSemHora ? `${registrosSemHora} registro(s) sem horário reconhecido.` : '',
    registrosSemLeitura ? `${registrosSemLeitura} registro(s) sem horímetro nem KM.` : '',
    registrosSemResponsavel ? `${registrosSemResponsavel} registro(s) sem responsável.` : '',
    registrosSemComboio ? `${registrosSemComboio} registro(s) sem comboio/posto informado.` : '',
    baixaConfianca ? `${baixaConfianca} registro(s) com confiança abaixo de 75%.` : '',
    bombaDivergente ? `${bombaDivergente} registro(s) com bomba final diferente de bomba inicial + litros.` : '',
    duplicates.size ? `${duplicates.size} possível(is) duplicidade(s) por data, hora, prefixo e litros.` : '',
  ].filter(Boolean);

  const confianca: OperationalAnalysis['confianca'] = !totalRegistros || baixaConfianca > totalRegistros * 0.4 || avisosDocumento.length > 1
    ? 'Baixa'
    : problems.length
      ? 'Média'
      : 'Alta';

  return {
    resumoExecutivo: totalRegistros
      ? [
        `Foram identificados ${totalRegistros} abastecimento(s), totalizando ${totalLitros.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} litro(s).`,
        problems.length
          ? `A base exige conferência em ${problems.length} frente(s) antes da gravação final.`
          : 'Não foram encontrados problemas estruturais evidentes nos campos extraídos.',
        `Confiança geral da análise: ${confianca}.`,
      ]
      : [
        'Nenhum abastecimento foi extraído automaticamente deste documento.',
        'A análise gerencial fica limitada até existir transcrição/OCR ou configuração da IA no servidor.',
      ],
    principaisProblemas: problems.length
      ? problems
      : ['Nenhum problema operacional foi detectado nos dados extraídos; mantenha a conferência humana antes de gravar.'],
    oportunidadesMelhoria: [
      'Padronizar o formulário de abastecimento com colunas fixas para data, hora, prefixo, leitura, bomba, litros, comboio e responsável.',
      'Obrigar prefixo, litros, data e responsável no momento do lançamento para reduzir retrabalho de conferência.',
      registrosSemLeitura
        ? 'Separar equipamentos controlados por horímetro e por KM para evitar campo preenchido com zero apenas para passar validação.'
        : 'Manter regra de medidor por tipo de frota para melhorar o cálculo de consumo.',
    ],
    automacoesRecomendadas: [
      'Usar OCR/IA no Netlify para fotos e PDFs escaneados, com revisão humana obrigatória para confiança baixa.',
      'Aplicar validação automática de duplicidade, bomba divergente e campos ausentes antes de salvar no banco.',
      'Gerar dashboard de consumo por frota, comboio, responsável e período a partir dos registros conferidos.',
    ],
    indicadores: [
      { nome: 'Registros extraídos', valor: String(totalRegistros), interpretacao: 'Volume de lançamentos identificados no documento.' },
      { nome: 'Litros totais', valor: totalLitros.toLocaleString('pt-BR', { maximumFractionDigits: 2 }), interpretacao: 'Soma de combustível extraída, sem estimar valores ausentes.' },
      { nome: 'Campos críticos ausentes', valor: String(registrosSemPrefixo + registrosSemData + registrosSemHora + registrosSemResponsavel), interpretacao: 'Quanto maior, maior o retrabalho antes da gravação.' },
      { nome: 'Baixa confiança', valor: String(baixaConfianca), interpretacao: 'Linhas que precisam de conferência mais cuidadosa.' },
      { nome: 'Possíveis duplicidades', valor: String(duplicates.size), interpretacao: 'Registros com mesma data, hora, prefixo e litros.' },
    ],
    planoAcao: [
      {
        acao: 'Conferir linhas com baixa confiança ou campos ausentes.',
        impacto: 'Alto',
        dificuldade: 'Baixa',
        tempoEstimado: 'Imediato, durante a importação',
        ganhoEsperado: 'Redução de erros de cadastro e retrabalho posterior.',
      },
      {
        acao: 'Configurar a Function do Netlify com chave da IA para leitura de fotos/PDF escaneado.',
        impacto: 'Alto',
        dificuldade: 'Média',
        tempoEstimado: '1 a 2 horas',
        ganhoEsperado: 'Menos digitação manual e importação mais rápida de documentos de campo.',
      },
      {
        acao: 'Acompanhar KPI semanal de registros com alerta.',
        impacto: 'Médio',
        dificuldade: 'Baixa',
        tempoEstimado: '30 minutos',
        ganhoEsperado: 'Melhoria contínua na qualidade dos apontamentos.',
      },
    ],
    proximosPassos: [
      'Revisar as linhas extraídas contra o documento original.',
      'Corrigir prefixo, data, hora, litros, leitura, comboio e responsável quando houver alerta.',
      'Gravar somente as linhas conferidas e acompanhar o painel de qualidade do combustível.',
    ],
    confianca,
  };
};

export const analyzeFuelDocumentLocally = async (
  file: File,
  catalogs: FuelDocumentCatalogs,
  options: { manualText?: string; defaultDate?: string } = {},
): Promise<LocalFuelDocumentAnalysis> => {
  const manualText = cleanImportValue(options.manualText || '');
  let extractedText = manualText;
  const avisosDocumento: string[] = [];

  if (!extractedText && file.type === 'application/pdf') {
    extractedText = await extractPdfText(file);
    if (extractedText) {
      avisosDocumento.push('PDF lido localmente por texto interno; confira a ordem das colunas antes de gravar.');
    }
  }

  if (!extractedText && file.type.startsWith('image/')) {
    avisosDocumento.push('Foto sem transcrição local. A leitura automática de imagem depende da análise inteligente do servidor.');
  }

  if (!extractedText) {
    return {
      tipoDocumento: 'Extração local',
      dataDocumento: options.defaultDate || null,
      paginas: 1,
      avisosDocumento,
      registros: [],
      analiseOperacional: buildFuelOperationalAnalysis([], avisosDocumento),
    };
  }

  const { documentDate, registros } = parseFuelRowsFromText(extractedText, options.defaultDate || '', catalogs);
  const finalWarnings = [
    ...avisosDocumento,
    'Extração local não substitui OCR/IA para manuscrito; revise cada linha marcada antes de gravar.',
  ];
  return {
    tipoDocumento: manualText ? 'Texto/OCR colado' : 'PDF textual local',
    dataDocumento: documentDate || options.defaultDate || null,
    paginas: file.type === 'application/pdf' ? Math.max(1, (extractedText.match(/\f/g) || []).length + 1) : 1,
    avisosDocumento: finalWarnings,
    registros,
    analiseOperacional: buildFuelOperationalAnalysis(registros, finalWarnings),
  };
};
