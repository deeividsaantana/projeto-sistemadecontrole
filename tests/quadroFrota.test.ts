import assert from 'node:assert/strict';
import test from 'node:test';
import type { Abastecimento, ControleEquipamentoDiario, Equipamento, GrupoEquipe } from '../src/types';
import { FILTROS_VAZIOS, SEM_FRENTE, agruparPorFrente, calcularIndicadores, filtrarCartoes, montarQuadro, silhuetaDo } from '../src/modules/frota/quadroFrota';

const dia = '2026-09-28';
const equipamento = (id: string, extra: Partial<Equipamento> = {}) => ({ id, prefixo: id, nome: 'Escavadeira', tipo: 'Escavadeira', marca: 'Volvo', modelo: 'EC210', status: 'Ativo', ...extra }) as unknown as Equipamento;
const registro = (equipamentoId: string, status: ControleEquipamentoDiario['status'], extra: Record<string, unknown> = {}) =>
  ({ id: `${equipamentoId}-${dia}`, equipamentoId, data: dia, status, atualizadoEm: `${dia}T10:00:00Z`, ...extra }) as unknown as ControleEquipamentoDiario;
const abastecimento = (equipamentoId: string, data: string, horimetroInicial: number) => ({ id: `${equipamentoId}${data}`, equipamentoId, data, horimetroInicial }) as unknown as Abastecimento;

test('cada equipamento vai para a frente do lançamento do dia, e sem lançamento fica em Sem frente', () => {
  const cartoes = montarQuadro({
    dia,
    equipamentos: [equipamento('EC02'), equipamento('EC01'), equipamento('RC01', { tipo: 'Rolo compactador' }), equipamento('ANT', { status: 'Desmobilizado' })],
    registros: [
      registro('EC01', 'Em operação', { frenteServico: 'MARGINAL', nomeMotorista: 'Carlos' }),
      registro('EC01', 'Em manutenção', { frenteServico: 'IBAR', atualizadoEm: `${dia}T08:00:00Z` }),
      registro('EC02', 'Em manutenção', { equipeId: 'eq1' }),
      registro('RC01', 'Em operação', { data: '2026-09-27', frenteServico: 'IBAR' }),
    ],
    gruposEquipe: [{ id: 'eq1', frenteServico: 'PADRE EUSTÁQUIO' } as unknown as GrupoEquipe],
    abastecimentos: [abastecimento('EC01', '2026-09-20', 1200), abastecimento('EC01', '2026-09-27', 1250), abastecimento('EC01', '2026-09-29', 9999)],
  });
  assert.deepEqual(cartoes.map(item => item.prefixo), ['EC01', 'EC02', 'RC01'], 'desmobilizado sem lançamento sai do quadro');
  const [ec01, ec02, rc01] = cartoes;
  assert.equal(ec01.frente, 'MARGINAL', 'vale o lançamento mais recente');
  assert.equal(ec01.grupo, 'operando');
  assert.equal(ec01.operador, 'Carlos');
  assert.equal(ec01.horimetro, 1250, 'horímetro não usa abastecimento depois do dia');
  assert.equal(ec02.frente, 'PADRE EUSTÁQUIO', 'frente vem da equipe quando o lançamento não traz');
  assert.equal(ec02.grupo, 'manutencao');
  assert.equal(rc01.frente, SEM_FRENTE, 'lançamento de outro dia não conta');
  assert.equal(rc01.status, 'Sem lançamento');
  assert.equal(rc01.silhueta, 'rolo');
});

test('indicadores, colunas e filtros do quadro', () => {
  const cartoes = montarQuadro({
    dia,
    equipamentos: ['A1', 'A2', 'A3', 'A4'].map(id => equipamento(id)),
    registros: [
      registro('A1', 'Em operação', { frenteServico: 'IBAR', nomeMotorista: 'Ana' }),
      registro('A2', 'Em operação', { frenteServico: 'IBAR' }),
      registro('A3', 'Em manutenção', { frenteServico: 'MARGINAL' }),
    ],
    gruposEquipe: [],
    abastecimentos: [],
  });
  const indicadores = calcularIndicadores(cartoes);
  assert.equal(indicadores.total, 4);
  assert.equal(indicadores.operando, 2);
  assert.equal(indicadores.manutencao, 1);
  assert.equal(indicadores.semLancamento, 1);
  assert.equal(indicadores.disponibilidade, 67, 'sem lançamento não entra na disponibilidade');
  assert.equal(indicadores.comOperador, 1);
  assert.equal(calcularIndicadores([]).disponibilidade, null);

  const colunas = agruparPorFrente(cartoes, ['AV. BRASIL']);
  assert.deepEqual(colunas.map(item => item.frente), ['IBAR', 'MARGINAL', 'AV. BRASIL', SEM_FRENTE]);
  assert.equal(colunas[0].operando, 2);

  assert.deepEqual(filtrarCartoes(cartoes, { ...FILTROS_VAZIOS, operador: 'sem', grupo: 'operando' }).map(item => item.prefixo), ['A2']);
  assert.deepEqual(filtrarCartoes(cartoes, { ...FILTROS_VAZIOS, busca: 'ana ibar' }).map(item => item.prefixo), ['A1']);
});

test('desenho do cartão reconhece o tipo da máquina', () => {
  const tipo = (texto: string) => silhuetaDo({ tipo: texto, nome: '', familia: undefined, categoriaFrota: undefined } as never);
  assert.equal(tipo('Caminhão pipa'), 'pipa');
  assert.equal(tipo('Retroescavadeira'), 'retro');
  assert.equal(tipo('Motoniveladora'), 'motoniveladora');
  assert.equal(tipo('Caminhão basculante'), 'caminhao');
  assert.equal(tipo('Trator de esteira'), 'trator');
  assert.equal(tipo('Coisa estranha'), 'outro');
});
