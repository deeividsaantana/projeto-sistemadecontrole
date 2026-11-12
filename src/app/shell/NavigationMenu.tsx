import { Search } from 'lucide-react';
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
        placeholder="Buscar módulo"
        aria-label="Buscar módulo no menu"
        className="mb-4"
      />
      <div className="space-y-4">
        {groups.map(group => (
          <section key={group.label} aria-label={group.label}>
            <p className="px-3 mb-1 text-xs font-semibold text-slate-500">{group.label}</p>
            <div className="space-y-0.5">
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
                      'relative flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      active ? 'bg-[#eef6f1] font-semibold text-[#176b4d]' : 'font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950',
                    )}
                  >
                    {active && <span aria-hidden="true" className="absolute inset-y-2.5 left-0 w-[3px] rounded-full bg-[#176b4d]" />}
                    <Icon className={cn('size-[18px] shrink-0', active ? 'text-[#176b4d]' : 'text-slate-500')} strokeWidth={1.75} aria-hidden="true" />
                    <span className="flex-1 text-left leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {groups.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-slate-500">Nenhum módulo encontrado.</p>
        )}
      </div>
    </>
  );
}
