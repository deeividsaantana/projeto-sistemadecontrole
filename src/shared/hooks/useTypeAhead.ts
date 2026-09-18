import { useCallback, useEffect, useRef, useState } from 'react';

/** Janela entre duas teclas para elas contarem como a mesma busca. */
const TYPE_AHEAD_RESET_MS = 900;

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLocaleLowerCase('pt-BR');

export interface TypeAheadOptions<T> {
  /** Itens na mesma ordem em que aparecem na tela. */
  items: readonly T[];
  /** Texto pelo qual a pessoa procura — normalmente nome ou prefixo. */
  getLabel: (item: T) => string;
  /** Recebe o item alcançado e o índice dele na lista. */
  onMatch: (item: T, index: number) => void;
  /** Índice de onde continuar; permite pular entre itens de mesma inicial. */
  currentIndex?: number;
  enabled?: boolean;
}

/**
 * Busca por digitação em listas longas, como a de planilha: digitar "g" leva
 * ao primeiro nome com G, digitar de novo vai para o próximo, e teclas
 * seguidas dentro de ~1s formam um prefixo ("ge" → "Genivaldo").
 *
 * Só reage quando o foco não está em um campo de texto — senão roubaria as
 * teclas de quem está preenchendo um formulário.
 */
export function useTypeAhead<T>({
  items,
  getLabel,
  onMatch,
  currentIndex = -1,
  enabled = true,
}: TypeAheadOptions<T>) {
  const [buffer, setBuffer] = useState('');
  const bufferRef = useRef('');
  const timerRef = useRef<number | undefined>(undefined);
  // Guardadas em ref para o listener não precisar ser recriado a cada
  // renderização — em telas com centenas de linhas isso aparece no perfil.
  const itemsRef = useRef(items);
  const getLabelRef = useRef(getLabel);
  const onMatchRef = useRef(onMatch);
  const currentIndexRef = useRef(currentIndex);
  itemsRef.current = items;
  getLabelRef.current = getLabel;
  onMatchRef.current = onMatch;
  currentIndexRef.current = currentIndex;

  const clearBuffer = useCallback(() => {
    bufferRef.current = '';
    setBuffer('');
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      // Uma letra só: teclas como "Enter", "Tab" ou "ArrowDown" têm nome longo.
      if (event.key.length !== 1 || !/[\p{L}\p{N}]/u.test(event.key)) return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;

      const list = itemsRef.current;
      if (list.length === 0) return;

      const typed = normalize(bufferRef.current + event.key);
      const repeatedLetter = bufferRef.current.length === 1
        && normalize(bufferRef.current) === normalize(event.key);

      // Repetir a mesma letra percorre os itens daquela inicial em vez de
      // procurar por um prefixo duplicado ("gg"), que nunca existiria.
      const needle = repeatedLetter ? normalize(event.key) : typed;
      const startAt = repeatedLetter || bufferRef.current === ''
        ? currentIndexRef.current + 1
        : 0;

      const findFrom = (from: number) => {
        for (let offset = 0; offset < list.length; offset += 1) {
          const index = (from + offset) % list.length;
          if (normalize(getLabelRef.current(list[index])).startsWith(needle)) return index;
        }
        return -1;
      };

      const index = findFrom(Math.max(0, startAt));
      if (index === -1) return;

      event.preventDefault();
      bufferRef.current = repeatedLetter ? event.key : bufferRef.current + event.key;
      setBuffer(bufferRef.current);
      onMatchRef.current(list[index], index);

      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(clearBuffer, TYPE_AHEAD_RESET_MS);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(timerRef.current);
    };
  }, [enabled, clearBuffer]);

  return { buffer, clearBuffer };
}
