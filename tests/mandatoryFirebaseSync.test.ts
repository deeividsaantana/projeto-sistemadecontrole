import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const configSource = readFileSync(new URL('../src/components/ConfiguracoesTab.tsx', import.meta.url), 'utf8');

test('sincronizacao Firebase automatica e obrigatoria para usuarios logados', () => {
  assert.match(appSource, /const \[isAutoSyncEnabled, setIsAutoSyncEnabled\] = useState<boolean>\(true\)/);
  assert.match(appSource, /writeStoredFlag\(localStorage, STORAGE_KEYS\.autoSync, true\)/);
  assert.doesNotMatch(appSource, /const autoSyncSaved = readStoredFlag\(localStorage, STORAGE_KEYS\.autoSync\)/);
  assert.match(appSource, /Sincronização obrigatória/);
  assert.match(appSource, /Sincronizacao Firebase obrigatoria para manter todos os usuarios alinhados\./);
});

test('configuracoes nao permitem desligar a sincronizacao obrigatoria', () => {
  assert.match(configSource, /onToggleAutoSync\(true\)/);
  assert.doesNotMatch(configSource, /onToggleAutoSync\(!isAutoSyncEnabled\)/);
  assert.match(configSource, /aria-pressed="true"/);
  assert.match(configSource, /cursor-not-allowed/);
});
