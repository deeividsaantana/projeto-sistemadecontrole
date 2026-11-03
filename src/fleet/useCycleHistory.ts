import { useState, useCallback, useEffect } from 'react';
import type { EquipmentCycle, CycleEvent } from './cycleHistory';
import {
  adicionarEventoAoCiclo,
  carregarCiclosDoStorage,
  salvarCiclosNoStorage,
  extrairFasesCiclo,
  calcularMetricasCiclos,
} from './cycleHistory';

export const useCycleHistory = () => {
  const [ciclos, setCiclos] = useState<Map<string, EquipmentCycle[]>>(new Map());
  const [carregando, setCarregando] = useState(true);

  // Carrega ciclos do localStorage na inicialização
  useEffect(() => {
    try {
      const carregados = carregarCiclosDoStorage();
      setCiclos(carregados);
    } finally {
      setCarregando(false);
    }
  }, []);

  // Registra um novo evento de ciclo
  const registrarEvento = useCallback(
    (evento: CycleEvent & { prefixo: string }) => {
      setCiclos(prev => adicionarEventoAoCiclo(prev, evento));
    },
    []
  );

  // Salva ciclos no localStorage
  const salvar = useCallback(() => {
    salvarCiclosNoStorage(ciclos);
  }, [ciclos]);

  // Obtém ciclos de um equipamento
  const obterCiclosEquipamento = useCallback(
    (equipamentoId: string): EquipmentCycle[] => {
      return ciclos.get(equipamentoId) || [];
    },
    [ciclos]
  );

  // Obtém todas as fases de um ciclo
  const obterFases = useCallback(
    (ciclo: EquipmentCycle) => {
      return extrairFasesCiclo(ciclo);
    },
    []
  );

  // Calcula métricas de ciclos
  const calcularMetricas = useCallback(
    (equipamentoIds?: string[]) => {
      const ciclosParaCalc = equipamentoIds
        ? Array.from(ciclos.values()).flat()
          .filter(c => equipamentoIds.includes(c.equipamentoId))
        : Array.from(ciclos.values()).flat();

      return calcularMetricasCiclos(ciclosParaCalc);
    },
    [ciclos]
  );

  return {
    ciclos: Array.from(ciclos.values()).flat(),
    carregando,
    registrarEvento,
    salvar,
    obterCiclosEquipamento,
    obterFases,
    calcularMetricas,
  };
};
