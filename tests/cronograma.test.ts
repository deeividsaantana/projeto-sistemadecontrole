import assert from 'node:assert/strict';
import test from 'node:test';
import { barrasDoCronograma, janelaDoCronograma, posicaoDaBarra, posicaoDeHoje } from '../src/utils/cronograma';
import type { FrenteServico, PlanejamentoItem, RegistroProducao } from '../src/types';

const plano: PlanejamentoItem = {
  id: 'p1', dataInicio: '2026-01-05', dataFim: '2026-01-09', servicoId: 's1',
  servicoDescricao: 'Escavação', unidade: 'm³', quantidadePlanejada: 100,
  responsavel: 'D', situacao: 'Planejado', ativo: true, criadoEm: '', atualizadoEm: '',
};

const producao: RegistroProducao = {
  id: 'r1', data: '2026-01-06', servicoId: 's1', servicoDescricao: 'Escavação',
  unidade: 'm³', quantidade: 40, responsavel: 'D', ativo: true, criadoEm: '', atualizadoEm: '',
};

const frente: FrenteServico = {
  id: 'f1', nome: 'Frente 1', situacao: 'Em execução', ativo: true, dataInicio: '2026-01-01',
  dataTerminoPrevisto: '2026-01-20', criadoEm: '', atualizadoEm: '',
};

test('cronograma nasce dos planos e frentes existentes, sem entidade nova', () => {
  const barras = barrasDoCronograma([plano], [producao], [frente], '2026-01-07');
  assert.deepEqual(barras.map(item => item.origem), ['Frente', 'Plano']);
  assert.equal(barras.find(item => item.origem === 'Plano')?.progresso, 40);
});

test('frente sem data prevista não entra no cronograma', () => {
  assert.equal(barrasDoCronograma([], [], [{ ...frente, dataTerminoPrevisto: undefined }], '2026-01-07').length, 0);
});

test('janela cobre todas as barras e posiciona em percentual', () => {
  const barras = barrasDoCronograma([plano], [producao], [frente], '2026-01-07');
  const janela = janelaDoCronograma(barras, '2026-01-07');
  assert.deepEqual([janela.inicio, janela.fim, janela.totalDias], ['2026-01-01', '2026-01-20', 20]);
  const posicao = posicaoDaBarra(barras.find(item => item.origem === 'Plano')!, janela);
  assert.equal(posicao.esquerda, 20);
  assert.equal(posicao.largura, 25);
});

test('marca de hoje só existe dentro da janela', () => {
  const janela = { inicio: '2026-01-01', fim: '2026-01-20', totalDias: 20 };
  assert.equal(posicaoDeHoje(janela, '2026-01-11'), 50);
  assert.equal(posicaoDeHoje(janela, '2026-02-11'), undefined);
});

test('prazo vencido sem conclusão marca atraso', () => {
  const [barra] = barrasDoCronograma([], [], [frente], '2026-02-01');
  assert.equal(barra.atrasado, true);
  const [concluida] = barrasDoCronograma([], [], [{ ...frente, situacao: 'Concluída' }], '2026-02-01');
  assert.equal(concluida.atrasado, false);
  assert.equal(concluida.progresso, 100);
});
