import { useRef } from 'react';
import { nomeDaPessoa } from '../../auth/nomeDaPessoa';
import { Avatar } from '../../shared/ui';
import type { MeuAvatar } from '../perfil/usePerfis';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { reduzMovimento } from '../../shared/motion/reduzMovimento';
import { LogOut } from 'lucide-react';
import type { SupabaseAuthUser as User } from '../../auth/supabaseAuth';
import type { AppNotification } from '../../types';
import { NotificationCenter } from './NotificationCenter';
import type { Alerta } from '../../utils/alertas';
import { OBRA } from '../../config/obra';
import { descreverSalvamento, type DescricaoSalvamento } from '../../cloud/estadoSalvamento';

const ICON_STROKE = 1.75;

function RodoanelIcon() {
  return (
    <svg className="rodoanel-project-icon" viewBox="0 0 32 24" aria-hidden="true" focusable="false">
      <path className="rodoanel-arc rodoanel-arc--green" d="M4 19C5 8 11 3 17 3c6 0 10 5 11 11" />
      <path className="rodoanel-arc rodoanel-arc--orange" d="M7 19C8 10 12 6 17 6c4 0 7 3 8 8" />
      <path className="rodoanel-road" d="M4 19C5 8 11 3 17 3c6 0 10 5 11 11" />
      <path className="rodoanel-ramp" d="M4 19h10c5 0 8-2 10-6" />
      <circle className="rodoanel-car rodoanel-car--one" cx="8" cy="17" r="1.5" />
      <circle className="rodoanel-car rodoanel-car--two" cx="18" cy="8" r="1.5" />
    </svg>
  );
}

interface DesktopTopBarProps {
  currentUser: User | null;
  meuAvatar: MeuAvatar | null;
  onAbrirPerfil: () => void;
  isNotificationOpen: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  alertas?: Alerta[];
  isCloudConnected: boolean;
  /** Estado do salvamento (aparelho e nuvem). Sem ele, usa só isCloudConnected. */
  salvamento?: DescricaoSalvamento;
  onRetryUpload?: () => void;
  lastCloudSync: string;
  pendingCount?: number;
  isRetryingPending?: boolean;
  onRetryPending?: () => void;
  onNavigate: (tab: string) => void;
  onToggleNotifications: () => void;
  onCloseNotifications: () => void;
  onMarkAllNotificationsAsRead: () => void;
  onClearNotifications: () => void;
  onMarkNotificationAsRead: (id: string) => void;
  onLogout: () => void;
}

export function DesktopTopBar({
  currentUser,
  meuAvatar,
  onAbrirPerfil,
  isNotificationOpen,
  notifications,
  unreadCount,
  alertas,
  isCloudConnected,
  salvamento: salvamentoRecebido,
  onRetryUpload,
  lastCloudSync,
  pendingCount,
  isRetryingPending,
  onRetryPending,
  onNavigate,
  onToggleNotifications,
  onCloseNotifications,
  onMarkAllNotificationsAsRead,
  onClearNotifications,
  onMarkNotificationAsRead,
  onLogout,
}: DesktopTopBarProps) {
  const salvamento = salvamentoRecebido ?? descreverSalvamento({ online: true, conectado: isCloudConnected, enviando: false, pendente: false, falhasSeguidas: 0 });
  const headerRef = useRef<HTMLElement>(null);
  const logoutBtnRef = useRef<HTMLButtonElement>(null);
  const userName = meuAvatar?.nome || nomeDaPessoa(currentUser);

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

  return (
    <header
      ref={headerRef}
      className="erp-topbar hidden lg:flex"
      aria-label="Barra de contexto do sistema"
    >
      {/* Sem busca geral aqui (pedido de 11/11/2026): cada aba tem a busca
          dela, e duas barras de busca na mesma tela confundem. */}

      <div
        className="erp-topbar__project"
        title="Obra ativa"
        aria-label={`Obra ativa: ${OBRA.nome}`}
      >
        <RodoanelIcon />
        <span>
          <small>Projeto atual</small>
          <strong>{OBRA.nome}</strong>
        </span>
      </div>

      <div className="erp-topbar__actions">
        <div
          className="erp-topbar__status"
          role="status"
          aria-live="polite"
          data-offline={salvamento.ponto === 'amarelo' || undefined}
          title={`${salvamento.detalhe} ${lastCloudSync ? `Última sincronização: ${lastCloudSync}` : 'Ainda sem sincronização nesta sessão.'}`}
        >
          <span aria-hidden="true" />
          <em className="erp-topbar__status-texto not-italic">{salvamento.rotulo}</em>
        </div>
        {salvamento.tentarNovamente && onRetryUpload && (
          <button type="button" className="erp-topbar__retry" onClick={onRetryUpload}>Tentar novamente</button>
        )}
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
