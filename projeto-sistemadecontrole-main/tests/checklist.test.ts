import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChecklistEquipamento, ItemChecklist } from '../src/types';
import { itensCriticosReprovados, ordemDoChecklist, resumoChecklist } from '../src/utils/checklist';

const item = (extra: Partial<ItemChecklist>): ItemChecklist => ({
  itemId: 'freios',
  descricao: 'Freios',
  critico: true,
  resposta: 'OK',
  ...extra,
});

const checklist = (itens: ItemChecklist[]): ChecklistEquipamento => ({
  id: 'chk-1',
  modeloId: 'modelo-padrao',
  data: '2026-09-05',
  hora: '07:10',
  equipamentoId: 'eq-1',
  prefixo: 'CB770',
  responsavel: 'Deivid Santana',
  itens,
  criadoEm: '2026-09-05T07:10:00.000Z',
});

test('item crítico reprovado abre ordem de serviço', () => {
  const ordem = ordemDoChecklist(checklist([
    item({ resposta: 'Não conforme', observacao: 'Freio de serviço falhando' }),
    item({ itemId: 'espelhos', descricao: 'Espelhos', critico: false, resposta: 'Atenção' }),
  ]), 'OS-0200');
  assert.ok(ordem);
  assert.equal(ordem?.numero, 'OS-0200');
  assert.equal(ordem?.status, 'Aberta');
  assert.equal(ordem?.prioridade, 'Alta');
  assert.equal(ordem?.equipamentoId, 'eq-1');
  assert.match(String(ordem?.descricao), /Freios/);
  assert.equal(ordem?.observacao, 'Freio de serviço falhando');
});

test('não conformidade em item não crítico não abre ordem', () => {
  const ordem = ordemDoChecklist(checklist([
    item({ itemId: 'limpeza', descricao: 'Limpeza da cabine', critico: false, resposta: 'Não conforme' }),
  ]), 'OS-0200');
  assert.equal(ordem, undefined);
});

test('atenção em item crítico não abre ordem', () => {
  assert.equal(ordemDoChecklist(checklist([item({ resposta: 'Atenção' })]), 'OS-0200'), undefined);
  assert.equal(itensCriticosReprovados([item({ resposta: 'Atenção' })]).length, 0);
});

test('resumo separa ok, atenção e não conforme', () => {
  const resumo = resumoChecklist([
    item({ resposta: 'OK' }),
    item({ itemId: 'pneus', resposta: 'Atenção' }),
    item({ itemId: 'luzes', resposta: 'Não conforme' }),
    item({ itemId: 'limpeza', critico: false, resposta: 'Não aplicável' }),
  ]);
  assert.deepEqual(resumo, { total: 4, ok: 1, atencao: 1, naoConforme: 1, criticos: 1 });
});
