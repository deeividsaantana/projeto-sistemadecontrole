import { ROLE_ACCESS, type UserRole } from '../app/navigation/navigation';
import { CAPACIDADES_CONHECIDAS, pode, type Capacidade } from './permissoes';

/**
 * Regras de acesso por pessoa (painel Dev, 16/11/2026). O perfil
 * (admin, gestor, operador, leitura) dá o padrão de cada aba; o dono do
 * sistema pode, pessoa por pessoa e aba por aba, marcar o que ela faz: ver,
 * lançar e editar, aprovar e excluir. Lista vazia = sem acesso à aba.
 * As regras moram em erp_access_rules no Supabase e só mudam pela API do
 * painel, que confere no banco se quem pede é dev.
 */
export type RegrasDeAcesso = Readonly<Record<string, readonly Capacidade[]>>;

export const ABA_DEV = 'dev';

/** Abas que o painel deixa ajustar, na ordem do menu. */
export const ABAS_AJUSTAVEIS: ReadonlyArray<{ id: string; nome: string }> = [
  { id: 'dashboard', nome: 'Visão geral' },
  { id: 'pluviometro', nome: 'Pluviômetro' },
  { id: 'programacao', nome: 'Programação' },
  { id: 'estacas', nome: 'Controle de Estacas' },
  { id: 'solicitacoes', nome: 'Solicitações e Compras' },
  { id: 'controle-equipamentos', nome: 'Controle de Frotas' },
  { id: 'manutencao', nome: 'Manutenção' },
  { id: 'lancamentos', nome: 'Combustível' },
  { id: 'presenca', nome: 'Presença e Controle' },
  { id: 'contratacao', nome: 'Contratação' },
  { id: 'cadastros', nome: 'Cadastros' },
];

export const NOME_DA_ACAO: Record<Capacidade, string> = {
  ver: 'Ver',
  editar: 'Lançar e editar',
  aprovar: 'Aprovar',
  excluir: 'Excluir',
};

/**
 * Lista limpa, na ordem ver, editar, aprovar, excluir. Quem lança, aprova
 * ou exclui também vê (a mesma regra do banco).
 */
export const normalizarAcoes = (acoes: ReadonlyArray<unknown>): Capacidade[] => {
  const marcadas = new Set(acoes.map(String));
  const algumaMarcada = CAPACIDADES_CONHECIDAS.some(acao => marcadas.has(acao));
  return CAPACIDADES_CONHECIDAS.filter(acao => marcadas.has(acao) || (acao === 'ver' && algumaMarcada));
};

/** Linhas do banco viram um mapa aba → ações; o que vier estranho é ignorado. */
export const regrasDasLinhas = (linhas: ReadonlyArray<{ tab?: unknown; actions?: unknown }> | null | undefined): RegrasDeAcesso => {
  const regras: Record<string, Capacidade[]> = {};
  for (const linha of linhas ?? []) {
    const aba = String(linha?.tab ?? '');
    if (!/^[a-z][a-z-]{1,40}$/.test(aba) || aba === ABA_DEV || !Array.isArray(linha?.actions)) continue;
    const acoes = normalizarAcoes(linha.actions);
    // A Visão geral nunca some: é para onde o app leva quem não tem outra aba.
    if (aba === 'dashboard' && !acoes.includes('ver')) continue;
    regras[aba] = acoes;
  }
  return regras;
};

/** O que o perfil dá na aba, sem regra nenhuma. */
export const acoesDoPerfil = (perfil: UserRole, aba: string): Capacidade[] => (
  ROLE_ACCESS[perfil].includes(aba) ? CAPACIDADES_CONHECIDAS.filter(acao => pode(perfil, aba, acao)) : []
);

/** O que vale de verdade: a regra da pessoa, ou o padrão do perfil. */
export const acoesEfetivas = (perfil: UserRole, aba: string, regras: RegrasDeAcesso): Capacidade[] =>
  [...(regras[aba] ?? acoesDoPerfil(perfil, aba))];

/** Resumo curto para o quadro: "—", "Vê", "Lança", "Aprova", "Tudo" ou as iniciais. */
export const resumoDasAcoes = (acoes: readonly Capacidade[]): string => {
  const chave = normalizarAcoes(acoes).join(',');
  const NOMES: Record<string, string> = {
    '': '—',
    ver: 'Vê',
    'ver,editar': 'Lança',
    'ver,editar,aprovar': 'Aprova',
    'ver,editar,aprovar,excluir': 'Tudo',
  };
  return NOMES[chave] ?? normalizarAcoes(acoes).map(acao => NOME_DA_ACAO[acao][0]).join('·');
};

/**
 * Abas que a pessoa abre: as do perfil, menos as tiradas, mais as
 * liberadas. A aba Dev só entra para quem o banco marca como dev.
 */
export const abasLiberadas = (perfil: UserRole, regras: RegrasDeAcesso, ehDev: boolean): string[] => {
  const abas = ROLE_ACCESS[perfil].filter(aba => aba !== ABA_DEV && (regras[aba]?.includes('ver') ?? true));
  for (const [aba, acoes] of Object.entries(regras)) {
    if (acoes.includes('ver') && !abas.includes(aba)) abas.push(aba);
  }
  if (ehDev) abas.push(ABA_DEV);
  return abas;
};

/** Pode fazer isto nesta aba? Com regra, vale a regra; sem regra, o perfil. */
export const podeComRegras = (perfil: UserRole, aba: string, capacidade: Capacidade, regras: RegrasDeAcesso): boolean => {
  const regra = regras[aba];
  return regra ? regra.includes(capacidade) : pode(perfil, aba, capacidade);
};

/** Perfil do app a partir da associação do banco (mesma regra do login). */
export const perfilDaPessoa = (membership: string, claimed: string): UserRole => {
  if (membership === 'admin') return 'admin';
  if (membership === 'editor') return claimed === 'operador' ? 'operador' : 'gestor';
  return 'leitura';
};

export type MudancaComTrava =
  | { tipo: 'aba'; aba: string; acoes: readonly Capacidade[] | null }
  | { tipo: 'perfil'; perfil: UserRole }
  | { tipo: 'situacao'; ativo: boolean }
  | { tipo: 'senha' };

/**
 * Trava do próprio acesso: o dev não tira a própria aba, não sai do perfil
 * de administrador, não se inativa e não troca a própria senha por aqui. O
 * banco e a API conferem o mesmo; aqui é para a tela já avisar antes.
 */
export const motivoDaTrava = (mudanca: MudancaComTrava, ehVoceMesmo: boolean): string | null => {
  const tiraVer = mudanca.tipo === 'aba' && mudanca.acoes !== null && !mudanca.acoes.includes('ver');
  if (mudanca.tipo === 'aba' && mudanca.aba === 'dashboard' && tiraVer) return 'A Visão geral fica sempre aberta para todo mundo.';
  if (!ehVoceMesmo) return null;
  if (tiraVer) return 'Trava de segurança: você não pode tirar uma aba de si mesmo.';
  if (mudanca.tipo === 'perfil' && mudanca.perfil !== 'admin') return 'Trava de segurança: você não pode tirar o seu próprio perfil de administrador.';
  if (mudanca.tipo === 'situacao' && !mudanca.ativo) return 'Trava de segurança: você não pode inativar o seu próprio login.';
  if (mudanca.tipo === 'senha') return 'A sua própria senha você troca pelo "Recuperar senha" da tela de entrada.';
  return null;
};
