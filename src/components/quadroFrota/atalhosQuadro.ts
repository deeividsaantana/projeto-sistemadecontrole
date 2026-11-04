/**
 * Atalhos do Quadro de Frotas no registro global de teclas (contexto "frotas").
 * O quadro registra uma vez ao abrir e liga/desliga com useKeyboardShortcuts;
 * cada tecla lê as ações da hora por `obter`, para nunca usar filtro ou vista
 * de uma tela que já mudou.
 */
import { registerShortcut } from '../../hooks/useKeyboardShortcuts';
import type { GrupoStatus } from '../../modules/frota/quadroFrota';

export interface AcoesAtalhoQuadro {
  focarBusca: () => void;
  abrirAjuda: () => void;
  /** Só faz algo para quem pode lançar. */
  atualizarPendentes: () => void;
  /** Só faz algo para quem pode lançar. */
  alternarVista: () => void;
  /** Liga o filtro da situação; a mesma tecla de novo desliga. */
  alternarGrupo: (grupo: GrupoStatus) => void;
  limparFiltros: () => void;
}

export const GRUPO_DA_TECLA: Readonly<Record<string, GrupoStatus>> = { 1: 'operando', 2: 'manutencao', 3: 'parado', 4: 'sem-lancamento' };

export function registrarAtalhosDoQuadro(obter: () => AcoesAtalhoQuadro): void {
  registerShortcut('/', () => obter().focarBusca(), 'frotas', 'Buscar máquina');
  registerShortcut('?', () => obter().abrirAjuda(), 'frotas', 'Mostrar os atalhos');
  registerShortcut('a', () => obter().atualizarPendentes(), 'frotas', 'Atualizar as máquinas sem lançamento');
  registerShortcut('v', () => obter().alternarVista(), 'frotas', 'Trocar entre o quadro e a lista de lançamento');
  Object.entries(GRUPO_DA_TECLA).forEach(([tecla, grupo]) => {
    registerShortcut(tecla, () => obter().alternarGrupo(grupo), 'frotas', `Filtrar situação ${tecla}`);
  });
  registerShortcut('l', () => obter().limparFiltros(), 'frotas', 'Limpar os filtros');
}
