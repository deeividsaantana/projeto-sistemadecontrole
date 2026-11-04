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
      className={`grid gap-2 p-2 transition duration-200 sm:gap-2.5 sm:p-2.5 md:gap-3 md:p-3 [grid-template-columns:repeat(auto-fill,minmax(9rem,1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(10.5rem,1fr))] lg:[grid-template-columns:repeat(auto-fill,minmax(12rem,1fr))] ${isOver ? 'rounded-2xl bg-emerald-50 ring-2 ring-inset ring-[#176b4d]' : ''}`}
    >
      {children}
    </div>
  );
}
