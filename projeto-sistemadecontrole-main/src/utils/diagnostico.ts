import { CORE_DATA_STORAGE_KEYS, STORAGE_KEYS } from '../data/storageKeys';
import { SYSTEM_BACKUP_ARRAY_KEYS } from './systemBackup';

/** Estado do próprio navegador: não vai para nuvem nem para o backup. */
export const CHAVES_LOCAIS: string[] = [
  STORAGE_KEYS.dataLoadedV2,
  STORAGE_KEYS.notifications,
];

/**
 * Fila de revisão de cadastro: é trabalho em andamento do dispositivo, entra no
 * backup manual mas não sincroniza — sincronizar faria a fila de um revisor
 * aparecer no computador de outro no meio da revisão.
 */
export const CHAVES_SEM_NUVEM: string[] = [
  STORAGE_KEYS.masterDataReviewQueue,
];

const nomeDaColecao = (chave: string) =>
  (Object.entries(STORAGE_KEYS).find(([, valor]) => valor === chave)?.[0]) || chave;

export interface DivergenciaColecao {
  colecao: string;
  chave: string;
  problema: string;
}

/**
 * Uma coleção nova precisa ser registrada em vários lugares (chave, persistência
 * local, sincronização e backup). Esta função compara essas listas e aponta o
 * que ficou de fora — é a rede de proteção contra "salvei, mas não sincronizou".
 */
export const divergenciasDeRegistro = (
  colecoesNuvem: readonly string[],
): DivergenciaColecao[] => {
  const backup = new Set<string>(SYSTEM_BACKUP_ARRAY_KEYS as readonly string[]);
  const nuvem = new Set(colecoesNuvem);
  return CORE_DATA_STORAGE_KEYS
    .filter(chave => !CHAVES_LOCAIS.includes(chave))
    .flatMap(chave => {
      const colecao = nomeDaColecao(chave);
      const problemas: DivergenciaColecao[] = [];
      if (!backup.has(colecao)) problemas.push({ colecao, chave, problema: 'fora do backup do sistema' });
      if (!nuvem.has(colecao) && !CHAVES_SEM_NUVEM.includes(chave)) {
        problemas.push({ colecao, chave, problema: 'fora da sincronização com a nuvem' });
      }
      return problemas;
    });
};

export interface VolumeColecao {
  colecao: string;
  chave: string;
  registros: number;
  bytes: number;
}

const tamanhoEmBytes = (valor: string) => new TextEncoder().encode(valor).length;

/** Volume por coleção, para ver o que está pesando no armazenamento local. */
export const volumePorColecao = (storage: Pick<Storage, 'getItem'>): VolumeColecao[] =>
  CORE_DATA_STORAGE_KEYS.map(chave => {
    const bruto = storage.getItem(chave) || '';
    let registros = 0;
    try {
      const dados = bruto ? JSON.parse(bruto) : [];
      registros = Array.isArray(dados) ? dados.length : Object.keys(dados || {}).length;
    } catch {
      registros = 0;
    }
    return { colecao: nomeDaColecao(chave), chave, registros, bytes: tamanhoEmBytes(bruto) };
  }).sort((a, b) => b.bytes - a.bytes);

export const resumoArmazenamento = (volumes: VolumeColecao[]) => ({
  colecoes: volumes.length,
  registros: volumes.reduce((total, item) => total + item.registros, 0),
  bytes: volumes.reduce((total, item) => total + item.bytes, 0),
  vazias: volumes.filter(item => item.registros === 0).length,
});

export const formatarBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
