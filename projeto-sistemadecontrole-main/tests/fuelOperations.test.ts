import assert from 'node:assert/strict';
import test from 'node:test';
import type { Abastecimento, Equipamento } from '../src/types';
import {
  enrichFuelDataset,
  enrichFuelRecord,
  getFuelCompetence,
  getFuelCostTotal,
  getFuelTankFillPercentage,
} from '../src/utils/fuelOperations';
import { auditFuelDataset } from '../src/utils/combustivelValidation';

const equipment: Equipamento = {
  id: 'eq-1',
  prefixo: 'CB001',
  nome: 'Caminhão',
  tipo: 'Caminhão Basculante',
  marca: 'Teste',
  modelo: 'Teste',
  seriePlaca: 'ABC1D23',
  status: 'Ativo',
  empresaId: 'empresa-1',
  localAtualId: 'obra-1',
  observacao: '',
  capacidadeTanqueLitros: 300,
};

const record: Abastecimento = {
  id: 'fuel-1',
  data: '2026-06-21',
  hora: '07:00',
  equipamentoId: equipment.id,
  prefixoInformado: equipment.prefixo,
  horimetroInicial: 100,
  kmInicial: 0,
  bombaInicial: 1000,
  quantidadeLitros: 120,
  bombaFinal: 1120,
  tipoCombustivelId: 'diesel',
  comboioId: 'comboio-1',
  responsavel: 'Operador',
  observacao: '',
  custoLitro: 5.789,
};

test('competência vem somente da data real do abastecimento', () => {
  assert.equal(getFuelCompetence('2026-06-21'), '2026-06');
  assert.equal(getFuelCompetence('AGOSTO2026'), '');
});

test('custo e percentual de tanque são derivados sem alterar a quantidade', () => {
  assert.equal(getFuelCostTotal(120, 5.789), 694.68);
  assert.equal(getFuelTankFillPercentage(120, 300), 40);
  const enriched = enrichFuelRecord(record, equipment);
  assert.equal(enriched.quantidadeLitros, 120);
  assert.equal(enriched.competencia, '2026-06');
  assert.equal(enriched.custoTotal, 694.68);
  assert.equal(enriched.capacidadeTanqueLitros, 300);
  assert.equal(enriched.percentualTanque, 40);
});

test('auditoria preserva todas as linhas e envia excesso de tanque para revisão', () => {
  const oversized = { ...record, id: 'fuel-2', quantidadeLitros: 350, bombaFinal: 1350 };
  const enriched = enrichFuelDataset([record, oversized], [equipment]);
  const audited = auditFuelDataset(enriched, [equipment]);
  assert.equal(audited.length, 2);
  assert.equal(audited[1].quantidadeLitros, 350);
  assert.ok(audited[1].alertas?.some(alert => alert.codigo === 'CAPACIDADE_TANQUE_EXCEDIDA'));
});

test('alertas de origem são preservados junto com a validação recalculada', () => {
  const imported = {
    ...record,
    alertas: [{
      codigo: 'AVISO_PLANILHA',
      campo: 'linha',
      severidade: 'aviso' as const,
      mensagem: 'Linha original preservada.',
    }],
  };
  const [audited] = auditFuelDataset([enrichFuelRecord(imported, equipment)], [equipment]);
  assert.ok(audited.alertas?.some(alert => alert.codigo === 'AVISO_PLANILHA'));
});

test('cancelamento preserva o lançamento e não é reativado pela auditoria', () => {
  const cancelled: Abastecimento = {
    ...record,
    status: 'Cancelado',
    atualizadoEm: '2026-08-11T12:00:00.000Z',
    revisaoObservacao: 'Cancelado para preservar o histórico operacional.',
  };
  const [audited] = auditFuelDataset([cancelled], [equipment]);
  assert.equal(audited.id, record.id);
  assert.equal(audited.status, 'Cancelado');
  assert.equal(audited.revisaoObservacao, cancelled.revisaoObservacao);
});
