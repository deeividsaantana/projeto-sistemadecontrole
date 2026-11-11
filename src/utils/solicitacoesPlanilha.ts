/**
 * Importação em lote (.xlsx/.csv) e números dos relatórios gerenciais do
 * módulo de solicitações. Só regra pura: ler o arquivo e montar o Excel ficam
 * na tela, carregados sob demanda.
 */
import {
  UNIDADES,
  estaEmAtraso,
  problemasDoItem,
  type DadosAbertura,
  type PessoaSuprimentos,
  type Solicitacao,
} from './solicitacoes';

export const COLUNAS_IMPORTACAO = [
  'Solicitante',
  'Tipo (Material/Serviço)',
  'Ramo/Local',
  'Descrição',
  'Quantidade',
  'Unidade',
  'Prazo Desejado',
  'Permite Parcial (S/N)',
] as const;

const normalizar = (texto: unknown) => String(texto ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

/** Cabeçalho da planilha → campo, aceitando variações comuns de escrita. */
const CAMPO_DO_CABECALHO: Array<[RegExp, keyof LinhaBruta]> = [
  [/^solicitante/, 'solicitante'],
  [/^tipo/, 'tipo'],
  [/^(ramo|local|frente)/, 'frente'],
  [/^descri/, 'descricao'],
  [/^(quantidade|qtd)/, 'quantidade'],
  [/^(unidade|un\b|und)/, 'unidade'],
  [/^prazo/, 'prazo'],
  [/^(permite|parcial)/, 'parcial'],
];

interface LinhaBruta {
  solicitante?: unknown;
  tipo?: unknown;
  frente?: unknown;
  descricao?: unknown;
  quantidade?: unknown;
  unidade?: unknown;
  prazo?: unknown;
  parcial?: unknown;
}

/** CSV do Excel brasileiro (;) ou internacional (,), com aspas. */
export const lerCsv = (texto: string): Record<string, string>[] => {
  const linhas: string[][] = [];
  const conteudo = texto.replace(/^﻿/, '');
  const primeira = conteudo.split(/\r?\n/, 1)[0] ?? '';
  const separador = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ';' : ',';
  let campo = '';
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < conteudo.length; i += 1) {
    const c = conteudo[i];
    if (aspas) {
      if (c === '"' && conteudo[i + 1] === '"') { campo += '"'; i += 1; } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === separador) { linha.push(campo); campo = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && conteudo[i + 1] === '\n') i += 1;
      linha.push(campo); linhas.push(linha); linha = []; campo = '';
    } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  const [cabecalho = [], ...resto] = linhas.filter(item => item.some(valor => valor.trim()));
  return resto.map(valores => Object.fromEntries(cabecalho.map((nome, indice) => [nome.trim(), (valores[indice] ?? '').trim()])));
};

const paraData = (valor: unknown): string => {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'number' && valor > 20000 && valor < 80000) {
    // Número de série do Excel (dias desde 30/12/1899).
    return new Date(Date.UTC(1899, 11, 30) + valor * 86_400_000).toISOString().slice(0, 10);
  }
  const texto = String(valor ?? '').trim();
  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}/.test(texto) ? texto.slice(0, 10) : '';
};

/** Grafias comuns da mesma unidade. O que não estiver aqui é recusado. */
const SINONIMOS_UNIDADE: Record<string, string> = { t: 'ton', m3: 'm³', 'm^3': 'm³', und: 'un', unid: 'un', unidade: 'un', hr: 'h', hora: 'h', horas: 'h', verba: 'vb' };

const paraUnidade = (valor: unknown): string => {
  const direto = String(valor ?? '').trim();
  if ((UNIDADES as readonly string[]).includes(direto)) return direto;
  const texto = normalizar(valor);
  if ((UNIDADES as readonly string[]).includes(texto)) return texto;
  return SINONIMOS_UNIDADE[texto] ?? direto;
};

const paraTipo = (valor: unknown) => {
  const texto = normalizar(valor);
  if (texto.startsWith('mat')) return 'Material';
  if (texto.startsWith('serv')) return 'Serviço';
  return String(valor ?? '');
};

const paraParcial = (valor: unknown): boolean | null => {
  const texto = normalizar(valor);
  if (['s', 'sim', 'true', '1', 'yes', 'y'].includes(texto)) return true;
  if (['n', 'nao', 'false', '0', 'no'].includes(texto)) return false;
  return null;
};

export interface LinhaRejeitada { linha: number; motivo: string }
export interface ResultadoImportacao {
  aceitas: Array<{ linha: number; dados: DadosAbertura }>;
  rejeitadas: LinhaRejeitada[];
}

/**
 * Cada linha vira uma solicitação de um item. Recusa na hora quem não é
 * solicitante autorizado e unidade fora do padrão técnico; nada some sem
 * aparecer na lista de recusadas.
 */
export const validarImportacao = (
  linhas: ReadonlyArray<{ linha: number; valores: Record<string, unknown> }>,
  pessoas: readonly PessoaSuprimentos[],
): ResultadoImportacao => {
  const autorizados = new Map(pessoas
    .filter(pessoa => pessoa.ativo && pessoa.papel === 'solicitante')
    .map(pessoa => [normalizar(pessoa.nome), pessoa.nome]));
  const aceitas: ResultadoImportacao['aceitas'] = [];
  const rejeitadas: LinhaRejeitada[] = [];
  for (const { linha, valores } of linhas) {
    const bruta: LinhaBruta = {};
    for (const [cabecalho, valor] of Object.entries(valores)) {
      const campo = CAMPO_DO_CABECALHO.find(([regra]) => regra.test(normalizar(cabecalho)))?.[1];
      if (campo && bruta[campo] === undefined) bruta[campo] = valor;
    }
    if (Object.values(bruta).every(valor => !String(valor ?? '').trim())) continue;
    const solicitante = autorizados.get(normalizar(bruta.solicitante));
    if (!solicitante) {
      rejeitadas.push({ linha, motivo: `Solicitante não autorizado: "${String(bruta.solicitante ?? '').trim() || 'vazio'}".` });
      continue;
    }
    const unidade = paraUnidade(bruta.unidade);
    if (!(UNIDADES as readonly string[]).includes(unidade)) {
      rejeitadas.push({ linha, motivo: `Unidade fora do padrão: "${String(bruta.unidade ?? '').trim() || 'vazia'}" (use ${UNIDADES.join(', ')}).` });
      continue;
    }
    const frente = String(bruta.frente ?? '').trim();
    const item = {
      tipo: paraTipo(bruta.tipo),
      descricao: String(bruta.descricao ?? '').trim(),
      quantidade: String(bruta.quantidade ?? '').replace(',', '.'),
      unidade,
      prazoDesejado: paraData(bruta.prazo),
      permiteParcial: paraParcial(bruta.parcial),
    };
    const problemas = problemasDoItem(item);
    if (!frente) problemas.unshift('Informe o ramo ou local.');
    if (problemas.length) {
      rejeitadas.push({ linha, motivo: problemas[0] });
      continue;
    }
    aceitas.push({ linha, dados: { solicitante, frente, itens: [item] } });
  }
  return { aceitas, rejeitadas };
};

// ---------------------------------------------------------------------------
// Relatórios gerenciais

const horasEntre = (inicio?: string, fim?: string) => {
  if (!inicio || !fim) return null;
  const horas = (new Date(fim).getTime() - new Date(inicio).getTime()) / 3_600_000;
  return Number.isFinite(horas) && horas >= 0 ? horas : null;
};

const media = (valores: number[]) => (valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null);
const arred = (valor: number | null, casas = 1) => (valor === null ? null : Math.round(valor * 10 ** casas) / 10 ** casas);

export const relatorioPorSolicitante = (sols: readonly Solicitacao[], hoje: string) => {
  const nomes = [...new Set(sols.map(sol => sol.solicitante))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return nomes.map(nome => {
    const doNome = sols.filter(sol => sol.solicitante === nome);
    return {
      solicitante: nome,
      abertas: doNome.length,
      atendidas: doNome.filter(sol => sol.etapa === 'Entregue').length,
      pendentes: doNome.filter(sol => sol.etapa !== 'Entregue' && sol.etapa !== 'Cancelado').length,
      emAtraso: doNome.filter(sol => estaEmAtraso(sol, hoje)).length,
      canceladas: doNome.filter(sol => sol.etapa === 'Cancelado').length,
    };
  });
};

/**
 * Tempo de cotação: de assumir até mandar o pedido para aprovação.
 * Pontualidade: entregas fechadas até o fim da janela prometida (a original,
 * antes de qualquer reagendamento), sobre as entregas fechadas.
 */
export const relatorioSuprimentos = (sols: readonly Solicitacao[]) => {
  const compradores = [...new Set(sols.map(sol => sol.comprador).filter((nome): nome is string => Boolean(nome)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return compradores.map(nome => {
    const doComprador = sols.filter(sol => sol.comprador === nome);
    const tempos = doComprador.map(sol => horasEntre(sol.assumidaEm || sol.abertaEm, sol.enviadaAprovacaoEm)).filter((h): h is number => h !== null);
    const entregues = doComprador.filter(sol => sol.etapa === 'Entregue' && sol.chegadaEm);
    const prometidaOriginal = (sol: Solicitacao) => sol.reagendamentos[0]?.anterior || sol.janelaFim || '';
    const noPrazo = entregues.filter(sol => (sol.chegadaEm as string).slice(0, 10) <= prometidaOriginal(sol)).length;
    return {
      comprador: nome,
      pedidos: doComprador.filter(sol => sol.numeroPedido).length,
      tempoMedioCotacaoHoras: arred(media(tempos)),
      entregues: entregues.length,
      noPrazo,
      pontualidadePct: entregues.length ? arred((noPrazo / entregues.length) * 100) : null,
      reagendamentos: doComprador.reduce((soma, sol) => soma + sol.reagendamentos.length, 0),
    };
  });
};

export const relatorioAprovador = (sols: readonly Solicitacao[]) => {
  const aprovadores = [...new Set(sols.map(sol => sol.aprovador).filter((nome): nome is string => Boolean(nome)))];
  return aprovadores.map(nome => {
    const doAprovador = sols.filter(sol => sol.aprovador === nome);
    const aprovados = doAprovador.filter(sol => sol.statusAprovacao === 'Aprovado');
    return {
      aprovador: nome,
      aprovados: aprovados.length,
      condicionais: aprovados.filter(sol => sol.aprovacaoCondicional).length,
      rejeicoes: doAprovador.reduce((soma, sol) => soma + (sol.rejeicoes ?? 0), 0),
      valorAprovado: aprovados.reduce((soma, sol) => soma + (sol.valorTotal ?? 0), 0),
    };
  });
};

const DESCARTE = 'Chegou ao Local de Descarte';

export const relatorioLogistico = (sols: readonly Solicitacao[], hoje: string) => {
  const chegadas = sols.filter(sol => sol.chegadaEm && sol.etapa === 'Entregue');
  const consolidar = (chave: (sol: Solicitacao) => string) => {
    const mapa = new Map<string, { periodo: string; noLocal: number; descarte: number }>();
    for (const sol of chegadas) {
      const periodo = chave(sol);
      const linha = mapa.get(periodo) ?? { periodo, noLocal: 0, descarte: 0 };
      if (sol.statusLogistico === DESCARTE) linha.descarte += 1;
      else linha.noLocal += 1;
      mapa.set(periodo, linha);
    }
    return [...mapa.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));
  };
  return {
    diario: consolidar(sol => (sol.chegadaEm as string).slice(0, 10)),
    mensal: consolidar(sol => (sol.chegadaEm as string).slice(0, 7)),
    emAberto: sols
      .filter(sol => sol.etapa === 'Aprovado' || sol.etapa === 'Em Trânsito')
      .map(sol => ({ sol, atraso: estaEmAtraso(sol, hoje) }))
      .sort((a, b) => Number(b.atraso) - Number(a.atraso) || (a.sol.janelaFim || '').localeCompare(b.sol.janelaFim || '')),
  };
};
