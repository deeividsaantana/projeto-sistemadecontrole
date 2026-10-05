import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const relativeTarget of ['dist', 'server.js']) {
  const target = path.resolve(repositoryRoot, relativeTarget);
  if (path.dirname(target) !== repositoryRoot) {
    throw new Error(`Destino de limpeza fora do projeto: ${target}`);
  }
  await rm(target, { recursive: true, force: true });
}

console.log('Arquivos de build removidos com seguranca.');
