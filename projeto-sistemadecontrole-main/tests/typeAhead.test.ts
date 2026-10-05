/**
 * Busca por digitação: em listas de centenas de linhas, achar "Genivaldo"
 * rolando é inviável. Os testes cobrem a lógica de casamento em si — o hook
 * só acopla isso ao teclado.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLocaleLowerCase('pt-BR');

/** Mesma varredura circular usada pelo hook. */
const findFrom = (labels: string[], needle: string, from: number) => {
  const target = normalize(needle);
  for (let offset = 0; offset < labels.length; offset += 1) {
    const index = (Math.max(0, from) + offset) % labels.length;
    if (normalize(labels[index]).startsWith(target)) return index;
  }
  return -1;
};

const NOMES = ['Antonio', 'Bruno', 'Cesar', 'Genivaldo', 'Gerson', 'Gustavo', 'Marcos'];

test('primeira tecla vai para o primeiro nome com aquela letra', () => {
  assert.equal(findFrom(NOMES, 'g', 0), 3);
  assert.equal(findFrom(NOMES, 'c', 0), 2);
  assert.equal(findFrom(NOMES, 'a', 0), 0);
});

test('repetir a letra percorre os nomes daquela inicial', () => {
  assert.equal(findFrom(NOMES, 'g', 4), 4);
  assert.equal(findFrom(NOMES, 'g', 5), 5);
});

test('a busca dá a volta na lista ao chegar no fim', () => {
  assert.equal(findFrom(NOMES, 'g', 6), 3);
});

test('teclas seguidas formam um prefixo mais específico', () => {
  assert.equal(findFrom(NOMES, 'ge', 0), 3);
  assert.equal(findFrom(NOMES, 'ger', 0), 4);
  assert.equal(findFrom(NOMES, 'gu', 0), 5);
});

test('acento e caixa não atrapalham', () => {
  const comAcento = ['Ângela', 'Cézar', 'Ítalo'];
  assert.equal(findFrom(comAcento, 'a', 0), 0);
  assert.equal(findFrom(comAcento, 'CE', 0), 1);
  assert.equal(findFrom(comAcento, 'i', 0), 2);
});

test('prefixo sem correspondente devolve -1 e a seleção não muda', () => {
  assert.equal(findFrom(NOMES, 'z', 0), -1);
  assert.equal(findFrom(NOMES, 'gx', 0), -1);
  assert.equal(findFrom([], 'a', 0), -1);
});

test('funciona com prefixo de equipamento, não só nome', () => {
  const prefixos = ['CB-1005', 'CB-1010', 'ESC-200', 'TR-45'];
  assert.equal(findFrom(prefixos, 'e', 0), 2);
  assert.equal(findFrom(prefixos, 'cb-10', 0), 0);
  assert.equal(findFrom(prefixos, 'cb-10', 1), 1);
});
