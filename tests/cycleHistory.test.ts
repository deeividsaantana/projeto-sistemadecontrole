import { describe, it, expect } from 'vitest';
import {
  calcularDuracao,
  formatarDuracao,
  extrairFasesCiclo,
  montarTimeline,
  calcularMetricasCiclos,
  type EquipmentCycle,
  type CycleEvent,
} from '../src/fleet/cycleHistory';

describe('cycleHistory', () => {
  describe('calcularDuracao', () => {
    it('deve calcular minutos entre dois timestamps ISO', () => {
      const de = '2026-11-03T08:00:00Z';
      const ate = '2026-11-03T09:00:00Z';
      expect(calcularDuracao(de, ate)).toBe(60);
    });

    it('deve retornar 0 para timestamps iguais', () => {
      const timestamp = '2026-11-03T08:00:00Z';
      expect(calcularDuracao(timestamp, timestamp)).toBe(0);
    });

    it('deve retornar 0 quando "ate" é antes de "de"', () => {
      const de = '2026-11-03T09:00:00Z';
      const ate = '2026-11-03T08:00:00Z';
      expect(calcularDuracao(de, ate)).toBe(0);
    });

    it('deve calcular frações de minuto corretamente', () => {
      const de = '2026-11-03T08:00:00Z';
      const ate = '2026-11-03T08:30:30Z';
      expect(calcularDuracao(de, ate)).toBe(31); // 30.5 minutos arredonda para 31
    });
  });

  describe('formatarDuracao', () => {
    it('deve formatar minutos apenas', () => {
      expect(formatarDuracao(45)).toBe('45 min');
      expect(formatarDuracao(59)).toBe('59 min');
    });

    it('deve formatar horas exatas', () => {
      expect(formatarDuracao(60)).toBe('1 h');
      expect(formatarDuracao(120)).toBe('2 h');
    });

    it('deve formatar horas e minutos', () => {
      expect(formatarDuracao(75)).toBe('1 h 15 min');
      expect(formatarDuracao(135)).toBe('2 h 15 min');
    });

    it('deve lidar com 0', () => {
      expect(formatarDuracao(0)).toBe('0 min');
    });
  });

  describe('extrairFasesCiclo', () => {
    it('deve extrair fases com duração calculada', () => {
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

      expect(fases.length).toBe(3);
      expect(fases[0].status).toBe('Em operação');
      expect(fases[0].duracao).toBe(30); // 08:30 - 08:00
      expect(fases[1].status).toBe('Em manutenção');
      expect(fases[1].duracao).toBe(90); // 10:00 - 08:30
      expect(fases[2].status).toBe('À disposição');
      expect(fases[2].duracao).toBeUndefined(); // Sem próximo evento
    });
  });

  describe('montarTimeline', () => {
    it('deve converter fases para timeline visual', () => {
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

      expect(timeline.length).toBe(2);
      expect(timeline[0].status).toBe('Em operação');
      expect(timeline[0].icone).toBe('play');
      expect(timeline[0].duracao).toBe('2 h');
      expect(timeline[1].icone).toBe('check');
    });
  });

  describe('calcularMetricasCiclos', () => {
    it('deve calcular métricas agregadas corretamente', () => {
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

      expect(metricas.totalOperacao).toBe(120); // 2 horas
      expect(metricas.totalManutencao).toBe(0);
      expect(metricas.disponibilidade).toBe(100);
    });

    it('deve calcular disponibilidade com múltiplos estados', () => {
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

      expect(metricas.totalOperacao).toBe(120); // 08:00 - 10:00
      expect(metricas.totalManutencao).toBe(120); // 10:00 - 12:00
      expect(metricas.disponibilidade).toBe(50); // 50/50
    });
  });
});
