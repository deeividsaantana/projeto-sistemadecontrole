/**
 * Rastreamento de ciclos operacionais em frotas.
 * Um ciclo é a transição de estados: Operação → Manutenção → Liberado → Operação
 * Cada transição registra timestamp, responsável e duração.
 */

export type CycleStatus = 'Em operação' | 'Em manutenção' | 'À disposição' | 'Aguardando manutenção';

export interface CycleEvent {
  id: string;
  equipamentoId: string;
  status: CycleStatus;
  timestamp: string; // ISO 8601 completo (2026-11-03T08:37:00Z)
  hora: string; // HH:MM local
  responsavel: string; // usuário que registrou
  motivo?: string; // motivo da manutenção ou observação
  operador?: string; // motorista/operador confirmado (só em "Em operação")
}

export interface EquipmentCycle {
  id: string;
  equipamentoId: string;
  prefixo: string;
  dataInicio: string; // YYYY-MM-DD
  eventos: CycleEvent[];
  statusAtual: CycleStatus;
  duracao?: number; // minutos total do ciclo
}

/**
 * Uma etapa do ciclo com duração calculada.
 * Ex: "Em operação" de 09:37 até "Em manutenção" às 08:39 = 58 minutos parado
 */
export interface CyclePhase {
  status: CycleStatus;
  iniciouEm: string; // timestamp ISO
  hora: string; // HH:MM
  terminouEm?: string; // timestamp ISO (próximo evento)
  horaFim?: string; // HH:MM
  duracao?: number; // minutos
  responsavel: string;
  motivo?: string;
  operador?: string; // motorista/operador confirmado
}

/**
 * Resumo visual para timeline (tipo Mercado Livre).
 */
export interface CycleTimelineEntry {
  status: CycleStatus;
  timestamp: string;
  hora: string;
  duracao?: string; // "58 min", "2 h 15 min"
  responsavel: string;
  motivo?: string;
  operador?: string; // motorista/operador confirmado
  icone: 'play' | 'wrench' | 'check' | 'clock';
}

/**
 * Extrai as fases do ciclo a partir dos eventos ordenados.
 */
export const extrairFasesCiclo = (ciclo: EquipmentCycle): CyclePhase[] => {
  const fases: CyclePhase[] = [];
  const eventos = [...ciclo.eventos].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  for (let i = 0; i < eventos.length; i++) {
    const evento = eventos[i];
    const proximo = eventos[i + 1];
    const duracao = proximo ? calcularDuracao(evento.timestamp, proximo.timestamp) : undefined;

    fases.push({
      status: evento.status,
      iniciouEm: evento.timestamp,
      hora: evento.hora,
      terminouEm: proximo?.timestamp,
      horaFim: proximo?.hora,
      duracao,
      responsavel: evento.responsavel,
      motivo: evento.motivo,
      operador: evento.operador,
    });
  }

  return fases;
};

/**
 * Converte fases para timeline visual (Mercado Livre style).
 */
export const montarTimeline = (fases: CyclePhase[]): CycleTimelineEntry[] => {
  const icones: Record<CycleStatus, 'play' | 'wrench' | 'check' | 'clock'> = {
    'Em operação': 'play',
    'Em manutenção': 'wrench',
    'À disposição': 'check',
    'Aguardando manutenção': 'clock',
  };

  return fases.map(fase => ({
    status: fase.status,
    timestamp: fase.iniciouEm,
    hora: fase.hora,
    duracao: fase.duracao ? formatarDuracao(fase.duracao) : undefined,
    responsavel: fase.responsavel,
    motivo: fase.motivo,
    operador: fase.operador,
    icone: icones[fase.status],
  }));
};

/**
 * Calcula minutos entre dois timestamps ISO.
 */
export const calcularDuracao = (de: string, ate: string): number => {
  try {
    const msec = new Date(ate).getTime() - new Date(de).getTime();
    return Math.max(0, Math.round(msec / (1000 * 60)));
  } catch {
    return 0;
  }
};

/**
 * Formata minutos como "58 min" ou "2 h 15 min".
 */
export const formatarDuracao = (minutos: number): string => {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  if (mins === 0) return `${horas} h`;
  return `${horas} h ${mins} min`;
};

/**
 * Calcula métricas agregadas de um equipamento.
 */
export interface CycleMetrics {
  totalOperacao: number; // minutos
  totalManutencao: number; // minutos
  totalParado: number; // minutos
  ciclosCompletos: number; // Operação → ... → Operação
  ultimaAtualizacao: string; // ISO
  disponibilidade: number; // 0-100%
}

export const calcularMetricasCiclos = (ciclos: EquipmentCycle[]): CycleMetrics => {
  let totalOp = 0;
  let totalMan = 0;
  let totalPar = 0;
  let ciclosCompletos = 0;
  let ultimaAtualizacao = '';

  ciclos.forEach(ciclo => {
    const fases = extrairFasesCiclo(ciclo);
    ultimaAtualizacao = ciclo.eventos[ciclo.eventos.length - 1]?.timestamp || ultimaAtualizacao;

    fases.forEach(fase => {
      const dur = fase.duracao || 0;
      if (fase.status === 'Em operação') totalOp += dur;
      if (fase.status === 'Em manutenção' || fase.status === 'Aguardando manutenção') totalMan += dur;
      if (fase.status === 'À disposição') totalPar += dur;
    });

    // Ciclo completo = começa e termina em "Em operação"
    const primeira = fases[0];
    const ultima = fases[fases.length - 1];
    if (primeira?.status === 'Em operação' && ultima?.status === 'Em operação') {
      ciclosCompletos++;
    }
  });

  const total = totalOp + totalMan + totalPar || 1;
  return {
    totalOperacao: totalOp,
    totalManutencao: totalMan,
    totalParado: totalPar,
    ciclosCompletos,
    ultimaAtualizacao,
    disponibilidade: Math.round((totalOp / total) * 100),
  };
};

/**
 * Schema para Supabase.
 * CREATE TABLE IF NOT EXISTS public.cycle_history (
 *   id TEXT PRIMARY KEY,
 *   equipamento_id TEXT NOT NULL REFERENCES public.equipamentos(id),
 *   status TEXT NOT NULL CHECK (status IN ('Em operação', 'Em manutenção', 'À disposição', 'Aguardando manutenção')),
 *   timestamp TIMESTAMPTZ NOT NULL,
 *   hora TEXT NOT NULL,
 *   responsavel TEXT NOT NULL,
 *   motivo TEXT,
 *   data_criacao TIMESTAMPTZ DEFAULT NOW(),
 *   data_atualizacao TIMESTAMPTZ DEFAULT NOW(),
 *   FOREIGN KEY (equipamento_id) REFERENCES public.equipamentos(id)
 * );
 *
 * CREATE INDEX IF NOT EXISTS idx_cycle_equipamento_timestamp ON public.cycle_history(equipamento_id, timestamp);
 * CREATE INDEX IF NOT EXISTS idx_cycle_status ON public.cycle_history(status);
 */

/**
 * localStorage key: renea_ciclos_equipamentos
 * Formato: Map<equipamentoId, EquipmentCycle[]> serializado como JSON
 */
export const CICLOS_STORAGE_KEY = 'renea_ciclos_equipamentos';

export const carregarCiclosDoStorage = (): Map<string, EquipmentCycle[]> => {
  try {
    const json = localStorage.getItem(CICLOS_STORAGE_KEY);
    if (!json) return new Map();
    const obj = JSON.parse(json);
    return new Map(obj);
  } catch {
    return new Map();
  }
};

export const salvarCiclosNoStorage = (ciclos: Map<string, EquipmentCycle[]>) => {
  try {
    const obj = Array.from(ciclos.entries());
    localStorage.setItem(CICLOS_STORAGE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.error('Erro ao salvar ciclos no localStorage:', e);
  }
};

export const adicionarEventoAoCiclo = (
  ciclos: Map<string, EquipmentCycle[]>,
  evento: CycleEvent & { prefixo: string }
): Map<string, EquipmentCycle[]> => {
  const lista = ciclos.get(evento.equipamentoId) || [];
  const hoje = evento.timestamp.split('T')[0];
  let cicloHoje = lista.find(c => c.dataInicio === hoje);

  if (!cicloHoje) {
    cicloHoje = {
      id: `cic-${evento.equipamentoId}-${hoje}`,
      equipamentoId: evento.equipamentoId,
      prefixo: evento.prefixo,
      dataInicio: hoje,
      eventos: [],
      statusAtual: evento.status,
    };
    lista.push(cicloHoje);
  }

  cicloHoje.eventos.push(evento);
  cicloHoje.statusAtual = evento.status;
  cicloHoje.duracao = calcularDuracao(
    cicloHoje.eventos[0].timestamp,
    cicloHoje.eventos[cicloHoje.eventos.length - 1].timestamp
  );

  const novoMapa = new Map(ciclos);
  novoMapa.set(evento.equipamentoId, lista);
  return novoMapa;
};
