/**
 * Envolve o CartaoEquipamento em drag do dnd-kit. O cartão continua sendo o
 * botão que abre o painel; o arrastar mora numa alça separada no canto (A12
 * da auditoria de 21/10/2026: botão dentro de botão confunde o leitor de tela
 * e o teclado). A alça funciona com mouse, com o dedo (sem rolar a tela junto)
 * e com o teclado: Espaço pega, setas trocam de canteiro, Espaço solta.
 *
 * No modo de seleção o arrastar fica desligado: tocar no cartão (ou na caixa)
 * marca ou desmarca, para mover/excluir várias máquinas de uma vez pela barra
 * de ações, sem precisar arrastar uma por uma.
 */
import { useDraggable } from '@dnd-kit/core';
import { Check, GripVertical } from 'lucide-react';
import { CartaoEquipamento } from './CartaoEquipamento';
import type { CartaoFrota } from '../../modules/frota/quadroFrota';
import { FOCO } from '../cadastros/estilos';

interface Props {
  cartao: CartaoFrota;
  podeArrastar: boolean;
  onAbrir: () => void;
  modoSelecao?: boolean;
  selecionado?: boolean;
  onAlternarSelecao?: () => void;
}

export function CartaoArrastavel({ cartao, podeArrastar, onAbrir, modoSelecao, selecionado, onAlternarSelecao }: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: cartao.equipamentoId,
    disabled: !podeArrastar || modoSelecao,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 30 }
    : undefined;
  if (modoSelecao) {
    return (
      <div style={style} data-testid={`quadro-arrastar-${cartao.prefixo}`} className="relative">
        <button
          type="button"
          onClick={onAlternarSelecao}
          aria-pressed={selecionado}
          aria-label={`Selecionar ${cartao.prefixo}`}
          data-testid={`quadro-selecionar-${cartao.prefixo}`}
          className={`absolute right-1 top-1 z-10 grid size-11 place-items-center rounded-full lg:size-7 ${FOCO}`}
        >
          <span className={`grid size-6 place-items-center rounded-full ring-2 ring-white transition ${selecionado ? 'bg-[#176b4d] text-white' : 'bg-white/90 text-slate-400'}`}>
            {selecionado && <Check className="size-3.5" aria-hidden="true" />}
          </span>
        </button>
        <div className={`rounded-xl transition ${selecionado ? 'outline outline-2 outline-offset-1 outline-[#176b4d]' : ''}`}>
          <CartaoEquipamento cartao={cartao} onAbrir={onAlternarSelecao ?? onAbrir} />
        </div>
      </div>
    );
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isDragging ? 'opacity-40' : ''}`}
      data-testid={`quadro-arrastar-${cartao.prefixo}`}
    >
      <CartaoEquipamento cartao={cartao} onAbrir={onAbrir} />
      {podeArrastar && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Arrastar ${cartao.prefixo} para outro canteiro`}
          title="Segure e arraste para outro canteiro"
          data-testid={`quadro-alca-${cartao.prefixo}`}
          className={`absolute right-1 top-1 z-10 grid size-11 cursor-grab touch-none place-items-center rounded-lg bg-white/85 text-slate-500 ring-1 ring-slate-200 transition hover:bg-white hover:text-[#176b4d] hover:ring-emerald-300 active:cursor-grabbing lg:size-7 ${FOCO}`}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
