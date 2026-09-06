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
  Settings,
  TimerOff,
  UserRound,
  Wrench,
  Truck,
  Activity,
  Users,
  Search,
  NotebookPen,
  ListChecks,
  Gauge,
  Coins,
  FileBarChart,
  History,
  ShieldCheck,
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
    ],
  },
  {
    label: 'Operação',
    items: [
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
      { id: 'cadastros', label: 'Cadastros Auxiliares', icon: FolderPlus },
      { id: 'auditoria', label: 'Auditoria', icon: ShieldCheck },
      { id: 'configuracoes', label: 'Apoio e Configuração', icon: Settings },
    ],
  },
] as const;

export const ALL_NAVIGATION_ITEMS = NAVIGATION_GROUPS
  .map(group => group.items as readonly NavigationItem[])
  .reduce<NavigationItem[]>((items, groupItems) => items.concat(groupItems), []);

export const ROLE_ACCESS: Record<UserRole, readonly string[]> = {
  admin: ALL_NAVIGATION_ITEMS.map(item => item.id),
  // Auditoria e configuração ficam só com o admin: uma expõe o rastro de todo
  // mundo, a outra muda o comportamento do sistema.
  gestor: ALL_NAVIGATION_ITEMS.map(item => item.id).filter(id => !['configuracoes', 'auditoria'].includes(id)),
  operador: [
    'dashboard',
    'consulta-geral',
    'pendencias',
    'indicadores',
    'central-operacional',
    'frentes',
    'producao',
    'planejamento',
    'cronograma',
    'diario-obra',
    'fvs',
    'inspecoes',
    'ocorrencias',
    'frota',
    'controle-equipamentos',
    'manutencao',
    'horas-paradas',
    'checklist',
    'lancamentos',
    'tickets-jazida',
    'estacas',
    'presenca',
    'colaboradores',
    'equipes',
    'apontamentos',
    'dds-treinamentos',
    'materiais',
  ],
  leitura: ['dashboard', 'consulta-geral', 'periodo'],
};

export const normalizeUserRole = (value: unknown): UserRole => {
  if (value === 'administrador') return 'admin';
  return value === 'gestor' || value === 'operador' || value === 'leitura' || value === 'admin'
    ? value
    : 'leitura';
};
