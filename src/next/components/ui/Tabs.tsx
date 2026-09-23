export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export const Tabs = ({
  items,
  activeId,
  onChange,
}: {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
}) => (
  <div role="tablist" className="flex flex-wrap gap-1 border-b border-[var(--color-border-subtle)]">
    {items.map(item => {
      const active = item.id === activeId;
      return (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(item.id)}
          className={`relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold transition ${
            active ? 'text-[var(--color-brand-700)]' : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)]'
          }`}
        >
          {item.label}
          {typeof item.count === 'number' && (
            <span className="rounded-full bg-[var(--color-surface-sunken)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-ink-secondary)]">
              {item.count}
            </span>
          )}
          {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--color-brand-600)]" />}
        </button>
      );
    })}
  </div>
);
