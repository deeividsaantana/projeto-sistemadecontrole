import gsap from 'gsap';
import { Building2, Droplets, Fuel, HardHat, MapPin, Route, Truck, Users, type LucideIcon } from 'lucide-react';
import {
  CADASTRO_GRUPOS,
  categoriasDoGrupo,
  type CadastroCategoriaId,
} from '../../utils/cadastrosCategorias';

const ICONES: Record<CadastroCategoriaId, LucideIcon> = {
  funcionarios: Users,
  empresas: Building2,
  fornecedores: Building2,
  terceiras: HardHat,
  equipamentos: Truck,
  veiculos: Truck,
  comboios: Fuel,
  obras: MapPin,
  etapas: Route,
  combustiveis: Fuel,
  lubrificantes: Droplets,
};

interface Props {
  value: CadastroCategoriaId;
  getCount: (id: CadastroCategoriaId) => number;
  onSelect: (id: CadastroCategoriaId) => void;
}

/**
 * Escolha do tipo de cadastro, sempre visível e agrupada. Cada botão já diz
 * quantos registros existem, então a pessoa enxerga a base inteira sem abrir
 * nada, e o toque tem altura de 48px para uso em tablet no canteiro.
 */
export default function CadastroCategoryPicker({ value, getCount, onSelect }: Props) {
  const selecionar = (id: CadastroCategoriaId, botao: HTMLButtonElement) => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(botao, { scale: 0.96 }, { scale: 1, duration: 0.2, ease: 'power2.out', clearProps: 'transform' });
    }
    onSelect(id);
  };

  return (
    <nav aria-label="Tipos de cadastro" data-testid="cadastro-categorias" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {CADASTRO_GRUPOS.map(grupo => (
        <section key={grupo.id} data-cadastros-reveal aria-labelledby={`cadastro-grupo-${grupo.id}`} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <h2 id={`cadastro-grupo-${grupo.id}`} className="px-1 pb-2 text-xs font-black uppercase tracking-wide text-[#718087]">{grupo.label}</h2>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-1">
            {categoriasDoGrupo(grupo.id).map(categoria => {
              const Icone = ICONES[categoria.id];
              const ativo = value === categoria.id;
              return (
                <button
                  key={categoria.id}
                  type="button"
                  aria-pressed={ativo}
                  data-testid={`cadastro-categoria-${categoria.id}`}
                  onClick={event => selecionar(categoria.id, event.currentTarget)}
                  className={`flex min-h-12 w-full min-w-0 items-center gap-2 rounded-xl border px-2 sm:gap-3 sm:px-3 text-left text-sm font-bold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f26a2e]/60 ${ativo
                    ? 'is-active border-[#176b4d] bg-[#176b4d] text-white shadow-sm'
                    : 'border-transparent bg-slate-50 text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-[#176b4d]'}`}
                >
                  <Icone className="hidden size-5 shrink-0 sm:block" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-[13px] sm:text-sm">{categoria.label}</span>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-black sm:px-2 tabular-nums ${ativo ? 'bg-white/20 text-white' : 'bg-white text-slate-500'}`}>
                    {getCount(categoria.id).toLocaleString('pt-BR')}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}
