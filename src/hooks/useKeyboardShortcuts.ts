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

type TeclaPressionada = Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'target'>;

const CAMPOS_DE_DIGITAR = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Acha o atalho do contexto para a tecla. Não dispara enquanto a pessoa digita
 * num campo (inclusive lista de opções) nem com Ctrl/Cmd/Alt: Ctrl+V continua
 * sendo colar, Ctrl+A continua selecionando tudo. "a" e "A" valem igual, para
 * o Caps Lock ligado não desligar os atalhos.
 */
export const findShortcut = (event: TeclaPressionada, context: ShortcutContext): Shortcut | undefined => {
  if (event.ctrlKey || event.metaKey || event.altKey) return undefined;
  const target = event.target as { tagName?: string; isContentEditable?: boolean } | null;
  if ((target?.tagName && CAMPOS_DE_DIGITAR.has(target.tagName)) || target?.isContentEditable) return undefined;
  const tecla = event.key.toLocaleLowerCase('pt-BR');
  for (const shortcut of shortcuts.values()) {
    if (shortcut.context !== context && shortcut.context !== 'global') continue;
    if (shortcut.key.toLocaleLowerCase('pt-BR') === tecla || shortcut.key === event.code) return shortcut;
  }
  return undefined;
};

/**
 * Hook que habilita o tratamento de atalhos de teclado para um contexto específico.
 * Ignora pressionamentos enquanto o usuário está digitando em campos.
 */
export const useKeyboardShortcuts = (
  context: ShortcutContext,
  enabled: boolean = true,
): void => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const shortcut = findShortcut(event, context);
      if (!shortcut) return;
      event.preventDefault();
      shortcut.callback(event);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [context, enabled]);
};
