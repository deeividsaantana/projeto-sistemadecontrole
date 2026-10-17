import type { AssinaturasNuvem } from './mudancasNuvem';

/**
 * As assinaturas da última versão conhecida da nuvem ficam no IndexedDB: no
 * armazenamento comum do navegador não cabem (são ~1 MB e ele já está cheio).
 * Sem elas o envio volta a ser o inteiro, então qualquer falha aqui só
 * significa um envio maior, nunca dado perdido.
 */

const DB_NAME = 'renea-nuvem';
const STORE_NAME = 'assinaturas';

let emMemoria: { chave: string; valor: AssinaturasNuvem | null } | null = null;

const abrir = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Falha ao abrir as assinaturas da nuvem.'));
});

const temIndexedDb = () => typeof indexedDB !== 'undefined';

export const lerAssinaturas = async (chave: string): Promise<AssinaturasNuvem | null> => {
  if (emMemoria?.chave === chave) return emMemoria.valor;
  if (!temIndexedDb()) return null;
  try {
    const db = await abrir();
    const valor = await new Promise<AssinaturasNuvem | null>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(chave);
      request.onsuccess = () => resolve((request.result as AssinaturasNuvem | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    emMemoria = { chave, valor };
    return valor;
  } catch (error) {
    console.warn('Assinaturas da nuvem indisponíveis; o próximo envio vai inteiro:', error);
    return null;
  }
};

export const guardarAssinaturas = async (chave: string, valor: AssinaturasNuvem | null): Promise<void> => {
  emMemoria = { chave, valor };
  if (!temIndexedDb()) return;
  try {
    const db = await abrir();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      if (valor) tx.objectStore(STORE_NAME).put(valor, chave);
      else tx.objectStore(STORE_NAME).delete(chave);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (error) {
    console.warn('Não foi possível guardar as assinaturas da nuvem:', error);
  }
};
