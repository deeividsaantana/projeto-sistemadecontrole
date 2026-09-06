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
    ],
  },
  {
    label: 'Operação',
    items: [
      { id: 'central-operacional', label: 'Central Operacional', icon: Radio },
      { id: 'frentes', label: 'Frentes de Serviço', icon: MapPin },
      { id: 'diario-obra', label: 'Diário de Obra', icon: NotebookPen },
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
    label: 'Administração',
    items: [
      { id: 'cadastros', label: 'Cadastros Auxiliares', icon: FolderPlus },
      { id: 'configuracoes', label: 'Apoio e Configuração', icon: Settings },
    ],
  },
] as const;

export const ALL_NAVIGATION_ITEMS = NAVIGATION_GROUPS
  .map(group => group.items as readonly NavigationItem[])
  .reduce<NavigationItem[]>((items, groupItems) => items.concat(groupItems), []);

export const ROLE_ACCESS: Record<UserRole, readonly string[]> = {
  admin: ALL_NAVIGATION_ITEMS.map(item => item.id),
  gestor: ALL_NAVIGATION_ITEMS.map(item => item.id).filter(id => id !== 'configuracoes'),
  operador: [
    'dashboard',
    'consulta-geral',
    'central-operacional',
    'frentes',
    'diario-obra',
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
