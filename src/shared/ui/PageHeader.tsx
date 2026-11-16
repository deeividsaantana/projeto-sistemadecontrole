import { useLayoutEffect, useRef, type ReactNode } from 'react';
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
  const linhaDoTopo = useLinhaDoTopo();
  // Sem subtelas, o lado esquerdo ficaria vazio: o título aparece, como no
  // Painel de Controle. Com subtelas, as abas já dizem onde a pessoa está.
  const escondeTitulo = tituloOculto || (compact && Boolean(abas));
  // Nada à vista (Painel): a barra do topo segue mostrando o projeto atual.
  const vazio = escondeTitulo && !abas && !actions;
  return (
    <header ref={linhaDoTopo} className={cn('renea-page-header', escondeTitulo ? 'renea-page-header--compact' : undefined, abas ? 'renea-page-header--com-abas' : undefined, vazio ? 'renea-page-header--vazio' : undefined, className)}>
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

/**
 * O que passa por cima do recuo da direita (onde ficam o sino e a pessoa) não
 * conta como transbordo para o scrollWidth, então a conta é feita à mão.
 */
function cabe(cabecalho: HTMLElement) {
  const limite = cabecalho.getBoundingClientRect().right - (parseFloat(getComputedStyle(cabecalho).paddingRight) || 0);
  const fim = Math.max(...Array.from(cabecalho.children, filho => filho.getBoundingClientRect().right));
  return fim <= limite + 1;
}

/** Passos de aperto, do mais leve ao último recurso (index.css, "Cabeçalho na barra do topo"). */
const APERTOS = 4;

/**
 * No computador o cabeçalho sobe para a barra do topo e fica sempre numa
 * linha só (pedido de 16/11/2026). Quando não cabe ao lado do canto direito
 * da barra (salvamento, sino e pessoa), aperta aos poucos e para no primeiro
 * passo que cabe: 1 esconde o nome da pessoa (fica a foto); 2 tira os ícones
 * das abas e deixa só o ícone nos botões secundários; 3 usa o nome curto das
 * abas; 4 as abas rolam de lado dentro da própria faixa. A conta parte sempre
 * do passo 0, então o resultado não fica trocando sozinho.
 */
function useLinhaDoTopo() {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const cabecalho = ref.current;
    const raiz = document.documentElement;
    const barra = document.querySelector<HTMLElement>('.erp-workspace > .erp-topbar');
    const subiu = Boolean(cabecalho && barra && cabecalho.closest('.renea-tela-cheia--raiz > .renea-tela-cheia__topo'))
      && window.matchMedia('(min-width: 1024px)').matches
      && !cabecalho?.classList.contains('renea-page-header--vazio');
    if (!cabecalho || !barra || !subiu) {
      cabecalho?.removeAttribute('data-aperto');
      return;
    }
    const acoesDaBarra = barra.querySelector<HTMLElement>('.erp-topbar__actions');
    const medir = () => {
      for (let passo = 0; passo <= APERTOS; passo += 1) {
        cabecalho.dataset.aperto = String(passo);
        if (passo >= 1) raiz.dataset.topoApertado = '';
        else delete raiz.dataset.topoApertado;
        if (acoesDaBarra) raiz.style.setProperty('--renea-topo-direita', `${Math.ceil(acoesDaBarra.getBoundingClientRect().width)}px`);
        if (cabe(cabecalho)) return;
      }
    };
    medir();
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => medir());
    observador?.observe(cabecalho);
    return () => {
      observador?.disconnect();
      delete raiz.dataset.topoApertado;
    };
  });

  return ref;
}
