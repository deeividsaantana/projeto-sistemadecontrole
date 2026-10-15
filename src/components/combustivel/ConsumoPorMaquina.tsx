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

function Situacao({ linha }: { linha: ConsumoEquipamento }) {
  const { rotulo, classe } = SITUACAO[linha.situacao];
  const texto = linha.situacao === 'acima' && linha.desvio !== undefined
    ? `${Math.round(linha.desvio * 100)}% acima`
    : rotulo;
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${classe}`}>{texto}</span>;
}

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
        <section data-comb-reveal aria-label="Consumo por máquina" className={`${CARTAO} ${maquina ? 'hidden xl:flex' : 'flex'} min-h-0 flex-col overflow-hidden`}>
          <header className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-base font-black text-slate-950">Consumo por máquina</h3>
            <p className="text-sm text-slate-500">Comparado com o que a própria máquina costuma gastar; acima de {Math.round(LIMITE_ACIMA * 100)}% vira alerta. Toque numa máquina para ver os abastecimentos.</p>
          </header>
          {visiveis.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-600">{linhas.length ? 'Nenhuma máquina com esse filtro.' : 'Nenhum abastecimento neste período.'}</p>
          ) : (
            <>
              <ul className="divide-y divide-slate-100 md:hidden xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                {visiveis.map(linha => (
                  <li key={linha.chave}>
                    <button type="button" onClick={() => setSelecionada(linha.chave)} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 ${FOCO}`}>
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-sm font-black text-slate-950">{linha.prefixo}</span>
                        <span className="block truncate text-sm text-slate-500">{linha.nome}</span>
                        <span className="mt-1 block text-sm font-semibold tabular-nums text-slate-700">{litros(linha.litros)} · {textoConsumo(linha.consumoPeriodo, linha.unidade)}</span>
                      </span>
                      <Situacao linha={linha} />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto md:block xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <caption className="sr-only">Consumo de diesel por máquina</caption>
                  <thead className="sticky top-0 z-10 bg-[#f7f8f6] text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-4 py-2">Máquina</th>
                      <th scope="col" className="px-2 py-2 text-right">Abast.</th>
                      <th scope="col" className="px-2 py-2 text-right">Litros</th>
                      <th scope="col" className="px-2 py-2 text-right">Trabalhou</th>
                      <th scope="col" className="px-2 py-2 text-right">Consumo</th>
                      <th scope="col" className="px-2 py-2 text-right">Habitual</th>
                      <th scope="col" className="px-4 py-2">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visiveis.map(linha => (
                      <tr key={linha.chave} aria-selected={linha.chave === selecionada} onClick={() => setSelecionada(linha.chave)} className={`cursor-pointer transition-colors duration-200 hover:bg-slate-50 ${linha.chave === selecionada ? 'bg-emerald-50/60' : ''}`}>
                        <td className="px-4 py-2.5">
                          <button type="button" onClick={() => setSelecionada(linha.chave)} className={`text-left ${FOCO} rounded`}>
                            <span className="block font-mono font-black text-slate-950">{linha.prefixo}</span>
                            <span className="block max-w-[14rem] truncate text-xs text-slate-500">{linha.nome}</span>
                          </button>
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{linha.abastecimentos}</td>
                        <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{litros(linha.litros)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{trabalhou(linha)}</td>
                        <td className="px-2 py-2.5 text-right font-bold tabular-nums text-slate-950">{textoConsumo(linha.consumoPeriodo, linha.unidade)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-slate-500">{textoConsumo(linha.consumoHabitual, linha.unidade)}</td>
                        <td className="px-4 py-2.5"><Situacao linha={linha} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {maquina ? <FichaMaquina maquina={maquina} onVoltar={() => setSelecionada(null)} /> : (
          <aside className={`${CARTAO} hidden flex-col items-center justify-center gap-2 p-6 text-center xl:flex`}>
            <Gauge className="size-8 text-slate-300" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-600">Escolha uma máquina na lista para ver cada abastecimento e o gráfico de consumo.</p>
          </aside>
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
    <aside data-ficha-maquina aria-label={`Ficha de ${maquina.prefixo}`} className={`${CARTAO} flex min-h-0 flex-col overflow-hidden`} data-testid="consumo-ficha">
      <header className="border-b border-slate-100 px-4 py-3">
        <button type="button" onClick={onVoltar} className={`${BOTAO_SECUNDARIO} mb-2 min-h-10 px-3 xl:hidden`}><ArrowLeft className="size-4" aria-hidden="true" />Voltar à lista</button>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-mono text-lg font-black text-slate-950">{maquina.prefixo}</h3>
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

      <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
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
    </aside>
  );
}
