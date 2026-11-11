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
  /** Mantido por compatibilidade com telas antigas; não é exibido no cabeçalho. */
  eyebrow?: string;
  /** Esconde o título visual quando há subtelas (as abas já identificam a tela). */
  compact?: boolean;
  /** Título só para leitor de tela: a tela já é identificada pelo menu (Painel). */
  tituloOculto?: boolean;
}

/**
 * Exibe o título (h1) e a descrição do módulo, visíveis para todos os
 * usuários, as subtelas da aba (quando houver) e a barra de ações. Dentro da
 * TelaCheia é a faixa fixa do topo: título curto, abas ao lado e a ação
 * principal à direita, numa linha só quando couber. Dentro da área de dados
 * de outra TelaCheia (subtela que é uma tela inteira) o título vira h2.
 */
export function PageHeader({ title, description, actions, abas, className, compact = true, tituloOculto = false }: PageHeaderProps) {
  const Titulo = useDentroDaTelaCheia() ? 'h2' : 'h1';
  // Sem subtelas, o lado esquerdo ficaria vazio: o título aparece, como no
  // Painel de Controle. Com subtelas, as abas já dizem onde a pessoa está.
  const escondeTitulo = tituloOculto || (compact && Boolean(abas));
  return (
    <header className={cn('renea-page-header', escondeTitulo ? 'renea-page-header--compact' : undefined, abas ? 'renea-page-header--com-abas' : undefined, className)}>
      <div className="renea-page-header__copy">
        <span className={escondeTitulo ? 'sr-only' : undefined}>
          <Titulo>{title}</Titulo>
          {description && <p>{description}</p>}
        </span>
      </div>
      {abas && <div className="renea-page-header__abas">{abas}</div>}
      {actions && <div className="renea-page-toolbar renea-page-actions">{actions}</div>}
    </header>
  );
}
