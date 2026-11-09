/**
 * Índice dos relatórios que têm dado de verdade. Cada relatório mora na aba
 * onde o dado é lançado (Combustível, Controle de Frotas, Presença, Materiais,
 * Estacas); aqui a pessoa vê quanto dado existe por trás e abre direto na
 * parte de relatório daquela aba. Áreas que ainda não têm lançamento no app
 * aparecem como vazias, sem tabela de mentira.
 */
import { useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ChevronRight, Fuel, Hammer, LayoutGrid, Lock, Package, Search, Truck, Users, type LucideIcon } from 'lucide-react';
import type { Abastecimento, ControleEquipamentoDiario, CravacaoEstaca, MovimentoMaterial, PresencaApontamento, Funcionario, Equipamento } from '../types';
import { PageHeader } from '../shared/ui';
import { TelaCheia } from '../shared/ui/TelaCheia';
import { AbasDaTela, idDaAba, type AbaDaTela } from '../shared/ui/AbasDaTela';
import { resumirBase, textoBase, type BaseRelatorio } from '../utils/centralRelatorios';
import { CARTAO, FOCO } from './cadastros/estilos';
import { RelatorioMotoristas } from './relatorios/RelatorioMotoristas';
import { ListaEquipamentos } from './relatorios/ListaEquipamentos';

/** Abas que sabem abrir já na parte de relatório. */
export type DestinoRelatorio = 'lancamentos' | 'controle-equipamentos' | 'presenca' | 'materiais' | 'estacas';

interface RelatoriosTabProps {
  abastecimentos: Abastecimento[];
  controlesEquipamentos: ControleEquipamentoDiario[];
  presencas: PresencaApontamento[];
  movimentosMaterial: MovimentoMaterial[];
  cravacoes: CravacaoEstaca[];
  funcionarios: Funcionario[];
  equipamentos: Equipamento[];
  podeAbrir: (aba: DestinoRelatorio) => boolean;
  onAbrir: (aba: DestinoRelatorio) => void;
}

interface ItemRelatorio {
  aba: DestinoRelatorio;
  titulo: string;
  onde: string;
  oQueMostra: string;
  Icone: LucideIcon;
  base: BaseRelatorio;
  unidade: [string, string];
}

type SecaoRelatorios = 'areas' | 'motoristas' | 'equipamentos';

const SECOES: ReadonlyArray<AbaDaTela<SecaoRelatorios>> = [
  { id: 'areas', rotulo: 'Por área', icone: LayoutGrid },
  { id: 'motoristas', rotulo: 'Motoristas', icone: Users },
  { id: 'equipamentos', rotulo: 'Equipamentos', icone: Truck },
];

/** Relatórios que ainda não existem porque o app não recebe esses lançamentos. */
const SEM_LANCAMENTO = ['Produção e avanço físico', 'Planejamento', 'Custos', 'Medições', 'Qualidade (FVS e não conformidades)', 'Ocorrências e horas paradas'];

export default function RelatoriosTab({
  abastecimentos, controlesEquipamentos, presencas, movimentosMaterial, cravacoes, funcionarios, equipamentos, podeAbrir, onAbrir,
}: RelatoriosTabProps) {
  const escopo = useRef<HTMLElement>(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'com-dados' | 'sem-dados'>('todos');
  const [secao, setSecao] = useState<SecaoRelatorios>('areas');

  const itens = useMemo<ItemRelatorio[]>(() => [
    {
      aba: 'lancamentos',
      titulo: 'Diesel por máquina',
      onde: 'Combustível',
      oQueMostra: 'Litros, horas ou km, consumo médio e quem gasta acima do normal. Exporta em Excel.',
      Icone: Fuel,
      base: resumirBase(abastecimentos),
      unidade: ['abastecimento', 'abastecimentos'],
    },
    {
      aba: 'controle-equipamentos',
      titulo: 'Relatório do dia da frota',
      onde: 'Controle de Frotas',
      oQueMostra: 'Equipamentos e operadores do dia, com conferência. No topo da aba, botão Relatórios: PDF ou Excel.',
      Icone: Truck,
      base: resumirBase(controlesEquipamentos),
      unidade: ['lançamento', 'lançamentos'],
    },
    {
      aba: 'materiais',
      titulo: 'Materiais e estoque',
      onde: 'Materiais e Estoque',
      oQueMostra: 'Tabelas por material, fornecedor, ramo e mês, prontas para imprimir.',
      Icone: Package,
      base: resumirBase(movimentosMaterial),
      unidade: ['movimento', 'movimentos'],
    },
    {
      aba: 'estacas',
      titulo: 'Estacas prancha',
      onde: 'Controle de Estacas',
      oQueMostra: 'Por frente, dia a dia e estaca por estaca, prontas para imprimir.',
      Icone: Hammer,
      base: resumirBase(cravacoes),
      unidade: ['cravação', 'cravações'],
    },
  ], [abastecimentos, controlesEquipamentos, movimentosMaterial, cravacoes]);

  const itensVisiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return itens.filter(item => {
      if (filtro === 'com-dados' && item.base.total === 0) return false;
      if (filtro === 'sem-dados' && item.base.total > 0) return false;
      if (!termo) return true;
      return `${item.titulo} ${item.onde} ${item.oQueMostra}`.toLocaleLowerCase('pt-BR').includes(termo);
    });
  }, [busca, filtro, itens]);

  useGSAP(() => {
    const raiz = escopo.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(
      raiz.querySelectorAll('[data-relatorios-reveal]'),
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.45, stagger: 0.05, ease: 'power3.out', clearProps: 'transform,opacity' },
    );
  }, { scope: escopo, dependencies: [secao] });

  const buscaEFiltros = (
    <div data-relatorios-reveal className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-[15rem] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5b6870]" aria-hidden="true" /><input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar relatório" aria-label="Buscar relatório" className="renea-control w-full pl-9" /></label>
      <div role="group" aria-label="Mostrar" className="flex flex-wrap gap-2">
        {(['todos', 'com-dados', 'sem-dados'] as const).map(opcao => <button key={opcao} type="button" onClick={() => setFiltro(opcao)} aria-pressed={filtro === opcao} className={`min-h-11 rounded-lg border px-3 text-sm font-bold transition-colors lg:min-h-10 ${FOCO} ${filtro === opcao ? 'border-[#176b4d] bg-[#176b4d] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-400'}`}>{opcao === 'todos' ? 'Todos' : opcao === 'com-dados' ? 'Com dados' : 'Sem dados'}</button>)}
      </div>
    </div>
  );

  const porArea = (
    <div className="space-y-8">
      <section data-relatorios-reveal aria-label="Relatórios por área">
        <p className="mb-3 text-sm text-slate-600">Cada relatório abre na aba onde o dado é lançado, com os mesmos números de lá.</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {itensVisiveis.map((item) => {
            const liberado = podeAbrir(item.aba);
            const vazio = item.base.total === 0;
            return (
              <button
                key={item.aba}
                type="button"
                onClick={() => liberado && onAbrir(item.aba)}
                disabled={!liberado}
                data-testid={`relatorio-${item.aba}`}
                className={`${CARTAO} group flex min-w-0 flex-col p-4 text-left transition duration-200 ${FOCO} ${liberado ? 'hover:border-emerald-300 hover:shadow-sm active:scale-[0.98]' : 'cursor-not-allowed opacity-60'}`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-[#176b4d]"><item.Icone className="size-5" aria-hidden="true" /></span>
                  <span className={`rounded-lg px-2 py-0.5 text-right text-xs font-bold ${vazio ? 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200' : 'bg-emerald-50 text-[#176b4d] ring-1 ring-inset ring-emerald-200'}`}>
                    {textoBase(item.base, ...item.unidade)}
                  </span>
                </span>
                <span className="mt-3 block text-base font-bold text-slate-900">{item.titulo}</span>
                <span className="mt-1 block text-sm text-slate-600">{item.oQueMostra}</span>
                <span className="mt-auto flex items-center gap-1 pt-3 text-sm font-bold text-[#176b4d]">
                  {liberado ? <>Abrir em {item.onde} <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></> : <><Lock className="size-4" aria-hidden="true" /> Sem acesso a {item.onde}</>}
                </span>
              </button>
            );
          })}
        </div>
        {!itensVisiveis.length && <p className="rounded-2xl border border-dashed border-slate-300 bg-[#f7f8f6] p-6 text-sm text-slate-600">Nenhum relatório corresponde à busca. Apague o texto ou escolha "Todos".</p>}
      </section>

      <section data-relatorios-reveal aria-labelledby="relatorios-sem-lancamento">
        <h2 id="relatorios-sem-lancamento" className="text-base font-bold text-slate-900">Ainda sem relatório</h2>
        <p className="mt-1 text-sm text-slate-600">O sistema ainda não recebe lançamentos destas áreas.</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {SEM_LANCAMENTO.map(item => (
            <li key={item} className="rounded-full border border-slate-200 bg-[#f7f8f6] px-3 py-1 text-sm text-slate-600">{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );

  return (
    <TelaCheia ref={escopo} id="relatorios-tab" testId="relatorios-tab" rotulo="Relatórios" className="erp-module"
      longa={secao === 'areas'} idAbaAtiva={idDaAba('relatorios', secao)} idDados="relatorios-dados" chaveRolagem={secao}
      cabecalho={<div data-relatorios-reveal>
        <PageHeader
          eyebrow="Consulta"
          title="Relatórios"
          abas={<AbasDaTela<SecaoRelatorios> id="relatorios" rotulo="Tipos de relatório" abas={SECOES} ativa={secao} onTrocar={setSecao} idPainel="relatorios-dados" testId="relatorios-aba" />}
        />
      </div>}
      faixa={secao === 'areas' ? buscaEFiltros : undefined}
    >
      {secao === 'areas' && porArea}
      {secao === 'motoristas' && <RelatorioMotoristas funcionarios={funcionarios} registros={controlesEquipamentos} />}
      {secao === 'equipamentos' && <ListaEquipamentos equipamentos={equipamentos} registros={controlesEquipamentos} />}
    </TelaCheia>
  );
}
