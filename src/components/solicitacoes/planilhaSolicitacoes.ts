/**
 * Ler a planilha de importação e gerar o Excel dos relatórios. A tela abre
 * este arquivo com import() só quando a pessoa pede, para o ExcelJS não pesar
 * na abertura da aba.
 */
import {
  addCorporateSummarySheet,
  configureCorporateWorkbook,
  createCorporateWorkbook,
  downloadCorporateWorkbook,
  loadValidatedWorkbook,
  stripUnsupportedWorkbookVisuals,
  styleCorporateWorksheet,
} from '../../utils/excelCorporate';
import { formatarDia, situacaoDe, type Solicitacao } from '../../utils/solicitacoes';
import { movimentoPorDia, resumoDoPeriodo, textoPct } from '../../utils/relatorioSolicitacoes';
import {
  COLUNAS_IMPORTACAO,
  historicoGeral,
  linhasDeConferencia,
  lerCsv,
  relatorioAprovador,
  relatorioLogistico,
  relatorioPorSolicitante,
  relatorioSuprimentos,
  type AbaLida,
} from '../../utils/solicitacoesPlanilha';

/** Valor da célula do ExcelJS como dado simples (texto rico, fórmula e link viram o valor). */
const valorSimples = (valor: unknown): unknown => {
  if (valor === null || valor === undefined || valor instanceof Date || typeof valor !== 'object') return valor ?? '';
  const objeto = valor as Record<string, unknown>;
  if ('result' in objeto) return valorSimples(objeto.result);
  if ('richText' in objeto && Array.isArray(objeto.richText)) return objeto.richText.map(parte => (parte as { text?: string }).text ?? '').join('');
  if ('text' in objeto) return valorSimples(objeto.text);
  return '';
};

/**
 * Lê cada aba por inteiro. O cabeçalho é a primeira linha (entre as dez
 * primeiras) só de textos, com três ou mais nomes diferentes: assim o título mesclado
 * em cima ("Pedidos de compras") não engana. Aba sem cabeçalho (a de
 * Prioridade) fica com "Coluna 1", "Coluna 2"... na ordem das colunas.
 */
const lerAbasDoExcel = async (arquivo: File): Promise<AbaLida[]> => {
  const livro = await loadValidatedWorkbook(new File([await stripUnsupportedWorkbookVisuals(new Uint8Array(await arquivo.arrayBuffer()))], arquivo.name));
  return livro.worksheets.map(aba => {
    const total = Math.min(aba.columnCount, 60);
    const valoresDa = (numero: number) => Array.from({ length: total }, (_, i) => valorSimples(aba.getRow(numero).getCell(i + 1).value));
    let cabecalho = 0;
    for (let numero = 1; numero <= Math.min(10, aba.rowCount); numero += 1) {
      const preenchidas = valoresDa(numero).filter(valor => String(valor ?? '').trim() !== '');
      // Título mesclado repete o mesmo texto em todas as células: não conta.
      if (new Set(preenchidas).size >= 3 && preenchidas.every(valor => typeof valor === 'string')) { cabecalho = numero; break; }
    }
    const nomes = (cabecalho ? valoresDa(cabecalho) : []).map((valor, i) => String(valor ?? '').trim() || `Coluna ${i + 1}`);
    const chaves = Array.from({ length: total }, (_, i) => {
      const nome = nomes[i] ?? `Coluna ${i + 1}`;
      return nomes.indexOf(nome) === i ? nome : `${nome} (${i + 1})`;
    });
    const linhas: AbaLida['linhas'] = [];
    for (let numero = cabecalho + 1; numero <= aba.rowCount; numero += 1) {
      const lista = valoresDa(numero);
      if (lista.every(valor => String(valor ?? '').trim() === '')) continue;
      linhas.push({ linha: numero, valores: Object.fromEntries(chaves.map((chave, i) => [chave, lista[i]])) });
    }
    return { nome: aba.name.trim(), linhas };
  });
};

/** Todas as abas do arquivo (o CSV vira uma aba só), com o número da linha no arquivo. */
export const lerArquivoDeImportacao = async (arquivo: File): Promise<AbaLida[]> => {
  if (/\.csv$/i.test(arquivo.name)) {
    const texto = await arquivo.text();
    return [{ nome: arquivo.name, linhas: lerCsv(texto).map((valores, indice) => ({ linha: indice + 2, valores: valores as Record<string, unknown> })) }];
  }
  if (!/\.xlsx$/i.test(arquivo.name)) throw new Error('Use um arquivo .xlsx ou .csv.');
  const abas = await lerAbasDoExcel(arquivo);
  if (!abas.length) throw new Error('A planilha não tem abas.');
  return abas;
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

/** Os relatórios gerenciais, a conferência e o histórico num arquivo só, uma aba cada. */
export const baixarRelatorios = async (
  sols: readonly Solicitacao[],
  hoje: string,
  periodo?: { from: string; to: string; pessoa?: string },
  /** Todos os pedidos, para o "Por dia" contar entregas de pedidos abertos antes do período. */
  todas: readonly Solicitacao[] = sols,
) => {
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

  const conferencia = livro.addWorksheet('Conferência');
  conferencia.addRows([[], []]);
  conferencia.addRow(['Pedido', 'SC', 'Prioridade', 'Solicitante', 'Item', 'Qtd. pedida', 'Unidade', 'Chegou', 'Situação', 'Última conferência', 'Quem', 'Observação']);
  const linhasConf = linhasDeConferencia(sols);
  linhasConf.forEach(({ sol, item, situacao }) => {
    const ultima = item.conferencias?.[item.conferencias.length - 1];
    conferencia.addRow([sol.numero, sol.numeroSc ?? '', sol.prioridade ?? '', sol.solicitante, item.descricao, item.quantidadePedido ?? item.quantidade, item.unidade, item.quantidadeRecebida ?? 0, situacao, ultima ? formatarDia(ultima.data) : '', ultima?.usuario ?? '', ultima?.observacao ?? '']);
  });
  titulo(conferencia, 'Conferência de itens', conferencia.rowCount - 3);
  linhasConf.forEach(({ situacao }, indice) => {
    if (situacao !== 'Falta') return;
    conferencia.getRow(4 + indice).eachCell(celula => {
      celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERMELHO } };
    });
  });

  const historico = livro.addWorksheet('Histórico');
  historico.addRows([[], []]);
  historico.addRow(['Quando', 'Pedido', 'SC', 'Quem', 'O que aconteceu', 'Detalhe']);
  historicoGeral(sols).forEach(evento => historico.addRow([
    new Date(evento.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }), evento.sol.numero, evento.sol.numeroSc ?? '', evento.usuario, evento.acao, evento.detalhe ?? '',
  ]));
  titulo(historico, 'Histórico de todos os pedidos', historico.rowCount - 3);

  // Resumo em porcentagem, igual ao que a tela mostra nas pizzas.
  const resumo = resumoDoPeriodo(sols, hoje);
  const porcentagens = livro.addWorksheet('Porcentagens');
  porcentagens.addRows([[], []]);
  porcentagens.addRow(['Grupo', 'Parte', 'Quantidade', '%']);
  ([
    ['Situação dos pedidos', resumo.porSituacao],
    ['Pedidos por solicitante', resumo.porSolicitante],
    ['Pedidos por frente', resumo.porFrente],
    ['Conferência dos itens', resumo.porConferencia],
  ] as const).forEach(([grupo, partes]) => partes.forEach(parte => porcentagens.addRow([grupo, parte.nome, parte.quantidade, parte.percentual / 100])));
  porcentagens.getColumn(4).numFmt = '0%';
  titulo(porcentagens, 'Resumo em porcentagem', porcentagens.rowCount - 3);

  if (periodo) {
    const porDia = livro.addWorksheet('Por dia');
    porDia.addRows([[], []]);
    porDia.addRow(['Dia', 'Abertos', 'Aprovados', 'Entregues']);
    movimentoPorDia(todas, periodo).forEach(ponto => porDia.addRow([formatarDia(ponto.iso), ponto.abertos, ponto.aprovados, ponto.entregues]));
    titulo(porDia, 'Movimento dia a dia', porDia.rowCount - 3);
  }

  addCorporateSummarySheet(livro, 'Relatório de solicitações e compras', [
    ['Período', periodo ? `${formatarDia(periodo.from)} a ${formatarDia(periodo.to)}` : `Posição em ${formatarDia(hoje)}`],
    ['Pessoa que pediu', periodo?.pessoa || 'Todas'],
    ['Pedidos', resumo.pedidos],
    ['Itens', resumo.itens],
    ['Entregues', `${resumo.entregues} (${textoPct(resumo.pctEntregues)})`],
    ['Em atraso', `${resumo.emAtraso} (${textoPct(resumo.pctEmAtraso)})`],
    ['Cancelados', resumo.cancelados],
    ['Itens recebidos por completo', textoPct(resumo.pctItensRecebidos)],
    ['Dias até chegar (média)', resumo.diasAteEntrega ?? '—'],
    ['Valor aprovado (R$)', resumo.valorAprovado],
  ]);

  await downloadCorporateWorkbook(livro, periodo ? `relatorios-solicitacoes-${periodo.from}-a-${periodo.to}.xlsx` : `relatorios-solicitacoes-${hoje}.xlsx`);
};
