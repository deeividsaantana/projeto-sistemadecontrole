import assert from 'node:assert/strict';
import test from 'node:test';
import { aplicarLimiteDeEnvio } from '../netlify/functions/public-presenca.js';

type Chamada = { bucket: string; limite: number; identidade: string };

const espiao = () => {
  const chamadas: Chamada[] = [];
  const aplicar = async (
    _db: unknown,
    _event: unknown,
    bucket: string,
    limite: number,
    _janela: number,
    identidade = '',
  ) => {
    chamadas.push({ bucket, limite, identidade });
  };
  return { chamadas, aplicar };
};

const envio = (body: unknown) => ({
  headers: { 'x-nf-client-connection-ip': '200.200.200.200' },
  body: JSON.stringify(body),
});

test('duas equipes no mesmo Wi-Fi da obra contam em baldes separados', async () => {
  const a = espiao();
  const b = espiao();
  await aplicarLimiteDeEnvio(null, envio({ token: 'geral-x', grupoId: 'equipe-ramo-100' }), 'POST', a.aplicar);
  await aplicarLimiteDeEnvio(null, envio({ token: 'geral-x', grupoId: 'equipe-ramo-900' }), 'POST', b.aplicar);

  const identidadeA = a.chamadas.find(item => item.bucket === 'public-presenca-POST')?.identidade;
  const identidadeB = b.chamadas.find(item => item.bucket === 'public-presenca-POST')?.identidade;
  assert.ok(identidadeA, 'o envio foi contado por equipe');
  assert.notEqual(identidadeA, identidadeB, 'o mesmo IP não junta as duas equipes no mesmo balde');
});

test('o limite por equipe é folgado e o teto por IP continua existindo', async () => {
  const { chamadas, aplicar } = espiao();
  await aplicarLimiteDeEnvio(null, envio({ token: 'geral-x', grupoId: 'equipe-ramo-100' }), 'PATCH', aplicar);

  const porEquipe = chamadas.find(item => item.bucket === 'public-presenca-PATCH');
  const porIp = chamadas.find(item => item.bucket === 'public-presenca-ip-PATCH');
  assert.equal(porEquipe?.limite, 120, 'uma equipe envia à vontade dentro da hora');
  assert.equal(porIp?.limite, 400, 'o teto por IP só barra script, não barra canteiro');
  assert.equal(porIp?.identidade, '', 'o teto por IP continua contando por IP');
});

test('envio sem equipe identificável volta a contar por IP, com limite estreito', async () => {
  const { chamadas, aplicar } = espiao();
  await aplicarLimiteDeEnvio(null, { headers: {}, body: 'nao-e-json' }, 'POST', aplicar);

  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].bucket, 'public-presenca-POST');
  assert.equal(chamadas[0].limite, 30);
  assert.equal(chamadas[0].identidade, '');
});

test('sem grupoId o link ainda é contado por token, não pelo roteador', async () => {
  const { chamadas, aplicar } = espiao();
  await aplicarLimiteDeEnvio(null, envio({ token: 'presenca-abcdef1234567890abcdef12' }), 'POST', aplicar);

  const porEquipe = chamadas.find(item => item.bucket === 'public-presenca-POST');
  assert.ok(porEquipe?.identidade.startsWith('token-'));
});
