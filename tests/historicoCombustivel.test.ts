import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agruparHistorico, colunasValidas, COLUNAS_PADRAO, intervaloDoPeriodo, ordenarHistorico, proximaOrdem, ORDEM_PADRAO,
} from '../src/modules/frota/historicoCombustivel';
import type { Abastecimento } from '../src/types';

const item = (over: Partial<Abastecimento>): Abastecimento => ({
  id: 'a', data: '2026-10-10', hora: '08:00', equipamentoId: 'e-1', horimetroInicial: 0, kmInicial: 0, bombaInicial: 0,
  quantidadeLitros: 100, bombaFinal: 0, tipoCombustivelId: 'd', comboioId: 'c-1', responsavel: '', observacao: '', ...over,
});
const nomes = {
  prefixo: (a: Abastecimento) => ({ 'e-1': 'LO279', 'e-2': 'CB726', 'e-10': 'CB1000' } as Record<string, string>)[a.equipamentoId] || '',
  empresa: () => 'RENEA',
  comboio: (a: Abastecimento) => (a.comboioId === 'c-1' ? 'Comboio 01' : ''),
};

test('períodos rápidos seguem o mês do diesel (21 a 20)', () => {
  assert.deepEqual(intervaloDoPeriodo('hoje', '2026-10-15'), { dataInicio: '2026-10-15', dataFim: '2026-10-15' });
  assert.deepEqual(intervaloDoPeriodo('7dias', '2026-10-03'), { dataInicio: '2026-09-27', dataFim: '2026-10-03' });
  assert.deepEqual(intervaloDoPeriodo('competencia', '2026-10-15'), { dataInicio: '2026-09-21', dataFim: '2026-10-20' });
  assert.deepEqual(intervaloDoPeriodo('competencia', '2026-10-25'), { dataInicio: '2026-10-21', dataFim: '2026-11-20' });
  assert.deepEqual(intervaloDoPeriodo('competencia-anterior', '2026-01-10'), { dataInicio: '2025-11-21', dataFim: '2025-12-20' });
  assert.deepEqual(intervaloDoPeriodo('tudo', '2026-10-15'), { dataInicio: '', dataFim: '' });
});

test('ordena por coluna, com prefixo em ordem natural e empate do mais recente', () => {
  const lista = [
    item({ id: '1', equipamentoId: 'e-10', quantidadeLitros: 50 }),
    item({ id: '2', equipamentoId: 'e-2', quantidadeLitros: 200, hora: '09:00' }),
    item({ id: '3', equipamentoId: 'e-2', quantidadeLitros: 80, hora: '10:00' }),
  ];
  assert.deepEqual(ordenarHistorico(lista, { coluna: 'equipamento', direcao: 'asc' }, nomes).map(a => a.id), ['3', '2', '1']);
  assert.deepEqual(ordenarHistorico(lista, { coluna: 'litros', direcao: 'desc' }, nomes).map(a => a.id), ['2', '3', '1']);
  assert.deepEqual(ordenarHistorico(lista, ORDEM_PADRAO, nomes).map(a => a.id), ['3', '2', '1']);
  assert.deepEqual(proximaOrdem(ORDEM_PADRAO, 'data'), { coluna: 'data', direcao: 'asc' });
  assert.deepEqual(proximaOrdem(ORDEM_PADRAO, 'equipamento'), { coluna: 'equipamento', direcao: 'asc' });
  assert.deepEqual(proximaOrdem(ORDEM_PADRAO, 'litros'), { coluna: 'litros', direcao: 'desc' });
});

test('agrupa com subtotal e mantém a ordem da lista', () => {
  const lista = [
    item({ id: '1', data: '2026-10-11', quantidadeLitros: 40.25 }),
    item({ id: '2', data: '2026-10-10', comboioId: '' }),
    item({ id: '3', data: '2026-10-11', quantidadeLitros: 10 }),
  ];
  const porDia = agruparHistorico(lista, 'dia', nomes);
  assert.deepEqual(porDia.map(g => [g.rotulo, g.litros, g.itens.length]), [['2026-10-11', 50.3, 2], ['2026-10-10', 100, 1]]);
  assert.deepEqual(agruparHistorico(lista, 'comboio', nomes).map(g => g.rotulo), ['Comboio 01', 'Sem comboio']);
  assert.equal(agruparHistorico(lista, 'nenhum', nomes)[0].itens.length, 3);
});

test('colunas guardadas: fixas sempre, desconhecidas fora, lixo volta ao padrão', () => {
  assert.deepEqual(colunasValidas(['observacao', 'xyz']), ['data', 'equipamento', 'litros', 'observacao']);
  assert.deepEqual(colunasValidas('quebrado'), COLUNAS_PADRAO);
});
