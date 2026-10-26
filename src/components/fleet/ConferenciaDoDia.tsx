/**
 * Peças comuns das abas Equipamentos e Operadores do Controle de Frotas: o
 * resumo da conferência do dia (contadores, barra de preenchimento e filtro
 * A confirmar / Todos / Lançados) e a célula de situação da tabela.
 */
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, type LucideIcon } from 'lucide-react';
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
  return (
    <header className={`${CARTAO} grid shrink-0 gap-3 p-3 sm:p-4`}>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[#176b4d]"><Icone className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#176b4d]">Conferência do dia · {dataCurta(data)}</p>
            <h2 id={id} className="mt-0.5 text-lg font-bold text-slate-950">{titulo}</h2>
            <p className="mt-0.5 text-sm text-[#5b6870]">{descricao}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-[#f7f8f6] text-center sm:grid-cols-4">
          {contadores.map((contador, indice) => (
            <div key={contador.rotulo} className={`px-4 py-1.5 ${indice ? 'border-l border-slate-200' : ''} ${indice > 1 ? 'max-sm:border-t' : ''} ${indice === 2 ? 'max-sm:border-l-0' : ''}`}>
              <dt className={`text-xs font-bold uppercase ${contador.tom ?? 'text-[#5b6870]'}`}>{contador.rotulo}</dt>
              <dd className={`text-xl font-bold tabular-nums ${contador.tom ?? 'text-slate-950'}`}>{contador.valor}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-[#5b6870]"><span>{rotuloProgresso}</span><span>{progresso}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={rotuloProgresso} aria-valuenow={progresso} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-[#176b4d] transition-[width] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none" style={{ width: `${progresso}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#f7f8f6] p-1 ring-1 ring-inset ring-slate-200" role="group" aria-label={rotuloFiltro}>
          {opcoesFiltro.map(([valor, rotulo]) => (
            <button key={valor} type="button" aria-pressed={filtro === valor} onClick={() => onFiltro(valor)} className={`min-h-11 rounded-xl px-3 text-sm font-bold transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:min-h-9 ${filtro === valor ? 'bg-white text-[#176b4d] ring-1 ring-slate-200' : 'text-[#5b6870] hover:text-slate-800'} ${FOCO}`}>{rotulo}</button>
          ))}
        </div>
        {acao}
      </div>
    </header>
  );
}

/** Situação na tabela: ícone e cor dizem a mesma coisa que o texto. */
export function SituacaoConferencia({ informado, texto, tom, detalhe }: { informado: boolean; texto: string; tom: string; detalhe?: string }) {
  return (
    <span className={`inline-flex items-start gap-1.5 font-bold ${tom}`}>
      {informado ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
      <span>
        {texto}
        {detalhe && <span className="block text-xs font-semibold">{detalhe}</span>}
      </span>
    </span>
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
