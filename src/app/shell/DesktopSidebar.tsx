import { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { NavigationGroupView } from './NavigationMenu';
import reneaLogo from '../../assets/images/logo-renea-transparent.png';
import { reduzMovimento } from '../../components/cadastros/estilos';

interface DesktopSidebarProps {
  activeTab: string;
  groups: NavigationGroupView[];
  onNavigate: (tab: string) => void;
}

const COLLAPSE_KEY = 'renea_sidebar_recolhido';
const ICON_STROKE = 1.75;
const FOCO_SIDEBAR = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--renea-focus)';

const readCollapsed = () => {
  try {
    const guardado = localStorage.getItem(COLLAPSE_KEY);
    if (guardado !== null) return guardado === 'true';
  } catch {
    // Navegador com armazenamento bloqueado segue a largura da tela, sem quebrar.
  }
  // Sem escolha guardada, notebook pequeno e tablet deitado (abaixo de 1280 px)
  // abrem com o menu só de ícones, para a tabela ganhar ~165 px. Quem expandir
  // uma vez fica com o menu aberto, porque a escolha passa a ser guardada.
  return typeof window !== 'undefined' && window.innerWidth < 1280;
};

export function DesktopSidebar({ activeTab, groups, onNavigate }: DesktopSidebarProps) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const navRef = useRef<HTMLElement>(null);

  // Só grava quando a pessoa aperta o botão: o padrão pela largura da tela
  // não vira escolha guardada (senão o notebook pequeno prenderia o menu
  // recolhido também no monitor grande).
  const mudarRecolhido = (valor: boolean) => {
    setCollapsed(valor);
    try {
      localStorage.setItem(COLLAPSE_KEY, String(valor));
    } catch {
      // Preferência de layout não vale interromper a navegação.
    }
  };

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

  return (
    <aside
      className={`erp-sidebar hidden shrink-0 flex-col text-slate-700 lg:flex ${collapsed ? 'erp-sidebar--recolhido' : ''}`}
      aria-label="Navegação principal"
    >
      <div className={`flex min-h-[3.25rem] items-center border-b border-slate-200 ${collapsed ? 'justify-center px-2' : 'justify-between px-3.5'}`} title="Ambiente RENEA">
        {collapsed
          ? <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-sm font-black text-emerald-800">R</span>
          : <div className="flex items-center gap-2"><img src={reneaLogo} alt="RENEA Infraestrutura" className="h-6 w-auto object-contain" /><span className="text-xs font-bold text-emerald-800">Ambiente RENEA</span></div>}
        {!collapsed && (
          <button
            type="button"
            onClick={() => mudarRecolhido(true)}
            title="Recolher menu"
            aria-label="Recolher menu"
            className={`rounded-lg p-1.5 text-emerald-700 transition-colors duration-200 hover:bg-emerald-50 hover:text-emerald-900 ${FOCO_SIDEBAR}`}
          >
            <ChevronsLeft className="h-4 w-4" strokeWidth={ICON_STROKE} />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={() => mudarRecolhido(false)}
          title="Expandir menu"
          aria-label="Expandir menu"
          className={`mx-auto mt-1.5 rounded-lg p-1.5 text-emerald-700 transition-colors duration-200 hover:bg-emerald-50 hover:text-emerald-900 ${FOCO_SIDEBAR}`}
        >
          <ChevronsRight className="h-4 w-4" strokeWidth={ICON_STROKE} />
        </button>
      )}

      <nav ref={navRef} className="flex-1 overflow-y-auto px-2 py-1.5">
        {groups.map((group, index) => {
          return (
            <section
              key={group.label}
              className={`mb-1 last:mb-0 ${index > 0 ? 'border-t border-slate-100 pt-2' : ''}`}
            >
              {!collapsed && (
                <p data-sidebar-grupo className="px-2 py-0.5 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{group.label}</p>
              )}
              <div className="space-y-px pb-1">
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
                        className={`group relative flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[12.5px] transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${FOCO_SIDEBAR} ${
                          active
                            ? 'bg-emerald-50 font-semibold text-emerald-900'
                            : 'text-slate-600 hover:translate-x-[3px] hover:bg-emerald-50 hover:text-emerald-900'
                        } ${collapsed ? 'justify-center px-0 hover:translate-x-0' : ''}`}
                      >
                        {!collapsed && (
                          <span
                            aria-hidden="true"
                            className={`absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-emerald-700 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${active ? 'scale-y-100' : 'scale-y-0'}`}
                          />
                        )}
                        <span
                          className={`grid shrink-0 place-items-center rounded-[7px] transition-colors duration-200 ${
                            collapsed ? 'h-8 w-8' : 'h-6 w-6'
                          } ${active ? 'bg-emerald-100' : 'bg-transparent'}`}
                        >
                          <Icon
                            className={`h-4 w-4 shrink-0 ${active ? 'text-emerald-700' : 'text-slate-500 group-hover:text-emerald-700'}`}
                            strokeWidth={ICON_STROKE}
                            aria-hidden="true"
                          />
                        </span>
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}
              </div>
            </section>
          );
        })}
        {groups.length === 0 && !collapsed && (
          <p className="px-3 text-xs text-[#8dc4ad]">Nenhum módulo encontrado.</p>
        )}
      </nav>

      <div
        className={`flex items-center border-t border-slate-200 py-2 text-xs font-semibold text-slate-500 ${collapsed ? 'justify-center' : 'justify-center gap-1.5'}`}
        title="Cintravyse v3.5.1"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" aria-hidden="true" />
        {!collapsed && <span className="truncate">Cintravyse v3.5.1</span>}
      </div>
    </aside>
  );
}
