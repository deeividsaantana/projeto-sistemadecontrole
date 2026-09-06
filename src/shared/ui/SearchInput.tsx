import { Search } from 'lucide-react';
import { cn } from './styles';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Rótulo acessível: a lupa não é lida por leitor de tela. */
  label?: string;
  className?: string;
}

/** Busca das listagens. Estava repetida em doze telas com a mesma marcação. */
export function SearchInput({ value, onChange, placeholder, label = 'Buscar', className }: SearchInputProps) {
  return (
    <label className={cn('relative block', className)}>
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
      />
    </label>
  );
}
