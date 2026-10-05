import assert from 'node:assert/strict';
import test from 'node:test';
import {
  diasNoMes,
  faixaDaChuva,
  mesesComDiario,
  montarMesDeChuva,
} from '../src/utils/mapaChuva';
import type { DiarioObra } from '../src/types';

const diario = (data: string, over: Partial<DiarioObra> = {}): DiarioObra => ({
  id: `d-${data}`,
  data,
  climaManha: 'Bom',
  climaTarde: 'Bom',
  responsavel: 'Deivid',
  ativo: true,
  criadoEm: '',
  atualizadoEm: '',
  ...over,
});

test('o pluviômetro do diário vira o total do mês', () => {
  const mes = montarMesDeChuva([
    diario('2026-09-01', { precipitacaoMm: 10 }),
    diario('2026-09-02', { precipitacaoMm: 5.5 }),
    diario('2026-09-03', { precipitacaoMm: 0 }),
  ], 2026, 9);

  assert.equal(mes.totalMm, 15.5);
  assert.equal(mes.diasComChuva, 2, 'o dia de 0 mm não é dia de chuva');
  assert.equal(mes.rotulo, 'Setembro de 2026');
  assert.equal(mes.dias.length, 30);
});

test('dia sem diário é diferente de dia sem chuva', () => {
  const mes = montarMesDeChuva([diario('2026-09-01', { precipitacaoMm: 0 })], 2026, 9);

  assert.equal(mes.dias[0].milimetros, 0, 'dia 1 teve diário e não choveu');
  assert.equal(mes.dias[1].milimetros, null, 'dia 2 não teve diário nenhum');
  assert.equal(mes.diasSemDiario, 29);
  assert.equal(faixaDaChuva(mes.dias[0].milimetros), 'seco');
  assert.equal(faixaDaChuva(mes.dias[1].milimetros), 'sem-diario');
});

test('clima impraticável e horas paradas entram no resumo do mês', () => {
  const mes = montarMesDeChuva([
    diario('2026-09-01', { precipitacaoMm: 60, climaTarde: 'Impraticável', horasParadasClima: 8 }),
    diario('2026-09-02', { precipitacaoMm: 2, horasParadasClima: 1.5 }),
  ], 2026, 9);

  assert.equal(mes.diasImpraticaveis, 1);
  assert.equal(mes.horasParadas, 9.5);
  assert.equal(mes.maiorMm, 60);
});

test('diário inativado sai do mapa sem deixar buraco de dado falso', () => {
  const mes = montarMesDeChuva([
    diario('2026-09-01', { precipitacaoMm: 30, ativo: false }),
    diario('2026-09-02', { precipitacaoMm: 4 }),
  ], 2026, 9);

  assert.equal(mes.totalMm, 4);
  assert.equal(mes.dias[0].milimetros, null, 'o dia volta a ser "sem diário", não "sem chuva"');
});

test('as faixas vão do seco ao muito forte, sem arco-íris no meio', () => {
  assert.equal(faixaDaChuva(0), 'seco');
  assert.equal(faixaDaChuva(4.9), 'fraca');
  assert.equal(faixaDaChuva(5), 'moderada');
  assert.equal(faixaDaChuva(24.9), 'moderada');
  assert.equal(faixaDaChuva(25), 'forte');
  assert.equal(faixaDaChuva(49.9), 'forte');
  assert.equal(faixaDaChuva(50), 'muito-forte');
});

test('fevereiro bissexto tem 29 dias no mapa', () => {
  assert.equal(diasNoMes(2028, 2), 29);
  assert.equal(diasNoMes(2026, 2), 28);
  assert.equal(montarMesDeChuva([], 2028, 2).dias.length, 29);
});

test('os meses com diário vêm do mais recente para o mais antigo', () => {
  const meses = mesesComDiario([
    diario('2026-07-10'), diario('2026-09-02'), diario('2026-08-15'), diario('2026-09-20'),
  ]);
  assert.deepEqual(meses, [
    { ano: 2026, mes: 9 }, { ano: 2026, mes: 8 }, { ano: 2026, mes: 7 },
  ]);
});

test('valor negativo ou lixo no pluviômetro não vira chuva', () => {
  const mes = montarMesDeChuva([
    diario('2026-09-01', { precipitacaoMm: -5 }),
    diario('2026-09-02', { precipitacaoMm: Number.NaN }),
  ], 2026, 9);
  assert.equal(mes.totalMm, 0);
  assert.equal(mes.diasComChuva, 0);
});
