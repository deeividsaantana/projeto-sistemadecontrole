import type { NavigationGroupView } from './NavigationMenu';
import { cn } from '../../shared/ui';

interface DesktopModuleTabsProps {
  activeTab: string;
  groups: NavigationGroupView[];
  onNavigate: (tab: string) => void;
}

export function DesktopModuleTabs({ activeTab, groups, onNavigate }: DesktopModuleTabsProps) {
  return (
    <nav className="hidden md:flex w-full gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 print:hidden xl:px-8" aria-label="Modulos do sistema">
      {groups.flatMap(group => group.items).map(item => {
        const Icon = item.icon;
        const active = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-[11px] font-black transition-colors',
              active ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-800',
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
