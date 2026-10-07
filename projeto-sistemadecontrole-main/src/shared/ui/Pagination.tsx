import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  const windowStart = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => windowStart + index).filter(value => value >= 1 && value <= totalPages);
  return (
    <div className="flex items-center gap-1">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40" aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></button>
      {pages.map(value => (
        <button key={value} type="button" onClick={() => onChange(value)} className={`grid size-8 place-items-center rounded-lg text-xs font-bold ${value === page ? 'bg-[#087345] text-white' : 'border border-slate-200 text-slate-600 hover:border-emerald-300'}`}>{value}</button>
      ))}
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)} className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40" aria-label="Próxima página"><ChevronRight className="h-4 w-4" /></button>
    </div>
  );
}
