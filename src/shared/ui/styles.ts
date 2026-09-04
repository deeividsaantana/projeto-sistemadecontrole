import { normalizeComparable } from '../../utils/canonicalIdentity';

export const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

/** Classe de cor de fundo/texto para um pill de status, por palavra-chave do valor. */
export const statusTone = (status: string) => {
  const value = normalizeComparable(status);
  if (['ativo', 'mobilizado', 'em operacao', 'presente', 'enviado', 'ok', 'concluida', 'concluido', 'disponivel'].some(token => value.includes(token))) return 'bg-emerald-100 text-emerald-800';
  if (['manutencao', 'inativo', 'ausente', 'desmobilizado', 'parado', 'cancelada'].some(token => value.includes(token))) return 'bg-rose-100 text-rose-800';
  if (['aguardando', 'pendente'].some(token => value.includes(token))) return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-600';
};
