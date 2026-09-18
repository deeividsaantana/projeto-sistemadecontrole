import type { LucideIcon } from 'lucide-react';

export interface ModuleShortcut {
  id: string;
  label: string;
  icon: LucideIcon;
}

export function ModuleShortcutBar({ items, onNavigate, label = 'Ferramentas do módulo' }: {
  items: readonly ModuleShortcut[];
  onNavigate: (id: string) => void;
  label?: string;
}) {
  return (
    <nav aria-label={label} className="module-shortcut-bar flex gap-1 overflow-x-auto border-b border-slate-200 bg-white pb-2">
      {items.map(({ id, label: itemLabel, icon: Icon }) => (
        <button key={id} type="button" onClick={() => onNavigate(id)} className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-emerald-600 hover:text-emerald-800">
          <Icon className="size-4" strokeWidth={1.7} aria-hidden="true" />{itemLabel}
        </button>
      ))}
    </nav>
  );
}
