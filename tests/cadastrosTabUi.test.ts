import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const sourceUrl = new URL('../src/components/CadastrosTab.tsx', import.meta.url);
const source = readFileSync(sourceUrl, 'utf8');

test('cadastros usa modal operacional acessivel para inativacao', () => {
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-labelledby="cadastro-delete-title"/);
  assert.match(source, /deleteTargetName/);
  assert.match(source, /deleteTargetCode/);
  assert.match(source, /disabled=\{isDeleting\}/);
  assert.doesNotMatch(source, /window\.confirm/);
});
