import assert from 'node:assert/strict';
import test from 'node:test';
import type { Abastecimento, ControleEquipamentoDiario, Equipamento, GrupoEquipe } from '../src/types';
import { abastecidasSemLancamento, avisosDoAbastecimento, contextoDoAbastecimento, lerNumero, operandoSemAbastecer } from '../src/modules/frota/combustivelDoDia';
import { FILTROS_VAZIOS, SEM_CANTEIRO, SEM_FRENTE, agruparPorCanteiro, calcularIndicadores, etiquetasDosFiltros, filtrarCartoes, lancarEmLote, montarQuadro, rascunhosDoUltimoDia, registroDaEdicao, silhuetaDo } from '../src/modules/frota/quadroFrota';

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
  assert.deepEqual(grupos.map(item => item.canteiro), ['SP-066', 'IBAR', 'Padre Eustáquio', 'Marginal', 'Barraca do Coco', 'Fábrica', 'Pátio Aracaré', SEM_CANTEIRO]);
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
  assert.equal(tipo('Cavalo Mecânico'), 'cavalo');
  assert.equal(silhuetaDo({ tipo: 'Veículo', nome: 'Cavalo mecânico Scania', familia: undefined, categoriaFrota: 'Veículo' } as never), 'cavalo');
  assert.equal(tipo('Trator de esteira'), 'trator');
  assert.equal(tipo('Guindaste'), 'guindaste');
  assert.equal(tipo('Guindaste sobre pneus'), 'guindaste');
  assert.equal(tipo('Gerador'), 'gerador');
  assert.equal(tipo('Grupo Gerador 180kVA'), 'gerador');
  assert.equal(tipo('Caminhão munck'), 'caminhao', 'munck continua como caminhão, o guindaste é só o implemento embarcado');
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
  const [aracare] = montarQuadro({ dia, equipamentos: [equipamento('C2')], registros: [registro('C2', 'Em operação', { frenteServico: 'Pátio de Vigas Aracaré' })], gruposEquipe: [], abastecimentos: [] });
  assert.equal(aracare.canteiro, 'Pátio Aracaré', 'apelido do pátio acha o canteiro');
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

test('lançamento em lote grava as prontas e aponta o erro de cada linha', () => {
  const base = { dia, hora: '07:00', agora: `${dia}T10:00:00.000Z`, usuario: 'Deivid', registros: [] as ControleEquipamentoDiario[], funcionarios: [] };
  const vazio = { canteiro: 'IBAR', frente: '', operador: 'Ana', motivoManutencao: '', observacao: '' };
  const { prontos, erros } = lancarEmLote({
    ...base,
    equipamentos: [equipamento('L1'), equipamento('L2'), equipamento('L3')],
    rascunhos: [
      { equipamentoId: 'L1', rascunho: { ...vazio, status: 'Em operação' } },
      { equipamentoId: 'L2', rascunho: { ...vazio, status: '' } },
      { equipamentoId: 'L3', rascunho: { ...vazio, status: 'Em manutenção' } },
      { equipamentoId: 'SUMIU', rascunho: { ...vazio, status: 'Disponível' } },
    ],
  });
  assert.deepEqual(prontos.map(item => item.registro.equipamentoId), ['L1']);
  assert.equal(prontos[0].novo, true);
  assert.equal(erros.get('L2'), 'Escolha a situação.');
  assert.ok(erros.get('L3'), 'manutenção sem motivo não passa');
  assert.ok(erros.get('SUMIU'));
});

test('repetir último dia copia o lançamento anterior mais recente, sem os excluídos', () => {
  const rascunhos = rascunhosDoUltimoDia([
    registro('R1', 'Em operação', { data: '2026-09-25', local: 'IBAR', nomeMotorista: 'Ana' }),
    registro('R1', 'Em manutenção', { data: '2026-09-27', local: 'Pátio Aracaré', motivoManutencao: 'Pneu', nomeMotorista: 'Bia' }),
    registro('R1', 'Em operação', { data: dia, local: 'SP-066' }),
    registro('R2', 'Disponível', { data: '2026-09-27', excluido: true }),
    registro('R3', 'Disponível', { data: '2026-09-27', local: 'Marginal' }),
  ], ['R1', 'R2'], dia);
  assert.deepEqual([...rascunhos.keys()], ['R1'], 'R2 só tem excluído e R3 não foi pedido');
  const r1 = rascunhos.get('R1')!;
  assert.equal(r1.status, 'Em manutenção');
  assert.equal(r1.canteiro, 'Pátio Aracaré');
  assert.equal(r1.operador, 'Bia');
  assert.equal(r1.motivoManutencao, 'Pneu');
});

test('combustível do dia: leitura, avisos e listas de quem falta lançar', () => {
  const dia0 = '2026-09-28';
  const cartoes = montarQuadro({
    dia: dia0,
    equipamentos: [equipamento('K1'), equipamento('K2'), equipamento('K3'), equipamento('K4')],
    registros: [
      registro('K1', 'Em operação', { nomeMotorista: 'Ana', local: 'IBAR', frenteServico: 'Ramo 900' }),
      registro('K2', 'Em manutenção', { motivoManutencao: 'Pneu' }),
      registro('K3', 'Em operação', { nomeMotorista: 'Bia' }),
    ],
    gruposEquipe: [],
    abastecimentos: [],
  });
  const abast = (equipamentoId: string, data: string, hora: string, horimetroInicial: number, kmInicial = 0, extra: Record<string, unknown> = {}) =>
    ({ id: `${equipamentoId}${data}${hora}`, equipamentoId, data, hora, horimetroInicial, kmInicial, quantidadeLitros: 100, ...extra }) as unknown as Abastecimento;
  const lista = [abast('K1', '2026-09-20', '07:00', 1200), abast('K1', '2026-09-27', '07:00', 1250, 90), abast('K1', dia0, '06:00', 1260), abast('K1', '2026-09-26', '07:00', 9999, 0, { inativoEm: '2026-09-26' }), abast('K2', dia0, '08:00', 50)];
  const k1 = cartoes.find(item => item.prefixo === 'K1')!;

  const contexto = contextoDoAbastecimento({ dia: dia0, hora: '10:00', cartao: k1, abastecimentos: lista });
  assert.equal(contexto.operador, 'Ana');
  assert.equal(contexto.canteiro, 'IBAR');
  assert.equal(contexto.frente, 'Ramo 900');
  assert.equal(contexto.ultimoHorimetro?.valor, 1260, 'o de hoje às 06:00 vale, o inativo não');
  assert.equal(contexto.ultimoKm?.valor, 90);
  assert.equal(contexto.litrosNoDia, 100);
  assert.equal(contextoDoAbastecimento({ dia: dia0, hora: '05:00', cartao: k1, abastecimentos: lista }).ultimoHorimetro?.valor, 1250, 'não olha leitura de hora posterior');

  const textos = (h?: number, km?: number, c = contexto) => avisosDoAbastecimento({ contexto: c, horimetro: h, km }).map(item => item.texto);
  assert.ok(textos(1000).some(texto => texto.startsWith('Horímetro menor')));
  assert.ok(!textos(1300).some(texto => texto.startsWith('Horímetro menor')));
  assert.ok(textos(undefined, 10).some(texto => texto.startsWith('Km menor')));
  const k2 = cartoes.find(item => item.prefixo === 'K2')!;
  assert.ok(textos(undefined, undefined, contextoDoAbastecimento({ dia: dia0, hora: '10:00', cartao: k2, abastecimentos: [] })).some(texto => texto.includes('manutenção')));
  const k4 = cartoes.find(item => item.prefixo === 'K4')!;
  assert.ok(textos(undefined, undefined, contextoDoAbastecimento({ dia: dia0, hora: '10:00', cartao: k4, abastecimentos: [] })).some(texto => texto.includes('não tem lançamento')));

  assert.deepEqual(operandoSemAbastecer(cartoes, lista, dia0).map(item => item.prefixo), ['K3'], 'K1 já abasteceu; K2 está em manutenção');
  assert.deepEqual(abastecidasSemLancamento(cartoes, [abast('K4', dia0, '09:00', 0)], dia0).map(item => item.prefixo), ['K4']);

  assert.equal(lerNumero('1.250,5'), 1250.5);
  assert.equal(lerNumero('1250,5'), 1250.5);
  assert.equal(lerNumero('1.250'), 1250, 'ponto seguido de três dígitos é milhar');
  assert.equal(lerNumero('12.5'), 12.5);
  assert.equal(lerNumero('  '), undefined);
  assert.equal(lerNumero('abc'), undefined);
});
