/**
 * Central de pendências. Nada aqui é salvo: cada linha é derivada dos próprios
 * registros e some sozinha quando a origem é resolvida. Por isso a tela sempre
 * leva para onde a pendência se resolve, em vez de virar uma segunda lista.
 */
import { useMemo, useState } from 'react';
import { CheckCircle2, Download } from 'lucide-react';
import { listarPendencias, resumoPendencias, type ContextoPendencias, type GravidadePendencia } from '../utils/pendencias';
import { Button, DataTable, EmptyState, PageHeader, PeriodFilter, StatusBadge, buildPeriod, type PeriodValue } from '../shared/ui';

interface PendenciasTabProps {
  dados: Omit<ContextoPendencias, 'hoje' | 'inicio' | 'fim'>;
  onNavigate: (tab: string) => void;
}

const ROTULO: Record<GravidadePendencia, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

export default function PendenciasTab({ dados, onNavigate }: PendenciasTabProps) {
  const [period, setPeriod] = useState<PeriodValue>(() => buildPeriod('mes'));
  const [abaAtiva, setAbaAtiva] = useState('todas');
  const hoje = new Date().toISOString().slice(0, 10);

  const pendencias = useMemo(
    () => listarPendencias({ ...dados, hoje, inicio: period.from, fim: period.to }),
    [dados, hoje, period.from, period.to],
  );
  const resumo = resumoPendencias(pendencias);

  const porCategoria = useMemo(() => {
    const mapa = new Map<string, typeof pendencias>();
    pendencias.forEach(item => mapa.set(item.categoria, [...(mapa.get(item.categoria) || []), item]));
    return [...mapa.entries()];
  }, [pendencias]);

  const abas = useMemo(() => [
    { id: 'todas', rotulo: `Todas (${resumo.registros})` },
    ...porCategoria.map(([categoria, itens]) => ({
      id: categoria,
      rotulo: `${categoria} (${itens.reduce((total, item) => total + item.quantidade, 0)})`,
    })),
  ], [porCategoria, resumo.registros]);

  const listadas = abaAtiva === 'todas' ? pendencias : pendencias.filter(item => item.categoria === abaAtiva);

  return (
    <div id="pendencias-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Pendências"
        description="Itens que necessitam de atenção e resolução."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <PeriodFilter value={period} onChange={setPeriod} />
            <Button variant="primary" icon={Download} onClick={() => window.print()}>Exportar</Button>
          </div>
        )}
      />

      <div className="mt-4 flex flex-wrap gap-1.5">
        {abas.map(aba => (
          <button
            key={aba.id}
            type="button"
            onClick={() => setAbaAtiva(aba.id)}
            aria-pressed={abaAtiva === aba.id}
            className={`h-9 rounded-lg px-4 text-[12px] font-semibold transition-colors ${abaAtiva === aba.id
              ? 'bg-[#087353] text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-400'}`}
          >
            {aba.rotulo}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <DataTable
          larguraMinima={860}
          itens={listadas}
          chaveDe={item => item.id}
          vazio={<EmptyState icon={CheckCircle2} title="Nenhuma pendência no período" description="Todos os registros do período estão em dia." />}
          colunas={[
            {
              chave: 'prioridade',
              titulo: 'Prioridade',
              render: item => <StatusBadge>{ROTULO[item.gravidade]}</StatusBadge>,
            },
            {
              chave: 'quantidade',
              titulo: 'Quantidade',
              render: item => <strong className="text-[15px] font-bold tabular-nums text-slate-900">{item.quantidade}</strong>,
            },
            { chave: 'descricao', titulo: 'Descrição', render: item => item.titulo, larguraMinima: 280 },
            { chave: 'categoria', titulo: 'Categoria', render: item => item.categoria, ocultarNoCelular: true },
            {
              chave: 'acao',
              titulo: 'Ações',
              alinhamento: 'direita',
              render: item => (
                <button
                  type="button"
                  onClick={() => onNavigate(item.tab)}
                  className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700"
                >
                  Ver detalhes
                </button>
              ),
            },
          ]}
        />
      </div>
    </div>
  );

}
