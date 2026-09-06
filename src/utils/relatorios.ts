import type { ContextoIndicadores } from './indicadores';
import { calcularIndicadores } from './indicadores';
import { consolidarCustos, custosDeOutrosModulos, custosPor, totalCustos } from './custos';
import { aderenciaDosPlanos } from './planejamento';
import { avancoDosServicos } from './producao';
import { listarPendencias } from './pendencias';
import { painelOcorrencias } from './ocorrencias';
import { resumoFvs } from './fvs';
import { totalMedicao } from './medicoes';

export type ValorRelatorio = string | number;

export interface Relatorio {
  id: string;
  titulo: string;
  descricao: string;
  colunas: string[];
  linhas: ValorRelatorio[][];
}

export type ContextoRelatorios = ContextoIndicadores & {
  servicos?: import('../types').ServicoObra[];
  lancamentosCusto?: import('../types').LancamentoCusto[];
  abastecimentos?: import('../types').Abastecimento[];
};

const noPeriodo = (data: string | undefined, inicio: string, fim: string) =>
  Boolean(data) && data! >= inicio && data! <= fim;

const numero = (valor: number) => Number(valor.toFixed(3));

/**
 * Relatórios são leitura: cada linha é montada na hora a partir dos registros,
 * nada é guardado. Um relatório nunca mostra número diferente da tela do módulo
 * porque usa exatamente as mesmas funções de cálculo.
 */
export const montarRelatorios = (contexto: ContextoRelatorios): Relatorio[] => {
  const {
    inicio, fim, hoje,
    servicos = [], producao = [], planejamento = [], medicoes = [], ocorrencias = [],
    fichasFvs = [], naoConformidades = [], inspecoes = [],
    abastecimentos = [], ordensServico = [], lancamentosCusto = [],
  } = contexto;

  const producaoPeriodo = producao.filter(item => item.ativo !== false && noPeriodo(item.data, inicio, fim));
  const custos = consolidarCustos(
    custosDeOutrosModulos(abastecimentos, ordensServico, inicio, fim),
    lancamentosCusto,
    inicio,
    fim,
  );

  return [
    {
      id: 'producao-por-servico',
      titulo: 'Produção por serviço',
      descricao: 'Executado no período e acumulado do contrato.',
      colunas: ['Serviço', 'Unidade', 'No período', 'Acumulado', 'Previsto', 'Avanço (%)'],
      linhas: avancoDosServicos(servicos, producao, fim).map(item => [
        item.servico.descricao,
        item.servico.unidade,
        numero(producaoPeriodo
          .filter(registro => registro.servicoId === item.servico.id)
          .reduce((total, registro) => total + (Number(registro.quantidade) || 0), 0)),
        item.acumulado,
        item.previsto || '—',
        item.percentual ?? '—',
      ]),
    },
    {
      id: 'aderencia-planejamento',
      titulo: 'Aderência ao planejamento',
      descricao: 'Planejado x realizado por plano que toca o período.',
      colunas: ['Serviço', 'Período', 'Frente/Equipe', 'Planejado', 'Realizado', 'Aderência (%)', 'Situação'],
      linhas: aderenciaDosPlanos(
        planejamento.filter(item => item.ativo !== false && item.dataInicio <= fim && item.dataFim >= inicio),
        producao,
        hoje,
      ).map(item => [
        item.plano.servicoDescricao,
        `${item.plano.dataInicio} a ${item.plano.dataFim}`,
        [item.plano.frente, item.plano.equipeNome].filter(Boolean).join(' · ') || '—',
        item.planejado,
        item.realizado,
        item.aderencia,
        item.atrasado ? 'Atrasado' : item.plano.situacao,
      ]),
    },
    {
      id: 'custos-por-categoria',
      titulo: 'Custos por categoria',
      descricao: 'Consolidado do período, incluindo o que vem dos módulos.',
      colunas: ['Categoria', 'Valor (R$)', 'Participação (%)'],
      linhas: custosPor(custos, item => item.categoria).map(item => [
        item.grupo,
        item.valor,
        totalCustos(custos) > 0 ? Number(((item.valor / totalCustos(custos)) * 100).toFixed(1)) : 0,
      ]),
    },
    {
      id: 'medicoes',
      titulo: 'Medições do período',
      descricao: 'Boletins com período que termina dentro do intervalo.',
      colunas: ['Número', 'Período', 'Itens', 'Total (R$)', 'Situação', 'Responsável'],
      linhas: medicoes
        .filter(item => item.ativo !== false && noPeriodo(item.periodoFim, inicio, fim))
        .map(item => [
          item.numero,
          `${item.periodoInicio} a ${item.periodoFim}`,
          item.itens.length,
          totalMedicao(item.itens),
          item.situacao,
          item.responsavel,
        ]),
    },
    {
      id: 'qualidade',
      titulo: 'Qualidade e conformidade',
      descricao: 'FVS do período e não conformidades em aberto.',
      colunas: ['Indicador', 'Valor'],
      linhas: (() => {
        const fichas = fichasFvs.filter(item => item.ativo !== false && noPeriodo(item.data, inicio, fim));
        const resumo = resumoFvs(fichas.flatMap(ficha => ficha.itens));
        return [
          ['Fichas emitidas', fichas.length],
          ['Itens conformes', resumo.conformes],
          ['Itens não conformes', resumo.naoConformes],
          ['Fichas reprovadas', fichas.filter(item => item.situacao === 'Reprovada').length],
          ['NC em aberto', naoConformidades.filter(item => item.ativo !== false
            && ['Aberta', 'Em tratamento', 'Verificação'].includes(item.situacao)).length],
          ['Inspeções em aberto', inspecoes.filter(item => item.ativo !== false
            && ['Aberta', 'Em correção'].includes(item.situacao)).length],
        ] as ValorRelatorio[][];
      })(),
    },
    {
      id: 'ocorrencias',
      titulo: 'Ocorrências e horas paradas',
      descricao: 'Por tipo, com horas paradas informadas.',
      colunas: ['Tipo', 'Ocorrências', 'Horas paradas'],
      linhas: painelOcorrencias(ocorrencias, inicio, fim).porTipo.map(item => [
        item.tipo,
        item.quantidade,
        item.horasParadas,
      ]),
    },
    {
      id: 'indicadores',
      titulo: 'Indicadores do período',
      descricao: 'Os mesmos KPIs da tela de Indicadores.',
      colunas: ['Grupo', 'Indicador', 'Valor', 'Unidade'],
      linhas: calcularIndicadores(contexto).map(item => [
        item.grupo,
        item.titulo,
        item.valor,
        item.unidade || '—',
      ]),
    },
    {
      id: 'pendencias',
      titulo: 'Pendências em aberto',
      descricao: 'A mesma lista da central de pendências.',
      colunas: ['Área', 'Pendência', 'Quantidade', 'Gravidade'],
      linhas: listarPendencias(contexto).map(item => [
        item.categoria,
        item.titulo,
        item.quantidade,
        item.gravidade,
      ]),
    },
  ];
};
