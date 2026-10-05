import { Bell, Menu, Search } from 'lucide-react';
import { useActiveOrganization } from '../../app/organizations/OrganizationContext';

export const Topbar = ({ onToggleSidebar }: { onToggleSidebar: () => void }) => {
  const { activeOrganization, worksites, activeWorksiteId, setActiveWorksite, userRole, userName } = useActiveOrganization();

  return (
    <header className="flex h-16 items-center gap-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-4">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Alternar menu"
        className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)] text-[var(--color-ink-secondary)] hover:bg-[var(--color-surface-sunken)] md:flex"
      >
        <Menu className="size-4.5" />
      </button>

      <label className="hidden text-xs font-semibold text-[var(--color-ink-muted)] sm:flex sm:items-center sm:gap-1.5">
        Obra:
        <select
          value={activeWorksiteId ?? ''}
          onChange={event => setActiveWorksite(event.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-transparent px-2 py-1 text-xs font-bold text-[var(--color-ink-primary)] outline-none"
        >
          {worksites.map(worksite => (
            <option key={worksite.id} value={worksite.id}>
              {worksite.name}
            </option>
          ))}
        </select>
      </label>

      <span className="relative ml-auto hidden max-w-xs flex-1 sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-muted)]" />
        <input
          placeholder="Buscar em todo o sistema…"
          className="h-9 w-full rounded-[var(--radius-md)] border border-transparent bg-[var(--color-surface-sunken)] pl-9 pr-3 text-sm outline-none focus:border-[var(--color-brand-500)] focus:bg-[var(--color-surface-raised)]"
        />
      </span>

      <button
        type="button"
        aria-label="Notificações"
        className="relative grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)] text-[var(--color-ink-secondary)] hover:bg-[var(--color-surface-sunken)] sm:ml-0 ml-auto"
      >
        <Bell className="size-4.5" />
      </button>

      <div className="flex shrink-0 items-center gap-2 pl-1">
        <span className="grid size-8 place-items-center rounded-full bg-[var(--color-brand-100)] text-xs font-black text-[var(--color-brand-700)]">
          {userName.charAt(0)}
        </span>
        <span className="hidden text-left leading-tight lg:block">
          <span className="block text-xs font-bold text-[var(--color-ink-primary)]">{userName}</span>
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
            {activeOrganization?.name} · {userRole}
          </span>
        </span>
      </div>
    </header>
  );
};
