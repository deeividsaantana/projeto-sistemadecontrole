import { Lock } from 'lucide-react';
import { MODULES } from '../../constants/navigation';
import { PRODUCT_NAME } from '../../constants/brand';

export const Sidebar = ({
  currentPath,
  onNavigate,
  collapsed,
}: {
  currentPath: string;
  onNavigate: (path: string) => void;
  collapsed: boolean;
}) => (
  <aside
    className={`hidden shrink-0 flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-surface-inverse)] text-[var(--color-ink-inverse)] transition-[width] duration-200 md:flex ${
      collapsed ? 'w-[72px]' : 'w-64'
    }`}
  >
    <div className="flex h-16 items-center gap-2 px-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-brand-500)] text-sm font-black text-white">{PRODUCT_NAME.charAt(0)}</span>
      {!collapsed && <span className="truncate text-sm font-black tracking-tight">{PRODUCT_NAME}</span>}
    </div>
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
      {MODULES.map(module => {
        const active = module.path === currentPath;
        const Icon = module.icon;
        return (
          <button
            key={module.id}
            type="button"
            onClick={() => onNavigate(module.path)}
            title={collapsed ? module.label : undefined}
            className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-semibold transition ${
              active ? 'bg-[var(--color-brand-600)] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon className="size-4.5 shrink-0" aria-hidden="true" />
            {!collapsed && <span className="flex-1 truncate text-left">{module.label}</span>}
            {!collapsed && !module.ready && <Lock className="size-3.5 shrink-0 opacity-50" aria-hidden="true" />}
          </button>
        );
      })}
    </nav>
  </aside>
);
