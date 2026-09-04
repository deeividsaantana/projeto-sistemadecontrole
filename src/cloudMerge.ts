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

/** Ids por tabela que este aparelho tinha na última sincronização concluída. */
export type CloudBaseline = Record<string, string[]>;

/**
 * Fotografa só os ids de cada tabela de um retrato. É o suficiente para,
 * mais tarde, distinguir "eu apaguei isso" de "o colega criou isso depois",
 * sem guardar uma segunda cópia inteira dos dados.
 */
export const captureCloudBaseline = (snapshot: CloudSnapshot | null | undefined): CloudBaseline => {
  if (!snapshot || typeof snapshot !== 'object') return {};
  const baseline: CloudBaseline = {};
  for (const [table, value] of Object.entries(snapshot)) {
    if (!Array.isArray(value)) continue;
    baseline[table] = value.map(recordId).filter(Boolean);
  }
  return baseline;
};

/**
 * Mescla de três vias. A de duas vias (`mergeCloudTable`) preserva tudo que
 * existe de qualquer lado — o que salva o lançamento do colega, mas também
 * ressuscita o que este aparelho apagou de propósito, porque "apagado aqui" e
 * "criado lá" são indistinguíveis olhando só os dois lados.
 *
 * Com a base (o que este aparelho enxergava na última sincronização) dá para
 * separar os quatro casos, em vez de adivinhar:
 * - sumiu no local, ESTAVA na base → este aparelho apagou → respeita a exclusão.
 * - sumiu no local, NÃO estava na base → o colega criou depois → preserva.
 * - sumiu no remoto, ESTAVA na base → o colega apagou → respeita a exclusão.
 * - sumiu no remoto, NÃO estava na base → este aparelho criou → preserva.
 *
 * Quando o mesmo registro é apagado de um lado e editado do outro, a exclusão
 * prevalece: é a decisão mais explícita das duas, e o histórico guarda o que
 * havia antes.
 */
export const mergeCloudTableWithBaseline = (
  remoteItems: unknown[],
  localItems: unknown[],
  baselineIds: string[] | undefined,
): unknown[] => {
  const merged = mergeCloudTable(remoteItems, localItems);
  if (!baselineIds || baselineIds.length === 0) return merged;

  const baseline = new Set(baselineIds);
  const localIds = new Set(localItems.map(recordId).filter(Boolean));
  const remoteIds = new Set(remoteItems.map(recordId).filter(Boolean));
  // Nunca mexe em registro que não estava na base: esse é, por definição,
  // novidade de algum dos lados, e novidade nenhuma pode ser descartada.
  return merged.filter(item => {
    const id = recordId(item);
    if (!id || !baseline.has(id)) return true;
    return localIds.has(id) && remoteIds.has(id);
  });
};

/**
 * Decide o que realmente deve ser publicado, considerando que este aparelho
 * pode estar atrasado em relação à nuvem.
 *
 * O controle de versão do envio (a "geração" do manifesto) só detecta quem
 * publicou DURANTE o nosso envio. Ele não percebe o caso mais comum com
 * vários usuários: um aparelho que ficou horas com a tela aberta sem baixar
 * nada, e então salva algo. Esse aparelho passava direto pela checagem e
 * publicava o próprio retrato por cima — apagando da nuvem tudo que os
 * colegas lançaram nesse intervalo, sem conflito e sem erro nenhum.
 *
 * Aqui a regra é explícita: só publica direto quem comprovadamente já viu a
 * versão que está na nuvem. Quem não viu mescla antes — usando a base
 * (`baseline`) para que a mesclagem não desfaça exclusões feitas aqui.
 */
export const resolvePublishPayload = ({
  localPayload,
  remoteSnapshot,
  remoteUpdatedAt,
  knownCloudVersion,
  baseline,
}: {
  localPayload: CloudSnapshot;
  remoteSnapshot: CloudSnapshot | null | undefined;
  remoteUpdatedAt: string;
  knownCloudVersion: string;
  baseline?: CloudBaseline;
}): CloudSnapshot => {
  // Nuvem ainda vazia: não há nada para preservar.
  if (!remoteUpdatedAt) return localPayload;
  // Este aparelho já está na versão publicada: pode subir o próprio retrato.
  if (knownCloudVersion === remoteUpdatedAt) return localPayload;
  return mergeCloudSnapshotsWithBaseline(remoteSnapshot, localPayload, baseline);
};

/**
 * Mescla incondicional (o chamador já decidiu que precisa mesclar), honrando
 * a base para não desfazer exclusões locais. É o que o caminho de conflito
 * usa: lá já se sabe que outro usuário publicou, não há o que decidir.
 */
export const mergeCloudSnapshotsWithBaseline = (
  remote: CloudSnapshot | null | undefined,
  local: CloudSnapshot,
  baseline?: CloudBaseline,
): CloudSnapshot => {
  if (!remote || typeof remote !== 'object') return local;
  const merged: CloudSnapshot = { ...remote, ...local };
  for (const key of Object.keys(merged)) {
    const remoteValue = (remote as CloudSnapshot)[key];
    const localValue = local[key];
    if (Array.isArray(remoteValue) && Array.isArray(localValue)) {
      merged[key] = mergeCloudTableWithBaseline(remoteValue, localValue, baseline?.[key]);
    }
  }
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
