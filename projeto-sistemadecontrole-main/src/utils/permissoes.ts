import type { UserRole } from '../app/navigation/navigation';

export type Capacidade = 'ver' | 'editar' | 'aprovar' | 'excluir';

/**
 * Matriz única de capacidades por papel. Antes cada tela decidia com um
 * `['admin','gestor'].includes(role)` solto no meio do JSX; agora existe um
 * lugar só para mudar quem pode o quê.
 *
 * Isto é ergonomia de interface, não segurança: a autorização real está nas
 * regras do Firestore e nas custom claims. Esconder um botão não protege dado —
 * a regra do servidor é quem recusa a gravação.
 */
const CAPACIDADES: Record<Capacidade, readonly UserRole[]> = {
  ver: ['admin', 'gestor', 'operador', 'leitura'],
  editar: ['admin', 'gestor', 'operador'],
  aprovar: ['admin', 'gestor'],
  excluir: ['admin'],
};

/** Módulos onde a operação registra, mas não decide. */
const SOMENTE_GESTAO: Record<string, readonly Capacidade[]> = {
  medicoes: ['ver', 'editar', 'aprovar', 'excluir'],
  orcamento: ['ver', 'editar', 'aprovar', 'excluir'],
  custos: ['ver', 'editar', 'aprovar', 'excluir'],
  'nao-conformidades': ['ver', 'editar', 'aprovar', 'excluir'],
  planejamento: ['ver', 'editar', 'aprovar', 'excluir'],
  documentos: ['ver', 'editar', 'aprovar', 'excluir'],
  frentes: ['ver', 'editar', 'aprovar', 'excluir'],
  auditoria: ['ver'],
};

const PAPEIS_DE_GESTAO: readonly UserRole[] = ['admin', 'gestor'];

/**
 * Pode o papel exercer a capacidade no módulo? Módulos de gestão exigem gestão
 * mesmo para editar — a operação registra o que acontece em campo, não decide
 * medição, orçamento ou tratativa de não conformidade.
 */
export const pode = (papel: UserRole, modulo: string, capacidade: Capacidade): boolean => {
  if (modulo === 'auditoria') return papel === 'admin';
  if (capacidade === 'aprovar' && ['medicoes', 'orcamento'].includes(modulo)) return papel === 'admin';
  if (SOMENTE_GESTAO[modulo] && capacidade !== 'ver') {
    return PAPEIS_DE_GESTAO.includes(papel) && CAPACIDADES[capacidade].includes(papel);
  }
  return CAPACIDADES[capacidade].includes(papel);
};

export const CAPACIDADES_CONHECIDAS: Capacidade[] = ['ver', 'editar', 'aprovar', 'excluir'];

/** Resumo por módulo, para a tela de permissões mostrar a matriz efetiva. */
export const matrizDoModulo = (modulo: string, papeis: UserRole[]) =>
  papeis.map(papel => ({
    papel,
    capacidades: CAPACIDADES_CONHECIDAS.filter(capacidade => pode(papel, modulo, capacidade)),
  }));
