import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const form = readFileSync(new URL('../src/components/fleet/DailyRecordForm.tsx', import.meta.url), 'utf8');
const central = readFileSync(new URL('../src/components/CentralOperacionalTab.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const domain = readFileSync(new URL('../src/fleet/domain.ts', import.meta.url), 'utf8');
const types = readFileSync(new URL('../src/types.ts', import.meta.url), 'utf8');

test('lançamento diário guarda quem informou', () => {
  // Sem autoria o histórico não responde "quem alterou", que é o ponto do módulo.
  assert.match(form, /registeredBy/);
  assert.match(form, /responsavel: registeredBy/);
  assert.match(form, /atualizadoPor: registeredBy/);
  assert.match(form, /criadoPor: existing\?\.criadoPor \|\| registeredBy/);
  assert.match(app, /registeredBy=\{activeUserName\}/);
});

test('alteração rápida da central também registra o responsável', () => {
  assert.match(central, /responsavel,/);
  assert.match(app, /responsavel=\{activeUserName\}/);
});

test('frente de serviço fica gravada junto do lançamento', () => {
  assert.match(domain, /frenteServico\?: string/);
  assert.match(form, /frenteServico: team\?\.frenteServico/);
});

test('evento do controle diário aceita responsável', () => {
  assert.match(types, /responsavel\?: string;/);
});

test('todo salvamento do lançamento acrescenta evento ao histórico', () => {
  // A regra do módulo: nunca sobrescrever sem deixar rastro.
  assert.match(form, /eventos: \[\.\.\.\(existing\?\.eventos \|\| \[\]\), timelineEvent\]/);
});
