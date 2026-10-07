/**
 * Bota-fora: viagens que saem da obra para Itaquareia (solo contaminado),
 * Lara e São Bento (lixo). Viagem é a linha da planilha; tonelada, m³ e
 * custo somam só quando vieram na viagem. O destino é reconhecido pelo
 * cadastro de Ramos e locais, ou pela lista SGE quando ela ainda não foi
 * carregada.
 */
import type { EtapaServico, MovimentoMaterial } from '../../types';
import { normalizeComparable } from '../../utils/canonicalIdentity';
import { codigoDaViagem, indiceDeLocais, localDoMovimento, planoCargaSge, resolverLocal } from './locaisSge';
import { chaveUnidade, mesDe } from './previstoMateriais';

export type Residuo = 'Solo contaminado' | 'Lixo' | 'Solo' | 'Outro';

export const residuoDe = (materialDescricao: string): Residuo => {
  const texto = normalizeComparable(materialDescricao);
  if (texto.includes('contamin')) return 'Solo contaminado';
  if (texto.includes('lixo') || texto.includes('residuo')) return 'Lixo';
  if (/\bsolo\b|\bterra\b/.test(texto)) return 'Solo';
  return 'Outro';
};

export interface ViagemBotaFora {
  movimento: MovimentoMaterial;
  destino: EtapaServico;
  residuo: Residuo;
  viagens: number;
  toneladas: number;
  metrosCubicos: number;
  custo: number;
  /** De onde a viagem saiu, quando a planilha diz e o local é conhecido. */
  origem?: EtapaServico;
  /** Texto da origem na planilha, quando existe e não é o próprio aterro. */
  origemTexto?: string;
  codigoSge?: string;
}

// Destinos da lista SGE: valem mesmo antes de a lista ser carregada.
const BOTA_FORAS_DA_LISTA = planoCargaSge([]).novas.filter(item => item.tipoLocal === 'Bota-fora');

/** Toda viagem não desfeita cujo destino é um bota-fora. */
export const viagensDeBotaFora = (movimentos: readonly MovimentoMaterial[], etapas: readonly EtapaServico[]): ViagemBotaFora[] => {
  // O cadastro vem primeiro: um local já cadastrado vence o da lista.
  const conhecidos = [...etapas, ...BOTA_FORAS_DA_LISTA];
  const porId = new Map(conhecidos.map(item => [item.id, item]));
  const indice = indiceDeLocais(conhecidos);
  const destinoPorTexto = new Map<string, EtapaServico | undefined>();
  const origemPorTexto = new Map<string, EtapaServico | undefined>();
  const viagens: ViagemBotaFora[] = [];

  for (const movimento of movimentos) {
    if (movimento.canceladoEm || movimento.tipo === 'Ajuste') continue;
    const chave = `${movimento.etapaServicoId || ''}\u0000${movimento.destino || ''}`;
    if (!destinoPorTexto.has(chave)) destinoPorTexto.set(chave, localDoMovimento(movimento, porId, indice));
    const destino = destinoPorTexto.get(chave);
    if (destino?.tipoLocal !== 'Bota-fora') continue;

    const textoOrigem = (movimento.origem || '').trim();
    if (!origemPorTexto.has(textoOrigem)) origemPorTexto.set(textoOrigem, resolverLocal(textoOrigem, indice));
    const origem = origemPorTexto.get(textoOrigem);
    // A aba de Itaquareia repete o aterro na coluna de local: isso não é origem.
    const semOrigem = !textoOrigem || origem?.id === destino.id;

    const quantidade = Math.abs(Number(movimento.quantidade) || 0);
    const unidade = chaveUnidade(movimento.unidade);
    viagens.push({
      movimento,
      destino,
      residuo: residuoDe(movimento.materialDescricao),
      viagens: unidade === 'viagem' || unidade === 'viagens' ? Math.max(1, quantidade) : 1,
      toneladas: unidade === 't' ? quantidade : 0,
      metrosCubicos: unidade === 'm3' ? quantidade : 0,
      custo: Math.abs(Number(movimento.valorTotal) || 0) || Math.abs(Number(movimento.valorUnitario) || 0) * quantidade,
      origem: semOrigem ? undefined : origem,
      origemTexto: semOrigem ? undefined : textoOrigem,
      codigoSge: semOrigem ? undefined : codigoDaViagem(textoOrigem, destino.nome, indice),
    });
  }
  return viagens.sort((a, b) => b.movimento.data.localeCompare(a.movimento.data) || b.movimento.criadoEm.localeCompare(a.movimento.criadoEm));
};

interface Soma {
  viagens: number;
  toneladas: number;
  metrosCubicos: number;
  custo: number;
  /** Quantas viagens vieram pesadas ou medidas: o total de t e m³ vale só para elas. */
  viagensPesadas: number;
  viagensMedidas: number;
}

const vazia = (): Soma => ({ viagens: 0, toneladas: 0, metrosCubicos: 0, custo: 0, viagensPesadas: 0, viagensMedidas: 0 });
const somar = (soma: Soma, viagem: ViagemBotaFora) => {
  soma.viagens += viagem.viagens;
  soma.toneladas += viagem.toneladas;
  soma.metrosCubicos += viagem.metrosCubicos;
  soma.custo += viagem.custo;
  if (viagem.toneladas) soma.viagensPesadas += viagem.viagens;
  if (viagem.metrosCubicos) soma.viagensMedidas += viagem.viagens;
};

export interface ResumoDestino extends Soma {
  destino: EtapaServico;
  residuos: Array<{ residuo: Residuo; viagens: number }>;
  ultima?: string;
}

export interface ResumoOrigem {
  chave: string;
  origem: string;
  destino: string;
  codigoSge?: string;
  conhecida: boolean;
  viagens: number;
}

export interface MesBotaFora {
  mes: string;
  /** Viagens do mês em cada destino, pelo id do local. */
  porDestino: Record<string, number>;
  total: number;
}

export interface ResumoBotaFora {
  totais: Soma;
  porDestino: ResumoDestino[];
  porOrigem: ResumoOrigem[];
  porMes: MesBotaFora[];
  meses: string[];
}

/**
 * Soma as viagens do período ("" = todos os meses). O gráfico por mês usa
 * sempre todas as viagens, para mostrar o período escolhido no meio da história.
 */
export const resumirBotaFora = (viagens: readonly ViagemBotaFora[], mes = ''): ResumoBotaFora => {
  const doPeriodo = mes ? viagens.filter(viagem => mesDe(viagem.movimento.data) === mes) : viagens;
  const totais = vazia();
type DestinoEmSoma = ResumoDestino & { porResiduo: Map<Residuo, number> };
  const destinos = new Map<string, DestinoEmSoma>();
  const origens = new Map<string, ResumoOrigem>();

  for (const viagem of doPeriodo) {
    somar(totais, viagem);
    const atual: DestinoEmSoma = destinos.get(viagem.destino.id) ?? { destino: viagem.destino, ...vazia(), residuos: [], porResiduo: new Map() };
    somar(atual, viagem);
    atual.porResiduo.set(viagem.residuo, (atual.porResiduo.get(viagem.residuo) || 0) + viagem.viagens);
    if (!atual.ultima || viagem.movimento.data > atual.ultima) atual.ultima = viagem.movimento.data;
    destinos.set(viagem.destino.id, atual);

    const nomeOrigem = viagem.origem?.nome || viagem.origemTexto || 'Sem origem na planilha';
    const chave = `${normalizeComparable(nomeOrigem)}\u0000${viagem.destino.id}`;
    const origem = origens.get(chave) ?? { chave, origem: nomeOrigem, destino: viagem.destino.nome, codigoSge: viagem.codigoSge, conhecida: Boolean(viagem.origem), viagens: 0 };
    origem.viagens += viagem.viagens;
    origens.set(chave, origem);
  }

  const porMesMapa = new Map<string, MesBotaFora>();
  for (const viagem of viagens) {
    const chave = mesDe(viagem.movimento.data);
    const ponto = porMesMapa.get(chave) ?? { mes: chave, porDestino: {}, total: 0 };
    ponto.porDestino[viagem.destino.id] = (ponto.porDestino[viagem.destino.id] || 0) + viagem.viagens;
    ponto.total += viagem.viagens;
    porMesMapa.set(chave, ponto);
  }
  const meses = [...porMesMapa.keys()].sort();

  return {
    totais,
    porDestino: [...destinos.values()]
      .map(({ porResiduo, ...resto }) => ({ ...resto, residuos: [...porResiduo.entries()].map(([residuo, total]) => ({ residuo, viagens: total })).sort((a, b) => b.viagens - a.viagens || a.residuo.localeCompare(b.residuo, 'pt-BR')) }))
      .sort((a, b) => b.viagens - a.viagens),
    porOrigem: [...origens.values()].sort((a, b) => b.viagens - a.viagens),
    porMes: meses.map(chave => porMesMapa.get(chave) as MesBotaFora),
    meses,
  };
};
