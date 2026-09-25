/**
 * Classes repetidas da aba Cadastros, no padrão do Painel de Controle:
 * verde RENEA na ação principal, foco laranja, cantos de 12 a 16 px e toque
 * de pelo menos 44 px.
 */
export const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f26a2e]/60';

const BOTAO = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${FOCO}`;

export const BOTAO_PRIMARIO = `${BOTAO} bg-[#176b4d] text-white shadow-sm hover:opacity-90`;
export const BOTAO_SECUNDARIO = `${BOTAO} border border-slate-200 bg-white text-slate-700 hover:border-emerald-500 hover:text-[#176b4d]`;
export const BOTAO_PERIGO = `${BOTAO} bg-rose-700 text-white hover:bg-rose-800`;
export const BOTAO_PERIGO_LEVE = `${BOTAO} border border-rose-200 bg-white text-rose-700 hover:border-rose-400 hover:bg-rose-50`;

export const CARTAO = 'rounded-2xl border border-slate-200 bg-white';

export const CAMPO = `min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 transition duration-200 focus:border-emerald-500 sm:text-sm ${FOCO}`;

export const ROTULO = 'text-sm font-semibold text-slate-700';

export const TOM_SITUACAO = {
  ok: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200',
  alerta: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200',
  inativo: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
} as const;

export const reduzMovimento = () => typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
