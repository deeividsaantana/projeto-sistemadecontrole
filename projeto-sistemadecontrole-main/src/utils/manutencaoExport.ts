import type { Equipamento, OrdemServico } from '../types';
import {
  addCorporateSummarySheet,
  autoFitCorporateColumns,
  configureCorporateWorkbook,
  createCorporateWorkbook,
  downloadCorporateWorkbook,
  styleCorporateWorksheet,
} from './excelCorporate';
import { calcularHorasParadas, isOrdemEncerrada } from './manutencao';
import { EQUIPMENT_FAMILY_LABELS, classifyEquipment } from './equipmentPresentation';

export interface ManutencaoExportInput {
  ordens: OrdemServico[];
  equipamentos: Equipamento[];
  /** Filtros ativos no momento da exportação, para constar no cabeçalho. */
  filtros: string[];
  periodo?: { from: string; to: string };
}

const formatarData = (valor?: string) => (valor ? valor.slice(0, 10).split('-').reverse().join('/') : '');

const COLUNAS = [
  'OS', 'Situação', 'Equipamento', 'Família', 'Tipo', 'Categoria',
  'Prioridade', 'Motivo', 'Descrição', 'Abertura', 'Hora abertura',
  'Liberação', 'Hora liberação', 'Horas paradas', 'Em curso',
  'Oficina', 'Responsável', 'Solução', 'Observação',
];

/**
 * Planilha da manutenção: uma linha por ordem, mais abas de ranking por
 * equipamento e por motivo. O horímetro de cada OS é recalculado na hora da
 * exportação — ordens abertas continuam correndo, e congelar o número no
 * arquivo seria informação vencida no momento em que alguém abrisse.
 */
export const downloadManutencaoWorkbook = async ({
  ordens,
  equipamentos,
  filtros,
  periodo,
}: ManutencaoExportInput) => {
  const workbook = await createCorporateWorkbook();
  configureCorporateWorkbook(workbook, 'Manutenção — ordens de serviço e horas paradas');

  const equipamentoPorId = new Map(equipamentos.map(item => [item.id, item]));

  const linhas = ordens.map(ordem => {
    const equipamento = equipamentoPorId.get(ordem.equipamentoId);
    const horas = calcularHorasParadas(ordem);
    const aberta = !isOrdemEncerrada(ordem.status);
    return {
      ordem,
      equipamento,
      horas,
      aberta,
      familia: EQUIPMENT_FAMILY_LABELS[classifyEquipment(equipamento)],
    };
  });

  const sheet = workbook.addWorksheet('Ordens de serviço');
  sheet.addRow(['MANUTENÇÃO — ORDENS DE SERVIÇO']);
  sheet.addRow([
    periodo
      ? `Período ${formatarData(periodo.from)} a ${formatarData(periodo.to)}`
      : 'Todas as ordens registradas',
  ]);
  sheet.addRow([]);
  sheet.addRow(COLUNAS);

  linhas.forEach(({ ordem, equipamento, horas, aberta, familia }) => {
    sheet.addRow([
      ordem.numero,
      ordem.status,
      equipamento?.prefixo || 'Frota não localizada',
      familia,
      equipamento?.tipo || '',
      equipamento?.categoriaFrota || 'Equipamento',
      ordem.prioridade,
      ordem.motivo || '',
      ordem.descricao || '',
      formatarData(ordem.dataAbertura),
      ordem.horaAbertura || '',
      formatarData(ordem.dataConclusao),
      ordem.horaConclusao || '',
      horas === undefined ? '' : Number(horas.toFixed(2)),
      aberta && horas !== undefined ? 'Sim' : 'Não',
      ordem.oficina || '',
      ordem.responsavel || '',
      ordem.solucao || '',
      ordem.observacao || '',
    ]);
  });

  styleCorporateWorksheet(sheet, {
    title: 'Ordens de serviço',
    headerRow: 4,
    lastColumn: COLUNAS.length,
    freezeRows: 4,
    filters: filtros,
    recordCount: linhas.length,
  });
  autoFitCorporateColumns(sheet);

  // Ranking por equipamento: onde a frota perdeu mais tempo no recorte atual.
  const porEquipamento = new Map<string, { prefixo: string; familia: string; horas: number; ordens: number; abertas: number }>();
  linhas.forEach(({ ordem, equipamento, horas, aberta, familia }) => {
    const chave = equipamento?.prefixo || ordem.equipamentoId || 'Sem equipamento';
    const atual = porEquipamento.get(chave) || { prefixo: chave, familia, horas: 0, ordens: 0, abertas: 0 };
    atual.horas += horas || 0;
    atual.ordens += 1;
    if (aberta) atual.abertas += 1;
    porEquipamento.set(chave, atual);
  });

  const rankingSheet = workbook.addWorksheet('Ranking por equipamento');
  rankingSheet.addRow(['HORAS PARADAS POR EQUIPAMENTO']);
  rankingSheet.addRow([]);
  rankingSheet.addRow(['Equipamento', 'Família', 'Horas paradas', 'Ordens', 'Em aberto']);
  Array.from(porEquipamento.values())
    .sort((a, b) => b.horas - a.horas)
    .forEach(item => rankingSheet.addRow([
      item.prefixo,
      item.familia,
      Number(item.horas.toFixed(2)),
      item.ordens,
      item.abertas,
    ]));
  styleCorporateWorksheet(rankingSheet, {
    title: 'Ranking por equipamento',
    headerRow: 3,
    lastColumn: 5,
    freezeRows: 3,
    recordCount: porEquipamento.size,
  });
  autoFitCorporateColumns(rankingSheet);

  // Ranking por motivo: o que mais para a frota, para atacar a causa.
  const porMotivo = new Map<string, { motivo: string; horas: number; ocorrencias: number }>();
  linhas.forEach(({ ordem, horas }) => {
    const motivo = (ordem.motivo || ordem.descricao || 'Sem motivo informado').trim();
    const atual = porMotivo.get(motivo) || { motivo, horas: 0, ocorrencias: 0 };
    atual.horas += horas || 0;
    atual.ocorrencias += 1;
    porMotivo.set(motivo, atual);
  });

  const motivoSheet = workbook.addWorksheet('Ranking por motivo');
  motivoSheet.addRow(['HORAS PARADAS POR MOTIVO']);
  motivoSheet.addRow([]);
  motivoSheet.addRow(['Motivo', 'Ocorrências', 'Horas paradas']);
  Array.from(porMotivo.values())
    .sort((a, b) => b.horas - a.horas)
    .forEach(item => motivoSheet.addRow([item.motivo, item.ocorrencias, Number(item.horas.toFixed(2))]));
  styleCorporateWorksheet(motivoSheet, {
    title: 'Ranking por motivo',
    headerRow: 3,
    lastColumn: 3,
    freezeRows: 3,
    recordCount: porMotivo.size,
  });
  autoFitCorporateColumns(motivoSheet);

  const totalHoras = linhas.reduce((soma, item) => soma + (item.horas || 0), 0);
  const abertas = linhas.filter(item => item.aberta).length;
  addCorporateSummarySheet(
    workbook,
    'Manutenção — ordens de serviço e horas paradas',
    [
      ['Ordens no recorte', linhas.length],
      ['Ordens em aberto', abertas],
      ['Ordens encerradas', linhas.length - abertas],
      ['Horas paradas acumuladas', Number(totalHoras.toFixed(2))],
      ['Equipamentos envolvidos', porEquipamento.size],
      ['Motivos distintos', porMotivo.size],
    ],
    filtros,
  );

  const carimbo = new Date().toISOString().slice(0, 10);
  await downloadCorporateWorkbook(workbook, `MANUTENCAO_${carimbo}.xlsx`);
};
