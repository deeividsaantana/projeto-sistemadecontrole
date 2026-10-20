import { TABELA_EXCLUSOES, aplicarExclusoes } from './exclusoes';
import { assinarRegistro, type AssinaturasNuvem } from './mudancasNuvem';

type Retrato = Record<string, unknown>;

export interface TabelaEditada {
  tabela: string;
  editados: number;
}

/** Tabelas que já têm a própria regra de junção. */
const FORA = new Set(['historyLogs', 'presencasLink', TABELA_EXCLUSOES]);

const idDe = (item: unknown): string => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return '';
  const id = (item as { id?: unknown }).id;
  return typeof id === 'string' ? id : '';
};

const momento = (item: unknown): number => {
  if (!item || typeof item !== 'object') return Number.NaN;
  const registro = item as { atualizadoEm?: unknown; updatedAt?: unknown };
  const texto = typeof registro.atualizadoEm === 'string' && registro.atualizadoEm
    ? registro.atualizadoEm
    : typeof registro.updatedAt === 'string' ? registro.updatedAt : '';
  return texto ? Date.parse(texto) : Number.NaN;
};

/**
 * Edição feita num aparelho atrasado se perdia (auditoria de 16/10, A13): o
 * mecânico concluía a OS no celular, a nuvem tinha a versão antiga e, sem data
 * nos dois lados, a da nuvem ganhava no download e no envio.
 *
 * As assinaturas guardam cada registro como estava na versão da nuvem que este
 * aparelho conhece. Com elas dá para saber quem mudou desde então:
 * - só o aparelho mudou → fica a versão do aparelho;
 * - só a nuvem mudou → fica a da nuvem;
 * - os dois mudaram → fica a de data mais nova; sem data, a da nuvem.
 *
 * Sem assinaturas da versão conhecida nada muda: vale a regra antiga.
 */
export const manterEdicoesLocais = <T extends Retrato>(
  nuvem: T,
  local: Retrato,
  base: AssinaturasNuvem | null | undefined,
): { retrato: T; editadas: TabelaEditada[] } => {
  if (!base) return { retrato: nuvem, editadas: [] };
  let retrato: Retrato | null = null;
  const editadas: TabelaEditada[] = [];

  for (const [tabela, valorLocal] of Object.entries(local)) {
    const valorNuvem = nuvem[tabela];
    const assinaturas = base.tabelas[tabela];
    if (FORA.has(tabela) || !assinaturas || !Array.isArray(valorLocal) || !Array.isArray(valorNuvem)) continue;
    const locais = new Map<string, unknown>();
    for (const item of valorLocal) {
      const id = idDe(item);
      if (id && assinaturas[id]) locais.set(id, item);
    }
    if (locais.size === 0) continue;

    let trocados = 0;
    const lista = valorNuvem.map(itemNuvem => {
      const id = idDe(itemNuvem);
      const itemLocal = id ? locais.get(id) : undefined;
      if (itemLocal === undefined) return itemNuvem;
      const assinaturaLocal = assinarRegistro(itemLocal);
      const assinaturaBase = assinaturas[id];
      if (assinaturaLocal === assinaturaBase) return itemNuvem;
      const assinaturaNuvem = assinarRegistro(itemNuvem);
      if (assinaturaNuvem === assinaturaLocal) return itemNuvem;
      const ficaLocal = assinaturaNuvem === assinaturaBase || momento(itemLocal) > momento(itemNuvem);
      if (!ficaLocal) return itemNuvem;
      trocados += 1;
      return itemLocal;
    });
    if (trocados === 0) continue;
    retrato ??= { ...nuvem };
    retrato[tabela] = lista;
    editadas.push({ tabela, editados: trocados });
  }

  if (!retrato) return { retrato: nuvem, editadas: [] };
  return { retrato: aplicarExclusoes(retrato) as T, editadas };
};
