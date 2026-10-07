/**
 * Avisos e séries da Visão geral de Materiais. Tudo sai dos movimentos que
 * valem (desfeito não conta) e da posição de estoque; nada é guardado.
 */
import type { MovimentoMaterial } from '../../types';
import type { PosicaoEstoque } from '../../utils/estoque';

export type GravidadeAviso = 'critico' | 'atencao' | 'info';

export interface AvisoMaterial {
  id: string;
  gravidade: GravidadeAviso;
  titulo: string;
  detalhe: string;
  /** Texto para a busca de Movimentos, quando o aviso leva até lá. */
  busca?: string;
}

const DIA_MS = 86_400_000;
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / DIA_MS);
const somarDias = (dia: string, dias: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + dias * DIA_MS).toISOString().slice(0, 10);
const br = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const dataCurta = (dia: string) => dia.split('-').reverse().slice(0, 2).join('/');

export const JANELA_CONSUMO_DIAS = 30;
export const ACABA_EM_DIAS = 7;
export const PARADO_DESDE_DIAS = 45;
const ORDEM: Record<GravidadeAviso, number> = { critico: 0, atencao: 1, info: 2 };

/**
 * O que pede atenção agora, do mais grave para o mais leve:
 * saldo negativo, material que acaba em poucos dias no ritmo de uso, abaixo
 * do mínimo, lançamento repetido e, num aviso só, os materiais parados.
 */
export const avisosDeMateriais = (posicoes: readonly PosicaoEstoque[], movimentos: readonly MovimentoMaterial[], hoje: string): AvisoMaterial[] => {
  const vigentes = movimentos.filter(item => !item.canceladoEm);
  const inicioJanela = somarDias(hoje, -(JANELA_CONSUMO_DIAS - 1));
  const saidasRecentes = new Map<string, number>();
  for (const item of vigentes) {
    if (item.tipo !== 'Saída' || item.data < inicioJanela || item.data > hoje) continue;
    saidasRecentes.set(item.materialId, (saidasRecentes.get(item.materialId) ?? 0) + Math.abs(Number(item.quantidade) || 0));
  }

  const avisos: AvisoMaterial[] = [];
  const parados: { descricao: string; dias: number }[] = [];
  for (const posicao of posicoes) {
    const { material, saldo } = posicao;
    const unidade = material.unidade;
    if (saldo < 0) {
      avisos.push({
        id: `negativo-${material.id}`,
        gravidade: 'critico',
        titulo: `${material.descricao} está com saldo negativo`,
        detalhe: `Saldo de ${br(saldo)} ${unidade}. Falta lançar alguma entrada ou há saída a mais.`,
        busca: material.descricao,
      });
      continue;
    }
    const consumoDiario = (saidasRecentes.get(material.id) ?? 0) / JANELA_CONSUMO_DIAS;
    const dias = consumoDiario > 0 ? saldo / consumoDiario : Infinity;
    if (saldo >= 0 && dias <= ACABA_EM_DIAS) {
      avisos.push({
        id: `acaba-${material.id}`,
        gravidade: saldo === 0 ? 'critico' : 'atencao',
        titulo: saldo === 0 ? `${material.descricao} acabou` : `${material.descricao} acaba em ${Math.max(1, Math.floor(dias))} dia(s)`,
        detalhe: `Uso de ${br(consumoDiario)} ${unidade} por dia nos últimos ${JANELA_CONSUMO_DIAS} dias; sobram ${br(saldo)} ${unidade}.`,
        busca: material.descricao,
      });
    } else if (posicao.abaixoDoMinimo) {
      avisos.push({
        id: `minimo-${material.id}`,
        gravidade: 'atencao',
        titulo: `${material.descricao} abaixo do mínimo`,
        detalhe: `Sobram ${br(saldo)} ${unidade}; o mínimo é ${br(Number(material.estoqueMinimo))} ${unidade}.`,
        busca: material.descricao,
      });
    }
    if (saldo > 0 && posicao.ultimoMovimento && diasEntre(posicao.ultimoMovimento, hoje) >= PARADO_DESDE_DIAS) {
      parados.push({ descricao: material.descricao, dias: diasEntre(posicao.ultimoMovimento, hoje) });
    }
  }

  // Parado é só para conferir: vira um aviso só, para não esconder o que é urgente.
  if (parados.length > 0) {
    parados.sort((a, b) => b.dias - a.dias || a.descricao.localeCompare(b.descricao, 'pt-BR'));
    const [unico] = parados;
    avisos.push(parados.length === 1
      ? {
          id: 'parados',
          gravidade: 'info',
          titulo: `${unico.descricao} parado há ${unico.dias} dias`,
          detalhe: `Tem saldo e nenhum movimento há mais de ${PARADO_DESDE_DIAS} dias.`,
          busca: unico.descricao,
        }
      : {
          id: 'parados',
          gravidade: 'info',
          titulo: `${parados.length} materiais parados há mais de ${PARADO_DESDE_DIAS} dias`,
          detalhe: `Têm saldo e nenhum movimento: ${parados.map(item => `${item.descricao} (${item.dias} dias)`).join(', ')}.`,
        });
  }

  // Mesmo dia, material, quantidade, placa, ticket e nota: quase sempre é a
  // mesma viagem lançada duas vezes. Só a placa não basta: o caminhão do
  // bota-fora faz várias viagens de 3 m³ no mesmo dia. Sem ticket nem nota
  // não dá para afirmar.
  const iguais = new Map<string, MovimentoMaterial[]>();
  for (const item of vigentes) {
    const placa = (item.placa || '').trim().toUpperCase();
    const ticket = (item.ticket || '').trim();
    const nota = (item.notaFiscal || '').trim();
    if (!ticket && !nota) continue;
    const chave = [item.data, item.tipo, item.materialId, Number(item.quantidade), placa, ticket, nota].join('|');
    const grupo = iguais.get(chave);
    if (grupo) grupo.push(item); else iguais.set(chave, [item]);
  }
  for (const grupo of iguais.values()) {
    if (grupo.length < 2) continue;
    const [primeiro] = grupo;
    avisos.push({
      id: `repetido-${primeiro.id}`,
      gravidade: 'atencao',
      titulo: `${grupo.length} lançamentos iguais de ${primeiro.materialDescricao}`,
      detalhe: `${dataCurta(primeiro.data)}, ${br(Math.abs(primeiro.quantidade))} ${primeiro.unidade}${primeiro.placa ? `, placa ${primeiro.placa}` : ''}${primeiro.ticket ? `, ticket ${primeiro.ticket}` : ''}${primeiro.notaFiscal ? `, nota ${primeiro.notaFiscal}` : ''}. Confira se não é a mesma viagem.`,
      busca: primeiro.ticket || primeiro.notaFiscal || primeiro.placa || primeiro.materialDescricao,
    });
  }

  return avisos.sort((a, b) => ORDEM[a.gravidade] - ORDEM[b.gravidade] || a.titulo.localeCompare(b.titulo, 'pt-BR'));
};

export interface PontoSemana {
  inicio: string;
  rotulo: string;
  entradas: number;
  saidas: number;
  transporte: number;
}

/** Segunda-feira da semana do dia, no calendário (sem fuso). */
export const inicioDaSemana = (dia: string) => {
  const semana = new Date(`${dia}T12:00:00Z`).getUTCDay();
  return somarDias(dia, -((semana + 6) % 7));
};

/**
 * Entradas, saídas e transporte por semana, das mais antigas para a atual.
 * Sem material escolhido conta lançamentos, porque somar m³ com tonelada e
 * peça não quer dizer nada; com material, soma a quantidade na unidade dele.
 */
export const movimentoPorSemana = (movimentos: readonly MovimentoMaterial[], hoje: string, semanas = 12, materialId?: string): PontoSemana[] => {
  const atual = inicioDaSemana(hoje);
  const pontos: PontoSemana[] = Array.from({ length: semanas }, (_, indice) => {
    const inicio = somarDias(atual, -7 * (semanas - 1 - indice));
    return { inicio, rotulo: dataCurta(inicio), entradas: 0, saidas: 0, transporte: 0 };
  });
  const porInicio = new Map(pontos.map(ponto => [ponto.inicio, ponto]));
  for (const item of movimentos) {
    if (item.canceladoEm || (materialId && item.materialId !== materialId) || item.data > hoje) continue;
    const ponto = porInicio.get(inicioDaSemana(item.data));
    if (!ponto) continue;
    const valor = materialId ? Math.abs(Number(item.quantidade) || 0) : 1;
    if (item.tipo === 'Entrada') ponto.entradas += valor;
    else if (item.tipo === 'Saída') ponto.saidas += valor;
    else if (item.tipo === 'Transferência') ponto.transporte += valor;
  }
  return pontos;
};

export interface LinhaRanking {
  nome: string;
  lancamentos: number;
  detalhe: string;
}

/** Os que mais aparecem nos movimentos, com o material principal de cada um. */
export const rankingPor = (
  movimentos: readonly MovimentoMaterial[],
  chave: (item: MovimentoMaterial) => string | undefined,
  limite = 8,
): LinhaRanking[] => {
  const grupos = new Map<string, { lancamentos: number; materiais: Map<string, number> }>();
  for (const item of movimentos) {
    if (item.canceladoEm) continue;
    const nome = chave(item)?.trim();
    if (!nome) continue;
    const grupo = grupos.get(nome) ?? { lancamentos: 0, materiais: new Map() };
    grupo.lancamentos += 1;
    grupo.materiais.set(item.materialDescricao, (grupo.materiais.get(item.materialDescricao) ?? 0) + 1);
    grupos.set(nome, grupo);
  }
  return [...grupos.entries()]
    .map(([nome, grupo]) => {
      const principais = [...grupo.materiais.entries()].sort((a, b) => b[1] - a[1]);
      const resto = principais.length - 1;
      return { nome, lancamentos: grupo.lancamentos, detalhe: `${principais[0][0]}${resto > 0 ? ` e mais ${resto}` : ''}` };
    })
    .sort((a, b) => b.lancamentos - a.lancamentos || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, limite);
};
