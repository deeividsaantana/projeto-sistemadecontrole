import { useRef, useState } from 'react';
import { iniciaisDoNome, nomeDaPessoa } from '../../auth/nomeDaPessoa';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { reduzMovimento } from '../../shared/motion/reduzMovimento';
import { Building2, LogOut } from 'lucide-react';
import type { SupabaseAuthUser as User } from '../../auth/supabaseAuth';
import type { AppNotification } from '../../types';
import { NotificationCenter } from './NotificationCenter';
import type { Alerta } from '../../utils/alertas';
import { OBRA } from '../../config/obra';
import { descreverSalvamento, type DescricaoSalvamento } from '../../cloud/estadoSalvamento';

const ICON_STROKE = 1.75;
const COR_AVATAR_KEY = 'cintravyse_cor_avatar';

interface DesktopTopBarProps {
  currentUser: User | null;
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
  const userName = nomeDaPessoa(currentUser);
  const userInitials = iniciaisDoNome(userName);
  // Cor do ícone da pessoa: verde ou azul, escolhida clicando no ícone e
  // guardada neste navegador (pedido de 11/11/2026).
  const [corAvatar, setCorAvatar] = useState<'verde' | 'azul'>(() => {
    try { return localStorage.getItem(COR_AVATAR_KEY) === 'azul' ? 'azul' : 'verde'; } catch { return 'verde'; }
  });
  const trocarCorAvatar = () => {
    const proxima = corAvatar === 'verde' ? 'azul' : 'verde';
    setCorAvatar(proxima);
    try { localStorage.setItem(COR_AVATAR_KEY, proxima); } catch { /* sem armazenamento: vale só nesta sessão */ }
  };

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
        <Building2 aria-hidden="true" />
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
        <div className="erp-topbar__user">
          <button
            type="button"
            onClick={trocarCorAvatar}
            className={`erp-topbar__avatar erp-topbar__avatar--${corAvatar}`}
            title={`Trocar a cor do ícone para ${corAvatar === 'verde' ? 'azul' : 'verde'}`}
            aria-label={`Trocar a cor do ícone para ${corAvatar === 'verde' ? 'azul' : 'verde'}`}
          >
            {userInitials}
          </button>
          <strong title={userName}>{userName}</strong>
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
