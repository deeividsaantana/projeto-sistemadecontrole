import { useEffect, useState } from 'react';
import { ChevronDown, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { NavigationGroupView } from './NavigationMenu';
import reneaLogo from '../../assets/images/logo-renea-branco.png';
import { APP_VERSION_LABEL } from '../version';

interface DesktopSidebarProps {
  activeTab: string;
  groups: NavigationGroupView[];
  onNavigate: (tab: string) => void;
}

const COLLAPSE_KEY = 'renea_sidebar_recolhido';
const CLOSED_GROUPS_KEY = 'renea_sidebar_grupos_fechados';
const ICON_STROKE = 1.75;

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'true';
  } catch {
    // Navegador com armazenamento bloqueado abre no estado normal, sem quebrar.
    return false;
  }
};

const readClosedGroups = (): string[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(CLOSED_GROUPS_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

export function DesktopSidebar({ activeTab, groups, onNavigate }: DesktopSidebarProps) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [closedGroups, setClosedGroups] = useState<string[]>(readClosedGroups);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, String(collapsed));
    } catch {
      // Preferência de layout não vale interromper a navegação.
    }
  }, [collapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(CLOSED_GROUPS_KEY, JSON.stringify(closedGroups));
    } catch {
      // Preferência de layout não vale interromper a navegação.
    }
  }, [closedGroups]);

  const toggleGroup = (label: string) => {
    setClosedGroups(current => (current.includes(label)
      ? current.filter(item => item !== label)
      : [...current, label]));
  };

  return (
    <aside
      className={`erp-sidebar hidden shrink-0 flex-col text-[#dbeee4] lg:flex ${collapsed ? 'erp-sidebar--recolhido' : ''}`}
      aria-label="Navegação principal"
    >
      <div className={`flex min-h-[3.75rem] items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`} title={APP_VERSION_LABEL}>
        {collapsed
          ? <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-sm font-black text-white">R</span>
          : <img src={reneaLogo} alt="RENEA Infraestrutura" className="h-7 w-auto object-contain" />}
        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            title="Recolher menu"
            aria-label="Recolher menu"
            className="rounded-lg p-2 text-[#8dc4ad] transition-colors duration-200 hover:bg-white/10 hover:text-white"
          >
            <ChevronsLeft className="h-4 w-4" strokeWidth={ICON_STROKE} />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="Expandir menu"
          aria-label="Expandir menu"
          className="mx-auto mt-2 rounded-lg p-2 text-[#8dc4ad] transition-colors duration-200 hover:bg-white/10 hover:text-white"
        >
          <ChevronsRight className="h-4 w-4" strokeWidth={ICON_STROKE} />
        </button>
      )}

      <nav className="flex-1 overflow-y-auto px-2.5 py-2">
        {groups.map(group => {
          const hasActive = group.items.some(item => item.id === activeTab);
          // O grupo do módulo aberto nunca fica escondido: o usuário precisa ver onde está.
          const open = collapsed || hasActive || !closedGroups.includes(group.label);
          return (
            <section key={group.label} className="mb-1.5 last:mb-0">
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.14em] text-[#9bc5b4] transition-colors duration-200 hover:text-white"
                >
                  <ChevronDown
                    className={`h-3 w-3 shrink-0 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                  <span className="truncate">{group.label}</span>
                </button>
              )}
              {open && (
                <div className="space-y-1">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        aria-current={active ? 'page' : undefined}
                        title={item.label}
                        className={`group flex min-h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[12px] transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c3d2f] ${
                          active
                            ? 'bg-white font-semibold text-[#0b3d2e] shadow-[0_6px_16px_-6px_rgba(0,0,0,0.35)]'
                            : 'text-[#bcded0] hover:bg-white/10 hover:text-white'
                        } ${collapsed ? 'justify-center px-0' : ''}`}
                      >
                        <Icon
                          className={`h-4 w-4 shrink-0 ${active ? 'text-[#0b3d2e]' : 'text-[#9bbfae] group-hover:text-white'}`}
                          strokeWidth={ICON_STROKE}
                          aria-hidden="true"
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
        {groups.length === 0 && !collapsed && (
          <p className="px-3 text-xs text-[#8dc4ad]">Nenhum módulo encontrado.</p>
        )}
      </nav>
    </aside>
  );
}
