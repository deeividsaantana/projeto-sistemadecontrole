import {
  CheckCircle2,
  Droplets,
  Fuel,
  History,
  Plus,
  ArrowLeft,
  RotateCcw,
  Save,
  PieChart,
  BarChart3,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PageHeader } from './PageHeader';
import { GraficoBarras } from '../charts/GraficoBarras';
import { GraficoMeses } from '../charts/GraficoMeses';
import { GraficoRosca } from '../charts/GraficoRosca';
import { formatarLitros } from '../../utils/format';
import { useAbastecimentoStore } from '../../stores/abastecimentoStore';
import type { Abastecimento } from '../../types';
import { animarEntrada, animarFiltros } from '../../utils/gsap';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, FOCO } from '../../constants/css';

export function CombustivelOperacionalTab() {
  const {
    view,
    setView,
    mesSelecionado,
    setMesSelecionado,
    mesesDisponiveis,
    syncBadgeRef,
    lastSync,
    abrirNovo,
    onOpenLubrificacao,
    vistas,
    analyticsCombustivel,
    salvar,
    limparLancamento,
    excluirAbastecimento,
    excluirTodos,
    abaDashboard,
    setAbaDashboard,
    filtrosAbertos,
    setFiltrosAbertos,
    aviso,
    setAviso,
  } = useAbastecimentoStore();

  const escopo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (escopo.current) animarEntrada(escopo.current);
  }, [view]);

  useEffect(() => {
    if (escopo.current && filtrosAbertos) animarFiltros(escopo.current);
  }, [filtrosAbertos]);

  const litrosTexto = (l: number) => formatarLitros(l);

  return (
    <section
      ref={escopo}
      id="combustivel-tab"
      data-testid="combustivel-tab"
      aria-label="Combustível"
      className={
        view === 'novo'
          ? 'space-y-4'
          : 'mx-auto flex h-[calc(100dvh-7rem)] min-h-[34rem] w-full max-w-[96rem] flex-col overflow-hidden'
      }
    >
      {view !== 'novo' && (
        <div data-comb-reveal className="mb-2 shrink-0">
          <PageHeader
            eyebrow="Frota"
            title="Combustível"
            className="mb-2"
            actions={
              <>
                <span
                  className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                  ref={syncBadgeRef}
                >
                  Última sync: {lastSync}
                </span>
                <button
                  type="button"
                  onClick={onOpenLubrificacao}
                  aria-label="Lubrificação"
                  title="Lubrificação"
                  className={`${BOTAO_SECUNDARIO} size-10 justify-center px-0 sm:w-auto sm:px-3`}
                >
                  <Droplets className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Lubrificação</span>
                </button>
                <button
                  type="button"
                  onClick={() => abrirNovo()}
                  className={`${BOTAO_PRIMARIO} min-h-10 px-3 sm:px-4`}
                  data-testid="combustivel-novo"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Novo abastecimento</span>
                  <span className="sm:hidden">Lançar</span>
                  <kbd
                    title="Atalho de teclado: N"
                    aria-label="Atalho de teclado: N"
                    className="inline-flex rounded-md bg-white/15 px-1.5 font-mono text-xs"
                  >
                    N
                  </kbd>
                </button>
              </>
            }
          />

          {/* Aba de meses */}
          <nav aria-label="Aba de meses" className="mb-2 flex flex-wrap gap-2">
            {mesesDisponiveis.map((mes) => (
              <button
                key={mes}
                type="button"
                onClick={() => setMesSelecionado(mes)}
                className={`rounded px-2 py-1 text-sm ${
                  mesSelecionado === mes ? 'bg-[#176b4d] text-white' : 'bg-gray-100 text-gray-800'
                } transition`}
              >
                {mes}
              </button>
            ))}
          </nav>

          {/* Aba de visualização */}
          <nav
            aria-label="Aba de visualização"
            className="grid w-full grid-cols-3 gap-1 rounded-xl bg-[#f7f8f6] p-1 ring-1 ring-inset ring-slate-200"
          >
            {vistas.map(([id, rotulo, Icone]) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                onClick={() => (id === 'novo' ? abrirNovo() : setView(id))}
                data-testid={`combustivel-vista-${id}`}
                className={`inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-xs font-bold transition sm:gap-2 sm:px-3 sm:text-sm ${
                  view === id
                    ? 'bg-white text-[#176b4d] shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                } ${FOCO}`}
              >
                <Icone className="size-4" aria-hidden="true" />
                {rotulo}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Aviso */}
      <p
        role="status"
        aria-live="polite"
        className={`${aviso ? '' : 'sr-only'} flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-200`}
        data-testid="combustivel-aviso"
      >
        {aviso && <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />}
        {aviso}
      </p>

      {/* Resumo */}
      {view === 'resumo' && (
        <div className="flex min-h-0 flex-1 flex-col gap-2" data-testid="combustivel-dashboard">
          <div className="grid shrink-0 grid-cols-4 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {[
              ['Lançamentos', analyticsCombustivel.totalRegistros.toLocaleString('pt-BR')],
              ['Volume abastecido', litrosTexto(analyticsCombustivel.totalLitros)],
              ['Empresas', analyticsCombustivel.porEmpresa.filter((i) => i.litros > 0).length.toLocaleString('pt-BR')],
              ['Equipamentos', analyticsCombustivel.porEquipamento.filter((i) => i.litros > 0).length.toLocaleString('pt-BR')],
            ].map(([titulo, valor]) => (
              <div key={titulo} className="min-w-0 px-2 py-2 sm:px-3">
                <p className="truncate text-[9px] font-bold uppercase tracking-wide text-slate-500 sm:text-[10px]">{titulo}</p>
                <p className="mt-0.5 truncate text-sm font-black tabular-nums text-slate-950 sm:text-lg">{valor}</p>
              </div>
            ))}
          </div>

          {/* Painéis do resumo */}
          <nav
            aria-label="Painéis do resumo de combustível"
            className="grid shrink-0 grid-cols-2 rounded-lg bg-slate-100 p-1"
          >
            <button
              type="button"
              aria-pressed={abaDashboard === 'consumo'}
              onClick={() => setAbaDashboard('consumo')}
              className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-bold ${
                abaDashboard === 'consumo' ? 'bg-white text-[#176b4d] shadow-sm' : 'text-slate-600'
              } ${FOCO}`}
            >
              <PieChart className="size-4" aria-hidden="true" />
              Distribuição e consumo
            </button>
            <button
              type="button"
              aria-pressed={abaDashboard === 'ranking'}
              onClick={() => setAbaDashboard('ranking')}
              className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-bold ${
                abaDashboard === 'ranking' ? 'bg-white text-[#176b4d] shadow-sm' : 'text-slate-600'
              } ${FOCO}`}
            >
              <BarChart3 className="size-4" aria-hidden="true" />
              Rankings e quantidades
            </button>
          </nav>

          {/* Conteúdo dos painéis */}
          {abaDashboard === 'consumo' ? (
            <div
              className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2 xl:grid-cols-4 xl:grid-rows-1"
              data-testid="combustivel-dashboard-consumo"
            >
              <GraficoRosca titulo="Consumo por empresa" grupos={analyticsCombustivel.porEmpresa} vazio="Sem abastecimentos por empresa." />
              <GraficoRosca titulo="Consumo por combustível" grupos={analyticsCombustivel.porCombustivel} vazio="Sem tipo de combustível informado." />
              <GraficoRosca titulo="Consumo por comboio" grupos={analyticsCombustivel.porComboio} vazio="Sem comboio vinculado." />
              <GraficoMeses grupos={analyticsCombustivel.porMes} />
            </div>
          ) : (
            <div
              className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2 xl:grid-cols-4 xl:grid-rows-1"
              data-testid="combustivel-dashboard-ranking"
            >
              <GraficoBarras titulo="Top empresas" grupos={analyticsCombustivel.porEmpresa} medida="litros" vazio="Sem volume por empresa." />
              <GraficoBarras titulo="Top equipamentos" grupos={analyticsCombustivel.porEquipamento} medida="litros" vazio="Sem volume por equipamento." />
              <GraficoBarras titulo="Lançamentos por comboio" grupos={analyticsCombustivel.porComboio} medida="registros" vazio="Sem comboios com lançamento." />
              <GraficoBarras titulo="Volume por combustível" grupos={analyticsCombustivel.porCombustivel} medida="litros" vazio="Sem tipos de combustível." />
            </div>
          )}
        </div>
      )}

      {/* Formulário de novo lançamento */}
      {view === 'novo' && (
        <form
          data-comb-reveal
          onSubmit={(e) => {
            e.preventDefault();
            salvar(false);
          }}
          className="w-full bg-white"
          data-testid="combustivel-form"
        >
          <div className="bg-white">
            <header className="flex flex-col gap-2 border-b border-slate-200 bg-white px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-black uppercase tracking-[0.12em] text-[#176b4d]">Lançamento de abastecimento</span>
              <span className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setView('resumo')}
                  className={`${BOTAO_SECUNDARIO} min-h-8 rounded-none px-3 py-1`}
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={limparLancamento}
                  className={`${BOTAO_SECUNDARIO} min-h-8 rounded-none px-3 py-1`}
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => salvar(true)}
                  className={`${BOTAO_SECUNDARIO} min-h-8 justify-center rounded-none px-3 py-1`}
                  data-testid="combustivel-salvar-outro"
                >
                  <Save className="size-4" aria-hidden="true" />
                  Salvar e lançar outro
                </button>
                <button
                  type="submit"
                  className={`${BOTAO_PRIMARIO} min-h-8 rounded-none px-4 py-1`}
                  data-testid="combustivel-salvar"
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Salvar
                </button>
              </span>
            </header>
            {/* O resto do formulário continua aqui */}
          </div>
        </form>
      )}
    </section>
  );
}
