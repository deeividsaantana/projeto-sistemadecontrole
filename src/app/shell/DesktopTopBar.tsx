import { useMemo, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Building2, ChevronDown, LogOut, Search } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { AppNotification } from '../../types';
import { NotificationCenter } from './NotificationCenter';
import type { Alerta } from '../../utils/alertas';
import { NAVIGATION_GROUPS } from '../navigation/navigation';
import { Breadcrumb } from '../../shared/ui';
import { OBRA } from '../../config/obra';

const ICON_STROKE = 1.75;

interface DesktopTopBarProps {
  activeTab: string;
  currentUser: User | null;
  isNotificationOpen: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  alertas?: Alerta[];
  isCloudConnected: boolean;
  lastCloudSync: string;
  onOpenGlobalSearch: () => void;
  onOpenProjectContext: () => void;
  onNavigate: (tab: string) => void;
  onToggleNotifications: () => void;
  onCloseNotifications: () => void;
  onMarkAllNotificationsAsRead: () => void;
  onClearNotifications: () => void;
  onMarkNotificationAsRead: (id: string) => void;
  onLogout: () => void;
}

export function DesktopTopBar({
  activeTab,
  currentUser,
  isNotificationOpen,
  notifications,
  unreadCount,
  alertas,
  isCloudConnected,
  lastCloudSync,
  onOpenGlobalSearch,
  onOpenProjectContext,
  onNavigate,
  onToggleNotifications,
  onCloseNotifications,
  onMarkAllNotificationsAsRead,
  onClearNotifications,
  onMarkNotificationAsRead,
  onLogout,
}: DesktopTopBarProps) {
  const headerRef = useRef<HTMLElement>(null);
  const logoutBtnRef = useRef<HTMLButtonElement>(null);
  const userName = currentUser?.displayName || currentUser?.email || 'Usuário RENEA';
  const userInitials = userName.trim().slice(0, 2).toUpperCase();

  // A trilha vem do mapa completo de navegação, e não dos grupos já filtrados
  // pela busca, para o usuário não perder a referência enquanto pesquisa.
  const breadcrumbItems = useMemo(() => {
    for (const group of NAVIGATION_GROUPS) {
      const item = group.items.find(entry => entry.id === activeTab);
      if (item) return [{ label: group.label }, { label: item.label }];
    }
    return [];
  }, [activeTab]);

  useGSAP(() => {
    if (!logoutBtnRef.current) return;
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

  return (
    <header
      ref={headerRef}
      className="erp-topbar hidden lg:flex backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(255, 255, 255, 0.75)' }}
      aria-label="Barra de contexto do sistema"
    >
      <Breadcrumb items={breadcrumbItems} className="hidden shrink-0 xl:flex" />
      <button type="button" onClick={onOpenGlobalSearch} className="erp-topbar__searchbox relative block w-full max-w-sm text-left">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={ICON_STROKE} />
        <span className="flex h-10 items-center rounded-lg border border-slate-200 bg-white pl-10 pr-16 text-xs text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700">Buscar no sistema...</span>
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">Ctrl K</kbd>
      </button>

      <button
        type="button"
        onClick={onOpenProjectContext}
        className="erp-topbar__project"
        title="Obra ativa"
        aria-label={`Obra ativa: ${OBRA.nome}`}
      >
        <Building2 aria-hidden="true" />
        <span>
          <small>Projeto atual</small>
          <strong>{OBRA.nome}</strong>
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={ICON_STROKE} aria-hidden="true" />
      </button>

      <div className="erp-topbar__actions">
        <div
          className="erp-topbar__status"
          data-offline={!isCloudConnected || undefined}
          title={lastCloudSync ? `Última sincronização com a nuvem: ${lastCloudSync}` : 'Ainda sem sincronização com a nuvem nesta sessão'}
        >
          <span />
          {isCloudConnected ? 'Sincronizado com a nuvem' : 'Sem conexão com a nuvem'}
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
          alertas={alertas}
          onAlertaClick={onNavigate}
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
