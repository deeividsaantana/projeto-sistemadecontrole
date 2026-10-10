import assert from 'node:assert/strict';
import test from 'node:test';
import type { Abastecimento, Comboio, Empresa, Equipamento, TipoCombustivel } from '../src/types';
import {
  buildFuelReport,
  filterFuelReportRecords,
  getFuelCompetencePeriodLabel,
  getFuelRecordCompetence,
  type FuelReportFilters,
} from '../src/modules/frota/fuelReport';

const empresas: Empresa[] = [
  { id: 'renea', nome: 'RENEA', cnpj: '', telefone: '', responsavel: '' },
  { id: 'terceira', nome: 'Terceira', cnpj: '', telefone: '', responsavel: '' },
];

const equipamentos: Equipamento[] = [
  {
    id: 'eq-1',
    prefixo: 'CB001',
    nome: 'Caminhao Basculante',
    tipo: 'Caminhao',
    marca: '',
    modelo: '',
    seriePlaca: '',
    status: 'Ativo',
    empresaId: 'renea',
    localAtualId: '',
    observacao: '',
  },
  {
    id: 'eq-2',
    prefixo: 'ESC200',
    nome: 'Escavadeira',
    tipo: 'Escavadeira',
    marca: '',
    modelo: '',
    seriePlaca: '',
    status: 'Ativo',
    empresaId: 'terceira',
    localAtualId: '',
    observacao: '',
  },
];

const comboios: Comboio[] = [
  { id: 'comboio-a', nome: 'Comboio A', placa: '', capacidadeLitros: 0, responsavel: '' },
];

const combustiveis: TipoCombustivel[] = [
  { id: 'diesel', nome: 'Diesel S10' },
];

const abastecimentos: Abastecimento[] = [
  {
    id: 'fuel-1',
    data: '2026-06-02',
    hora: '07:00',
    equipamentoId: 'eq-1',
    prefixoInformado: 'CB001',
    horimetroInicial: 100,
    kmInicial: 1200,
    bombaInicial: 1000,
    quantidadeLitros: 100,
    bombaFinal: 1100,
    tipoCombustivelId: 'diesel',
    comboioId: 'comboio-a',
    responsavel: 'Operador',
    observacao: '',
    status: 'OK',
    integracaoAba: 'JUNHO 2026',
    integracaoLinha: 10,
  },
  {
    id: 'fuel-2',
    data: '2026-07-03',
    hora: '08:00',
    equipamentoId: 'eq-2',
    prefixoInformado: 'ESC200',
    horimetroInicial: 200,
    kmInicial: 0,
    bombaInicial: 1100,
    quantidadeLitros: 150,
    bombaFinal: 1250,
    tipoCombustivelId: 'diesel',
    comboioId: 'comboio-a',
    responsavel: 'Operador',
    observacao: 'Linha importada',
    status: 'Conferência necessária',
    alertas: [{ codigo: 'AVISO_PLANILHA', campo: 'linha', severidade: 'aviso', mensagem: 'Conferir prefixo.' }],
    integracaoAba: 'JULHO 2026',
    integracaoLinha: 22,
  },
  {
    id: 'fuel-3',
    data: '2026-07-04',
    hora: '09:00',
    equipamentoId: 'eq-1',
    prefixoInformado: 'CB001',
    horimetroInicial: 130,
    kmInicial: 1300,
    bombaInicial: 1250,
    quantidadeLitros: 75,
    bombaFinal: 1325,
    tipoCombustivelId: 'diesel',
    comboioId: 'comboio-a',
    responsavel: 'Operador',
    observacao: '',
    status: 'Cancelado',
  },
];

test('filtra abastecimentos por competencia, empresa, texto e conferencia', () => {
  const filtros: FuelReportFilters = {
    competencias: ['2026-07'],
    empresaIds: ['terceira'],
    texto: 'esc',
    apenasConferencia: true,
  };

  const filtrados = filterFuelReportRecords(abastecimentos, filtros, { equipamentos, empresas, comboios, combustiveis });

  assert.deepEqual(filtrados.map(item => item.id), ['fuel-2']);
});

test('relatorio soma por competencia e preserva linhas de conferencia', () => {
  const report = buildFuelReport({
    records: abastecimentos,
    equipamentos,
    empresas,
    comboios,
    combustiveis,
  });

  assert.equal(report.totalRegistros, 2);
  assert.equal(report.totalLitros, 250);
  assert.equal(report.totalConferencia, 1);
  assert.deepEqual(report.porCompetencia.map(item => [item.chave, item.registros, item.litros]), [
    ['2026-07', 1, 150],
    ['2026-06', 1, 100],
  ]);
  assert.equal(report.linhasExcel[0].aba, 'JULHO 2026');
  assert.equal(report.linhasExcel[0].status, 'Conferência necessária');
  assert.equal(report.linhasExcel[1].prefixo, 'CB001');
});

test('competencia do combustivel segue ciclo operacional de 21 a 20', () => {
  assert.equal(getFuelRecordCompetence({ data: '2026-09-20', competencia: '2026-09' }), '2026-09');
  assert.equal(getFuelRecordCompetence({ data: '2026-09-21', competencia: '2026-09' }), '2026-10');
  assert.equal(getFuelCompetencePeriodLabel('2026-10'), '21/09 a 20/10');
});

test('relatorio aceita intervalo livre de datas', () => {
  const filtrados = filterFuelReportRecords(abastecimentos, {
    dataInicio: '2026-07-01',
    dataFim: '2026-07-31',
  }, { equipamentos, empresas, comboios, combustiveis });

  assert.deepEqual(filtrados.map(item => item.id), ['fuel-2']);
});
