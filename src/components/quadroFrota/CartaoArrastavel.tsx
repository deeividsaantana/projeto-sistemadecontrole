/**
 * Envolve o CartaoEquipamento em drag do dnd-kit: segurar e arrastar solta em
 * cima de outro canteiro pra mudar o cartão de lugar, sem precisar abrir o
 * painel. Um clique normal (sem mover o suficiente) ainda abre o painel —
 * quem decide isso é o `activationConstraint` do sensor, lá no Quadro.
 */
import { useDraggable } from '@dnd-kit/core';
import { CartaoEquipamento } from './CartaoEquipamento';
import type { CartaoFrota } from '../../modules/frota/quadroFrota';

export function CartaoArrastavel({ cartao, podeArrastar, onAbrir }: { cartao: CartaoFrota; podeArrastar: boolean; onAbrir: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: cartao.equipamentoId,
    disabled: !podeArrastar,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 30 }
    : undefined;
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
