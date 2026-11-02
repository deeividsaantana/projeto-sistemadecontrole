import { useEffect } from 'react';

export type ShortcutContext = 'frotas' | 'presenca' | 'relatorios' | 'global';
export type ShortcutCallback = (event: KeyboardEvent) => void;

export interface Shortcut {
  key: string;
  description: string;
  callback: ShortcutCallback;
  context: ShortcutContext;
  conflictsWith?: string[];
}

// Registro centralizado de atalhos do teclado
const shortcuts = new Map<string, Shortcut>();

/**
 * Registra um atalho de teclado no sistema global.
 * O atalho é armazenado com uma chave composta por contexto:tecla para evitar conflitos.
 */
export const registerShortcut = (
  key: string,
  callback: ShortcutCallback,
  context: ShortcutContext,
  description: string,
): void => {
  const registryKey = `${context}:${key}`;
  shortcuts.set(registryKey, {
    key,
    callback,
    context,
    description,
  });
};

/**
 * Retorna todos os atalhos disponíveis para um contexto específico.
 * Inclui atalhos globais que estão disponíveis em qualquer contexto.
 */
export const getShortcutsForContext = (context: ShortcutContext): Shortcut[] => {
  return Array.from(shortcuts.values()).filter(
    (shortcut) => shortcut.context === context || shortcut.context === 'global'
  );
};

/**
 * Limpa todos os atalhos registrados. Útil para testes.
 */
export const clearAllShortcuts = (): void => {
  shortcuts.clear();
};

/**
 * Hook que habilita o tratamento de atalhos de teclado para um contexto específico.
 * Ignora pressionamentos enquanto o usuário está digitando em inputs ou textareas.
 */
export const useKeyboardShortcuts = (
  context: ShortcutContext,
  enabled: boolean = true,
): void => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignora se estiver digitando em input/textarea
      const target = event.target as HTMLElement;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        (target instanceof HTMLElement && target.contentEditable === 'true')
      ) {
        return;
      }

      // Verifica se há shortcut registrado para este contexto
      for (const shortcut of shortcuts.values()) {
        if (
          (shortcut.context === context || shortcut.context === 'global') &&
          (shortcut.key === event.key || shortcut.key === event.code)
        ) {
          shortcut.callback(event);
          event.preventDefault();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [context, enabled]);
};
