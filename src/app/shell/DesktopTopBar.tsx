import type { User } from 'firebase/auth';
import { FolderPlus, Wifi } from 'lucide-react';
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
    <div className="hidden md:flex items-center justify-between h-16 bg-white border-b border-slate-200 px-6 xl:px-8 shrink-0 print:hidden select-none">
      <div className="flex items-center gap-4">
        <img src={logoSrc} alt="RENEA Infraestrutura" className="h-7 w-auto" />
        <span className="h-8 w-px bg-slate-200" />
        <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
          Renea Operacional - Canteiro de Obras Ativo
        </h2>
        <Badge tone="success" className="gap-1.5">
          <Wifi className="h-3.5 w-3.5 animate-pulse" />
          Sistema conectado
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={() => onNavigate('cadastros')}
          title="Abrir cadastros auxiliares"
          icon={FolderPlus}
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

        <div className="text-right">
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest font-mono">Data do Sistema</p>
          <p className="text-xs font-semibold text-slate-700">
            {new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex h-10 max-w-56 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700">
          <div className="w-6 h-6 bg-emerald-600 rounded-md flex items-center justify-center font-bold text-white text-[10px] shrink-0">{userInitials}</div>
          <div className="min-w-0 text-left">
            <span className="block truncate">{userName}</span>
            <span className="block truncate text-[9px] font-normal text-slate-500">{currentUser?.email}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
