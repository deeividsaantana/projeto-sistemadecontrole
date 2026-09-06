/**
 * Tokens visuais do RENEA. Existem para que cor, raio, altura e densidade não
 * fiquem espalhados em hex solto por dezenas de telas: quem precisar ajustar a
 * identidade mexe aqui e o sistema inteiro acompanha.
 */
export const RENEA = {
  /** Verde da marca, o mesmo do item ativo da navegação. */
  verde: '#087353',
  verdeEscuro: '#065f46',
  verdeClaro: '#d1fae5',
  fundo: '#f6f7f6',
  superficie: '#ffffff',
  borda: '#e2e8f0',
  texto: '#0f172a',
  textoSuave: '#64748b',
} as const;

/** Estados operacionais e a cor que cada um comunica. */
export type EstadoOperacional = 'operacao' | 'manutencao' | 'confirmar' | 'erro' | 'neutro';

export const ESTADO_CLASSES: Record<EstadoOperacional, { chip: string; barra: string; icone: string; valor: string }> = {
  operacao: { chip: 'bg-emerald-50 text-emerald-700', barra: 'bg-emerald-600', icone: 'bg-emerald-50 text-emerald-700', valor: 'text-slate-900' },
  manutencao: { chip: 'bg-amber-50 text-amber-700', barra: 'bg-amber-500', icone: 'bg-amber-50 text-amber-700', valor: 'text-amber-700' },
  confirmar: { chip: 'bg-sky-50 text-sky-700', barra: 'bg-sky-500', icone: 'bg-sky-50 text-sky-700', valor: 'text-sky-700' },
  erro: { chip: 'bg-rose-50 text-rose-700', barra: 'bg-rose-500', icone: 'bg-rose-50 text-rose-700', valor: 'text-rose-700' },
  neutro: { chip: 'bg-slate-100 text-slate-600', barra: 'bg-slate-400', icone: 'bg-slate-100 text-slate-600', valor: 'text-slate-900' },
};

/** Medidas da interface densa: altura de controle, raio e espaçamento base. */
export const UI = {
  alturaControle: 'h-9',
  alturaControleGrande: 'min-h-10',
  raio: 'rounded-lg',
  raioCartao: 'rounded-xl',
  borda: 'border border-slate-200',
  cartao: 'rounded-xl border border-slate-200 bg-white',
  rotulo: 'text-[11px] font-semibold uppercase tracking-wide text-slate-500',
  titulo: 'text-[26px] font-bold leading-tight text-slate-900',
  subtitulo: 'text-[13px] text-slate-500',
} as const;
