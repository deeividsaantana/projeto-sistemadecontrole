import assert from 'node:assert/strict';
import test from 'node:test';
import { instalarReservaEmMemoria, registrarPendentesDaReserva, retirarPendentesDaReserva } from '../src/utils/reservaArmazenamento';
import { devolverParaReserva, registrosDoEspelho } from '../src/utils/resilientStorage';

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

test('importou, a memória encheu e deu F5: a importação volta, não a cópia antiga', () => {
  // Antes do F5: o disco tem 2 viagens e a importação de 3 só coube na reserva.
  const antes = new ArmazenamentoCheio();
  antes.setItem('renea_materiais_movimentos', '[1,2]');
  antes.setItem('renea_last_cloud_sync_iso', 'v1');
  const reservaAntes = instalarReservaEmMemoria(antes);
  antes.setItem('renea_materiais_movimentos', JSON.stringify(['a'.repeat(9), 'b', 'c']));
  const espelho = registrosDoEspelho([...antes.dados.keys(), 'outra_chave'], chave => antes.getItem(chave), reservaAntes, 'agora');
  const movimentos = espelho.find(registro => registro.key === 'renea_materiais_movimentos');
  assert.equal(movimentos?.emReserva, true);
  assert.equal(movimentos?.value, JSON.stringify(['a'.repeat(9), 'b', 'c']));
  assert.equal(espelho.find(registro => registro.key === 'renea_last_cloud_sync_iso')?.emReserva, false);
  assert.equal(espelho.some(registro => registro.key === 'outra_chave'), false, 'só o que é do sistema');

  // Depois do F5: a reserva começa vazia e o disco ainda tem a cópia velha.
  const depois = new ArmazenamentoCheio();
  depois.dados = new Map(antes.dados);
  const reservaDepois = instalarReservaEmMemoria(depois);
  assert.equal(depois.getItem('renea_materiais_movimentos'), '[1,2]');
  const devolvidas = devolverParaReserva(espelho, reservaDepois);
  assert.deepEqual(devolvidas, ['renea_materiais_movimentos']);
  assert.equal(depois.getItem('renea_materiais_movimentos'), JSON.stringify(['a'.repeat(9), 'b', 'c']));
  assert.equal(depois.getItem('renea_last_cloud_sync_iso'), 'v1', 'o que coube continua vindo do disco');

  // As chaves devolvidas ficam esperando o envio, e são entregues uma vez só.
  registrarPendentesDaReserva(devolvidas);
  assert.deepEqual(retirarPendentesDaReserva(), ['renea_materiais_movimentos']);
  assert.deepEqual(retirarPendentesDaReserva(), []);
});

test('a reserva só aceita de volta um valor íntegro', () => {
  const reserva = new Map<string, string | null>();
  const devolvidas = devolverParaReserva([
    { key: 'renea_materiais_movimentos', value: '{quebrado', updatedAt: '', emReserva: true },
    { key: 'renea_abastecimentos', value: '[1]', updatedAt: '' },
  ], reserva);
  assert.deepEqual(devolvidas, []);
  assert.equal(reserva.size, 0);
});
