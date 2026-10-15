import type ExcelJS from 'exceljs';
import type { FuelReportExcelRow } from './fuelReport';
import { COLUNAS_PLANILHA, diaDaSemana, montarResumoGeral, separarPorMes } from './planilhaDiesel';

/**
 * Monta o Excel no mesmo modelo da planilha "FORNECIMENTO DIESEL - 2026":
 * "Resumo Geral", "Equipamentos" e uma aba por mês do diesel, com o título
 * em cima, o cabeçalho cinza e as linhas em zebra. Larguras, cores e fontes
 * copiadas da planilha que a obra usa.
 */

export interface EquipamentoDaPlanilha {
  prefixo: string;
  nome: string;
  familia: string;
  empresa: string;
  status: string;
}

const PRETO = { argb: 'FF000000' };
const FINA = { style: 'thin' as const, color: PRETO };
const GROSSA = { style: 'medium' as const, color: PRETO };
const CINZA_CABECALHO = 'FFE7E6E6';
const CINZA_LINHA = 'FFF2F2F2';
const BRANCO = 'FFFFFFFF';
const FONTE = { name: 'Calibri', size: 11 };
const FONTE_CABECALHO = { ...FONTE, bold: true, color: { argb: 'FF222222' } };

// A, de dia da semana, e B a M nas mesmas larguras da planilha.
const LARGURAS_MES = [5.6, 10.6, 8.8, 36.4, 11, 11.4, 10, 9.4, 15.4, 24.4, 19.6, 16.7, 18.6];

const preencher = (cor: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: cor } });

const estilizarCabecalho = (linha: ExcelJS.Row, primeira: number, ultima: number) => {
  for (let coluna = primeira; coluna <= ultima; coluna += 1) {
    const celula = linha.getCell(coluna);
    celula.font = FONTE_CABECALHO;
    celula.fill = preencher(CINZA_CABECALHO);
    celula.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    celula.border = { left: FINA, right: FINA, top: FINA, bottom: GROSSA };
  }
};

const estilizarLinha = (linha: ExcelJS.Row, primeira: number, ultima: number, zebra: boolean) => {
  for (let coluna = primeira; coluna <= ultima; coluna += 1) {
    const celula = linha.getCell(coluna);
    celula.font = { ...FONTE, color: celula.font?.color };
    celula.fill = preencher(zebra ? CINZA_LINHA : BRANCO);
    celula.alignment = { vertical: 'middle', horizontal: celula.alignment?.horizontal };
    celula.border = { left: FINA, right: FINA, top: FINA, bottom: FINA };
  }
};

const titulo = (aba: ExcelJS.Worksheet, intervalo: string, texto: string) => {
  aba.mergeCells(intervalo);
  const celula = aba.getCell(intervalo.split(':')[0]);
  celula.value = texto;
  celula.font = { name: 'Aptos Narrow', size: 16, bold: true };
  celula.alignment = { horizontal: 'center', vertical: 'middle' };
  celula.border = { bottom: GROSSA };
};

const numero = (valor: number | '') => (valor === '' ? null : valor);

const dataExcel = (dia: string) => (/^\d{4}-\d{2}-\d{2}$/.test(dia) ? new Date(`${dia}T12:00:00Z`) : dia);

const adicionarAbaDoMes = (pasta: ExcelJS.Workbook, nome: string, textoTitulo: string, linhas: readonly FuelReportExcelRow[]) => {
  const aba = pasta.addWorksheet(nome.slice(0, 31), { views: [{ state: 'frozen', ySplit: 5, showGridLines: true }] });
  aba.columns = LARGURAS_MES.map(width => ({ width }));
  for (let linha = 1; linha <= 4; linha += 1) aba.getRow(linha).height = 21;
  titulo(aba, 'B1:J4', textoTitulo);
  // Total do mês ao lado do título, onde a planilha deixa livre.
  aba.mergeCells('K1:M2');
  aba.getCell('K1').value = 'TOTAL DE LITROS';
  aba.getCell('K1').font = { ...FONTE, bold: true };
  aba.getCell('K1').alignment = { horizontal: 'center', vertical: 'bottom' };
  aba.mergeCells('K3:M4');
  aba.getCell('K3').value = Math.round(linhas.reduce((soma, linha) => soma + linha.litros, 0) * 10) / 10;
  aba.getCell('K3').numFmt = '#,##0.0';
  aba.getCell('K3').font = { ...FONTE, size: 14, bold: true };
  aba.getCell('K3').alignment = { horizontal: 'center', vertical: 'top' };

  const cabecalho = aba.getRow(5);
  cabecalho.values = ['', ...COLUNAS_PLANILHA.map(coluna => coluna.rotulo)];
  cabecalho.height = 30;
  estilizarCabecalho(cabecalho, 2, 13);

  linhas.forEach((item, indice) => {
    const linha = aba.addRow([
      diaDaSemana(item.data),
      dataExcel(item.data),
      item.prefixo,
      item.descricao || 'NÃO CADASTRADO',
      numero(item.kmInicial),
      numero(item.horimetro),
      item.litros,
      item.hora,
      item.comboio,
      item.tipoCombustivel,
      item.empresa || 'NÃO CADASTRADO',
      numero(item.bombaInicial),
      numero(item.bombaFinal),
    ]);
    estilizarLinha(linha, 2, 13, indice % 2 === 0);
    linha.getCell(1).font = { ...FONTE, color: { argb: 'FF718087' } };
    linha.getCell(1).alignment = { horizontal: 'center' };
    linha.getCell(2).numFmt = 'dd/mm/yyyy';
    linha.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    [5, 6, 12, 13].forEach(coluna => { linha.getCell(coluna).numFmt = '0'; });
    linha.getCell(7).numFmt = '#,##0.0';
    linha.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
    if (!item.descricao) linha.getCell(4).font = { ...FONTE, color: { argb: 'FFFF0000' } };
    if (!item.empresa) linha.getCell(11).font = { ...FONTE, color: { argb: 'FFFF0000' } };
  });
  if (linhas.length) aba.autoFilter = { from: { row: 5, column: 2 }, to: { row: 5 + linhas.length, column: 13 } };
  return aba;
};

const adicionarResumoGeral = (pasta: ExcelJS.Workbook, linhas: readonly FuelReportExcelRow[]) => {
  const resumo = montarResumoGeral(linhas);
  const aba = pasta.addWorksheet('Resumo Geral', { views: [{ showGridLines: true }] });
  aba.columns = [3, 16, 31, 28, 16, 16, 13, 23.8, 17, 17, 17, 16, 18, 12].map(width => ({ width }));
  aba.getRow(1).height = 30;
  titulo(aba, 'B1:N1', 'FORNECIMENTO DIESEL - RESUMO GERAL');

  const cartoes: Array<[string, string, string, number]> = [
    ['B3:C3', 'B4:C4', 'Total de litros', resumo.totalLitros],
    ['E3:F3', 'E4:F4', 'Lançamentos', resumo.lancamentos],
    ['H3:I3', 'H4:I4', 'Comboios', resumo.comboios],
    ['K3:L3', 'K4:L4', 'Equipamentos', resumo.equipamentos],
  ];
  cartoes.forEach(([rotulo, valor, texto, total]) => {
    aba.mergeCells(rotulo);
    aba.mergeCells(valor);
    const celulaRotulo = aba.getCell(rotulo.split(':')[0]);
    celulaRotulo.value = texto;
    celulaRotulo.font = FONTE_CABECALHO;
    celulaRotulo.fill = preencher(CINZA_CABECALHO);
    celulaRotulo.alignment = { horizontal: 'center', vertical: 'middle' };
    const celulaValor = aba.getCell(valor.split(':')[0]);
    celulaValor.value = total;
    celulaValor.numFmt = '#,##0';
    celulaValor.font = { ...FONTE, size: 16, bold: true };
    celulaValor.alignment = { horizontal: 'center', vertical: 'middle' };
    celulaValor.border = { left: FINA, right: FINA, bottom: FINA };
  });
  aba.getRow(4).height = 28;

  const tabela = (linhaInicial: number, colunaInicial: number, nome: string, cabecalhos: string[], dados: Array<Array<string | number | Date | null>>, formatos: string[]) => {
    const celulaNome = aba.getRow(linhaInicial).getCell(colunaInicial);
    celulaNome.value = nome;
    celulaNome.font = { ...FONTE, bold: true, size: 12 };
    const cabecalho = aba.getRow(linhaInicial + 1);
    cabecalhos.forEach((texto, indice) => { cabecalho.getCell(colunaInicial + indice).value = texto; });
    estilizarCabecalho(cabecalho, colunaInicial, colunaInicial + cabecalhos.length - 1);
    dados.forEach((valores, indice) => {
      const linha = aba.getRow(linhaInicial + 2 + indice);
      valores.forEach((valor, coluna) => {
        const celula = linha.getCell(colunaInicial + coluna);
        celula.value = valor;
        if (formatos[coluna]) celula.numFmt = formatos[coluna];
      });
      estilizarLinha(linha, colunaInicial, colunaInicial + cabecalhos.length - 1, indice % 2 === 0);
    });
    return linhaInicial + 2 + dados.length;
  };

  const fimMes = tabela(7, 2, 'Resumo por mês', ['Mês', 'Litros', 'Lançamentos', 'Média'],
    resumo.porMes.map(item => [item.mes, item.litros, item.lancamentos, item.media]), ['', '#,##0', '0', '#,##0.0']);
  const fimComboio = tabela(7, 8, 'Resumo por comboio', ['Comboio', 'Litros', 'Lançamentos', 'Última data', 'Última bomba final'],
    resumo.porComboio.map(item => [item.comboio, item.litros, item.lancamentos, item.ultimaData ? dataExcel(item.ultimaData) : null, item.ultimaBombaFinal === '' ? null : item.ultimaBombaFinal]),
    ['', '#,##0', '0', 'dd/mm/yyyy', '0']);
  const inicioBaixo = Math.max(fimMes, fimComboio) + 2;
  tabela(inicioBaixo, 2, 'Top equipamentos por consumo', ['Prefixo', 'Equipamento', 'Litros', 'Lançamentos'],
    resumo.topEquipamentos.map(item => [item.prefixo, item.equipamento, item.litros, item.lancamentos]), ['', '', '#,##0', '0']);
  tabela(inicioBaixo, 8, 'Resumo por empresa', ['Empresa', 'Litros'],
    resumo.porEmpresa.map(item => [item.empresa, item.litros]), ['', '#,##0']);
  return aba;
};

const adicionarEquipamentos = (pasta: ExcelJS.Workbook, equipamentos: readonly EquipamentoDaPlanilha[]) => {
  const aba = pasta.addWorksheet('Equipamentos', { views: [{ state: 'frozen', ySplit: 1, showGridLines: true }] });
  aba.columns = [{ width: 12 }, { width: 40 }, { width: 24 }, { width: 24 }, { width: 16 }];
  const cabecalho = aba.getRow(1);
  cabecalho.values = ['Frota', 'Equipamento', 'Família', 'Empresa', 'Status'];
  estilizarCabecalho(cabecalho, 1, 5);
  [...equipamentos]
    .sort((a, b) => a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true }))
    .forEach((item, indice) => {
      const linha = aba.addRow([item.prefixo, item.nome, item.familia, item.empresa, item.status]);
      estilizarLinha(linha, 1, 5, indice % 2 === 0);
    });
  if (equipamentos.length) aba.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + equipamentos.length, column: 5 } };
  return aba;
};

/**
 * Preenche a pasta: "Resumo Geral", "Equipamentos" e um mês por aba. Abre
 * no mês mais recente, como a planilha fica quando a obra salva.
 */
export const preencherPlanilhaDiesel = (
  pasta: ExcelJS.Workbook,
  linhas: readonly FuelReportExcelRow[],
  equipamentos: readonly EquipamentoDaPlanilha[],
) => {
  adicionarResumoGeral(pasta, linhas);
  adicionarEquipamentos(pasta, equipamentos);
  const meses = separarPorMes(linhas);
  meses.forEach(mes => adicionarAbaDoMes(pasta, mes.nome, mes.titulo, mes.linhas));
  if (!meses.length) adicionarAbaDoMes(pasta, 'LANÇAMENTOS', 'FORNECIMENTO DIESEL', []);
  pasta.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: Math.max(0, pasta.worksheets.length - 1), visibility: 'visible' }];
  return meses;
};
