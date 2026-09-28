import assert from 'node:assert/strict';
import test from 'node:test';
import type { Abastecimento, ControleEquipamentoDiario, Equipamento, GrupoEquipe } from '../src/types';
import { FILTROS_VAZIOS, SEM_CANTEIRO, SEM_FRENTE, agruparPorCanteiro, calcularIndicadores, etiquetasDosFiltros, filtrarCartoes, montarQuadro, registroDaEdicao, silhuetaDo } from '../src/modules/frota/quadroFrota';

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

  const grupos = agruparPorCanteiro(cartoes);
  assert.deepEqual(grupos.map(item => item.canteiro), ['SP-066', 'IBAR', 'Padre Eustáquio', 'Marginal', 'Barraca do Coco', 'Fábrica', SEM_CANTEIRO]);
  assert.equal(grupos[1].cartoes.length, 2, 'IBAR vem do nome da frente');
  assert.equal(grupos[1].operando, 2);
  assert.equal(grupos[3].manutencao, 1);
  assert.deepEqual(agruparPorCanteiro(cartoes, false).map(item => item.canteiro), ['IBAR', 'Marginal', SEM_CANTEIRO], 'filtrando, só aparece canteiro com máquina');

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

test('filtros detalhados, ordem e etiquetas', () => {
  const cartoes = montarQuadro({
    dia,
    equipamentos: [
      equipamento('B1', { marca: 'Volvo', foto: 'data:x' }),
      equipamento('B2', { marca: 'CAT' }),
      equipamento('B3', { marca: 'CAT' }),
    ],
    registros: [
      registro('B1', 'Em operação', { nomeMotorista: 'Zeca' }),
      registro('B2', 'Em manutenção'),
      registro('B3', 'Em operação', { nomeMotorista: 'Ana' }),
    ],
    gruposEquipe: [],
    abastecimentos: [abastecimento('B1', dia, 900), abastecimento('B3', dia, 3000)],
  });
  assert.deepEqual(filtrarCartoes(cartoes, { ...FILTROS_VAZIOS, marca: 'CAT' }).map(item => item.prefixo), ['B2', 'B3']);
  assert.deepEqual(filtrarCartoes(cartoes, { ...FILTROS_VAZIOS, foto: 'com' }).map(item => item.prefixo), ['B1']);
  assert.deepEqual(filtrarCartoes(cartoes, { ...FILTROS_VAZIOS, horimetro: 'sem' }).map(item => item.prefixo), ['B2']);
  assert.deepEqual(filtrarCartoes(cartoes, FILTROS_VAZIOS, 'horimetro-maior').map(item => item.prefixo), ['B3', 'B1', 'B2'], 'sem horímetro vai para o fim');
  assert.deepEqual(filtrarCartoes(cartoes, FILTROS_VAZIOS, 'situacao').map(item => item.prefixo), ['B2', 'B1', 'B3'], 'manutenção primeiro');
  assert.deepEqual(filtrarCartoes(cartoes, FILTROS_VAZIOS, 'operador').map(item => item.prefixo), ['B3', 'B1', 'B2']);
  assert.deepEqual(etiquetasDosFiltros({ ...FILTROS_VAZIOS, canteiro: 'IBAR', foto: 'sem' }).map(item => item.texto), ['Canteiro: IBAR', 'Sem foto']);
});

test('canteiro escolhido num dia continua nos dias seguintes', () => {
  const [cartao] = montarQuadro({
    dia,
    equipamentos: [equipamento('C1')],
    registros: [registro('C1', 'Em operação', { data: '2026-09-20', local: 'Fábrica' })],
    gruposEquipe: [],
    abastecimentos: [],
  });
  assert.equal(cartao.canteiro, 'Fábrica');
  assert.equal(cartao.grupo, 'sem-lancamento', 'o canteiro vem junto, a situação não');
});

test('lançar no quadro grava o dia no formato do Controle de Frotas', () => {
  const base = { dia, hora: '07:15', agora: `${dia}T10:15:00.000Z`, usuario: 'Deivid', equipamento: equipamento('D1'), funcionarios: [{ id: 'f1', nome: 'José da Silva', matricula: '123', ativo: true } as never] };
  const edicao = { status: 'Em operação' as const, canteiro: 'IBAR', frente: 'Ramo 900', operador: 'jose da silva', motivoManutencao: '', observacao: '' };

  const semOperador = registroDaEdicao({ ...base, registros: [], edicao: { ...edicao, operador: '' } });
  assert.equal(semOperador.ok, false);
  const semMotivo = registroDaEdicao({ ...base, registros: [], edicao: { ...edicao, status: 'Em manutenção' } });
  assert.equal(semMotivo.ok, false);

  const novo = registroDaEdicao({ ...base, registros: [], edicao });
  assert.ok(novo.ok && novo.novo);
  if (!novo.ok) return;
  assert.equal(novo.registro.chave, `${dia}|D1`);
  assert.equal(novo.registro.funcionarioId, 'f1', 'operador digitado sem acento acha o colaborador');
  assert.equal(novo.registro.nomeMotorista, 'José da Silva');
  assert.equal(novo.registro.local, 'IBAR');
  assert.equal(novo.registro.frenteServico, 'Ramo 900');
  assert.equal(novo.registro.horaSaida, '07:15');
  assert.equal(novo.registro.aprovacao?.status, 'PENDENTE');
  assert.equal(novo.registro.eventos?.[0].tipo, 'SAIDA_OPERACAO');

  const manutencao = registroDaEdicao({ ...base, hora: '09:00', agora: `${dia}T12:00:00.000Z`, registros: [novo.registro], edicao: { ...edicao, status: 'Em manutenção', motivoManutencao: 'Mangueira' } });
  assert.ok(manutencao.ok && !manutencao.novo);
  if (!manutencao.ok) return;
  assert.equal(manutencao.registro.id, novo.registro.id, 'edita o mesmo lançamento do dia');
  assert.equal(manutencao.registro.horaSaida, '07:15', 'a saída não muda');
  assert.equal(manutencao.registro.horaEntradaManutencao, '09:00');
  assert.equal(manutencao.registro.eventos?.length, 2);
  assert.equal(manutencao.registro.eventos?.[1].tipo, 'ENTRADA_MANUTENCAO');

  const liberada = registroDaEdicao({ ...base, hora: '11:30', agora: `${dia}T14:30:00.000Z`, registros: [manutencao.registro], edicao: { ...edicao, operador: 'Fulano de Fora' } });
  assert.ok(liberada.ok);
  if (!liberada.ok) return;
  assert.equal(liberada.registro.horaLiberacao, '11:30');
  assert.equal(liberada.registro.eventos?.[2].tipo, 'LIBERACAO_MANUTENCAO');
  assert.equal(liberada.registro.motoristaTemporario, true, 'nome fora da lista vira temporário');
  assert.equal(liberada.registro.funcionarioId, '');
});
