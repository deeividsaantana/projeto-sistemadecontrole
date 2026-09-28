import assert from 'node:assert/strict';
import test from 'node:test';
import type { FrenteServico, PlanejamentoItem, RegistroProducao, ServicoObra } from '../src/types';
import { SEM_FRENTE, avancoPorFrente, resumoDasFrentes } from '../src/modules/rotina/avancoFrentes';

const agora = '2026-09-01T00:00:00Z';
const servicos: ServicoObra[] = [
  { id: 'aterro', descricao: 'Aterro compactado', unidade: 'm³', situacao: 'Ativo', ativo: true, criadoEm: agora, atualizadoEm: agora },
  { id: 'corte', descricao: 'Corte', unidade: 'm³', situacao: 'Ativo', ativo: true, criadoEm: agora, atualizadoEm: agora },
];
const frente = (nome: string, extra: Partial<FrenteServico> = {}): FrenteServico => ({ id: nome, nome, situacao: 'Em execução', ativo: true, criadoEm: agora, atualizadoEm: agora, ...extra });
const producao = (id: string, data: string, servicoId: string, quantidade: number, frenteNome?: string, extra: Partial<RegistroProducao> = {}): RegistroProducao => ({
  id, data, servicoId, servicoDescricao: servicoId, unidade: 'm³', quantidade, frente: frenteNome, responsavel: 'Deivid', ativo: true, criadoEm: agora, atualizadoEm: agora, ...extra,
});
const plano = (id: string, servicoId: string, quantidadePlanejada: number, frenteNome: string, dataInicio: string, dataFim: string, extra: Partial<PlanejamentoItem> = {}): PlanejamentoItem => ({
  id, servicoId, servicoDescricao: servicoId, unidade: 'm³', quantidadePlanejada, frente: frenteNome, dataInicio, dataFim, responsavel: 'Deivid', situacao: 'Planejado', ativo: true, criadoEm: agora, atualizadoEm: agora, ...extra,
});

const dia = '2026-09-20';

test('avanço e saldo por frente contam a produção do período do previsto', () => {
  const avanco = avancoPorFrente(dia, [frente('Ramo 900')], servicos, [
    producao('a', '2026-08-30', 'aterro', 500, 'Ramo 900'),
    producao('b', '2026-09-10', 'aterro', 1000, 'ramo 900'),
    producao('c', dia, 'aterro', 250, 'Ramo 900'),
    producao('d', '2026-09-21', 'aterro', 999, 'Ramo 900'),
    producao('e', dia, 'aterro', 777, 'Ramo 900', { ativo: false }),
  ], [plano('p', 'aterro', 5000, 'Ramo 900', '2026-09-01', '2026-09-30')]);
  assert.equal(avanco.length, 1);
  const [linha] = avanco[0].linhas;
  assert.deepEqual(
    { hoje: linha.hoje, acumulado: linha.acumulado, previsto: linha.previsto, percentual: linha.percentual, saldo: linha.saldo, servico: linha.servico },
    { hoje: 250, acumulado: 1250, previsto: 5000, percentual: 25, saldo: 3750, servico: 'Aterro compactado' },
  );
  assert.equal(avanco[0].trabalhouHoje, true);
});

test('sem previsto não há percentual nem saldo, e o acumulado é de toda a frente', () => {
  const [ramo] = avancoPorFrente(dia, [], servicos, [producao('a', '2026-09-01', 'corte', 100, 'Ramo 200'), producao('b', dia, 'corte', 40, 'Ramo 200')], []);
  const [linha] = ramo.linhas;
  assert.equal(linha.acumulado, 140);
  assert.equal(linha.percentual, undefined);
  assert.equal(linha.saldo, undefined);
});

test('frente ativa sem produção aparece parada; concluída, cancelada e fora do período ficam de fora', () => {
  const avanco = avancoPorFrente(dia, [frente('Ramo 700'), frente('Ramo 100', { situacao: 'Concluída' }), frente('Ramo 300', { ativo: false })], servicos, [
    producao('a', dia, 'corte', 10),
  ], [
    plano('cancelado', 'aterro', 100, 'Ramo 700', '2026-09-01', '2026-09-30', { situacao: 'Cancelado' }),
    plano('passado', 'aterro', 100, 'Ramo 700', '2026-08-01', '2026-08-31'),
  ]);
  assert.deepEqual(avanco.map(item => item.nome), [SEM_FRENTE, 'Ramo 700']);
  assert.equal(avanco[1].linhas.length, 0);
  assert.deepEqual(resumoDasFrentes(avanco), { trabalharam: 1, semProducao: 1, semPrevisto: 1 });
});

test('previsto valendo aparece mesmo sem produção no dia', () => {
  const [ramo] = avancoPorFrente(dia, [frente('Ramo 1400')], servicos, [], [plano('p', 'corte', 800, 'Ramo 1400', '2026-09-15', '2026-10-15')]);
  assert.deepEqual(ramo.linhas.map(linha => [linha.servico, linha.acumulado, linha.percentual, linha.saldo, linha.desde, linha.ate]), [['Corte', 0, 0, 800, '2026-09-15', '2026-10-15']]);
  assert.equal(ramo.trabalhouHoje, false);
});
