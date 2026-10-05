import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/components/CombustivelOperacionalTab.tsx', import.meta.url), 'utf8');

test('tela de lancamento de combustivel segue a ordem visual da macro', () => {
  assert.match(source, /data-testid="combustivel-macro-form"/);

  const labels = [
    'Mês',
    'Data',
    'Prefixo',
    'Descrição',
    'Empresa',
    'KM inicial',
    'Horímetro',
    'Litros',
    'Hora',
    'Comboio',
    'Combustível',
    'Bomba inicial',
    'Bomba final',
    'Equipamento localizado.',
  ];

  let cursor = -1;
  for (const label of labels) {
    const next = source.indexOf(label, cursor + 1);
    assert.ok(next > cursor, `Esperava encontrar "${label}" depois da posicao ${cursor}.`);
    cursor = next;
  }
});
