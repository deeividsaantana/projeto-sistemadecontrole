import type { ReactNode } from 'react';
import { cn } from './styles';

/**
 * Foto de obra que entra na faixa do cabeçalho. É decoração: o CSS a carrega
 * por background e só a partir de 768px, então o celular não baixa imagem
 * alguma. Sem `photo` a faixa fica lisa, cor-osso, e continua correta.
 */
export type PageHeaderPhoto = 'rodovia-duplicada' | 'rodovia-serra' | 'ponte-construcao';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Chapéu curto acima do título, em caixa alta. Ex.: "Operação em tempo real". */
  eyebrow?: string;
  photo?: PageHeaderPhoto;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, eyebrow, photo, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('renea-page-header', className)} data-photo={photo}>
      <div className="renea-page-header__band">
        <div className="renea-page-header__photo" aria-hidden="true" />
        <div className="renea-page-header__plane" aria-hidden="true" />
        <div className="renea-page-header__copy">
          {eyebrow && <p className="renea-page-header__eyebrow">{eyebrow}</p>}
          <h1 className="renea-page-header__title">{title}</h1>
          {description && <p className="renea-page-header__lede">{description}</p>}
        </div>
      </div>
      {actions && <div className="renea-page-header__actions">{actions}</div>}
    </header>
  );
}
