import type { NavigationGroupView } from './NavigationMenu';
import { cn } from '../../shared/ui';

interface DesktopModuleTabsProps {
  activeTab: string;
  groups: NavigationGroupView[];
  onNavigate: (tab: string) => void;
}

export function DesktopModuleTabs({ activeTab, groups, onNavigate }: DesktopModuleTabsProps) {
  return (
    <nav className="app-module-tabs hidden md:flex w-full gap-1 overflow-x-auto px-5 print:hidden xl:px-8" aria-label="Modulos do sistema">
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
              'app-module-tab flex h-16 w-[7.15rem] shrink-0 items-center gap-2 px-3 text-left text-[10px] font-semibold leading-tight',
              active ? 'app-module-tab--active text-emerald-950' : 'text-slate-600 hover:text-emerald-900',
            )}
          >
            <Icon className="app-module-tab__glyph h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span className="max-w-[6.5rem]">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
