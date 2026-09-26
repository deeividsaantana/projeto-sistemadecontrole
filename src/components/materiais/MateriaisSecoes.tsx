import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { Boxes, ChevronDown, FileSpreadsheet, LayoutDashboard, ListOrdered, Package, Route, type LucideIcon } from 'lucide-react';
import { FOCO, reduzMovimento } from '../cadastros/estilos';

export type SecaoMateriais = 'resumo' | 'utilizacao' | 'estoque' | 'movimentos' | 'cadastro' | 'importacoes';

interface Secao {
  id: SecaoMateriais;
  nome: string;
  Icone: LucideIcon;
}

const GRUPOS: ReadonlyArray<{ id: string; nome: string; secoes: readonly Secao[] }> = [
  {
    id: 'acompanhar',
    nome: 'Acompanhar',
    secoes: [
      { id: 'resumo', nome: 'Visão geral', Icone: LayoutDashboard },
      { id: 'utilizacao', nome: 'Uso por ramo', Icone: Route },
      { id: 'estoque', nome: 'Estoque', Icone: Boxes },
      { id: 'movimentos', nome: 'Movimentos', Icone: ListOrdered },
    ],
  },
  {
    id: 'cadastrar',
    nome: 'Cadastrar',
    secoes: [
      { id: 'cadastro', nome: 'Materiais', Icone: Package },
      { id: 'importacoes', nome: 'Importar planilha', Icone: FileSpreadsheet },
    ],
  },
];

const TODAS = GRUPOS.flatMap(grupo => grupo.secoes);

export const nomeDaSecao = (id: SecaoMateriais) => TODAS.find(secao => secao.id === id)?.nome ?? '';

interface Props {
  value: SecaoMateriais;
  secoes: readonly SecaoMateriais[];
  contar: (id: SecaoMateriais) => number | null;
  onSelect: (id: SecaoMateriais) => void;
}

/**
 * Escolha da parte de Materiais, no mesmo desenho de Cadastros: no computador
 * é uma coluna fixa com as partes e a quantidade de cada uma; no celular vira
 * um seletor grande que abre a lista de baixo para cima.
 */
export default function MateriaisSecoes({ value, secoes, contar, onSelect }: Props) {
  const [aberto, setAberto] = useState(false);
  const folha = useRef<HTMLDivElement>(null);
  const atual = TODAS.find(secao => secao.id === value) ?? TODAS[0];
  const IconeAtual = atual.Icone;

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

  const escolher = (id: SecaoMateriais) => {
    setAberto(false);
    onSelect(id);
  };

  const quantidade = (id: SecaoMateriais) => {
    const total = contar(id);
    return total == null ? '' : total.toLocaleString('pt-BR');
  };

  const item = ({ id, nome, Icone }: Secao, grande: boolean) => {
    const ativo = value === id;
    return (
      <li key={id}>
        <button
          type="button"
          aria-current={ativo ? 'true' : undefined}
          data-testid={`materiais-secao-${id}`}
          onClick={() => escolher(id)}
          className={`flex w-full min-w-0 items-center gap-3 rounded-xl px-3 text-left font-semibold transition duration-200 ${FOCO} ${grande ? 'min-h-12 text-base' : 'min-h-10 text-sm'} ${ativo
            ? 'is-active bg-[#176b4d] text-white'
            : 'text-slate-700 hover:bg-emerald-50 hover:text-[#176b4d]'}`}
        >
          <Icone className="size-[18px] shrink-0 opacity-80" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{nome}</span>
          <span aria-hidden="true" className={`shrink-0 text-xs font-bold tabular-nums ${ativo ? 'text-white/80' : 'text-slate-400'}`}>{quantidade(id)}</span>
        </button>
      </li>
    );
  };

  const lista = (grande: boolean) => (
    <div className="space-y-3">
      {GRUPOS.map(grupo => {
        const visiveis = grupo.secoes.filter(secao => secoes.includes(secao.id));
        if (!visiveis.length) return null;
        return (
          <section key={grupo.id} aria-labelledby={`materiais-grupo-${grupo.id}-${grande ? 'm' : 'd'}`}>
            <h2 id={`materiais-grupo-${grupo.id}-${grande ? 'm' : 'd'}`} className="px-3 pb-1 text-xs font-bold uppercase tracking-wide text-[#718087]">{grupo.nome}</h2>
            <ul className="space-y-0.5">{visiveis.map(secao => item(secao, grande))}</ul>
          </section>
        );
      })}
    </div>
  );

  return (
    <>
      <nav aria-label="Partes de materiais" data-materiais-reveal className="hidden self-start rounded-2xl border border-slate-200 bg-white p-2 py-3 lg:sticky lg:top-4 lg:block">
        {lista(false)}
      </nav>

      <div className="lg:hidden" data-materiais-reveal>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={aberto}
          onClick={() => setAberto(true)}
          data-testid="materiais-escolher-secao"
          className={`flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-left text-base font-semibold text-slate-800 ${FOCO}`}
        >
          <IconeAtual className="size-5 shrink-0 text-[#176b4d]" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate"><span className="font-normal text-slate-500">Ver: </span>{atual.nome}</span>
          <span className="text-sm font-bold tabular-nums text-slate-400">{quantidade(value)}</span>
          <ChevronDown className="size-5 text-slate-500" aria-hidden="true" />
        </button>
      </div>

      {aberto && createPortal(
        <div className="fixed inset-0 z-[125] flex items-end bg-black/40 lg:hidden" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAberto(false); }}>
          <div ref={folha} role="dialog" aria-modal="true" aria-label="Escolher parte de materiais" className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-white px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
            <nav aria-label="Partes de materiais no celular">{lista(true)}</nav>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
