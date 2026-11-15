/**
 * Excel e PDF da Programação. A tela abre este arquivo com import() só quando
 * a pessoa pede, para o ExcelJS e o jsPDF não pesarem na abertura da aba.
 * Sai sempre o que está na tela, com os filtros aplicados.
 */
import type { RegistroProducao } from '../../types';
import {
  configureCorporateWorkbook,
  createCorporateWorkbook,
  downloadCorporateWorkbook,
  styleCorporateWorksheet,
} from '../../utils/excelCorporate';
import { formatarData } from '../../utils/formato';
import { ROTULO_SITUACAO, avancoGeral, avancoPorFrente, curvaS, previstoGeral, type ResumoAtividade } from '../../utils/programacao';
import { OBRA } from '../../config/obra';

const arredondar = (valor: number) => Math.round(valor * 10) / 10;

const linhaDaAtividade = (resumo: ResumoAtividade) => ({
  frente: resumo.item.frente || '',
  servico: resumo.item.servicoDescricao,
  responsavel: resumo.item.responsavel || resumo.item.equipeNome || '',
  inicio: formatarData(resumo.item.dataInicio),
  termino: formatarData(resumo.item.dataFim),
  dias: resumo.dias,
  estacas: [resumo.item.estacaInicial, resumo.item.estacaFinal].filter(Boolean).join(' a '),
  quantidade: arredondar(resumo.item.quantidadePlanejada),
  unidade: resumo.item.unidade,
  meta: arredondar(resumo.meta),
  realizado: arredondar(resumo.realizado),
  avanco: `${Math.round(resumo.percentual)}%`,
  saldo: arredondar(resumo.saldo),
  equipamentos: resumo.item.equipamentos || '',
  situacao: ROTULO_SITUACAO[resumo.situacao],
});

const COLUNAS = [
  ['frente', 'Frente'], ['servico', 'Serviço'], ['responsavel', 'Responsável'], ['inicio', 'Início'], ['termino', 'Término'],
  ['dias', 'Dias'], ['estacas', 'Estacas'], ['quantidade', 'Quantidade'], ['unidade', 'Un.'], ['meta', 'Meta/dia'],
  ['realizado', 'Realizado'], ['avanco', 'Avanço'], ['saldo', 'Saldo'], ['equipamentos', 'Equipamentos'], ['situacao', 'Situação'],
] as const;

export async function baixarExcelProgramacao(resumos: readonly ResumoAtividade[], producao: readonly RegistroProducao[], filtros: string[], dia: string) {
  const livro = await createCorporateWorkbook();
  configureCorporateWorkbook(livro, 'Programação de terraplanagem');

  const aba = livro.addWorksheet('Programação');
  // As duas primeiras linhas recebem o título e os filtros (styleCorporateWorksheet).
  aba.addRow(['']);
  aba.addRow(['']);
  aba.addRow(COLUNAS.map(([, titulo]) => titulo));
  resumos.forEach(resumo => {
    const linha = linhaDaAtividade(resumo);
    aba.addRow(COLUNAS.map(([chave]) => linha[chave]));
  });
  styleCorporateWorksheet(aba, { title: `Programação de terraplanagem · ${OBRA.nome}`, filters: filtros, headerRow: 3, lastColumn: COLUNAS.length, freezeRows: 3, recordCount: resumos.length, autoFit: true });

  const abaProducao = livro.addWorksheet('Produção');
  abaProducao.addRow(['Data', 'Frente', 'Serviço', 'Quantidade', 'Un.', 'Lançado por', 'Observação']);
  [...producao]
    .sort((a, b) => b.data.localeCompare(a.data))
    .forEach(registro => abaProducao.addRow([
      formatarData(registro.data), registro.frente || '', registro.servicoDescricao, registro.quantidade, registro.unidade, registro.responsavel, registro.observacao || '',
    ]));
  styleCorporateWorksheet(abaProducao, { title: 'Produção', headerRow: 1, lastColumn: 7, freezeRows: 1, recordCount: producao.length, autoFit: true });

  await downloadCorporateWorkbook(livro, `programacao-terraplanagem-${dia}.xlsx`);
}

export async function baixarPdfProgramacao(resumos: readonly ResumoAtividade[], filtros: string[], resumoGeral: Array<{ label: string; value: string | number }>, emitidoPor: string, dia: string) {
  const { generateUniversalPdfReport } = await import('../../utils/universalPdfReport');
  const colunasPdf = COLUNAS.filter(([chave]) => chave !== 'equipamentos' && chave !== 'unidade');
  await generateUniversalPdfReport({
    title: 'Programação de terraplanagem',
    subtitle: 'Atividades por frente, meta por dia e avanço',
    work: OBRA.nome,
    period: `Emitido em ${formatarData(dia)}`,
    issuedBy: emitidoPor,
    orientation: 'landscape',
    filters: filtros,
    summary: resumoGeral,
    columns: colunasPdf.map(([dataKey, header]) => ({ dataKey, header })),
    rows: resumos.map(resumo => {
      const linha = linhaDaAtividade(resumo);
      return { ...linha, quantidade: `${linha.quantidade} ${linha.unidade}`, meta: `${linha.meta} ${linha.unidade}`, realizado: `${linha.realizado} ${linha.unidade}`, saldo: `${linha.saldo} ${linha.unidade}` };
    }),
    fileName: `programacao-terraplanagem-${dia}.pdf`,
  });
}

/** Linha do relatório de avanço: previsto x feito em percentual. */
const previstoDa = (resumo: ResumoAtividade) =>
  resumo.item.quantidadePlanejada > 0 ? Math.min(100, (resumo.previsto / resumo.item.quantidadePlanejada) * 100) : 0;
const pct = (valor: number) => `${Math.round(valor)}%`;
const pontos = (valor: number) => `${valor > 0 ? '+' : ''}${Math.round(valor)} pts`;

const resumoDoAvanco = (resumos: readonly ResumoAtividade[]) => {
  const feito = avancoGeral(resumos);
  const previsto = previstoGeral(resumos);
  return [
    { label: 'Feito', value: pct(feito) },
    { label: 'Previsto até ontem', value: pct(previsto) },
    { label: 'Desvio', value: pontos(feito - previsto) },
    { label: 'Atrasadas', value: resumos.filter(resumo => resumo.situacao === 'atrasada').length },
  ];
};

const COLUNAS_FRENTE = [['frente', 'Frente'], ['atividades', 'Atividades'], ['atrasadas', 'Atrasadas'], ['concluidas', 'Concluídas'], ['previsto', 'Previsto'], ['feito', 'Feito'], ['desvio', 'Desvio']] as const;
const linhasPorFrente = (resumos: readonly ResumoAtividade[]) => avancoPorFrente(resumos).map(frente => ({
  frente: frente.frente,
  atividades: frente.atividades,
  atrasadas: frente.atrasadas,
  concluidas: frente.concluidas,
  previsto: pct(frente.previsto),
  feito: pct(frente.realizado),
  desvio: pontos(frente.realizado - frente.previsto),
}));

const COLUNAS_ATIVIDADE = [['servico', 'Serviço'], ['responsavel', 'Encarregado'], ['periodo', 'Período'], ['quantidade', 'Total'], ['realizado', 'Feito'], ['previsto', 'Previsto'], ['avanco', 'Avanço'], ['situacao', 'Situação']] as const;
const linhaAvancoAtividade = (resumo: ResumoAtividade) => ({
  frente: resumo.item.frente || 'Sem frente',
  servico: resumo.item.servicoDescricao,
  responsavel: resumo.item.responsavel || resumo.item.equipeNome || '',
  periodo: `${formatarData(resumo.item.dataInicio)} a ${formatarData(resumo.item.dataFim)}`,
  quantidade: `${arredondar(resumo.item.quantidadePlanejada)} ${resumo.item.unidade}`,
  realizado: `${arredondar(resumo.realizado)} ${resumo.item.unidade}`,
  previsto: pct(previstoDa(resumo)),
  avanco: pct(resumo.percentual),
  situacao: ROTULO_SITUACAO[resumo.situacao],
});

/** Relatório por avanço em PDF: resumo, tabela por frente e as atividades de cada frente. */
export async function baixarPdfAvanco(resumos: readonly ResumoAtividade[], filtros: string[], emitidoPor: string, dia: string) {
  const { generateUniversalPdfReport } = await import('../../utils/universalPdfReport');
  const atividades = resumos.filter(resumo => resumo.situacao !== 'cancelada').map(linhaAvancoAtividade);
  const frentes = [...new Set(atividades.map(linha => linha.frente))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  await generateUniversalPdfReport({
    title: 'Relatório de avanço físico',
    subtitle: 'Terraplanagem: previsto x feito por frente e atividade',
    work: OBRA.nome,
    period: `Emitido em ${formatarData(dia)} (previsto até o dia anterior)`,
    issuedBy: emitidoPor,
    orientation: 'landscape',
    filters: filtros,
    summary: resumoDoAvanco(resumos),
    columns: COLUNAS_FRENTE.map(([dataKey, header]) => ({ dataKey, header })),
    rows: linhasPorFrente(resumos),
    sections: frentes.map(frente => ({
      title: frente,
      columns: COLUNAS_ATIVIDADE.map(([dataKey, header]) => ({ dataKey, header })),
      rows: atividades.filter(linha => linha.frente === frente),
    })),
    fileName: `avanco-terraplanagem-${dia}.pdf`,
  });
}

/** Relatório por avanço em Excel: por frente, por atividade e a curva S dia a dia. */
export async function baixarExcelAvanco(resumos: readonly ResumoAtividade[], producao: readonly RegistroProducao[], filtros: string[], dia: string) {
  const livro = await createCorporateWorkbook();
  configureCorporateWorkbook(livro, 'Relatório de avanço físico');

  const porFrente = livro.addWorksheet('Avanço por frente');
  porFrente.addRow(['']);
  porFrente.addRow(['']);
  porFrente.addRow(COLUNAS_FRENTE.map(([, titulo]) => titulo));
  const frentes = linhasPorFrente(resumos);
  frentes.forEach(linha => porFrente.addRow(COLUNAS_FRENTE.map(([chave]) => linha[chave])));
  const geral = resumoDoAvanco(resumos);
  porFrente.addRow(['Total', resumos.filter(r => r.situacao !== 'cancelada').length, geral[3].value, '', geral[1].value, geral[0].value, geral[2].value]);
  styleCorporateWorksheet(porFrente, { title: `Avanço físico · ${OBRA.nome}`, filters: filtros, headerRow: 3, lastColumn: COLUNAS_FRENTE.length, freezeRows: 3, recordCount: frentes.length, autoFit: true });

  const porAtividade = livro.addWorksheet('Avanço por atividade');
  porAtividade.addRow(['Frente', ...COLUNAS_ATIVIDADE.map(([, titulo]) => titulo)]);
  const atividades = resumos.filter(resumo => resumo.situacao !== 'cancelada').map(linhaAvancoAtividade);
  atividades.forEach(linha => porAtividade.addRow([linha.frente, ...COLUNAS_ATIVIDADE.map(([chave]) => linha[chave])]));
  styleCorporateWorksheet(porAtividade, { title: 'Avanço por atividade', headerRow: 1, lastColumn: COLUNAS_ATIVIDADE.length + 1, freezeRows: 1, recordCount: atividades.length, autoFit: true });

  const curva = livro.addWorksheet('Curva S');
  curva.addRow(['Dia', 'Previsto acumulado (%)', 'Feito acumulado (%)']);
  const pontosCurva = curvaS(resumos, producao, dia);
  pontosCurva.forEach(ponto => curva.addRow([formatarData(ponto.dia), arredondar(ponto.previsto), ponto.realizado === undefined ? '' : arredondar(ponto.realizado)]));
  styleCorporateWorksheet(curva, { title: 'Curva S', headerRow: 1, lastColumn: 3, freezeRows: 1, recordCount: pontosCurva.length, autoFit: true });

  await downloadCorporateWorkbook(livro, `avanco-terraplanagem-${dia}.xlsx`);
}
