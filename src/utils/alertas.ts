import { listarPendencias, type ContextoPendencias } from './pendencias';

export interface Alerta {
  id: string;
  titulo: string;
  mensagem: string;
  /** Tela onde o alerta se resolve. */
  tab: string;
  quantidade: number;
}

/**
 * Alerta é a pendência que não pode esperar: só gravidade alta entra no sino.
 * É derivado na hora, então nunca há alerta salvo apontando para algo já
 * resolvido — e o critério é o mesmo da tela de Pendências, não um segundo.
 */
export const alertasDoSistema = (contexto: ContextoPendencias): Alerta[] =>
  listarPendencias(contexto)
    .filter(item => item.gravidade === 'alta')
    .map(item => ({
      id: item.id,
      titulo: item.categoria,
      mensagem: `${item.quantidade} ${item.titulo.toLowerCase()}`,
      tab: item.tab,
      quantidade: item.quantidade,
    }));
