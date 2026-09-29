/**
 * Área onde os cartões de um canteiro entram, e onde um cartão arrastado
 * pode ser solto pra mudar de canteiro. Só marca a borda quando alguém está
 * arrastando um cartão por cima.
 */
import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';

export function ColunaCanteiro({ canteiro, children }: { canteiro: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: canteiro });
  return (
    <div
      ref={setNodeRef}
      data-testid={`quadro-solte-${canteiro}`}
      className={`grid gap-2 p-2 transition duration-200 [grid-template-columns:repeat(auto-fill,minmax(8.5rem,1fr))] ${isOver ? 'rounded-xl bg-emerald-50 ring-2 ring-inset ring-[#176b4d]' : ''}`}
    >
      {children}
    </div>
  );
}
