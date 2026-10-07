import type { ReactNode } from 'react';

type BadgeTone = 'success' | 'info' | 'warning' | 'critical' | 'neutral';

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  icon?: ReactNode;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-[var(--color-status-success-bg)] text-[var(--color-status-success-fg)]',
  info: 'bg-[var(--color-status-info-bg)] text-[var(--color-status-info-fg)]',
  warning: 'bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-fg)]',
  critical: 'bg-[var(--color-status-critical-bg)] text-[var(--color-status-critical-fg)]',
  neutral: 'bg-[var(--color-status-neutral-bg)] text-[var(--color-status-neutral-fg)]',
};

export const Badge = ({ tone = 'neutral', children, icon }: BadgeProps) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONE_CLASSES[tone]}`}>
    {icon}
    {children}
  </span>
);

/**
 * Mapa único de status operacional -> tom. Cada tela decide o rótulo, mas
 * a cor nunca varia por tela: verde = operando, azul = informativo/à
 * disposição, amarelo = atenção/pendente, vermelho = crítico/manutenção,
 * cinza = inativo/vazio.
 */
export type OperationalStatus = 'ativo' | 'disponivel' | 'atencao' | 'critico' | 'inativo';

const STATUS_TONE: Record<OperationalStatus, BadgeTone> = {
  ativo: 'success',
  disponivel: 'info',
  atencao: 'warning',
  critico: 'critical',
  inativo: 'neutral',
};

export const StatusBadge = ({ status, label }: { status: OperationalStatus; label: string }) => (
  <Badge tone={STATUS_TONE[status]}>{label}</Badge>
);
