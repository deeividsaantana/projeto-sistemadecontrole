import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronsLeft, ChevronsRight, LogOut, Search, X } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { NavigationGroupView } from './NavigationMenu';
import reneaLogo from '../../assets/images/logo-renea-branco.png';
import { APP_VERSION_LABEL } from '../version';

interface DesktopSidebarProps {
  activeTab: string;
  groups: NavigationGroupView[];
  menuSearch: string;
  currentUser?: User | null;
  isFirebaseConnected?: boolean;
  lastCloudSync?: string;
  onMenuSearchChange: (value: string) => void;
  onNavigate: (tab: string) => void;
  onLogout: () => void;
}

const COLLAPSE_KEY = 'renea_sidebar_recolhido';

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'true';
  } catch {
    // Navegador com armazenamento bloqueado abre no estado normal, sem quebrar.
    return false;
  }
};

export function DesktopSidebar({
  activeTab,
  groups,
  menuSearch,
  currentUser,
  isFirebaseConnected = false,
  lastCloudSync = '',
  onMenuSearchChange,
  onNavigate,
  onLogout,
}: DesktopSidebarProps) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const searchRef = useRef<HTMLInputElement>(null);

  const userName = currentUser?.displayName || currentUser?.email || 'Usuário RENEA';
  const userEmail = currentUser?.email || 'Sessão autenticada';
  const initials = userName.trim().slice(0, 2).toUpperCase();

  const visibleItems = useMemo(
    () => groups.flatMap(group => group.items),
    [groups],
  );

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, String(collapsed));
    } catch {
      // Preferência de layout não vale interromper a navegação.
    }
  }, [collapsed]);

  // O selo ⌘K era decorativo: existia o desenho da tecla, mas nenhum atalho.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCollapsed(false);
        window.requestAnimationFrame(() => searchRef.current?.focus());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const abrirPrimeiroResultado = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      onMenuSearchChange('');
      return;
    }
    if (event.key !== 'Enter') return;
    const primeiro = visibleItems[0];
    if (primeiro) {
      onNavigate(primeiro.id);
      searchRef.current?.blur();
    }
  };

  return (
    <aside
      className={`erp-sidebar hidden shrink-0 flex-col bg-[#042f25] text-[#dff0e8] lg:flex ${collapsed ? 'erp-sidebar--recolhido' : ''}`}
      aria-label="Navegação principal"
    >
      <div className={`flex min-h-[4.7rem] items-center border-b border-[#0d4a3a] ${collapsed ? 'justify-center px-2' : 'justify-between px-5'}`}>
        {collapsed
          ? <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#0a5a45] text-sm font-black text-white">R</span>
          : <img src={reneaLogo} alt="RENEA Infraestrutura" className="h-7 w-auto object-contain" />}
        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            title="Recolher menu"
            aria-label="Recolher menu"
            className="rounded-lg p-2 text-[#8dc4ad] transition hover:bg-[#0a4839] hover:text-white"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="Expandir menu"
          aria-label="Expandir menu"
          className="mx-auto mt-3 rounded-lg p-2 text-[#8dc4ad] transition hover:bg-[#0a4839] hover:text-white"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      )}

      {!collapsed && (
        <div className="px-4 pt-4">
          <label className="relative block">
            <span className="sr-only">Buscar módulo</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7fb8a1]" />
            <input
              ref={searchRef}
              type="search"
              value={menuSearch}
              onChange={event => onMenuSearchChange(event.target.value)}
              onKeyDown={abrirPrimeiroResultado}
              placeholder="Buscar módulo"
              className="h-11 w-full rounded-xl border border-[#1c6650] bg-[#063a2d] pl-10 pr-16 text-sm text-white outline-none transition placeholder:text-[#7fb8a1] focus:border-[#3ba382]"
            />
            {menuSearch
              ? (
                <button
                  type="button"
                  onClick={() => onMenuSearchChange('')}
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#7fb8a1] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )
              : <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-[#1c6650] px-1.5 py-0.5 text-[10px] font-bold text-[#7fb8a1]">⌘K</kbd>}
          </label>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map(group => (
          <section key={group.label} className="mb-5" aria-label={group.label}>
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#78b79f]">{group.label}</p>
            )}
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
                    className={`flex min-h-11 w-full items-center gap-3 rounded-xl border-l-[3px] px-3 text-left text-sm transition ${
                      active
                        ? 'border-[#79dbb5] bg-[#07805f] font-bold text-white'
                        : 'border-transparent text-[#c6e3d8] hover:bg-[#0b4a3a] hover:text-white'
                    } ${collapsed ? 'justify-center px-0' : ''}`}
                  >
                    <Icon className="h-[1.05rem] w-[1.05rem] shrink-0" aria-hidden="true" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {groups.length === 0 && !collapsed && (
          <p className="px-3 text-xs text-[#8dc4ad]">Nenhum módulo encontrado.</p>
        )}
      </nav>

      <div className={`border-t border-[#0d4a3a] ${collapsed ? 'px-2 py-3' : 'px-4 py-4'}`}>
        <div
          className={`flex items-center gap-2 text-[11px] font-bold ${collapsed ? 'justify-center' : ''} ${isFirebaseConnected ? 'text-[#8fe0bd]' : 'text-[#f4c37d]'}`}
          title={lastCloudSync ? `Última sincronização: ${lastCloudSync}` : 'Ainda sem sincronização nesta sessão'}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${isFirebaseConnected ? 'bg-[#21bd7e]' : 'bg-[#e0a44a]'}`} />
          {!collapsed && (isFirebaseConnected ? 'Sincronizado' : 'Sem conexão')}
        </div>

        <div className={`mt-3 flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#168c68] text-[11px] font-black text-white">{initials}</span>
          {!collapsed && (
            <span className="grid min-w-0 flex-1">
              <strong className="truncate text-xs text-white">{userName}</strong>
              <small className="truncate text-[10px] text-[#a8ccbe]">{userEmail}</small>
            </span>
          )}
          <button
            type="button"
            onClick={onLogout}
            title="Sair da conta"
            aria-label="Sair da conta"
            className="shrink-0 rounded-lg p-2 text-[#a8ccbe] transition hover:bg-[#0a4839] hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {!collapsed && <p className="mt-3 text-center text-[10px] text-[#6ea88f]">{APP_VERSION_LABEL}</p>}
      </div>
    </aside>
  );
}
