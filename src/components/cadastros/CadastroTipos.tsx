import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { Building2, ChevronDown, Construction, Droplets, Fuel, GitBranch, HardHat, MapPin, Package, Route, Trash2, Truck, Users, type LucideIcon } from 'lucide-react';
import { CADASTRO_GRUPOS, categoriaCadastro, categoriasDoGrupo, type CadastroCategoriaId } from '../../utils/cadastrosCategorias';
import { FOCO, reduzMovimento } from './estilos';

export type VistaCadastros = CadastroCategoriaId | 'lixeira';

const ICONES: Record<VistaCadastros, LucideIcon> = {
  funcionarios: Users,
  empresas: Building2,
  fornecedores: Building2,
  'fornecedores-locacao': Construction,
  'fornecedores-materiais': Package,
  subfornecedores: GitBranch,
  terceiras: HardHat,
  equipamentos: Truck,
  veiculos: Truck,
  comboios: Fuel,
  obras: MapPin,
  etapas: Route,
  combustiveis: Fuel,
  lubrificantes: Droplets,
  lixeira: Trash2,
};

export const nomeDaVista = (vista: VistaCadastros) => (vista === 'lixeira' ? 'Lixeira' : categoriaCadastro(vista).label);

interface Props {
  value: VistaCadastros;
  contar: (vista: VistaCadastros) => number;
  onSelect: (vista: VistaCadastros) => void;
  mostrarLixeira: boolean;
}

/**
 * Escolha do tipo de cadastro. No computador é uma coluna fixa com todos os
 * tipos e a quantidade de cada um. No celular vira um seletor grande que abre
 * a lista por grupos de baixo para cima.
 */
export default function CadastroTipos({ value, contar, onSelect, mostrarLixeira }: Props) {
  const [aberto, setAberto] = useState(false);
  const folha = useRef<HTMLDivElement>(null);
  const Icone = ICONES[value];

  useEffect(() => {
    if (!aberto) return undefined;
    folha.current?.querySelector<HTMLElement>('[aria-current="true"]')?.focus();
    if (!reduzMovimento() && folha.current) {
      gsap.fromTo(folha.current, { yPercent: 12, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.3, ease: 'power3.out', clearProps: 'transform,opacity' });
    }
    const tecla = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAberto(false);
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [aberto]);

  const escolher = (vista: VistaCadastros) => {
    setAberto(false);
    onSelect(vista);
  };

  const item = (vista: VistaCadastros, grande: boolean) => {
    const ativo = value === vista;
    const IconeItem = ICONES[vista];
    return (
      <li key={vista}>
        <button
          type="button"
          aria-current={ativo ? 'true' : undefined}
          data-testid={`cadastro-categoria-${vista}`}
          onClick={() => escolher(vista)}
          className={`flex w-full min-w-0 items-center gap-3 rounded-xl px-3 text-left font-semibold transition duration-200 ${FOCO} ${grande ? 'min-h-12 text-base' : 'min-h-10 text-sm'} ${ativo
            ? 'is-active bg-[#176b4d] text-white'
            : 'text-slate-700 hover:bg-emerald-50 hover:text-[#176b4d]'}`}
        >
          <IconeItem className="size-[18px] shrink-0 opacity-80" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{nomeDaVista(vista)}</span>
          <span className={`shrink-0 text-xs font-bold tabular-nums ${ativo ? 'text-white/80' : 'text-slate-400'}`}>{contar(vista).toLocaleString('pt-BR')}</span>
        </button>
      </li>
    );
  };

  const lista = (grande: boolean) => (
    <div className="space-y-3">
      {CADASTRO_GRUPOS.map(grupo => (
        <section key={grupo.id} aria-labelledby={`cadastro-grupo-${grupo.id}-${grande ? 'm' : 'd'}`}>
          <h2 id={`cadastro-grupo-${grupo.id}-${grande ? 'm' : 'd'}`} className="px-3 pb-1 text-xs font-bold uppercase tracking-wide text-[#718087]">{grupo.label}</h2>
          <ul className="space-y-0.5">{categoriasDoGrupo(grupo.id).map(categoria => item(categoria.id, grande))}</ul>
        </section>
      ))}
      {mostrarLixeira && <ul className="border-t border-slate-100 pt-3">{item('lixeira', grande)}</ul>}
    </div>
  );

  return (
    <>
      <nav aria-label="Tipos de cadastro" data-testid="cadastro-categorias" data-cadastros-reveal className="hidden self-start rounded-2xl border border-slate-200 bg-white p-2 py-3 lg:sticky lg:top-4 lg:block">
        {lista(false)}
      </nav>

      <div className="lg:hidden" data-cadastros-reveal>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={aberto}
          onClick={() => setAberto(true)}
          data-testid="cadastro-escolher-tipo"
          className={`flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-left text-base font-semibold text-slate-800 ${FOCO}`}
        >
          <Icone className="size-5 shrink-0 text-[#176b4d]" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate"><span className="font-normal text-slate-500">Tipo: </span>{nomeDaVista(value)}</span>
          <span className="text-sm font-bold tabular-nums text-slate-400">{contar(value).toLocaleString('pt-BR')}</span>
          <ChevronDown className="size-5 text-slate-500" aria-hidden="true" />
        </button>
      </div>

      {aberto && createPortal(
        <div className="fixed inset-0 z-[125] flex items-end bg-black/40 lg:hidden" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAberto(false); }}>
          <div ref={folha} role="dialog" aria-modal="true" aria-label="Escolher tipo de cadastro" className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-white px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
            <nav aria-label="Tipos de cadastro no celular">{lista(true)}</nav>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
