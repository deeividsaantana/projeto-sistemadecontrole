import assert from 'node:assert/strict';
import test from 'node:test';
import type { Abastecimento, Empresa, Equipamento } from '../src/types';
import { montarConsumoPorEquipamento, textoConsumo } from '../src/modules/frota/consumoPorEquipamento';

let seq = 0;
const ab = (extra: Partial<Abastecimento>): Abastecimento => ({
  id: `a${++seq}`, data: '2026-09-01', hora: '08:00', equipamentoId: 'eq-1', horimetroInicial: 0, kmInicial: 0,
  bombaInicial: 0, quantidadeLitros: 100, bombaFinal: 0, tipoCombustivelId: 'd', comboioId: 'c', responsavel: '', observacao: '', ...extra,
});
const equipamentos = [
  { id: 'eq-1', prefixo: 'ES01', nome: 'Escavadeira', empresaId: 'e1' },
  { id: 'eq-2', prefixo: 'CB02', nome: 'Caminhão', empresaId: 'e1' },
] as Equipamento[];
const empresas = [{ id: 'e1', nome: 'RENEA' }] as Empresa[];

/** Escavadeira que gasta 20 L/h: 200 L a cada 10 h. */
const historicoNormal = (dias: string[], inicio = 1000) => dias.map((data, i) => ab({ data, horimetroInicial: inicio + i * 10, quantidadeLitros: 200 }));

test('consumo da máquina em L/h, com o habitual pela mediana do histórico', () => {
  const [linha] = montarConsumoPorEquipamento({
    registros: historicoNormal(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06']),
    equipamentos, empresas,
  });
  assert.equal(linha.prefixo, 'ES01');
  assert.equal(linha.empresa, 'RENEA');
  assert.equal(linha.unidade, 'L/h');
  assert.equal(linha.abastecimentos, 6);
  assert.equal(linha.litros, 1200);
  assert.equal(linha.percorrido, 50);
  assert.equal(linha.consumoPeriodo, 20);
  assert.equal(linha.consumoHabitual, 20);
  assert.equal(linha.desvio, 0);
  assert.equal(linha.situacao, 'normal');
});

test('máquina que passa a gastar mais no período aparece como acima do normal', () => {
  const registros = [
    ...historicoNormal(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06']),
    ab({ data: '2026-09-10', horimetroInicial: 1060, quantidadeLitros: 300 }),
    ab({ data: '2026-09-11', horimetroInicial: 1070, quantidadeLitros: 300 }),
  ];
  const [linha] = montarConsumoPorEquipamento({ registros, equipamentos, empresas, filtro: { dataInicio: '2026-09-01', dataFim: '2026-09-30' } });
  assert.equal(linha.abastecimentos, 2);
  assert.equal(linha.consumoPeriodo, 30);
  assert.equal(linha.consumoHabitual, 20);
  assert.equal(linha.desvio, 0.5);
  assert.equal(linha.situacao, 'acima');
  assert.ok(linha.intervalos.every(item => item.foraDoPadrao));
  assert.equal(linha.intervalos[0].data, '2026-09-11', 'abastecimento mais recente primeiro');
});

test('horímetro que volta é marcado para conferir e não entra na conta', () => {
  const registros = [
    ab({ data: '2026-09-01', horimetroInicial: 1000 }),
    ab({ data: '2026-09-02', horimetroInicial: 1010, quantidadeLitros: 200 }),
    ab({ data: '2026-09-03', horimetroInicial: 900, quantidadeLitros: 200 }),
    ab({ data: '2026-09-04', horimetroInicial: 1020, quantidadeLitros: 200 }),
  ];
  const [linha] = montarConsumoPorEquipamento({ registros, equipamentos, empresas });
  assert.equal(linha.leiturasConferir, 1);
  assert.equal(linha.situacao, 'conferir');
  const seguinte = linha.intervalos.find(item => item.data === '2026-09-04');
  assert.equal(seguinte?.valor, 40, 'conta da última leitura boa, com o diesel do abastecimento errado junto');
  assert.equal(linha.consumoPeriodo, 30);
  assert.equal(linha.intervalos.find(item => item.leituraVoltou)?.valor, undefined);
});

test('veículo em km/L: rodar menos por litro é gastar mais', () => {
  const kms = [10000, 10400, 10800, 11200, 11600, 12000];
  const registros = [
    ...kms.map((km, i) => ab({ equipamentoId: 'eq-2', data: `2026-08-0${i + 1}`, kmInicial: km, quantidadeLitros: 100 })),
    ab({ equipamentoId: 'eq-2', data: '2026-09-02', kmInicial: 12200, quantidadeLitros: 100 }),
  ];
  const [linha] = montarConsumoPorEquipamento({ registros, equipamentos, empresas, filtro: { dataInicio: '2026-09-01' } });
  assert.equal(linha.unidade, 'km/L');
  assert.equal(linha.consumoHabitual, 4);
  assert.equal(linha.consumoPeriodo, 2);
  assert.equal(linha.desvio, 1);
  assert.equal(linha.situacao, 'acima');
});

test('sem leitura não inventa consumo; sem cadastro agrupa pelo prefixo digitado; fora do período some', () => {
  const linhas = montarConsumoPorEquipamento({
    registros: [
      ab({ equipamentoId: '', prefixoInformado: 'xp9', data: '2026-09-05' }),
      ab({ equipamentoId: '', prefixoInformado: 'XP9 ', data: '2026-09-06' }),
      ab({ equipamentoId: 'eq-2', data: '2026-07-01' }),
    ],
    equipamentos, empresas, filtro: { dataInicio: '2026-09-01' },
  });
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].prefixo, 'XP9');
  assert.equal(linhas[0].abastecimentos, 2);
  assert.equal(linhas[0].consumoPeriodo, undefined);
  assert.equal(linhas[0].situacao, 'sem-leitura');
  assert.equal(textoConsumo(undefined, undefined), '—');
  assert.equal(textoConsumo(18.25, 'L/h'), '18,3 L/h');
});

test('mês operacional vai do dia 21 do mês anterior ao dia 20', async () => {
  const { periodoDaCompetencia } = await import('../src/modules/frota/consumoPorEquipamento');
  assert.deepEqual(periodoDaCompetencia('2026-10'), { dataInicio: '2026-09-21', dataFim: '2026-10-20' });
  assert.deepEqual(periodoDaCompetencia('2026-01'), { dataInicio: '2025-12-21', dataFim: '2026-01-20' });
  assert.deepEqual(periodoDaCompetencia('sem-data'), {});
});
