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
  assert.match(appSource, /if \(!localCloudVersion && currentUserRoleRef\.current !== 'leitura'\)/);
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
