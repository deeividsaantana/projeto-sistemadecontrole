import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ChevronDown, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { NavigationGroupView } from './NavigationMenu';
import reneaLogo from '../../assets/images/logo-renea-branco.png';
import { APP_VERSION_LABEL } from '../version';
import { reduzMovimento } from '../../components/cadastros/estilos';

interface DesktopSidebarProps {
  activeTab: string;
  groups: NavigationGroupView[];
  onNavigate: (tab: string) => void;
}

const COLLAPSE_KEY = 'renea_sidebar_recolhido';
const CLOSED_GROUPS_KEY = 'renea_sidebar_grupos_fechados';
const ICON_STROKE = 1.75;
// Mesmo anel de foco laranja do Painel (FOCO em estilos.ts), com offset escuro
// porque o menu é a única superfície escura do sistema.
const FOCO_CLARO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f26a2e]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b4938]';

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'true';
  } catch {
    // Navegador com armazenamento bloqueado abre no estado normal, sem quebrar.
    return false;
  }
};

const readClosedGroups = (): string[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(CLOSED_GROUPS_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

export function DesktopSidebar({ activeTab, groups, onNavigate }: DesktopSidebarProps) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [closedGroups, setClosedGroups] = useState<string[]>(readClosedGroups);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, String(collapsed));
    } catch {
      // Preferência de layout não vale interromper a navegação.
    }
  }, [collapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(CLOSED_GROUPS_KEY, JSON.stringify(closedGroups));
    } catch {
      // Preferência de layout não vale interromper a navegação.
    }
  }, [closedGroups]);

  // Só na primeira carga: um leve degradê de entrada nos itens, uma vez só.
  // O menu em si não anima continuamente (área sempre visível, ver index.css).
  useGSAP(() => {
    if (!navRef.current || reduzMovimento()) return;
    gsap.fromTo(
      navRef.current.querySelectorAll('[data-sidebar-item]'),
      { opacity: 0, x: -6 },
      { opacity: 1, x: 0, duration: .4, stagger: .022, ease: 'power2.out', clearProps: 'transform' },
    );
  }, { scope: navRef, dependencies: [] });

  const toggleGroup = (label: string) => {
    setClosedGroups(current => (current.includes(label)
      ? current.filter(item => item !== label)
      : [...current, label]));
  };

  return (
    <aside
      className={`erp-sidebar hidden shrink-0 flex-col text-[#dbeee4] lg:flex ${collapsed ? 'erp-sidebar--recolhido' : ''}`}
      aria-label="Navegação principal"
    >
      <div className={`flex min-h-[3.25rem] items-center border-b border-white/[0.06] ${collapsed ? 'justify-center px-2' : 'justify-between px-3.5'}`} title={APP_VERSION_LABEL}>
        {collapsed
          ? <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-sm font-black text-white">R</span>
          : <img src={reneaLogo} alt="RENEA Infraestrutura" className="h-6 w-auto object-contain" />}
        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            title="Recolher menu"
            aria-label="Recolher menu"
            className={`rounded-lg p-1.5 text-[#8dc4ad] transition-colors duration-200 hover:bg-white/10 hover:text-white ${FOCO_CLARO}`}
          >
            <ChevronsLeft className="h-4 w-4" strokeWidth={ICON_STROKE} />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="Expandir menu"
          aria-label="Expandir menu"
          className={`mx-auto mt-1.5 rounded-lg p-1.5 text-[#8dc4ad] transition-colors duration-200 hover:bg-white/10 hover:text-white ${FOCO_CLARO}`}
        >
          <ChevronsRight className="h-4 w-4" strokeWidth={ICON_STROKE} />
        </button>
      )}

      <nav ref={navRef} className="flex-1 overflow-y-auto px-2 py-1.5">
        {groups.map((group, index) => {
          const hasActive = group.items.some(item => item.id === activeTab);
          // O grupo do módulo aberto nunca fica escondido: o usuário precisa ver onde está.
          const open = collapsed || hasActive || !closedGroups.includes(group.label);
          return (
            <section
              key={group.label}
              className={`mb-0.5 last:mb-0 ${index > 0 ? 'border-t border-white/[0.05] pt-1' : ''}`}
            >
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={open}
                  className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#89b7a4] transition-colors duration-200 hover:text-white ${FOCO_CLARO}`}
                >
                  <ChevronDown
                    className={`h-3 w-3 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${open ? '' : '-rotate-90'}`}
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                  <span className="truncate">{group.label}</span>
                </button>
              )}
              {open && (
                <div className="space-y-0.5 pb-1">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        data-sidebar-item
                        onClick={() => onNavigate(item.id)}
                        aria-current={active ? 'page' : undefined}
                        title={item.label}
                        className={`group relative flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[12.5px] transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${FOCO_CLARO} ${
                          active
                            ? 'bg-white/[0.08] font-semibold text-white'
                            : 'text-[#bcded0] hover:translate-x-[3px] hover:bg-white/[0.06] hover:text-white'
                        } ${collapsed ? 'justify-center px-0 hover:translate-x-0' : ''}`}
                      >
                        {!collapsed && (
                          <span
                            aria-hidden="true"
                            className={`absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-[#7ee0b6] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${active ? 'scale-y-100' : 'scale-y-0'}`}
                          />
                        )}
                        <span
                          className={`grid shrink-0 place-items-center rounded-[7px] transition-colors duration-200 ${
                            collapsed ? 'h-8 w-8' : 'h-6 w-6'
                          } ${active ? 'bg-white/10' : 'bg-transparent'}`}
                        >
                          <Icon
                            className={`h-4 w-4 shrink-0 ${active ? 'text-[#7ee0b6]' : 'text-[#93bba9] group-hover:text-white'}`}
                            strokeWidth={ICON_STROKE}
                            aria-hidden="true"
                          />
                        </span>
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
        {groups.length === 0 && !collapsed && (
          <p className="px-3 text-xs text-[#8dc4ad]">Nenhum módulo encontrado.</p>
        )}
      </nav>

      <div
        className={`flex items-center border-t border-white/[0.06] py-2 text-[10px] font-semibold text-[#6fa08c] ${collapsed ? 'justify-center' : 'justify-center gap-1.5'}`}
        title={APP_VERSION_LABEL}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#3ecb8f]" aria-hidden="true" />
        {!collapsed && <span className="truncate">{APP_VERSION_LABEL.split(' — ')[0]}</span>}
      </div>
    </aside>
  );
}
