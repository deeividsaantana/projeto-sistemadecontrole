import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calcularDuracao,
  formatarDuracao,
  extrairFasesCiclo,
  montarTimeline,
  calcularMetricasCiclos,
  type EquipmentCycle,
  type CycleEvent,
} from '../src/fleet/cycleHistory';

test('cycleHistory', async t => {
  await t.test('calcularDuracao', async t => {
    await t.test('deve calcular minutos entre dois timestamps ISO', () => {
      const de = '2026-11-03T08:00:00Z';
      const ate = '2026-11-03T09:00:00Z';
      assert.equal(calcularDuracao(de, ate), 60);
    });

    await t.test('deve retornar 0 para timestamps iguais', () => {
      const timestamp = '2026-11-03T08:00:00Z';
      assert.equal(calcularDuracao(timestamp, timestamp), 0);
    });

    await t.test('deve retornar 0 quando "ate" é antes de "de"', () => {
      const de = '2026-11-03T09:00:00Z';
      const ate = '2026-11-03T08:00:00Z';
      assert.equal(calcularDuracao(de, ate), 0);
    });

    await t.test('deve calcular frações de minuto corretamente', () => {
      const de = '2026-11-03T08:00:00Z';
      const ate = '2026-11-03T08:30:30Z';
      assert.equal(calcularDuracao(de, ate), 31); // 30.5 minutos arredonda para 31
    });
  });

  await t.test('formatarDuracao', async t => {
    await t.test('deve formatar minutos apenas', () => {
      assert.equal(formatarDuracao(45), '45 min');
      assert.equal(formatarDuracao(59), '59 min');
    });

    await t.test('deve formatar horas exatas', () => {
      assert.equal(formatarDuracao(60), '1 h');
      assert.equal(formatarDuracao(120), '2 h');
    });

    await t.test('deve formatar horas e minutos', () => {
      assert.equal(formatarDuracao(75), '1 h 15 min');
      assert.equal(formatarDuracao(135), '2 h 15 min');
    });

    await t.test('deve lidar com 0', () => {
      assert.equal(formatarDuracao(0), '0 min');
    });
  });

  await t.test('extrairFasesCiclo', async t => {
    await t.test('deve extrair fases com duração calculada', () => {
      const ciclo: EquipmentCycle = {
        id: 'cic-1',
        equipamentoId: 'eq-1',
        prefixo: 'M31',
        dataInicio: '2026-11-03',
        statusAtual: 'Em operação',
        eventos: [
          {
            id: 'evt-1',
            equipamentoId: 'eq-1',
            status: 'Em operação',
            timestamp: '2026-11-03T08:00:00Z',
            hora: '08:00',
            responsavel: 'João',
          },
          {
            id: 'evt-2',
            equipamentoId: 'eq-1',
            status: 'Em manutenção',
            timestamp: '2026-11-03T08:30:00Z',
            hora: '08:30',
            responsavel: 'João',
            motivo: 'Troca de óleo',
          },
          {
            id: 'evt-3',
            equipamentoId: 'eq-1',
            status: 'À disposição',
            timestamp: '2026-11-03T10:00:00Z',
            hora: '10:00',
            responsavel: 'Maria',
          },
        ],
      };

      const fases = extrairFasesCiclo(ciclo);

      assert.equal(fases.length, 3);
      assert.equal(fases[0].status, 'Em operação');
      assert.equal(fases[0].duracao, 30); // 08:30 - 08:00
      assert.equal(fases[1].status, 'Em manutenção');
      assert.equal(fases[1].duracao, 90); // 10:00 - 08:30
      assert.equal(fases[2].status, 'À disposição');
      assert.equal(fases[2].duracao, undefined); // Sem próximo evento
    });
  });

  await t.test('montarTimeline', async t => {
    await t.test('deve converter fases para timeline visual', () => {
      const ciclo: EquipmentCycle = {
        id: 'cic-1',
        equipamentoId: 'eq-1',
        prefixo: 'M31',
        dataInicio: '2026-11-03',
        statusAtual: 'À disposição',
        eventos: [
          {
            id: 'evt-1',
            equipamentoId: 'eq-1',
            status: 'Em operação',
            timestamp: '2026-11-03T08:00:00Z',
            hora: '08:00',
            responsavel: 'João',
          },
          {
            id: 'evt-2',
            equipamentoId: 'eq-1',
            status: 'À disposição',
            timestamp: '2026-11-03T10:00:00Z',
            hora: '10:00',
            responsavel: 'Maria',
          },
        ],
      };

      const fases = extrairFasesCiclo(ciclo);
      const timeline = montarTimeline(fases);

      assert.equal(timeline.length, 2);
      assert.equal(timeline[0].status, 'Em operação');
      assert.equal(timeline[0].icone, 'play');
      assert.equal(timeline[0].duracao, '2 h');
      assert.equal(timeline[1].icone, 'check');
    });
  });

  await t.test('calcularMetricasCiclos', async t => {
    await t.test('deve calcular métricas agregadas corretamente', () => {
      const ciclos: EquipmentCycle[] = [
        {
          id: 'cic-1',
          equipamentoId: 'eq-1',
          prefixo: 'M31',
          dataInicio: '2026-11-03',
          statusAtual: 'À disposição',
          eventos: [
            {
              id: 'evt-1',
              equipamentoId: 'eq-1',
              status: 'Em operação',
              timestamp: '2026-11-03T08:00:00Z',
              hora: '08:00',
              responsavel: 'João',
            },
            {
              id: 'evt-2',
              equipamentoId: 'eq-1',
              status: 'À disposição',
              timestamp: '2026-11-03T10:00:00Z',
              hora: '10:00',
              responsavel: 'Maria',
            },
          ],
        },
      ];

      const metricas = calcularMetricasCiclos(ciclos);

      assert.equal(metricas.totalOperacao, 120); // 2 horas
      assert.equal(metricas.totalManutencao, 0);
      assert.equal(metricas.disponibilidade, 100);
    });

    await t.test('deve calcular disponibilidade com múltiplos estados', () => {
      const ciclos: EquipmentCycle[] = [
        {
          id: 'cic-1',
          equipamentoId: 'eq-1',
          prefixo: 'M31',
          dataInicio: '2026-11-03',
          statusAtual: 'À disposição',
          eventos: [
            {
              id: 'evt-1',
              equipamentoId: 'eq-1',
              status: 'Em operação',
              timestamp: '2026-11-03T08:00:00Z',
              hora: '08:00',
              responsavel: 'João',
            },
            {
              id: 'evt-2',
              equipamentoId: 'eq-1',
              status: 'Em manutenção',
              timestamp: '2026-11-03T10:00:00Z',
              hora: '10:00',
              responsavel: 'João',
              motivo: 'Troca de óleo',
            },
            {
              id: 'evt-3',
              equipamentoId: 'eq-1',
              status: 'À disposição',
              timestamp: '2026-11-03T12:00:00Z',
              hora: '12:00',
              responsavel: 'Maria',
            },
          ],
        },
      ];

      const metricas = calcularMetricasCiclos(ciclos);

      assert.equal(metricas.totalOperacao, 120); // 08:00 - 10:00
      assert.equal(metricas.totalManutencao, 120); // 10:00 - 12:00
      assert.equal(metricas.disponibilidade, 50); // 50/50
    });
  });
});
