import type { TicketJazida } from '../types';

/**
 * Lista de materiais oferecida no lançamento: os padrões do sistema mais tudo
 * que a operação já usou, inclusive o que foi digitado em "Outros". Assim o
 * material novo entra na lista sem depender de alterar o código.
 */
export const listarMateriais = (
  padroes: readonly string[],
  tickets: Array<Pick<TicketJazida, 'tipoMaterial' | 'materialOutro'>>,
): string[] => {
  const usados = tickets
    .flatMap(item => [item.tipoMaterial, item.materialOutro])
    .map(item => String(item || '').trim())
    .filter(item => item && item !== 'Outros');
  // "Outros" fica sempre por último: é a porta de entrada do material novo.
  return [...new Set([...padroes.filter(item => item !== 'Outros'), ...usados, 'Outros'])];
};
