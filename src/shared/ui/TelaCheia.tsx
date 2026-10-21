import { createContext, useContext, useEffect, useRef, type ReactNode, type Ref } from 'react';
import { cn } from './styles';

/**
 * Molde de página do RENEA (C1/A1/A2 da auditoria de 21/10/2026). Toda aba
 * ocupa 100% da largura e toda a altura abaixo da barra do topo, sem botão de
 * "tela cheia": já nasce cheia, dentro da casca (menu lateral e barra do
 * topo continuam à vista).
 *
 * De cima para baixo, no computador (1024 px ou mais):
 * 1. cabeçalho fixo: o PageHeader da aba (título curto, abas ao lado com
 *    AbasDaTela e a ação principal à direita);
 * 2. faixa fixa opcional: busca, filtros, contadores e avisos;
 * 3. área de dados: ocupa o resto (`flex-1 min-h-0`) e rola por dentro. Um
 *    filho com `h-full` ou `flex-1 min-h-0` (tabela, lista com rodapé) ocupa
 *    a área toda e cuida da própria rolagem;
 * 4. rodapé fixo opcional: total e paginação.
 *
 * No celular e no tablet (até 1023 px) a página volta a rolar normalmente,
 * na mesma ordem. A altura vem de duas variáveis do #main-tab-viewport
 * (index.css): --renea-topo (barra do topo) e --renea-respiro (recuo).
 *
 * Aba "longa" (painel de cartões, formulário): passe `longa` e a área de
 * conteúdo rola por dentro com o respiro entre os blocos, entra no Tab do
 * teclado e ganha nome para o leitor de tela.
 *
 * Subtela que é uma tela inteira (Viagens da jazida dentro de Materiais): a
 * TelaCheia de dentro percebe que está na área de dados de outra, ocupa só
 * essa área em vez de pedir a altura da janela, e o PageHeader dela vira h2
 * (um h1 só por página).
 */
const DentroDaTelaCheia = createContext(false);

/** true quando o componente está na área de dados de uma TelaCheia. */
export const useDentroDaTelaCheia = () => useContext(DentroDaTelaCheia);

interface TelaCheiaProps {
  /** id da aba (termina em "-tab", como as outras telas). */
  id: string;
  /** Nome da tela para o leitor de tela. */
  rotulo: string;
  /** O PageHeader da aba. */
  cabecalho?: ReactNode;
  /** Faixa fixa de busca, filtros, contadores e avisos. */
  faixa?: ReactNode;
  /** Rodapé fixo: total e paginação. */
  rodape?: ReactNode;
  children: ReactNode;
  /** Conteúdo empilhado (cartões, formulário) que rola dentro da área. */
  longa?: boolean;
  /** Nome da área de dados quando ela rola por dentro. Padrão: "Conteúdo de <rotulo>". */
  rotuloDados?: string;
  /** Quando muda (troca de subtela), a área de dados volta ao topo. */
  chaveRolagem?: string | number;
  /** id do botão da aba ativa (idDaAba): a área vira o painel dessa aba. */
  idAbaAtiva?: string;
  /** id da área de dados (para aria-controls das abas). */
  idDados?: string;
  className?: string;
  classeDados?: string;
  testId?: string;
  ref?: Ref<HTMLElement>;
}

export function TelaCheia({
  id, rotulo, cabecalho, faixa, rodape, children, longa = false, rotuloDados, chaveRolagem,
  idAbaAtiva, idDados, className, classeDados, testId, ref,
}: TelaCheiaProps) {
  const dadosRef = useRef<HTMLDivElement>(null);
  const embutida = useDentroDaTelaCheia();

  useEffect(() => {
    if (chaveRolagem === undefined) return;
    dadosRef.current?.scrollTo?.({ top: 0 });
  }, [chaveRolagem]);

  return (
    <section ref={ref} id={id} aria-label={rotulo} data-testid={testId} data-tela-cheia=""
      className={cn('renea-tela-cheia flex w-full min-w-0 max-w-none flex-col gap-2 lg:gap-3', embutida && 'renea-tela-cheia--embutida', className)}>
      {cabecalho && <div className="renea-tela-cheia__topo shrink-0">{cabecalho}</div>}
      {faixa && <div className="renea-tela-cheia__faixa shrink-0">{faixa}</div>}
      <div
        ref={dadosRef}
        id={idDados}
        role={idAbaAtiva ? 'tabpanel' : longa ? 'region' : undefined}
        aria-labelledby={idAbaAtiva}
        aria-label={idAbaAtiva ? undefined : longa ? rotuloDados ?? `Conteúdo de ${rotulo}` : undefined}
        tabIndex={longa ? 0 : undefined}
        className={cn('renea-tela-cheia__dados flex min-h-0 min-w-0 flex-1 flex-col', longa && 'renea-tela-cheia__dados--longa gap-4', classeDados)}
      >
        <DentroDaTelaCheia.Provider value>{children}</DentroDaTelaCheia.Provider>
      </div>
      {rodape && <div className="renea-tela-cheia__rodape shrink-0">{rodape}</div>}
    </section>
  );
}
