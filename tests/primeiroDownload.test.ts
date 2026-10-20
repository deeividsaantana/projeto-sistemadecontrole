import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Em 20/10 um computador ficou horas "esperando o primeiro download" com a
// mesma versão da nuvem: não baixava (versão igual) e não enviava (esperando).
const fonte = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('aparelho esperando o primeiro download não pula o download por versão igual', () => {
  const pulo = fonte.indexOf('Date.parse(requestedVersion) <= Date.parse(localCloudVersion)');
  assert.ok(pulo > 0, 'não achei a comparação de versão');
  const condicao = fonte.slice(fonte.lastIndexOf('if (', pulo), pulo);
  assert.match(condicao, /!localStorage\.getItem\(AGUARDANDO_PRIMEIRO_DOWNLOAD\)/);
});

test('download de aparelho sem cópia confiável não mantém novidades locais', () => {
  assert.match(fonte, /copiaLocalConfiavel\s*\?\s*manterNovidadesLocais\(/);
  assert.match(fonte, /copiaLocalConfiavel\s*\?\s*protegerContraEncolhimento\(/);
});
