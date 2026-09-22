import type { ReactNode } from 'react';
import { cn } from './styles';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  /** Contexto do módulo, em caixa alta. Ex.: "Frota", "Suprimentos". */
  eyebrow?: string;
}

/** Mantém a hierarquia semântica da tela sem repetir um título visual no shell. */
export function PageHeader({ title, description, actions, className, eyebrow }: PageHeaderProps) {
  return (
    <header className={cn('renea-page-header', className)}>
      <div className="renea-page-header__copy">
        {eyebrow && <span>{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="renea-page-toolbar renea-page-actions">{actions}</div>}
    </header>
  );
}
