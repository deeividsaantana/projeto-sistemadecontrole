import type { ContextoPendencias } from './pendencias';
import { listarPendencias } from './pendencias';
import { calcularIndicadores, type ContextoIndicadores } from './indicadores';
import { montarTimeline } from './timeline';
import { buscarGlobal, type FontesBusca } from './buscaGlobal';
import { normalizeComparable } from './canonicalIdentity';

export interface RespostaAssistente {
  titulo: string;
  linhas: string[];
  /** Tela onde a resposta pode ser conferida ou resolvida. */
  tab?: string;
}

export type ContextoAssistente = ContextoIndicadores & FontesBusca & {
  historyLogs?: import('../types').HistoryLog[];
  abastecimentos?: import('../types').Abastecimento[];
};

const numero = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

/**
 * Assistente que só responde com dado do próprio sistema. Sem serviço externo,
 * sem palpite: quando não há informação, ele diz que não há, em vez de inventar
 * um número que ninguém conseguiria conferir.
 */
export const responder = (pergunta: string, contexto: ContextoAssistente): RespostaAssistente => {
  const termo = normalizeComparable(pergunta).trim();
  if (termo.length < 3) {
    return { titulo: 'Pergunte alguma coisa', linhas: ['Ex.: "o que está pendente?", "como está a produção?", "buscar ESC-01".'] };
  }

  if (/pendenc|pendent|aberto|falta/.test(termo)) {
    const pendencias = listarPendencias(contexto);
    if (pendencias.length === 0) return { titulo: 'Nada pendente no período', linhas: ['Todos os registros do período estão em dia.'], tab: 'pendencias' };
    return {
      titulo: `${pendencias.length} tipo(s) de pendência`,
      linhas: pendencias.slice(0, 6).map(item => `${item.quantidade} · ${item.titulo} (${item.gravidade})`),
      tab: 'pendencias',
    };
  }

  if (/produc|executad|avanc/.test(termo)) {
    const indicadores = calcularIndicadores(contexto);
    const producao = indicadores.find(item => item.id === 'producao-total');
    const aderencia = indicadores.find(item => item.id === 'aderencia-plano');
    if (!producao || producao.valor === 0) {
      return { titulo: 'Sem produção lançada no período', linhas: ['Nenhum lançamento de produção entre as datas selecionadas.'], tab: 'producao' };
    }
    return {
      titulo: `Produção no período: ${numero(producao.valor)}`,
      linhas: [
        producao.detalhe || '',
        producao.variacao === undefined ? 'Sem período anterior para comparar.' : `Variação sobre o período anterior: ${producao.variacao}%`,
        `Aderência ao planejado: ${aderencia?.valor ?? 0}%`,
      ].filter(Boolean),
      tab: 'producao',
    };
  }

  if (/frota|equipament|disponib|manutenc/.test(termo)) {
    const indicadores = calcularIndicadores(contexto);
    const disponibilidade = indicadores.find(item => item.id === 'disponibilidade-frota');
    const emManutencao = indicadores.find(item => item.id === 'frota-manutencao');
    return {
      titulo: `Disponibilidade da frota: ${disponibilidade?.valor ?? 0}%`,
      linhas: [disponibilidade?.detalhe || 'Sem lançamento de frota no período.', `Em manutenção: ${emManutencao?.valor ?? 0}%`],
      tab: 'controle-equipamentos',
    };
  }

  if (/presenc|efetivo|falta de gente|pessoal/.test(termo)) {
    const presenca = calcularIndicadores(contexto).find(item => item.id === 'presenca');
    return {
      titulo: `Presença efetiva: ${presenca?.valor ?? 0}%`,
      linhas: [presenca?.detalhe || 'Sem apontamento de presença no período.'],
      tab: 'presenca',
    };
  }

  if (/custo|gasto|dinheiro|orcament/.test(termo)) {
    const indicadores = calcularIndicadores(contexto);
    const horas = indicadores.find(item => item.id === 'horas-paradas');
    return {
      titulo: 'Custos do período',
      linhas: [
        'O consolidado lê abastecimentos, ordens de serviço e lançamentos manuais.',
        `Horas paradas por ocorrência no período: ${horas?.valor ?? 0}h`,
        'Abra Custos para ver por categoria e por equipamento.',
      ],
      tab: 'custos',
    };
  }

  if (/qualidade|fvs|nao conformidade|inspec|seguranc/.test(termo)) {
    const indicadores = calcularIndicadores(contexto);
    const conformidade = indicadores.find(item => item.id === 'conformidade-fvs');
    const nc = indicadores.find(item => item.id === 'nc-abertas');
    const inspecoes = indicadores.find(item => item.id === 'inspecoes-abertas');
    return {
      titulo: `Conformidade nas FVS: ${conformidade?.valor ?? 0}%`,
      linhas: [
        conformidade?.detalhe || 'Nenhuma ficha emitida no período.',
        `Não conformidades em aberto: ${nc?.valor ?? 0}`,
        `Inspeções em aberto: ${inspecoes?.valor ?? 0}`,
      ],
      tab: 'fvs',
    };
  }

  if (/ontem|hoje|aconteceu|ultimos dias|timeline/.test(termo)) {
    const eventos = montarTimeline(contexto, { inicio: contexto.inicio, fim: contexto.fim }).slice(0, 6);
    if (eventos.length === 0) return { titulo: 'Nada registrado no período', linhas: ['Nenhum evento entre as datas selecionadas.'], tab: 'timeline' };
    return {
      titulo: `${eventos.length} evento(s) mais recentes`,
      linhas: eventos.map(item => `${item.data.split('-').reverse().join('/')} · ${item.tipo}: ${item.titulo}`),
      tab: 'timeline',
    };
  }

  const resultados = buscarGlobal(pergunta.replace(/^(buscar|procurar|onde esta|cade)\s+/i, ''), contexto);
  if (resultados.length > 0) {
    return {
      titulo: `${resultados.length} registro(s) encontrado(s)`,
      linhas: resultados.slice(0, 6).map(item => `${item.tipo}: ${item.titulo}${item.subtitulo ? ` — ${item.subtitulo}` : ''}`),
      tab: resultados[0].tab,
    };
  }

  return {
    titulo: 'Não encontrei isso nos registros',
    linhas: [
      'O assistente só responde com dado que já está no sistema — ele não inventa número.',
      'Tente: pendências, produção, frota, presença, custos, qualidade, o que aconteceu, ou o nome de um registro.',
    ],
  };
};

export const SUGESTOES_ASSISTENTE = [
  'O que está pendente?',
  'Como está a produção?',
  'Qual a disponibilidade da frota?',
  'Como está a presença?',
  'Como está a qualidade?',
  'O que aconteceu nos últimos dias?',
];
