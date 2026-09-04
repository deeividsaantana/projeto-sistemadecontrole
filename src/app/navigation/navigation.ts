import {
  CalendarRange,
  ClipboardList,
  FileText,
  FolderPlus,
  Hammer,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Truck,
  Activity,
  Users,
  Search,
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
      { id: 'reports', label: 'Relatórios Gerais', icon: FileText },
    ],
  },
  {
    label: 'Operação',
    items: [
      { id: 'controle-equipamentos', label: 'Controle Operacional de Frotas', icon: Activity },
      { id: 'lancamentos', label: 'Combustível', icon: ClipboardList },
      { id: 'tickets-jazida', label: 'Tickets Jazida', icon: Truck },
      { id: 'estacas', label: 'Controle de Estacas', icon: Hammer },
    ],
  },
  {
    label: 'Equipes e campo',
    items: [
      { id: 'presenca', label: 'Presença e Controle', icon: Users },
    ],
  },
  {
    label: 'Administração',
    items: [
      { id: 'cadastros', label: 'Cadastros Auxiliares', icon: FolderPlus },
      { id: 'usuarios', label: 'Usuários', icon: Users },
      { id: 'configuracoes', label: 'Apoio e Configuração', icon: Settings },
    ],
  },
] as const;

export const ALL_NAVIGATION_ITEMS = NAVIGATION_GROUPS
  .map(group => group.items as readonly NavigationItem[])
  .reduce<NavigationItem[]>((items, groupItems) => items.concat(groupItems), []);

export const ROLE_ACCESS: Record<UserRole, readonly string[]> = {
  admin: ALL_NAVIGATION_ITEMS.map(item => item.id),
  gestor: ALL_NAVIGATION_ITEMS.map(item => item.id).filter(id => id !== 'configuracoes' && id !== 'usuarios'),
  operador: [
    'dashboard',
    'consulta-geral',
    'reports',
    'controle-equipamentos',
    'lancamentos',
    'tickets-jazida',
    'estacas',
    'presenca',
  ],
  leitura: ['dashboard', 'consulta-geral', 'periodo', 'reports'],
};

export const normalizeUserRole = (value: unknown): UserRole => {
  if (value === 'administrador') return 'admin';
  return value === 'gestor' || value === 'operador' || value === 'leitura' || value === 'admin'
    ? value
    : 'leitura';
};
