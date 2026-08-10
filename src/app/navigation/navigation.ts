import {
  BarChart3,
  CircleGauge,
  ClipboardList,
  FileText,
  FolderPlus,
  Hammer,
  BrainCircuit,
  LayoutDashboard,
  ListChecks,
  Package,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  Wrench,
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
      { id: 'pendencias', label: 'Pendências', icon: ListChecks },
      { id: 'reports', label: 'Relatórios Gerais', icon: FileText },
    ],
  },
  {
    label: 'Operação',
    items: [
      { id: 'partes-diarias', label: 'Parte Diária de Equipamentos', icon: CircleGauge },
      { id: 'lancamentos', label: 'Combustível', icon: ClipboardList },
      { id: 'tickets-jazida', label: 'Tickets Jazida', icon: Truck },
      { id: 'estacas', label: 'Controle de Estacas', icon: Hammer },
      { id: 'materiais', label: 'Materiais', icon: Package },
      { id: 'manutencao', label: 'Manutenção', icon: Wrench },
    ],
  },
  {
    label: 'Equipes e campo',
    items: [
      { id: 'presenca', label: 'Presença', icon: Users },
      { id: 'controle-presenca', label: 'Controle de Presença', icon: ShieldCheck },
      { id: 'apontamentos', label: 'Apontamentos', icon: BarChart3 },
    ],
  },
  {
    label: 'Administração',
    items: [
      { id: 'cadastros', label: 'Cadastros Auxiliares', icon: FolderPlus },
      { id: 'auditoria', label: 'Auditoria', icon: ShieldCheck },
      { id: 'usuarios', label: 'Usuários', icon: Users },
      { id: 'inteligencia', label: 'Inteligência Documental', icon: BrainCircuit },
      { id: 'configuracoes', label: 'Apoio e Configuração', icon: Settings },
    ],
  },
] as const;

export const ALL_NAVIGATION_ITEMS = NAVIGATION_GROUPS
  .map(group => group.items as readonly NavigationItem[])
  .reduce<NavigationItem[]>((items, groupItems) => items.concat(groupItems), []);

export const ROLE_ACCESS: Record<UserRole, readonly string[]> = {
  admin: ALL_NAVIGATION_ITEMS.map(item => item.id),
  gestor: ALL_NAVIGATION_ITEMS.map(item => item.id).filter(id => id !== 'configuracoes' && id !== 'auditoria' && id !== 'usuarios'),
  operador: [
    'dashboard',
    'pendencias',
    'reports',
    'partes-diarias',
    'lancamentos',
    'tickets-jazida',
    'estacas',
    'materiais',
    'manutencao',
    'presenca',
    'controle-presenca',
    'apontamentos',
    'inteligencia',
  ],
  leitura: ['dashboard', 'reports'],
};

export const normalizeUserRole = (value: unknown): UserRole => (
  value === 'gestor' || value === 'operador' || value === 'leitura' || value === 'admin'
    ? value
    : 'leitura'
);
