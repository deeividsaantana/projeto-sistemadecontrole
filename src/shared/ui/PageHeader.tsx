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

/**
 * Cabeçalho de módulo, denso. A versão anterior era editorial — foto de obra
 * ocupando metade da faixa, título de até 4,6 rem, 12,75 rem de altura mínima —
 * e comia um terço da primeira dobra antes de qualquer dado aparecer. Num ERP
 * operacional a primeira dobra pertence ao dado, não à capa: aqui o título, o
 * contexto e as ações cabem em uma faixa de ~64 px, com uma linha fina embaixo.
 */
export function PageHeader({ title, description, actions, className, eyebrow }: PageHeaderProps) {
  return (
    <header className={cn('renea-page-header', className)}>
      <div className="renea-page-header__copy">
        {eyebrow && <span className="renea-page-header__eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="renea-page-actions">{actions}</div>}
    </header>
  );
}
