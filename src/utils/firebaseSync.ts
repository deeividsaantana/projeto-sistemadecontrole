/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Camada de sincronização do Firestore usada pelo RENEA.
 *
 * Antes, TODO o sistema era salvo em um único documento
 * ("sistemarenea_cloud/main_data"), o que estourava o limite de 1 MiB
 * por documento do Firestore assim que a base de RDOs, frotas, relatórios
 * etc. crescia.
 *
 * Agora cada registro (frota, RDO, relatório, equipamento, abastecimento,
 * lubrificação, ticket, etc.) é salvo como um DOCUMENTO INDIVIDUAL dentro
 * da sua própria coleção ("sistemarenea_frotas", "sistemarenea_rdos", ...).
 * Isso elimina o limite de tamanho porque cada documento carrega apenas
 * os dados de um único item, não a base inteira.
 */

import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

// Firestore aceita até 500 operações por batch. Usamos uma margem de
// segurança para não chegar perto do limite.
const BATCH_CHUNK_SIZE = 450;

export const SIZE_LIMIT_FRIENDLY_MESSAGE =
  'Erro: havia dados demais para salvar em um único documento. A sincronização agora usa coleções separadas para evitar esse limite.';

/** Nomes das coleções usadas pela sincronização do RENEA. */
export const RENEA_COLLECTIONS = {
  // Coleções pedidas explicitamente na nova arquitetura
  frotas: 'sistemarenea_frotas',
  rdos: 'sistemarenea_rdos',
  relatorios: 'sistemarenea_relatorios',
  equipamentos: 'sistemarenea_equipamentos',
  combustivel: 'sistemarenea_combustivel',
  lubrificantes: 'sistemarenea_lubrificantes',
  tickets: 'sistemarenea_tickets',
  meta: 'sistemarenea_meta',
  // Demais cadastros/lançamentos do sistema, seguindo o mesmo padrão de
  // "um documento por item" para que NENHUM dado volte a ser salvo dentro
  // de um documento único.
  empresas: 'sistemarenea_empresas',
  obras: 'sistemarenea_obras',
  funcionarios: 'sistemarenea_funcionarios',
  tiposCombustivel: 'sistemarenea_tipos_combustivel',
  produtosLubrificacao: 'sistemarenea_produtos_lubrificacao',
  etapasServico: 'sistemarenea_etapas_servico',
  listasPresenca: 'sistemarenea_listas_presenca',
  ordensServico: 'sistemarenea_ordens_servico',
  gruposEquipe: 'sistemarenea_grupos_equipe',
  presencasLink: 'sistemarenea_presencas_link',
  historicoPresencas: 'sistemarenea_historico_presencas',
  apontamentoRamos: 'sistemarenea_apontamento_ramos',
  apontamentoRamoRegistros: 'sistemarenea_apontamento_ramo_registros',
  materiaisCadastro: 'sistemarenea_materiais_cadastro',
  materiaisRegistros: 'sistemarenea_materiais_registros',
  notifications: 'sistemarenea_notifications',
  // Coleção antiga (documento único). Mantida somente como referência
  // para migração automática de backups feitos antes desta correção.
  legacyCloud: 'sistemarenea_cloud',
} as const;

/** Deixa o texto seguro para ser usado como ID de documento no Firestore. */
const sanitizeDocId = (rawId: string): string =>
  String(rawId ?? '')
    .trim()
    .replace(/[/\s]+/g, '_')
    .slice(0, 1500);

const isDocTooLargeError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /exceeds the maximum allowed size|maior que o tamanho m[aá]ximo/i.test(message);
};

/**
 * Salva uma lista de itens em uma coleção do Firestore, um documento por
 * item (em vez de um único documento gigante). Usa `merge: true` para não
 * apagar campos já existentes no documento remoto e grava em lotes
 * (batch) para reduzir o número de requisições.
 */
export async function pushCollection<T extends Record<string, any>>(
  collectionName: string,
  items: T[] | undefined | null,
  getDocId: (item: T) => string
): Promise<void> {
  if (!items || items.length === 0) return;

  for (let start = 0; start < items.length; start += BATCH_CHUNK_SIZE) {
    const chunk = items.slice(start, start + BATCH_CHUNK_SIZE);
    const batch = writeBatch(db);
    let hasWrites = false;

    chunk.forEach((item) => {
      const rawId = getDocId(item);
      const docId = sanitizeDocId(rawId);
      if (!docId) return; // ignora itens sem chave válida
      const ref = doc(db, collectionName, docId);
      batch.set(ref, { ...item, updatedAt: serverTimestamp() }, { merge: true });
      hasWrites = true;
    });

    if (hasWrites) {
      try {
        await batch.commit();
      } catch (error) {
        if (isDocTooLargeError(error)) {
          throw new Error(SIZE_LIMIT_FRIENDLY_MESSAGE);
        }
        throw error;
      }
    }
  }
}

/**
 * Lê todos os documentos de uma coleção e devolve como um array simples,
 * pronto para reconstruir o estado local do sistema.
 */
export async function pullCollection<T = any>(collectionName: string): Promise<T[]> {
  const snap = await getDocs(collection(db, collectionName));
  const items: T[] = [];
  snap.forEach((docSnap) => {
    const { updatedAt, ...rest } = docSnap.data() as Record<string, any>;
    items.push(rest as T);
  });
  return items;
}
