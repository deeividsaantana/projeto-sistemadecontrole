import assert from 'node:assert/strict';
import test from 'node:test';
import {
  consolidarCustos,
  custoPrevistoManutencao,
  custosDeOutrosModulos,
  custosPor,
  totalCustos,
  validarLancamentoCusto,
} from '../src/utils/custos';
import type { Abastecimento, LancamentoCusto, OrdemServico } from '../src/types';

const abastecimento = (id: string, data: string, custoTotal?: number): Abastecimento => ({
  id, data, hora: '08:00', equipamentoId: 'eq1', horimetroInicial: 0, kmInicial: 0,
  bombaInicial: 0, quantidadeLitros: 100, bombaFinal: 100, tipoCombustivelId: 'c1',
  comboioId: 'cb1', responsavel: 'D', observacao: '', custoTotal,
} as Abastecimento);

const ordem = (id: string, extra: Partial<OrdemServico> = {}): OrdemServico => ({
  id, numero: `OS-${id}`, equipamentoId: 'eq1', tipo: 'Corretiva', prioridade: 'Alta',
  status: 'Concluída', dataAbertura: '2026-01-05', dataConclusao: '2026-01-08',
  responsavel: 'D', observacao: '', custoFinal: 500, custoEstimado: 400,
  ...extra,
} as OrdemServico);

test('custo estimado de OS aberta não entra como realizado', () => {
  const derivados = custosDeOutrosModulos(
    [],
    [ordem('1'), ordem('2', { status: 'Em Andamento', dataConclusao: undefined, custoFinal: undefined })],
    '2026-01-01',
    '2026-01-31',
  );
  assert.deepEqual(derivados.map(item => item.valor), [500]);
  assert.equal(custoPrevistoManutencao([ordem('2', { status: 'Em Andamento', custoEstimado: 400 })]), 400);
});

test('abastecimento sem custo informado não vira custo zero', () => {
  const derivados = custosDeOutrosModulos(
    [abastecimento('1', '2026-01-10', 800), abastecimento('2', '2026-01-11')],
    [],
    '2026-01-01',
    '2026-01-31',
  );
  assert.equal(derivados.length, 1);
  assert.equal(derivados[0].origem, 'Abastecimento');
});

test('consolidado junta módulos e lançamentos e agrupa por categoria', () => {
  const lancamento: LancamentoCusto = {
    id: 'l1', data: '2026-01-12', categoria: 'Locação', descricao: 'Locação de betoneira',
    valor: 1200, responsavel: 'D', ativo: true, criadoEm: '', atualizadoEm: '',
  };
  const custos = consolidarCustos(
    custosDeOutrosModulos([abastecimento('1', '2026-01-10', 800)], [ordem('1')], '2026-01-01', '2026-01-31'),
    [lancamento, { ...lancamento, id: 'l2', ativo: false }],
    '2026-01-01',
    '2026-01-31',
  );
  assert.equal(custos.length, 3);
  assert.equal(totalCustos(custos), 2500);
  assert.deepEqual(custosPor(custos, item => item.categoria)[0], { grupo: 'Locação', valor: 1200 });
});

test('combustível e manutenção não podem ser lançados à mão', () => {
  const base = { data: '2026-01-10', descricao: 'x', valor: 10 };
  assert.match(String(validarLancamentoCusto({ ...base, categoria: 'Combustível' })), /vem dos abastecimentos/);
  assert.match(String(validarLancamentoCusto({ ...base, categoria: 'Manutenção' })), /custo final da ordem/);
  assert.equal(validarLancamentoCusto({ ...base, categoria: 'Locação' }), null);
  assert.match(String(validarLancamentoCusto({ ...base, valor: 0, categoria: 'Locação' })), /maior que zero/);
});
