import type { User } from 'firebase/auth';
import type { AppNotification } from '../../types';
import { Badge, Button } from '../../shared/ui';
import { NotificationCenter } from './NotificationCenter';

interface DesktopTopBarProps {
  activeTab: string;
  logoSrc: string;
  currentUser: User | null;
  isNotificationOpen: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  onNavigate: (tab: string) => void;
  onToggleNotifications: () => void;
  onCloseNotifications: () => void;
  onMarkAllNotificationsAsRead: () => void;
  onClearNotifications: () => void;
  onMarkNotificationAsRead: (id: string) => void;
}

export function DesktopTopBar({
  activeTab,
  logoSrc,
  currentUser,
  isNotificationOpen,
  notifications,
  unreadCount,
  onNavigate,
  onToggleNotifications,
  onCloseNotifications,
  onMarkAllNotificationsAsRead,
  onClearNotifications,
  onMarkNotificationAsRead,
}: DesktopTopBarProps) {
  const userName = currentUser?.displayName || currentUser?.email || 'Usuario RENEA';
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <div className="app-topbar hidden md:flex items-center justify-between h-[6.5rem] px-7 xl:px-12 shrink-0 print:hidden select-none">
      <div className="app-topbar__identity flex items-center gap-5">
        <div className="app-topbar__brand">
          <img src={logoSrc} alt="RENEA Infraestrutura" className="h-9 w-auto" />
        </div>
        <span className="app-topbar__divider h-12 w-px" />
        <div className="app-topbar__status-copy">
        <h2 className="text-sm font-semibold flex items-center gap-2.5 tracking-[-0.01em]">
          <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" /></span>
          Operação normal
        </h2>
        <p>Todos os sistemas operacionais</p>
        </div>
        <Badge tone="success" className="app-topbar__badge">Conectado</Badge>
      </div>

      <div className="app-topbar__actions flex items-center gap-4">
        <Button
          onClick={() => onNavigate('cadastros')}
          title="Abrir cadastros auxiliares"
          variant={activeTab === 'cadastros' ? 'primary' : 'secondary'}
        >
          Cadastros
        </Button>

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

        <div className="app-topbar__date text-right">
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest font-mono">Data do Sistema</p>
          <p className="text-xs font-semibold text-slate-700">
            {new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="app-topbar__user flex h-14 max-w-64 items-center gap-3 px-3.5 pr-4 text-xs font-semibold">
          <div className="app-topbar__avatar flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-sm">{userInitials}</div>
          <div className="min-w-0 text-left">
            <span className="block truncate">{userName}</span>
            <span className="block truncate text-[9px] font-normal text-slate-500">{currentUser?.email}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
