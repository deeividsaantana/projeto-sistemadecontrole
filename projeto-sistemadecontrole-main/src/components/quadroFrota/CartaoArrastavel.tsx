/**
 * Envolve o CartaoEquipamento em drag do dnd-kit: segurar e arrastar solta em
 * cima de outro canteiro pra mudar o cartão de lugar, sem precisar abrir o
 * painel. Um clique normal (sem mover o suficiente) ainda abre o painel —
 * quem decide isso é o `activationConstraint` do sensor, lá no Quadro.
 *
 * No modo de seleção o arrastar fica desligado: tocar no cartão (ou na caixa)
 * marca ou desmarca, para mover/excluir várias máquinas de uma vez pela barra
 * de ações, sem precisar arrastar uma por uma.
 */
import { useDraggable } from '@dnd-kit/core';
import { Check } from 'lucide-react';
import { CartaoEquipamento } from './CartaoEquipamento';
import type { CartaoFrota } from '../../modules/frota/quadroFrota';

interface Props {
  cartao: CartaoFrota;
  podeArrastar: boolean;
  onAbrir: () => void;
  modoSelecao?: boolean;
  selecionado?: boolean;
  onAlternarSelecao?: () => void;
}

export function CartaoArrastavel({ cartao, podeArrastar, onAbrir, modoSelecao, selecionado, onAlternarSelecao }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
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
          data-testid={`quadro-selecionar-${cartao.prefixo}`}
          className={`absolute right-1.5 top-1.5 z-10 grid size-6 place-items-center rounded-full ring-2 ring-white transition ${selecionado ? 'bg-[#176b4d] text-white' : 'bg-white/90 text-slate-400'}`}
        >
          {selecionado && <Check className="size-3.5" aria-hidden="true" />}
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
      {...(podeArrastar ? attributes : {})}
      {...(podeArrastar ? listeners : {})}
      className={isDragging ? 'opacity-40' : undefined}
      data-testid={`quadro-arrastar-${cartao.prefixo}`}
    >
      <CartaoEquipamento cartao={cartao} onAbrir={onAbrir} />
    </div>
  );
}
