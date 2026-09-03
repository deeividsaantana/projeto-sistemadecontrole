import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// Os dois primeiros testes deste arquivo cobriam a tela de Manutenção de
// Equipamentos, removida por não estar acessível em lugar nenhum do sistema.
// A garantia de carregamento sob demanda dos seeds operacionais continua
// valendo e protege o ganho de peso obtido no carregamento inicial.
const initialDataUrl = new URL('../src/utils/initialData.ts', import.meta.url);
const initialDataSource = readFileSync(initialDataUrl, 'utf8');

test('dados iniciais operacionais pesados carregam sob demanda', () => {
  assert.doesNotMatch(initialDataSource, /^import .*from '\.\/importedSpreadsheetSeed';/m);
  assert.doesNotMatch(initialDataSource, /^import .*from '\.\/importedAugust2026Seed';/m);
  assert.match(initialDataSource, /import\('\.\/importedSpreadsheetSeed'\)/);
  assert.match(initialDataSource, /import\('\.\/importedAugust2026Seed'\)/);
});
