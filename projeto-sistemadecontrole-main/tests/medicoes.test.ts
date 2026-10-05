import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acumuladoMedido,
  excedentesDoContrato,
  itensSugeridos,
  proximoNumeroMedicao,
  totalMedicao,
  validarMedicao,
} from '../src/utils/medicoes';
import type { Medicao, RegistroProducao, ServicoObra } from '../src/types';

const servico = (id: string, previsto?: number): ServicoObra => ({
  id,
  descricao: `Serviço ${id}`,
  unidade: 'm³',
  quantidadePrevista: previsto,
  situacao: 'Ativo',
  ativo: true,
  criadoEm: '2026-01-01',
  atualizadoEm: '2026-01-01',
});

const producao = (id: string, servicoId: string, data: string, quantidade: number): RegistroProducao => ({
  id,
  data,
  servicoId,
  servicoDescricao: servicoId,
  unidade: 'm³',
  quantidade,
  responsavel: 'Deivid',
  ativo: true,
  criadoEm: data,
  atualizadoEm: data,
});

const medicao = (extra: Partial<Medicao> = {}): Medicao => ({
  id: 'm1',
  numero: 'MED-2026-001',
  periodoInicio: '2026-01-01',
  periodoFim: '2026-01-31',
  itens: [{ servicoId: 's1', servicoDescricao: 'Serviço s1', unidade: 'm³', quantidade: 60 }],
  situacao: 'Aprovada',
  responsavel: 'Deivid',
  ativo: true,
  criadoEm: '2026-02-01',
  atualizadoEm: '2026-02-01',
  ...extra,
});

test('itens sugeridos vêm da produção do período e ignoram serviço sem produção', () => {
  const itens = itensSugeridos(
    [servico('s1'), servico('s2')],
    [producao('1', 's1', '2026-01-10', 30), producao('2', 's1', '2026-02-02', 5), producao('3', 's2', '2026-01-11', 0)],
    '2026-01-01',
    '2026-01-31',
  );
  assert.deepEqual(itens.map(item => [item.servicoId, item.quantidade]), [['s1', 30]]);
});

test('total soma só item com preço informado', () => {
  assert.equal(totalMedicao([
    { servicoId: 's1', servicoDescricao: 'a', unidade: 'm³', quantidade: 10, valorUnitario: 25.5 },
    { servicoId: 's2', servicoDescricao: 'b', unidade: 'm³', quantidade: 10 },
  ]), 255);
});

test('acumulado medido considera enviadas e aprovadas, não rascunho', () => {
  const medicoes = [medicao(), medicao({ id: 'm2', situacao: 'Em elaboração' }), medicao({ id: 'm3', situacao: 'Enviada' })];
  assert.equal(acumuladoMedido(medicoes, 's1'), 120);
  assert.equal(acumuladoMedido(medicoes, 's1', 'm1'), 60);
});

test('excedente de contrato é informado, não bloqueia', () => {
  const atual = { id: 'm9', itens: [{ servicoId: 's1', servicoDescricao: 'Serviço s1', unidade: 'm³', quantidade: 50 }] };
  const excedentes = excedentesDoContrato(atual, [medicao()], [servico('s1', 100)]);
  assert.deepEqual(excedentes, [{ servicoId: 's1', servicoDescricao: 'Serviço s1', previsto: 100, acumulado: 110, excedente: 10 }]);
  assert.equal(validarMedicao({ ...medicao({ id: 'm9' }), itens: atual.itens, situacao: 'Aprovada' }), null);
  assert.equal(excedentesDoContrato(atual, [medicao()], [servico('s1')]).length, 0);
});

test('período invertido, quantidade negativa e envio vazio são recusados', () => {
  assert.match(String(validarMedicao({ periodoInicio: '2026-02-01', periodoFim: '2026-01-01', itens: [], situacao: 'Em elaboração' })), /anterior à inicial/);
  assert.match(String(validarMedicao({ periodoInicio: '2026-01-01', periodoFim: '2026-01-31', itens: [{ servicoId: 's1', servicoDescricao: 'a', unidade: 'm³', quantidade: -1 }], situacao: 'Em elaboração' })), /negativa/);
  assert.match(String(validarMedicao({ periodoInicio: '2026-01-01', periodoFim: '2026-01-31', itens: [], situacao: 'Enviada' })), /ao menos um item/);
});

test('numeração sequencial por ano', () => {
  assert.equal(proximoNumeroMedicao([], 2026), 'MED-2026-001');
  assert.equal(proximoNumeroMedicao([medicao({ numero: 'MED-2026-009' })], 2026), 'MED-2026-010');
});
