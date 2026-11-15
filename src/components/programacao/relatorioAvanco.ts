/**
 * Relatório de avanço físico da terraplanagem, em PDF e Excel, com a leitura
 * de um engenheiro de obra: quanto foi executado por serviço e por frente,
 * ritmo (média x meta), término projetado, folga e o que está fora do prazo.
 * Só carrega quando a pessoa pede o arquivo (import dinâmico na tela).
 */
import type ExcelJS from 'exceljs';
import type { RegistroProducao } from '../../types';
import {
  configureCorporateWorkbook,
  createCorporateWorkbook,
  downloadCorporateWorkbook,
  styleCorporateWorksheet,
} from '../../utils/excelCorporate';
import { formatarData } from '../../utils/formato';
import {
  ROTULO_SITUACAO,
  avancoGeral,
  avancoPorFrente,
  curvaS,
  previstoGeral,
  producaoDaAtividade,
  type ResumoAtividade,
} from '../../utils/programacao';
import {
  avancoPorServico,
  comRitmo,
  terminoDaObra,
  textoEstaca,
  trechosPorFrente,
  type AtividadeComRitmo,
} from '../../utils/avancoObra';
import { OBRA } from '../../config/obra';
import { imagemAvancoPorFrente, imagemCurvaS } from './graficosImagem';

const num = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const pct = (valor: number) => `${Math.round(valor)}%`;
const pontos = (valor: number) => `${valor > 0 ? '+' : valor < 0 ? '-' : ''}${Math.abs(Math.round(valor))} pts`;
const data = (dia?: string) => (dia ? formatarData(dia) : '—');
// Hífen comum: a fonte do PDF não tem o sinal de menos tipográfico.
const folgaTexto = (folga?: number) =>
  folga === undefined ? 'sem ritmo' : folga === 0 ? 'no prazo' : `${folga > 0 ? '+' : '-'}${Math.abs(folga)} ${Math.abs(folga) === 1 ? 'dia' : 'dias'}`;
const estacas = (a: AtividadeComRitmo) => (a.item.estacaInicial ? `${a.item.estacaInicial} a ${a.item.estacaFinal || '?'}` : '—');
const ordem = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true });

/** Fora do prazo: já começou, não terminou e, no ritmo de hoje, passa do término (ou está parada). */
const foraDoPrazo = (a: AtividadeComRitmo) =>
  a.situacao !== 'concluida' && a.situacao !== 'programada' && (a.ritmo.folga === undefined || a.ritmo.folga < 0);

const montar = (resumos: readonly ResumoAtividade[], producao: readonly RegistroProducao[], hoje: string) => {
  const validos = resumos.filter(resumo => resumo.situacao !== 'cancelada');
  const atividades = comRitmo(validos, producao, hoje);
  const trechos = trechosPorFrente(atividades);
  const frentes = avancoPorFrente(validos).map(frente => {
    const daFrente = atividades.filter(a => (a.item.frente || 'Sem frente') === frente.frente);
    const trecho = trechos.find(t => t.frente === frente.frente);
    return {
      ...frente,
      trecho: trecho?.atividades.length ? `${textoEstaca(trecho.de)} a ${textoEstaca(trecho.ate)}` : '—',
      extensao: trecho?.atividades.length ? trecho.ate - trecho.de : undefined,
      prazo: terminoDaObra(daFrente),
    };
  });
  const feito = avancoGeral(validos);
  const previsto = previstoGeral(validos);
  return {
    atividades,
    servicos: avancoPorServico(atividades, hoje),
    frentes,
    curva: curvaS(validos, producao, hoje),
    feito,
    previsto,
    obra: terminoDaObra(atividades),
    atrasadas: atividades.filter(foraDoPrazo).sort((a, b) => (a.ritmo.folga ?? -9999) - (b.ritmo.folga ?? -9999)),
  };
};

const resumoExecutivo = (dados: ReturnType<typeof montar>) => [
  { label: 'Avanço físico executado', value: pct(dados.feito) },
  { label: 'Previsto até ontem', value: pct(dados.previsto) },
  { label: 'Desvio', value: pontos(dados.feito - dados.previsto) },
  { label: 'Término planejado', value: data(dados.obra?.planejado) },
  { label: 'Término projetado', value: dados.obra?.projetado ? data(dados.obra.projetado) : `sem ritmo (${dados.obra?.semRitmo ?? 0} paradas)` },
  { label: 'Fora do prazo', value: `${dados.atrasadas.length} de ${dados.atividades.length}` },
];

const coluna = (dataKey: string, header: string, align?: 'right') => ({ dataKey, header, align });

/** PDF: resumo executivo, curva S, avanço por frente, por serviço, fora do prazo e controle por atividade. */
export async function baixarPdfAvanco(resumos: readonly ResumoAtividade[], producao: readonly RegistroProducao[], filtros: string[], emitidoPor: string, hoje: string) {
  const { generateUniversalPdfReport } = await import('../../utils/universalPdfReport');
  const dados = montar(resumos, producao, hoje);
  const barras = imagemAvancoPorFrente(dados.frentes);

  const porFrente = Array.from(new Set(dados.atividades.map(a => a.item.frente || 'Sem frente'))).sort(ordem);
  await generateUniversalPdfReport({
    title: 'Relatório de avanço físico',
    subtitle: 'Terraplanagem · executado x previsto, ritmo de produção e projeção de término',
    work: OBRA.nome,
    period: `Posição de ${formatarData(hoje)} · previsto acumulado até o dia anterior`,
    issuedBy: emitidoPor,
    orientation: 'landscape',
    filters: filtros,
    summary: resumoExecutivo(dados),
    tableTitle: 'Avanço por serviço (soma das frentes)',
    charts: [
      { title: 'Curva S · avanço acumulado (%)', dataUrl: imagemCurvaS(dados.curva, hoje), width: 640, height: 300 },
      { title: 'Avanço por frente · executado / previsto', dataUrl: barras.dataUrl, width: barras.largura, height: barras.altura },
    ],
    columns: [
      coluna('servico', 'Serviço'), coluna('frentes', 'Frentes'), coluna('quantidade', 'Quantidade', 'right'), coluna('executado', 'Executado', 'right'),
      coluna('saldo', 'Saldo', 'right'), coluna('avanco', 'Avanço', 'right'), coluna('previsto', 'Previsto', 'right'), coluna('media', 'Média/dia', 'right'),
      coluna('meta', 'Meta/dia', 'right'), coluna('planejado', 'Término plan.'), coluna('termino', 'Término proj.'), coluna('folga', 'Folga', 'right'),
    ],
    rows: dados.servicos.map(s => {
      const un = s.unidade.toLowerCase();
      return {
        servico: s.servico,
        frentes: s.frentes.join(', '),
        quantidade: `${num(s.quantidade)} ${un}`,
        executado: `${num(s.executado)} ${un}`,
        saldo: `${num(s.saldo)} ${un}`,
        avanco: pct(s.percentual),
        previsto: pct(s.percentualPrevisto),
        media: s.meta > 0 ? num(s.mediaDiaria) : '—',
        meta: s.meta > 0 ? num(s.meta) : '—',
        planejado: data(s.terminoPlanejado),
        termino: data(s.termino),
        folga: folgaTexto(s.folga),
      };
    }),
    sections: [
      {
        title: 'Avanço por frente',
        columns: [
          coluna('frente', 'Frente'), coluna('trecho', 'Trecho (estacas)'), coluna('extensao', 'Extensão', 'right'), coluna('atividades', 'Atividades', 'right'),
          coluna('previsto', 'Previsto', 'right'), coluna('executado', 'Executado', 'right'), coluna('desvio', 'Desvio', 'right'),
          coluna('planejado', 'Término plan.'), coluna('termino', 'Término proj.'), coluna('folga', 'Folga', 'right'),
        ],
        rows: dados.frentes.map(f => ({
          frente: f.frente,
          trecho: f.trecho,
          extensao: f.extensao === undefined ? '—' : `${num(f.extensao)} m`,
          atividades: f.atividades,
          previsto: pct(f.previsto),
          executado: pct(f.realizado),
          desvio: pontos(f.realizado - f.previsto),
          planejado: data(f.prazo?.planejado),
          termino: data(f.prazo?.projetado),
          folga: folgaTexto(f.prazo?.folga),
        })),
        totalRow: { frente: 'Obra', previsto: pct(dados.previsto), executado: pct(dados.feito), desvio: pontos(dados.feito - dados.previsto), planejado: data(dados.obra?.planejado), termino: data(dados.obra?.projetado), folga: folgaTexto(dados.obra?.folga) },
      },
      ...(dados.atrasadas.length ? [{
        title: `Atividades fora do prazo pelo ritmo atual (${dados.atrasadas.length})`,
        note: 'Começaram e, na média de produção de hoje, terminam depois do planejado. "Sem ritmo": começou e ainda não teve produção lançada.',
        columns: [
          coluna('frente', 'Frente'), coluna('servico', 'Serviço'), coluna('estacas', 'Estacas'), coluna('saldo', 'Saldo', 'right'),
          coluna('media', 'Média/dia', 'right'), coluna('precisa', 'Precisa/dia', 'right'), coluna('planejado', 'Término plan.'),
          coluna('termino', 'Término proj.'), coluna('folga', 'Folga', 'right'), coluna('responsavel', 'Encarregado'),
        ],
        rows: dados.atrasadas.map(a => ({
          frente: a.item.frente || '—',
          servico: a.item.servicoDescricao,
          estacas: estacas(a),
          saldo: `${num(a.saldo)} ${a.item.unidade.toLowerCase()}`,
          media: a.ritmo.diasTrabalhados ? num(a.ritmo.mediaDiaria) : '—',
          precisa: num(a.precisaPorDia),
          planejado: data(a.item.dataFim),
          termino: data(a.ritmo.termino),
          folga: folgaTexto(a.ritmo.folga),
          responsavel: a.item.responsavel || a.item.equipeNome || '—',
        })),
      }] : []),
      ...porFrente.map(frente => ({
        title: `${frente} · controle de produção por atividade`,
        columns: [
          coluna('servico', 'Serviço'), coluna('estacas', 'Estacas'), coluna('periodo', 'Período'), coluna('quantidade', 'Quantidade', 'right'),
          coluna('executado', 'Executado', 'right'), coluna('saldo', 'Saldo', 'right'), coluna('avanco', 'Avanço', 'right'), coluna('media', 'Média/dia', 'right'),
          coluna('meta', 'Meta/dia', 'right'), coluna('desempenho', 'Desemp.', 'right'), coluna('termino', 'Término proj.'), coluna('folga', 'Folga', 'right'), coluna('situacao', 'Situação'),
        ],
        rows: dados.atividades
          .filter(a => (a.item.frente || 'Sem frente') === frente)
          .sort((a, b) => a.item.dataInicio.localeCompare(b.item.dataInicio))
          .map(a => {
            const un = a.item.unidade.toLowerCase();
            return {
              servico: a.item.servicoDescricao,
              estacas: estacas(a),
              periodo: `${data(a.item.dataInicio)} a ${data(a.item.dataFim)}`,
              quantidade: `${num(a.item.quantidadePlanejada)} ${un}`,
              executado: `${num(a.realizado)} ${un}`,
              saldo: `${num(a.saldo)} ${un}`,
              avanco: pct(a.percentual),
              media: a.ritmo.diasTrabalhados ? num(a.ritmo.mediaDiaria) : '—',
              meta: num(a.meta),
              desempenho: a.ritmo.desempenho === undefined ? '—' : pct(a.ritmo.desempenho),
              termino: data(a.ritmo.termino),
              folga: folgaTexto(a.ritmo.folga),
              situacao: ROTULO_SITUACAO[a.situacao],
            };
          }),
      })),
    ],
    cellColor: (chave, valor) => {
      if ((chave === 'folga' && valor.startsWith('-')) || (chave === 'desvio' && valor.startsWith('-')) || (chave === 'situacao' && valor === 'Atrasada')) return [190, 18, 60];
      if (chave === 'folga' && valor === 'sem ritmo') return [194, 65, 12];
      if (chave === 'folga' && (valor.startsWith('+') || valor === 'no prazo')) return [23, 107, 77];
      return undefined;
    },
    fileName: `relatorio-avanco-terraplanagem-${hoje}.pdf`,
  });
}

// ---------- Excel ----------

const VERDE = 'FF176B4D';
const BRANCO = 'FFFFFFFF';
const FUNDO = 'FFF7F8F6';
const BORDA = 'FFCBD5E1';
const VERMELHO = 'FFBE123C';
const LARANJA = 'FFC2410C';
const CINZA = 'FF5B6870';
const TINTA = 'FF0F172A';

/** Folga em dias de trabalho: +3 d, -2 d ou "no prazo". */
const FORMATO_FOLGA = '+0" d";-0" d";"no prazo"';
const dataExcel = (dia?: string) => (dia ? new Date(`${dia}T12:00:00Z`) : null);
const fino = { style: 'thin' as const, color: { argb: BORDA } };

const pintarCabecalho = (linha: ExcelJS.Row, ultima: number) => {
  linha.height = 30;
  for (let c = 1; c <= ultima; c += 1) {
    const celula = linha.getCell(c);
    celula.font = { bold: true, color: { argb: BRANCO }, size: 10 };
    celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } };
    celula.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    celula.border = { top: fino, left: fino, bottom: fino, right: fino };
  }
};

const pintarCorpo = (linha: ExcelJS.Row, ultima: number, zebra: boolean) => {
  linha.height = 20;
  for (let c = 1; c <= ultima; c += 1) {
    const celula = linha.getCell(c);
    celula.font = { ...(celula.font || {}), size: 10, color: celula.font?.color ?? { argb: TINTA } };
    celula.alignment = { vertical: 'middle', horizontal: typeof celula.value === 'string' ? 'left' : 'right' };
    celula.border = { top: fino, left: fino, bottom: fino, right: fino };
    if (zebra) celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FUNDO } };
  }
};

const corFolga = (folga?: number) => (folga === undefined ? LARANJA : folga < 0 ? VERMELHO : VERDE);

const barraDeDados = (aba: ExcelJS.Worksheet, ref: string) => {
  aba.addConditionalFormatting({
    ref,
    rules: [{
      type: 'dataBar',
      priority: 1,
      minLength: 0,
      maxLength: 100,
      gradient: false,
      cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 1 }],
      color: { argb: 'FF5FA88A' },
    } as unknown as ExcelJS.ConditionalFormattingRule],
  });
};

/** Excel: Resumo com gráficos, Por serviço, Por frente, Atividades, Curva S e Apontamentos. */
export async function baixarExcelAvanco(resumos: readonly ResumoAtividade[], producao: readonly RegistroProducao[], filtros: string[], emitidoPor: string, hoje: string) {
  const dados = montar(resumos, producao, hoje);
  const livro = await createCorporateWorkbook();
  configureCorporateWorkbook(livro, 'Relatório de avanço físico');

  // ----- Resumo -----
  const resumo = livro.addWorksheet('Resumo', { views: [{ showGridLines: false }], properties: { tabColor: { argb: VERDE } } });
  const COLS = 12;
  resumo.columns = Array.from({ length: COLS }, () => ({ width: 13 }));
  resumo.mergeCells(1, 1, 1, COLS);
  const titulo = resumo.getCell('A1');
  titulo.value = 'RELATÓRIO DE AVANÇO FÍSICO · TERRAPLANAGEM';
  titulo.font = { bold: true, size: 16, color: { argb: BRANCO } };
  titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } };
  titulo.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  resumo.getRow(1).height = 34;
  resumo.mergeCells(2, 1, 2, COLS);
  resumo.getCell('A2').value = `${OBRA.nome} · posição de ${formatarData(hoje)} (previsto acumulado até o dia anterior) · emitido por ${emitidoPor || '—'}`;
  resumo.getCell('A2').font = { size: 10, color: { argb: CINZA } };
  resumo.mergeCells(3, 1, 3, COLS);
  resumo.getCell('A3').value = `Filtros: ${filtros.join(' · ') || 'nenhum (obra inteira)'}`;
  resumo.getCell('A3').font = { size: 10, italic: true, color: { argb: CINZA } };

  // Cartões de número: rótulo na linha 5, valor na linha 6 (2 colunas cada).
  const cartoes = resumoExecutivo(dados);
  const cores = [VERDE, TINTA, dados.feito < dados.previsto ? VERMELHO : VERDE, TINTA, dados.obra?.folga === undefined ? LARANJA : dados.obra.folga < 0 ? VERMELHO : VERDE, dados.atrasadas.length ? VERMELHO : VERDE];
  cartoes.forEach((cartao, i) => {
    const c = i * 2 + 1;
    resumo.mergeCells(5, c, 5, c + 1);
    resumo.mergeCells(6, c, 6, c + 1);
    const rotulo = resumo.getCell(5, c);
    const valor = resumo.getCell(6, c);
    rotulo.value = cartao.label;
    rotulo.font = { size: 9, bold: true, color: { argb: CINZA } };
    valor.value = String(cartao.value);
    valor.font = { size: String(cartao.value).length > 12 ? 12 : 16, bold: true, color: { argb: cores[i] } };
    for (const celula of [rotulo, valor, resumo.getCell(5, c + 1), resumo.getCell(6, c + 1)]) {
      celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FUNDO } };
      celula.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
    }
    rotulo.border = { top: fino, left: fino, right: fino };
    valor.border = { bottom: fino, left: fino, right: fino };
  });
  resumo.getRow(5).height = 22;
  resumo.getRow(6).height = 30;

  // Gráficos
  resumo.getCell('A8').value = 'Curva S · avanço acumulado (%)';
  resumo.getCell('H8').value = 'Avanço por frente · executado / previsto';
  resumo.getCell('A8').font = resumo.getCell('H8').font = { bold: true, size: 11, color: { argb: TINTA } };
  const larguraColuna = 96; // ~13 caracteres
  const curvaL = larguraColuna * 7 - 8;
  const curvaA = Math.round(curvaL * (300 / 640));
  resumo.addImage(livro.addImage({ base64: imagemCurvaS(dados.curva, hoje), extension: 'png' }), { tl: { col: 0, row: 8 }, ext: { width: curvaL, height: curvaA } });
  const barras = imagemAvancoPorFrente(dados.frentes);
  const barrasL = larguraColuna * 5 - 8;
  const barrasA = Math.round(barrasL * (barras.altura / barras.largura));
  resumo.addImage(livro.addImage({ base64: barras.dataUrl, extension: 'png' }), { tl: { col: 7, row: 8 }, ext: { width: barrasL, height: barrasA } });
  const linhaTabela = 9 + Math.ceil(Math.max(curvaA, barrasA) / 20) + 2;

  // Avanço por serviço, logo abaixo dos gráficos
  resumo.getCell(linhaTabela, 1).value = 'Avanço por serviço (soma das frentes)';
  resumo.getCell(linhaTabela, 1).font = { bold: true, size: 12, color: { argb: TINTA } };
  const cabecalhoServico = ['Serviço', 'Un.', 'Quantidade', 'Executado', 'Saldo', 'Avanço', 'Previsto', 'Média/dia', 'Meta/dia', 'Término plan.', 'Término proj.', 'Folga (d)'];
  const cab = resumo.getRow(linhaTabela + 1);
  cab.values = cabecalhoServico;
  pintarCabecalho(cab, COLS);
  dados.servicos.forEach((s, i) => {
    const linha = resumo.getRow(linhaTabela + 2 + i);
    linha.values = [s.servico, s.unidade, s.quantidade, s.executado, s.saldo, s.percentual / 100, s.percentualPrevisto / 100, s.meta > 0 ? s.mediaDiaria : null, s.meta > 0 ? s.meta : null, dataExcel(s.terminoPlanejado), dataExcel(s.termino), s.folga ?? 'sem ritmo'];
    pintarCorpo(linha, COLS, i % 2 === 1);
    [3, 4, 5, 8, 9].forEach(c => { linha.getCell(c).numFmt = '#,##0.0'; });
    [6, 7].forEach(c => { linha.getCell(c).numFmt = '0%'; });
    [10, 11].forEach(c => { linha.getCell(c).numFmt = 'dd/mm/yyyy'; linha.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }; });
    linha.getCell(12).font = { bold: true, size: 10, color: { argb: corFolga(s.folga) } };
    linha.getCell(12).numFmt = FORMATO_FOLGA;
  });
  if (dados.servicos.length) barraDeDados(resumo, `F${linhaTabela + 2}:F${linhaTabela + 1 + dados.servicos.length}`);
  resumo.getColumn(1).width = 24;
  resumo.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };

  // ----- Atividades (controle de produção) -----
  const atividades = livro.addWorksheet('Atividades');
  const colunasAtividade = [
    'Frente', 'Serviço', 'Encarregado', 'Est. inicial', 'Est. final', 'Extensão (m)', 'Início', 'Término plan.', 'Un.', 'Quantidade',
    'Executado', 'Saldo', 'Avanço', 'Previsto até ontem', 'Meta/dia', 'Média/dia', 'Desempenho', 'Precisa/dia', 'Término proj.', 'Folga (d)', 'Situação', 'Equipamentos',
  ];
  atividades.addRow(['']);
  atividades.addRow(['']);
  atividades.addRow(colunasAtividade);
  const ordenadas = [...dados.atividades].sort((a, b) => ordem(a.item.frente || '', b.item.frente || '') || a.item.dataInicio.localeCompare(b.item.dataInicio));
  ordenadas.forEach(a => {
    const quantidade = Number(a.item.quantidadePlanejada) || 0;
    atividades.addRow([
      a.item.frente || '', a.item.servicoDescricao, a.item.responsavel || a.item.equipeNome || '', a.item.estacaInicial || '', a.item.estacaFinal || '',
      a.ritmo.extensao ?? null, dataExcel(a.item.dataInicio), dataExcel(a.item.dataFim), a.item.unidade, quantidade,
      a.realizado, a.saldo, quantidade > 0 ? a.realizado / quantidade : 0, quantidade > 0 ? a.previsto / quantidade : 0, a.meta,
      a.ritmo.diasTrabalhados ? a.ritmo.mediaDiaria : null, a.ritmo.desempenho === undefined ? null : a.ritmo.desempenho / 100, a.precisaPorDia,
      dataExcel(a.ritmo.termino), a.ritmo.folga ?? 'sem ritmo', ROTULO_SITUACAO[a.situacao], a.item.equipamentos || '',
    ]);
  });
  styleCorporateWorksheet(atividades, { title: `Controle de produção por atividade · ${OBRA.nome}`, filters: filtros, headerRow: 3, lastColumn: colunasAtividade.length, freezeRows: 3, recordCount: ordenadas.length, autoFit: true });
  pintarCabecalho(atividades.getRow(3), colunasAtividade.length);
  atividades.views = [{ state: 'frozen', ySplit: 3, xSplit: 2 }];
  for (let r = 4; r < 4 + ordenadas.length; r += 1) {
    const linha = atividades.getRow(r);
    const a = ordenadas[r - 4];
    [6, 10, 11, 12, 15, 16, 18].forEach(c => { linha.getCell(c).numFmt = '#,##0.0'; linha.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' }; });
    [13, 14, 17].forEach(c => { linha.getCell(c).numFmt = '0%'; linha.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' }; });
    [7, 8, 19].forEach(c => { linha.getCell(c).numFmt = 'dd/mm/yyyy'; linha.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }; });
    linha.getCell(20).numFmt = FORMATO_FOLGA;
    linha.getCell(20).font = { bold: true, size: 10, color: { argb: corFolga(a.ritmo.folga) } };
    linha.getCell(20).alignment = { horizontal: 'right', vertical: 'middle' };
    if (a.situacao === 'atrasada') linha.getCell(21).font = { bold: true, size: 10, color: { argb: VERMELHO } };
  }
  if (ordenadas.length) barraDeDados(atividades, `M4:M${3 + ordenadas.length}`);

  // ----- Por frente -----
  const frentes = livro.addWorksheet('Por frente');
  const colunasFrente = ['Frente', 'Trecho (estacas)', 'Extensão (m)', 'Atividades', 'Atrasadas', 'Concluídas', 'Previsto', 'Executado', 'Desvio (pts)', 'Término plan.', 'Término proj.', 'Folga (d)'];
  frentes.addRow(['']);
  frentes.addRow(['']);
  frentes.addRow(colunasFrente);
  dados.frentes.forEach(f => frentes.addRow([
    f.frente, f.trecho, f.extensao ?? null, f.atividades, f.atrasadas, f.concluidas, f.previsto / 100, f.realizado / 100,
    Math.round(f.realizado - f.previsto), dataExcel(f.prazo?.planejado), dataExcel(f.prazo?.projetado), f.prazo?.folga ?? 'sem ritmo',
  ]));
  styleCorporateWorksheet(frentes, { title: 'Avanço por frente', filters: filtros, headerRow: 3, lastColumn: colunasFrente.length, freezeRows: 3, recordCount: dados.frentes.length, autoFit: true });
  pintarCabecalho(frentes.getRow(3), colunasFrente.length);
  for (let r = 4; r < 4 + dados.frentes.length; r += 1) {
    const linha = frentes.getRow(r);
    const f = dados.frentes[r - 4];
    linha.getCell(3).numFmt = '#,##0.0';
    [7, 8].forEach(c => { linha.getCell(c).numFmt = '0%'; });
    linha.getCell(9).numFmt = '+0" pts";-0" pts";0" pts"';
    linha.getCell(9).font = { bold: true, size: 10, color: { argb: f.realizado + 0.5 < f.previsto ? VERMELHO : VERDE } };
    [10, 11].forEach(c => { linha.getCell(c).numFmt = 'dd/mm/yyyy'; });
    linha.getCell(12).numFmt = FORMATO_FOLGA;
    linha.getCell(12).font = { bold: true, size: 10, color: { argb: corFolga(f.prazo?.folga) } };
  }
  if (dados.frentes.length) barraDeDados(frentes, `H4:H${3 + dados.frentes.length}`);

  // ----- Curva S -----
  const curva = livro.addWorksheet('Curva S');
  curva.addRow(['Dia', 'Previsto acumulado', 'Executado acumulado', 'Desvio (pts)']);
  dados.curva.forEach(ponto => curva.addRow([
    dataExcel(ponto.dia), ponto.previsto / 100, ponto.realizado === undefined ? null : ponto.realizado / 100,
    ponto.realizado === undefined ? null : Math.round((ponto.realizado - ponto.previsto) * 10) / 10,
  ]));
  styleCorporateWorksheet(curva, { title: 'Curva S', headerRow: 1, lastColumn: 4, freezeRows: 1, recordCount: dados.curva.length, autoFit: true });
  pintarCabecalho(curva.getRow(1), 4);
  for (let r = 2; r <= 1 + dados.curva.length; r += 1) {
    curva.getCell(r, 1).numFmt = 'dd/mm/yyyy';
    curva.getCell(r, 2).numFmt = '0.0%';
    curva.getCell(r, 3).numFmt = '0.0%';
    curva.getCell(r, 4).numFmt = '+0.0;-0.0;0';
  }

  // ----- Apontamentos -----
  const apontamentos = livro.addWorksheet('Apontamentos');
  apontamentos.addRow(['Data', 'Frente', 'Serviço', 'Quantidade', 'Un.', 'Lançado por', 'Observação']);
  const registros = dados.atividades
    .flatMap(a => producaoDaAtividade(a.item, producao))
    .sort((a, b) => b.data.localeCompare(a.data) || ordem(a.frente || '', b.frente || ''));
  registros.forEach(registro => apontamentos.addRow([dataExcel(registro.data), registro.frente || '', registro.servicoDescricao, Number(registro.quantidade) || 0, registro.unidade, registro.responsavel, registro.observacao || '']));
  styleCorporateWorksheet(apontamentos, { title: 'Apontamentos de produção', headerRow: 1, lastColumn: 7, freezeRows: 1, recordCount: registros.length, autoFit: true });
  pintarCabecalho(apontamentos.getRow(1), 7);
  for (let r = 2; r <= 1 + registros.length; r += 1) {
    apontamentos.getCell(r, 1).numFmt = 'dd/mm/yyyy';
    apontamentos.getCell(r, 4).numFmt = '#,##0.0';
  }

  // Colunas de data e número com largura de leitura confortável.
  for (const aba of [atividades, frentes, curva, apontamentos]) {
    aba.columns.forEach((col, i) => { col.width = Math.max(col.width ?? 10, 12); if (i === 1 && aba === atividades) col.width = Math.max(col.width ?? 0, 22); });
  }

  await downloadCorporateWorkbook(livro, `relatorio-avanco-terraplanagem-${hoje}.xlsx`);
}
