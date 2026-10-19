import { TABELA_EXCLUSOES, aplicarExclusoes, estaExcluido, exclusoesAtivas } from './exclusoes';
import { buildFuelImportKey, isPublishableFuelImport } from '../utils/fuelImportIdentity';

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
 *
 * As marcas de exclusão nunca diminuem: a que está na nuvem e falta no
 * aparelho volta sempre, em qualquer quantidade, e o cadastro que ela marca
 * sai do retrato. Sem isso um aparelho que não tinha as marcas publicava por
 * cima e os excluídos voltavam (23 equipes, 16/10/2026).
 */

export const MINIMO_PARA_PROTEGER = 20;
export const FRACAO_PARA_PROTEGER = 0.2;

/** Tabelas que já só ganham linhas na mesclagem ou que podem ser limpas de propósito. */
const TABELAS_FORA_DA_TRAVA = new Set(['historyLogs', 'notifications', 'presencasLink', 'masterDataReviewQueue', TABELA_EXCLUSOES]);

type Retrato = Record<string, unknown>;

/**
 * O mesmo abastecimento pode existir com dois ids: um aparelho guardou a
 * importação antiga da planilha e a nuvem recebeu a mesma linha de outra
 * importação. Devolver pelo id duplicava o diesel (16/10/2026). Para essas
 * tabelas, o que já existe do outro lado com o mesmo conteúdo não volta.
 */
export const CHAVE_DE_CONTEUDO: Record<string, (item: unknown) => string> = {
  abastecimentos: item => {
    if (!item || typeof item !== 'object') return '';
    return isPublishableFuelImport(item) ? buildFuelImportKey(item) : '';
  },
};

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
export const idsArquivados = (retrato: Retrato): Map<string, Set<string>> => {
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
    const chaveDe = CHAVE_DE_CONTEUDO[tabela];
    const chavesLocais = chaveDe ? new Set(locais.map(chaveDe).filter(Boolean)) : null;

    const sumidos = valorNuvem.filter(item => {
      const id = idDe(item);
      return Boolean(id)
        && !idsLocais.has(id)
        && !estaExcluido(ativas, tabela, id)
        && !arquivadosDaTabela?.has(id)
        && !(chavesLocais && chaveDe && chavesLocais.has(chaveDe(item)));
    });
    if (sumidos.length < MINIMO_PARA_PROTEGER || sumidos.length < valorNuvem.length * FRACAO_PARA_PROTEGER) continue;

    retrato ??= { ...publicando };
    retrato[tabela] = [...locais, ...sumidos];
    protegidas.push({ tabela, devolvidos: sumidos.length });
  }

  const marcasNuvem = Array.isArray(nuvem[TABELA_EXCLUSOES]) ? nuvem[TABELA_EXCLUSOES] as unknown[] : [];
  const marcasLocais = Array.isArray(publicando[TABELA_EXCLUSOES]) ? publicando[TABELA_EXCLUSOES] as unknown[] : [];
  const idsMarcasLocais = new Set(marcasLocais.map(idDe).filter(Boolean));
  const marcasQueFaltam = marcasNuvem.filter(item => {
    const id = idDe(item);
    return Boolean(id) && !idsMarcasLocais.has(id);
  });
  if (marcasQueFaltam.length > 0) {
    retrato = aplicarExclusoes({ ...(retrato ?? publicando), [TABELA_EXCLUSOES]: [...marcasLocais, ...marcasQueFaltam] });
    protegidas.push({ tabela: TABELA_EXCLUSOES, devolvidos: marcasQueFaltam.length });
  }

  return { retrato: (retrato ?? publicando) as T, protegidas };
};
