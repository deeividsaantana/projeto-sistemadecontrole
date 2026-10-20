import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// React exige o mesmo número de hooks em toda renderização. Um useCallback
// depois de "if (!isLoggedIn) return" derrubava o app logo depois de entrar.
test('App não chama hook depois dos retornos antecipados', () => {
  const fonte = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const inicio = fonte.indexOf('export default function App(');
  const primeiroRetorno = fonte.indexOf('\n  if (externalTicketLink) {', inicio);
  assert.ok(inicio >= 0 && primeiroRetorno > inicio, 'não achei o primeiro retorno antecipado do App');
  const depois = fonte.slice(primeiroRetorno);
  const hooks = depois.match(/\buse(State|Effect|LayoutEffect|Memo|Callback|Ref|Reducer|Context|Transition|DeferredValue|Id|SyncExternalStore)\s*[(<]/g) ?? [];
  assert.deepEqual(hooks, []);
});
