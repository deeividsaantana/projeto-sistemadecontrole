/**
 * RATE LIMITING UTILITY
 * 
 * Previne spam de cliques/submits protegendo contra:
 * - Ataques de negação de serviço (DoS)
 * - Duplicação de registros (double-submit)
 * - Sobrecarga de API/banco de dados
 * 
 * USO:
 * ```tsx
 * import { useRateLimit } from '@/utils/rateLimit';
 * 
 * function MyComponent() {
 *   const { canExecute, execute } = useRateLimit('my-action', 3000); // 3s cooldown
 *   
 *   const handleSave = execute(async () => {
 *     await saveData();
 *   });
 *   
 *   return (
 *     <button onClick={handleSave} disabled={!canExecute}>
 *       Salvar
 *     </button>
 *   );
 * }
 * ```
 */

import { useState, useCallback, useRef } from 'react';
import type { ComponentType } from 'react';

/**
 * Mapa global de cooldowns (compartilhado entre componentes)
 * Chave: actionId, Valor: timestamp do último exec
 */
const globalCooldowns = new Map<string, number>();

/**
 * Hook de rate limiting por ação
 * @param actionId Identificador único da ação (ex: 'save-equipe', 'delete-colaborador')
 * @param cooldownMs Tempo de cooldown em milissegundos (padrão: 3000ms = 3s)
 */
export function useRateLimit(actionId: string, cooldownMs: number = 3000) {
  const [canExecute, setCanExecute] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  /**
   * Wrapper que aplica rate limiting à função fornecida
   */
  const execute = useCallback(<T extends (...args: any[]) => any>(fn: T) => {
    return ((...args: Parameters<T>) => {
      const now = Date.now();
      const lastExec = globalCooldowns.get(actionId) || 0;
      const timeSinceLastExec = now - lastExec;
      
      // Verificar se ainda está em cooldown
      if (timeSinceLastExec < cooldownMs) {
        const remainingMs = cooldownMs - timeSinceLastExec;
        console.warn(
          `[RATE LIMIT] Ação "${actionId}" bloqueada. Aguarde ${Math.ceil(remainingMs / 1000)}s`
        );
        return;
      }
      
      // Registrar execução
      globalCooldowns.set(actionId, now);
      setCanExecute(false);
      
      // Executar função
      try {
        fn(...args);
      } catch (error) {
        console.error(`[RATE LIMIT] Erro ao executar "${actionId}":`, error);
      }
      
      // Resetar cooldown
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        setCanExecute(true);
      }, cooldownMs);
    }) as T;
  }, [actionId, cooldownMs]);
  
  return { canExecute, execute };
}

/**
 * Classe para rate limiting global (sem React hooks)
 * Útil para utilitários standalone
 */
export class GlobalRateLimiter {
  private cooldowns = new Map<string, number>();
  
  /**
   * Verifica se ação pode ser executada
   */
  canExecute(actionId: string, cooldownMs: number = 3000): boolean {
    const now = Date.now();
    const lastExec = this.cooldowns.get(actionId) || 0;
    const timeSinceLastExec = now - lastExec;
    
    if (timeSinceLastExec < cooldownMs) {
      const remainingMs = cooldownMs - timeSinceLastExec;
      console.warn(
        `[RATE LIMIT] Ação "${actionId}" bloqueada. Aguarde ${Math.ceil(remainingMs / 1000)}s`
      );
      return false;
    }
    
    return true;
  }
  
  /**
   * Executa ação com rate limiting
   */
  execute<T>(
    actionId: string,
    fn: () => T,
    cooldownMs: number = 3000
  ): T | undefined {
    if (!this.canExecute(actionId, cooldownMs)) {
      return undefined;
    }
    
    const now = Date.now();
    this.cooldowns.set(actionId, now);
    
    try {
      return fn();
    } catch (error) {
      console.error(`[RATE LIMIT] Erro ao executar "${actionId}":`, error);
      return undefined;
    }
  }
  
  /**
   * Limpa todos os cooldowns (útil para testes)
   */
  reset() {
    this.cooldowns.clear();
  }
}

/**
 * Instância global singleton
 */
export const rateLimiter = new GlobalRateLimiter();

/**
 * Decorator para rate limiting em funções assíncronas
 * Uso: @rateLimit('my-action', 5000)
 * 
 * ⚠️ EXPERIMENTAL: decorators requerem configuração TypeScript
 */
export function rateLimit(actionId: string, cooldownMs: number = 3000) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (...args: any[]) {
      if (!rateLimiter.canExecute(actionId, cooldownMs)) {
        return;
      }
      
      const now = Date.now();
      globalCooldowns.set(actionId, now);
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

/**
 * HOC para aplicar rate limiting a um componente
 * (especialmente útil para forms)
 * 
 * @experimental - Requer configuração adicional de JSX
 * Comentado temporariamente - use useRateLimit() diretamente
 */
/*
export function withRateLimit<P extends object>(
  Component: ComponentType<P>,
  actionId: string,
  cooldownMs: number = 3000
) {
  return function RateLimitedComponent(props: P) {
    const { canExecute } = useRateLimit(actionId, cooldownMs);
    
    return (
      <div className={canExecute ? '' : 'pointer-events-none opacity-50'}>
        <Component {...props} />
      </div>
    );
  };
}
*/
