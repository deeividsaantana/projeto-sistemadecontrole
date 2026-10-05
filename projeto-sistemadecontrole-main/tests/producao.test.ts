import assert from 'node:assert/strict';
import test from 'node:test';
import { acumuladoDoServico, avancoDosServicos, producaoPorDia, validarProducao } from '../src/utils/producao';
import type { RegistroProducao, ServicoObra } from '../src/types';

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

const registro = (id: string, servicoId: string, data: string, quantidade: number, ativo = true): RegistroProducao => ({
  id,
  data,
  servicoId,
  servicoDescricao: 'x',
  unidade: 'm³',
  quantidade,
  responsavel: 'Deivid',
  ativo,
  criadoEm: data,
  atualizadoEm: data,
});

test('acumulado soma só lançamentos ativos e respeita a data limite', () => {
  const registros = [
    registro('1', 's1', '2026-01-02', 10),
    registro('2', 's1', '2026-01-05', 5),
    registro('3', 's1', '2026-01-06', 100, false),
    registro('4', 's2', '2026-01-02', 7),
  ];
  assert.equal(acumuladoDoServico(registros, 's1'), 15);
  assert.equal(acumuladoDoServico(registros, 's1', '2026-01-03'), 10);
});

test('sem quantidade prevista não existe percentual inventado', () => {
  const [comMeta, semMeta] = avancoDosServicos(
    [servico('s1', 100), servico('s2')],
    [registro('1', 's1', '2026-01-02', 25), registro('2', 's2', '2026-01-02', 40)],
  );
  assert.equal(comMeta.percentual, 25);
  assert.equal(comMeta.saldo, 75);
  assert.equal(semMeta.percentual, undefined);
  assert.equal(semMeta.saldo, undefined);
  assert.equal(semMeta.acumulado, 40);
});

test('produção por dia agrupa em ordem cronológica', () => {
  const dias = producaoPorDia([
    registro('1', 's1', '2026-01-05', 4),
    registro('2', 's1', '2026-01-02', 6),
    registro('3', 's1', '2026-01-05', 1),
  ]);
  assert.deepEqual(dias, [
    { data: '2026-01-02', quantidade: 6 },
    { data: '2026-01-05', quantidade: 5 },
  ]);
});

test('lançamento inválido é recusado antes de salvar', () => {
  assert.equal(validarProducao({ data: '', servicoId: 's1', quantidade: 5 }), 'Informe a data.');
  assert.equal(validarProducao({ data: '2026-01-02', servicoId: '', quantidade: 5 }), 'Selecione o serviço.');
  assert.equal(validarProducao({ data: '2026-01-02', servicoId: 's1', quantidade: 0 }), 'Informe uma quantidade maior que zero.');
  assert.equal(validarProducao({ data: '2026-01-02', servicoId: 's1', quantidade: 5 }), null);
});
