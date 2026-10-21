import type { ReactNode } from 'react';
import { cn } from './styles';
import { useDentroDaTelaCheia } from './TelaCheia';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Subtelas (AbasDaTela), logo depois do título e antes das ações. */
  abas?: ReactNode;
  className?: string;
  /** Contexto do módulo, em caixa alta. Ex.: "Frota", "Suprimentos". */
  eyebrow?: string;
}

/**
 * Exibe o título (h1) e a descrição do módulo, visíveis para todos os
 * usuários, as subtelas da aba (quando houver) e a barra de ações. Dentro da
 * TelaCheia é a faixa fixa do topo: título curto, abas ao lado e a ação
 * principal à direita, numa linha só quando couber. Dentro da área de dados
 * de outra TelaCheia (subtela que é uma tela inteira) o título vira h2.
 */
export function PageHeader({ title, description, actions, abas, className, eyebrow }: PageHeaderProps) {
  const Titulo = useDentroDaTelaCheia() ? 'h2' : 'h1';
  return (
    <header className={cn('renea-page-header', abas ? 'renea-page-header--com-abas' : undefined, className)}>
      <div className="renea-page-header__copy">
        {eyebrow && <span className="renea-page-header__eyebrow">{eyebrow}</span>}
        <Titulo>{title}</Titulo>
        {description && <p>{description}</p>}
      </div>
      {abas && <div className="renea-page-header__abas">{abas}</div>}
      {actions && <div className="renea-page-toolbar renea-page-actions">{actions}</div>}
    </header>
  );
}
