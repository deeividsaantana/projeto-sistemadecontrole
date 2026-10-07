import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const configSource = readFileSync(new URL('../src/components/ConfiguracoesTab.tsx', import.meta.url), 'utf8');

test('sincronizacao automatica permanece obrigatoria para usuarios logados', () => {
  assert.match(appSource, /const \[isAutoSyncEnabled, setIsAutoSyncEnabled\] = useState<boolean>\(true\)/);
  assert.match(appSource, /writeStoredFlag\(localStorage, STORAGE_KEYS\.autoSync, true\)/);
  assert.doesNotMatch(appSource, /const autoSyncSaved = readStoredFlag\(localStorage, STORAGE_KEYS\.autoSync\)/);
  assert.match(appSource, /sincronização é obrigatória e silenciosa/);
  assert.match(appSource, /subscribePendingPublicSubmissions/);
});

test('primeiro acesso nao finge que baixou a versao remota', () => {
  const connectionEffect = appSource.slice(
    appSource.indexOf('// Check the real Firestore connection'),
    appSource.indexOf('/** Le uma tabela do armazenamento local'),
  );
  assert.doesNotMatch(connectionEffect, /renea_last_cloud_sync_iso/);
  assert.match(appSource, /if \(!localCloudVersion && currentUserRoleRef\.current !== 'leitura' && !localStorage\.getItem\(AGUARDANDO_PRIMEIRO_DOWNLOAD\)\)/);
  assert.match(appSource, /const uploadResult = await handleUploadToFirebase\(\)/);
  assert.match(appSource, /const downloadResult = await handleDownloadFromFirebase\(\)/);
});

test('snapshot recebido durante upload permanece na fila automatica', () => {
  assert.match(appSource, /pendingRemoteVersionRef\.current = updatedAt/);
  assert.match(appSource, /uploadsInFlightRef\.current > 0 \|\| automaticDownloadInFlightRef\.current/);
  assert.match(appSource, /uploadsInFlightRef\.current === 0 && pendingRemoteVersionRef\.current/);
  assert.doesNotMatch(
    appSource,
    /if \(uploadsInFlightRef\.current > 0\) return;\s*const updatedAt = String\(snapshot\.data\(\)\?\.updatedAt/,
  );
});

test('falha transitória de leitura nunca republica o retrato local', () => {
  const pullRemoteChanges = appSource.slice(
    appSource.indexOf('const pullRemoteChanges = async () =>'),
    appSource.indexOf('// Com a sincronizacao automatica ativa'),
  );
  assert.match(pullRemoteChanges, /setIsCloudConnected\(false\)/);
  assert.doesNotMatch(appSource, /cloudRecoveryPending|setCloudRecoveryPending/);
});

test('tabelas operacionais sao hidratadas sem depender de ordens de servico', () => {
  assert.match(appSource, /if \(Object\.hasOwn\(data, 'checklists'\)\) \{\s*setChecklists/);
  assert.match(appSource, /if \(Object\.hasOwn\(data, 'materiaisCadastro'\)\) \{\s*setMateriaisCadastro/);
  assert.match(appSource, /if \(Object\.hasOwn\(data, 'diariosObra'\)\) \{\s*setDiariosObra/);
  assert.match(appSource, /if \(Object\.hasOwn\(data, 'medicoes'\)\) \{\s*setMedicoes/);
});

test('detalhes tecnicos e controles manuais de sincronizacao nao aparecem nas configuracoes', () => {
  assert.doesNotMatch(configSource, /Firebase|Firestore/);
  assert.doesNotMatch(configSource, /onToggleAutoSync|onUploadToFirebase|onDownloadFromFirebase/);
  assert.match(configSource, /Exclusão completa por aba/);
  assert.match(configSource, /EXCLUIR \$\{selectedTab/);
});

test('recuperacao de presenca so roda pelo botao: a sincronizacao e em tempo real', () => {
  assert.doesNotMatch(appSource, /automaticPresenceRecovery/);
  assert.match(appSource, /onRestorePresenceHistory=\{handleRestorePresenceHistory\}/);
  assert.match(appSource, /onSnapshot\(doc\(db, 'sistemarenea_cloud', 'main_data_v2'\)/);
});

test('navegador novo baixa a nuvem antes de enviar qualquer coisa', () => {
  assert.match(appSource, /\{ key: AGUARDANDO_PRIMEIRO_DOWNLOAD, value: 'true' \}/);
  assert.match(appSource, /if \(localStorage\.getItem\(AGUARDANDO_PRIMEIRO_DOWNLOAD\)\) \{\s*return \{ success: false/);
  assert.match(appSource, /!localCloudVersion && currentUserRoleRef\.current !== 'leitura' && !localStorage\.getItem\(AGUARDANDO_PRIMEIRO_DOWNLOAD\)/);
  assert.match(appSource, /localStorage\.removeItem\(AGUARDANDO_PRIMEIRO_DOWNLOAD\)/);
});
