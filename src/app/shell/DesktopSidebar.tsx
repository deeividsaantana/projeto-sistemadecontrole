import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { NavigationGroupView } from './NavigationMenu';
import { cn } from '../../shared/ui';
import reneaLogo from '../../assets/images/logo-renea-branco.png';

interface DesktopSidebarProps {
  activeTab: string;
  groups: NavigationGroupView[];
  menuSearch: string;
  onMenuSearchChange: (value: string) => void;
  onNavigate: (tab: string) => void;
  onLogout: () => void;
}

export function DesktopSidebar({
  activeTab,
  groups,
  menuSearch,
  onMenuSearchChange,
  onNavigate,
  onLogout,
}: DesktopSidebarProps) {
  return (
    <aside className="erp-sidebar hidden lg:flex" aria-label="Navegação principal">
      <div className="erp-sidebar__brand">
        <img src={reneaLogo} alt="RENEA Infraestrutura" />
      </div>
      <div className="erp-sidebar__tenant">
        <span className="erp-sidebar__tenant-label">Operação ativa</span>
        <strong>Complexo do Alto Tietê</strong>
        <span className="erp-sidebar__tenant-code">RENEA Infraestrutura S.A.</span>
      </div>
      <label className="erp-sidebar__search">
        <Search aria-hidden="true" />
        <input
          type="search"
          value={menuSearch}
          onChange={event => onMenuSearchChange(event.target.value)}
          placeholder="Buscar módulo"
          aria-label="Buscar módulo"
        />
        <kbd>⌘K</kbd>
      </label>
      <nav className="erp-sidebar__nav">
        {groups.map(group => (
          <section key={group.label} className="erp-sidebar__group" aria-label={group.label}>
            <p>{group.label}</p>
            <div>
              {group.items.map(item => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={cn('erp-sidebar__item', active && 'is-active')}
                    onClick={() => onNavigate(item.id)}
                    aria-current={active ? 'page' : undefined}
                    title={item.label}
                  >
                    <Icon aria-hidden="true" />
                    <span>{item.label}</span>
                    <ChevronRight className="erp-sidebar__item-arrow" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {groups.length === 0 && <p className="erp-sidebar__empty">Nenhum módulo encontrado.</p>}
      </nav>
      <div className="erp-sidebar__footer">
        <div className="erp-sidebar__status"><span /> Operação normal</div>
        <button type="button" className="erp-sidebar__collapse" onClick={onLogout}>
          <span className="erp-sidebar__avatar">RE</span>
          <span className="erp-sidebar__user"><strong>Usuário RENEA</strong><small>Sair da conta</small></span>
          <ChevronLeft aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
