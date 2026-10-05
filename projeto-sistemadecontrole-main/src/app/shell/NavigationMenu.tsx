import { ChevronRight, Search } from 'lucide-react';
import type { NavigationItem } from '../navigation/navigation';
import { TextInput, cn } from '../../shared/ui';

export interface NavigationGroupView {
  label: string;
  items: NavigationItem[];
}

interface NavigationMenuProps {
  activeTab: string;
  groups: NavigationGroupView[];
  menuSearch: string;
  onMenuSearchChange: (value: string) => void;
  onNavigate: (tab: string, closeMobile?: boolean) => void;
  mobile?: boolean;
}

export function NavigationMenu({
  activeTab,
  groups,
  menuSearch,
  onMenuSearchChange,
  onNavigate,
  mobile = false,
}: NavigationMenuProps) {
  return (
    <>
      <TextInput
        type="search"
        icon={Search}
        value={menuSearch}
        onChange={event => onMenuSearchChange(event.target.value)}
        placeholder="Buscar modulo"
        aria-label="Buscar modulo no menu"
        className="mb-4"
      />
      <div className="space-y-6">
        {groups.map(group => (
          <section key={group.label} aria-label={group.label}>
            <p className="px-3 mb-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">{group.label}</p>
            <div className="space-y-1.5">
              {group.items.map(item => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id, mobile)}
                    aria-current={active ? 'page' : undefined}
                    title={item.label}
                    className={cn(
                      'group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                      active ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:translate-x-0.5 hover:bg-emerald-50 hover:text-emerald-800',
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-white' : 'text-slate-500 group-hover:text-emerald-600')} />
                    <span className="flex-1 text-left leading-tight">{item.label}</span>
                    <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'}`} />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {groups.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-slate-500">Nenhum modulo encontrado.</p>
        )}
      </div>
    </>
  );
}
