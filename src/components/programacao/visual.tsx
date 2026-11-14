import { ROTULO_SITUACAO, type SituacaoAtividade } from '../../utils/programacao';

/** Mesma cor da situação no quadro, na lista, nos cartões e nos chips do filtro. */
export const COR_SITUACAO: Record<SituacaoAtividade, { barra: string; selo: string; ponto: string }> = {
  atrasada: { barra: 'bg-rose-600 text-white', selo: 'bg-rose-50 text-rose-700 ring-rose-200', ponto: 'bg-rose-600' },
  atencao: { barra: 'bg-amber-400 text-amber-950', selo: 'bg-amber-50 text-amber-800 ring-amber-200', ponto: 'bg-amber-400' },
  'em-dia': { barra: 'bg-[#176b4d] text-white', selo: 'bg-emerald-50 text-[#176b4d] ring-emerald-200', ponto: 'bg-[#176b4d]' },
  programada: { barra: 'bg-slate-200 text-slate-700', selo: 'bg-slate-100 text-slate-600 ring-slate-200', ponto: 'bg-slate-400' },
  concluida: { barra: 'bg-sky-700 text-white', selo: 'bg-sky-50 text-sky-800 ring-sky-200', ponto: 'bg-sky-700' },
  cancelada: { barra: 'bg-slate-100 text-slate-500 line-through', selo: 'bg-slate-50 text-slate-500 ring-slate-200', ponto: 'bg-slate-300' },
};

export function SeloSituacao({ situacao }: { situacao: SituacaoAtividade }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${COR_SITUACAO[situacao].selo}`}>
      <span className={`size-2 rounded-full ${COR_SITUACAO[situacao].ponto}`} aria-hidden="true" />
      {ROTULO_SITUACAO[situacao]}
    </span>
  );
}

export function BarraAvanco({ percentual, situacao }: { percentual: number; situacao: SituacaoAtividade }) {
  const largura = Math.max(0, Math.min(100, percentual));
  return (
    <span className="flex min-w-24 items-center gap-2">
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <span className={`block h-full rounded-full ${COR_SITUACAO[situacao].ponto}`} style={{ width: `${largura}%` }} />
      </span>
      <span className="w-10 text-right text-xs font-bold tabular-nums text-slate-700">{Math.round(percentual)}%</span>
    </span>
  );
}

export const numeroObra = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
export const diaMes = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const SEMANA_CURTA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const diaDaSemana = (dia: string) => SEMANA_CURTA[new Date(`${dia}T12:00:00Z`).getUTCDay()];
