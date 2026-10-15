import { TABELA_EXCLUSOES, estaExcluido, exclusoesAtivas } from './exclusoes';

/**
 * Trava contra publicar uma lista vazia ou muito menor por cima da nuvem.
 *
 * O envio monta o retrato com o que está guardado no navegador. Quando o
 * navegador perde a cópia de uma tabela (memória cheia, aba anônima, cópia que
 * não chegou a ser gravada), o retrato sai com a lista vazia e a nuvem perdia
 * tudo. Foi assim que em 15/10/2026 sumiram os abastecimentos, os materiais e
 * 185 equipamentos.
 *
 * Exclusão de verdade continua passando: a que tem marca em `exclusoes`, o que
 * foi para um período arquivado e qualquer exclusão pequena (menos de 20
 * registros ou menos de 20% da tabela). O que passar disso sem explicação
 * volta para o retrato antes de publicar.
 */

export const MINIMO_PARA_PROTEGER = 20;
export const FRACAO_PARA_PROTEGER = 0.2;

/** Tabelas que já só ganham linhas na mesclagem ou que podem ser limpas de propósito. */
const TABELAS_FORA_DA_TRAVA = new Set(['historyLogs', 'notifications', 'presencasLink', 'masterDataReviewQueue', TABELA_EXCLUSOES]);

type Retrato = Record<string, unknown>;

export interface TabelaProtegida {
  tabela: string;
  devolvidos: number;
}

const idDe = (item: unknown): string => {
  if (!item || typeof item !== 'object') return '';
  const id = (item as { id?: unknown }).id;
  return typeof id === 'string' ? id : '';
};

/** Ids que saíram da operação para um período arquivado, por tabela do retrato. */
const idsArquivados = (retrato: Retrato): Map<string, Set<string>> => {
  const porTabela = new Map<string, Set<string>>();
  const guardar = (tabela: string, itens: unknown) => {
    if (!Array.isArray(itens)) return;
    const ids = porTabela.get(tabela) ?? new Set<string>();
    itens.forEach(item => { const id = idDe(item); if (id) ids.add(id); });
    porTabela.set(tabela, ids);
  };
  const periodos = retrato.periodosArquivados;
  if (!Array.isArray(periodos)) return porTabela;
  for (const periodo of periodos) {
    const dados = periodo && typeof periodo === 'object' ? (periodo as { dados?: unknown }).dados : undefined;
    if (!dados || typeof dados !== 'object') continue;
    for (const [tabela, itens] of Object.entries(dados as Record<string, unknown>)) {
      if (tabela === 'estacas' && itens && typeof itens === 'object') {
        guardar('estacaLotes', (itens as { lotes?: unknown }).lotes);
        guardar('estacaCravacoes', (itens as { cravacoes?: unknown }).cravacoes);
      } else {
        guardar(tabela, itens);
      }
    }
  }
  return porTabela;
};

/**
 * Compara o que vai ser publicado com o que está na nuvem e devolve, tabela a
 * tabela, os registros que sumiriam sem explicação. Quem chama tira a base de
 * sincronização do retrato que o aparelho montou (sem os devolvidos), para que
 * o próximo download traga os devolvidos de volta para este aparelho.
 */
export const protegerContraEncolhimento = <T extends Retrato>(
  nuvem: Retrato | null | undefined,
  publicando: T,
): { retrato: T; protegidas: TabelaProtegida[] } => {
  if (!nuvem || typeof nuvem !== 'object') return { retrato: publicando, protegidas: [] };

  const marcas = [
    ...(Array.isArray(nuvem[TABELA_EXCLUSOES]) ? nuvem[TABELA_EXCLUSOES] as unknown[] : []),
    ...(Array.isArray(publicando[TABELA_EXCLUSOES]) ? publicando[TABELA_EXCLUSOES] as unknown[] : []),
  ];
  const ativas = exclusoesAtivas(marcas);
  const arquivados = idsArquivados(publicando);

  let retrato: Retrato | null = null;
  const protegidas: TabelaProtegida[] = [];

  for (const [tabela, valorNuvem] of Object.entries(nuvem)) {
    if (TABELAS_FORA_DA_TRAVA.has(tabela) || !Array.isArray(valorNuvem) || valorNuvem.length === 0) continue;
    const valorLocal = publicando[tabela];
    if (valorLocal !== undefined && !Array.isArray(valorLocal)) continue;
    const locais = Array.isArray(valorLocal) ? valorLocal : [];
    const idsLocais = new Set(locais.map(idDe).filter(Boolean));
    const arquivadosDaTabela = arquivados.get(tabela);

    const sumidos = valorNuvem.filter(item => {
      const id = idDe(item);
      return Boolean(id)
        && !idsLocais.has(id)
        && !estaExcluido(ativas, tabela, id)
        && !arquivadosDaTabela?.has(id);
    });
    if (sumidos.length < MINIMO_PARA_PROTEGER || sumidos.length < valorNuvem.length * FRACAO_PARA_PROTEGER) continue;

    retrato ??= { ...publicando };
    retrato[tabela] = [...locais, ...sumidos];
    protegidas.push({ tabela, devolvidos: sumidos.length });
  }

  return { retrato: (retrato ?? publicando) as T, protegidas };
};
