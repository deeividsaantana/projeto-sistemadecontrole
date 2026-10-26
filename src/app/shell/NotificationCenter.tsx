import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, BellRing, CheckCheck, ChevronRight } from 'lucide-react';
import type { AppNotification } from '../../types';
import type { Alerta } from '../../utils/alertas';
import { Button, EmptyState, IconButton, Modal, cn } from '../../shared/ui';

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

/**
 * Sino de avisos. A janela é o Modal comum (A11 da auditoria de 21/10/2026):
 * Esc fecha, o foco fica preso dentro dela e volta ao sino ao fechar. Antes
 * era uma caixa montada à mão, sem nenhum dos três.
 */
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
  const sinoRef = useRef<HTMLSpanElement>(null);
  const estavaAberto = useRef(isOpen);
  // O App tem dois sinos (barra do celular e barra do computador) ligados ao
  // mesmo estado, e o Modal sai do lugar (portal): só o sino que está à vista
  // abre a janela, senão abririam duas.
  const [sinoVisivel, setSinoVisivel] = useState(false);

  useLayoutEffect(() => {
    if (isOpen) setSinoVisivel(Boolean(sinoRef.current?.getClientRects().length));
  }, [isOpen]);

  useEffect(() => {
    if (estavaAberto.current && !isOpen && sinoVisivel) sinoRef.current?.querySelector('button')?.focus();
    estavaAberto.current = isOpen;
  }, [isOpen, sinoVisivel]);

  const abrirAlerta = (tab: string) => {
    onClose();
    onAlertaClick?.(tab);
  };

  return (
    <span ref={sinoRef} className="relative inline-flex">
      <IconButton
        onClick={onToggle}
        icon={totalBadge > 0 ? BellRing : Bell}
        label={totalBadge > 0 ? `Abrir avisos: ${totalBadge} novo(s)` : 'Abrir avisos'}
        active={isOpen}
        badge={totalBadge}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={totalBadge > 0 ? 'motion-safe:[&>svg]:animate-bounce [&>svg]:text-emerald-600' : undefined}
      />

      <Modal
        open={isOpen && sinoVisivel}
        title="Avisos do sistema"
        description={unreadCount > 0 ? `${unreadCount} aviso(s) sem ler.` : 'Nenhum aviso novo.'}
        size="md"
        onClose={onClose}
        footer={(notifications.length > 0) && (
          <div className="flex flex-wrap justify-end gap-2">
            {notifications.length > 0 && (
              <Button onClick={onClear} variant="secondary">Limpar avisos</Button>
            )}
            {unreadCount > 0 && (
              <Button onClick={onMarkAllAsRead} icon={CheckCheck} variant="primary">Marcar todos como lidos</Button>
            )}
          </div>
        )}
      >
        <div className="space-y-3">
          {alertas.length > 0 && (
            <section aria-labelledby="avisos-alertas-titulo" className="space-y-1.5">
              <h3 id="avisos-alertas-titulo" className="text-sm font-bold text-slate-900">Precisa de atenção</h3>
              <ul className="space-y-1.5">
                {alertas.map(alerta => (
                  <li key={alerta.id}>
                    <button
                      type="button"
                      onClick={() => abrirAlerta(alerta.tab)}
                      className="flex min-h-12 w-full items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-left transition-colors hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--renea-focus)"
                    >
                      <AlertTriangle className="size-4 shrink-0 text-rose-700" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-rose-800">{alerta.titulo}</span>
                        <span className="block text-sm text-rose-900">{alerta.mensagem}</span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-rose-700" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {notifications.length === 0 && alertas.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Sem avisos recentes"
              description="Avisos de cadastros, edições e sincronizações aparecem aqui."
              compact
            />
          ) : notifications.length > 0 && (
            <ul className="space-y-2" aria-label="Avisos recentes">
              {notifications.map(notification => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => onMarkOneAsRead(notification.id)}
                    aria-label={`${notification.read ? '' : 'Novo: '}${notification.title}. ${notification.message}. ${notification.timestamp}${notification.read ? '' : '. Toque para marcar como lido'}`}
                    className={cn(
                      'w-full space-y-1 rounded-lg border p-3 text-left transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--renea-focus)',
                      notification.read ? 'border-slate-200 bg-slate-50' : 'border-emerald-200 bg-emerald-50',
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className={`size-2 shrink-0 rounded-full ${getNotificationDotClass(notification.type)}`} aria-hidden="true" />
                        <span className="text-sm font-bold text-slate-800">{notification.title}</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-[#5b6870]">{notification.timestamp}</span>
                    </span>
                    <span className="block text-sm leading-normal text-slate-700">{notification.message}</span>
                    {!notification.read && <span className="block text-right text-xs font-bold text-emerald-800">Novo</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </span>
  );
}
