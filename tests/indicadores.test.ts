import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularIndicadores } from '../src/utils/indicadores';
import type { PresencaApontamento, RegistroProducao } from '../src/types';

const contexto = { hoje: '2026-01-31', inicio: '2026-01-01', fim: '2026-01-31' };

const producao = (id: string, data: string, quantidade: number): RegistroProducao => ({
  id, data, servicoId: 's1', servicoDescricao: 'x', unidade: 'm³', quantidade,
  responsavel: 'D', ativo: true, criadoEm: data, atualizadoEm: data,
});

const presenca = (id: string, status: PresencaApontamento['status']): PresencaApontamento => ({
  id, data: '2026-01-10', grupoId: 'g1', funcionarioId: id, funcionarioNome: id, status,
} as PresencaApontamento);

test('indicador sem base retorna zero em vez de inventar número', () => {
  const indicadores = calcularIndicadores(contexto);
  assert.equal(indicadores.find(item => item.id === 'disponibilidade-frota')?.valor, 0);
  assert.equal(indicadores.find(item => item.id === 'producao-total')?.variacao, undefined);
});

test('presença efetiva conta atraso e saída antecipada como presença', () => {
  const indicadores = calcularIndicadores({
    ...contexto,
    presencasLink: [presenca('1', 'Presente'), presenca('2', 'Atraso'), presenca('3', 'Ausente')],
  });
  assert.equal(indicadores.find(item => item.id === 'presenca')?.valor, 66.7);
});

test('variação compara com o período anterior de mesmo tamanho', () => {
  const indicadores = calcularIndicadores({
    ...contexto,
    inicioAnterior: '2025-12-01',
    fimAnterior: '2025-12-31',
    producao: [producao('1', '2026-01-10', 150), producao('2', '2025-12-10', 100)],
  });
  const indicador = indicadores.find(item => item.id === 'producao-total');
  assert.equal(indicador?.valor, 150);
  assert.equal(indicador?.variacao, 50);
  assert.equal(indicador?.tendencia, 'alta');
});

test('indicadores negativos são marcados como quanto menor melhor', () => {
  const indicadores = calcularIndicadores(contexto);
  assert.equal(indicadores.find(item => item.id === 'acidentes')?.maiorMelhor, false);
  assert.equal(indicadores.find(item => item.id === 'presenca')?.maiorMelhor, true);
});
