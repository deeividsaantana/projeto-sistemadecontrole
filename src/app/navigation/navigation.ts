import {
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FolderPlus,
  GraduationCap,
  Hammer,
  HardHat,
  LayoutDashboard,
  LayoutGrid,
  SunMedium,
  Package,
  TimerOff,
  UserRound,
  Wrench,
  Truck,
  Activity,
  Users,
  Search,
  NotebookPen,
  ListChecks,
  Bell,
  Bot,
  Smartphone,
  Gauge,
  Coins,
  FileBarChart,
  History,
  ShieldCheck,
  KeyRound,
  Database,
  Scale,
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
      { id: 'consulta-geral', label: 'Consulta Geral', icon: Search },
      { id: 'periodo', label: 'Registros por Período', icon: CalendarRange },
      { id: 'pendencias', label: 'Pendências', icon: ListChecks },
      { id: 'notificacoes', label: 'Notificações', icon: Bell },
      { id: 'assistente', label: 'Assistente', icon: Bot },
    ],
  },
  {
    label: 'Operação',
    items: [
      { id: 'modo-campo', label: 'Modo Campo', icon: Smartphone },
      { id: 'planejamento', label: 'Planejamento', icon: CalendarRange },
      { id: 'diario-obra', label: 'Diário de Obra', icon: NotebookPen },
      { id: 'estacas', label: 'Controle de Estacas', icon: Hammer },
    ],
  },
  {
    label: 'Equipamentos',
    items: [
      { id: 'frota', label: 'Frota', icon: Truck },
      { id: 'controle-equipamentos', label: 'Controle Operacional de Frotas', icon: Activity },
      { id: 'quadro-frota', label: 'Quadro da Frota', icon: LayoutGrid },
      { id: 'manutencao', label: 'Manutenção', icon: Wrench },
      { id: 'horas-paradas', label: 'Horas Paradas', icon: TimerOff },
      { id: 'checklist', label: 'Checklist', icon: ClipboardCheck },
      { id: 'lancamentos', label: 'Combustível', icon: ClipboardList },
    ],
  },
  {
    label: 'Pessoas',
    items: [
      { id: 'colaboradores', label: 'Colaboradores', icon: UserRound },
      { id: 'equipes', label: 'Equipes', icon: HardHat },
      { id: 'presenca', label: 'Presença e Controle', icon: Users },
      { id: 'apontamentos', label: 'Apontamentos', icon: ClipboardList },
      { id: 'dds-treinamentos', label: 'DDS e Treinamentos', icon: GraduationCap },
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
      { id: 'indicadores', label: 'Indicadores', icon: Gauge },
      { id: 'relatorios', label: 'Relatórios', icon: FileBarChart },
      { id: 'timeline', label: 'Timeline', icon: History },
      { id: 'custos', label: 'Custos', icon: Coins },
      { id: 'orcamento', label: 'Orçado x Realizado', icon: Scale },
    ],
  },
  {
    label: 'Administração',
    items: [
      { id: 'cadastros', label: 'Cadastros', icon: FolderPlus },
      { id: 'administracao', label: 'Administração', icon: Database },
      { id: 'auditoria', label: 'Auditoria', icon: ShieldCheck },
      { id: 'permissoes', label: 'Permissões', icon: KeyRound },
    ],
  },
] as const;

/**
 * Navegação diária enxuta. Os outros módulos permanecem registrados abaixo,
 * com permissões, rotas, dados, busca global e atalhos internos preservados.
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

export const AUXILIARY_MODULE_DESTINATIONS: Readonly<Record<string, string>> = {
  'consulta-geral': 'dashboard',
  periodo: 'relatorios',
  pendencias: 'dashboard',
  notificacoes: 'dashboard',
  assistente: 'dashboard',
  'tickets-jazida': 'materiais',
  frota: 'controle-equipamentos',
  'horas-paradas': 'controle-equipamentos',
  checklist: 'controle-equipamentos',
  equipes: 'colaboradores',
  apontamentos: 'presenca',
  'dds-treinamentos': 'colaboradores',
  indicadores: 'dashboard',
  timeline: 'dashboard',
  custos: 'relatorios',
  orcamento: 'relatorios',
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

export const normalizeUserRole = (value: unknown): UserRole => {
  if (value === 'administrador') return 'admin';
  return value === 'gestor' || value === 'operador' || value === 'leitura' || value === 'admin'
    ? value
    : 'leitura';
};
