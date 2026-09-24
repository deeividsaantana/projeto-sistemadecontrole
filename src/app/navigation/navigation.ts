import {
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FolderPlus,
  GraduationCap,
  Hammer,
  HardHat,
  LayoutDashboard,
  MapPin,
  Package,
  Radio,
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
  CalendarClock,
  ShieldAlert,
  Megaphone,
  AlertOctagon,
  FileSpreadsheet,
  FileText,
  BarChart3,
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
      { id: 'central-operacional', label: 'Central Operacional', icon: Radio },
      { id: 'frentes', label: 'Frentes de Serviço', icon: MapPin },
      { id: 'producao', label: 'Produção', icon: BarChart3 },
      { id: 'planejamento', label: 'Planejamento', icon: CalendarRange },
      { id: 'cronograma', label: 'Cronograma', icon: CalendarClock },
      { id: 'diario-obra', label: 'Diário de Obra', icon: NotebookPen },
      { id: 'fvs', label: 'FVS', icon: ClipboardCheck },
      { id: 'inspecoes', label: 'Inspeções', icon: ShieldAlert },
      { id: 'nao-conformidades', label: 'Não Conformidades', icon: AlertOctagon },
      { id: 'medicoes', label: 'Medições', icon: FileSpreadsheet },
      { id: 'documentos', label: 'Documentos', icon: FileText },
      { id: 'ocorrencias', label: 'Ocorrências', icon: Megaphone },
      { id: 'tickets-jazida', label: 'Tickets Jazida', icon: Truck },
      { id: 'estacas', label: 'Controle de Estacas', icon: Hammer },
    ],
  },
  {
    label: 'Equipamentos',
    items: [
      { id: 'frota', label: 'Frota', icon: Truck },
      { id: 'controle-equipamentos', label: 'Controle Operacional de Frotas', icon: Activity },
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
      { id: 'administracao', label: 'Administração', icon: Database },
      { id: 'cadastros', label: 'Cadastros Auxiliares', icon: FolderPlus },
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
  'modo-campo',
  'central-operacional',
  'planejamento',
  'diario-obra',
  // Tickets Jazida e Controle de Estacas não tinham nenhum caminho de
  // navegação alcançável na versão "enxuta": o atalho deles dentro de
  // Central Operacional só marca a subtela como ativa, sem render próprio
  // (CentralOperacionalTab só implementa 'frentes'/'producao'/'ocorrencias'),
  // e AUXILIARY_MODULE_DESTINATIONS nunca chega a ser lido em nenhum lugar
  // do app. As duas telas ficavam prontas e com permissão liberada, mas sem
  // link para abrir. Decisão confirmada com o usuário em 2026-09-22 para
  // destravar as novas importações com prévia/lote/lineage, que vivem
  // dentro dessas duas telas.
  'tickets-jazida',
  'estacas',
  'controle-equipamentos',
  'manutencao',
  'lancamentos',
  'colaboradores',
  'presenca',
  'materiais',
  'relatorios',
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
  frentes: 'central-operacional',
  producao: 'central-operacional',
  cronograma: 'central-operacional',
  fvs: 'central-operacional',
  inspecoes: 'central-operacional',
  'nao-conformidades': 'central-operacional',
  medicoes: 'central-operacional',
  documentos: 'central-operacional',
  ocorrencias: 'central-operacional',
  'tickets-jazida': 'central-operacional',
  estacas: 'central-operacional',
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
  cadastros: 'administracao',
  auditoria: 'administracao',
  permissoes: 'administracao',
};

const SIDEBAR_GROUP_LABELS: Record<string, string> = {
  Equipamentos: 'Frota',
  Análise: 'Gestão',
};

export const SIDEBAR_NAVIGATION_GROUPS = NAVIGATION_GROUPS
  .map(group => ({
    ...group,
    label: SIDEBAR_GROUP_LABELS[group.label] || group.label,
    items: group.items.filter(item => SIDEBAR_MODULE_IDS.has(item.id)),
  }))
  .filter(group => group.items.length > 0);

export const ALL_NAVIGATION_ITEMS = SIDEBAR_NAVIGATION_GROUPS
  .map(group => group.items as readonly NavigationItem[])
  .reduce<NavigationItem[]>((items, groupItems) => items.concat(groupItems), []);

export const ROLE_ACCESS: Record<UserRole, readonly string[]> = {
  admin: [...PRIMARY_MODULE_IDS],
  gestor: PRIMARY_MODULE_IDS.filter(id => id !== 'administracao'),
  operador: PRIMARY_MODULE_IDS.filter(id => id !== 'administracao'),
  leitura: ['dashboard', 'relatorios'],
};

export const normalizeUserRole = (value: unknown): UserRole => {
  if (value === 'administrador') return 'admin';
  return value === 'gestor' || value === 'operador' || value === 'leitura' || value === 'admin'
    ? value
    : 'leitura';
};
