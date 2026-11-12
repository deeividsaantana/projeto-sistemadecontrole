import { useEffect, useMemo, useRef } from 'react';
import { nomeDaPessoa } from '../../auth/nomeDaPessoa';
import { Avatar } from '../../shared/ui';
import type { MeuAvatar } from '../perfil/usePerfis';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { reduzMovimento } from '../../shared/motion/reduzMovimento';
import { Building2, LogOut, Search, X } from 'lucide-react';
import type { SupabaseAuthUser as User } from '../../auth/supabaseAuth';
import type { AppNotification } from '../../types';
import { NotificationCenter } from './NotificationCenter';
import type { Alerta } from '../../utils/alertas';
import type { NavigationGroupView } from './NavigationMenu';
import { OBRA } from '../../config/obra';

const ICON_STROKE = 1.75;

interface DesktopTopBarProps {
  groups: NavigationGroupView[];
  menuSearch: string;
  currentUser: User | null;
  meuAvatar: MeuAvatar | null;
  onAbrirPerfil: () => void;
  isNotificationOpen: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  alertas?: Alerta[];
  isCloudConnected: boolean;
  lastCloudSync: string;
  pendingCount?: number;
  isRetryingPending?: boolean;
  onRetryPending?: () => void;
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
  meuAvatar,
  onAbrirPerfil,
  isNotificationOpen,
  notifications,
  unreadCount,
  alertas,
  isCloudConnected,
  lastCloudSync,
  pendingCount,
  isRetryingPending,
  onRetryPending,
  onMenuSearchChange,
  onNavigate,
  onToggleNotifications,
  onCloseNotifications,
  onMarkAllNotificationsAsRead,
  onClearNotifications,
  onMarkNotificationAsRead,
  onLogout,
}: DesktopTopBarProps) {
  const headerRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const logoutBtnRef = useRef<HTMLButtonElement>(null);
  const userName = meuAvatar?.nome || nomeDaPessoa(currentUser);

  const visibleItems = useMemo(() => groups.flatMap(group => group.items), [groups]);

  useGSAP(() => {
    if (!logoutBtnRef.current || reduzMovimento()) return;
    const btn = logoutBtnRef.current;

    const onEnter = () => {
      gsap.to(btn, { scale: 1.12, rotate: 10, duration: 0.3, ease: 'power2.out' });
    };
    const onLeave = () => {
      gsap.to(btn, { scale: 1, rotate: 0, duration: 0.3, ease: 'power2.out' });
    };

    btn.addEventListener('mouseenter', onEnter);
    btn.addEventListener('mouseleave', onLeave);

    return () => {
      btn.removeEventListener('mouseenter', onEnter);
      btn.removeEventListener('mouseleave', onLeave);
    };
  }, { scope: headerRef });

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
    <header
      ref={headerRef}
      className="erp-topbar hidden lg:flex"
      aria-label="Barra de contexto do sistema"
    >
      <label className="erp-topbar__searchbox relative block w-full max-w-sm">
        <span className="sr-only">Buscar no sistema</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={ICON_STROKE} />
        <input
          ref={searchRef}
          type="search"
          value={menuSearch}
          onChange={event => onMenuSearchChange(event.target.value)}
          onKeyDown={abrirPrimeiroResultado}
          placeholder="Buscar no sistema..."
          className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-10 pr-14 text-[13px] text-slate-700 outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
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
          : <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-slate-200/50 bg-white/40 px-1.5 py-0.5 text-xs font-bold text-slate-400">⌘K</kbd>}
      </label>

      <div
        className="erp-topbar__project"
        title="Obra ativa"
        aria-label={`Obra ativa: ${OBRA.nome}`}
      >
        <Building2 aria-hidden="true" />
        <span>
          <small>Projeto atual</small>
          <strong>{OBRA.nome}</strong>
        </span>
      </div>

      <div className="erp-topbar__actions">
        <div
          className="erp-topbar__status"
          data-offline={!isCloudConnected || undefined}
          title={`${isCloudConnected ? 'Sincronizado com a nuvem' : 'Sem conexão com a nuvem'}. ${lastCloudSync ? `Última sincronização: ${lastCloudSync}` : 'Ainda sem sincronização nesta sessão'}`}
        >
          <span aria-hidden="true" />
          <em className="erp-topbar__status-texto not-italic">{isCloudConnected ? 'Sincronizado' : 'Sem conexão com a nuvem'}</em>
        </div>
        {typeof pendingCount === 'number' && pendingCount > 0 && (
          <div
            className="erp-topbar__pending"
            title={`${pendingCount} pendência(s) offline aguardando envio`}
          >
            <span aria-live="polite">Pendente: {pendingCount}</span>
            {onRetryPending && (
              <button
                type="button"
                onClick={onRetryPending}
                disabled={isRetryingPending}
                aria-label="Tentar enviar pendências agora"
              >
                {isRetryingPending ? 'Enviando…' : 'Tentar agora'}
              </button>
            )}
          </div>
        )}
        <NotificationCenter
          isOpen={isNotificationOpen}
          notifications={notifications}
          unreadCount={unreadCount}
          onToggle={onToggleNotifications}
          onClose={onCloseNotifications}
          onMarkAllAsRead={onMarkAllNotificationsAsRead}
          onClear={onClearNotifications}
          onMarkOneAsRead={onMarkNotificationAsRead}
          alertas={alertas}
          onAlertaClick={onNavigate}
        />
        <button
          type="button"
          onClick={onAbrirPerfil}
          className="erp-topbar__user"
          title="Meu perfil: trocar nome e foto"
        >
          <Avatar nome={userName} foto={meuAvatar?.foto} cor={meuAvatar?.cor} />
          <strong>{userName}</strong>
          <span className="sr-only">, abrir meu perfil</span>
        </button>
        <button
          ref={logoutBtnRef}
          type="button"
          onClick={onLogout}
          title="Sair da conta"
          aria-label="Sair da conta"
          className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700 hover:shadow-sm"
        >
          <LogOut className="h-4 w-4" strokeWidth={ICON_STROKE} />
        </button>
      </div>
    </header>
  );
}
