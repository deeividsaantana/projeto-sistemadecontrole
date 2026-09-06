import assert from 'node:assert/strict';
import test from 'node:test';
import { aderenciaDosPlanos, planosNoPeriodo, producaoDoPlano, validarPlano } from '../src/utils/planejamento';
import type { PlanejamentoItem, RegistroProducao } from '../src/types';

const plano = (extra: Partial<PlanejamentoItem> = {}): PlanejamentoItem => ({
  id: 'p1',
  dataInicio: '2026-01-05',
  dataFim: '2026-01-09',
  servicoId: 's1',
  servicoDescricao: 'Escavação',
  unidade: 'm³',
  quantidadePlanejada: 100,
  responsavel: 'Deivid',
  situacao: 'Planejado',
  ativo: true,
  criadoEm: '2026-01-01',
  atualizadoEm: '2026-01-01',
  ...extra,
});

const producao = (id: string, data: string, quantidade: number, extra: Partial<RegistroProducao> = {}): RegistroProducao => ({
  id,
  data,
  servicoId: 's1',
  servicoDescricao: 'Escavação',
  unidade: 'm³',
  quantidade,
  responsavel: 'Deivid',
  ativo: true,
  criadoEm: data,
  atualizadoEm: data,
  ...extra,
});

test('produção fora do período ou de outra equipe não conta para o plano', () => {
  const registros = [
    producao('1', '2026-01-05', 30),
    producao('2', '2026-01-12', 40),
    producao('3', '2026-01-06', 20, { grupoId: 'g2' }),
  ];
  assert.equal(producaoDoPlano(plano(), registros).length, 3 - 1);
  assert.equal(producaoDoPlano(plano({ grupoId: 'g2' }), registros).length, 1);
});

test('aderência compara planejado com o realizado do período', () => {
  const [resultado] = aderenciaDosPlanos(
    [plano()],
    [producao('1', '2026-01-05', 30), producao('2', '2026-01-08', 20)],
    '2026-01-07',
  );
  assert.equal(resultado.realizado, 50);
  assert.equal(resultado.saldo, 50);
  assert.equal(resultado.aderencia, 50);
  assert.equal(resultado.atrasado, false);
});

test('plano vencido e incompleto aparece como atrasado; concluído não', () => {
  const [aberto] = aderenciaDosPlanos([plano()], [producao('1', '2026-01-05', 10)], '2026-01-20');
  assert.equal(aberto.atrasado, true);
  const [fechado] = aderenciaDosPlanos([plano({ situacao: 'Concluído' })], [], '2026-01-20');
  assert.equal(fechado.atrasado, false);
});

test('período traz planos que apenas cruzam o intervalo', () => {
  assert.equal(planosNoPeriodo([plano()], '2026-01-08', '2026-01-15').length, 1);
  assert.equal(planosNoPeriodo([plano()], '2026-01-10', '2026-01-15').length, 0);
});

test('plano inválido é recusado antes de salvar', () => {
  assert.equal(validarPlano({ dataInicio: '2026-01-05', dataFim: '2026-01-09', servicoId: '', quantidadePlanejada: 10 }), 'Selecione o serviço.');
  assert.equal(validarPlano({ dataInicio: '2026-01-09', dataFim: '2026-01-05', servicoId: 's1', quantidadePlanejada: 10 }), 'A data final não pode ser anterior à inicial.');
  assert.equal(validarPlano({ dataInicio: '2026-01-05', dataFim: '2026-01-09', servicoId: 's1', quantidadePlanejada: 0 }), 'Informe a quantidade planejada.');
  assert.equal(validarPlano({ dataInicio: '2026-01-05', dataFim: '2026-01-09', servicoId: 's1', quantidadePlanejada: 10 }), null);
});
