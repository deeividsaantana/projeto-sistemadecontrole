import { useEffect, useMemo, useState } from 'react';

/**
 * Paginação de lista já filtrada. Renderizar mil linhas de uma vez trava o
 * celular do campo; a lista continua inteira em memória, só o desenho é fatiado.
 * A página volta para 1 sempre que o total muda, senão o usuário filtra e cai
 * numa página vazia.
 */
export const usePaginacao = <T,>(itens: T[], porPagina = 25) => {
  const [pagina, setPagina] = useState(1);
  const totalPaginas = Math.max(1, Math.ceil(itens.length / porPagina));

  useEffect(() => {
    setPagina(1);
  }, [itens.length]);

  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = useMemo(
    () => itens.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina),
    [itens, paginaAtual, porPagina],
  );

  return { visiveis, pagina: paginaAtual, totalPaginas, setPagina, total: itens.length };
};
