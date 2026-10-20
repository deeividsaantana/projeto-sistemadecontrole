import { TABELA_EXCLUSOES, estaExcluido, exclusoesAtivas } from './exclusoes';
import { encolhimentoSemExplicacao, idsArquivados, type TabelaProtegida } from './protecaoEncolhimento';

/**
 * Envio só do que mudou.
 *
 * Até 16/10/2026 cada salvamento baixava o retrato inteiro da nuvem (14,7 MB)
 * e publicava o retrato inteiro de volta, para lançar um abastecimento. Aqui
 * o aparelho guarda uma assinatura curta de cada registro como estava na
 * versão da nuvem que ele conhece. Na hora de salvar compara o que tem com as
 * assinaturas e manda só os registros novos ou alterados e os ids que saíram.
 *
 * As mesmas travas do envio inteiro valem aqui: marca de exclusão nunca é
 * apagada, histórico e presença do link só ganham linhas, e saída em massa
 * sem marca não é enviada (é o navegador que perdeu a cópia).
 */

type Retrato = Record<string, unknown>;

/** Assinaturas da versão `versao` da nuvem: por tabela, id → assinatura. */
export interface AssinaturasNuvem {
  versao: string;
  tabelas: Record<string, Record<string, string>>;
}

export interface MudancaTabela {
  /** Registros novos ou alterados. */
  upsert?: unknown[];
  /** Ids que saíram da tabela. */
  delete?: string[];
}

export type MudancasNuvem = Record<string, MudancaTabela>;

/** Tabelas que só ganham linhas: nunca mandam saída. */
const SOMENTE_ACRESCIMO = new Set(['historyLogs', 'presencasLink', TABELA_EXCLUSOES]);
/** Fora da trava de saída em massa, como no envio inteiro. */
const FORA_DA_TRAVA = new Set(['notifications', 'masterDataReviewQueue']);

// cyrb53: assinatura de 53 bits, rápida e sem dependência.
const assinar = (texto: string): string => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

const assinarRegistro = (item: unknown) => assinar(JSON.stringify(item));

const idDe = (item: unknown): string => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return '';
  const id = (item as { id?: unknown }).id;
  return typeof id === 'string' && id ? id : '';
};

/** Lista em que todo registro tem id próprio e único. Só essas vão por registro. */
const listaPorRegistro = (valor: unknown): valor is unknown[] => {
  if (!Array.isArray(valor)) return false;
  const vistos = new Set<string>();
  for (const item of valor) {
    const id = idDe(item);
    if (!id || vistos.has(id)) return false;
    vistos.add(id);
  }
  return true;
};

/**
 * Assinaturas de um retrato. Devolve null se alguma tabela não for lista de
 * registros com id único: aí só o envio inteiro serve.
 */
export const capturarAssinaturas = (retrato: Retrato | null | undefined, versao: string): AssinaturasNuvem | null => {
  if (!retrato || typeof retrato !== 'object' || !versao) return null;
  const tabelas: AssinaturasNuvem['tabelas'] = {};
  for (const [tabela, valor] of Object.entries(retrato)) {
    if (!listaPorRegistro(valor)) return null;
    const porId: Record<string, string> = {};
    for (const item of valor) porId[idDe(item)] = assinarRegistro(item);
    tabelas[tabela] = porId;
  }
  return { versao, tabelas };
};

/**
 * O que este aparelho mudou desde a versão das assinaturas. Devolve null
 * quando não dá para mandar por registro (aí vai o envio inteiro).
 * `protegidas` lista as tabelas em que a saída em massa sem marca foi segurada.
 */
export const calcularMudancas = (
  retrato: Retrato,
  assinaturas: AssinaturasNuvem,
): { mudancas: MudancasNuvem; protegidas: TabelaProtegida[]; total: number } | null => {
  const mudancas: MudancasNuvem = {};
  const protegidas: TabelaProtegida[] = [];
  let total = 0;
  const ativas = exclusoesAtivas(Array.isArray(retrato[TABELA_EXCLUSOES]) ? retrato[TABELA_EXCLUSOES] as unknown[] : []);
  const arquivados = idsArquivados(retrato);

  for (const [tabela, valor] of Object.entries(retrato)) {
    if (valor === undefined) continue;
    if (!listaPorRegistro(valor)) return null;
    const anteriores = assinaturas.tabelas[tabela] ?? {};

    const upsert: unknown[] = [];
    const presentes = new Set<string>();
    for (const item of valor) {
      const id = idDe(item);
      presentes.add(id);
      if (anteriores[id] !== assinarRegistro(item)) upsert.push(item);
    }

    let saidas: string[] = [];
    if (!SOMENTE_ACRESCIMO.has(tabela)) {
      saidas = Object.keys(anteriores).filter(id => !presentes.has(id));
      const semExplicacao = saidas.filter(id => !estaExcluido(ativas, tabela, id) && !arquivados.get(tabela)?.has(id));
      if (!FORA_DA_TRAVA.has(tabela)
        && encolhimentoSemExplicacao(semExplicacao.length, Object.keys(anteriores).length, valor.length)) {
        const seguradas = new Set(semExplicacao);
        saidas = saidas.filter(id => !seguradas.has(id));
        protegidas.push({ tabela, devolvidos: semExplicacao.length });
      }
    }

    if (upsert.length || saidas.length) {
      mudancas[tabela] = {
        ...(upsert.length ? { upsert } : {}),
        ...(saidas.length ? { delete: saidas } : {}),
      };
      total += upsert.length + saidas.length;
    }
  }

  return { mudancas, protegidas, total };
};

/** Assinaturas da nova versão, depois que as mudanças entraram na nuvem. */
export const aplicarMudancasNasAssinaturas = (
  assinaturas: AssinaturasNuvem,
  mudancas: MudancasNuvem,
  versao: string,
): AssinaturasNuvem => {
  const tabelas = { ...assinaturas.tabelas };
  for (const [tabela, mudanca] of Object.entries(mudancas)) {
    const porId = { ...(tabelas[tabela] ?? {}) };
    for (const item of mudanca.upsert ?? []) porId[idDe(item)] = assinarRegistro(item);
    for (const id of mudanca.delete ?? []) delete porId[id];
    tabelas[tabela] = porId;
  }
  return { versao, tabelas };
};
