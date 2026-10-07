import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createClient } from '@supabase/supabase-js';
import {
  buildSupabaseRelationalExport,
  summarizeSupabaseRelationalExport,
  type SupabaseRelationalExport,
} from '../src/supabase/relationalExport';
import {
  buildSupabaseRelationalImportPlan,
  importSupabaseRelationalExport,
  SUPABASE_RELATIONAL_DB_TABLES,
} from '../src/supabase/relationalImport';
import { validateSystemBackup } from '../src/utils/systemBackup';

type CloudData = Record<string, unknown>;

interface FirebaseExportFile {
  exportedAt: string;
  firebaseProjectId: string;
  source: 'v2' | 'intermediate' | 'legacy' | 'none';
  updatedAt: string;
  collection: string;
  hash: string;
  snapshot: CloudData;
}

const CLOUD_COLLECTION = 'sistemarenea_cloud';
const MANIFEST_ID = 'main_data_v2';
const LEGACY_ID = 'main_data';
const INTERMEDIATE_META_ID = 'meta';
const ORGANIZATION_ID = 'renea';
const WORK_DIR = path.resolve('work', 'supabase-migration');
const REPORT_TABLES = [
  'empresas',
  'obras',
  'equipamentos',
  'funcionarios',
  'materiaisCadastro',
  'materiaisMovimentos',
  'abastecimentos',
] as const;
const INTERMEDIATE_TABLE_IDS = [
  'empresas',
  'obras',
  'equipamentos',
  'funcionarios',
  'motoristasOperacionais',
  'comboios',
  'canteiros',
  'combustiveis',
  'lubrificantes',
  'etapas',
  'abastecimentos',
  'lubrificacoes',
  'ticketsJazida',
  'listasPresenca',
  'ordensServico',
  'gruposEquipe',
  'presencasLink',
  'historicoPresencas',
  'checklists',
  'apontamentosOperacionais',
  'registrosDds',
  'treinamentos',
  'modelosChecklist',
  'apontamentoRamos',
  'apontamentoRamoRegistros',
  'materiaisCadastro',
  'materiaisMovimentos',
  'materiaisPrevistos',
  'rotinasDiarias',
  'pendenciasRotina',
  'modelosRotina',
  'frentesServico',
  'diariosObra',
  'servicosObra',
  'producaoRegistros',
  'planejamentoItens',
  'modelosFvs',
  'fichasFvs',
  'inspecoes',
  'naoConformidades',
  'medicoes',
  'documentos',
  'ocorrencias',
  'lancamentosCusto',
  'orcamentoItens',
  'materiaisRegistros',
  'controleEquipamentosDiario',
  'periodosArquivados',
  'notifications',
  'historyLogs',
  'vinculosOperadorEquipamento',
  'exclusoes',
];

const args = new Set(process.argv.slice(2));
const shouldImport = args.has('--import');
const shouldValidateOnly = args.has('--validate-only');

const hashJson = (value: unknown) => crypto
  .createHash('sha256')
  .update(JSON.stringify(value))
  .digest('hex');

const countArrays = (snapshot: CloudData) => Object.fromEntries(
  Object.entries(snapshot)
    .filter(([, value]) => Array.isArray(value))
    .map(([table, value]) => [table, (value as unknown[]).length])
    .sort(([left], [right]) => String(left).localeCompare(String(right))),
);

const loadEnvFile = async (filePath: string) => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    raw.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      if (key && process.env[key] === undefined) process.env[key] = value;
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
};

const readServiceAccount = async () => {
  const base64Key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64;
  const inlineKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
  if (base64Key) return JSON.parse(Buffer.from(base64Key, 'base64').toString('utf8'));
  if (inlineKey) return JSON.parse(inlineKey);
  if (filePath) return JSON.parse(await fs.readFile(filePath, 'utf8'));
  throw new Error([
    'Acesso seguro ao Firebase ausente.',
    'Defina FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, FIREBASE_SERVICE_ACCOUNT_KEY ou FIREBASE_SERVICE_ACCOUNT_FILE em arquivo local ignorado pelo Git.',
  ].join(' '));
};

const initializeFirebase = async () => {
  const serviceAccount = await readServiceAccount();
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://sistemaerp-787f6-default-rtdb.firebaseio.com',
    });
  }
  return {
    db: getFirestore(),
    projectId: String(serviceAccount.project_id || ''),
  };
};

const loadDocuments = async (database: FirebaseFirestore.Firestore, ids: readonly string[]) => {
  const snapshots = [];
  for (let index = 0; index < ids.length; index += 50) {
    const batch = ids.slice(index, index + 50);
    snapshots.push(...await Promise.all(batch.map(id => database.collection(CLOUD_COLLECTION).doc(id).get())));
  }
  return snapshots;
};

const loadManifestSnapshot = async (
  database: FirebaseFirestore.Firestore,
  manifest: FirebaseFirestore.DocumentData,
): Promise<CloudData> => {
  const restored: CloudData = {};
  for (const [table, ids] of Object.entries(manifest.chunks || {})) {
    if (!Array.isArray(ids)) throw new Error(`Manifesto invalido para a tabela ${table}.`);
    const documents = await loadDocuments(database, ids.map(String));
    const rows: unknown[] = [];
    for (const document of documents) {
      if (!document.exists) throw new Error(`Chunk ausente: ${document.id}.`);
      const chunk = document.data();
      if (chunk?.kind !== 'chunk' || chunk.table !== table || typeof chunk.payload !== 'string') {
        throw new Error(`Chunk invalido para ${table}: ${document.id}.`);
      }
      const parsed = JSON.parse(chunk.payload);
      if (!Array.isArray(parsed)) throw new Error(`Payload do chunk nao e uma lista: ${document.id}.`);
      rows.push(...parsed);
    }
    const expectedHash = String(manifest.tableHashes?.[table] || '');
    if (expectedHash && hashJson(rows) !== expectedHash) {
      throw new Error(`Falha de integridade no hash da tabela ${table}.`);
    }
    restored[table] = rows;
  }
  restored.updatedAt = manifest.updatedAt;
  return restored;
};

const exportFirebaseSnapshot = async (): Promise<FirebaseExportFile> => {
  const { db, projectId } = await initializeFirebase();
  const collection = db.collection(CLOUD_COLLECTION);
  const manifestDocument = await collection.doc(MANIFEST_ID).get();

  let source: FirebaseExportFile['source'] = 'none';
  let updatedAt = '';
  let snapshot: CloudData = {};

  if (manifestDocument.exists) {
    const manifest = manifestDocument.data() || {};
    if (manifest.kind !== 'manifest' || typeof manifest.chunks !== 'object') {
      throw new Error('Manifesto main_data_v2 invalido.');
    }
    source = 'v2';
    updatedAt = String(manifest.updatedAt || '');
    snapshot = await loadManifestSnapshot(db, manifest);
  } else {
    const metaDocument = await collection.doc(INTERMEDIATE_META_ID).get();
    if (metaDocument.exists) {
      source = 'intermediate';
      updatedAt = String(metaDocument.data()?.updatedAt || '');
      const documents = await loadDocuments(db, INTERMEDIATE_TABLE_IDS);
      documents.forEach(document => {
        const value = document.data()?.value;
        if (document.exists && Array.isArray(value)) snapshot[document.id] = value;
      });
      snapshot.updatedAt = updatedAt;
    } else {
      const legacyDocument = await collection.doc(LEGACY_ID).get();
      if (legacyDocument.exists) {
        source = 'legacy';
        snapshot = legacyDocument.data() || {};
        updatedAt = String(snapshot.updatedAt || '');
      }
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    firebaseProjectId: projectId,
    source,
    updatedAt,
    collection: CLOUD_COLLECTION,
    hash: hashJson(snapshot),
    snapshot,
  };
};

const createSupabaseAdminClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Importacao bloqueada: defina SUPABASE_SERVICE_ROLE_KEY e SUPABASE_URL/VITE_SUPABASE_URL fora do Git.');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const countSupabaseRows = async (
  client: ReturnType<typeof createSupabaseAdminClient>,
  exported: SupabaseRelationalExport,
) => {
  const entries = await Promise.all(Object.entries(SUPABASE_RELATIONAL_DB_TABLES).map(async ([sourceTable, dbTable]) => {
    const organizationId = exported[sourceTable as keyof SupabaseRelationalExport][0]?.organization_id || ORGANIZATION_ID;
    const { count, error } = await client
      .from(dbTable)
      .select('legacy_id', { count: 'exact', head: true })
      .eq('organization_id', organizationId);
    if (error) throw new Error(`Falha ao contar ${dbTable}: ${error.message}`);
    return [dbTable, count || 0] as const;
  }));
  return Object.fromEntries(entries);
};

const writeJson = async (filePath: string, value: unknown) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const main = async () => {
  await loadEnvFile('.env.local');
  await fs.mkdir(WORK_DIR, { recursive: true });

  const exportedFile = await exportFirebaseSnapshot();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const exportPath = path.join(WORK_DIR, `firebase-export-${timestamp}.json`);
  await writeJson(exportPath, exportedFile);

  const backupValidation = validateSystemBackup(exportedFile.snapshot, false);
  const relationalExport = buildSupabaseRelationalExport({
    organizationId: ORGANIZATION_ID,
    snapshot: exportedFile.snapshot,
  });
  const summary = summarizeSupabaseRelationalExport(relationalExport);
  const report = {
    generatedAt: new Date().toISOString(),
    organizationId: ORGANIZATION_ID,
    firebase: {
      projectId: exportedFile.firebaseProjectId,
      source: exportedFile.source,
      collection: exportedFile.collection,
      updatedAt: exportedFile.updatedAt,
      hash: exportedFile.hash,
    },
    validation: {
      backupValid: backupValidation.valid,
      invalidKeys: backupValidation.invalidKeys,
      missingCoreKeys: backupValidation.missingCoreKeys,
    },
    firebaseCounts: countArrays(exportedFile.snapshot),
    initialScopeCounts: Object.fromEntries(REPORT_TABLES.map(table => [
      table,
      Array.isArray(exportedFile.snapshot[table]) ? (exportedFile.snapshot[table] as unknown[]).length : 0,
    ])),
    relationalCounts: summary.tableCounts,
    orphanReferences: summary.orphanReferences,
    importPlan: buildSupabaseRelationalImportPlan(relationalExport),
  };
  const reportPath = path.join(WORK_DIR, `firebase-to-supabase-report-${timestamp}.json`);
  await writeJson(reportPath, report);

  console.log(`Export salvo em: ${exportPath}`);
  console.log(`Relatorio salvo em: ${reportPath}`);
  console.log(`Origem Firebase: ${exportedFile.source}; hash: ${exportedFile.hash}`);
  console.table(report.initialScopeCounts);
  console.table(summary.tableCounts);

  if (!backupValidation.valid) {
    throw new Error(`Backup invalido: ${JSON.stringify(report.validation)}`);
  }
  if (summary.orphanReferences.length > 0) {
    console.error(`Referencias orfas encontradas: ${summary.orphanReferences.length}. Importacao bloqueada.`);
    process.exitCode = 3;
    return;
  }
  if (shouldValidateOnly || !shouldImport) {
    console.log('Validacao concluida sem importacao. Use --import para gravar no Supabase.');
    return;
  }

  const supabase = createSupabaseAdminClient();
  const beforeCounts = await countSupabaseRows(supabase, relationalExport);
  const importResults = await importSupabaseRelationalExport(supabase, relationalExport);
  const afterCounts = await countSupabaseRows(supabase, relationalExport);
  const importReportPath = path.join(WORK_DIR, `supabase-import-result-${timestamp}.json`);
  await writeJson(importReportPath, {
    generatedAt: new Date().toISOString(),
    beforeCounts,
    afterCounts,
    importResults,
    importPlan: report.importPlan,
  });
  console.log(`Resultado da importacao salvo em: ${importReportPath}`);
  console.table(beforeCounts);
  console.table(afterCounts);
};

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = process.exitCode || 1;
});
