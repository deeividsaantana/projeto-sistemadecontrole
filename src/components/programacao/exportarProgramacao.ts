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
import { ROTULO_SITUACAO, type ResumoAtividade } from '../../utils/programacao';
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
