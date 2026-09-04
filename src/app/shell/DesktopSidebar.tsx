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
const ICON_STROKE = 1.75;

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
      className={`erp-sidebar hidden shrink-0 flex-col text-[#dbeee4] lg:flex ${collapsed ? 'erp-sidebar--recolhido' : ''}`}
      aria-label="Navegação principal"
    >
      <div className={`flex min-h-[4.7rem] items-center border-b border-white/10 ${collapsed ? 'justify-center px-2' : 'justify-between px-5'}`}>
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
          className="mx-auto mt-3 rounded-lg p-2 text-[#8dc4ad] transition-colors duration-200 hover:bg-white/10 hover:text-white"
        >
          <ChevronsRight className="h-4 w-4" strokeWidth={ICON_STROKE} />
        </button>
      )}

      {!collapsed && (
        <div className="px-4 pt-4">
          <label className="relative block">
            <span className="sr-only">Buscar módulo</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7fb8a1]" strokeWidth={ICON_STROKE} />
            <input
              ref={searchRef}
              type="search"
              value={menuSearch}
              onChange={event => onMenuSearchChange(event.target.value)}
              onKeyDown={abrirPrimeiroResultado}
              placeholder="Buscar módulo"
              className="h-11 w-full rounded-2xl border border-white/15 bg-white/[0.04] pl-10 pr-16 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none transition-colors duration-200 placeholder:text-[#8fb6a8] hover:border-white/25 focus:border-emerald-300/60 focus:bg-white/[0.06] focus-visible:outline-none"
            />
            {menuSearch
              ? (
                <button
                  type="button"
                  onClick={() => onMenuSearchChange('')}
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#7fb8a1] transition-colors duration-200 hover:text-white"
                >
                  <X className="h-4 w-4" strokeWidth={ICON_STROKE} />
                </button>
              )
              : <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-white/15 px-1.5 py-0.5 text-[10px] font-bold text-[#8fb6a8]">⌘K</kbd>}
          </label>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group, groupIndex) => (
          <section
            key={group.label}
            className="renea-enter mb-6"
            style={{ animationDelay: `${groupIndex * 40}ms` }}
            aria-label={group.label}
          >
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7fb79f]">{group.label}</p>
            )}
            <div className="space-y-0.5">
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
                    className={`group flex min-h-11 w-full items-center gap-3 rounded-lg border-l-[3px] px-3 text-left text-sm transition-[background-color,color,border-color,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#062a21] ${
                      active
                        ? 'border-[#7ee0b6] bg-[#0c8a63] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(3,40,28,0.65)]'
                        : 'border-transparent text-[#c6e3d8] hover:translate-x-0.5 hover:border-white/10 hover:bg-white/[0.06] hover:text-white'
                    } ${collapsed ? 'justify-center px-0' : ''}`}
                  >
                    <Icon
                      className={`h-[1.05rem] w-[1.05rem] shrink-0 transition-colors duration-200 ${active ? 'text-white' : 'text-[#8fb6a8] group-hover:text-white'}`}
                      strokeWidth={ICON_STROKE}
                      aria-hidden="true"
                    />
                    {!collapsed && <span className={`truncate ${active ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>}
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

      <div className={`border-t border-white/10 ${collapsed ? 'px-2 py-3' : 'px-4 py-4'}`}>
        <div
          className={`flex items-center gap-2 text-[11px] font-semibold ${collapsed ? 'justify-center' : ''} ${isFirebaseConnected ? 'text-[#8fe0bd]' : 'text-[#f4c37d]'}`}
          title={lastCloudSync ? `Última sincronização: ${lastCloudSync}` : 'Ainda sem sincronização nesta sessão'}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${isFirebaseConnected ? 'bg-[#21bd7e]' : 'bg-[#e0a44a]'}`} />
          {!collapsed && (isFirebaseConnected ? 'Sincronizado' : 'Sem conexão')}
        </div>

        <div className={`mt-3 flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-black text-white"
            style={{ background: 'linear-gradient(155deg, #1fa578, #0c7351)' }}
          >
            {initials}
          </span>
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
            className="shrink-0 rounded-lg p-2 text-[#a8ccbe] transition-colors duration-200 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" strokeWidth={ICON_STROKE} />
          </button>
        </div>

        {!collapsed && <p className="mt-3 text-center text-[10px] text-[#6ea88f]">{APP_VERSION_LABEL}</p>}
      </div>
    </aside>
  );
}
