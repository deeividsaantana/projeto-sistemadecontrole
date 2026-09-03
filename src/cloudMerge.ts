// Mesclagem usada quando o envio para a nuvem encontra um conflito de versão:
// outro usuário publicou entre a leitura do manifesto e a confirmação. Antes
// disso o envio inteiro era descartado em silêncio, e o trabalho de quem
// perdia a corrida nunca chegava ao Firebase.
//
// Regras, nesta ordem:
// 1. Registro que existe só de um lado é sempre preservado. É isso que impede
//    perda de dados — os lançamentos novos de cada usuário sobrevivem.
// 2. Registro que existe dos dois lados fica com a versão de data mais recente
//    (atualizadoEm/updatedAt).
// 3. Sem data comparável dos dois lados, prevalece o que já está publicado na
//    nuvem, para não sobrescrever o trabalho alheio com uma cópia velha.

type CloudRecord = Record<string, unknown>;
export type CloudSnapshot = Record<string, unknown>;

const TIMESTAMP_FIELDS = ['atualizadoEm', 'updatedAt'] as const;

const recordId = (item: unknown): string => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return '';
  const id = (item as CloudRecord).id;
  return typeof id === 'string' && id ? id : '';
};

const recordTime = (item: unknown): number => {
  if (!item || typeof item !== 'object') return Number.NaN;
  for (const field of TIMESTAMP_FIELDS) {
    const value = (item as CloudRecord)[field];
    if (typeof value !== 'string' || !value) continue;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Number.NaN;
};

// Entre duas versões do mesmo registro, devolve a que deve permanecer.
const pickNewer = (remote: unknown, local: unknown): unknown => {
  const remoteTime = recordTime(remote);
  const localTime = recordTime(local);
  if (Number.isFinite(remoteTime) && Number.isFinite(localTime)) {
    return localTime > remoteTime ? local : remote;
  }
  // Só um dos lados tem data confiável: essa versão é a que se pode datar.
  if (Number.isFinite(localTime)) return local;
  if (Number.isFinite(remoteTime)) return remote;
  return remote;
};

export const mergeCloudTable = (remoteItems: unknown[], localItems: unknown[]): unknown[] => {
  const merged: unknown[] = [];
  const indexById = new Map<string, number>();
  const seenWithoutId = new Set<string>();

  const absorb = (item: unknown, isLocal: boolean) => {
    const id = recordId(item);
    if (!id) {
      // Sem id não há como parear: preserva os dois lados sem duplicar
      // registros idênticos.
      const fingerprint = JSON.stringify(item);
      if (seenWithoutId.has(fingerprint)) return;
      seenWithoutId.add(fingerprint);
      merged.push(item);
      return;
    }
    const existing = indexById.get(id);
    if (existing === undefined) {
      indexById.set(id, merged.length);
      merged.push(item);
      return;
    }
    if (!isLocal) return;
    merged[existing] = pickNewer(merged[existing], item);
  };

  remoteItems.forEach(item => absorb(item, false));
  localItems.forEach(item => absorb(item, true));
  return merged;
};

export const mergeCloudSnapshots = (
  remote: CloudSnapshot | null | undefined,
  local: CloudSnapshot,
): CloudSnapshot => {
  if (!remote || typeof remote !== 'object') return local;
  const merged: CloudSnapshot = { ...remote, ...local };
  for (const key of Object.keys(merged)) {
    const remoteValue = (remote as CloudSnapshot)[key];
    const localValue = local[key];
    if (Array.isArray(remoteValue) && Array.isArray(localValue)) {
      merged[key] = mergeCloudTable(remoteValue, localValue);
    }
  }
  return merged;
};
