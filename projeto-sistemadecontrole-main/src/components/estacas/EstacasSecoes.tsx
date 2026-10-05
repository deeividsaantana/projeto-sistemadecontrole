import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { ChevronDown, FileBarChart, FileSpreadsheet, Hammer, LayoutDashboard, ListOrdered, PackageCheck, type LucideIcon } from 'lucide-react';
import { FOCO, reduzMovimento } from '../cadastros/estilos';

export type SecaoEstacas = 'visao' | 'cravar' | 'estacas' | 'relatorios' | 'recebimentos' | 'importar';

interface Secao {
  id: SecaoEstacas;
  nome: string;
  ajuda: string;
  Icone: LucideIcon;
}

const GRUPOS: ReadonlyArray<{ id: string; nome: string; secoes: readonly Secao[] }> = [
  {
    id: 'painel',
    nome: 'Painel',
    secoes: [
      { id: 'visao', nome: 'Visão geral', ajuda: 'Quanto falta e o desenho da cortina', Icone: LayoutDashboard },
      { id: 'relatorios', nome: 'Relatórios', ajuda: 'Por frente, dia a dia e estaca por estaca', Icone: FileBarChart },
    ],
  },
  {
    id: 'obra',
    nome: 'Na obra',
    secoes: [
      { id: 'cravar', nome: 'Lançar cravação', ajuda: 'A estaca que entrou hoje', Icone: Hammer },
      { id: 'estacas', nome: 'Estacas', ajuda: 'Todas, cravadas e a cravar', Icone: ListOrdered },
    ],
  },
  {
    id: 'controle',
    nome: 'Controle',
    secoes: [
      { id: 'recebimentos', nome: 'Recebimentos', ajuda: 'Notas fiscais, lotes e saldo', Icone: PackageCheck },
      { id: 'importar', nome: 'Importar planilha', ajuda: 'Trazer o controle do Excel', Icone: FileSpreadsheet },
    ],
  },
];

const TODAS = GRUPOS.flatMap(grupo => grupo.secoes);

interface Props {
  value: SecaoEstacas;
  contar: (id: SecaoEstacas) => number | null;
  /** Número em laranja: o que pede atenção (estacas que faltam, notas a conferir). */
  alerta?: (id: SecaoEstacas) => number;
  onSelect: (id: SecaoEstacas) => void;
}

/** Mesmo menu de Materiais: coluna fixa no computador, seletor grande no celular. */
export default function EstacasSecoes({ value, contar, alerta = () => 0, onSelect }: Props) {
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
    const tecla = (event: KeyboardEvent) => { if (event.key === 'Escape') setAberto(false); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [aberto]);

  const escolher = (id: SecaoEstacas) => {
    setAberto(false);
    onSelect(id);
  };

  const marcador = (id: SecaoEstacas, ativo: boolean) => {
    const atencao = alerta(id);
    if (atencao > 0) {
      return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${ativo ? 'bg-white text-[#f26a2e]' : 'bg-[#f26a2e] text-white'}`}>{atencao.toLocaleString('pt-BR')}</span>;
    }
    const total = contar(id);
    return <span aria-hidden="true" className={`shrink-0 text-xs font-bold tabular-nums ${ativo ? 'text-white/80' : 'text-slate-400'}`}>{total == null ? '' : total.toLocaleString('pt-BR')}</span>;
  };

  const lista = (grande: boolean) => (
    <div className="space-y-3">
      {GRUPOS.map(grupo => (
        <section key={grupo.id} aria-labelledby={`estacas-grupo-${grupo.id}-${grande ? 'm' : 'd'}`}>
          <h2 id={`estacas-grupo-${grupo.id}-${grande ? 'm' : 'd'}`} className="px-3 pb-1 text-xs font-bold uppercase tracking-wide text-[#718087]">{grupo.nome}</h2>
          <ul className="space-y-0.5">
            {grupo.secoes.map(({ id, nome, ajuda, Icone }) => {
              const ativo = value === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    aria-current={ativo ? 'true' : undefined}
                    data-testid={`estacas-secao-${id}`}
                    onClick={() => escolher(id)}
                    className={`group flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left font-semibold transition duration-200 ${FOCO} ${grande ? 'min-h-14 text-base' : 'min-h-12 text-sm'} ${ativo ? 'is-active bg-[#176b4d] text-white' : 'text-slate-700 hover:bg-emerald-50 hover:text-[#176b4d]'}`}
                  >
                    <Icone className={`size-[18px] shrink-0 transition-transform duration-200 motion-reduce:transition-none ${ativo ? '' : 'opacity-80 group-hover:scale-110'}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2"><span className="min-w-0 break-words">{nome}</span>{marcador(id, ativo)}</span>
                      <span className={`block text-xs font-normal leading-snug ${ativo ? 'text-white/80' : 'text-slate-500'}`}>{ajuda}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );

  return (
    <>
      <nav aria-label="Partes de estacas" data-estacas-reveal className="hidden self-stretch rounded-2xl border border-slate-200 bg-white lg:block">
        <div className="estacas-menu p-2 py-3 lg:sticky lg:top-4">{lista(false)}</div>
      </nav>

      <div className="lg:hidden" data-estacas-reveal>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={aberto}
          onClick={() => setAberto(true)}
          data-testid="estacas-escolher-secao"
          className={`flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-left text-base font-semibold text-slate-800 ${FOCO}`}
        >
          <IconeAtual className="size-5 shrink-0 text-[#176b4d]" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate"><span className="font-normal text-slate-500">Ver: </span>{atual.nome}</span>
          {marcador(value, false)}
          <ChevronDown className="size-5 text-slate-500" aria-hidden="true" />
        </button>
      </div>

      {aberto && createPortal(
        <div className="fixed inset-0 z-[125] flex items-end bg-black/40 lg:hidden" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAberto(false); }}>
          <div ref={folha} role="dialog" aria-modal="true" aria-label="Escolher parte de estacas" className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-white px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
            <nav aria-label="Partes de estacas no celular">{lista(true)}</nav>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
