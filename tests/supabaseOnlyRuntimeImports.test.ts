import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const runtimeFiles = [
  '../src/App.tsx',
  '../src/publicApi.ts',
  '../src/usageTelemetry.ts',
  '../src/services/masterDataApi.ts',
  '../src/components/CombustivelInteligenteTab.tsx',
];

test('runtime principal nao importa Firebase para autenticacao ou sincronizacao', () => {
  for (const file of runtimeFiles) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /from ['"].*firebase|import\(['"].*firebase|firebase\/auth|firebase\/firestore/);
  }
});
