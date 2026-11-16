/**
 * Linha de um canteiro no quadro, onde uma ficha arrastada pode ser solta pra
 * mudar de canteiro. Só marca a borda quando alguém está arrastando por cima.
 */
import type { CSSProperties, ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';

export function ColunaCanteiro({ canteiro, className = '', style, children }: { canteiro: string; className?: string; style?: CSSProperties; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: canteiro });
  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`quadro-solte-${canteiro}`}
      className={`${className} transition duration-200 ${isOver ? 'bg-emerald-50 ring-2 ring-inset ring-[#176b4d]' : ''}`}
    >
      {children}
    </div>
  );
}
