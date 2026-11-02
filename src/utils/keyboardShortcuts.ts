import type { ShortcutContext } from '../hooks/useKeyboardShortcuts';

/**
 * Mapeamento de atalhos padrão do sistema por contexto.
 * Cada contexto define seus próprios atalhos, que podem ser registrados
 * quando o componente da aba monta.
 */
export const KEYBOARD_SHORTCUTS_CONFIG: Record<ShortcutContext, Array<{ key: string; description: string }>> = {
  global: [
    { key: '?', description: 'Ajuda - Mostrar lista de atalhos' },
    { key: 'L', description: 'Log - Alternar visibilidade do log do sistema' },
  ],
  frotas: [
    { key: '/', description: 'Buscar - Abre a barra de busca da frota' },
    { key: '?', description: 'Ajuda - Mostrar atalhos da frota' },
    { key: 'A', description: 'Adicionar - Nova viagem' },
    { key: 'V', description: 'Visualizar - Detalhes do veículo selecionado' },
    { key: '1', description: 'Painel 1 - Vista rápida' },
    { key: '2', description: 'Painel 2 - Manutenção' },
    { key: '3', description: 'Painel 3 - Combustível' },
    { key: '4', description: 'Painel 4 - Documentos' },
  ],
  presenca: [
    { key: '/', description: 'Buscar - Abre a barra de busca de presença' },
    { key: '?', description: 'Ajuda - Mostrar atalhos de presença' },
    { key: 'A', description: 'Adicionar - Novo lançamento' },
  ],
  relatorios: [
    { key: '/', description: 'Buscar - Abre a barra de busca de relatórios' },
    { key: '?', description: 'Ajuda - Mostrar atalhos de relatórios' },
    { key: 'A', description: 'Atualizar - Recarregar dados' },
  ],
};

/**
 * Retorna a descrição de um atalho específico, se existir.
 */
export const getShortcutDescription = (key: string, context: ShortcutContext): string | undefined => {
  return KEYBOARD_SHORTCUTS_CONFIG[context]?.find((s) => s.key === key)?.description;
};

/**
 * Retorna todos os atalhos disponíveis para um contexto, incluindo globais.
 */
export const getAvailableShortcuts = (context: ShortcutContext) => {
  const contextShortcuts = KEYBOARD_SHORTCUTS_CONFIG[context] || [];
  const globalShortcuts = KEYBOARD_SHORTCUTS_CONFIG.global || [];
  return [...contextShortcuts, ...globalShortcuts];
};
