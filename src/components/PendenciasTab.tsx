import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Search } from 'lucide-react';
import type {
  Abastecimento,
  ControleEstacas,
  MaterialRegistro,
  OrdemServico,
  ParteDiariaEquipamento,
  ControleEquipamentoDiario,
  Empresa,
  Equipamento,
  Funcionario,
  GrupoEquipe,
  TicketJazida,
} from '../types';
import { buildStakeSummary } from '../utils/stakeOperations';
import { buildTravelOperationControl } from '../utils/travelOperations';
import { auditOperationalIntegrity } from '../utils/dataIntegrityAudit';

type PendingItem = {
  id: string;
  title: string;
  detail: string;
  module: string;
  moduleLabel: string;
  priority: 'Crítica' | 'Alta' | 'Média' | 'Baixa';
};

type PendenciasTabProps = {
  tickets: TicketJazida[];
  abastecimentos: Abastecimento[];
  materiais: MaterialRegistro[];
  estacas: ControleEstacas;
  ordensServico: OrdemServico[];
  partesDiarias: ParteDiariaEquipamento[];
  controlesEquipamentos: ControleEquipamentoDiario[];
  empresas: Empresa[];
  equipamentos: Equipamento[];
  funcionarios: Funcionario[];
  gruposEquipe: GrupoEquipe[];
  onNavigate: (module: string) => void;
};

export default function PendenciasTab({
  tickets,
  abastecimentos,
  materiais,
  estacas,
  ordensServico,
  partesDiarias,
  controlesEquipamentos,
  empresas,
  equipamentos,
  funcionarios,
  gruposEquipe,
  onNavigate,
}: PendenciasTabProps) {
  const [query, setQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('Todos');
  const [priorityFilter, setPriorityFilter] = useState('Todas');
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

    controlesEquipamentos
      .filter(item => (item.revisao || []).length > 0 || ['Em manutenção', 'Aguardando manutenção', 'Aguardando equipamento'].includes(item.status))
      .forEach(item => items.push({
        id: `controle-${item.id}`,
        title: `${item.prefixo} requer atenção operacional`,
        detail: (item.revisao || []).join(' ') || item.motivoManutencao || item.observacao || item.status,
        module: 'controle-equipamentos', moduleLabel: 'Controle de Basculantes',
        priority: item.status === 'Em manutenção' || (item.revisao || []).length > 0 ? 'Alta' : 'Média',
      }));

    auditOperationalIntegrity({ empresas, equipamentos, funcionarios, grupos: gruposEquipe, controles: controlesEquipamentos, partes: partesDiarias, ordens: ordensServico })
      .forEach(issue => items.push({ id: issue.id, title: issue.title, detail: issue.detail, module: issue.module, moduleLabel: issue.category, priority: issue.priority }));

    const rank = { Crítica: 0, Alta: 1, Média: 2, Baixa: 3 } as const;
    return items.sort((left, right) => rank[left.priority] - rank[right.priority] || left.title.localeCompare(right.title));
  }, [abastecimentos, controlesEquipamentos, empresas, equipamentos, estacas, funcionarios, gruposEquipe, materiais, ordensServico, partesDiarias, tickets]);

  const highPriority = pendingItems.filter(item => item.priority === 'Alta').length;
  const critical = pendingItems.filter(item => item.priority === 'Crítica').length;
  const awaitingMaintenance = pendingItems.filter(item => /manuten/i.test(`${item.title} ${item.detail}`)).length;
  const incomplete = pendingItems.filter(item => /incomplet|não informad|sem cadastro/i.test(`${item.title} ${item.detail}`)).length;
  const noResponsible = pendingItems.filter(item => /sem responsável|aguardando motorista/i.test(`${item.title} ${item.detail}`)).length;
  const modules = ['Todos', ...Array.from(new Set(pendingItems.map(item=>item.moduleLabel)))];
  const visibleItems = pendingItems.filter(item => (moduleFilter==='Todos'||item.moduleLabel===moduleFilter) && (priorityFilter==='Todas'||item.priority===priorityFilter) && (!query.trim()||`${item.title} ${item.detail} ${item.moduleLabel}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))));

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">Central operacional</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">Pendências</h1>
          <p className="mt-1 text-sm text-slate-500">Alertas derivados dos registros atuais; nenhuma pendência é criada em duplicidade.</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-right">
          <span className="block text-2xl font-black text-slate-900">{pendingItems.length}</span>
          <span className="text-xs font-bold text-amber-700">{highPriority} prioridade alta</span>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{[
        ['Pendências totais', pendingItems.length], ['Críticas', critical], ['Altas', highPriority],
        ['Aguardando manutenção', awaitingMaintenance], ['Cadastro incompleto', incomplete], ['Sem responsável', noResponsible],
      ].map(([label,value])=><article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><strong className="block text-2xl font-black text-slate-900">{value}</strong><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span></article>)}</div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_240px_180px]"><label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar pendência, frota, OS, ticket..." className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm"/></label><select value={moduleFilter} onChange={e=>setModuleFilter(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold">{modules.map(item=><option key={item}>{item}</option>)}</select><select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold"><option>Todas</option><option>Crítica</option><option>Alta</option><option>Média</option><option>Baixa</option></select></div>

      {pendingItems.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
          <h2 className="mt-3 font-bold text-slate-900">Nenhuma pendência identificada</h2>
          <p className="mt-1 text-sm text-slate-500">Os alertas serão atualizados automaticamente conforme os lançamentos forem revisados.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {visibleItems.map(item => (
            <article key={item.id} className="flex flex-col gap-3 border-b border-slate-100 p-4 last:border-0 sm:flex-row sm:items-center">
              <AlertTriangle className={`h-5 w-5 shrink-0 ${item.priority === 'Crítica' || item.priority === 'Alta' ? 'text-rose-600' : 'text-amber-500'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-slate-900">{item.title}</h2>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${item.priority === 'Crítica' || item.priority === 'Alta' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{item.priority}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />{item.moduleLabel}</span>
              </div>
              <button type="button" onClick={() => onNavigate(item.module)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:border-amber-500 hover:text-slate-900">
                Corrigir <ArrowRight className="h-4 w-4" />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
