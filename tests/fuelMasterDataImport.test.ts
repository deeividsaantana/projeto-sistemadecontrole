import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFuelImportedMasterData } from '../src/utils/fuelMasterDataImport';

test('cadastro da macro cria empresas locadoras e preserva Renea como empresa propria', () => {
  const result = buildFuelImportedMasterData({
    nowIso: '2026-10-05T16:00:00.000Z',
    equipmentRows: [
      { frota: 'CB770', equipamento: 'Caminhão Basculante', familia: 'Caminhão Basculante', empresa: 'Renea', status: 'Ativo', mobilizado: true },
      { frota: 'LO279', equipamento: 'Escavadeira Hidráulica Cat 320 GC', familia: 'Escavadeira', empresa: 'MGM Rental', status: 'Ativo', mobilizado: true },
    ],
    launchRows: [],
  });

  const renea = result.empresas.find(item => item.nome === 'RENEA INFRAESTRUTURA S.A.');
  const mgm = result.empresas.find(item => item.nome === 'MGM Rental');
  assert.deepEqual(renea?.tipos, ['EMPRESA']);
  assert.ok(mgm?.tipos?.includes('LOCACAO_EQUIPAMENTOS'));
  assert.equal(result.equipamentos.find(item => item.prefixo === 'LO279')?.empresaId, mgm?.id);
});

test('lancamentos da macro cadastram comboios e equipamentos ausentes da aba Equipamentos', () => {
  const result = buildFuelImportedMasterData({
    nowIso: '2026-10-05T16:00:00.000Z',
    equipmentRows: [],
    launchRows: [
      { prefixo: 'LO362', descricao: 'Escavadeira Hidráulica Cat 320 GC', empresa: 'MGM Rental', comboio: 'TCQ019' },
      { prefixo: 'CB1008', descricao: 'NÃO CADASTRADO', empresa: 'NÃO CADASTRADO', comboio: 'TQC021' },
    ],
  });

  assert.deepEqual(result.comboios.map(item => item.placa).sort(), ['TQC019', 'TQC021']);
  assert.equal(result.equipamentos.length, 1);
  assert.equal(result.equipamentos[0]?.prefixo, 'LO362');
  assert.equal(result.equipamentos[0]?.nome, 'Escavadeira Hidráulica Cat 320 GC');
});

