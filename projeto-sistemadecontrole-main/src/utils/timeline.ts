import type {
  Abastecimento,
  ControleEquipamentoDiario,
  FichaVerificacaoServico,
  HistoryLog,
  Inspecao,
  Medicao,
  NaoConformidade,
  Ocorrencia,
  OrdemServico,
  RegistroProducao,
  TicketJazida,
} from '../types';

export interface EventoTimeline {
  id: string;
  data: string; // YYYY-MM-DD
  hora?: string; // HH:MM
  tipo: string;
  titulo: string;
  descricao?: string;
  /** Tela onde o evento vive; a timeline não guarda cópia do registro. */
  tab: string;
  equipamentoId?: string;
  frente?: string;
  obraId?: string;
}

export interface FontesTimeline {
  abastecimentos?: Abastecimento[];
  controlesEquipamentos?: ControleEquipamentoDiario[];
  ordensServico?: OrdemServico[];
  ticketsJazida?: TicketJazida[];
  producao?: RegistroProducao[];
  fichasFvs?: FichaVerificacaoServico[];
  inspecoes?: Inspecao[];
  naoConformidades?: NaoConformidade[];
  ocorrencias?: Ocorrencia[];
  medicoes?: Medicao[];
  historyLogs?: HistoryLog[];
}

export interface FiltrosTimeline {
  inicio: string;
  fim: string;
  equipamentoId?: string;
  frente?: string;
  tipos?: string[];
}

const noPeriodo = (data: string | undefined, inicio: string, fim: string) =>
  Boolean(data) && data! >= inicio && data! <= fim;

/**
 * Linha do tempo dos fatos operacionais, montada a partir dos próprios
 * registros. Não existe coleção de eventos: um evento apagado no módulo some
 * daqui automaticamente, e nada precisa ser reprocessado.
 */
export const montarTimeline = (fontes: FontesTimeline, filtros: FiltrosTimeline): EventoTimeline[] => {
  const { inicio, fim, equipamentoId, frente, tipos } = filtros;
  const eventos: EventoTimeline[] = [
    ...(fontes.controlesEquipamentos || [])
      .filter(item => noPeriodo(item.data, inicio, fim))
      .map(item => ({
        id: `ctrl-${item.id}`,
        data: item.data,
        tipo: 'Frota',
        titulo: `${item.prefixo}: ${item.status}`,
        descricao: [item.nomeMotorista, item.observacao].filter(Boolean).join(' · ') || undefined,
        tab: 'controle-equipamentos',
        equipamentoId: item.equipamentoId,
      })),
    ...(fontes.abastecimentos || [])
      .filter(item => noPeriodo(item.data, inicio, fim))
      .map(item => ({
        id: `abast-${item.id}`,
        data: item.data,
        hora: item.hora,
        tipo: 'Abastecimento',
        titulo: `${item.quantidadeLitros} L`,
        descricao: item.localAbastecimento || item.observacao || undefined,
        tab: 'lancamentos',
        equipamentoId: item.equipamentoId,
      })),
    ...(fontes.ordensServico || [])
      .filter(item => noPeriodo(item.dataAbertura, inicio, fim))
      .map(item => ({
        id: `os-${item.id}`,
        data: item.dataAbertura,
        hora: item.horaAbertura,
        tipo: 'Manutenção',
        titulo: `OS ${item.numero} — ${item.status}`,
        descricao: item.motivo || item.descricao,
        tab: 'manutencao',
        equipamentoId: item.equipamentoId,
      })),
    ...(fontes.ticketsJazida || [])
      .filter(item => noPeriodo(item.data, inicio, fim))
      .map(item => ({
        id: `tk-${item.id}`,
        data: item.data,
        hora: item.horaSaida,
        tipo: 'Viagem',
        titulo: `Ticket ${item.ticketNumero || ''}`.trim(),
        descricao: `${item.tipoMaterial} · ${item.quantidadeM3} m³`,
        tab: 'tickets-jazida',
        frente: item.estaca,
      })),
    ...(fontes.producao || [])
      .filter(item => item.ativo !== false && noPeriodo(item.data, inicio, fim))
      .map(item => ({
        id: `prod-${item.id}`,
        data: item.data,
        tipo: 'Produção',
        titulo: `${item.quantidade} ${item.unidade} de ${item.servicoDescricao}`,
        descricao: [item.frente, item.equipeNome].filter(Boolean).join(' · ') || undefined,
        tab: 'producao',
        frente: item.frente,
        obraId: item.obraId,
      })),
    ...(fontes.fichasFvs || [])
      .filter(item => item.ativo !== false && noPeriodo(item.data, inicio, fim))
      .map(item => ({
        id: `fvs-${item.id}`,
        data: item.data,
        tipo: 'FVS',
        titulo: `${item.numero} — ${item.situacao}`,
        descricao: item.local,
        tab: 'fvs',
        frente: item.frente,
        obraId: item.obraId,
      })),
    ...(fontes.inspecoes || [])
      .filter(item => item.ativo !== false && noPeriodo(item.data, inicio, fim))
      .map(item => ({
        id: `insp-${item.id}`,
        data: item.data,
        tipo: 'Inspeção',
        titulo: `${item.numero} — ${item.gravidade}`,
        descricao: item.descricao,
        tab: 'inspecoes',
        equipamentoId: item.equipamentoId,
        frente: item.frente,
        obraId: item.obraId,
      })),
    ...(fontes.naoConformidades || [])
      .filter(item => item.ativo !== false && noPeriodo(item.data, inicio, fim))
      .map(item => ({
        id: `nc-${item.id}`,
        data: item.data,
        tipo: 'Não conformidade',
        titulo: `${item.numero} — ${item.situacao}`,
        descricao: item.descricao,
        tab: 'nao-conformidades',
        frente: item.frente,
        obraId: item.obraId,
      })),
    ...(fontes.ocorrencias || [])
      .filter(item => item.ativo !== false && noPeriodo(item.data, inicio, fim))
      .map(item => ({
        id: `oc-${item.id}`,
        data: item.data,
        hora: item.hora,
        tipo: 'Ocorrência',
        titulo: `${item.tipo} — ${item.impacto}`,
        descricao: item.descricao,
        tab: 'ocorrencias',
        equipamentoId: item.equipamentoId,
        frente: item.frente,
        obraId: item.obraId,
      })),
    ...(fontes.medicoes || [])
      .filter(item => item.ativo !== false && noPeriodo(item.periodoFim, inicio, fim))
      .map(item => ({
        id: `med-${item.id}`,
        data: item.periodoFim,
        tipo: 'Medição',
        titulo: `${item.numero} — ${item.situacao}`,
        descricao: `${item.itens.length} item(ns)`,
        tab: 'medicoes',
        obraId: item.obraId,
      })),
    ...(fontes.historyLogs || [])
      .filter(item => noPeriodo(item.timestamp?.slice(0, 10), inicio, fim))
      .map(item => ({
        id: `log-${item.id}`,
        data: item.timestamp.slice(0, 10),
        hora: item.timestamp.slice(11, 16),
        tipo: 'Auditoria',
        titulo: `${item.usuario} ${item.acao.toLowerCase()} em ${item.tela}`,
        descricao: item.descricao,
        tab: 'auditoria',
      })),
  ];

  return eventos
    .filter(item => !equipamentoId || item.equipamentoId === equipamentoId)
    .filter(item => !frente || item.frente === frente)
    .filter(item => !tipos || tipos.length === 0 || tipos.includes(item.tipo))
    .sort((a, b) => b.data.localeCompare(a.data) || (b.hora || '').localeCompare(a.hora || ''));
};

/** Tipos presentes no resultado, para montar o filtro sem lista fixa. */
export const tiposDaTimeline = (eventos: EventoTimeline[]) =>
  [...new Set(eventos.map(item => item.tipo))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

/** Agrupa por dia para a tela desenhar a linha do tempo. */
export const agruparPorDia = (eventos: EventoTimeline[]) => {
  const mapa = new Map<string, EventoTimeline[]>();
  eventos.forEach(item => mapa.set(item.data, [...(mapa.get(item.data) || []), item]));
  return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0]));
};
