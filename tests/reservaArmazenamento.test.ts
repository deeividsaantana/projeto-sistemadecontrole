import assert from 'node:assert/strict';
import test from 'node:test';
import { instalarReservaEmMemoria } from '../src/utils/reservaArmazenamento';

class ArmazenamentoCheio {
  dados = new Map<string, string>();
  limite = 20;
  getItem(chave: string) { return this.dados.get(chave) ?? null; }
  removeItem(chave: string) { this.dados.delete(chave); }
  setItem(chave: string, valor: string) {
    if (valor.length > this.limite) {
      const erro = new Error('exceeded the quota');
      erro.name = 'QuotaExceededError';
      throw erro;
    }
    this.dados.set(chave, valor);
  }
}

test('com a memória cheia, a leitura devolve o que está na tela e não a cópia antiga', () => {
  const armazenamento = new ArmazenamentoCheio();
  armazenamento.setItem('renea_presencas_link', '[18]');
  const avisos: string[] = [];
  instalarReservaEmMemoria(armazenamento, chave => avisos.push(chave));

  const recuperadas = JSON.stringify(Array.from({ length: 46 }, (_, i) => i));
  armazenamento.setItem('renea_presencas_link', recuperadas);

  assert.equal(armazenamento.getItem('renea_presencas_link'), recuperadas);
  assert.deepEqual(avisos, ['renea_presencas_link']);
});

test('quando volta a caber, grava normalmente e larga a reserva', () => {
  const armazenamento = new ArmazenamentoCheio();
  const reserva = instalarReservaEmMemoria(armazenamento);
  armazenamento.setItem('renea_abastecimentos', 'x'.repeat(30));
  armazenamento.setItem('renea_abastecimentos', '[1]');
  assert.equal(reserva.size, 0);
  assert.equal(armazenamento.dados.get('renea_abastecimentos'), '[1]');
  armazenamento.removeItem('renea_abastecimentos');
  assert.equal(armazenamento.getItem('renea_abastecimentos'), null);
});

test('outro erro de gravação continua aparecendo', () => {
  const armazenamento = new ArmazenamentoCheio();
  armazenamento.setItem = () => { throw new Error('SecurityError'); };
  instalarReservaEmMemoria(armazenamento);
  assert.throws(() => armazenamento.setItem('a', 'b'), /SecurityError/);
});
