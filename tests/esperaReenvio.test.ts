import assert from 'node:assert/strict';
import test from 'node:test';
import { ESPERA_REENVIO_BASE_MS, ESPERA_REENVIO_MAXIMA_MS, MENSAGEM_NUVEM_OCUPADA, ehBancoOcupado, esperaDoReenvio } from '../src/cloud/esperaReenvio';

test('espera do reenvio: sem falha não espera, e dobra a cada falha seguida', () => {
  assert.equal(esperaDoReenvio(0, 0), 0);
  assert.equal(esperaDoReenvio(1, 0), ESPERA_REENVIO_BASE_MS);
  assert.equal(esperaDoReenvio(2, 0), ESPERA_REENVIO_BASE_MS * 2);
  assert.equal(esperaDoReenvio(3, 0), ESPERA_REENVIO_BASE_MS * 4);
});

test('espera do reenvio: para em 5 minutos, com até 20% a mais para espalhar os aparelhos', () => {
  assert.equal(esperaDoReenvio(10, 0), ESPERA_REENVIO_MAXIMA_MS);
  assert.equal(esperaDoReenvio(50, 0), ESPERA_REENVIO_MAXIMA_MS);
  assert.equal(esperaDoReenvio(1, 1), ESPERA_REENVIO_BASE_MS * 1.2);
  assert.equal(esperaDoReenvio(10, 5), ESPERA_REENVIO_MAXIMA_MS * 1.2);
  assert.equal(esperaDoReenvio(2, -1), ESPERA_REENVIO_BASE_MS * 2);
});

test('mensagem de erro: banco ocupado é reconhecido e o texto para a pessoa não tem termo técnico', () => {
  for (const tecnico of ['canceling statement due to lock timeout', 'canceling statement due to statement timeout', 'Request failed with code 55P03', 'code 57014']) {
    assert.equal(ehBancoOcupado(tecnico), true, tecnico);
  }
  for (const outro of ['CLOUD_VERSION_CONFLICT', 'ROLE_WRITE_DENIED', 'Failed to fetch', '']) {
    assert.equal(ehBancoOcupado(outro), false, outro);
  }
  assert.match(MENSAGEM_NUVEM_OCUPADA, /nuvem está ocupada/);
  assert.doesNotMatch(MENSAGEM_NUVEM_OCUPADA, /timeout|statement|lock/i);
});
