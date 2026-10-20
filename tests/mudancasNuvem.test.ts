import assert from 'node:assert/strict';
import test from 'node:test';
import { aplicarMudancasNasAssinaturas, calcularMudancas, capturarAssinaturas } from '../src/cloud/mudancasNuvem';

const lista = (prefixo: string, total: number) => Array.from({ length: total }, (_, i) => ({ id: `${prefixo}-${i}`, valor: i }));

test('manda só o registro novo, o alterado e o que saiu', () => {
  const nuvem = { abastecimentos: lista('ab', 5000), historyLogs: lista('h', 50) };
  const assinaturas = capturarAssinaturas(nuvem, 'v1');
  assert.ok(assinaturas);
  const aparelho = {
    abastecimentos: [{ id: 'ab-novo', valor: 1 }, ...nuvem.abastecimentos.slice(1).map(item => (item.id === 'ab-7' ? { ...item, valor: 70 } : item))],
    historyLogs: [{ id: 'h-novo', valor: 0 }, ...nuvem.historyLogs.slice(0, 10)],
  };
  const calculo = calcularMudancas(aparelho, assinaturas);
  assert.ok(calculo);
  assert.deepEqual(calculo.mudancas.abastecimentos, { upsert: [{ id: 'ab-novo', valor: 1 }, { id: 'ab-7', valor: 70 }], delete: ['ab-0'] });
  // Histórico só ganha linhas: o corte local de 2.000 eventos não apaga a nuvem.
  assert.deepEqual(calculo.mudancas.historyLogs, { upsert: [{ id: 'h-novo', valor: 0 }] });
  assert.equal(calculo.total, 4);
  assert.deepEqual(calculo.protegidas, []);
  assert.ok(JSON.stringify(calculo.mudancas).length < 300, 'um lançamento não leva a obra inteira');
});

test('nada mudou, nada vai', () => {
  const nuvem = { equipamentos: lista('eq', 30) };
  const calculo = calcularMudancas(nuvem, capturarAssinaturas(nuvem, 'v1')!);
  assert.deepEqual(calculo, { mudancas: {}, protegidas: [], total: 0 });
});

test('saída em massa sem marca não vai, com marca ou arquivada vai', () => {
  const nuvem = { equipamentos: lista('eq', 100), ticketsJazida: lista('tk', 40), gruposEquipe: lista('grp', 40) };
  const assinaturas = capturarAssinaturas(nuvem, 'v1')!;
  const aparelho = {
    equipamentos: lista('eq', 100).slice(60),
    ticketsJazida: [],
    gruposEquipe: lista('grp', 40).slice(25),
    exclusoes: lista('grp', 25).map(item => ({ id: `exc-${item.id}`, tabela: 'gruposEquipe', registroId: item.id, excluidoEm: '2026-10-16T21:00:00Z' })),
    periodosArquivados: [{ id: 'p1', dados: { ticketsJazida: lista('tk', 40) } }],
  };
  const calculo = calcularMudancas(aparelho, assinaturas)!;
  assert.equal(calculo.mudancas.equipamentos, undefined, 'navegador que perdeu a cópia não apaga a nuvem');
  assert.deepEqual(calculo.protegidas, [{ tabela: 'equipamentos', devolvidos: 60 }]);
  assert.equal(calculo.mudancas.ticketsJazida?.delete?.length, 40);
  assert.equal(calculo.mudancas.gruposEquipe?.delete?.length, 25);
});

test('lista sem id único não vai por registro', () => {
  assert.equal(capturarAssinaturas({ a: [{ id: 'x' }, { id: 'x' }] }, 'v1'), null);
  assert.equal(capturarAssinaturas({ a: lista('a', 2) }, ''), null);
  const assinaturas = capturarAssinaturas({ a: lista('a', 2) }, 'v1')!;
  assert.equal(calcularMudancas({ a: [{ valor: 1 }] }, assinaturas), null);
});

test('assinaturas seguem as mudanças para a próxima versão', () => {
  const nuvem = { abastecimentos: lista('ab', 3) };
  const assinaturas = capturarAssinaturas(nuvem, 'v1')!;
  const aparelho = { abastecimentos: [{ id: 'ab-9', valor: 9 }, nuvem.abastecimentos[1], nuvem.abastecimentos[2]] };
  const { mudancas } = calcularMudancas(aparelho, assinaturas)!;
  const proximas = aplicarMudancasNasAssinaturas(assinaturas, mudancas, 'v2');
  assert.equal(proximas.versao, 'v2');
  assert.deepEqual(proximas, capturarAssinaturas(aparelho, 'v2'));
  assert.deepEqual(calcularMudancas(aparelho, proximas)!.total, 0);
});

test('esvaziar tabela pequena sem marca não vai (A12)', () => {
  const nuvem = { ordensServico: lista('os', 4) };
  const calculo = calcularMudancas({ ordensServico: [] }, capturarAssinaturas(nuvem, 'v1')!);
  assert.ok(calculo);
  assert.deepEqual(calculo.mudancas, {});
  assert.deepEqual(calculo.protegidas, [{ tabela: 'ordensServico', devolvidos: 4 }]);
  const comMarca = calcularMudancas({
    ordensServico: [],
    exclusoes: lista('os', 4).map(item => ({ id: `exc-${item.id}`, tabela: 'ordensServico', registroId: item.id, excluidoEm: '2026-10-20T10:00:00Z' })),
  }, capturarAssinaturas(nuvem, 'v1')!);
  assert.deepEqual(comMarca?.mudancas.ordensServico, { delete: lista('os', 4).map(item => item.id) });
});
