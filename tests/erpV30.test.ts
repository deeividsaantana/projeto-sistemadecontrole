import assert from 'node:assert/strict';
import test from 'node:test';
import type { ControleEstacas, LoteEstaca, CravacaoEstaca, PeriodoArquivado } from '../src/types';
import { buildStakeSummary, calculateStakeBalance, reconcileStakeInvoice, suggestStakeLot } from '../src/utils/stakeOperations';

const lot: LoteEstaca = {
  id: 'lot-1', data: '2026-07-01', hora: '08:00', movimento: 'Entrada', notaFiscal: '15791',
  materialCodigo: '92286', descricao: 'ESTACA P DUP AZ17-700 S430GP 10M', tipo: 'ESTACA P DUP',
  perfilModelo: 'AZ17-700', comprimentoM: 10, unidade: 'UN', pesoKg: 1000, quantidadeFisica: 2,
  valorUnitario: 8, valorTotal: 8000, placaCavalo: '', placaCarreta: '', transportadora: '',
  destino: 'SPMAR', tipoCarregamento: 'Feixe central', status: 'Entregue', nfConferida: true,
  divergenciaNF: '', responsavel: 'Teste', observacao: '', origem: 'Manual', criadoEm: '2026-07-01T08:00:00Z',
};

const driving: CravacaoEstaca = {
  id: 'drive-1', data: '2026-07-02', item: '1', servico: 'Cravação', identificacao: 'AP 12',
  perfil: 'AZ17-700', comprimentoM: 10, comprimentoCravadoM: 8, sobraM: 1, perdaM: 1,
  loteId: 'lot-1', responsavel: 'Teste', observacao: '', origem: 'Manual', criadoEm: '2026-07-02T08:00:00Z',
};

const control: ControleEstacas = { lotes: [lot], cravacoes: [driving] };

test('calcula saldo confirmado separando sobra e perda', () => {
  const balance = calculateStakeBalance(lot, [driving]);
  assert.equal(balance.recebidoM, 20);
  assert.equal(balance.cravadoM, 8);
  assert.equal(balance.perdaM, 1);
  assert.equal(balance.saldoConfirmadoM, 11);
});

test('associa perfil ao lote disponível e confere nota fiscal', () => {
  assert.equal(suggestStakeLot(driving, control)?.id, 'lot-1');
  assert.equal(reconcileStakeInvoice([lot], 'NF 15791').status, 'Conforme');
  assert.equal(buildStakeSummary(control).notasPendentes, 0);
});
