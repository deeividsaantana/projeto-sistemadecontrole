/**
 * Combustível > Por máquina: quanto cada máquina abasteceu no mês, quanto
 * trabalhou e se está gastando acima do que ela mesma costuma gastar.
 * Tocar numa máquina abre a ficha com cada abastecimento e o gráfico.
 */
import { useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Gauge, Search, TrendingUp } from 'lucide-react';
import type { Abastecimento, Empresa, Equipamento } from '../../types';
import { getFuelCompetencePeriodLabel, getFuelRecordCompetence } from '../../modules/frota/fuelReport';
import {
  LIMITE_ACIMA,
  montarConsumoPorEquipamento,
  periodoDaCompetencia,
  textoConsumo,
  type ConsumoEquipamento,
  type FiltroConsumo,
  type SituacaoConsumo,
} from '../../modules/frota/consumoPorEquipamento';
import { isoDay } from '../../shared/ui';
import { TabelaPadrao, type ColunaTabela } from '../../shared/ui/TabelaPadrao';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, ROTULO, reduzMovimento } from '../cadastros/estilos';

interface Props {
  abastecimentos: Abastecimento[];
  equipamentos: Equipamento[];
  empresas: Empresa[];
  onErro: (mensagem: string) => void;
  onAviso: (mensagem: string) => void;
}

type FiltroSituacao = 'todas' | 'acima' | 'conferir';

const ULTIMOS_30 = 'ultimos-30';
const TODO_PERIODO = 'todo';

const litros = (valor: number) => `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L`;
const dataCurta = (dia: string) => (dia ? new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—');
const semAcento = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const trabalhou = (linha: Pick<ConsumoEquipamento, 'percorrido' | 'unidade'>) => (
  !linha.unidade || !linha.percorrido ? '—' : `${linha.percorrido.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ${linha.unidade === 'L/h' ? 'h' : 'km'}`
);

const SITUACAO: Record<SituacaoConsumo, { rotulo: string; classe: string }> = {
  acima: { rotulo: 'Acima do normal', classe: 'bg-orange-50 text-orange-800 ring-orange-200' },
  conferir: { rotulo: 'Leitura a conferir', classe: 'bg-amber-50 text-amber-800 ring-amber-200' },
  'sem-leitura': { rotulo: 'Sem horímetro/km', classe: 'bg-slate-100 text-slate-600 ring-slate-200' },
  normal: { rotulo: 'Normal', classe: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
};

/** Na tabela o selo quebra em 2 linhas para caber ao lado da ficha a 1366 px. */
function Situacao({ linha, quebra = false }: { linha: ConsumoEquipamento; quebra?: boolean }) {
  const { rotulo, classe } = SITUACAO[linha.situacao];
  const texto = linha.situacao === 'acima' && linha.desvio !== undefined
    ? `${Math.round(linha.desvio * 100)}% acima`
    : rotulo;
  return <span className={`inline-flex ${quebra ? 'rounded-xl leading-tight' : 'whitespace-nowrap rounded-full'} px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${classe}`}>{texto}</span>;
}

/** A linha inteira abre a ficha, com o mouse ou com Enter (TabelaPadrao). */
const COLUNAS_CONSUMO: ColunaTabela<ConsumoEquipamento>[] = [
  {
    chave: 'maquina', titulo: 'Máquina', larguraMinima: 160, larguraIdeal: 140,
    render: linha => <><span className="block font-mono font-black text-slate-950">{linha.prefixo}</span><span className="block truncate text-xs text-[#5b6870]">{linha.nome}</span></>,
    valorOrdenacao: linha => linha.prefixo,
    dica: linha => `${linha.prefixo} · ${linha.nome}`,
  },
  { chave: 'abastecimentos', titulo: 'Abast.', alinhamento: 'direita', larguraIdeal: 84, render: linha => linha.abastecimentos, valorOrdenacao: linha => linha.abastecimentos },
  { chave: 'litros', titulo: 'Litros', alinhamento: 'direita', larguraIdeal: 80, render: linha => <span className="font-semibold">{litros(linha.litros)}</span>, valorOrdenacao: linha => linha.litros },
  { chave: 'trabalhou', titulo: 'Trabalhou', alinhamento: 'direita', larguraIdeal: 106, render: trabalhou, valorOrdenacao: linha => linha.percorrido || null },
  { chave: 'consumo', titulo: 'Consumo', alinhamento: 'direita', larguraIdeal: 90, render: linha => <span className="font-bold text-slate-950">{textoConsumo(linha.consumoPeriodo, linha.unidade)}</span>, valorOrdenacao: linha => linha.consumoPeriodo ?? null },
  { chave: 'habitual', titulo: 'Habitual', alinhamento: 'direita', larguraIdeal: 90, render: linha => textoConsumo(linha.consumoHabitual, linha.unidade), valorOrdenacao: linha => linha.consumoHabitual ?? null },
  { chave: 'situacao', titulo: 'Situação', larguraIdeal: 134, render: linha => <Situacao linha={linha} quebra />, valorOrdenacao: linha => linha.desvio ?? null, dica: linha => SITUACAO[linha.situacao].rotulo },
];

export default function ConsumoPorMaquina({ abastecimentos, equipamentos, empresas, onErro, onAviso }: Props) {
  const escopo = useRef<HTMLDivElement>(null);
  const competencias = useMemo(() => {
    const chaves = new Set(abastecimentos.map(item => getFuelRecordCompetence(item)).filter(chave => /^\d{4}-\d{2}$/.test(chave)));
    return [...chaves].sort((a, b) => b.localeCompare(a));
  }, [abastecimentos]);
  const [periodo, setPeriodo] = useState(() => competencias[0] || ULTIMOS_30);
  const [busca, setBusca] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState<FiltroSituacao>('todas');
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  const filtro = useMemo<FiltroConsumo>(() => {
    if (periodo === TODO_PERIODO) return {};
    if (periodo === ULTIMOS_30) {
      const inicio = new Date();
      inicio.setDate(inicio.getDate() - 29);
      return { dataInicio: isoDay(inicio), dataFim: isoDay(new Date()) };
    }
    return periodoDaCompetencia(periodo);
  }, [periodo]);

  const linhas = useMemo(
    () => montarConsumoPorEquipamento({ registros: abastecimentos, equipamentos, empresas, filtro }),
    [abastecimentos, empresas, equipamentos, filtro],
  );
  const contagem = useMemo(() => ({
    acima: linhas.filter(item => item.situacao === 'acima').length,
    conferir: linhas.filter(item => item.leiturasConferir > 0).length,
  }), [linhas]);
  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim());
    return linhas
      .filter(item => filtroSituacao === 'todas'
        || (filtroSituacao === 'acima' ? item.situacao === 'acima' : item.leiturasConferir > 0))
      .filter(item => !termo || semAcento(`${item.prefixo} ${item.nome} ${item.empresa}`).includes(termo));
  }, [busca, filtroSituacao, linhas]);
  const maquina = linhas.find(item => item.chave === selecionada) || null;
  const porEmpresa = useMemo(() => {
    const grupos = new Map<string, { nome: string; litros: number; maquinas: number; abastecimentos: number }>();
    for (const linha of linhas) {
      const nome = linha.empresa || 'Sem empresa';
      const grupo = grupos.get(nome) ?? { nome, litros: 0, maquinas: 0, abastecimentos: 0 };
      grupo.litros += linha.litros;
      grupo.maquinas += 1;
      grupo.abastecimentos += linha.abastecimentos;
      grupos.set(nome, grupo);
    }
    return [...grupos.values()].sort((a, b) => b.litros - a.litros);
  }, [linhas]);
  const totalLitros = linhas.reduce((soma, item) => soma + item.litros, 0);

  useGSAP(() => {
    if (!maquina) return;
    // No celular a ficha toma o lugar da lista: leva a pessoa até o topo dela.
    if (!window.matchMedia('(min-width: 1280px)').matches) {
      escopo.current?.querySelector('[data-ficha-maquina]')?.scrollIntoView({ block: 'start' });
    }
    if (reduzMovimento()) return;
    gsap.fromTo('[data-ficha-maquina]', { opacity: 0, x: 16 }, { opacity: 1, x: 0, duration: 0.35, ease: 'power3.out', clearProps: 'transform,opacity' });
  }, { scope: escopo, dependencies: [selecionada] });

  const rotuloPeriodo = (chave: string) => {
    const mes = new Date(`${chave}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} (${getFuelCompetencePeriodLabel(chave)})`;
  };

  const exportar = async () => {
    setExportando(true);
    try {
      const { addCorporateSummarySheet, configureCorporateWorkbook, createCorporateWorkbook, downloadCorporateWorkbook, styleCorporateWorksheet } = await import('../../utils/excelCorporate');
      const titulo = 'Diesel por máquina';
      const workbook = await createCorporateWorkbook();
      configureCorporateWorkbook(workbook, titulo);
      const folha = workbook.addWorksheet('Por máquina');
      folha.columns = [
        { header: 'Prefixo', key: 'prefixo', width: 12 }, { header: 'Máquina', key: 'nome', width: 30 },
        { header: 'Empresa', key: 'empresa', width: 24 }, { header: 'Abastecimentos', key: 'abastecimentos', width: 14 },
        { header: 'Litros', key: 'litros', width: 12 }, { header: 'Trabalhou', key: 'trabalhou', width: 12 },
        { header: 'Consumo no período', key: 'consumo', width: 18 }, { header: 'Consumo habitual', key: 'habitual', width: 18 },
        { header: 'Diferença', key: 'desvio', width: 12 }, { header: 'Situação', key: 'situacao', width: 20 },
        { header: 'Último abastecimento', key: 'ultimo', width: 18 },
      ];
      visiveis.forEach(linha => folha.addRow({
        prefixo: linha.prefixo, nome: linha.nome, empresa: linha.empresa, abastecimentos: linha.abastecimentos,
        litros: linha.litros, trabalhou: trabalhou(linha),
        consumo: textoConsumo(linha.consumoPeriodo, linha.unidade), habitual: textoConsumo(linha.consumoHabitual, linha.unidade),
        desvio: linha.desvio === undefined ? '' : `${Math.round(linha.desvio * 100)}%`,
        situacao: SITUACAO[linha.situacao].rotulo, ultimo: dataCurta(linha.ultimoAbastecimento),
      }));
      styleCorporateWorksheet(folha, { title: titulo, headerRow: 1, lastColumn: 11, recordCount: visiveis.length });
      const fora = workbook.addWorksheet('Abastecimentos a olhar');
      fora.columns = [
        { header: 'Data', key: 'data', width: 12 }, { header: 'Prefixo', key: 'prefixo', width: 12 },
        { header: 'Máquina', key: 'nome', width: 30 }, { header: 'Litros', key: 'litros', width: 12 },
        { header: 'Leitura', key: 'leitura', width: 12 }, { header: 'Consumo', key: 'consumo', width: 14 },
        { header: 'Habitual', key: 'habitual', width: 14 }, { header: 'Motivo', key: 'motivo', width: 30 },
      ];
      const olhar = visiveis.flatMap(linha => linha.intervalos
        .filter(item => item.foraDoPadrao || item.leituraVoltou)
        .map(item => ({
          data: dataCurta(item.data), prefixo: linha.prefixo, nome: linha.nome, litros: item.litros, leitura: item.leitura || '',
          consumo: textoConsumo(item.valor, item.unidade), habitual: textoConsumo(linha.consumoHabitual, linha.unidade),
          motivo: item.leituraVoltou ? 'Horímetro/km menor que o anterior' : 'Consumo muito acima do habitual',
        })));
      olhar.forEach(item => fora.addRow(item));
      styleCorporateWorksheet(fora, { title: 'Abastecimentos a olhar', headerRow: 1, lastColumn: 8, recordCount: olhar.length });
      addCorporateSummarySheet(workbook, titulo, [
        ['Período', periodo === TODO_PERIODO ? 'Todo o período' : periodo === ULTIMOS_30 ? 'Últimos 30 dias' : rotuloPeriodo(periodo)],
        ['Máquinas', visiveis.length],
        ['Litros', Math.round(visiveis.reduce((soma, item) => soma + item.litros, 0))],
        ['Acima do normal', visiveis.filter(item => item.situacao === 'acima').length],
        ['Com leitura a conferir', visiveis.filter(item => item.leiturasConferir > 0).length],
      ]);
      await downloadCorporateWorkbook(workbook, `RENEA_diesel_por_maquina_${isoDay(new Date())}.xlsx`);
      onAviso(`${visiveis.length} máquina(s) exportada(s) para Excel.`);
    } catch (falha) {
      onErro(falha instanceof Error ? `Não foi possível gerar o Excel: ${falha.message}` : 'Não foi possível gerar o Excel.');
    } finally {
      setExportando(false);
    }
  };

  const chips: Array<[FiltroSituacao, string, number | null]> = [
    ['todas', 'Todas', linhas.length],
    ['acima', 'Acima do normal', contagem.acima],
    ['conferir', 'Leitura a conferir', contagem.conferir],
  ];

  return (
    <div ref={escopo} className="flex min-h-0 flex-1 flex-col gap-2" data-testid="combustivel-consumo">
      <section data-comb-reveal aria-label="Filtros do consumo por máquina" className={`${CARTAO} shrink-0 p-3`}>
        <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-end xl:flex-nowrap">
          <label className="lg:w-72">
            <span className={`${ROTULO} mb-1 block`}>Período</span>
            <select value={periodo} onChange={event => { setPeriodo(event.target.value); setSelecionada(null); }} className={CAMPO} data-testid="consumo-periodo">
              {competencias.map(chave => <option key={chave} value={chave}>{rotuloPeriodo(chave)}</option>)}
              <option value={ULTIMOS_30}>Últimos 30 dias</option>
              <option value={TODO_PERIODO}>Todo o período</option>
            </select>
          </label>
          <label className="min-w-0 flex-1 lg:min-w-[14rem]">
            <span className={`${ROTULO} mb-1 block`}>Buscar máquina</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Prefixo, máquina ou empresa" className={`${CAMPO} pl-9`} />
            </span>
          </label>
          <nav aria-label="Mostrar máquinas" className="flex flex-wrap gap-2 xl:flex-nowrap">
          {chips.map(([id, rotulo, total]) => (
            <button key={id} type="button" aria-pressed={filtroSituacao === id} onClick={() => setFiltroSituacao(id)} className={`inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-sm font-bold transition duration-200 ${filtroSituacao === id ? 'border-[#176b4d] bg-emerald-50 text-[#176b4d]' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-500'} ${FOCO}`}>
              {rotulo}<span className="rounded-full bg-white px-2 text-xs tabular-nums ring-1 ring-inset ring-slate-200">{total}</span>
            </button>
          ))}
          </nav>
          <button type="button" onClick={() => void exportar()} disabled={exportando || visiveis.length === 0} className={`${BOTAO_PRIMARIO} lg:w-36`} data-testid="consumo-excel">
            <Download className="size-4" aria-hidden="true" />{exportando ? 'Gerando...' : 'Excel'}
          </button>
        </div>
      </section>

      <div className="grid shrink-0 grid-cols-2 gap-2 xl:grid-cols-4">
        {[
          ['Máquinas abastecidas', linhas.length.toLocaleString('pt-BR'), Gauge, 'text-slate-950'],
          ['Litros no período', litros(totalLitros), CheckCircle2, 'text-slate-950'],
          ['Acima do normal', contagem.acima.toLocaleString('pt-BR'), TrendingUp, contagem.acima ? 'text-orange-700' : 'text-slate-950'],
          ['Leitura a conferir', contagem.conferir.toLocaleString('pt-BR'), AlertTriangle, contagem.conferir ? 'text-amber-700' : 'text-slate-950'],
        ].map(([titulo, valor, Icone, cor]) => {
          const Simbolo = Icone as typeof Gauge;
          return (
            <div key={titulo as string} data-comb-reveal className={`${CARTAO} px-4 py-2`}>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500"><Simbolo className="size-3.5" aria-hidden="true" />{titulo as string}</p>
              <p className={`text-xl font-black tabular-nums ${cor as string}`}>{valor as string}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <section data-comb-reveal aria-labelledby="consumo-titulo" className={`${maquina ? 'hidden xl:flex' : 'flex'} min-h-0 flex-col gap-1.5`}>
          <header className="px-1">
            <h2 id="consumo-titulo" className="text-base font-black text-slate-950">Consumo por máquina</h2>
            <p className="text-sm text-[#5b6870]">Comparado com o que a própria máquina costuma gastar; acima de {Math.round(LIMITE_ACIMA * 100)}% vira alerta. Toque numa máquina para ver os abastecimentos.</p>
          </header>
          <div className="flex min-h-[18rem] flex-1 flex-col xl:min-h-0">
            <TabelaPadrao
              titulo="Consumo de diesel por máquina"
              linhas={visiveis}
              colunas={COLUNAS_CONSUMO}
              idDaLinha={linha => linha.chave}
              nomeDoItem={{ um: 'máquina', varios: 'máquinas' }}
              onAbrirLinha={linha => setSelecionada(linha.chave)}
              linhaAtivaId={selecionada}
              vazio={linhas.length ? 'Nenhuma máquina com esse filtro.' : 'Nenhum abastecimento neste período.'}
              testId="consumo-tabela"
              testIdLinha="consumo-linha"
              densa
            />
          </div>
        </section>

        {maquina ? <FichaMaquina maquina={maquina} onVoltar={() => setSelecionada(null)} /> : (
          <section aria-label="Consumo por empresa" className={`${CARTAO} hidden min-h-0 flex-col overflow-hidden xl:flex`} data-testid="consumo-empresas">
            <header className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-base font-black text-slate-950">Por empresa</h2>
              <p className="text-sm text-slate-500">Litros no período. Toque numa máquina ao lado para ver os detalhes dela.</p>
            </header>
            {porEmpresa.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">Sem abastecimentos no período.</p> : (
              <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {porEmpresa.map(item => (
                  <li key={item.nome}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-bold text-slate-900" title={item.nome}>{item.nome}</span>
                      <span className="shrink-0 font-black tabular-nums text-[#176b4d]">{litros(item.litros)}</span>
                    </div>
                    <p className="text-xs text-slate-500">{item.maquinas} máquina(s) · {item.abastecimentos} abastecimento(s)</p>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-[#176b4d]" style={{ width: `${Math.max(3, item.litros / (porEmpresa[0].litros || 1) * 100)}%` }} /></div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function FichaMaquina({ maquina, onVoltar }: { maquina: ConsumoEquipamento; onVoltar: () => void }) {
  const comValor = [...maquina.intervalos].reverse().filter(item => item.valor !== undefined).slice(-20);
  const maior = Math.max(maquina.consumoHabitual || 0, ...comValor.map(item => item.valor || 0), 1);
  const largura = 320;
  const altura = 120;
  const passo = comValor.length ? largura / comValor.length : largura;
  const yHabitual = maquina.consumoHabitual ? altura - (maquina.consumoHabitual / maior) * altura : null;

  return (
    <section data-ficha-maquina aria-label={`Ficha de ${maquina.prefixo}`} className={`${CARTAO} flex min-h-0 flex-col overflow-hidden`} data-testid="consumo-ficha">
      <header className="border-b border-slate-100 px-4 py-3">
        <button type="button" onClick={onVoltar} className={`${BOTAO_SECUNDARIO} mb-2 min-h-10 px-3 xl:hidden`}><ArrowLeft className="size-4" aria-hidden="true" />Voltar à lista</button>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-mono text-lg font-black text-slate-950">{maquina.prefixo}</h2>
            <p className="truncate text-sm text-slate-500">{maquina.nome}{maquina.empresa ? ` · ${maquina.empresa}` : ''}</p>
          </div>
          <Situacao linha={maquina} />
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ['No período', textoConsumo(maquina.consumoPeriodo, maquina.unidade)],
            ['Habitual', textoConsumo(maquina.consumoHabitual, maquina.unidade)],
            ['Litros', litros(maquina.litros)],
          ].map(([titulo, valor]) => (
            <div key={titulo} className="rounded-xl bg-[#f7f8f6] px-2 py-2">
              <dt className="text-xs font-bold text-slate-500">{titulo}</dt>
              <dd className="text-sm font-black tabular-nums text-slate-950">{valor}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div tabIndex={0} role="region" aria-label={`Abastecimentos de ${maquina.prefixo}`} className={`xl:min-h-0 xl:flex-1 xl:overflow-y-auto ${FOCO}`}>
        {comValor.length > 1 && (
          <figure className="px-4 pt-3">
            <figcaption className="mb-1 text-xs font-bold text-slate-500">Consumo a cada abastecimento ({maquina.unidade}){yHabitual !== null ? ', linha tracejada = habitual' : ''}</figcaption>
            <svg viewBox={`0 0 ${largura} ${altura}`} className="h-28 w-full" role="img" aria-label={`Consumo dos últimos ${comValor.length} abastecimentos de ${maquina.prefixo}`}>
              {comValor.map((item, indice) => {
                const h = ((item.valor || 0) / maior) * altura;
                return (
                  <rect key={item.id} x={indice * passo + passo * 0.15} y={altura - h} width={passo * 0.7} height={h} rx={2} fill={item.foraDoPadrao ? '#f26a2e' : '#176b4d'}>
                    <title>{`${dataCurta(item.data)}: ${textoConsumo(item.valor, item.unidade)}`}</title>
                  </rect>
                );
              })}
              {yHabitual !== null && <line x1={0} x2={largura} y1={yHabitual} y2={yHabitual} stroke="#718087" strokeWidth={1.5} strokeDasharray="5 4" />}
            </svg>
          </figure>
        )}
        <ul className="divide-y divide-slate-100" aria-label="Abastecimentos no período">
          {maquina.intervalos.map(item => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="w-12 shrink-0 font-semibold tabular-nums text-slate-700">{dataCurta(item.data)}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold tabular-nums text-slate-950">{litros(item.litros)}</span>
                <span className="block text-xs tabular-nums text-slate-500">{item.leitura ? `${maquina.unidade === 'km/L' ? 'Km' : 'Horímetro'} ${item.leitura.toLocaleString('pt-BR')}` : 'Sem leitura'}</span>
              </span>
              <span className="text-right">
                <span className={`block font-bold tabular-nums ${item.foraDoPadrao ? 'text-orange-700' : 'text-slate-900'}`}>{textoConsumo(item.valor, item.unidade)}</span>
                {item.leituraVoltou && <span className="block text-xs font-bold text-amber-700">Leitura menor que a anterior</span>}
                {item.foraDoPadrao && <span className="block text-xs font-bold text-orange-700">Bem acima do habitual</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
