import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// "Hoje" em UTC vira o dia seguinte depois das 21h em Brasília (A15).
const ARQUIVOS = [
  'src/App.tsx',
  'src/components/TicketsJazidaTab.tsx',
  'src/components/LancamentosTab.tsx',
  'src/components/ManutencaoTab.tsx',
  'src/components/ColaboradoresTab.tsx',
  'src/utils/manutencaoExport.ts',
  'src/utils/vencimento.ts',
];

test('A15: "hoje" nunca sai de toISOString', () => {
  for (const arquivo of ARQUIVOS) {
    const codigo = readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8');
    assert.doesNotMatch(codigo, /new Date\(\)\.toISOString\(\)\.(slice\(0, ?10\)|split\('T'\)\[0\])/, arquivo);
  }
});
