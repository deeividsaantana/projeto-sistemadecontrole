/**
 * Envolve a ficha da máquina em drag do dnd-kit. A ficha continua sendo o
 * botão que abre o lançamento; o arrastar mora numa alça separada à direita
 * (A12 da auditoria de 21/10/2026: botão dentro de botão confunde o leitor de
 * tela e o teclado). A alça funciona com mouse, com o dedo (sem rolar a tela
 * junto) e com o teclado: Espaço pega, setas trocam de canteiro, Espaço solta.
 *
 * No modo de seleção o arrastar fica desligado: tocar na ficha marca ou
 * desmarca, para mover/excluir várias máquinas de uma vez pela barra de ações.
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

/**
 * A ficha que está sendo arrastada é a própria que segue o dedo: em vez de
 * apagada, ela "levanta" (maior, inclinada, com sombra e contorno verde) para
 * ficar claro o que está na mão. Quem pede menos movimento não vê a inclinação.
 */
export const ARRASTANDO = 'scale-[1.04] rotate-[1.5deg] motion-reduce:rotate-0 cursor-grabbing shadow-[0_24px_40px_-18px_rgba(15,40,31,0.5)] ring-2 ring-emerald-400';

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
      <div data-testid={`quadro-arrastar-${cartao.prefixo}`} className="relative">
        <CartaoEquipamento cartao={cartao} onAbrir={onAlternarSelecao ?? onAbrir} selecionado={selecionado} />
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute right-2 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full ring-2 transition ${selecionado ? 'bg-[#176b4d] text-white ring-[#176b4d]' : 'bg-white ring-slate-300'}`}
        >
          {selecionado && <Check className="size-3" />}
        </span>
      </div>
    );
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-lg transition-[scale,rotate,box-shadow] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${isDragging ? ARRASTANDO : ''}`}
      data-arrastando={isDragging || undefined}
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
          className={`absolute inset-y-0 right-0 grid w-7 cursor-grab touch-none place-items-center rounded-r-lg text-slate-500 transition hover:bg-emerald-50 hover:text-[#176b4d] active:cursor-grabbing ${FOCO}`}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
