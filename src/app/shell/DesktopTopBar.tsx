import { useEffect, useMemo, useRef } from 'react';
import { LogOut, Search, X } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { AppNotification } from '../../types';
import { NotificationCenter } from './NotificationCenter';
import type { NavigationGroupView } from './NavigationMenu';

const ICON_STROKE = 1.75;

interface DesktopTopBarProps {
  groups: NavigationGroupView[];
  menuSearch: string;
  currentUser: User | null;
  isNotificationOpen: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  isFirebaseConnected: boolean;
  lastCloudSync: string;
  onMenuSearchChange: (value: string) => void;
  onNavigate: (tab: string) => void;
  onToggleNotifications: () => void;
  onCloseNotifications: () => void;
  onMarkAllNotificationsAsRead: () => void;
  onClearNotifications: () => void;
  onMarkNotificationAsRead: (id: string) => void;
  onLogout: () => void;
}

export function DesktopTopBar({
  groups,
  menuSearch,
  currentUser,
  isNotificationOpen,
  notifications,
  unreadCount,
  isFirebaseConnected,
  lastCloudSync,
  onMenuSearchChange,
  onNavigate,
  onToggleNotifications,
  onCloseNotifications,
  onMarkAllNotificationsAsRead,
  onClearNotifications,
  onMarkNotificationAsRead,
  onLogout,
}: DesktopTopBarProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const userName = currentUser?.displayName || currentUser?.email || 'Usuário RENEA';
  const userInitials = userName.trim().slice(0, 2).toUpperCase();

  const visibleItems = useMemo(() => groups.flatMap(group => group.items), [groups]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const abrirPrimeiroResultado = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      onMenuSearchChange('');
      searchRef.current?.blur();
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
    <header className="erp-topbar hidden lg:flex" aria-label="Barra de contexto do sistema">
      <label className="relative block w-full max-w-sm">
        <span className="sr-only">Buscar no sistema</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={ICON_STROKE} />
        <input
          ref={searchRef}
          type="search"
          value={menuSearch}
          onChange={event => onMenuSearchChange(event.target.value)}
          onKeyDown={abrirPrimeiroResultado}
          placeholder="Buscar no sistema..."
          className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-16 text-xs text-slate-700 outline-none transition-colors duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
        />
        {menuSearch
          ? (
            <button
              type="button"
              onClick={() => onMenuSearchChange('')}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition-colors duration-200 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
            </button>
          )
          : <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-400">⌘K</kbd>}
      </label>

      <div className="erp-topbar__actions">
        <div
          className="erp-topbar__status"
          data-offline={!isFirebaseConnected || undefined}
          title={lastCloudSync ? `Última sincronização com a nuvem: ${lastCloudSync}` : 'Ainda sem sincronização com a nuvem nesta sessão'}
        >
          <span />
          {isFirebaseConnected ? 'Sincronizado com a nuvem' : 'Sem conexão com a nuvem'}
        </div>
        <NotificationCenter
          isOpen={isNotificationOpen}
          notifications={notifications}
          unreadCount={unreadCount}
          onToggle={onToggleNotifications}
          onClose={onCloseNotifications}
          onMarkAllAsRead={onMarkAllNotificationsAsRead}
          onClear={onClearNotifications}
          onMarkOneAsRead={onMarkNotificationAsRead}
        />
        <div className="erp-topbar__user">
          <span className="erp-topbar__avatar">{userInitials}</span>
          <span>
            <strong>{userName}</strong>
            <small className="flex items-center gap-1 text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Online
            </small>
          </span>
        </div>
        <button
          type="button"
          onClick={onLogout}
          title="Sair da conta"
          aria-label="Sair da conta"
          className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700"
        >
          <LogOut className="h-4 w-4" strokeWidth={ICON_STROKE} />
        </button>
      </div>
    </header>
  );
}
