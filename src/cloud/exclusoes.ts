/**
 * Exclusão real de cadastros, que vale em todos os aparelhos.
 *
 * A nuvem guarda um retrato inteiro dos dados, e cada aparelho publica o seu.
 * Tirar o registro da lista só apaga de verdade se todos os aparelhos souberem
 * que ele foi excluído: sem isso, um aparelho atrasado ou recém-instalado
 * (sem base de sincronização) publica o registro de volta.
 *
 * Por isso a própria exclusão vira um registro, na tabela `exclusoes`. Ela só
 * cresce, é somada (nunca trocada) em toda mesclagem e em todo download, e a
 * regra `aplicarExclusoes` tira dos retratos qualquer registro com exclusão
 * ativa. Restaurar marca a exclusão como desfeita e devolve a cópia guardada.
 *
 * Não depende do Firebase: no Supabase a mesma marca vira `deleted_at` e
 * `deleted_by` na linha do cadastro.
 */

export const TABELA_EXCLUSOES = 'exclusoes';

export interface ExclusaoRegistro {
  id: string;
  /** Nome da tabela no retrato da nuvem (ex.: `funcionarios`). */
  tabela: string;
  registroId: string;
  /** Como a pessoa reconhece o cadastro na Lixeira (nome, prefixo). */
  rotulo: string;
  /** Cópia do cadastro no momento da exclusão, para restaurar. */
  registro: Record<string, unknown>;
  excluidoEm: string;
  excluidoPor: string;
  restauradoEm?: string;
  restauradoPor?: string;
  atualizadoEm: string;
}

type Snapshot = Record<string, unknown>;

// Fotos e assinaturas em base64 podem passar do limite de um bloco da nuvem.
// A Lixeira precisa dos dados do cadastro, não da imagem.
const LIMITE_CAMPO_COPIA = 20_000;

const copiaRestauravel = (registro: Record<string, unknown>): Record<string, unknown> => (
  Object.fromEntries(Object.entries(registro).filter(([, valor]) => (
    typeof valor !== 'string' || valor.length <= LIMITE_CAMPO_COPIA
  )))
);

export const criarExclusao = ({
  tabela,
  registro,
  rotulo,
  usuario,
  agora,
}: {
  tabela: string;
  registro: { id: string } & Record<string, unknown>;
  rotulo: string;
  usuario: string;
  agora: string;
}): ExclusaoRegistro => ({
  id: `exc-${tabela}-${registro.id}-${Date.parse(agora) || Date.now()}`,
  tabela,
  registroId: registro.id,
  rotulo,
  registro: copiaRestauravel(registro),
  excluidoEm: agora,
  excluidoPor: usuario,
  atualizadoEm: agora,
});

export const restaurarExclusao = (exclusao: ExclusaoRegistro, usuario: string, agora: string): ExclusaoRegistro => ({
  ...exclusao,
  restauradoEm: agora,
  restauradoPor: usuario,
  atualizadoEm: agora,
});

const isExclusao = (valor: unknown): valor is ExclusaoRegistro => {
  if (!valor || typeof valor !== 'object') return false;
  const item = valor as Partial<ExclusaoRegistro>;
  return typeof item.id === 'string'
    && typeof item.tabela === 'string'
    && typeof item.registroId === 'string'
    && typeof item.excluidoEm === 'string';
};

const chave = (tabela: string, registroId: string) => `${tabela}\u0000${registroId}`;

/**
 * Para cada cadastro, vale o evento de exclusão mais recente: excluir,
 * restaurar e excluir de novo deixa o cadastro excluído.
 */
export const exclusoesAtivas = (exclusoes: readonly unknown[]): Map<string, ExclusaoRegistro> => {
  const ultimaPorRegistro = new Map<string, ExclusaoRegistro>();
  for (const item of exclusoes) {
    if (!isExclusao(item)) continue;
    const k = chave(item.tabela, item.registroId);
    const atual = ultimaPorRegistro.get(k);
    if (!atual || item.excluidoEm > atual.excluidoEm) ultimaPorRegistro.set(k, item);
  }
  for (const [k, item] of ultimaPorRegistro) {
    if (item.restauradoEm) ultimaPorRegistro.delete(k);
  }
  return ultimaPorRegistro;
};

export const estaExcluido = (ativas: Map<string, ExclusaoRegistro>, tabela: string, registroId: string) => (
  ativas.has(chave(tabela, registroId))
);

/**
 * Tira de cada tabela do retrato os registros com exclusão ativa. Não depende
 * de horário nem da base de sincronização, então vale igual em qualquer
 * aparelho, atrasado ou novo. Devolve o mesmo objeto quando não há o que tirar.
 */
export const aplicarExclusoes = <T extends Snapshot>(snapshot: T): T => {
  const lista = snapshot[TABELA_EXCLUSOES];
  if (!Array.isArray(lista) || lista.length === 0) return snapshot;
  const ativas = exclusoesAtivas(lista);
  if (ativas.size === 0) return snapshot;
  const tabelas = new Set(Array.from(ativas.values(), item => item.tabela));
  let resultado: Snapshot | null = null;
  for (const tabela of tabelas) {
    const registros = snapshot[tabela];
    if (!Array.isArray(registros)) continue;
    const filtrados = registros.filter(item => {
      const id = item && typeof item === 'object' ? (item as { id?: unknown }).id : undefined;
      return typeof id !== 'string' || !estaExcluido(ativas, tabela, id);
    });
    if (filtrados.length === registros.length) continue;
    resultado ??= { ...snapshot };
    resultado[tabela] = filtrados;
  }
  return (resultado ?? snapshot) as T;
};
