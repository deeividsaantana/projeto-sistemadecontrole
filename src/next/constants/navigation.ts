import {
  LayoutDashboard,
  Building2,
  Package,
  Truck,
  Users,
  ClipboardList,
  FileBarChart,
  Database,
  type LucideIcon,
} from 'lucide-react';

export type ModuleId =
  | 'dashboard'
  | 'obras'
  | 'materiais'
  | 'equipamentos'
  | 'presenca'
  | 'apontamentos'
  | 'relatorios'
  | 'administracao';

export interface ModuleDefinition {
  id: ModuleId;
  label: string;
  path: string;
  icon: LucideIcon;
  /** Só 'dashboard' tem tela própria nesta primeira entrega; o resto
   *  renderiza um placeholder "em construção" em vez de 404. */
  ready: boolean;
}

export const MODULES: ModuleDefinition[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard, ready: true },
  { id: 'obras', label: 'Obras', path: '/obras', icon: Building2, ready: false },
  { id: 'materiais', label: 'Materiais', path: '/materiais', icon: Package, ready: false },
  { id: 'equipamentos', label: 'Equipamentos e Frota', path: '/equipamentos', icon: Truck, ready: false },
  { id: 'presenca', label: 'Presença e Colaboradores', path: '/presenca', icon: Users, ready: false },
  { id: 'apontamentos', label: 'Apontamentos', path: '/apontamentos', icon: ClipboardList, ready: false },
  { id: 'relatorios', label: 'Relatórios', path: '/relatorios', icon: FileBarChart, ready: false },
  { id: 'administracao', label: 'Administração', path: '/administracao', icon: Database, ready: true },
];
