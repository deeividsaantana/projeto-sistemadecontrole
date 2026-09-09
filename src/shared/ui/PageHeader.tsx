import type { ReactNode } from 'react';
import { cn } from './styles';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  eyebrow?: string;
}

export function PageHeader({ title, description, actions, className, eyebrow = 'Operação em tempo real' }: PageHeaderProps) {
  const visual = ['road', 'bridge', 'crane'][Array.from(title).reduce((total, char) => total + char.charCodeAt(0), 0) % 3];
  return (
    <header className={cn('renea-page-header', className)} data-visual={visual}>
      <div className="renea-page-header__photo" aria-hidden="true">
        <span>Pessoas<br />e engenharia<br />em movimento</span>
      </div>
      <div className="renea-page-header__plane">
        <div className="renea-page-header__copy min-w-0">
          <span className="renea-page-header__eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="renea-page-actions flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
