import type { UserRole } from '../app/navigation/navigation';

/**
 * Tabelas de gestão que o perfil operador não altera (src/utils/permissoes.ts).
 * O banco recusa o envio do operador que mexe nelas (erp_recusar_por_perfil,
 * migration 202611040003). Para uma diferença local que ele não causou não
 * travar todos os envios dele, o aparelho do operador nunca as envia e, no
 * download, fica com a versão da nuvem.
 */
export const TABELAS_DE_GESTAO = [
  'planejamentoItens',
  'naoConformidades',
  'medicoes',
  'documentos',
  'lancamentosCusto',
  'orcamentoItens',
  'frentesServico',
] as const;

/** Cadastros: o operador atualiza (SGE, presença), mas não exclui. */
export const TABELAS_DE_CADASTRO = [
  'empresas',
  'obras',
  'equipamentos',
  'funcionarios',
  'motoristasOperacionais',
  'comboios',
  'canteiros',
  'combustiveis',
  'lubrificantes',
  'etapas',
  'materiaisCadastro',
] as const;

const NENHUMA: readonly string[] = [];
const COM_MARCA_DA_NUVEM: readonly string[] = [...TABELAS_DE_GESTAO, ...TABELAS_DE_CADASTRO];

/** Tabelas que, para este perfil, valem só como estão na nuvem. */
export const tabelasSoDaNuvem = (papel: UserRole): readonly string[] => (papel === 'operador' ? TABELAS_DE_GESTAO : NENHUMA);

/** Troca as tabelas pela versão da nuvem; a que a nuvem não tem sai do retrato. */
export const comTabelasDaNuvem = <T extends Record<string, unknown>>(
  retrato: T,
  nuvem: Record<string, unknown> | null | undefined,
  tabelas: readonly string[],
): T => {
  if (tabelas.length === 0) return retrato;
  const proximo: Record<string, unknown> = { ...retrato };
  for (const tabela of tabelas) {
    if (nuvem && tabela in nuvem) proximo[tabela] = nuvem[tabela];
    else delete proximo[tabela];
  }
  return proximo as T;
};

/** Retrato sem as tabelas: o envio por mudança só compara o que recebe. */
export const semTabelas = <T extends Record<string, unknown>>(retrato: T, tabelas: readonly string[]): T => {
  if (tabelas.length === 0) return retrato;
  const proximo: Record<string, unknown> = { ...retrato };
  for (const tabela of tabelas) delete proximo[tabela];
  return proximo as T;
};

/**
 * Tabelas cuja marca de exclusão, para este perfil, vale só como está na nuvem:
 * marca local (por exemplo de um gestor que usou o mesmo aparelho sem rede)
 * seria recusada pelo banco em todo envio do operador.
 */
export const marcasSoDaNuvem = (papel: UserRole): readonly string[] => (papel === 'operador' ? COM_MARCA_DA_NUVEM : NENHUMA);

/** Marcas de exclusão dessas tabelas vêm da nuvem; as das demais ficam com o aparelho. */
export const comMarcasDaNuvem = (local: readonly unknown[], nuvem: readonly unknown[] | null | undefined, tabelas: readonly string[]): unknown[] => {
  if (tabelas.length === 0) return [...local];
  const protegida = (marca: unknown) => Boolean(marca && typeof marca === 'object' && tabelas.includes(String((marca as { tabela?: unknown }).tabela)));
  return [...local.filter(marca => !protegida(marca)), ...(nuvem || []).filter(protegida)];
};

/**
 * Cópia local com as marcas dessas tabelas iguais às da nuvem, para quem compara
 * o aparelho com a nuvem no download: senão a marca filtrada volta como novidade
 * ou como "marca nunca diminui", e tira de novo o registro que a nuvem devolveu.
 */
export const comMarcasLocaisDaNuvem = <T extends Record<string, unknown>>(local: T, nuvem: readonly unknown[], tabelas: readonly string[]): T => (
  tabelas.length === 0 ? local : { ...local, exclusoes: comMarcasDaNuvem(Array.isArray(local.exclusoes) ? local.exclusoes : [], nuvem, tabelas) }
);

/** Mensagem da recusa por perfil (ROLE_WRITE_DENIED), para o app reconhecer e se curar. */
export const NUVEM_RECUSOU_PERFIL = 'A nuvem recusou o envio: o seu perfil não pode alterar orçamento, custos, medições, planejamento, documentos ou frentes, nem excluir cadastros. Nada foi perdido; peça a um gestor para fazer essa mudança.';

export const recusadoPorPerfil = (erro: unknown) => String((erro as { message?: unknown })?.message ?? erro ?? '') === NUVEM_RECUSOU_PERFIL;
