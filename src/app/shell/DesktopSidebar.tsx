import { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { NavigationGroupView } from './NavigationMenu';
import { AmbienteCliente, MarcaProduto, SimboloProduto } from '../../shared/ui/MarcaProduto';
import { APP_VERSION_LABEL } from '../version';
import { FOCO, reduzMovimento } from '../../components/cadastros/estilos';

interface DesktopSidebarProps {
  activeTab: string;
  groups: NavigationGroupView[];
  onNavigate: (tab: string) => void;
}

const COLLAPSE_KEY = 'renea_sidebar_recolhido';
const ICON_STROKE = 1.75;

const readCollapsed = () => {
  try {
    const guardado = localStorage.getItem(COLLAPSE_KEY);
    if (guardado !== null) return guardado === 'true';
  } catch {
    // Navegador com armazenamento bloqueado segue a largura da tela, sem quebrar.
  }
  // Sem escolha guardada, notebook pequeno e tablet deitado (abaixo de 1280 px)
  // abrem com o menu só de ícones, para a tabela ganhar espaço. Quem expandir
  // uma vez fica com o menu aberto, porque a escolha passa a ser guardada.
  return typeof window !== 'undefined' && window.innerWidth < 1280;
};

/**
 * Menu lateral do computador (redesenho de 11/11/2026, pedido do Deivid:
 * "deixar profissional"). Fundo branco como o resto do sistema, grupos
 * sempre abertos com o nome discreto (sem setas para abrir e fechar), item
 * aberto em verde-claro com a barrinha verde à esquerda, e o ambiente do
 * cliente num cartão logo abaixo da marca.
 */
export function DesktopSidebar({ activeTab, groups, onNavigate }: DesktopSidebarProps) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const navRef = useRef<HTMLElement>(null);

  // Só grava quando a pessoa aperta o botão: o padrão pela largura da tela
  // não vira escolha guardada.
  const mudarRecolhido = (valor: boolean) => {
    setCollapsed(valor);
    try {
      localStorage.setItem(COLLAPSE_KEY, String(valor));
    } catch {
      // Preferência de layout não vale interromper a navegação.
    }
  };

  // Só na primeira carga: uma entrada leve dos itens, uma vez só.
  useGSAP(() => {
    if (!navRef.current || reduzMovimento()) return;
    gsap.fromTo(
      navRef.current.querySelectorAll('[data-sidebar-item]'),
      { opacity: 0, x: -4 },
      { opacity: 1, x: 0, duration: .3, stagger: .015, ease: 'power2.out', clearProps: 'transform' },
    );
  }, { scope: navRef, dependencies: [] });

  const versao = APP_VERSION_LABEL.split(' — ')[0];

  return (
    <aside
      className={`erp-sidebar hidden shrink-0 flex-col lg:flex ${collapsed ? 'erp-sidebar--recolhido' : ''}`}
      aria-label="Navegação principal"
    >
      <div className={`flex min-h-[3.25rem] items-center border-b border-slate-200 ${collapsed ? 'justify-center px-2' : 'justify-between pl-4 pr-2'}`}>
        {collapsed ? <SimboloProduto className="size-8" /> : <MarcaProduto />}
        {!collapsed && (
          <button
            type="button"
            onClick={() => mudarRecolhido(true)}
            title="Recolher menu"
            aria-label="Recolher menu"
            className={`grid size-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 ${FOCO}`}
          >
            <ChevronsLeft className="size-4" strokeWidth={ICON_STROKE} />
          </button>
        )}
      </div>

      {collapsed ? (
        <button
          type="button"
          onClick={() => mudarRecolhido(false)}
          title="Expandir menu"
          aria-label="Expandir menu"
          className={`mx-auto mt-2 grid size-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 ${FOCO}`}
        >
          <ChevronsRight className="size-4" strokeWidth={ICON_STROKE} />
        </button>
      ) : (
        <div className="px-3 pt-3">
          <div className="rounded-lg border border-slate-200 bg-[#f7f8f6] px-3 py-2">
            <AmbienteCliente />
          </div>
        </div>
      )}

      <nav ref={navRef} className={`flex-1 overflow-y-auto pb-3 pt-1 ${collapsed ? 'px-2' : 'px-3'}`}>
        {groups.map((group, index) => (
          <section key={group.label} aria-label={group.label} className={index > 0 && collapsed ? 'mt-2 border-t border-slate-100 pt-2' : ''}>
            {!collapsed && (
              <p className="px-2.5 pb-1 pt-4 text-xs font-semibold text-slate-500">{group.label}</p>
            )}
            <div className="space-y-0.5">
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
                    className={`relative flex min-h-9 w-full items-center gap-2.5 rounded-lg text-left text-sm transition-colors ${FOCO} ${
                      active
                        ? 'bg-[#eef6f1] font-semibold text-[#176b4d]'
                        : 'font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                    } ${collapsed ? 'justify-center px-0' : 'px-2.5'}`}
                  >
                    {active && !collapsed && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-[#176b4d]" />}
                    <Icon className={`size-[18px] shrink-0 ${active ? 'text-[#176b4d]' : 'text-slate-500'}`} strokeWidth={ICON_STROKE} aria-hidden="true" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {groups.length === 0 && !collapsed && (
          <p className="px-2.5 pt-4 text-sm text-slate-500">Nenhum módulo encontrado.</p>
        )}
      </nav>

      <div className={`border-t border-slate-200 py-2.5 text-xs text-slate-500 ${collapsed ? 'text-center' : 'px-5'}`} title={APP_VERSION_LABEL}>
        {collapsed ? versao.replace(/^ERP\s*/, '') : `Cintravyse ${versao.replace(/^ERP\s*/, '')}`}
      </div>
    </aside>
  );
}
