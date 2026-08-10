import React, { useMemo } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3 } from 'lucide-react';
import type {
  Abastecimento,
  ControleEstacas,
  MaterialRegistro,
  OrdemServico,
  ParteDiariaEquipamento,
  TicketJazida,
} from '../types';
import { buildStakeSummary } from '../utils/stakeOperations';
import { buildTravelOperationControl } from '../utils/travelOperations';

type PendingItem = {
  id: string;
  title: string;
  detail: string;
  module: string;
  moduleLabel: string;
  priority: 'Alta' | 'Média';
};

type PendenciasTabProps = {
  tickets: TicketJazida[];
  abastecimentos: Abastecimento[];
  materiais: MaterialRegistro[];
  estacas: ControleEstacas;
  ordensServico: OrdemServico[];
  partesDiarias: ParteDiariaEquipamento[];
  onNavigate: (module: string) => void;
};

export default function PendenciasTab({
  tickets,
  abastecimentos,
  materiais,
  estacas,
  ordensServico,
  partesDiarias,
  onNavigate,
}: PendenciasTabProps) {
  const pendingItems = useMemo<PendingItem[]>(() => {
    const items: PendingItem[] = [];
    const travel = buildTravelOperationControl(tickets);
    travel.operations
      .filter(item => item.status !== 'Conferido')
      .forEach(item => {
        items.push({
          id: 'ticket-' + item.ticketNumber,
          title: 'Ticket ' + item.ticketNumber + ' ' + item.status.toLowerCase(),
          detail: item.divergences.length
            ? item.divergences.map(divergence => divergence.label).join(', ')
            : 'Verifique a liberação e o recebimento vinculados.',
          module: 'tickets-jazida',
          moduleLabel: 'Viagens e tickets',
          priority: item.status === 'Divergência' || item.status === 'Ticket duplicado' ? 'Alta' : 'Média',
        });
      });

    abastecimentos
      .filter(item => (item.alertas?.length || 0) > 0 || (item.status && item.status !== 'OK'))
      .forEach(item => {
        items.push({
          id: 'abastecimento-' + item.id,
          title: 'Abastecimento requer conferência',
          detail: item.alertas?.map(alerta => alerta.mensagem).join(' ') || item.status || 'Verifique o lançamento.',
          module: 'lancamentos',
          moduleLabel: 'Combustível',
          priority: item.alertas?.some(alerta => alerta.severidade === 'critico') ? 'Alta' : 'Média',
        });
      });

    materiais
      .filter(item => item.status === 'Pendente' || item.status === 'Divergência')
      .forEach(item => {
        items.push({
          id: 'material-' + item.id,
          title: item.status === 'Divergência' ? 'Material com divergência' : 'Material pendente',
          detail: item.material + (item.nota ? ' • NF ' + item.nota : ''),
          module: 'materiais',
          moduleLabel: 'Materiais',
          priority: item.status === 'Divergência' ? 'Alta' : 'Média',
        });
      });

    const stakeSummary = buildStakeSummary(estacas);
    if (stakeSummary.saldosDivergentes > 0 || stakeSummary.notasPendentes > 0) {
      items.push({
        id: 'estacas-resumo',
        title: 'Conferência de estacas pendente',
        detail: stakeSummary.saldosDivergentes + ' saldo(s) divergente(s) e '
          + stakeSummary.notasPendentes + ' nota(s) pendente(s).',
        module: 'estacas',
        moduleLabel: 'Estacas',
        priority: stakeSummary.saldosDivergentes > 0 ? 'Alta' : 'Média',
      });
    }

    ordensServico
      .filter(item => !['Concluída', 'Cancelada'].includes(item.status))
      .forEach(item => {
        items.push({
          id: 'os-' + item.id,
          title: 'OS ' + item.numero + ' em aberto',
          detail: item.descricao,
          module: 'manutencao',
          moduleLabel: 'Manutenção',
          priority: item.prioridade === 'Urgente' || item.prioridade === 'Alta' ? 'Alta' : 'Média',
        });
      });

    partesDiarias
      .filter(item => item.status !== 'Conferido')
      .forEach(item => {
        items.push({
          id: 'parte-' + item.id,
          title: 'Parte diária ' + item.numero + ' não conferida',
          detail: item.prefixo + ' • ' + item.data,
          module: 'partes-diarias',
          moduleLabel: 'Parte diária',
          priority: item.status === 'Inconsistente' ? 'Alta' : 'Média',
        });
      });

    return items.sort((left, right) => (left.priority === right.priority ? left.title.localeCompare(right.title) : left.priority === 'Alta' ? -1 : 1));
  }, [abastecimentos, estacas, materiais, ordensServico, partesDiarias, tickets]);

  const highPriority = pendingItems.filter(item => item.priority === 'Alta').length;

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">Central operacional</p>
          <h1 className="mt-1 text-2xl font-black text-white">Pendências</h1>
          <p className="mt-1 text-sm text-slate-400">Alertas derivados dos registros atuais; nenhuma pendência é criada em duplicidade.</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-right">
          <span className="block text-2xl font-black text-white">{pendingItems.length}</span>
          <span className="text-xs font-bold text-slate-400">{highPriority} prioridade alta</span>
        </div>
      </header>

      {pendingItems.length === 0 ? (
        <div className="rounded-xl border border-emerald-900/70 bg-emerald-950/20 p-8 text-center">
          <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-400" />
          <h2 className="mt-3 font-bold text-white">Nenhuma pendência identificada</h2>
          <p className="mt-1 text-sm text-slate-400">Os alertas serão atualizados automaticamente conforme os lançamentos forem revisados.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          {pendingItems.map(item => (
            <article key={item.id} className="flex flex-col gap-3 border-b border-slate-800 p-4 last:border-0 sm:flex-row sm:items-center">
              <AlertTriangle className={`h-5 w-5 shrink-0 ${item.priority === 'Alta' ? 'text-rose-400' : 'text-amber-400'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-white">{item.title}</h2>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${item.priority === 'Alta' ? 'bg-rose-950 text-rose-300' : 'bg-amber-950 text-amber-300'}`}>{item.priority}</span>
                </div>
                <p className="mt-1 text-sm text-slate-400">{item.detail}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />{item.moduleLabel}</span>
              </div>
              <button type="button" onClick={() => onNavigate(item.module)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-700 px-3 text-xs font-bold text-slate-200 hover:border-amber-500 hover:text-white">
                Corrigir <ArrowRight className="h-4 w-4" />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
