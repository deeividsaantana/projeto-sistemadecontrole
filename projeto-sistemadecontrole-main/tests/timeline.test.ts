import assert from 'node:assert/strict';
import test from 'node:test';
import { agruparPorDia, montarTimeline, tiposDaTimeline } from '../src/utils/timeline';
import type { HistoryLog, Ocorrencia, RegistroProducao } from '../src/types';

const producao: RegistroProducao = {
  id: 'r1', data: '2026-01-10', servicoId: 's1', servicoDescricao: 'Escavação',
  unidade: 'm³', quantidade: 40, frente: 'Frente 1', responsavel: 'D',
  ativo: true, criadoEm: '', atualizadoEm: '',
};

const ocorrencia: Ocorrencia = {
  id: 'o1', numero: 'OC-1', data: '2026-01-12', hora: '09:00', tipo: 'Clima',
  impacto: 'Médio', situacao: 'Registrada', descricao: 'Chuva forte',
  equipamentoId: 'eq1', registradoPor: 'D', ativo: true, criadoEm: '', atualizadoEm: '',
};

const log: HistoryLog = {
  id: 'l1', timestamp: '2026-01-11T14:30:00.000Z', usuario: 'deivid',
  acao: 'Editou', tela: 'Frota', descricao: 'Alterou o prefixo',
};

const filtros = { inicio: '2026-01-01', fim: '2026-01-31' };

test('timeline ordena do mais recente para o mais antigo', () => {
  const eventos = montarTimeline({ producao: [producao], ocorrencias: [ocorrencia], historyLogs: [log] }, filtros);
  assert.deepEqual(eventos.map(item => item.data), ['2026-01-12', '2026-01-11', '2026-01-10']);
});

test('filtro por equipamento e por tipo restringe o resultado', () => {
  const fontes = { producao: [producao], ocorrencias: [ocorrencia] };
  assert.deepEqual(montarTimeline(fontes, { ...filtros, equipamentoId: 'eq1' }).map(item => item.tipo), ['Ocorrência']);
  assert.deepEqual(montarTimeline(fontes, { ...filtros, frente: 'Frente 1' }).map(item => item.tipo), ['Produção']);
  assert.equal(montarTimeline(fontes, { ...filtros, tipos: ['Produção'] }).length, 1);
});

test('registro inativo e fora do período não entram', () => {
  assert.equal(montarTimeline({ producao: [{ ...producao, ativo: false }] }, filtros).length, 0);
  assert.equal(montarTimeline({ producao: [producao] }, { inicio: '2026-02-01', fim: '2026-02-28' }).length, 0);
});

test('tipos e agrupamento por dia saem do próprio resultado', () => {
  const eventos = montarTimeline({ producao: [producao], ocorrencias: [ocorrencia] }, filtros);
  assert.deepEqual(tiposDaTimeline(eventos), ['Ocorrência', 'Produção']);
  assert.deepEqual(agruparPorDia(eventos).map(([dia]) => dia), ['2026-01-12', '2026-01-10']);
});
