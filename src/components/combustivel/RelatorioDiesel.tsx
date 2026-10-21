/**
 * Combustível > Relatórios: quanto diesel saiu no período, como foi dia a
 * dia, quem mais abasteceu e o que precisa de conferência. Tudo é clicável:
 * o dia, a máquina, o comboio, a empresa e os alertas abrem a lista já
 * filtrada. O consumo em L/h e km/L fica na parte "Consumo por máquina".
 * Escolhendo uma empresa, tudo passa a mostrar só as máquinas dela, e o PDF
 * sai no modelo do e-mail de fornecimento para a empresa conferir.
 */
import { useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Building2, CalendarDays, CopyX, Download, FileText, Fuel, Gauge, HelpCircle, Truck } from 'lucide-react';
import type { Abastecimento, Comboio, Empresa, Equipamento, TipoCombustivel } from '../../types';
import { abaDoDia, abasDoHistorico, intervaloDaAba } from '../../modules/frota/historicoCombustivel';
import { getFuelCompetencePeriodLabel } from '../../modules/frota/fuelReport';
import { nomeDoMes } from '../../modules/frota/planilhaDiesel';
import { montarFornecimento, montarRelatorioDiesel, type LinhaRelatorio } from '../../modules/frota/relatorioDiesel';
import { CountUp, isoDay } from '../../shared/ui';
import { BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, reduzMovimento } from '../cadastros/estilos';
import ConsumoPorMaquina from './ConsumoPorMaquina';
import type { PedidoFiltro } from './HistoricoCombustivel';

export type ParteRelatorio = 'resumo' | 'consumo';

interface Props {
  abastecimentos: Abastecimento[];
  equipamentos: Equipamento[];
  empresas: Empresa[];
  comboios: Comboio[];
  /** Dá o nome do combustível no título do PDF (ex.: Diesel S10). */
  combustiveis?: TipoCombustivel[];
  parteInicial?: ParteRelatorio;
  /** Abre a lista de lançamentos com esse filtro. */
  onAbrirLista: (pedido: Omit<PedidoFiltro, 'chave'>) => void;
  onErro: (mensagem: string) => void;
  onAviso: (mensagem: string) => void;
}

const SETE_DIAS = '7d';
const TRINTA_DIAS = '30d';
const VERDE = '#176b4d';

const litrosTexto = (valor: number) => `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L`;
const litrosExatos = (valor: number) => `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`;
const numeroTexto = (valor?: number) => (valor === undefined ? '' : valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 }));
const semAcento = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
const dataCurta = (dia: string) => (dia ? new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR') : '');
const diaSemana = (dia: string) => new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
/** "2026-11" vira "Novembro". */
const mesCurto = (mes: string) => { const nome = nomeDoMes(mes).split(' ')[0]; return `${nome.charAt(0)}${nome.slice(1).toLowerCase()}`; };
const voltarDias = (dia: string, dias: number) => {
  const data = new Date(`${dia}T12:00:00`);
  data.setDate(data.getDate() - dias);
  return isoDay(data);
};
/** Teto redondo do gráfico (100, 200, 500, 1.000...), para as linhas de grade caírem em números fáceis. */
const tetoRedondo = (valor: number) => {
  if (valor <= 0) return 100;
  const base = 10 ** Math.floor(Math.log10(valor));
  return [1, 2, 2.5, 5, 10].map(passo => passo * base).find(teto => teto >= valor) ?? valor;
};

export default function RelatorioDiesel({ abastecimentos, equipamentos, empresas, comboios, combustiveis = [], parteInicial = 'resumo', onAbrirLista, onErro, onAviso }: Props) {
  const escopo = useRef<HTMLDivElement>(null);
  const hoje = isoDay(new Date());
  const [parte, setParte] = useState<ParteRelatorio>(parteInicial);
  const meses = useMemo(() => abasDoHistorico(abastecimentos, hoje).reverse(), [abastecimentos, hoje]);
  // Abre no mês do diesel; no começo do mês, ainda sem abastecimento, abre nos últimos 30 dias.
  const [periodo, setPeriodo] = useState(() => (abastecimentos.some(item => item.data && abaDoDia(item.data) === abaDoDia(hoje)) ? abaDoDia(hoje) : TRINTA_DIAS));
  const [exportando, setExportando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  /** Empresa escolhida; vazio = todas. */
  const [empresaId, setEmpresaId] = useState('');
  const empresaDe = useMemo(() => new Map(equipamentos.map(item => [item.id, item.empresaId])), [equipamentos]);
  /** Só as empresas que têm máquina com abastecimento, em ordem de nome. */
  const empresasComDiesel = useMemo(() => {
    const ids = new Set(abastecimentos.map(item => empresaDe.get(item.equipamentoId)).filter(Boolean));
    return empresas.filter(item => ids.has(item.id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [abastecimentos, empresaDe, empresas]);
  const registros = useMemo(
    () => (empresaId ? abastecimentos.filter(item => empresaDe.get(item.equipamentoId) === empresaId) : abastecimentos),
    [abastecimentos, empresaDe, empresaId],
  );

  const intervalo = useMemo(() => {
    if (periodo === SETE_DIAS) return { dataInicio: voltarDias(hoje, 6), dataFim: hoje };
    if (periodo === TRINTA_DIAS) return { dataInicio: voltarDias(hoje, 29), dataFim: hoje };
    return intervaloDaAba(periodo);
  }, [hoje, periodo]);

  const relatorio = useMemo(() => montarRelatorioDiesel({
    registros, equipamentos, empresas, comboios, inicio: intervalo.dataInicio, fim: intervalo.dataFim, hoje,
  }), [registros, comboios, empresas, equipamentos, hoje, intervalo]);

  const rotuloPeriodo = periodo === SETE_DIAS ? 'Últimos 7 dias' : periodo === TRINTA_DIAS ? 'Últimos 30 dias' : nomeDoMes(periodo);
  const doPeriodo = { dataInicio: relatorio.inicio, dataFim: relatorio.fim };

  useGSAP(() => {
    if (reduzMovimento() || parte !== 'resumo') return;
    gsap.fromTo('[data-barra-dia]', { scaleY: 0 }, { scaleY: 1, duration: 0.5, stagger: 0.012, ease: 'power3.out', transformOrigin: 'bottom', clearProps: 'transform' });
    gsap.fromTo('[data-barra-ranking]', { scaleX: 0 }, { scaleX: 1, duration: 0.55, stagger: 0.03, ease: 'power3.out', transformOrigin: 'left', clearProps: 'transform' });
  }, { scope: escopo, dependencies: [periodo, parte, empresaId] });

  const exportar = async () => {
    setExportando(true);
    try {
      const { configureCorporateWorkbook, createCorporateWorkbook, downloadCorporateWorkbook } = await import('../../utils/excelCorporate');
      const workbook = await createCorporateWorkbook();
      configureCorporateWorkbook(workbook, 'Relatório do diesel');
      const resumo = workbook.addWorksheet('Resumo');
      resumo.columns = [{ header: 'Item', key: 'item', width: 34 }, { header: 'Valor', key: 'valor', width: 22 }];
      [
        ['Empresa', empresas.find(item => item.id === empresaId)?.nome || 'Todas as empresas'],
        ['Período', `${rotuloPeriodo} (${dataCurta(relatorio.inicio)} a ${dataCurta(relatorio.fim)})`],
        ['Litros', relatorio.litros], ['Lançamentos', relatorio.lancamentos], ['Máquinas', relatorio.maquinas],
        ['Média por dia (L)', Math.round(relatorio.mediaPorDia)],
        ['Maior dia', relatorio.maiorDia ? `${dataCurta(relatorio.maiorDia.dia)} (${Math.round(relatorio.maiorDia.litros)} L)` : '—'],
        [`Período anterior (${dataCurta(relatorio.anterior.inicio)} a ${dataCurta(relatorio.anterior.fim)})`, relatorio.anterior.litros],
        ['Variação', relatorio.variacao === undefined ? '—' : `${Math.round(relatorio.variacao * 100)}%`],
        ['Lançamentos repetidos', relatorio.repetidos], ['A conferir', relatorio.aConferir], ['Sem cadastro', relatorio.semCadastro],
      ].forEach(([item, valor]) => resumo.addRow({ item, valor }));
      const porDia = workbook.addWorksheet('Por dia');
      porDia.columns = [{ header: 'Data', key: 'dia', width: 13 }, { header: 'Litros', key: 'litros', width: 12 }, { header: 'Lançamentos', key: 'lancamentos', width: 13 }];
      relatorio.porDia.forEach(dia => porDia.addRow({ ...dia, dia: dataCurta(dia.dia) }));
      const quebras: Array<[string, LinhaRelatorio[], string]> = [['Por máquina', relatorio.porMaquina, 'Prefixo'], ['Por comboio', relatorio.porComboio, 'Comboio'], ['Por empresa', relatorio.porEmpresa, 'Empresa']];
      quebras.forEach(([nome, linhas, rotulo]) => {
        const folha = workbook.addWorksheet(nome);
        folha.columns = [
          { header: rotulo, key: 'rotulo', width: 24 }, { header: 'Detalhe', key: 'detalhe', width: 36 },
          { header: 'Litros', key: 'litros', width: 12 }, { header: 'Lançamentos', key: 'lancamentos', width: 13 }, { header: '% do total', key: 'parte', width: 11 },
        ];
        linhas.forEach(linha => folha.addRow({ ...linha, parte: relatorio.litros ? Math.round((linha.litros / relatorio.litros) * 1000) / 10 : 0 }));
      });
      workbook.worksheets.forEach(folha => { folha.getRow(1).font = { bold: true }; folha.views = [{ state: 'frozen', ySplit: 1 }]; });
      await downloadCorporateWorkbook(workbook, `RELATORIO DIESEL - ${rotuloPeriodo} - ${hoje}.xlsx`);
      onAviso('Relatório exportado para Excel.');
    } catch (falha) {
      onErro(falha instanceof Error ? `Falha ao exportar: ${falha.message}` : 'Falha ao exportar.');
    } finally {
      setExportando(false);
    }
  };

  /** PDF no modelo do e-mail de fornecimento: resumo por data e total por equipamento. */
  const gerarPdf = async () => {
    setGerandoPdf(true);
    try {
      const fim = relatorio.fim > hoje ? hoje : relatorio.fim;
      const f = montarFornecimento({ registros: abastecimentos, equipamentos, empresas, comboios, combustiveis, inicio: relatorio.inicio, fim, empresaId });
      const periodoTexto = `${dataCurta(f.inicio)} a ${dataCurta(f.fim)}`;
      const { generateUniversalPdfReport } = await import('../../utils/universalPdfReport');
      await generateUniversalPdfReport({
        title: `Fornecimento de ${f.combustivel}`,
        subtitle: `${f.empresa} · ${rotuloPeriodo}`,
        orientation: 'landscape',
        period: periodoTexto,
        filters: [`Empresa: ${f.empresa}`],
        summary: [
          { label: 'Total fornecido', value: litrosExatos(f.litros) },
          { label: 'Lançamentos', value: f.lancamentos },
          { label: 'Equipamentos', value: f.porEquipamento.length },
          { label: 'Período', value: periodoTexto },
        ],
        columns: [
          { header: 'Data', dataKey: 'data' }, { header: 'Hora', dataKey: 'hora' }, { header: 'Prefixo', dataKey: 'prefixo' },
          { header: 'Descrição do equipamento', dataKey: 'descricao' }, { header: 'Comboio', dataKey: 'comboio' },
          { header: 'Horímetro / KM', dataKey: 'leitura' }, { header: 'Bomba inicial', dataKey: 'bombaInicial' },
          { header: 'Bomba final', dataKey: 'bombaFinal' }, { header: 'Diesel fornecido', dataKey: 'litros' },
        ],
        rows: f.linhas.map(linha => ({
          ...linha,
          data: dataCurta(linha.data),
          leitura: linha.horimetro !== undefined ? `${numeroTexto(linha.horimetro)} h` : linha.km !== undefined ? `${numeroTexto(linha.km)} km` : '',
          bombaInicial: numeroTexto(linha.bombaInicial),
          bombaFinal: numeroTexto(linha.bombaFinal),
          litros: litrosExatos(linha.litros),
        })),
        totalRow: { data: 'Total do período', litros: litrosExatos(f.litros) },
        sections: [{
          title: 'Total por equipamento',
          columns: [
            { header: 'Prefixo', dataKey: 'prefixo' }, { header: 'Equipamento', dataKey: 'descricao' },
            { header: 'Abastecimentos', dataKey: 'abastecimentos' }, { header: 'Diesel fornecido', dataKey: 'litros' },
          ],
          rows: f.porEquipamento.map(item => ({ ...item, litros: litrosExatos(item.litros) })),
          totalRow: { prefixo: 'Total', abastecimentos: f.lancamentos, litros: litrosExatos(f.litros) },
        }],
        fileName: `Fornecimento diesel - ${semAcento(f.empresa).replace(/[^\w .-]+/g, '')} - ${f.inicio} a ${f.fim}.pdf`,
      });
      onAviso(`PDF de ${f.empresa} gerado: ${f.lancamentos} lançamento(s), ${litrosExatos(f.litros)}.`);
    } catch (falha) {
      onErro(falha instanceof Error ? `Falha ao gerar o PDF: ${falha.message}` : 'Falha ao gerar o PDF.');
    } finally {
      setGerandoPdf(false);
    }
  };

  const partes = [['resumo', 'Resumo', BarChart3], ['consumo', 'Consumo por máquina', Gauge]] as const;

  return (
    <div ref={escopo} className="flex min-h-0 flex-1 flex-col gap-2" data-testid="combustivel-relatorios">
      <div data-comb-reveal className="flex shrink-0 flex-wrap items-center gap-2">
        <nav aria-label="Parte do relatório" className="grid w-full grid-cols-2 gap-1 sm:w-auto rounded-xl bg-white p-1 ring-1 ring-inset ring-slate-200">
          {partes.map(([id, rotulo, Icone]) => (
            <button key={id} type="button" aria-pressed={parte === id} onClick={() => setParte(id)} data-testid={`relatorio-parte-${id}`}
              className={`inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-bold transition ${parte === id ? 'bg-[#176b4d] text-white shadow-sm' : 'text-slate-600 hover:bg-[#f7f8f6] hover:text-slate-900'} ${FOCO}`}>
              <Icone className="size-4 shrink-0" aria-hidden="true" />{id === 'consumo' ? <><span className="sm:hidden">Por máquina</span><span className="hidden sm:inline">{rotulo}</span></> : rotulo}
            </button>
          ))}
        </nav>
        {parte === 'resumo' && <>
          <div role="group" aria-label="Período" className="flex min-w-0 flex-wrap items-center gap-1">
            {[[SETE_DIAS, '7 dias'], [TRINTA_DIAS, '30 dias'], ...meses.slice(0, 3).map(mes => [mes, mesCurto(mes)])].map(([id, rotulo]) => (
              <button key={id} type="button" aria-pressed={periodo === id} onClick={() => setPeriodo(id)} data-testid={`relatorio-periodo-${id}`}
                title={/^\d{4}-\d{2}$/.test(id) ? `${nomeDoMes(id)}: ${getFuelCompetencePeriodLabel(id)}` : undefined}
                className={`min-h-9 whitespace-nowrap rounded-lg px-3 text-sm font-bold ring-1 ring-inset transition ${periodo === id ? 'bg-[#e8f2ed] text-[#176b4d] ring-[#176b4d]/40' : 'bg-white text-slate-600 ring-slate-200 hover:text-slate-900'} ${FOCO}`}>
                {rotulo}
              </button>
            ))}
            {meses.length > 3 && (
              <select aria-label="Outro mês" value={meses.slice(3).includes(periodo) ? periodo : ''} onChange={event => event.target.value && setPeriodo(event.target.value)} className={`${CAMPO} !min-h-9 !w-auto !py-0 !text-sm`} data-testid="relatorio-outro-mes">
                <option value="">Outro mês…</option>
                {meses.slice(3).map(mes => <option key={mes} value={mes}>{nomeDoMes(mes)}</option>)}
              </select>
            )}
          </div>
          <label className="flex min-w-0 items-center gap-1.5">
            <Building2 className="size-4 shrink-0 text-[#176b4d]" aria-hidden="true" />
            <span className="sr-only">Empresa</span>
            <select value={empresaId} onChange={event => setEmpresaId(event.target.value)} className={`${CAMPO} !min-h-9 !w-auto max-w-[14rem] !py-0 !text-sm font-semibold ${empresaId ? '!border-[#176b4d] text-[#176b4d]' : ''}`} data-testid="relatorio-empresa">
              <option value="">Todas as empresas</option>
              {empresasComDiesel.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <span className="ml-auto flex gap-1.5">
            <button type="button" onClick={() => void gerarPdf()} disabled={gerandoPdf || !relatorio.lancamentos} title="PDF no modelo do e-mail de fornecimento" className={`${BOTAO_SECUNDARIO} min-h-9 px-3`} data-testid="relatorio-pdf">
              <FileText className="size-4" aria-hidden="true" />{gerandoPdf ? 'Gerando…' : 'PDF'}
            </button>
            <button type="button" onClick={() => void exportar()} disabled={exportando || !relatorio.lancamentos} className={`${BOTAO_SECUNDARIO} min-h-9 px-3`} data-testid="relatorio-excel">
              <Download className="size-4" aria-hidden="true" />{exportando ? 'Gerando…' : 'Excel'}
            </button>
          </span>
        </>}
      </div>

      {parte === 'consumo'
        ? <ConsumoPorMaquina abastecimentos={abastecimentos} equipamentos={equipamentos} empresas={empresas} onErro={onErro} onAviso={onAviso} />
        : (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-2">
            <p className="flex items-center gap-1.5 px-1 text-sm font-semibold text-slate-600">
              <CalendarDays className="size-4 text-[#176b4d]" aria-hidden="true" />
              {rotuloPeriodo}: {dataCurta(relatorio.inicio)} a {dataCurta(relatorio.fim)}
              {empresaId && <span className="max-w-[12rem] truncate whitespace-nowrap rounded-full bg-[#e8f2ed] px-2 py-0.5 text-xs font-bold text-[#176b4d]" data-testid="relatorio-empresa-ativa">{empresas.find(item => item.id === empresaId)?.nome}</span>}
            </p>

            <section aria-label="Números do período" className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="relatorio-numeros">
              <div data-comb-reveal className={`${CARTAO} px-4 py-3`}>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500"><Fuel className="size-3.5" aria-hidden="true" />Litros</p>
                <p className="text-2xl font-black tabular-nums text-slate-950"><CountUp value={relatorio.litros} suffix=" L" /></p>
                <Variacao valor={relatorio.variacao} anterior={relatorio.anterior.litros} />
              </div>
              <div data-comb-reveal className={`${CARTAO} px-4 py-3`}>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500"><BarChart3 className="size-3.5" aria-hidden="true" />Média por dia</p>
                <p className="text-2xl font-black tabular-nums text-slate-950"><CountUp value={relatorio.mediaPorDia} suffix=" L" /></p>
                <p className="text-xs font-semibold text-slate-500">{relatorio.maiorDia ? `Maior: ${dataCurta(relatorio.maiorDia.dia)}, ${litrosTexto(relatorio.maiorDia.litros)}` : 'Nenhum abastecimento'}</p>
              </div>
              <div data-comb-reveal className={`${CARTAO} px-4 py-3`}>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500"><Truck className="size-3.5" aria-hidden="true" />Lançamentos</p>
                <p className="text-2xl font-black tabular-nums text-slate-950"><CountUp value={relatorio.lancamentos} /></p>
                <p className="text-xs font-semibold text-slate-500">{relatorio.maquinas} máquina(s), {relatorio.diasComAbastecimento} dia(s) com diesel</p>
              </div>
              <div data-comb-reveal className={`${CARTAO} px-3 py-2`}>
                <p className="flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wide text-slate-500"><AlertTriangle className="size-3.5" aria-hidden="true" />Para conferir</p>
                <ul className="mt-1 space-y-0.5 text-sm font-semibold">
                  <Alerta icone={CopyX} rotulo="Repetidos" valor={relatorio.repetidos} testid="relatorio-alerta-repetidos" onAbrir={() => onAbrirLista({ ...doPeriodo, soRepetidos: true })} />
                  <Alerta icone={AlertTriangle} rotulo="A conferir" valor={relatorio.aConferir} testid="relatorio-alerta-conferir" onAbrir={() => onAbrirLista({ ...doPeriodo, soConferir: true })} />
                  <Alerta icone={HelpCircle} rotulo="Sem cadastro" valor={relatorio.semCadastro} testid="relatorio-alerta-sem-cadastro" />
                </ul>
              </div>
            </section>

            <GraficoPorDia relatorio={relatorio} hoje={hoje} onAbrirDia={dia => onAbrirLista({ dataInicio: dia, dataFim: dia })} />

            <div className="grid min-w-0 gap-2 lg:grid-cols-3">
              <Ranking titulo="Máquinas que mais abasteceram" linhas={relatorio.porMaquina} total={relatorio.litros} testid="relatorio-maquinas" onAbrir={linha => onAbrirLista({ ...doPeriodo, ...linha.filtro })} />
              <Ranking titulo="Por comboio" linhas={relatorio.porComboio} total={relatorio.litros} testid="relatorio-comboios" onAbrir={linha => onAbrirLista({ ...doPeriodo, ...linha.filtro })} />
              <Ranking titulo="Por empresa" linhas={relatorio.porEmpresa} total={relatorio.litros} testid="relatorio-empresas" dica={empresaId ? undefined : 'Mostrar o relatório só dessa empresa'} onAbrir={linha => (linha.filtro.empresaId && !empresaId ? setEmpresaId(linha.filtro.empresaId) : onAbrirLista({ ...doPeriodo, ...linha.filtro }))} />
            </div>
          </div>
        )}
    </div>
  );
}

function Variacao({ valor, anterior }: { valor?: number; anterior: number }) {
  if (valor === undefined) return <p className="text-xs font-semibold text-slate-500">Sem período anterior para comparar</p>;
  const subiu = valor >= 0;
  const Seta = subiu ? ArrowUpRight : ArrowDownRight;
  return (
    <p className="flex items-start gap-1 text-xs font-semibold text-slate-600" data-testid="relatorio-variacao">
      <Seta className={`mt-px size-3.5 shrink-0 ${subiu ? 'text-orange-700' : 'text-emerald-700'}`} aria-hidden="true" />
      <span><strong className="tabular-nums">{subiu ? '+' : ''}{Math.round(valor * 100)}%</strong> que o período anterior ({litrosTexto(anterior)})</span>
    </p>
  );
}

function Alerta({ icone: Icone, rotulo, valor, testid, onAbrir }: { icone: typeof CopyX; rotulo: string; valor: number; testid: string; onAbrir?: () => void }) {
  const conteudo = <>
    <Icone className={`size-4 shrink-0 ${valor ? 'text-amber-700' : 'text-slate-400'}`} aria-hidden="true" />
    <span className="flex-1 text-left">{rotulo}</span>
    <strong className={`tabular-nums ${valor ? 'text-amber-900' : 'text-slate-400'}`}>{valor}</strong>
  </>;
  return (
    <li>
      {onAbrir && valor > 0
        ? <button type="button" onClick={onAbrir} className={`flex min-h-7 w-full items-center gap-2 rounded-lg px-1 hover:bg-amber-50 ${FOCO}`} data-testid={testid} title={`Abrir os ${valor} na lista`}>{conteudo}</button>
        : <span className="flex min-h-7 items-center gap-2 px-1 text-slate-600" data-testid={testid}>{conteudo}</span>}
    </li>
  );
}

function GraficoPorDia({ relatorio, hoje, onAbrirDia }: { relatorio: ReturnType<typeof montarRelatorioDiesel>; hoje: string; onAbrirDia: (dia: string) => void }) {
  const [foco, setFoco] = useState<number | null>(null);
  const dias = relatorio.porDia;
  const teto = tetoRedondo(Math.max(...dias.map(dia => dia.litros), relatorio.mediaPorDia));
  const altura = (litros: number) => `${Math.max(0, Math.min(100, (litros / teto) * 100))}%`;
  // Rótulo do eixo a cada ~5 dias, mais o primeiro e o último.
  const passo = dias.length > 14 ? 5 : dias.length > 7 ? 2 : 1;
  const emFoco = foco === null ? null : dias[foco];

  return (
    <section data-comb-reveal aria-label="Litros por dia" className={`${CARTAO} p-3 sm:p-4`} data-testid="relatorio-grafico-dia">
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="text-sm font-black text-slate-900">Litros por dia</h2>
        <p className="text-xs font-semibold text-slate-500">Toque num dia para ver os lançamentos dele</p>
      </header>
      <div className="flex gap-2">
        <div aria-hidden="true" className="flex h-40 w-10 shrink-0 flex-col justify-between text-right text-xs font-semibold tabular-nums text-slate-400 2xl:h-52">
          <span>{teto.toLocaleString('pt-BR')}</span><span>{(teto / 2).toLocaleString('pt-BR')}</span><span>0</span>
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="relative h-40 border-b border-slate-300 2xl:h-52" onMouseLeave={() => setFoco(null)}>
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 border-t border-slate-100" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-slate-100" />
            {relatorio.mediaPorDia > 0 && (
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-slate-500" style={{ bottom: altura(relatorio.mediaPorDia) }}>
                <span className="absolute -top-4 right-0 rounded bg-white/90 px-1 text-xs font-bold text-slate-600">média {litrosTexto(relatorio.mediaPorDia)}</span>
              </div>
            )}
            <ol className="absolute inset-0 flex items-end gap-[2px]">
              {dias.map((dia, indice) => (
                <li key={dia.dia} className="flex h-full min-w-0 flex-1 items-end">
                  <button
                    type="button"
                    onClick={() => dia.lancamentos && onAbrirDia(dia.dia)}
                    onMouseEnter={() => setFoco(indice)}
                    onFocus={() => setFoco(indice)}
                    onBlur={() => setFoco(null)}
                    aria-label={`${diaSemana(dia.dia)}: ${litrosTexto(dia.litros)} em ${dia.lancamentos} lançamento(s)`}
                    className={`group flex h-full w-full items-end justify-center rounded-t-[4px] ${dia.lancamentos ? 'cursor-pointer' : 'cursor-default'} ${foco === indice ? 'bg-slate-100/80' : ''} ${FOCO}`}
                    data-testid="relatorio-dia"
                  >
                    <span
                      data-barra-dia
                      className={`block w-full max-w-7 rounded-t-[4px] ${dia.litros ? '' : 'bg-slate-200'}`}
                      style={{ height: dia.litros ? altura(dia.litros) : '2px', background: dia.litros ? VERDE : undefined, opacity: foco === null || foco === indice ? 1 : 0.55 }}
                    />
                  </button>
                </li>
              ))}
            </ol>
            {emFoco && foco !== null && (
              <div aria-hidden="true" className="pointer-events-none absolute top-1 z-20 w-max max-w-[14rem] rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg ring-1 ring-slate-200"
                style={{ left: `${((foco + 0.5) / dias.length) * 100}%`, transform: `translateX(${foco < dias.length / 3 ? '-10%' : foco > (dias.length * 2) / 3 ? '-90%' : '-50%'})` }}
                data-testid="relatorio-dica">
                <p className="capitalize">{diaSemana(emFoco.dia)}{emFoco.dia === hoje ? ' (hoje)' : ''}</p>
                <p className="text-base font-black tabular-nums text-slate-950">{litrosTexto(emFoco.litros)}</p>
                <p className="text-slate-500">{emFoco.lancamentos} lançamento(s){emFoco.lancamentos ? ' · toque para abrir' : ''}</p>
              </div>
            )}
          </div>
          <ol aria-hidden="true" className="mt-1 flex gap-[2px] text-xs font-semibold tabular-nums text-slate-500">
            {dias.map((dia, indice) => (
              <li key={dia.dia} className="relative min-w-0 flex-1 text-center">
                {(indice % passo === 0 || indice === dias.length - 1) ? <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{dia.dia.slice(8)}</span> : null}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

const LIMITE_RANKING = 8;

function Ranking({ titulo, linhas, total, testid, dica, onAbrir }: { titulo: string; linhas: LinhaRelatorio[]; total: number; testid: string; dica?: string; onAbrir: (linha: LinhaRelatorio) => void }) {
  const [todas, setTodas] = useState(false);
  const visiveis = todas ? linhas : linhas.slice(0, LIMITE_RANKING);
  const maior = linhas[0]?.litros || 1;
  return (
    <section data-comb-reveal aria-label={titulo} className={`${CARTAO} flex min-h-0 min-w-0 flex-col p-3`} data-testid={testid}>
      <h2 className="mb-1 px-1 text-sm font-black text-slate-900">{titulo}</h2>
      {!linhas.length && <p className="px-1 py-4 text-sm font-semibold text-slate-500">Nenhum abastecimento no período.</p>}
      <ol className="space-y-0.5">
        {visiveis.map(linha => (
          <li key={linha.chave}>
            <button type="button" onClick={() => onAbrir(linha)} title={dica || `Abrir os ${linha.lancamentos} lançamento(s) na lista`}
              className={`w-full rounded-lg px-1.5 py-1.5 text-left transition hover:bg-[#f7f8f6] ${FOCO}`} data-testid={`${testid}-linha`}>
              <span className="flex items-baseline gap-2 text-sm">
                <strong className="min-w-0 truncate font-black text-slate-900">{linha.rotulo}</strong>
                {linha.detalhe && <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-500">{linha.detalhe}</span>}
                <span className="ml-auto shrink-0 font-bold tabular-nums text-slate-900">{litrosTexto(linha.litros)}</span>
              </span>
              <span className="mt-1 flex items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span data-barra-ranking className="block h-full rounded-full" style={{ width: `${(linha.litros / maior) * 100}%`, background: VERDE }} />
                </span>
                <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-500">{total ? `${Math.round((linha.litros / total) * 100)}%` : ''}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      {linhas.length > LIMITE_RANKING && (
        <button type="button" onClick={() => setTodas(atual => !atual)} className={`mt-1 self-start rounded-lg px-1.5 py-1 text-sm font-bold text-[#176b4d] hover:underline ${FOCO}`} data-testid={`${testid}-todas`}>
          {todas ? 'Mostrar menos' : `Ver as ${linhas.length}`}
        </button>
      )}
    </section>
  );
}
