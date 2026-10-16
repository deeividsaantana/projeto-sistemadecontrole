/**
 * Índice dos relatórios que têm dado de verdade. Cada relatório mora na aba
 * onde o dado é lançado (Combustível, Controle de Frotas, Presença, Materiais,
 * Estacas); aqui a pessoa vê quanto dado existe por trás e abre direto na
 * parte de relatório daquela aba. Áreas que ainda não têm lançamento no app
 * aparecem como vazias, sem tabela de mentira.
 */
import { useMemo, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ChevronRight, Fuel, Hammer, Lock, Package, Truck, Users, type LucideIcon } from 'lucide-react';
import type { Abastecimento, ControleEquipamentoDiario, CravacaoEstaca, MovimentoMaterial, PresencaApontamento } from '../types';
import { PageHeader } from '../shared/ui';
import { resumirBase, textoBase, type BaseRelatorio } from '../utils/centralRelatorios';
import { CARTAO, FOCO } from './cadastros/estilos';

/** Abas que sabem abrir já na parte de relatório. */
export type DestinoRelatorio = 'lancamentos' | 'controle-equipamentos' | 'presenca' | 'materiais' | 'estacas';

interface RelatoriosTabProps {
  abastecimentos: Abastecimento[];
  controlesEquipamentos: ControleEquipamentoDiario[];
  presencas: PresencaApontamento[];
  movimentosMaterial: MovimentoMaterial[];
  cravacoes: CravacaoEstaca[];
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

/** Relatórios que ainda não existem porque o app não recebe esses lançamentos. */
const SEM_LANCAMENTO = ['Produção e avanço físico', 'Planejamento', 'Custos', 'Medições', 'Qualidade (FVS e não conformidades)', 'Ocorrências e horas paradas'];

export default function RelatoriosTab({
  abastecimentos, controlesEquipamentos, presencas, movimentosMaterial, cravacoes, podeAbrir, onAbrir,
}: RelatoriosTabProps) {
  const escopo = useRef<HTMLDivElement>(null);

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
      aba: 'presenca',
      titulo: 'Presença por período',
      onde: 'Presença e Controle',
      oQueMostra: 'Como foi o período, presença por equipe, por empresa e por pessoa. Exporta em Excel.',
      Icone: Users,
      base: resumirBase(presencas),
      unidade: ['envio de presença', 'envios de presença'],
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
  ], [abastecimentos, controlesEquipamentos, presencas, movimentosMaterial, cravacoes]);

  useGSAP(() => {
    const raiz = escopo.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(
      raiz.querySelectorAll('[data-relatorios-reveal]'),
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.45, stagger: 0.05, ease: 'power3.out', clearProps: 'transform,opacity' },
    );
  }, { scope: escopo });

  return (
    <div ref={escopo} id="relatorios-tab" data-testid="relatorios-tab" className="erp-module space-y-4">
      <div data-relatorios-reveal>
        <PageHeader
          eyebrow="Gestão"
          title="Relatórios"
          description="Escolha o relatório. Ele abre na aba onde o dado é lançado, com os mesmos números de lá."
        />
      </div>

      <ul className="grid gap-3 lg:grid-cols-2" aria-label="Relatórios disponíveis">
        {itens.map(item => {
          const liberado = podeAbrir(item.aba);
          const vazio = item.base.total === 0;
          return (
            <li key={item.aba} data-relatorios-reveal className="min-w-0">
              <button
                type="button"
                disabled={!liberado}
                onClick={() => onAbrir(item.aba)}
                data-testid={`relatorio-${item.aba}`}
                className={`${CARTAO} group flex h-full w-full items-start gap-3 p-4 text-left transition duration-200 enabled:hover:border-emerald-500 enabled:hover:shadow-sm enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-50 ${FOCO}`}
              >
                <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${liberado ? 'bg-emerald-50 text-[#176b4d]' : 'bg-slate-100 text-slate-400'}`}>
                  <item.Icone className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-slate-500">em {item.onde}</span>
                  <span className="mt-0.5 block text-base font-bold text-slate-900">{item.titulo}</span>
                  <span className="mt-1 block text-sm leading-snug text-slate-600 [text-wrap:pretty]">{item.oQueMostra}</span>
                  <span className={`mt-2 inline-flex rounded-lg px-2 py-1 text-xs font-bold tabular-nums ${vazio ? 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200' : 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200'}`}>
                    {textoBase(item.base, ...item.unidade)}
                  </span>
                  {!liberado && (
                    <span className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <Lock className="size-3.5" aria-hidden="true" /> Seu perfil não abre esta aba.
                    </span>
                  )}
                </span>
                {liberado && (
                  <span className="hidden shrink-0 items-center gap-1 self-center text-sm font-bold text-[#176b4d] sm:flex">
                    Abrir <ChevronRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                )}
                {liberado && <ChevronRight className="size-5 shrink-0 self-center text-[#176b4d] sm:hidden" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>

      <section data-relatorios-reveal aria-labelledby="relatorios-sem-dado" className={`${CARTAO} p-4`}>
        <h2 id="relatorios-sem-dado" className="text-sm font-bold text-slate-900">Ainda sem relatório</h2>
        <p className="mt-1 text-sm text-slate-600">
          Não há lançamentos destas áreas no app, então não há o que somar. O relatório entra aqui quando elas forem usadas.
        </p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {SEM_LANCAMENTO.map(area => (
            <li key={area} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{area}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
