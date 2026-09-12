/**
 * Central de relatórios. Cada relatório é leitura montada na hora pelas mesmas
 * funções das telas dos módulos — por isso nunca mostra número diferente do que
 * o módulo mostra. Exporta em Excel pelo formato corporativo já usado no
 * sistema, carregado só quando alguém exporta de fato.
 */
import { useMemo, useState } from 'react';
import { Download, FileBarChart, FileText, Printer } from 'lucide-react';
import { montarRelatorios, type ContextoRelatorios, type Relatorio } from '../utils/relatorios';
import { EmptyState, PageHeader, PeriodFilter, TableBody, TableHead, TableShell, buildPeriod, type PeriodValue } from '../shared/ui';

interface RelatoriosTabProps {
  dados: Omit<ContextoRelatorios, 'hoje' | 'inicio' | 'fim'>;
}

const somarDias = (data: string, dias: number) => {
  const base = new Date(`${data}T00:00:00`);
  base.setDate(base.getDate() + dias);
  return base.toISOString().slice(0, 10);
};

const diasEntre = (inicio: string, fim: string) =>
  Math.round((new Date(`${fim}T00:00:00`).getTime() - new Date(`${inicio}T00:00:00`).getTime()) / 86_400_000) + 1;

export default function RelatoriosTab({ dados }: RelatoriosTabProps) {
  const [period, setPeriod] = useState<PeriodValue>(() => buildPeriod('mes'));
  const [selecionado, setSelecionado] = useState('producao-por-servico');
  const [exportando, setExportando] = useState(false);
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [erro, setErro] = useState('');

  const relatorios = useMemo(() => {
    const dias = diasEntre(period.from, period.to);
    return montarRelatorios({
      ...dados,
      hoje: new Date().toISOString().slice(0, 10),
      inicio: period.from,
      fim: period.to,
      inicioAnterior: somarDias(period.from, -dias),
      fimAnterior: somarDias(period.from, -1),
    });
  }, [dados, period.from, period.to]);

  const relatorio: Relatorio = relatorios.find(item => item.id === selecionado) || relatorios[0];

  const exportar = async () => {
    setExportando(true);
    setErro('');
    try {
      const {
        addCorporateSummarySheet,
        configureCorporateWorkbook,
        createCorporateWorkbook,
        downloadCorporateWorkbook,
        styleCorporateWorksheet,
      } = await import('../utils/excelCorporate');
      const workbook = await createCorporateWorkbook();
      configureCorporateWorkbook(workbook, relatorio.titulo);
      const planilha = workbook.addWorksheet(relatorio.titulo.slice(0, 30));
      planilha.addRow(relatorio.colunas);
      relatorio.linhas.forEach(linha => planilha.addRow(linha));
      styleCorporateWorksheet(planilha, {
        title: relatorio.titulo,
        headerRow: 1,
        lastColumn: relatorio.colunas.length,
      });
      addCorporateSummarySheet(
        workbook,
        relatorio.titulo,
        [['Linhas', relatorio.linhas.length], ['Período', `${period.from} a ${period.to}`]],
        [relatorio.descricao],
      );
      await downloadCorporateWorkbook(workbook, `${relatorio.id}-${period.from}-a-${period.to}`);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível gerar a planilha.');
    } finally {
      setExportando(false);
    }
  };

  const exportarPdf = async () => {
    setExportandoPdf(true);
    setErro('');
    try {
      const { generateUniversalPdfReport } = await import('../utils/universalPdfReport');
      const columns = relatorio.colunas.map((header, index) => ({ header, dataKey: `coluna_${index}` }));
      await generateUniversalPdfReport({
        title: relatorio.titulo,
        subtitle: relatorio.descricao,
        columns,
        rows: relatorio.linhas.map(linha => Object.fromEntries(linha.map((valor, index) => [`coluna_${index}`, valor]))),
        work: 'Rodoanel Complexo do Alto Tietê · Alça',
        period: `${period.from.split('-').reverse().join('/')} a ${period.to.split('-').reverse().join('/')}`,
        filters: [`Período: ${period.from} a ${period.to}`],
        summary: [
          { label: 'Linhas', value: relatorio.linhas.length },
          { label: 'Relatório', value: relatorio.titulo },
        ],
      });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível gerar o PDF.');
    } finally {
      setExportandoPdf(false);
    }
  };

  return (
    <div id="relatorios-tab" className="reports-workspace min-h-full w-full px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Relatórios"
        description="Leitura consolidada dos módulos, com os mesmos números das telas de origem."
        actions={(
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <PeriodFilter value={period} onChange={setPeriod} />
            <button
              type="button"
              onClick={() => void exportarPdf()}
              disabled={exportandoPdf || relatorio.linhas.length === 0}
              className="reports-export-pdf inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-emerald-700 bg-white px-3 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-50 disabled:opacity-50"
            >
              <FileText className="h-4 w-4" /> {exportandoPdf ? 'Gerando…' : 'PDF'}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700"
            >
              <Printer className="h-4 w-4" /> Imprimir
            </button>
            <button
              type="button"
              onClick={() => void exportar()}
              disabled={exportando || relatorio.linhas.length === 0}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-800 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> {exportando ? 'Gerando…' : 'Excel'}
            </button>
          </div>
        )}
      />

      <section className="reports-command mt-4 print:hidden" aria-label="Escolha do relatório">
        <div>
          <span>Biblioteca de relatórios</span>
          <strong>{relatorios.length} leituras disponíveis</strong>
        </div>
        <p>Os números são montados a partir dos registros operacionais, sem bases paralelas.</p>
      </section>

      <div className="reports-catalog mt-3 flex flex-wrap gap-1.5 print:hidden">
        {relatorios.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelecionado(item.id)}
            aria-pressed={item.id === relatorio.id}
            className={`min-h-10 rounded-lg border px-3 text-xs font-bold transition-colors ${item.id === relatorio.id
              ? 'border-emerald-600 bg-emerald-700 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-400'}`}
          >
            {item.titulo}
          </button>
        ))}
      </div>

      <section className="reports-preview mt-4 rounded-lg border border-slate-200 bg-white">
        <header className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-800">{relatorio.titulo}</h2>
          <p className="text-[11px] text-slate-500">
            {relatorio.descricao} · {period.from.split('-').reverse().join('/')} a {period.to.split('-').reverse().join('/')} · {relatorio.linhas.length} linha(s)
          </p>
        </header>
        {relatorio.linhas.length === 0 ? (
          <EmptyState icon={FileBarChart} title="Sem dados no período" description="Ajuste o período ou registre as informações no módulo de origem." />
        ) : (
          <TableShell minWidth={Math.max(720, relatorio.colunas.length * 150)}>
            <TableHead>
              <tr>
                {relatorio.colunas.map(coluna => <th key={coluna} className="p-3">{coluna}</th>)}
              </tr>
            </TableHead>
            <TableBody>
              {relatorio.linhas.map((linha, indice) => (
                <tr key={`${relatorio.id}-${indice}`} className="transition-colors hover:bg-slate-50">
                  {linha.map((celula, coluna) => (
                    <td key={`${relatorio.colunas[coluna]}`} className={`p-3 ${coluna === 0 ? 'font-bold text-slate-800' : typeof celula === 'number' ? 'font-mono text-slate-700' : 'text-slate-600'}`}>
                      {typeof celula === 'number' ? celula.toLocaleString('pt-BR', { maximumFractionDigits: 3 }) : celula}
                    </td>
                  ))}
                </tr>
              ))}
            </TableBody>
          </TableShell>
        )}
      </section>

      {erro && <p className="mt-2 text-xs font-bold text-rose-700">{erro}</p>}
    </div>
  );
}
