import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MENSAGEM_PRAZO_NEGADO,
  PESSOAS_INICIAIS,
  abrirSolicitacao,
  acoesDisponiveis,
  aplicarAcao,
  estaEmAtraso,
  faltaEspecificacao,
  paraEsquemaJson,
  pessoaDoUsuario,
  proximoNumero,
  situacaoDe,
  type Ator,
  type Solicitacao,
} from '../src/utils/solicitacoes';
import {
  lerCsv,
  relatorioAprovador,
  relatorioLogistico,
  relatorioPorSolicitante,
  relatorioSuprimentos,
  validarImportacao,
} from '../src/utils/solicitacoesPlanilha';

const thiago: Ator = { nome: 'Thiago', papel: 'solicitante' };
const cassia: Ator = { nome: 'Cássia', papel: 'suprimentos' };
const bruno: Ator = { nome: 'Bruno', papel: 'aprovador' };
const almox: Ator = { nome: 'Almoxarife', papel: 'recebedor' };

const T0 = '2026-11-11T08:00:00.000Z';

const ok = (resultado: ReturnType<typeof aplicarAcao>): Solicitacao => {
  if ('erro' in resultado) assert.fail(resultado.erro);
  return resultado.solicitacao;
};

const nova = (parcial = true) => ok(abrirSolicitacao({
  solicitante: 'Thiago',
  frente: 'Ramo 1400',
  estacamento: 'Estaca 1401+0,00',
  itens: [{ tipo: 'Material', descricao: 'Vergalhão CA-50 ø 12,5 mm', quantidade: '10', unidade: 'ton', prazoDesejado: '2026-11-20', permiteParcial: parcial }],
}, thiago, [], T0, 'id-1'));

const pedido = { fornecedor: 'Aço Forte Ltda / 12.345.678/0001-90', valorTotal: 58000, janelaInicio: '2026-11-15', janelaFim: '2026-11-18' };

const ateAprovado = (parcial = true) => {
  let sol = ok(aplicarAcao(nova(parcial), { tipo: 'assumir' }, cassia, T0));
  sol = ok(aplicarAcao(sol, { tipo: 'enviarParaAprovacao', pedido }, cassia, '2026-11-11T14:00:00.000Z'));
  return ok(aplicarAcao(sol, { tipo: 'aprovar' }, bruno, '2026-11-12T09:00:00.000Z'));
};

test('abre com número SOL-ano-sequência e vai para a fila de Suprimentos', () => {
  const sol = nova();
  assert.equal(sol.numero, 'SOL-2026-0001');
  assert.equal(sol.etapa, 'Pendente Suprimentos');
  assert.equal(proximoNumero('SOL', ['SOL-2026-0007', 'SOL-2025-0099', undefined], 2026), 'SOL-2026-0008');
});

test('valida campos obrigatórios e só solicitante abre', () => {
  const base = { solicitante: 'Thiago', frente: 'Ramo 200', itens: [{ tipo: 'Material', descricao: 'Areia média', quantidade: '5', unidade: 'm³', prazoDesejado: '2026-11-20', permiteParcial: null }] };
  const semParcial = abrirSolicitacao(base, thiago, [], T0, 'x');
  assert.equal(semParcial.ok, false);
  assert.match((semParcial as { erro: string }).erro, /entrega parcial/);
  const unidadeErrada = abrirSolicitacao({ ...base, itens: [{ ...base.itens[0], permiteParcial: true, unidade: 'saco' }] }, thiago, [], T0, 'x');
  assert.match((unidadeErrada as { erro: string }).erro, /Unidade fora do padrão/);
  const porSuprimentos = abrirSolicitacao({ ...base, itens: [{ ...base.itens[0], permiteParcial: true }] }, cassia, [], T0, 'x');
  assert.equal(porSuprimentos.ok, false);
});

test('rigor técnico: aço, drenagem e pavimentação pedem o parâmetro de engenharia', () => {
  assert.match(faltaEspecificacao('Vergalhão CA-50') ?? '', /bitola/);
  assert.equal(faltaEspecificacao('Vergalhão CA-50 ø 10 mm'), null);
  assert.match(faltaEspecificacao('Tubo de concreto armado') ?? '', /diâmetro/);
  assert.equal(faltaEspecificacao('Tubo de concreto DN 800'), null);
  assert.match(faltaEspecificacao('CBUQ para capa') ?? '', /faixa/);
  assert.equal(faltaEspecificacao('CBUQ faixa C'), null);
  assert.equal(faltaEspecificacao('Brita nº 1'), null);
  assert.equal(faltaEspecificacao('Locação de caminhão pipa'), null);
});

test('fluxo completo: cotação, aprovação, trânsito e chegada', () => {
  let sol = ateAprovado();
  assert.equal(sol.numeroPedido, 'PC-2026-0001');
  assert.equal(sol.etapa, 'Aprovado');
  assert.equal(sol.statusAprovacao, 'Aprovado');
  sol = ok(aplicarAcao(sol, { tipo: 'despachar' }, cassia, '2026-11-15T07:00:00.000Z'));
  assert.equal(sol.statusLogistico, 'Em Trânsito');
  sol = ok(aplicarAcao(sol, { tipo: 'receber', recebimento: { tipo: 'Chegou ao Local', local: 'Canteiro Padre Eustáquio', notaFiscal: '4512', quantidades: { 1: 10 } } }, almox, '2026-11-16T10:00:00.000Z'));
  assert.equal(sol.etapa, 'Entregue');
  assert.equal(sol.statusLogistico, 'Chegou ao Local');
  assert.equal(sol.divergencia, undefined);
  assert.ok(sol.eventos.length >= 5);
});

test('rejeição volta para Suprimentos ajustar, com parecer obrigatório', () => {
  let sol = ok(aplicarAcao(nova(), { tipo: 'assumir' }, cassia, T0));
  sol = ok(aplicarAcao(sol, { tipo: 'enviarParaAprovacao', pedido }, cassia, T0));
  assert.equal(aplicarAcao(sol, { tipo: 'rejeitar', parecer: '' }, bruno, T0).ok, false);
  sol = ok(aplicarAcao(sol, { tipo: 'rejeitar', parecer: 'Preço acima da média, recotar' }, bruno, T0));
  assert.equal(sol.etapa, 'Em Cotação');
  assert.equal(sol.statusAprovacao, 'Rejeitado');
  assert.equal(sol.rejeicoes, 1);
  // Reenvio mantém o número do pedido.
  sol = ok(aplicarAcao(sol, { tipo: 'enviarParaAprovacao', pedido: { ...pedido, valorTotal: 52000 } }, cassia, T0));
  assert.equal(sol.numeroPedido, 'PC-2026-0001');
  assert.equal(aplicarAcao(sol, { tipo: 'aprovar', condicional: true }, bruno, T0).ok, false, 'condição exige texto');
});

test('só o aprovador aprova; só Suprimentos cota', () => {
  let sol = ok(aplicarAcao(nova(), { tipo: 'assumir' }, cassia, T0));
  assert.equal(aplicarAcao(sol, { tipo: 'enviarParaAprovacao', pedido }, thiago, T0).ok, false);
  sol = ok(aplicarAcao(sol, { tipo: 'enviarParaAprovacao', pedido }, cassia, T0));
  assert.equal(aplicarAcao(sol, { tipo: 'aprovar' }, cassia, T0).ok, false);
  assert.deepEqual(acoesDisponiveis(sol, bruno), ['aprovar', 'rejeitar']);
  assert.deepEqual(acoesDisponiveis(sol, thiago), []);
});

test('atraso automático depois do fim da janela sem confirmação', () => {
  const sol = ateAprovado();
  assert.equal(estaEmAtraso(sol, '2026-11-18'), false);
  assert.equal(situacaoDe(sol, '2026-11-19'), 'Em Atraso');
  assert.equal(paraEsquemaJson(sol, '2026-11-19').rastreamento_logistico.status_logistico_atual, 'Em Atraso');
});

test('reagendamento: só Suprimentos, com nova data e motivo, e o registro só cresce', () => {
  let sol = ateAprovado();
  const negado = aplicarAcao(sol, { tipo: 'reagendar', novaData: '2026-11-25', motivo: 'quero antes' }, thiago, T0);
  assert.deepEqual(negado, { ok: false, erro: MENSAGEM_PRAZO_NEGADO });
  assert.equal(aplicarAcao(sol, { tipo: 'reagendar', novaData: '2026-11-25', motivo: '' }, cassia, T0).ok, false);
  sol = ok(aplicarAcao(sol, { tipo: 'reagendar', novaData: '2026-11-25', motivo: 'Usina parada por chuva' }, cassia, '2026-11-19T08:00:00.000Z'));
  sol = ok(aplicarAcao(sol, { tipo: 'reagendar', novaData: '2026-11-27', motivo: 'Caminhão quebrado' }, cassia, '2026-11-24T08:00:00.000Z'));
  assert.equal(sol.janelaFim, '2026-11-27');
  assert.deepEqual(sol.reagendamentos.map(item => [item.anterior, item.nova, item.usuario]), [
    ['2026-11-18', '2026-11-25', 'Cássia'],
    ['2026-11-25', '2026-11-27', 'Cássia'],
  ]);
  assert.equal(estaEmAtraso(sol, '2026-11-20'), false);
  assert.ok(!acoesDisponiveis(sol, thiago).includes('reagendar'));
});

test('entrega parcial: Suprimentos fraciona só quando o item aceita, e o saldo fica aberto', () => {
  let sol = ok(aplicarAcao(nova(false), { tipo: 'assumir' }, cassia, T0));
  assert.equal(aplicarAcao(sol, { tipo: 'enviarParaAprovacao', pedido: { ...pedido, quantidades: { 1: 6 } } }, cassia, T0).ok, false);

  sol = ateAprovado(true);
  sol = ok(aplicarAcao(sol, { tipo: 'receber', recebimento: { tipo: 'Chegou ao Local', local: 'Almoxarifado Central', notaFiscal: '100', quantidades: { 1: 4 } } }, almox, '2026-11-16T10:00:00.000Z'));
  assert.equal(sol.etapa, 'Em Trânsito');
  assert.equal(paraEsquemaJson(sol, '2026-11-16').processamento_suprimentos.saldo_remanescente_pendente, 6);
  sol = ok(aplicarAcao(sol, { tipo: 'receber', recebimento: { tipo: 'Chegou ao Local', local: 'Almoxarifado Central', notaFiscal: '101', quantidades: { 1: 6 } } }, almox, '2026-11-17T10:00:00.000Z'));
  assert.equal(sol.etapa, 'Entregue');
  assert.equal(sol.notaFiscal, '100, 101');
});

test('sem parcial, chegada menor fecha e registra a divergência', () => {
  let sol = ateAprovado(false);
  sol = ok(aplicarAcao(sol, { tipo: 'receber', recebimento: { tipo: 'Chegou ao Local de Descarte', local: 'Bota-Fora Lara', notaFiscal: '9', quantidades: { 1: 8 } } }, almox, '2026-11-16T10:00:00.000Z'));
  assert.equal(sol.etapa, 'Entregue');
  assert.equal(sol.statusLogistico, 'Chegou ao Local de Descarte');
  assert.match(sol.divergencia ?? '', /recebido 8 de 10 ton/);
});

test('pessoa do login: por e-mail, senão pelo nome sem acento', () => {
  const pessoas = [...PESSOAS_INICIAIS, { id: 'x', nome: 'Fiscal', email: 'Fiscal@Obra.com', papel: 'recebedor' as const, ativo: true }];
  assert.equal(pessoaDoUsuario(pessoas, { nome: 'sergio', email: '' })?.papel, 'suprimentos');
  assert.equal(pessoaDoUsuario(pessoas, { nome: 'Outro', email: 'fiscal@obra.com' })?.nome, 'Fiscal');
  assert.equal(pessoaDoUsuario(pessoas, { nome: 'Desconhecido' }), null);
});

test('importação recusa solicitante não autorizado e unidade fora do padrão', () => {
  const csv = 'Solicitante;Tipo (Material/Serviço);Ramo/Local;Descrição;Quantidade;Unidade;Prazo Desejado;Permite Parcial (S/N)\n'
    + 'Alvaro;Material;Ramo 200;Areia média lavada;12,5;m3;20/11/2026;S\n'
    + 'Fulano;Material;Ramo 200;Areia;1;m³;20/11/2026;S\n'
    + 'Thiago;Material;OAE Marginal;Cimento CP-II;3;saco;20/11/2026;N\n'
    + '"José Augusto Mineiro";Serviço;Ramo 1400;"Locação de escavadeira; com operador";40;h;2026-11-30;n\n';
  const linhas = lerCsv(csv).map((valores, indice) => ({ linha: indice + 2, valores }));
  const { aceitas, rejeitadas } = validarImportacao(linhas, PESSOAS_INICIAIS);
  assert.equal(aceitas.length, 2);
  assert.equal(aceitas[0].dados.itens[0].unidade, 'm³');
  assert.equal(aceitas[0].dados.itens[0].prazoDesejado, '2026-11-20');
  assert.equal(aceitas[1].dados.itens[0].descricao, 'Locação de escavadeira; com operador');
  assert.deepEqual(rejeitadas.map(item => item.linha), [3, 4]);
  assert.match(rejeitadas[0].motivo, /não autorizado/);
  assert.match(rejeitadas[1].motivo, /Unidade fora do padrão/);
});

test('relatórios: solicitante, suprimentos, aprovador e logística', () => {
  const entregue = ok(aplicarAcao(ok(aplicarAcao(ateAprovado(), { tipo: 'despachar' }, cassia, T0)), {
    tipo: 'receber', recebimento: { tipo: 'Chegou ao Local de Descarte', local: 'Bota-Fora Itaquareia', notaFiscal: '1', quantidades: { 1: 10 } },
  }, almox, '2026-11-17T10:00:00.000Z'));
  const atrasada = { ...ateAprovado(), id: 'id-2', numero: 'SOL-2026-0002' };
  const pendente = { ...nova(), id: 'id-3', numero: 'SOL-2026-0003', solicitante: 'Alvaro' };
  const todas = [entregue, atrasada, pendente];

  assert.deepEqual(relatorioPorSolicitante(todas, '2026-11-20').find(item => item.solicitante === 'Thiago'), {
    solicitante: 'Thiago', abertas: 2, atendidas: 1, pendentes: 1, emAtraso: 1, canceladas: 0,
  });
  const [cassiaLinha] = relatorioSuprimentos(todas);
  assert.equal(cassiaLinha.comprador, 'Cássia');
  assert.equal(cassiaLinha.tempoMedioCotacaoHoras, 6);
  assert.equal(cassiaLinha.pontualidadePct, 100);
  assert.deepEqual(relatorioAprovador(todas), [{ aprovador: 'Bruno', aprovados: 2, condicionais: 0, rejeicoes: 0, valorAprovado: 116000 }]);
  const logistica = relatorioLogistico(todas, '2026-11-20');
  assert.deepEqual(logistica.diario, [{ periodo: '2026-11-17', noLocal: 0, descarte: 1 }]);
  assert.equal(logistica.emAberto[0].atraso, true);
});
