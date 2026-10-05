import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const sourceRoot = path.resolve(process.cwd(), 'src');

const collectSourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    return /\.(?:css|tsx?)$/.test(entry.name) ? [entryPath] : [];
  });

test('as telas não aplicam desfoque visual ao conteúdo de fundo', () => {
  const offenders = collectSourceFiles(sourceRoot)
    .filter((filePath) => /backdrop-blur|backdrop-filter\s*:\s*blur\s*\(/.test(readFileSync(filePath, 'utf8')))
    .map((filePath) => path.relative(process.cwd(), filePath));

  assert.deepEqual(offenders, [], `remova o blur visual de: ${offenders.join(', ')}`);
});
