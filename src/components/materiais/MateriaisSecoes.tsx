import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { Boxes, ChartPie, ClipboardPen, FileBarChart, ChevronDown, FileSpreadsheet, LayoutDashboard, ListOrdered, MapPinned, Package, Route, Target, Truck, UserRoundCheck, type LucideIcon } from 'lucide-react';
import { FOCO, reduzMovimento } from '../cadastros/estilos';

export type SecaoMateriais = 'lancar' | 'resumo' | 'graficos' | 'relatorios' | 'previsto' | 'utilizacao' | 'apontadores' | 'botafora' | 'estoque' | 'movimentos' | 'cadastro' | 'locais' | 'importacoes';

interface Secao {
  id: SecaoMateriais;
  nome: string;
  /** Uma linha dizendo o que tem ali, para ninguém precisar abrir para descobrir. */
  ajuda: string;
  Icone: LucideIcon;
}

const GRUPOS: ReadonlyArray<{ id: string; nome: string; secoes: readonly Secao[] }> = [
  {
    id: 'lancar',
    nome: 'Lançar',
    secoes: [
      { id: 'lancar', nome: 'Lançar', ajuda: 'Chegou, saiu, transporte ou várias viagens, na tela toda', Icone: ClipboardPen },
    ],
  },
  {
    id: 'painel',
    nome: 'Painel',
    secoes: [
      { id: 'resumo', nome: 'Visão geral', ajuda: 'Avisos, estoque e o período', Icone: LayoutDashboard },
      { id: 'graficos', nome: 'Gráficos', ajuda: 'Pizzas com a porcentagem de cada parte', Icone: ChartPie },
      { id: 'relatorios', nome: 'Relatórios', ajuda: 'Tabelas por material, fornecedor, ramo e mês', Icone: FileBarChart },
    ],
  },
  {
    id: 'obra',
    nome: 'Na obra',
    secoes: [
      { id: 'previsto', nome: 'Previsto do mês', ajuda: 'Meta de cada ramo e o que já chegou', Icone: Target },
      { id: 'utilizacao', nome: 'Uso por ramo', ajuda: 'Quanto cada ramo recebeu e usou', Icone: Route },
      { id: 'apontadores', nome: 'Apontadores', ajuda: 'Envios do campo, fotos e o link', Icone: UserRoundCheck },
      { id: 'botafora', nome: 'Bota-fora', ajuda: 'Viagens para Itaquareia, Lara e São Bento', Icone: Truck },
    ],
  },
  {
    id: 'controle',
    nome: 'Controle',
    secoes: [
      { id: 'estoque', nome: 'Estoque', ajuda: 'Quanto sobra de cada material', Icone: Boxes },
      { id: 'movimentos', nome: 'Movimentos', ajuda: 'Tudo que entrou, saiu ou mudou de lugar', Icone: ListOrdered },
    ],
  },
  {
    id: 'cadastrar',
    nome: 'Cadastrar',
    secoes: [
      { id: 'cadastro', nome: 'Materiais', ajuda: 'Cadastro, unidade e mínimo', Icone: Package },
      { id: 'locais', nome: 'Ramos e locais', ajuda: 'Códigos SGE e nomes da planilha', Icone: MapPinned },
      { id: 'importacoes', nome: 'Importar planilha', ajuda: 'Trazer viagens do Excel', Icone: FileSpreadsheet },
    ],
  },
];

const TODAS = GRUPOS.flatMap(grupo => grupo.secoes);

export const nomeDaSecao = (id: SecaoMateriais) => TODAS.find(secao => secao.id === id)?.nome ?? '';

interface Props {
  value: SecaoMateriais;
  secoes: readonly SecaoMateriais[];
  contar: (id: SecaoMateriais) => number | null;
  /** Avisos abertos de cada parte: aparecem em laranja no lugar da contagem. */
  avisos?: (id: SecaoMateriais) => number;
  onSelect: (id: SecaoMateriais) => void;
  /** Sem a coluna do computador: o seletor de cima vale em qualquer tela. */
  compacto?: boolean;
}

/**
 * Escolha da parte de Materiais, no mesmo desenho de Cadastros: no computador
 * é uma coluna fixa com as partes e a quantidade de cada uma; no celular vira
 * um seletor grande que abre a lista de baixo para cima.
 */
export default function MateriaisSecoes({ value, secoes, contar, avisos = () => 0, onSelect, compacto = false }: Props) {
  const [aberto, setAberto] = useState(false);
  const folha = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
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

  // Parte escolhida por atalho ou botão fica à vista no menu, sem rolar a página.
  useEffect(() => {
    const caixa = menu.current;
    const ativo = caixa?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!caixa || !ativo) return;
    const topo = ativo.getBoundingClientRect().top - caixa.getBoundingClientRect().top + caixa.scrollTop;
    if (topo < caixa.scrollTop) caixa.scrollTop = topo - 8;
    else if (topo + ativo.offsetHeight > caixa.scrollTop + caixa.clientHeight) caixa.scrollTop = topo + ativo.offsetHeight - caixa.clientHeight + 8;
  }, [value]);

  const escolher = (id: SecaoMateriais) => {
    setAberto(false);
    onSelect(id);
  };

  const quantidade = (id: SecaoMateriais) => {
    const total = contar(id);
    return total == null ? '' : total.toLocaleString('pt-BR');
  };

  const marcador = (id: SecaoMateriais, ativo: boolean) => {
    const abertos = avisos(id);
    if (abertos > 0) {
      return (
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${ativo ? 'bg-white text-[#f26a2e]' : 'bg-[#f26a2e] text-white'}`}>
          {abertos.toLocaleString('pt-BR')}
          <span className="sr-only"> aviso(s)</span>
        </span>
      );
    }
    return <span aria-hidden="true" className={`shrink-0 text-xs font-bold tabular-nums ${ativo ? 'text-white/80' : 'text-slate-400'}`}>{quantidade(id)}</span>;
  };

  const item = ({ id, nome, ajuda, Icone }: Secao, grande: boolean) => {
    const ativo = value === id;
    return (
      <li key={id}>
        <button
          type="button"
          aria-current={ativo ? 'true' : undefined}
          data-testid={`materiais-secao-${id}`}
          aria-describedby={`materiais-ajuda-${id}-${grande ? 'm' : 'd'}`}
          onClick={() => escolher(id)}
          className={`group flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left font-semibold transition duration-200 ${FOCO} ${grande ? 'min-h-14 text-base' : 'min-h-12 text-sm'} ${ativo
            ? 'is-active bg-[#176b4d] text-white'
            : 'text-slate-700 hover:bg-emerald-50 hover:text-[#176b4d]'}`}
        >
          <Icone className={`size-[18px] shrink-0 transition-transform duration-200 motion-reduce:transition-none ${ativo ? 'opacity-100' : 'opacity-80 group-hover:scale-110 group-hover:text-[#176b4d]'}`} aria-hidden="true" />
          {/* O número fica ao lado do nome e a explicação usa a largura toda:
              no menu estreito do computador o nome não é mais cortado. */}
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2">
              <span className="min-w-0 break-words">{nome}</span>
              {marcador(id, ativo)}
            </span>
            <span id={`materiais-ajuda-${id}-${grande ? 'm' : 'd'}`} aria-hidden="true" className={`block text-xs font-normal leading-snug ${ativo ? 'text-white/80' : 'text-slate-500'}`}>{ajuda}</span>
          </span>
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
      {/* O cartão ocupa a coluna inteira, sem sobrar faixa em branco; a lista fica parada ao rolar. */}
      <nav aria-label="Partes de materiais" data-materiais-reveal className={`${compacto ? 'hidden' : 'hidden lg:block'} self-stretch rounded-2xl border border-slate-200 bg-white`}>
        <div ref={menu} className="materiais-menu p-2 py-3 lg:sticky lg:top-4">{lista(false)}</div>
      </nav>

      <div className={compacto ? 'lg:max-w-md' : 'lg:hidden'} data-materiais-reveal>
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
          {marcador(value, false)}
          <ChevronDown className="size-5 text-slate-500" aria-hidden="true" />
        </button>
      </div>

      {aberto && createPortal(
        <div className={`fixed inset-0 z-[125] flex items-end bg-black/40 ${compacto ? 'lg:items-center lg:justify-center' : 'lg:hidden'}`} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAberto(false); }}>
          <div ref={folha} role="dialog" aria-modal="true" aria-label="Escolher parte de materiais" className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-white lg:max-w-md lg:rounded-3xl px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
            <nav aria-label="Partes de materiais no celular">{lista(true)}</nav>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
