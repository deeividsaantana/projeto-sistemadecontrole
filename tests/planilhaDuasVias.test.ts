import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { abrirSolicitacao, type Ator, type Solicitacao } from '../src/utils/solicitacoes';
import { comBaseDaPlanilha, sincronizarComPlanilha, type LinhaDoEspelho, type LinhaParaPlanilha } from '../src/utils/solicitacoesPlanilha';
import { enviarParaPlanilha, linhasValidas } from '../server/procurementSheetWrite.js';

const LIDA = '2026-11-17T12:00:00.000Z';
const thiago: Ator = { nome: 'Thiago', papel: 'solicitante' };

const espelho = (pedido: string, item: string, extra: Record<string, unknown> = {}): LinhaDoEspelho => ({
  sheet_name: 'Solicitações',
  raw_data: { source: 'Solicitações', request_date: '2026-11-10', source_request_number: pedido, requester_name: 'Thiago', item_description: item, unit: 'Und.', quantity_requested: 4, source_purchase_order: '', delivery_deadline: '', site_code: '', ...extra },
});

const doSite = (): Solicitacao => {
  const resultado = abrirSolicitacao({
    solicitante: 'Thiago', frente: 'Ramo 1400', estacamento: 'Estaca 1401',
    itens: [
      { tipo: 'Material', descricao: 'Luva de raspa', quantidade: '20', unidade: 'un', prazoDesejado: '2026-11-25', permiteParcial: true },
      { tipo: 'Material', descricao: 'Bota PVC', quantidade: '5', unidade: 'un', prazoDesejado: '2026-11-25', permiteParcial: true },
    ],
  }, thiago, [], '2026-11-17T10:00:00.000Z', 'id-site');
  if ('erro' in resultado) assert.fail(resultado.erro);
  return resultado.solicitacao;
};

// ---------------------------------------------------------------------------
// Script da planilha (Apps Script) rodando contra uma aba de mentira.

const criarPlanilha = (linhas: unknown[][]) => {
  const grade: unknown[][] = [
    ['Pedidos de compras'],
    ['Data', 'N° do pedido', 'Solicitante', 'Item', 'Unidade', 'Quantidade', 'Solicitação de compra SC (N°)', 'Previsão de entrega'],
    ...linhas,
  ];
  const largura = () => Math.max(...grade.map(linha => linha.length));
  const aba = {
    getLastColumn: largura,
    getLastRow: () => grade.length,
    getRange: (linha: number, coluna: number, nLinhas = 1, nColunas = 1) => ({
      getValues: () => Array.from({ length: nLinhas }, (_, i) => Array.from({ length: nColunas }, (_, j) => grade[linha - 1 + i]?.[coluna - 1 + j] ?? '')),
      setValue: (valor: unknown) => { grade[linha - 1] ||= []; grade[linha - 1][coluna - 1] = valor; },
    }),
    appendRow: (linha: unknown[]) => { grade.push([...linha]); },
  };
  return { grade, planilha: { getSheetByName: (nome: string) => (nome === 'Solicitações' ? aba : null) } };
};

const carregarScript = (token = 'segredo') => {
  const contexto: Record<string, unknown> = {
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (texto: string) => ({ setMimeType: () => ({ texto }) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => token }) },
    LockService: { getScriptLock: () => ({ waitLock: () => undefined, releaseLock: () => undefined }) },
  };
  vm.createContext(contexto);
  vm.runInContext(readFileSync('scripts/google-planilha-compras.gs', 'utf8'), contexto);
  return contexto as unknown as {
    aplicarLinhas_: (planilha: unknown, linhas: LinhaParaPlanilha[]) => { ok: boolean; novas: number; alteradas: number; pedidos: Record<string, number> };
    doPost: (e: unknown) => { texto: string };
    SpreadsheetApp?: unknown;
  };
};

test('script da planilha: pedido do site entra com o próximo N° e não duplica ao repetir', () => {
  const { grade, planilha } = criarPlanilha([
    [new Date('2026-11-10'), 130, 'Lucas', 'Tubos', 'Und.', 12, '', ''],
    [new Date('2026-11-11'), 131, 'Carlos', 'Sarrafo', 'Und.', 3, '93041040', new Date('2026-11-20')],
  ]);
  const script = carregarScript();
  const linhas: LinhaParaPlanilha[] = [
    { codigo: 'SOL-2026-0001/1', item: 'Luva de raspa', nova: { data: '2026-11-17', solicitante: 'Thiago', unidade: 'un', quantidade: 20 } },
    { codigo: 'SOL-2026-0001/2', item: 'Bota PVC', nova: { data: '2026-11-17', solicitante: 'Thiago', unidade: 'un', quantidade: 5 } },
  ];
  const primeira = script.aplicarLinhas_(planilha, linhas);
  assert.equal(primeira.novas, 2);
  assert.equal(primeira.pedidos['SOL-2026-0001'], 132);
  assert.equal(grade[1][8], 'Código do site', 'cria a coluna do código quando falta');
  assert.deepEqual(grade.slice(4).map(linha => [linha[1], linha[2], linha[3], linha[5], linha[8]]), [
    [132, 'Thiago', 'Luva de raspa', 20, 'SOL-2026-0001/1'],
    [132, 'Thiago', 'Bota PVC', 5, 'SOL-2026-0001/2'],
  ]);
  // Mandar de novo (resposta perdida, dois aparelhos): não cria linha.
  const repetida = script.aplicarLinhas_(planilha, linhas);
  assert.equal(repetida.novas, 0);
  assert.equal(grade.length, 6);

  // Atualização: SC no pedido do site e OK no pedido que nasceu na planilha.
  script.aplicarLinhas_(planilha, [
    { codigo: 'SOL-2026-0001/1', item: 'Luva de raspa', sc: '93099999' },
    { pedido: '131', item: 'SARRAFO', previsao: 'OK' },
  ]);
  assert.equal(grade[4][6], '93099999');
  assert.equal(grade[3][7], 'OK');
  // Data vira data de verdade na planilha.
  script.aplicarLinhas_(planilha, [{ pedido: '130', item: 'Tubos', previsao: '2026-12-01' }]);
  assert.ok(grade[2][7] instanceof Date || Object.prototype.toString.call(grade[2][7]) === '[object Date]');
});

test('script da planilha recusa token errado', () => {
  const script = carregarScript('certo');
  const resposta = JSON.parse(script.doPost({ postData: { contents: JSON.stringify({ token: 'errado', linhas: [] }) } }).texto);
  assert.deepEqual(resposta, { ok: false, erro: 'Token inválido.' });
});

// ---------------------------------------------------------------------------
// Regras de quem vale (site × planilha).

test('pedido aberto no site vai para a planilha e, quando volta, não vira card repetido', () => {
  const sol = doSite();
  const ida = sincronizarComPlanilha([espelho('130', 'Tubos')], [sol], LIDA);
  assert.equal(ida.novas.length, 1, 'o 130 da planilha vira card');
  const envio = ida.envios.find(item => item.solId === sol.id)!;
  assert.equal(envio.nova, true);
  assert.deepEqual(envio.linhas.map(linha => [linha.codigo, linha.item, linha.nova?.quantidade]), [
    [`${sol.numero}/1`, 'Luva de raspa', 20],
    [`${sol.numero}/2`, 'Bota PVC', 5],
  ]);

  // Planilha relida: as linhas do site têm o código e o N° 131.
  const volta = [espelho('131', 'Luva de raspa', { site_code: `${sol.numero}/1` }), espelho('131', 'Bota PVC', { site_code: `${sol.numero}/2` })];
  const depois = sincronizarComPlanilha(volta, [sol], LIDA);
  assert.deepEqual(depois, { novas: [], atualizadas: [], envios: [] });
  // Pedido do site que já terminou antes de existir a planilha não é lançado nela.
  assert.equal(sincronizarComPlanilha([espelho('130', 'Tubos')], [{ ...sol, etapa: 'Entregue' }], LIDA).envios.length, 0);
});

test('SC e entrega lançadas na planilha chegam ao pedido do site', () => {
  const sol = { ...doSite(), planilha: { sc: '', previsao: '' } };
  const linhas = [
    espelho('131', 'Luva de raspa', { site_code: `${sol.numero}/1`, source_purchase_order: '93050001', delivery_deadline: 'OK' }),
    espelho('131', 'Bota PVC', { site_code: `${sol.numero}/2`, source_purchase_order: '93050001', delivery_deadline: 'OK' }),
  ];
  const { atualizadas, envios } = sincronizarComPlanilha(linhas, [sol], LIDA);
  assert.equal(envios.length, 0);
  const [nova] = atualizadas;
  assert.equal(nova.numeroSc, '93050001');
  assert.equal(nova.etapa, 'Entregue');
  assert.deepEqual(nova.planilha, { sc: '93050001', previsao: 'OK' });
  assert.match(nova.eventos[nova.eventos.length - 1].detalhe ?? '', /SC 93050001.*OK/);
});

test('mudança feita no site depois da última leitura vai para a planilha, sem ser desfeita', () => {
  const linhas = [espelho('700', 'Enxada', { source_purchase_order: '93000001', delivery_deadline: '2026-11-20' })];
  const [daPlanilha] = sincronizarComPlanilha(linhas, [], LIDA).novas;
  // Cássia reagenda no site: antes de gravar, o card ganha a base (o que a planilha mostra).
  const reagendado = comBaseDaPlanilha({ ...daPlanilha, etapa: 'Aprovado', janelaFim: '2026-11-28' }, [daPlanilha], linhas);
  assert.deepEqual(reagendado.planilha, { sc: '93000001', previsao: '2026-11-20' });
  const { atualizadas, envios } = sincronizarComPlanilha(linhas, [reagendado], LIDA);
  assert.equal(atualizadas.length, 0, 'a planilha não desfaz o reagendamento');
  assert.deepEqual(envios[0].linhas, [{ pedido: '700', item: 'Enxada', previsao: '2026-11-28' }]);

  // Se a planilha também mudou depois da base, vale a planilha.
  const mudouLa = [espelho('700', 'Enxada', { source_purchase_order: '93000001', delivery_deadline: '2026-11-30' })];
  const conflito = sincronizarComPlanilha(mudouLa, [reagendado], LIDA);
  assert.equal(conflito.atualizadas[0].janelaFim, '2026-11-30');
  assert.equal(conflito.envios.length, 0);
});

test('entregue ou cancelado no site corrige a planilha; célula vazia não apaga o site', () => {
  const linhas = [espelho('800', 'Arame', { source_purchase_order: '93000002', delivery_deadline: '2026-11-20' }), espelho('800', 'Prego', { delivery_deadline: 'OK' })];
  const [card] = sincronizarComPlanilha(linhas, [], LIDA).novas;
  const entregue = { ...card, etapa: 'Entregue' as const };
  const { envios } = sincronizarComPlanilha(linhas, [entregue], LIDA);
  assert.deepEqual(envios[0].linhas.map(linha => [linha.item, linha.previsao]), [['Arame', 'OK'], ['Prego', 'OK']]);

  const cancelado = { ...card, etapa: 'Cancelado' as const };
  assert.deepEqual(sincronizarComPlanilha(linhas, [cancelado], LIDA).envios[0].linhas.map(linha => linha.previsao), ['Cancelado', 'Cancelado']);

  // SC apagada na planilha: o site mantém e devolve a SC.
  const semSc = [espelho('800', 'Arame', { delivery_deadline: '2026-11-20' }), espelho('800', 'Prego', { delivery_deadline: 'OK' })];
  const devolve = sincronizarComPlanilha(semSc, [{ ...card, planilha: { sc: '93000002', previsao: '2026-11-20' } }], LIDA);
  assert.equal(devolve.atualizadas.length, 0);
  assert.deepEqual(devolve.envios[0].linhas.map(linha => linha.sc), ['93000002', '93000002']);
});

test('"Cancelado" na planilha cancela o pedido no site', () => {
  const linhas = [espelho('900', 'Cal', { delivery_deadline: 'Cancelado' })];
  const [novo] = sincronizarComPlanilha(linhas, [], LIDA).novas;
  assert.equal(novo.etapa, 'Cancelado');
  const aberto = { ...novo, etapa: 'Pendente Suprimentos' as const, planilha: { sc: '', previsao: '' } };
  const [cancelado] = sincronizarComPlanilha(linhas, [aberto], LIDA).atualizadas;
  assert.equal(cancelado.etapa, 'Cancelado');
  assert.equal(cancelado.canceladaMotivo, 'Cancelado na planilha');
});

// ---------------------------------------------------------------------------
// Servidor → script da planilha.

test('servidor só repassa campos conhecidos e explica quando o envio está desligado', async () => {
  assert.deepEqual(linhasValidas([
    { codigo: 'SOL-2026-0001/1', item: ' Luva ', sc: 93, nova: { data: '2026-11-17', solicitante: 'Thiago', unidade: 'un', quantidade: '20', extra: 1 }, lixo: true },
    { item: 'sem chave' },
    { pedido: '130', item: 'Tubos', previsao: 'OK' },
  ]), [
    { codigo: 'SOL-2026-0001/1', item: 'Luva', sc: '93', nova: { data: '2026-11-17', solicitante: 'Thiago', unidade: 'un', quantidade: 20 } },
    { pedido: '130', item: 'Tubos', previsao: 'OK' },
  ]);
  await assert.rejects(enviarParaPlanilha([], { url: '', token: '' }), (erro: Error & { statusCode?: number }) => erro.statusCode === 503);

  const pedidos: Array<{ url: string; corpo: unknown }> = [];
  const fetcher = async (url: string, opcoes: { body: string }) => {
    pedidos.push({ url, corpo: JSON.parse(opcoes.body) });
    return { ok: true, status: 200, json: async () => ({ ok: true, novas: 2, alteradas: 0, pedidos: { 'SOL-2026-0001': 132 } }) };
  };
  const resultado = await enviarParaPlanilha([{ codigo: 'SOL-2026-0001/1', item: 'Luva' }], { url: 'https://script.google.com/macros/s/x/exec', token: 't', fetcher: fetcher as unknown as typeof fetch });
  assert.deepEqual(resultado, { novas: 2, alteradas: 0, pedidos: { 'SOL-2026-0001': 132 } });
  assert.deepEqual(pedidos[0].corpo, { token: 't', linhas: [{ codigo: 'SOL-2026-0001/1', item: 'Luva' }] });

  const recusa = async () => ({ ok: true, status: 200, json: async () => ({ ok: false, erro: 'Token inválido.' }) });
  await assert.rejects(enviarParaPlanilha([], { url: 'u', token: 't', fetcher: recusa as unknown as typeof fetch }), /Token inválido/);
});

test('duas leituras da planilha ao mesmo tempo viram uma só', async () => {
  const { sincronizarUmaVez } = await import('../server/procurementSpreadsheetSyncJob.js');
  let downloads = 0;
  const client = { from: () => ({ insert: () => Promise.resolve({ error: null }) }) };
  const download = async () => { downloads += 1; throw new Error('fora'); };
  const [a, b] = await Promise.allSettled([sincronizarUmaVez({ client, download }), sincronizarUmaVez({ client, download })]);
  assert.equal(a.status, 'rejected');
  assert.equal(b.status, 'rejected');
  assert.equal(downloads, 1);
});
