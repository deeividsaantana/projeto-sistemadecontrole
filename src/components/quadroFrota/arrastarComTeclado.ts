/**
 * Arrastar o cartão do Quadro pelo teclado (auditoria de front 21/10/2026,
 * A12). A alça do cartão pega com Espaço ou Enter; as setas pulam de canteiro
 * em canteiro (em vez de andar 25 px por vez, como o padrão do dnd-kit) e
 * Espaço/Enter solta, Esc desiste. O leitor de tela ouve tudo em português.
 */
import type { Announcements, KeyboardCoordinateGetter, ScreenReaderInstructions, UniqueIdentifier } from '@dnd-kit/core';

const PASSO: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

/** Recuo dentro do canteiro de destino: o cartão fica inteiro por cima dele. */
const RECUO = 12;

export const coordenadasDoCanteiro: KeyboardCoordinateGetter = (evento, { context, currentCoordinates }) => {
  const passo = PASSO[evento.code];
  if (!passo) return undefined;
  evento.preventDefault();
  const canteiros = context.droppableContainers.getEnabled()
    .map(container => ({ id: container.id, caixa: context.droppableRects.get(container.id) }))
    .filter((item): item is { id: UniqueIdentifier; caixa: NonNullable<typeof item.caixa> } => Boolean(item.caixa))
    .sort((a, b) => a.caixa.top - b.caixa.top || a.caixa.left - b.caixa.left);
  if (!canteiros.length) return undefined;
  const atual = canteiros.findIndex(item => item.id === context.over?.id);
  const destino = canteiros[Math.min(canteiros.length - 1, Math.max(0, atual < 0 ? (passo > 0 ? 0 : canteiros.length - 1) : atual + passo))];
  if (!destino || destino.id === context.over?.id) return currentCoordinates;
  return { x: destino.caixa.left + RECUO, y: destino.caixa.top + RECUO };
};

export const INSTRUCOES_ARRASTAR: ScreenReaderInstructions = {
  draggable: 'Para mudar a máquina de canteiro: aperte Espaço para pegar, as setas para escolher o canteiro, Espaço de novo para soltar ou Esc para desistir.',
};

/** Avisos do arrastar para o leitor de tela; `nome` traduz o id em prefixo. */
export const avisosDoArrastar = (nome: (id: UniqueIdentifier) => string): Announcements => ({
  onDragStart: ({ active }) => `${nome(active.id)} pega. Use as setas para escolher o canteiro.`,
  onDragOver: ({ active, over }) => (over ? `${nome(active.id)} sobre o canteiro ${over.id}.` : `${nome(active.id)} fora dos canteiros.`),
  onDragEnd: ({ active, over }) => (over ? `${nome(active.id)} solta no canteiro ${over.id}.` : `${nome(active.id)} solta fora dos canteiros; nada mudou.`),
  onDragCancel: ({ active }) => `Arrastar cancelado. ${nome(active.id)} ficou onde estava.`,
});
