import React, { useState } from 'react';
import ExcelJS from 'exceljs';
import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import type {
  ControleEstacas, Equipamento, MaterialRegistro,
  PresencaApontamento, TicketJazida,
} from '../types';
import { buildStakeSummary } from '../utils/stakeOperations';
import { generateUniversalPdfReport } from '../utils/universalPdfReport';

type Props = {
  tickets: TicketJazida[];
  estacas: ControleEstacas;
  materiais: MaterialRegistro[];
  presencas: PresencaApontamento[];
  equipamentos: Equipamento[];
};

const downloadBlob = (content: BlobPart, type: string, filename: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export default function ErpReportExportsV28({ tickets, estacas, materiais, presencas, equipamentos }: Props) {
  const [exporting, setExporting] = useState(false);
  const exportExcel = async () => {
    setExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Sistema RENEA ERP 3.0';
      const addSheet = (name: string, headers: string[], rows: unknown[][]) => {
        const sheet = workbook.addWorksheet(name);
        sheet.addRow(headers);
        rows.forEach(row => sheet.addRow(row));
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
        sheet.views = [{ state: 'frozen', ySplit: 1 }];
        sheet.columns.forEach(column => { column.width = 20; });
        return sheet;
      };
      addSheet('Estacas - Lotes', ['Data', 'NF', 'Código', 'Descrição', 'Perfil', 'Comprimento m', 'Peso kg', 'Valor', 'Status NF'], estacas.lotes.map(item => [item.data, item.notaFiscal, item.materialCodigo, item.descricao, item.perfilModelo, item.comprimentoM, item.pesoKg, item.valorTotal, item.nfConferida ? 'Conferida' : 'Pendente']));
      addSheet('Estacas - Cravações', ['Data', 'Item', 'Identificação', 'Perfil', 'Comprimento m', 'Cravado m', 'Sobra m', 'Perda m', 'Lote'], estacas.cravacoes.map(item => [item.data, item.item, item.identificacao, item.perfil, item.comprimentoM, item.comprimentoCravadoM, item.sobraM, item.perdaM, item.loteId || 'Pendente']));
      addSheet('Materiais', ['Data', 'Material', 'Unidade', 'Quantidade', 'Fornecedor', 'Placa', 'Nota', 'Destino', 'Valor unitário', 'Total'], materiais.map(item => [item.data, item.material, item.unidade, item.quantidade, item.fornecedor, item.placa, item.nota, item.destino, item.valorUnitario, item.total]));
      addSheet('Relatório Comercial', ['Data do descarte', 'Placa', 'Aut. descarte', 'Nº vale', 'Peso/Volume', 'Valor R$', 'Material', 'Pagamento'], tickets.map(item => [item.data, item.placa, item.notaFiscalNumero || item.ticketNumero, item.ticketNumero, item.quantidadeM3, 0, item.tipoMaterial, 'VENDA A PRAZO']));
      addSheet('Efetivo', ['Data', 'Grupo', 'Colaborador', 'Função', 'Status', 'Responsável', 'Frente'], presencas.map(item => [item.data, item.grupoNome, item.funcionarioNome, item.funcao, item.status, item.responsavel, item.frenteServico]));
      addSheet('Equipamentos', ['Prefixo', 'Equipamento', 'Tipo', 'Empresa', 'Local', 'Status'], equipamentos.map(item => [item.prefixo, item.nome, item.tipo, item.empresaId, item.localAtualId, item.status]));
      downloadBlob(await workbook.xlsx.writeBuffer() as unknown as BlobPart, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `RENEA_ERP_3_RELATORIOS_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  const exportCommercialCsv = () => {
    const rows = [
      ['Data do Descarte', 'Placa', 'Aut. Descarte', 'Nº Vale', 'Peso/Volume', 'Material', 'Pagamento'],
      ...tickets.map(item => [item.data, item.placa, item.notaFiscalNumero || item.ticketNumero, item.ticketNumero, item.quantidadeM3, item.tipoMaterial, 'VENDA A PRAZO']),
    ];
    downloadBlob(`\uFEFF${rows.map(row => row.map(csvCell).join(';')).join('\n')}`, 'text/csv;charset=utf-8', `RELATORIO_COMERCIAL_RENEA_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportPdf = async () => {
    const stake = buildStakeSummary(estacas);
    await generateUniversalPdfReport({
      title: 'Fechamento Executivo', subtitle: 'Visão consolidada dos módulos operacionais',
      columns: [{ header: 'Indicador', dataKey: 'indicador' }, { header: 'Resultado', dataKey: 'resultado' }],
      rows: [
        ['Viagens / tickets', tickets.length], ['Materiais', materiais.length], ['Efetivo presente', presencas.filter(item => item.status === 'Presente').length],
        ['Equipamentos', equipamentos.length], ['Estacas recebidas', `${stake.recebidoM.toLocaleString('pt-BR')} m`],
        ['Estacas cravadas', `${stake.cravadoM.toLocaleString('pt-BR')} m`], ['Saldo de estacas', `${stake.sobraM.toLocaleString('pt-BR')} m`], ['Notas fiscais pendentes', stake.notasPendentes],
      ].map(([indicador, resultado]) => ({ indicador, resultado })),
      summary: [{ label: 'Módulos consolidados', value: 5 }, { label: 'Registros operacionais', value: tickets.length + materiais.length + presencas.length }],
      fileName: `RENEA_FECHAMENTO_${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 print:hidden">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div><h3 className="text-sm font-black text-white">Pacote integrado de exportações</h3><p className="text-[10px] text-slate-500">Planilhas por módulo, fechamento PDF, comercial CSV e impressão.</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={exporting} onClick={() => void exportExcel()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white"><FileSpreadsheet className="h-4 w-4" /> {exporting ? 'Gerando...' : 'Excel integrado'}</button>
          <button type="button" onClick={exportCommercialCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-black text-slate-200"><Download className="h-4 w-4" /> Comercial CSV</button>
          <button type="button" onClick={exportPdf} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-black text-slate-200">PDF executivo</button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-black text-slate-200"><Printer className="h-4 w-4" /> Imprimir</button>
        </div>
      </div>
    </section>
  );
}
