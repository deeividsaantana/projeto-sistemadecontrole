import {
  CalendarRange,
  Target,
  ClipboardList,
  FolderPlus,
  Hammer,
  LayoutDashboard,
  LayoutGrid,
  SunMedium,
  Package,
  UserRound,
  Wrench,
  Activity,
  Users,
  NotebookPen,
  Smartphone,
  FileBarChart,
  Database,
  type LucideIcon,
} from 'lucide-react';

export type UserRole = 'admin' | 'gestor' | 'operador' | 'leitura';

export type NavigationItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export const NAVIGATION_GROUPS = [
  {
    label: 'Visão geral',
    items: [
      { id: 'dashboard', label: 'Painel de Controle', icon: LayoutDashboard },
      { id: 'meu-dia', label: 'Meu dia', icon: SunMedium },
    ],
  },
  {
    label: 'Operação',
    items: [
      { id: 'modo-campo', label: 'Modo Campo', icon: Smartphone },
      { id: 'planejamento', label: 'Previsto x Executado', icon: Target },
      { id: 'diario-obra', label: 'Diário de Obra', icon: NotebookPen },
      { id: 'estacas', label: 'Controle de Estacas', icon: Hammer },
    ],
  },
  {
    label: 'Equipamentos',
    items: [
      { id: 'controle-equipamentos', label: 'Controle Operacional de Frotas', icon: Activity },
      { id: 'quadro-frota', label: 'Quadro da Frota', icon: LayoutGrid },
      { id: 'manutencao', label: 'Manutenção', icon: Wrench },
      { id: 'lancamentos', label: 'Combustível', icon: ClipboardList },
    ],
  },
  {
    label: 'Pessoas',
    items: [
      { id: 'colaboradores', label: 'Colaboradores', icon: UserRound },
      { id: 'presenca', label: 'Presença e Controle', icon: Users },
    ],
  },
  {
    label: 'Materiais',
    items: [
      { id: 'materiais', label: 'Materiais e Estoque', icon: Package },
    ],
  },
  {
    label: 'Análise',
    items: [
      { id: 'relatorios', label: 'Relatórios', icon: FileBarChart },
    ],
  },
  {
    label: 'Administração',
    items: [
      { id: 'cadastros', label: 'Cadastros', icon: FolderPlus },
      { id: 'administracao', label: 'Administração', icon: Database },
    ],
  },
] as const;

/**
 * Telas que alguém consegue abrir. Toda tela do App precisa estar aqui e no
 * ROLE_ACCESS; endereço antigo passa por MODULE_REDIRECTS.
 */
export const PRIMARY_MODULE_IDS = [
  'dashboard',
  // Rotina do assistente de engenharia, pedida em 2026-09-27: checklist do
  // dia, pendências com prioridade e fechamento do dia.
  'meu-dia',
  'modo-campo',
  'planejamento',
  'diario-obra',
  // Controle de Estacas é aba própria: a importação com prévia/lote/lineage
  // vive dentro dela (decisão confirmada com o usuário em 2026-09-22). Os
  // tickets da jazida viraram a parte Viagens da jazida de Materiais em
  // 2026-09-28.
  'estacas',
  'controle-equipamentos',
  // Pedido em 2026-09-28: todos os equipamentos do dia em cartões, por frente.
  'quadro-frota',
  'manutencao',
  'lancamentos',
  'colaboradores',
  'presenca',
  'materiais',
  'relatorios',
  // Cadastros ficou sem caminho na limpeza de 2026-09-24: o atalho dentro de
  // Administração levava a uma aba que nenhum perfil tinha em ROLE_ACCESS, e
  // o App devolvia a pessoa ao Painel. Voltou ao menu lateral como aba
  // própria, logo acima de Administração.
  'cadastros',
  'administracao',
] as const;

const SIDEBAR_MODULE_IDS = new Set<string>(PRIMARY_MODULE_IDS);

export const isPrimaryModule = (id: string) => SIDEBAR_MODULE_IDS.has(id);

// Endereços antigos que ainda podem chegar por um botão, pela busca do topo ou
// por um link guardado. Cada um abre a tela onde aquele dado mora hoje; o que
// não estiver aqui e não for do menu cai no Painel.
export const MODULE_REDIRECTS: Readonly<Record<string, string>> = {
  // Frentes e produção vivem na parte Frentes do Meu dia.
  frentes: 'meu-dia',
  producao: 'meu-dia',
  // Os tickets da jazida moraram numa aba própria até 28/09/2026; agora são
  // a parte Viagens da jazida dentro de Materiais.
  'tickets-jazida': 'materiais',
  // Telas antigas cortadas em 16/10/2026 (auditoria das abas, G6/G7).
  frota: 'controle-equipamentos',
  equipes: 'presenca',
  auditoria: 'administracao',
  permissoes: 'administracao',
};

const SIDEBAR_GROUP_LABELS: Record<string, string> = {
  Equipamentos: 'Frota',
  Análise: 'Gestão',
};

// Nomes mais curtos só para o menu (e as telas que o reaproveitam, como
// Permissões): o nome completo do módulo continua o mesmo em todo o resto do
// app. Sem isso "Controle Operacional de Frotas" cortava no meio da palavra
// com o menu mais estreito.
const SIDEBAR_ITEM_LABELS: Record<string, string> = {
  'controle-equipamentos': 'Controle de Frotas',
};

export const SIDEBAR_NAVIGATION_GROUPS = NAVIGATION_GROUPS
  .map(group => ({
    ...group,
    label: SIDEBAR_GROUP_LABELS[group.label] || group.label,
    items: group.items
      .filter(item => SIDEBAR_MODULE_IDS.has(item.id))
      .map(item => (SIDEBAR_ITEM_LABELS[item.id]
        ? { ...item, label: SIDEBAR_ITEM_LABELS[item.id] }
        : item)),
  }))
  .filter(group => group.items.length > 0);

export const ALL_NAVIGATION_ITEMS = SIDEBAR_NAVIGATION_GROUPS
  .map(group => group.items as readonly NavigationItem[])
  .reduce<NavigationItem[]>((items, groupItems) => items.concat(groupItems), []);

export const ROLE_ACCESS: Record<UserRole, readonly string[]> = {
  admin: [...PRIMARY_MODULE_IDS],
  gestor: PRIMARY_MODULE_IDS.filter(id => id !== 'administracao'),
  // Operador lança no dia a dia, mas não altera a base mestre (mesma regra
  // de antes da limpeza do menu).
  operador: PRIMARY_MODULE_IDS.filter(id => id !== 'administracao' && id !== 'cadastros'),
  leitura: ['dashboard', 'relatorios'],
};

/**
 * Perfil do app a partir da associação no Supabase. O banco só guarda admin,
 * editor e viewer; quem é editor e foi criado como operador traz isso em
 * app_metadata.role. Mesma regra de appRoleFor em api/_shared/supabase-admin.js.
 */
export const roleFromMembership = (membershipRole: unknown, claimedRole?: unknown): UserRole => {
  if (membershipRole === 'editor') return claimedRole === 'operador' ? 'operador' : 'gestor';
  if (membershipRole === 'viewer') return 'leitura';
  return normalizeUserRole(membershipRole);
};

export const normalizeUserRole = (value: unknown): UserRole => {
  if (value === 'administrador') return 'admin';
  return value === 'gestor' || value === 'operador' || value === 'leitura' || value === 'admin'
    ? value
    : 'leitura';
};
