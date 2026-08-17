import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const sourceUrl = new URL('../src/components/MasterDataReviewCenter.tsx', import.meta.url);
const source = readFileSync(sourceUrl, 'utf8');

test('central de revisao mestre usa confirmacao operacional propria', () => {
  assert.doesNotMatch(source, /window\.confirm/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /pendingApplyConfirmation/);
  assert.match(source, /Confirmar aplicacao/);
});
