/**
 * Ler a planilha de importação e gerar o Excel dos relatórios. A tela abre
 * este arquivo com import() só quando a pessoa pede, para o ExcelJS não pesar
 * na abertura da aba.
 */
import { readWorkbookFile } from '../../imports/workbookReader';
import {
  configureCorporateWorkbook,
  createCorporateWorkbook,
  downloadCorporateWorkbook,
  styleCorporateWorksheet,
} from '../../utils/excelCorporate';
import { formatarDia, situacaoDe, type Solicitacao } from '../../utils/solicitacoes';
import {
  COLUNAS_IMPORTACAO,
  lerCsv,
  relatorioAprovador,
  relatorioLogistico,
  relatorioPorSolicitante,
  relatorioSuprimentos,
} from '../../utils/solicitacoesPlanilha';

/** Linhas da primeira aba (ou do CSV), com o número da linha no arquivo. */
export const lerArquivoDeImportacao = async (arquivo: File) => {
  if (/\.csv$/i.test(arquivo.name)) {
    const texto = await arquivo.text();
    return lerCsv(texto).map((valores, indice) => ({ linha: indice + 2, valores: valores as Record<string, unknown> }));
  }
  if (!/\.xlsx$/i.test(arquivo.name)) throw new Error('Use um arquivo .xlsx ou .csv.');
  const lido = await readWorkbookFile(arquivo);
  const aba = lido.sheets[0];
  if (!aba) throw new Error('A planilha não tem abas.');
  return aba.rows.map(linha => ({ linha: linha.rowNumber, valores: linha.values }));
};

/** Modelo vazio com as colunas obrigatórias e uma linha de exemplo. */
export const baixarModeloDeImportacao = async () => {
  const livro = await createCorporateWorkbook();
  configureCorporateWorkbook(livro, 'Modelo de importação de solicitações');
  const aba = livro.addWorksheet('Solicitações');
  aba.addRow([...COLUNAS_IMPORTACAO]);
  aba.addRow(['Thiago', 'Material', 'Ramo 1400', 'Vergalhão CA-50 ø 12,5 mm', 10, 'ton', '20/11/2026', 'S']);
  styleCorporateWorksheet(aba, { title: 'Modelo de importação', headerRow: 1, showTitleBlock: false });
  await downloadCorporateWorkbook(livro, 'modelo-solicitacoes.xlsx');
};

const VERMELHO = 'FFFEE2E2';

/** Os quatro relatórios gerenciais num arquivo só, uma aba cada. */
export const baixarRelatorios = async (sols: readonly Solicitacao[], hoje: string) => {
  const livro = await createCorporateWorkbook();
  configureCorporateWorkbook(livro, 'Solicitações, suprimentos e logística');
  const titulo = (aba: ReturnType<typeof livro.addWorksheet>, texto: string, linhas: number) =>
    styleCorporateWorksheet(aba, { title: texto, headerRow: 3, recordCount: linhas });

  const porSolicitante = livro.addWorksheet('Por solicitante');
  porSolicitante.addRows([[], []]);
  porSolicitante.addRow(['Solicitante', 'Abertas', 'Atendidas', 'Pendentes', 'Em atraso', 'Canceladas']);
  relatorioPorSolicitante(sols, hoje).forEach(item => porSolicitante.addRow([item.solicitante, item.abertas, item.atendidas, item.pendentes, item.emAtraso, item.canceladas]));
  titulo(porSolicitante, 'Relatório por solicitante', porSolicitante.rowCount - 3);

  const suprimentos = livro.addWorksheet('Desempenho de suprimentos');
  suprimentos.addRows([[], []]);
  suprimentos.addRow(['Comprador', 'Pedidos', 'Tempo médio de cotação (h)', 'Entregues', 'No prazo', 'Pontualidade (%)', 'Reagendamentos']);
  relatorioSuprimentos(sols).forEach(item => suprimentos.addRow([item.comprador, item.pedidos, item.tempoMedioCotacaoHoras ?? '—', item.entregues, item.noPrazo, item.pontualidadePct ?? '—', item.reagendamentos]));
  titulo(suprimentos, 'Desempenho de suprimentos', suprimentos.rowCount - 3);

  const aprovador = livro.addWorksheet('Aprovador');
  aprovador.addRows([[], []]);
  aprovador.addRow(['Aprovador', 'Aprovados', 'Com condição', 'Rejeições', 'Valor aprovado (R$)']);
  relatorioAprovador(sols).forEach(item => aprovador.addRow([item.aprovador, item.aprovados, item.condicionais, item.rejeicoes, item.valorAprovado]));
  titulo(aprovador, 'Relatório do aprovador', aprovador.rowCount - 3);
  aprovador.getColumn(5).numFmt = '"R$" #,##0.00';

  const logistica = relatorioLogistico(sols, hoje);
  const diario = livro.addWorksheet('Logística diária');
  diario.addRows([[], []]);
  diario.addRow(['Dia', 'Entregues no local', 'Destinados a descarte']);
  logistica.diario.forEach(item => diario.addRow([formatarDia(item.periodo), item.noLocal, item.descarte]));
  titulo(diario, 'Cargas entregues por dia', diario.rowCount - 3);

  const mensal = livro.addWorksheet('Logística mensal');
  mensal.addRows([[], []]);
  mensal.addRow(['Mês', 'Entregues no local', 'Destinados a descarte']);
  logistica.mensal.forEach(item => mensal.addRow([item.periodo.split('-').reverse().join('/'), item.noLocal, item.descarte]));
  titulo(mensal, 'Cargas entregues por mês', mensal.rowCount - 3);

  const aberto = livro.addWorksheet('Entregas em aberto');
  aberto.addRows([[], []]);
  aberto.addRow(['Solicitação', 'Pedido', 'Solicitante', 'Frente', 'Fornecedor', 'Fim da janela', 'Situação', 'Reagendamentos']);
  logistica.emAberto.forEach(({ sol }) => aberto.addRow([sol.numero, sol.numeroPedido ?? '', sol.solicitante, sol.frente, sol.fornecedor ?? '', formatarDia(sol.janelaFim), situacaoDe(sol, hoje), sol.reagendamentos.length]));
  titulo(aberto, 'Entregas em aberto', aberto.rowCount - 3);
  // Em atraso em vermelho, depois do estilo (que pinta as linhas alternadas).
  logistica.emAberto.forEach(({ atraso }, indice) => {
    if (!atraso) return;
    aberto.getRow(4 + indice).eachCell(celula => {
      celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERMELHO } };
      celula.font = { bold: true, color: { argb: 'FFB91C1C' }, size: 10 };
    });
  });

  await downloadCorporateWorkbook(livro, `relatorios-solicitacoes-${hoje}.xlsx`);
};
