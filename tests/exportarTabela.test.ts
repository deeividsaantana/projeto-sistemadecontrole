import assert from 'node:assert/strict';
import test from 'node:test';
import { nomeDoArquivo, tabelaParaCsv, textoDaCelula } from '../src/utils/exportarTabela';

test('a planilha sai no formato do Excel em português', () => {
  const linhas = [
    { nome: 'José; da "Silva"', litros: 1234.5, ativo: true },
    { nome: 'Ana', litros: null, ativo: false },
  ];
  const csv = tabelaParaCsv(linhas, [
    { titulo: 'Nome', valor: linha => linha.nome },
    { titulo: 'Litros', valor: linha => linha.litros },
    { titulo: 'Ativo', valor: linha => linha.ativo },
  ]);
  assert.equal(csv, 'Nome;Litros;Ativo\r\n"José; da ""Silva""";1234,5;Sim\r\nAna;;Não');
});

test('dado ausente vira célula vazia, nunca zero', () => {
  assert.equal(textoDaCelula(undefined), '');
  assert.equal(textoDaCelula(null), '');
  assert.equal(textoDaCelula(Number.NaN), '');
  assert.equal(textoDaCelula(0), '0');
});

test('o nome do arquivo não tem acento nem espaço', () => {
  assert.equal(nomeDoArquivo('Movimentações de material', '2026-11-09'), 'movimentacoes-de-material-2026-11-09.csv');
  assert.equal(nomeDoArquivo('???', '2026-11-09'), 'lista-2026-11-09.csv');
});
