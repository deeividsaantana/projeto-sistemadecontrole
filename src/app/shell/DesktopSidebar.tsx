import { useEffect, useState } from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { NavigationGroupView } from './NavigationMenu';
import reneaLogo from '../../assets/images/logo-renea-branco.png';
import { APP_VERSION_LABEL } from '../version';

interface DesktopSidebarProps {
  activeTab: string;
  groups: NavigationGroupView[];
  onNavigate: (tab: string) => void;
}

const COLLAPSE_KEY = 'renea_sidebar_recolhido';
const ICON_STROKE = 1.75;

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'true';
  } catch {
    // Navegador com armazenamento bloqueado abre no estado normal, sem quebrar.
    return false;
  }
};

export function DesktopSidebar({ activeTab, groups, onNavigate }: DesktopSidebarProps) {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, String(collapsed));
    } catch {
      // Preferência de layout não vale interromper a navegação.
    }
  }, [collapsed]);

  return (
    <aside
      className={`erp-sidebar hidden shrink-0 flex-col text-[#dbeee4] lg:flex ${collapsed ? 'erp-sidebar--recolhido' : ''}`}
      aria-label="Navegação principal"
    >
      <div className={`flex min-h-[4.7rem] items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-5'}`} title={APP_VERSION_LABEL}>
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

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <div className="space-y-1">
          {groups.map(group => group.items.map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                title={item.label}
                className={`group flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c3d2f] ${
                  active
                    ? 'bg-white font-semibold text-[#0b3d2e] shadow-[0_6px_16px_-6px_rgba(0,0,0,0.35)]'
                    : 'text-[#bcded0] hover:bg-white/10 hover:text-white'
                } ${collapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon
                  className={`h-[1.05rem] w-[1.05rem] shrink-0 ${active ? 'text-[#0b3d2e]' : 'text-[#8fb6a8] group-hover:text-white'}`}
                  strokeWidth={ICON_STROKE}
                  aria-hidden="true"
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          }))}
        </div>
        {groups.length === 0 && !collapsed && (
          <p className="px-3 text-xs text-[#8dc4ad]">Nenhum módulo encontrado.</p>
        )}
      </nav>
    </aside>
  );
}
