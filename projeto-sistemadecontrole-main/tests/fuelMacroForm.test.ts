import assert from 'node:assert/strict';
import test from 'node:test';
import type { Abastecimento, Equipamento, TipoCombustivel } from '../src/types';
import {
  buildMacroFuelingRecord,
  buildFuelImportObservation,
  fuelSheetCompetence,
  getDefaultDieselFuelId,
  isFuelImportWorksheet,
  normalizeConvoyCode,
  parseFuelFormNumber,
  resolveMacroPumpReadings,
} from '../src/utils/fuelMacroForm';

const equipment: Equipamento = {
  id: 'eq-cb790',
  prefixo: 'CB790',
  nome: 'Caminhao basculante',
  tipo: 'Caminhao',
  marca: 'VW',
  modelo: '31.320',
  seriePlaca: '',
  empresaId: 'empresa-renea',
  status: 'Ativo',
  localAtualId: '',
  observacao: '',
};

const previousFuelings: Abastecimento[] = [
  {
    id: 'old-tqc019',
    data: '2026-10-04',
    hora: '16:20',
    equipamentoId: 'eq-a',
    horimetroInicial: 0,
    kmInicial: 0,
    bombaInicial: 400100,
    quantidadeLitros: 80,
    bombaFinal: 400180,
    tipoCombustivelId: 'tc-diesel',
    comboioId: 'com-tqc019',
    responsavel: 'Operacao',
    observacao: '',
  },
  {
    id: 'old-tqc001',
    data: '2026-10-04',
    hora: '17:00',
    equipamentoId: 'eq-b',
    horimetroInicial: 0,
    kmInicial: 0,
    bombaInicial: 900,
    quantidadeLitros: 100,
    bombaFinal: 1000,
    tipoCombustivelId: 'tc-diesel',
    comboioId: 'com-tqc001',
    responsavel: 'Operacao',
    observacao: '',
  },
];

test('interpreta numeros digitados como a macro de diesel', () => {
  assert.equal(parseFuelFormNumber('1.234,5'), 1234.5);
  assert.equal(parseFuelFormNumber('1,234.5'), 1234.5);
  assert.equal(parseFuelFormNumber(' 150 '), 150);
  assert.equal(parseFuelFormNumber('', 0), 0);
});

test('calcula bomba inicial e final pelo ultimo lancamento do mesmo comboio', () => {
  assert.deepEqual(resolveMacroPumpReadings({
    records: previousFuelings,
    comboioId: 'com-tqc019',
    litros: '125,5',
  }), {
    bombaInicial: 400180,
    bombaFinal: 400305.5,
  });
});

test('permite corrigir manualmente a bomba inicial do comboio', () => {
  assert.deepEqual(resolveMacroPumpReadings({
    records: previousFuelings,
    comboioId: 'com-tqc019',
    litros: '50',
    bombaInicialManual: '50287',
  }), {
    bombaInicial: 50287,
    bombaFinal: 50337,
  });
});

test('seleciona Diesel S10 como combustivel padrao da macro', () => {
  const combustiveis: TipoCombustivel[] = [
    { id: 'tc-gas', nome: 'Gasolina' },
    { id: 'tc-s10', nome: 'Oleo Diesel S10 Comum' },
    { id: 'tc-s500', nome: 'Diesel S500' },
  ];
  assert.equal(getDefaultDieselFuelId(combustiveis), 'tc-s10');
});

test('resolve competencia pela aba mensal da macro', () => {
  assert.equal(fuelSheetCompetence('OUTUBRO 2026'), '2026-10');
  assert.equal(fuelSheetCompetence('SETEMBRO 2026'), '2026-09');
  assert.equal(fuelSheetCompetence('Detalhe'), '');
});

test('considera Resumo Geral uma aba agregada fora da importacao', () => {
  assert.equal(isFuelImportWorksheet('OUTUBRO 2026'), true);
  assert.equal(isFuelImportWorksheet('DadosCombustível'), true);
  assert.equal(isFuelImportWorksheet('Resumo Geral'), false);
  assert.equal(isFuelImportWorksheet('Equipamentos'), false);
});

test('observacao da importacao guarda origem sem copiar a linha inteira', () => {
  const rawLine = Array.from({ length: 30 }, (_, index) => `Campo ${index + 1}: ${'x'.repeat(40)}`).join(' | ');
  const observacao = buildFuelImportObservation({
    sheetName: 'OUTUBRO 2026',
    rowNumber: 250,
    observacao: '',
    empresaTexto: 'Renea',
    frotaTexto: 'CB790',
    equipmentFound: true,
    tipoCombustivelTexto: 'Diesel S10',
    comboioTexto: 'TQC022',
    responsavel: '',
    quantidadeFoiCalculada: true,
    motivo: 'Tipo criado pela importação.',
    rawRowText: rawLine,
  });

  assert.match(observacao, /Fonte: OUTUBRO 2026:250/);
  assert.match(observacao, /Empresa informada na planilha: Renea/);
  assert.doesNotMatch(observacao, /Campo 1/);
  assert.ok(observacao.length < 450);
});

test('normaliza codigo de comboio digitado errado na planilha', () => {
  assert.equal(normalizeConvoyCode('TCQ022'), 'TQC022');
  assert.equal(normalizeConvoyCode(' tqc019 '), 'TQC019');
});

test('monta abastecimento manual com hora normalizada e bomba sequencial', () => {
  const record = buildMacroFuelingRecord({
    id: 'novo-1',
    equipment,
    records: previousFuelings,
    data: '2026-10-05',
    hora: '1005',
    litros: '75',
    horimetro: '1234,5',
    km: '',
    tipoCombustivelId: 'tc-diesel',
    comboioId: 'com-tqc019',
    responsavel: 'Deivids',
    bombaInicialManual: '400200',
    operador: 'Joao',
    local: 'Ramo 200',
    observacao: 'Lancamento rapido',
    nowIso: '2026-10-05T13:00:00.000Z',
  });

  assert.equal(record.hora, '10:05');
  assert.equal(record.bombaInicial, 400200);
  assert.equal(record.quantidadeLitros, 75);
  assert.equal(record.bombaFinal, 400275);
  assert.equal(record.horimetroInicial, 1234.5);
  assert.equal(record.kmInicial, 0);
  assert.equal(record.prefixoInformado, 'CB790');
  assert.equal(record.origem, 'Manual');
  assert.equal(record.competencia, '2026-10');
});
