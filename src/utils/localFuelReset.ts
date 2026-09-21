/**
 * Zeragem única de abastecimentos locais na primeira execução desta versão.
 * Limpa somente o armazenamento local, nunca toca na nuvem.
 */

export const LOCAL_FUEL_RESET_STORAGE_KEY = 'renea_local_fuel_reset_version';
export const LOCAL_FUEL_RESET_VERSION = '2026-09-21';

/**
 * Verifica se a zeragem de combustível local deve acontecer nesta execução.
 * Compara a versão armazenada com a versão atual.
 */
export const shouldResetLocalFuel = (storedVersion?: string | null): boolean => {
  return storedVersion !== LOCAL_FUEL_RESET_VERSION;
};

/**
 * Executa a zeragem local de abastecimentos de forma segura.
 * Apenas manipula localStorage, nunca toca em dados da nuvem.
 */
export const performLocalFuelReset = () => {
  try {
    // Zera a lista de abastecimentos locais
    localStorage.setItem('renea_abastecimentos', JSON.stringify([]));
    // Registra que esta versão já foi processada
    localStorage.setItem('renea_local_fuel_reset_version', LOCAL_FUEL_RESET_VERSION);
  } catch (error) {
    // Falha silenciosa - preferência de layout não quebra a navegação
    console.warn('Não foi possível resetar combustível local:', error);
  }
};
