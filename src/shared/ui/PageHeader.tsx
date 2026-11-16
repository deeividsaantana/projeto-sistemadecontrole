import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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
 * principal à direita, numa linha só quando couber. No computador essa linha
 * sobe para a barra do topo, no lugar do "Projeto atual" (index.css,
 * "Cabeçalho na barra do topo"). Dentro da área de dados
 * de outra TelaCheia (subtela que é uma tela inteira) o título vira h2.
 */
export function PageHeader({ title, description, actions, abas, className, compact = true, tituloOculto = false }: PageHeaderProps) {
  const Titulo = useDentroDaTelaCheia() ? 'h2' : 'h1';
  const linha = useLinhaDoTopo(Boolean(actions));
  // Sem subtelas, o lado esquerdo ficaria vazio: o título aparece, como no
  // Painel de Controle. Com subtelas, as abas já dizem onde a pessoa está.
  const escondeTitulo = tituloOculto || (compact && Boolean(abas));
  // Nada à vista (Painel): a barra do topo segue mostrando o projeto atual.
  const vazio = escondeTitulo && !abas && !actions;
  return (
    <header ref={linha.ref} data-linha={linha.valor} className={cn('renea-page-header', escondeTitulo ? 'renea-page-header--compact' : undefined, abas ? 'renea-page-header--com-abas' : undefined, vazio ? 'renea-page-header--vazio' : undefined, className)}>
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

/** Largura natural (sem quebrar linha) de um pedaço do cabeçalho. */
function larguraNatural(elemento: HTMLElement | null) {
  if (!elemento) return 0;
  const { width, maxWidth } = elemento.style;
  elemento.style.width = 'max-content';
  elemento.style.maxWidth = 'none';
  const medida = elemento.getBoundingClientRect().width;
  elemento.style.width = width;
  elemento.style.maxWidth = maxWidth;
  return medida;
}

/**
 * No computador o cabeçalho sobe para a barra do topo (index.css,
 * "Cabeçalho na barra do topo"). Se abas e ações cabem ao lado do canto
 * direito da barra (salvamento, sino e pessoa), fica tudo numa linha
 * ("uma"). Senão as abas ficam na barra e as ações descem para a linha de
 * baixo, encostadas à direita ("duas"). A conta usa a largura natural de
 * cada parte, então o resultado não fica trocando de um para o outro.
 */
function useLinhaDoTopo(temAcoes: boolean) {
  const ref = useRef<HTMLElement>(null);
  const [valor, setValor] = useState<'uma' | 'duas'>('uma');

  useLayoutEffect(() => {
    const cabecalho = ref.current;
    if (!cabecalho || !temAcoes || typeof ResizeObserver === 'undefined') return;
    const medir = () => {
      const direita = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--renea-topo-direita')) || 0;
      const inicio = cabecalho.querySelector<HTMLElement>(':scope > .renea-page-header__abas')
        ?? cabecalho.querySelector<HTMLElement>(':scope > .renea-page-header__copy :is(h1, h2)');
      const acoes = cabecalho.querySelector<HTMLElement>(':scope > .renea-page-actions');
      // 36 px: o vão entre as partes e o respiro antes do canto direito.
      const precisa = larguraNatural(inicio) + larguraNatural(acoes) + direita + 36;
      setValor(precisa <= cabecalho.getBoundingClientRect().width ? 'uma' : 'duas');
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(cabecalho);
    return () => observador.disconnect();
  }, [temAcoes]);

  return { ref, valor: temAcoes ? valor : 'uma' };
}
