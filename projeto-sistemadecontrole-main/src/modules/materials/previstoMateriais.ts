/**
 * Previsto por ramo e mês: quanto de cada material um ramo deve receber e
 * quanto já chegou. O realizado é sempre a soma dos movimentos do mês cujo
 * local pertence ao ramo, achado pelo vínculo gravado ou pelo nome da
 * planilha (os mesmos apelidos de "Ramos e locais").
 */
import type { EtapaServico, Material, MovimentoMaterial, PrevistoMaterial } from '../../types';
import { normalizeComparable } from '../../utils/canonicalIdentity';
import { chaveLocal, indiceDeLocais, localDoMovimento, ordemDoRamo } from './locaisSge';

export type SituacaoPrevisto = 'futuro' | 'sem-chegada' | 'abaixo' | 'no-ritmo' | 'atingido' | 'passou' | 'faltou';

export const SITUACAO_PREVISTO: Record<SituacaoPrevisto, { nome: string; explica: string; tom: 'ok' | 'alerta' | 'neutro' }> = {
  futuro: { nome: 'Mês ainda não começou', explica: 'Nada precisa ter chegado ainda.', tom: 'neutro' },
  'sem-chegada': { nome: 'Começo do mês', explica: 'Nada chegou ainda, e o mês acabou de começar.', tom: 'neutro' },
  abaixo: { nome: 'Abaixo do ritmo', explica: 'Chegou menos do que o esperado até hoje.', tom: 'alerta' },
  'no-ritmo': { nome: 'No ritmo', explica: 'Chegou o esperado para esta altura do mês.', tom: 'ok' },
  atingido: { nome: 'Previsto atingido', explica: 'Já chegou tudo o que estava previsto.', tom: 'ok' },
  passou: { nome: 'Passou do previsto', explica: 'Chegou mais de 10% acima do previsto.', tom: 'alerta' },
  faltou: { nome: 'Faltou', explica: 'O mês fechou abaixo do previsto.', tom: 'alerta' },
};

/** Acima disto o excesso vira aviso: material a mais também custa. */
const LIMITE_PASSOU = 110;
/** Dentro de 90% do esperado até hoje ainda conta como no ritmo. */
const TOLERANCIA_RITMO = 0.9;
const DIAS_DE_FOLGA = 5;

const arredonda = (valor: number) => Number(valor.toFixed(3));

export const mesDe = (dia: string) => dia.slice(0, 7);

export const somarMes = (mes: string, quantos: number) => {
  const [ano, numero] = mes.split('-').map(Number);
  const data = new Date(ano, numero - 1 + quantos, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
};

export const diasNoMes = (mes: string) => {
  const [ano, numero] = mes.split('-').map(Number);
  return new Date(ano, numero, 0).getDate();
};

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const nomeDoMes = (mes: string) => {
  const [ano, numero] = mes.split('-').map(Number);
  return `${MESES[numero - 1] ?? mes} de ${ano}`;
};

/** "t", "T", "ton" e "tonelada" são a mesma coisa; "m3" e "m³" também. */
export const chaveUnidade = (unidade: string | undefined) => {
  const texto = normalizeComparable(unidade).replace(/³/g, '3').replace(/[\s.]/g, '');
  if (['t', 'ton', 'tonelada', 'toneladas'].includes(texto)) return 't';
  return texto;
};

/** Ramo que o local soma: o ramo gravado, ou o próprio nome quando o local é um ramo. */
export const ramoDoLocal = (etapa: EtapaServico | undefined): string | undefined => {
  if (!etapa) return undefined;
  if (etapa.ramo?.trim()) return etapa.ramo.trim();
  if (etapa.tipoLocal === 'Ramo') return etapa.nome;
  // Cadastro antigo, antes da lista SGE: "RAMO 900" sem tipo ainda é um ramo.
  return !etapa.tipoLocal && /^ramo \d+$/.test(chaveLocal(etapa.nome)) ? etapa.nome : undefined;
};

/** Ramos que existem no cadastro, na ordem do número (100, 200 ... 2000). */
export const ramosDaObra = (etapas: readonly EtapaServico[]): string[] => {
  const porChave = new Map<string, string>();
  // O nome do local do tipo Ramo vence a grafia gravada nas frentes.
  etapas.filter(etapa => etapa.tipoLocal === 'Ramo').forEach(etapa => porChave.set(chaveLocal(etapa.nome), etapa.nome));
  etapas.forEach(etapa => {
    const ramo = ramoDoLocal(etapa);
    if (ramo && !porChave.has(chaveLocal(ramo))) porChave.set(chaveLocal(ramo), ramo);
  });
  return [...porChave.values()].sort((a, b) => ordemDoRamo(a) - ordemDoRamo(b) || a.localeCompare(b, 'pt-BR', { numeric: true }));
};

export interface LinhaPrevisto {
  previsto: PrevistoMaterial;
  recebido: number;
  /** Saídas de consumo apontadas no ramo. Agregado descarregado direto não tem. */
  aplicado: number;
  entregas: number;
  porcentagem: number;
  /** Quanto já deveria ter chegado até hoje, no passo do mês. Só no mês corrente. */
  esperadoAteHoje: number | null;
  situacao: SituacaoPrevisto;
  ultimaEntrega?: string;
  /** Entregas do mesmo material e ramo gravadas em outra unidade: ficam fora da conta. */
  foraDaUnidade: number;
}

export interface ChegouSemPrevisto {
  ramo: string;
  materialId: string;
  materialDescricao: string;
  unidade: string;
  recebido: number;
  entregas: number;
}

export interface AcompanhamentoMes {
  linhas: LinhaPrevisto[];
  semPrevisto: ChegouSemPrevisto[];
}

interface Soma {
  ramo: string;
  materialId: string;
  materialDescricao: string;
  porUnidade: Map<string, { unidade: string; recebido: number; aplicado: number; entregas: number; ultima?: string }>;
}

const situacaoDe = (mes: string, hoje: string, previsto: number, recebido: number): { situacao: SituacaoPrevisto; esperadoAteHoje: number | null } => {
  const porcentagem = previsto > 0 ? (recebido / previsto) * 100 : 0;
  const mesHoje = mesDe(hoje);
  if (mes > mesHoje) return { situacao: 'futuro', esperadoAteHoje: null };
  if (porcentagem > LIMITE_PASSOU) return { situacao: 'passou', esperadoAteHoje: null };
  if (porcentagem >= 100) return { situacao: 'atingido', esperadoAteHoje: null };
  if (mes < mesHoje) return { situacao: 'faltou', esperadoAteHoje: null };
  const esperado = arredonda(previsto * (Number(hoje.slice(8, 10)) / diasNoMes(mes)));
  // Nos primeiros dias, nada ter chegado ainda não é atraso.
  if (recebido <= 0 && Number(hoje.slice(8, 10)) <= DIAS_DE_FOLGA) return { situacao: 'sem-chegada', esperadoAteHoje: esperado };
  return { situacao: recebido >= esperado * TOLERANCIA_RITMO ? 'no-ritmo' : 'abaixo', esperadoAteHoje: esperado };
};

/**
 * Cruza o previsto do mês com o que chegou. Cada entrega conta uma vez, no
 * ramo do local de destino; entrega sem local reconhecido não entra (ela
 * aparece em "Ramos e locais > Nomes sem local").
 */
export const acompanharMes = ({ mes, hoje, previstos, movimentos, etapas, materiais = [] }: {
  mes: string;
  hoje: string;
  previstos: readonly PrevistoMaterial[];
  movimentos: readonly MovimentoMaterial[];
  etapas: readonly EtapaServico[];
  materiais?: readonly Material[];
}): AcompanhamentoMes => {
  const porId = new Map(etapas.map(etapa => [etapa.id, etapa]));
  const indice = indiceDeLocais(etapas);
  const catalogo = new Map(materiais.map(item => [item.id, item]));
  // A planilha repete os mesmos destinos milhares de vezes: resolve cada texto uma vez só.
  const ramoPorTexto = new Map<string, string | undefined>();
  const somas = new Map<string, Soma>();

  for (const movimento of movimentos) {
    if (movimento.canceladoEm || !movimento.materialId || mesDe(movimento.data || '') !== mes) continue;
    const consumo = movimento.tipo === 'Saída' && movimento.finalidade === 'Consumo';
    if (movimento.tipo !== 'Entrada' && !consumo) continue;
    const texto = `${movimento.etapaServicoId || ''}\u0000${movimento.destino || ''}`;
    if (!ramoPorTexto.has(texto)) ramoPorTexto.set(texto, ramoDoLocal(localDoMovimento(movimento, porId, indice)));
    const ramo = ramoPorTexto.get(texto);
    if (!ramo) continue;
    const chave = `${chaveLocal(ramo)}\u0000${movimento.materialId}`;
    let soma = somas.get(chave);
    if (!soma) {
      soma = { ramo, materialId: movimento.materialId, materialDescricao: catalogo.get(movimento.materialId)?.descricao || movimento.materialDescricao, porUnidade: new Map() };
      somas.set(chave, soma);
    }
    const unidade = chaveUnidade(movimento.unidade);
    const parte = soma.porUnidade.get(unidade) ?? { unidade: movimento.unidade, recebido: 0, aplicado: 0, entregas: 0 };
    const quantidade = Math.abs(Number(movimento.quantidade) || 0);
    if (consumo) parte.aplicado += quantidade;
    else {
      parte.recebido += quantidade;
      parte.entregas += 1;
      if (!parte.ultima || movimento.data > parte.ultima) parte.ultima = movimento.data;
    }
    soma.porUnidade.set(unidade, parte);
  }

  const usadas = new Set<string>();
  const linhas = previstos
    .filter(previsto => previsto.ativo !== false && previsto.mes === mes)
    .map((previsto): LinhaPrevisto => {
      const chave = `${chaveLocal(previsto.ramo)}\u0000${previsto.materialId}`;
      usadas.add(chave);
      const soma = somas.get(chave);
      const unidade = chaveUnidade(previsto.unidade);
      const parte = soma?.porUnidade.get(unidade);
      const recebido = arredonda(parte?.recebido || 0);
      const foraDaUnidade = soma ? [...soma.porUnidade.entries()].filter(([outra]) => outra !== unidade).reduce((total, [, item]) => total + item.entregas, 0) : 0;
      const { situacao, esperadoAteHoje } = situacaoDe(mes, hoje, previsto.quantidade, recebido);
      return {
        previsto,
        recebido,
        aplicado: arredonda(parte?.aplicado || 0),
        entregas: parte?.entregas || 0,
        porcentagem: previsto.quantidade > 0 ? Number(((recebido / previsto.quantidade) * 100).toFixed(1)) : 0,
        esperadoAteHoje,
        situacao,
        ultimaEntrega: parte?.ultima,
        foraDaUnidade,
      };
    })
    .sort((a, b) => ordemDoRamo(a.previsto.ramo) - ordemDoRamo(b.previsto.ramo)
      || a.previsto.ramo.localeCompare(b.previsto.ramo, 'pt-BR', { numeric: true })
      || a.previsto.materialDescricao.localeCompare(b.previsto.materialDescricao, 'pt-BR'));

  const semPrevisto = [...somas.entries()]
    .filter(([chave]) => !usadas.has(chave))
    .flatMap(([, soma]) => [...soma.porUnidade.values()]
      .filter(parte => parte.recebido > 0)
      .map((parte): ChegouSemPrevisto => ({
        ramo: soma.ramo,
        materialId: soma.materialId,
        materialDescricao: soma.materialDescricao,
        unidade: parte.unidade,
        recebido: arredonda(parte.recebido),
        entregas: parte.entregas,
      })))
    .sort((a, b) => b.recebido - a.recebido);

  return { linhas, semPrevisto };
};

/** Mesmo mês, mesmo ramo e mesmo material: um previsto só. */
export const previstoRepetido = (
  novo: Pick<PrevistoMaterial, 'id' | 'mes' | 'ramo' | 'materialId'>,
  previstos: readonly PrevistoMaterial[],
) => previstos.find(item => item.ativo !== false && item.id !== novo.id && item.mes === novo.mes
  && item.materialId === novo.materialId && chaveLocal(item.ramo) === chaveLocal(novo.ramo));

export const validarPrevisto = (
  novo: Pick<PrevistoMaterial, 'id' | 'mes' | 'ramo' | 'materialId' | 'quantidade'>,
  previstos: readonly PrevistoMaterial[],
): string => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(novo.mes)) return 'Escolha o mês.';
  if (!novo.ramo.trim()) return 'Escolha o ramo.';
  if (!novo.materialId) return 'Escolha o material.';
  if (!(Number(novo.quantidade) > 0)) return 'Escreva quanto vai chegar no mês, maior que zero.';
  const repetido = previstoRepetido(novo, previstos);
  if (repetido) return `Já existe previsto de ${repetido.materialDescricao} no ${repetido.ramo} em ${nomeDoMes(repetido.mes)}: ${repetido.quantidade.toLocaleString('pt-BR')} ${repetido.unidade}. Edite o que existe.`;
  return '';
};

/** Traz para o mês novo o que estava previsto no anterior, sem repetir o que já existe. */
export const copiarPrevistos = (
  previstos: readonly PrevistoMaterial[],
  de: string,
  para: string,
  responsavel: string,
  agora: string,
  novoId: () => string,
): PrevistoMaterial[] => previstos
  .filter(item => item.ativo !== false && item.mes === de)
  .filter(item => !previstoRepetido({ ...item, id: '', mes: para }, previstos))
  .map(item => ({
    ...item,
    id: novoId(),
    mes: para,
    responsavel,
    criadoEm: agora,
    atualizadoEm: agora,
  }));
