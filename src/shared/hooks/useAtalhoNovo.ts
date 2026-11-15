import { useEffect, useRef } from 'react';

/**
 * Tecla N abre um lançamento novo (padrão de 15/11/2026, igual em todas as
 * abas que lançam). Não age enquanto a pessoa digita num campo, com Ctrl,
 * Alt ou Cmd apertado, nem com um diálogo ou lançamento já aberto.
 */
export function useAtalhoNovo(abrir: () => void, ativo = true) {
  const acao = useRef(abrir);
  acao.current = abrir;

  useEffect(() => {
    if (!ativo) return undefined;
    const teclar = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'n' || event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.defaultPrevented) return;
      const alvo = event.target as HTMLElement | null;
      if (alvo?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [data-lancamento]')) return;
      event.preventDefault();
      acao.current();
    };
    document.addEventListener('keydown', teclar);
    return () => document.removeEventListener('keydown', teclar);
  }, [ativo]);
}
