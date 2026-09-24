import assert from 'node:assert/strict';
import test from 'node:test';
import type { Material, MovimentoMaterial } from '../src/types';
import { formatMaterialQuantity, fromPieces, toPieces, unitLabel } from '../src/modules/materials/materialPieces';
import { groupUsageByBranch, materialUsageByBranch } from '../src/modules/materials/materialUsage';
import {
  cancelMaterialMovement,
  linkMovementsToBranch,
  mergeMaterialUseMovements,
  movementsFromMaterialUse,
  unlinkedReceiptDestinations,
  type MaterialUseSubmission,
} from '../src/modules/materials/materialFieldUse';
import { movementTypeFromSheet, receiptMaterialDescription } from '../src/imports/materialImportApplication';
import { efeitoNoSaldo } from '../src/utils/estoque';
import { getMaterialAccessTokenFromUrl, isMaterialLinkUrl, isPublicLinkUrl } from '../src/app/routing/publicRoutes';
import {
  buildFieldView,
  resolveMaterialLinkToken,
  sanitizeMaterialUse,
} from '../netlify/functions/_shared/material-usage.js';

const tubo: Material = {
  id: 'tubo-800', codigo: '', descricao: 'TUBO DE CONCRETO Ø800 PA4 1,50 m', categoria: 'Tubos de concreto',
  unidade: 'MT', comprimentoPecaM: 1.5, ativo: true, criadoEm: '', atualizadoEm: '',
};

const mov = (over: Partial<MovimentoMaterial>): MovimentoMaterial => ({
  id: 'm', data: '2026-09-24', tipo: 'Entrada', materialId: tubo.id, materialDescricao: tubo.descricao,
  quantidade: 90, unidade: 'MT', responsavel: 'Escritório', criadoEm: '2026-09-24T10:00:00Z',
  etapaServicoId: 'ramo-1400', etapaServicoNome: 'Ramo 1400', ...over,
});

const submission = (over: Partial<MaterialUseSubmission['payload']> = {}): MaterialUseSubmission => ({
  id: 'material_uso_abc123abc123abc123',
  createdAtIso: '2026-09-24T15:00:00Z',
  payload: {
    data: '2026-09-24', etapaServicoId: 'ramo-1400', etapaServicoNome: 'Ramo 1400', apontador: 'Jonas',
    itens: [{ materialId: tubo.id, materialDescricao: tubo.descricao, unidade: 'MT', quantidade: 15 }],
    ...over,
  },
});

test('tubo chega em metro e o campo conta peça: 90 m de 1,50 m são 60 peças', () => {
  assert.equal(toPieces(tubo, 90), 60);
  assert.equal(fromPieces(tubo, 50), 75);
  assert.equal(formatMaterialQuantity(tubo, 21), '14 pç (21 m)');
  assert.equal(toPieces({ comprimentoPecaM: undefined }, 10), null);
  assert.equal(formatMaterialQuantity({ unidade: 'UN' }, 3), '3 un');
  assert.equal(unitLabel('M3'), 'm³');
});

test('60 peças recebidas e 50 aplicadas no ramo 1400 dão 83,3% de utilização', () => {
  const rows = materialUsageByBranch([tubo], [
    mov({ id: 'e1' }),
    mov({ id: 's1', tipo: 'Saída', finalidade: 'Consumo', quantidade: 75, apontadoPor: 'Jonas' }),
  ]);
  assert.equal(rows[0].percent, 83.3);
  assert.equal(toPieces(tubo, rows[0].remaining), 10);
});

test('uso desfeito não conta na utilização nem no saldo, mas continua no histórico', () => {
  const uso = mov({ id: 's1', tipo: 'Saída', finalidade: 'Consumo', quantidade: 75 });
  const desfeito = cancelMaterialMovement(uso, 'Deivid', '2026-09-24T18:00:00Z');
  assert.equal(desfeito.canceladoPor, 'Deivid');
  assert.equal(cancelMaterialMovement(desfeito, 'Outro').canceladoPor, 'Deivid');
  const rows = materialUsageByBranch([tubo], [mov({ id: 'e1' }), desfeito]);
  assert.equal(rows[0].used, 0);
  assert.equal(efeitoNoSaldo(desfeito), 0);
});

test('ramos agrupam em ordem numérica e unidades misturadas usam média dos percentuais', () => {
  const madeira: Material = { ...tubo, id: 'pontalete', descricao: 'Pontalete', unidade: 'PC', comprimentoPecaM: undefined };
  const rows = materialUsageByBranch([tubo, madeira], [
    mov({ id: 'e1' }),
    mov({ id: 's1', tipo: 'Saída', finalidade: 'Consumo', quantidade: 45 }),
    mov({ id: 'e2', materialId: 'pontalete', unidade: 'PC', quantidade: 10 }),
    mov({ id: 'e3', etapaServicoId: 'ramo-900', etapaServicoNome: 'Ramo 900' }),
  ]);
  const groups = groupUsageByBranch(rows);
  assert.deepEqual(groups.map(group => group.branchName), ['Ramo 900', 'Ramo 1400']);
  assert.equal(groups[1].mixedUnits, true);
  assert.equal(groups[1].percent, 25);
});

test('envio do link vira saída de consumo com ID estável e incorporar duas vezes não soma em dobro', () => {
  const movements = movementsFromMaterialUse(submission());
  assert.equal(movements.length, 1);
  assert.equal(movements[0].id, 'uso-link-material_uso_abc123abc123abc123-1');
  assert.equal(movements[0].tipo, 'Saída');
  assert.equal(movements[0].finalidade, 'Consumo');
  assert.equal(movements[0].apontadoPor, 'Jonas');
  const first = mergeMaterialUseMovements([], movements);
  const second = mergeMaterialUseMovements(first.movements, movementsFromMaterialUse(submission()));
  assert.equal(first.added, 1);
  assert.equal(second.added, 0);
  assert.equal(second.movements.length, 1);
});

test('mesmo material em outro dia é outro envio e entra normalmente', () => {
  const ontem = { ...submission({ data: '2026-09-23' }), id: 'material_uso_zzz999zzz999zzz999' };
  const merged = mergeMaterialUseMovements(movementsFromMaterialUse(submission()), movementsFromMaterialUse(ontem));
  assert.equal(merged.added, 1);
  assert.equal(merged.movements.length, 2);
});

test('entrada antiga sem ramo aparece para vincular, com sugestão pelo nome, sem vincular sozinha', () => {
  const antigas = [
    mov({ id: 'a1', etapaServicoId: undefined, etapaServicoNome: undefined, destino: 'RAMO 1400' }),
    mov({ id: 'a2', etapaServicoId: undefined, etapaServicoNome: undefined, destino: 'Ramo 1400 ' }),
    mov({ id: 'a3', etapaServicoId: undefined, etapaServicoNome: undefined, destino: 'Canteiro' }),
  ];
  const groups = unlinkedReceiptDestinations(antigas, [{ id: 'ramo-1400', nome: 'Ramo 1400' }]);
  assert.equal(groups[0].movementIds.length, 2);
  assert.equal(groups[0].suggestedBranchId, 'ramo-1400');
  assert.equal(groups[1].suggestedBranchId, undefined);
  const linked = linkMovementsToBranch(antigas, new Set(groups[0].movementIds), { id: 'ramo-1400', nome: 'Ramo 1400' });
  assert.deepEqual(linked.map(item => item.etapaServicoId), ['ramo-1400', 'ramo-1400']);
});

test('planilha de movimentação: saída escrita de qualquer jeito continua saída', () => {
  assert.equal(movementTypeFromSheet('SAÍDA'), 'Saída');
  assert.equal(movementTypeFromSheet('saida de material'), 'Saída');
  assert.equal(movementTypeFromSheet('Transferência'), 'Transferência');
  assert.equal(movementTypeFromSheet('AJUSTE'), 'Ajuste');
  assert.equal(movementTypeFromSheet('Entrada'), 'Entrada');
});

test('tubo de concreto tem um nome só, qualquer que seja a especificação da nota', () => {
  const base = { data: '2026-07-02', quantidadeRecebida: 21, unidade: 'MT', notaFiscal: '1', diametroMm: 800, classe: 'PA4', comprimentoPecaM: 1.5 };
  const a = receiptMaterialDescription({ ...base, material: 'TUBO DE CONCRETO', especificacao: 'T.CONCR.ARM.PB800x1500-PA4' });
  const b = receiptMaterialDescription({ ...base, material: 'Tubo de Concreto', especificacao: 'TUBO DE CONCRETO ARM PB800X1500-PA4 Ø800' });
  assert.equal(a, 'TUBO DE CONCRETO Ø800 PA4 1,50 m');
  assert.equal(b, a);
  const pead = receiptMaterialDescription({ ...base, material: 'TUBO PEAD', especificacao: 'KANANET DN 100', diametroMm: 100, classe: null, comprimentoPecaM: null });
  assert.equal(pead, 'TUBO PEAD · KANANET DN 100 Ø100');
});

test('rota do apontador é pública e carrega o token', () => {
  const location = { pathname: '/material-link/abc%2Ddef', search: '' };
  assert.equal(isMaterialLinkUrl(location), true);
  assert.equal(isPublicLinkUrl(location), true);
  assert.equal(getMaterialAccessTokenFromUrl(location), 'abc-def');
  assert.equal(isMaterialLinkUrl({ pathname: '/', search: '' }), false);
});

test('token do link de materiais: dedicado quando existe, senão derivado e diferente do de tickets', () => {
  const ticket = 'ticket-token-com-mais-de-24-caracteres';
  const derived = resolveMaterialLinkToken({ RENEA_PUBLIC_TICKET_LINK_TOKEN: ticket });
  assert.ok(derived.length >= 32);
  assert.notEqual(derived, ticket);
  assert.equal(resolveMaterialLinkToken({ RENEA_PUBLIC_TICKET_LINK_TOKEN: ticket }), derived);
  assert.equal(resolveMaterialLinkToken({ RENEA_PUBLIC_MATERIAL_LINK_TOKEN: 'dedicado-com-mais-de-24-caracteres', RENEA_PUBLIC_TICKET_LINK_TOKEN: ticket }), 'dedicado-com-mais-de-24-caracteres');
  assert.equal(resolveMaterialLinkToken({}), '');
  assert.equal(resolveMaterialLinkToken({ RENEA_PUBLIC_TICKET_LINK_TOKEN: 'curto' }), '');
});

const fieldView = (pendentes: unknown[] = [], movimentos: MovimentoMaterial[] = [mov({ id: 'e1' })]) => buildFieldView({
  etapas: [{ id: 'ramo-1400', nome: 'Ramo 1400' }, { id: 'ramo-vazio', nome: 'Ramo sem material' }],
  materiais: [tubo],
  movimentos,
  pendentes,
  today: '2026-09-24',
});

test('o apontador só vê ramo com material recebido, e o uso pendente já desconta do saldo', () => {
  const pending = { id: 'material_uso_abc123abc123abc123', status: 'pending', ...submission() };
  const view = fieldView([pending]);
  assert.deepEqual(view.ramos.map((ramo: { nome: string }) => ramo.nome), ['Ramo 1400']);
  assert.equal(view.ramos[0].materiais[0].usado, 15);
  assert.equal(view.ramos[0].materiais[0].saldo, 75);
  assert.equal(view.lancamentosHoje.length, 1);
});

test('envio já incorporado pelo ERP não conta duas vezes na tela do apontador', () => {
  const pending = { id: 'material_uso_abc123abc123abc123', status: 'processed', ...submission() };
  const incorporated = movementsFromMaterialUse(submission());
  const view = fieldView([pending], [mov({ id: 'e1' }), ...incorporated]);
  assert.equal(view.ramos[0].materiais[0].usado, 15);
});

test('servidor recusa envio fora das regras e aceita o excesso para conferência', () => {
  const view = fieldView();
  const dates = { today: '2026-09-24', yesterday: '2026-09-23' };
  const body = { envioId: 'abc123abc123abc123', data: '2026-09-24', apontador: ' Jonas ', etapaServicoId: 'ramo-1400', itens: [{ materialId: tubo.id, quantidade: 120 }] };
  const ok = sanitizeMaterialUse(body, view, dates);
  assert.equal(ok.id, 'material_uso_abc123abc123abc123');
  assert.equal(ok.payload.apontador, 'Jonas');
  assert.equal(ok.payload.itens[0].quantidade, 120);
  assert.throws(() => sanitizeMaterialUse({ ...body, envioId: 'curto' }, view, dates), /Identificador/);
  assert.throws(() => sanitizeMaterialUse({ ...body, data: '2026-09-20' }, view, dates), /hoje ou ontem/);
  assert.throws(() => sanitizeMaterialUse({ ...body, apontador: 'J' }, view, dates), /nome/);
  assert.throws(() => sanitizeMaterialUse({ ...body, etapaServicoId: 'ramo-vazio' }, view, dates), /ramo/);
  assert.throws(() => sanitizeMaterialUse({ ...body, itens: [{ materialId: 'outro', quantidade: 1 }] }, view, dates), /não foi recebido/);
  assert.throws(() => sanitizeMaterialUse({ ...body, itens: [{ materialId: tubo.id, quantidade: 0 }] }, view, dates), /Quantidade/);
  assert.throws(() => sanitizeMaterialUse({ ...body, itens: [body.itens[0], body.itens[0]] }, view, dates), /duas vezes/);
});
