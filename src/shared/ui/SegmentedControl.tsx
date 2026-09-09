import { cn } from './styles';

export interface SegmentedItem<T extends string> {
  id: T;
  label: string;
  /** Contagem à direita do rótulo, quando ajuda a decidir onde clicar. */
  count?: number;
}

/**
 * O tipo do grupo vem de `value` — quem chama guarda o estado com uma união
 * estreita ('estoque' | 'movimentos' | ...) e o setter precisa continuar
 * aceitando exatamente ela. Sem o NoInfer o TypeScript também deduzia T a
 * partir de `items` e caía em `string`, quebrando todo onChange.
 */
interface SegmentedControlProps<T extends string> {
  items: readonly SegmentedItem<NoInfer<T>>[];
  value: T;
  onChange: (id: NoInfer<T>) => void;
  /** Nome do grupo para quem navega por leitor de tela. */
  label?: string;
  className?: string;
}

/**
 * Chave de seções de uma tela. Cada opção tem a largura do próprio texto e
 * quebra linha no celular — a versão anterior esticava dois botões pela página
 * inteira, e um "Todos" de 700px de largura lia como banner, não como filtro.
 */
export function SegmentedControl<T extends string>({ items, value, onChange, label, className }: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap items-center gap-2', className)}>
      {items.map(item => {
        const ativo = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-pressed={ativo}
            className={cn(
              'inline-flex min-h-10 items-center gap-2 rounded-lg border px-3.5 text-xs font-bold transition-colors',
              ativo
                ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800',
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={cn('tabular-nums text-[11px] font-semibold', ativo ? 'text-emerald-700' : 'text-slate-400')}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
