import assert from 'node:assert/strict';
import test from 'node:test';
import { criarEnvioSerializado } from '../src/cloud/envioSerializado';

test('envio serializado: lançamentos no meio de um envio viram um só envio depois', async () => {
  let ativos = 0;
  let maiorSimultaneo = 0;
  let envios = 0;
  const pedir = criarEnvioSerializado(async () => {
    envios += 1;
    ativos += 1;
    maiorSimultaneo = Math.max(maiorSimultaneo, ativos);
    await new Promise(resolver => setTimeout(resolver, 20));
    ativos -= 1;
    return { success: true, message: 'ok' };
  }, { pausaMs: 5 });

  const todos = await Promise.all(Array.from({ length: 10 }, () => pedir()));
  assert.equal(maiorSimultaneo, 1, 'nunca dois envios ao mesmo tempo');
  assert.equal(envios, 2, 'o primeiro e um só para todo o resto');
  assert.ok(todos.every(resultado => resultado.success));
});

test('envio serializado: sem pedido no meio, é um envio por pedido, e o sinal de espera liga e desliga junto', async () => {
  let envios = 0;
  let segurando = 0;
  const pedir = criarEnvioSerializado(async () => { envios += 1; return { success: true, message: 'ok' }; }, {
    pausaMs: 1, segurar: () => { segurando += 1; }, soltar: () => { segurando -= 1; },
  });
  await pedir();
  await pedir();
  assert.equal(envios, 2);

  const p1 = pedir();
  const p2 = pedir();
  await Promise.all([p1, p2]);
  assert.equal(envios, 4);
  assert.equal(segurando, 0);
});

test('envio serializado: falha do envio chega a quem pediu e não trava os próximos', async () => {
  let vez = 0;
  const pedir = criarEnvioSerializado(async () => {
    vez += 1;
    if (vez === 1) throw new Error('falhou');
    return { success: true, message: 'ok' };
  }, { pausaMs: 1 });
  await assert.rejects(pedir(), /falhou/);
  assert.equal((await pedir()).success, true);
});
