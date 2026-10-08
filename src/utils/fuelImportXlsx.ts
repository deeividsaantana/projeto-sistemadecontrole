import * as XLSX from 'xlsx';
import type { Abastecimento, TipoCombustivel } from '../types';

export interface FuelImportConfig {
  file: File;
  equipamentosPorPrefixo: Map<string, string>; // prefixo -> equipamentoId
  combustivelPorNome: Map<string, string>; // nome -> combustivelId
  comboiosPorNome: Map<string, string>; // nome -> comboioId
  usuarioResponsavel: string;
}

export interface FuelImportPreview {
  registrosImportados: Abastecimento[];
  combustiveisNovos: TipoCombustivel[];
  equipamentosNaoEncontrados: Set<string>;
  erros: Array<{ aba: string; linha: number; erro: string }>;
  avisos: Array<{ aba: string; linha: number; aviso: string }>;
}

/**
 * Normaliza string para comparação (remove acentos e converte para lowercase)
 */
const normalizar = (texto: string): string =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * Parse de número flexível (suporta . e , como separador decimal)
 */
const parseNumero = (valor: unknown): number => {
  if (typeof valor === 'number') return valor;
  if (typeof valor !== 'string') return 0;
  const texto = valor.trim().replace(/\./g, '').replace(',', '.');
  const num = parseFloat(texto);
  return Number.isNaN(num) ? 0 : num;
};

/**
 * Parse de data flexível (DD/MM/YYYY, YYYY-MM-DD, etc)
 */
const parseData = (valor: unknown): string | null => {
  if (typeof valor === 'number') {
    // Excel date serial
    const data = new Date((valor - 25569) * 86400 * 1000);
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
  if (typeof valor !== 'string') return null;

  const texto = valor.trim();
  // Tenta YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  // Tenta DD/MM/YYYY
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto);
  if (match) {
    const [, dia, mes, ano] = match;
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }
  return null;
};

/**
 * Parse de hora flexível (HH:MM, HHMM, etc)
 */
const parseHora = (valor: unknown): string | null => {
  if (typeof valor !== 'string') return null;
  const texto = valor.trim();
  // HH:MM
  if (/^\d{2}:\d{2}$/.test(texto)) return texto;
  // HHMM
  if (/^\d{4}$/.test(texto)) return `${texto.slice(0, 2)}:${texto.slice(2)}`;
  return null;
};

/**
 * Processa uma linha de abastecimento do Excel
 */
const processarLinhaAbastecimento = (
  linha: Record<string, unknown>,
  abaAtual: string,
  numLinha: number,
  config: FuelImportConfig,
  erros: Array<{ aba: string; linha: number; erro: string }>,
  avisos: Array<{ aba: string; linha: number; aviso: string }>,
  equipamentosNaoEncontrados: Set<string>,
  combustiveisNovos: Map<string, TipoCombustivel>,
): Abastecimento | null => {
  // Extrai campos da linha
  const prefixo = String(linha['Prefixo'] || linha['PREFIXO'] || '').trim();
  const dataStr = linha['Data'] || linha['DATA'];
  const horaStr = linha['Hora'] || linha['HORA'];
  const litrosStr = linha['Litros'] || linha['LITROS'] || linha['Quantidade'];
  const bombaInicialStr = linha['Bomba Inicial'] || linha['BOMBA_INICIAL'];
  const bombaFinalStr = linha['Bomba Final'] || linha['BOMBA_FINAL'];
  const kmStr = linha['KM'] || linha['Km'];
  const horimetroStr = linha['Horímetro'] || linha['HORIMETRO'] || linha['Horímetro Inicial'];
  const combustivelStr = linha['Combustível'] || linha['COMBUSTIVEL'] || 'Diesel';
  const comboioStr = linha['Comboio'] || linha['COMBOIO'] || '';

  // Validações mínimas
  if (!prefixo) {
    erros.push({ aba: abaAtual, linha: numLinha, erro: 'Prefixo vazio' });
    return null;
  }

  const data = parseData(dataStr);
  if (!data) {
    erros.push({ aba: abaAtual, linha: numLinha, erro: `Data inválida: ${dataStr}` });
    return null;
  }

  const hora = parseHora(horaStr) || '00:00';

  const litros = parseNumero(litrosStr);
  if (litros <= 0) {
    erros.push({ aba: abaAtual, linha: numLinha, erro: `Litros inválido: ${litrosStr}` });
    return null;
  }

  // Busca equipamento
  const equipamentoIdNormalizado = config.equipamentosPorPrefixo.get(normalizar(prefixo));
  if (!equipamentoIdNormalizado) {
    equipamentosNaoEncontrados.add(prefixo);
    avisos.push({ aba: abaAtual, linha: numLinha, aviso: `Equipamento não encontrado: ${prefixo}` });
  }

  // Busca ou cria combustível
  const combustivelNormalizado = normalizar(String(combustivelStr));
  let combustivelId = config.combustivelPorNome.get(combustivelNormalizado);
  if (!combustivelId) {
    const novoId = `combustivel-${Date.now()}-${Math.random()}`;
    combustivelId = novoId;
    combustiveisNovos.set(combustivelNormalizado, {
      id: novoId,
      nome: String(combustivelStr),
    });
  }

  // Busca comboio (opcional)
  const comboioId = comboioStr ? (config.comboiosPorNome.get(normalizar(String(comboioStr))) || '') : '';

  const bombaInicial = parseNumero(bombaInicialStr);
  const bombaFinal = parseNumero(bombaFinalStr) || bombaInicial + litros;
  const km = parseNumero(kmStr);
  const horimetro = parseNumero(horimetroStr);

  return {
    id: `import-${Date.now()}-${Math.random()}`,
    data,
    hora,
    equipamentoId: equipamentoIdNormalizado || '',
    prefixoInformado: prefixo,
    horimetroInicial: horimetro,
    kmInicial: km,
    bombaInicial,
    quantidadeLitros: litros,
    bombaFinal,
    tipoCombustivelId: combustivelId,
    comboioId: comboioId || '',
    responsavel: config.usuarioResponsavel,
    observacao: `Importado de ${abaAtual}`,
    origem: 'Planilha',
    integracaoAba: abaAtual,
    integracaoLinha: numLinha,
  };
};

/**
 * Importa abastecimentos de arquivo Excel
 */
export const importarAbastecimentosXlsx = async (config: FuelImportConfig): Promise<FuelImportPreview> => {
  const registrosImportados: Abastecimento[] = [];
  const combustiveisNovos = new Map<string, TipoCombustivel>();
  const equipamentosNaoEncontrados = new Set<string>();
  const erros: Array<{ aba: string; linha: number; erro: string }> = [];
  const avisos: Array<{ aba: string; linha: number; aviso: string }> = [];

  try {
    const arrayBuffer = await config.file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // Processa abas que combinam padrão de data (ex: "OUTUBRO 2026", "SETEMBRO 2026")
    const abasPadrao = workbook.SheetNames.filter(nome => /^\w+\s+\d{4}$/.test(nome));
    const abas = abasPadrao.length > 0 ? abasPadrao : workbook.SheetNames;

    for (const nomeDaAba of abas) {
      const sheet = workbook.Sheets[nomeDaAba];
      if (!sheet) continue;

      const dados = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      dados.forEach((linha, idx) => {
        const numLinha = idx + 2; // +1 para header, +1 para 1-based
        const registro = processarLinhaAbastecimento(
          linha as Record<string, unknown>,
          nomeDaAba,
          numLinha,
          config,
          erros,
          avisos,
          equipamentosNaoEncontrados,
          combustiveisNovos,
        );
        if (registro) registrosImportados.push(registro);
      });
    }
  } catch (erro) {
    erros.push({
      aba: 'Geral',
      linha: 0,
      erro: `Erro ao ler arquivo: ${erro instanceof Error ? erro.message : String(erro)}`,
    });
  }

  return {
    registrosImportados,
    combustiveisNovos: Array.from(combustiveisNovos.values()),
    equipamentosNaoEncontrados,
    erros,
    avisos,
  };
};
