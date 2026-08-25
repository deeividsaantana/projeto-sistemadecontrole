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

test('detalhes tecnicos e controles manuais de sincronizacao nao aparecem nas configuracoes', () => {
  assert.doesNotMatch(configSource, /Firebase|Firestore/);
  assert.doesNotMatch(configSource, /onToggleAutoSync|onUploadToFirebase|onDownloadFromFirebase/);
  assert.match(configSource, /Exclusão completa por aba/);
  assert.match(configSource, /EXCLUIR \$\{selectedTab/);
});
