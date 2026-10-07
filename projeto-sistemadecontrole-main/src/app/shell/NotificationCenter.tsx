import { AlertTriangle, Bell, BellRing, CheckCheck, ChevronRight } from 'lucide-react';
import type { AppNotification } from '../../types';
import type { Alerta } from '../../utils/alertas';
import { Button, EmptyState, IconButton, cn } from '../../shared/ui';

interface NotificationCenterProps {
  isOpen: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  /** Alertas derivados dos registros: não são salvos e somem quando resolvidos. */
  alertas?: Alerta[];
  onAlertaClick?: (tab: string) => void;
  onToggle: () => void;
  onClose: () => void;
  onMarkAllAsRead: () => void;
  onClear: () => void;
  onMarkOneAsRead: (id: string) => void;
}

const getNotificationDotClass = (type: AppNotification['type']) => {
  if (type === 'success') return 'bg-emerald-500';
  if (type === 'warning') return 'bg-amber-500';
  if (type === 'error') return 'bg-rose-500';
  return 'bg-blue-500';
};

export function NotificationCenter({
  isOpen,
  notifications,
  unreadCount,
  onToggle,
  onClose,
  onMarkAllAsRead,
  onClear,
  onMarkOneAsRead,
  alertas = [],
  onAlertaClick,
}: NotificationCenterProps) {
  const totalBadge = unreadCount + alertas.length;
  return (
    <div className="relative">
      <IconButton
        onClick={onToggle}
        icon={totalBadge > 0 ? BellRing : Bell}
        label="Abrir notificacoes"
        active={isOpen}
        badge={totalBadge}
        className={totalBadge > 0 ? '[&>svg]:animate-bounce [&>svg]:text-emerald-600' : undefined}
      />

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div className="absolute right-0 z-50 mt-3 w-80 space-y-3 rounded-md border border-slate-200 bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Alertas do sistema</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold">
                {unreadCount > 0 && (
                  <Button
                    onClick={onMarkAllAsRead}
                    icon={CheckCheck}
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5 text-emerald-700 hover:text-emerald-800"
                  >
                    Lidas
                  </Button>
                )}
                {notifications.length > 0 && (
                  <>
                    <span className="text-slate-300">|</span>
                    <Button
                      onClick={onClear}
                      variant="ghost"
                      size="sm"
                      className="h-7 px-1.5 text-slate-500"
                    >
                      Limpar
                    </Button>
                  </>
                )}
              </div>
            </div>

            {alertas.length > 0 && (
              <ul className="space-y-1.5">
                {alertas.map(alerta => (
                  <li key={alerta.id}>
                    <button
                      type="button"
                      onClick={() => onAlertaClick?.(alerta.tab)}
                      className="flex w-full items-center gap-2 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-left transition-colors hover:bg-rose-100"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[9px] font-black uppercase tracking-wider text-rose-700">{alerta.titulo}</span>
                        <span className="block truncate text-[10px] text-rose-900">{alerta.mensagem}</span>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {notifications.length === 0 && alertas.length === 0 ? (
                <EmptyState
                  icon={Bell}
                  title="Sem alertas recentes"
                  description="Alertas de cadastros, edicoes e sincronizacoes aparecerao aqui."
                  compact
                />
              ) : (
                notifications.map(notification => {
                  const borderClass = notification.read ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-emerald-200 bg-emerald-50';
                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => onMarkOneAsRead(notification.id)}
                      className={cn('w-full space-y-1 rounded-md border p-2.5 text-left transition-colors hover:bg-slate-100', borderClass)}
                    >
                      <div className="flex items-start gap-1.5 justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getNotificationDotClass(notification.type)}`} />
                          <span className="truncate text-[9px] font-black uppercase tracking-wider text-slate-700">{notification.title}</span>
                        </div>
                        <span className="text-[9px] text-slate-500 font-mono shrink-0">{notification.timestamp}</span>
                      </div>
                      <p className="text-[10px] leading-normal text-slate-600">{notification.message}</p>
                      <div className="flex items-center justify-end pt-1">
                        {!notification.read && <span className="text-[8px] text-emerald-700 font-bold font-mono">NOVO</span>}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
