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
import { TelaCheia } from '../shared/ui/TelaCheia';
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
  const escopo = useRef<HTMLElement>(null);

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

  useGSAP(() => {
    const raiz = escopo.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(
      raiz.querySelectorAll('[data-relatorios-reveal]'),
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.45, stagger: 0.05, ease: 'power3.out', clearProps: 'transform,opacity' },
    );
  }, { scope: escopo });

  const conteudo = (
    <div className="space-y-8">
      <section data-relatorios-reveal>
        <h2 className="mb-4 text-lg font-bold text-slate-900">Relatórios Disponíveis</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {itens.map((item) => {
            const liberado = podeAbrir(item.aba);
            const vazio = item.base.total === 0;
            return (
              <button
                key={item.aba}
                type="button"
                onClick={() => liberado && onAbrir(item.aba)}
                disabled={!liberado}
                data-testid={`relatorio-${item.aba}`}
                className={`
                  group relative rounded-xl border-2 p-6 transition-all duration-200
                  ${liberado
                    ? 'border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:-translate-y-1 hover:shadow-md'
                    : 'border-slate-100 bg-slate-50 text-slate-400'
                  }
                `}
              >
                <div className="mb-3 flex items-start justify-between">
                  <item.Icone className={`size-6 ${liberado ? 'text-emerald-700' : 'text-slate-400'}`} />
                  <span
                    className={`rounded px-2 py-1 text-xs font-bold ${
                      vazio
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {textoBase(item.base, ...item.unidade)}
                  </span>
                </div>
                <h3 className="text-left font-bold text-slate-950">{item.titulo}</h3>
                <p className="mt-1 text-left text-xs text-slate-600">{item.oQueMostra}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section data-relatorios-reveal>
        <h2 className="mb-4 text-lg font-bold text-slate-900">Em Desenvolvimento</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SEM_LANCAMENTO.map(item => (
            <div
              key={item}
              className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6"
            >
              <p className="font-medium text-slate-600">{item}</p>
              <p className="mt-1 text-xs text-slate-500">Aguardando funcionalidade</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  return (
    <TelaCheia ref={escopo} id="relatorios-tab" testId="relatorios-tab" rotulo="Relatórios" className="erp-module" longa rotuloDados="Relatórios disponíveis"
      cabecalho={<div data-relatorios-reveal>
        <PageHeader eyebrow="Consulta" title="Relatórios" />
      </div>}
      faixa={<p data-relatorios-reveal className="px-1 text-sm text-slate-600">Escolha o relatório. Ele abre na aba onde o dado é lançado, com os mesmos números de lá.</p>}
    >
      {conteudo}
    </TelaCheia>
  );
}
