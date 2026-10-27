/**
 * Peças comuns das abas Equipamentos e Operadores do Controle de Frotas: o
 * resumo da conferência do dia (contadores, barra de preenchimento e filtro
 * A confirmar / Todos / Lançados) e a célula de situação da tabela.
 */
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Plus, type LucideIcon } from 'lucide-react';
import { CARTAO, FOCO } from '../cadastros/estilos';

export type FiltroConferencia = 'pending' | 'all' | 'informed';

export const dataCurta = (date: string): string => /^\d{4}-\d{2}-\d{2}$/.test(date)
  ? new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR')
  : date;

export interface Contador {
  rotulo: string;
  valor: number;
  tom?: string;
}

interface ResumoProps {
  id: string;
  Icone: LucideIcon;
  data: string;
  titulo: string;
  descricao: ReactNode;
  contadores: readonly Contador[];
  rotuloProgresso: string;
  progresso: number;
  filtro: FiltroConferencia;
  onFiltro: (filtro: FiltroConferencia) => void;
  opcoesFiltro: readonly (readonly [FiltroConferencia, string])[];
  rotuloFiltro: string;
  acao: ReactNode;
}

export function ResumoConferencia({ id, Icone, data, titulo, descricao, contadores, rotuloProgresso, progresso, filtro, onFiltro, opcoesFiltro, rotuloFiltro, acao }: ResumoProps) {
  // Duas linhas baixas no computador (título e contadores; barra, filtro e
  // ação) para a tabela de baixo mostrar o máximo de linhas.
  return (
    <header className={`${CARTAO} grid shrink-0 gap-2 p-3`}>
      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[#176b4d]"><Icone className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <h2 id={id} className="text-base font-bold text-slate-950">{titulo} <span className="text-sm font-semibold text-[#5b6870]">· {dataCurta(data)}</span></h2>
            <p className="text-sm text-[#5b6870]">{descricao}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-[#f7f8f6] text-center sm:grid-cols-4">
          {contadores.map((contador, indice) => (
            <div key={contador.rotulo} className={`flex items-baseline justify-center gap-2 px-4 py-1.5 ${indice ? 'border-l border-slate-200' : ''} ${indice > 1 ? 'max-sm:border-t' : ''} ${indice === 2 ? 'max-sm:border-l-0' : ''}`}>
              <dt className={`whitespace-nowrap text-xs font-bold uppercase ${contador.tom ?? 'text-[#5b6870]'}`}>{contador.rotulo}</dt>
              <dd className={`text-lg font-bold tabular-nums ${contador.tom ?? 'text-slate-950'}`}>{contador.valor}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-[#5b6870]"><span>{rotuloProgresso}</span><span>{progresso}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={rotuloProgresso} aria-valuenow={progresso} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-[#176b4d] transition-[width] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none" style={{ width: `${progresso}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#f7f8f6] p-1 ring-1 ring-inset ring-slate-200" role="group" aria-label={rotuloFiltro}>
          {opcoesFiltro.map(([valor, rotulo]) => (
            <button key={valor} type="button" aria-pressed={filtro === valor} onClick={() => onFiltro(valor)} className={`min-h-11 whitespace-nowrap rounded-xl px-3 text-sm font-bold transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:min-h-8 ${filtro === valor ? 'bg-white text-[#176b4d] ring-1 ring-slate-200' : 'text-[#5b6870] hover:text-slate-800'} ${FOCO}`}>{rotulo}</button>
          ))}
        </div>
        {acao}
      </div>
    </header>
  );
}

export interface CartaoConferencia {
  id: string;
  /** Prefixo do equipamento ou nome do operador, em letra grande. */
  titulo: string;
  /** Tipo do equipamento ou matrícula do operador. */
  detalhe: string;
  /** Grupo (Basculantes, Apoio) ou nada. */
  grupo?: string;
  informado: boolean;
  /** Situação lançada (Em operação, Em manutenção...). */
  situacao?: string;
  saida?: string;
  /** Caminhão em que o operador foi lançado. */
  onde?: string;
  /** Texto do botão de lançar, lido pelo leitor de tela. */
  rotuloLancar: string;
  onLancar?: () => void;
}

const tomDoLancado = (situacao?: string) => (
  situacao === 'Em manutenção' || situacao === 'Aguardando manutenção'
    ? 'bg-rose-50 text-rose-700 ring-rose-200'
    : 'bg-emerald-50 text-emerald-800 ring-emerald-200'
);

/**
 * Faltantes e lançados da conferência em cartões grandes, sem tabela: o
 * faltante fica em âmbar, com o nome em destaque e o botão Lançar à mão; o
 * lançado mostra a situação, a saída e o caminhão. Primeiro os faltantes,
 * depois os lançados, cada grupo com o próprio título e a contagem.
 */
export function GradeConferencia({ itens, nomeFaltantes, nomeLancados, vazio, testId, colunas }: {
  itens: readonly CartaoConferencia[];
  nomeFaltantes: string;
  nomeLancados: string;
  vazio: ReactNode;
  testId: string;
  /** Classes de coluna da grade (equipamento cabe mais por linha que operador). */
  colunas: string;
}) {
  const faltantes = itens.filter(item => !item.informado);
  const lancados = itens.filter(item => item.informado);
  if (!itens.length) return <div className="grid flex-1 place-items-center">{vazio}</div>;
  const grupo = (titulo: string, lista: readonly CartaoConferencia[], tom: string) => lista.length > 0 && (
    <section aria-label={`${titulo}: ${lista.length}`} className="grid gap-2">
      <h3 className={`flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] ${tom}`}>
        {titulo}
        <span className="rounded-full bg-white px-2 py-0.5 text-sm tabular-nums ring-1 ring-inset ring-current/30">{lista.length}</span>
      </h3>
      <ul className={`grid gap-2 ${colunas}`}>
        {lista.map(item => (
          <li key={item.id} data-linha-lista
            className={`flex min-w-0 flex-col gap-1.5 rounded-2xl p-3 ${item.informado ? 'border border-slate-200 bg-white' : 'border-2 border-amber-300 bg-amber-50'}`}>
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <strong className={`block truncate text-lg leading-tight text-slate-950 ${/^[A-Z]{2}\d/.test(item.titulo) ? 'font-mono' : ''}`} title={item.titulo}>{item.titulo}</strong>
                <span className="block truncate text-sm text-[#5b6870]" title={item.detalhe}>{item.detalhe}{item.grupo ? ` · ${item.grupo}` : ''}</span>
              </span>
              {item.informado
                ? <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-hidden="true" />
                : <AlertTriangle className="size-5 shrink-0 text-amber-600" aria-hidden="true" />}
            </span>
            {item.informado ? (
              <span className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${tomDoLancado(item.situacao)}`}>{item.situacao || 'Lançado'}</span>
                {item.onde && <span className="font-mono font-semibold text-slate-700">{item.onde}</span>}
                {item.saida && <span className="text-[#5b6870]">saída <span className="font-mono font-semibold text-slate-700">{item.saida}</span></span>}
              </span>
            ) : (
              <span className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 ring-1 ring-inset ring-amber-300">Faltante</span>
                {item.onLancar && (
                  <button type="button" onClick={item.onLancar} aria-label={item.rotuloLancar} className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#176b4d] px-3 text-sm font-bold text-white transition hover:brightness-95 active:scale-[0.97] md:min-h-9 ${FOCO}`}>
                    <Plus className="size-4" aria-hidden="true" />Lançar
                  </button>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
  return (
    <div className="flex min-h-[16rem] flex-1 flex-col gap-4 overflow-y-auto rounded-2xl border border-slate-200 bg-[#f7f8f6] p-3" data-testid={testId}>
      {grupo(nomeFaltantes, faltantes, 'text-amber-800')}
      {grupo(nomeLancados, lancados, 'text-emerald-800')}
    </div>
  );
}

/** Lista curta de avisos que abre e fecha; o resumo tem altura de toque. */
export function AvisoRecolhivel({ titulo, children, tom }: { titulo: string; children: ReactNode; tom: string }) {
  return (
    <details className={`rounded-xl border px-3 text-sm ${tom}`}>
      <summary className={`flex min-h-11 cursor-pointer items-center font-bold ${FOCO}`}>{titulo}</summary>
      <p className="pb-2">{children}</p>
    </details>
  );
}
