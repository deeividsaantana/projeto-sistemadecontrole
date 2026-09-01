import type { User } from 'firebase/auth';
import type { AppNotification } from '../../types';
import { NotificationCenter } from './NotificationCenter';
import { NAVIGATION_GROUPS, type NavigationItem } from '../navigation/navigation';

interface DesktopTopBarProps {
  activeTab: string;
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

  const allNavigationItems = NAVIGATION_GROUPS.flatMap(group => group.items as readonly NavigationItem[]);
  const activeItem = allNavigationItems.find(item => item.id === activeTab);
  const activeGroup = NAVIGATION_GROUPS.find(group => group.items.some(item => item.id === activeTab));
  return (
    <header className="erp-topbar hidden lg:flex" aria-label="Barra de contexto do sistema">
      <div className="erp-topbar__breadcrumb">
        <span>{activeGroup?.label || 'Visão geral'}</span>
        <span className="erp-topbar__chevron">/</span>
        <strong>{activeItem?.label || 'Painel de Controle'}</strong>
      </div>
      <div className="erp-topbar__actions">
        <div className="erp-topbar__status"><span /> Operação normal</div>
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
        <div className="erp-topbar__date">
          <span>Data do sistema</span>
          <strong>{new Date().toLocaleDateString('pt-BR')}</strong>
        </div>
        <div className="erp-topbar__user">
          <span className="erp-topbar__avatar">{userInitials}</span>
          <span><strong>{userName}</strong><small>{currentUser?.email || 'Usuário autenticado'}</small></span>
        </div>
        <button type="button" className="erp-topbar__command" onClick={() => onNavigate('cadastros')}>
          Abrir cadastros
        </button>
      </div>
    </header>
  );
}
