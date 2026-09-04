import React, { useMemo, useState } from 'react';
import {
  Download,
  Droplets,
  Search,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';
import type {
  Abastecimento,
  ControleEquipamentoDiario,
  Equipamento,
  PresencaApontamento,
  TicketJazida,
} from '../types';
import { PageHeader, Pagination, StatCard, statusTone } from '../shared/ui';

interface PeriodoTabProps {
  presencas: PresencaApontamento[];
  controlesEquipamentos: ControleEquipamentoDiario[];
  abastecimentos: Abastecimento[];
  ticketsJazida: TicketJazida[];
  equipamentos: Equipamento[];
}

type TipoRegistro = 'Presença' | 'Frota' | 'Combustível' | 'Tickets';

interface PeriodoRow {
  id: string;
  data: string;
  horario: string;
  equipamento: string;
  tipo: TipoRegistro;
  descricao: string;
  status: string;
}

const PANEL = 'rounded-lg border border-[#e2e8e4] bg-white';
const FIELD = 'min-h-11 w-full rounded-lg border border-[#e2e8e4] bg-white px-3 text-sm text-[#14231e] outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10';
const CHIP = 'inline-flex min-h-9 items-center rounded-lg border border-[#e2e8e4] bg-white px-3 text-xs font-bold text-[#26362f] transition hover:border-emerald-700 hover:text-emerald-800';

const localToday = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const shiftDays = (iso: string, days: number) => {
  const base = new Date(`${iso}T12:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
};

const formatDay = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '—');
const asArray = <T,>(value: T[] | undefined) => (Array.isArray(value) ? value.filter(Boolean) : []);
const inRange = (data: string, from: string, to: string) => Boolean(data) && data >= from && data <= to;
const decimal = (value: number, digits = 0) => value.toLocaleString('pt-BR', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const downloadCsv = (fileName: string, header: string[], rows: unknown[][]) => {
  const content = [header, ...rows].map(row => row.map(csvCell).join(';')).join('\n');
  const blob = new Blob([`﻿${content}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export default function PeriodoTab({
  presencas = [],
  controlesEquipamentos = [],
  abastecimentos = [],
  ticketsJazida = [],
  equipamentos = [],
}: PeriodoTabProps) {
  const hoje = localToday();
  const [from, setFrom] = useState(() => shiftDays(hoje, -6));
  const [to, setTo] = useState(hoje);
  const [busca, setBusca] = useState('');
  const [tipoFilter, setTipoFilter] = useState<'Todos' | TipoRegistro>('Todos');
  const [equipamentoFilter, setEquipamentoFilter] = useState('Todos');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const periodo = useMemo(() => {
    const inicio = from <= to ? from : to;
    const fim = from <= to ? to : from;
    return {
      inicio,
      fim,
      presencas: asArray(presencas).filter(item => inRange(item.data, inicio, fim)),
      frota: asArray(controlesEquipamentos).filter(item => inRange(item.data, inicio, fim)),
      combustivel: asArray(abastecimentos).filter(item => inRange(item.data, inicio, fim)),
      tickets: asArray(ticketsJazida).filter(item => inRange(item.data, inicio, fim)),
    };
  }, [abastecimentos, controlesEquipamentos, from, presencas, ticketsJazida, to]);

  const totais = useMemo(() => ({
    presentes: periodo.presencas.filter(item => item.status === 'Presente').length,
    presencaTotal: periodo.presencas.length,
    frotaTotal: periodo.frota.length,
    frotaManutencao: periodo.frota.filter(item => item.status === 'Em manutenção' || item.status === 'Aguardando manutenção').length,
    litros: periodo.combustivel.reduce((total, item) => total + (Number(item.quantidadeLitros) || 0), 0),
    ticketsTotal: periodo.tickets.length,
    metrosCubicos: periodo.tickets.reduce((total, item) => total + (Number(item.quantidadeM3) || 0), 0),
  }), [periodo]);

  /** Achata os quatro módulos do período num único registro por linha, no
   * mesmo formato de tabela usado em Consulta Geral. */
  const registros = useMemo<PeriodoRow[]>(() => [
    ...periodo.presencas.map(item => ({
      id: `presenca-${item.id}`, data: item.data, horario: item.horaEnvio || '', equipamento: item.funcionarioNome || 'Colaborador não informado',
      tipo: 'Presença' as const, descricao: `${item.grupoNome || 'Sem equipe'} · ${item.funcao || 'Função não informada'}`, status: item.status,
    })),
    ...periodo.frota.map(item => ({
      id: `frota-${item.id}`, data: item.data, horario: item.horaSaida || item.horaEntradaManutencao || item.horaLiberacao || '', equipamento: item.prefixo || 'Sem prefixo',
      tipo: 'Frota' as const, descricao: item.motivoManutencao || item.observacao || item.familia || item.nomeMotorista || 'Sem descrição', status: item.status,
    })),
    ...periodo.combustivel.map(item => {
      const frota = equipamentos.find(equipamento => equipamento.id === item.equipamentoId);
      return {
        id: `combustivel-${item.id}`, data: item.data, horario: item.hora || '', equipamento: frota?.prefixo || item.prefixoInformado || 'Sem prefixo',
        tipo: 'Combustível' as const, descricao: `${decimal(Number(item.quantidadeLitros) || 0, 1)} L`, status: item.status || 'OK',
      };
    }),
    ...periodo.tickets.map(item => ({
      id: `ticket-${item.id}`, data: item.data, horario: item.horaSaida || item.horaChegada || '', equipamento: item.prefixo || 'Sem prefixo',
      tipo: 'Tickets' as const, descricao: `${item.tipoMaterial || 'Material não informado'} · ${decimal(Number(item.quantidadeM3) || 0, 1)} m³`, status: item.statusFluxo || item.status || 'Pendente',
    })),
  ].sort((a, b) => `${b.data} ${b.horario}`.localeCompare(`${a.data} ${a.horario}`)), [periodo, equipamentos]);

  const equipamentosDoPeriodo = useMemo(() => ['Todos', ...Array.from(new Set(registros.map(item => item.equipamento))).sort((a, b) => a.localeCompare(b, 'pt-BR'))], [registros]);

  const filtroTexto = busca.trim().toLocaleLowerCase('pt-BR');
  const registrosFiltrados = useMemo(() => registros
    .filter(item => tipoFilter === 'Todos' || item.tipo === tipoFilter)
    .filter(item => equipamentoFilter === 'Todos' || item.equipamento === equipamentoFilter)
    .filter(item => !filtroTexto || `${item.equipamento} ${item.descricao} ${item.status}`.toLocaleLowerCase('pt-BR').includes(filtroTexto)),
  [registros, tipoFilter, equipamentoFilter, filtroTexto]);

  const totalPages = Math.max(1, Math.ceil(registrosFiltrados.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRegistros = registrosFiltrados.slice((safePage - 1) * pageSize, safePage * pageSize);

  const exportarResumo = () => downloadCsv(
    `periodo_${periodo.inicio}_a_${periodo.fim}.csv`,
    ['Data', 'Horário', 'Equipamento', 'Tipo', 'Descrição', 'Status'],
    registrosFiltrados.map(item => [formatDay(item.data), item.horario, item.equipamento, item.tipo, item.descricao, item.status]),
  );

  const presets: Array<[string, () => void]> = [
    ['Hoje', () => { setFrom(hoje); setTo(hoje); }],
    ['7 dias', () => { setFrom(shiftDays(hoje, -6)); setTo(hoje); }],
    ['30 dias', () => { setFrom(shiftDays(hoje, -29)); setTo(hoje); }],
    ['Mês atual', () => { setFrom(`${hoje.slice(0, 7)}-01`); setTo(hoje); }],
  ];

  const cards = [
    { label: 'Presenças confirmadas', valor: decimal(totais.presentes), apoio: `${decimal(totais.presencaTotal)} registro(s) de presença`, icone: Users },
    { label: 'Lançamentos de frota', valor: decimal(totais.frotaTotal), apoio: `${decimal(totais.frotaManutencao)} em manutenção no período`, icone: Truck },
    { label: 'Combustível', valor: `${decimal(totais.litros, 1)} L`, apoio: `${decimal(periodo.combustivel.length)} abastecimento(s)`, icone: Droplets },
    { label: 'Tickets de jazida', valor: decimal(totais.ticketsTotal), apoio: `${decimal(totais.metrosCubicos, 1)} m³ transportado(s)`, icone: Wrench },
  ];

  return (
    <section className="space-y-5 text-[#14231e]">
      <PageHeader
        title={`Registros de ${formatDay(periodo.inicio)} a ${formatDay(periodo.fim)}`}
        description="Presença, frota, combustível e jazida no mesmo intervalo."
        actions={<button type="button" onClick={exportarResumo} className={CHIP}><Download className="mr-2 h-4 w-4" /> Exportar</button>}
      />

      <div className={`${PANEL} p-5 sm:p-6`}>
        <div className="grid gap-3 md:grid-cols-[repeat(2,minmax(0,180px))_1fr]">
          <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#65716b]">
            Do dia
            <input type="date" value={from} max={to} onChange={event => { setFrom(event.target.value); setPage(1); }} className={`${FIELD} mt-1`} />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#65716b]">
            Até o dia
            <input type="date" value={to} min={from} onChange={event => { setTo(event.target.value); setPage(1); }} className={`${FIELD} mt-1`} />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            {presets.map(([label, aplicar]) => (
              <button key={label} type="button" onClick={aplicar} className={CHIP}>{label}</button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#65716b]">
            Tipo de registro
            <select value={tipoFilter} onChange={event => { setTipoFilter(event.target.value as 'Todos' | TipoRegistro); setPage(1); }} className={`${FIELD} mt-1 font-bold`}>
              <option>Todos</option><option>Presença</option><option>Frota</option><option>Combustível</option><option>Tickets</option>
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#65716b]">
            Equipamento
            <select value={equipamentoFilter} onChange={event => { setEquipamentoFilter(event.target.value); setPage(1); }} className={`${FIELD} mt-1 font-bold`}>
              {equipamentosDoPeriodo.map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="relative text-[10px] font-bold uppercase tracking-[0.12em] text-[#65716b]">
            Buscar
            <Search className="pointer-events-none absolute left-3 top-[calc(50%+7px)] h-4 w-4 -translate-y-1/2 text-[#79847e]" />
            <input value={busca} onChange={event => { setBusca(event.target.value); setPage(1); }} placeholder="Equipamento, descrição..." className={`${FIELD} mt-1 pl-9`} />
          </label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => (
          <StatCard key={card.label} label={card.label} value={card.valor} icon={card.icone} trend={card.apoio} />
        ))}
      </div>

      <article className={`${PANEL} overflow-hidden`}>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8e4] px-5 py-4">
          <div>
            <h2 className="text-sm font-black">Registros</h2>
            <p className="mt-1 text-xs text-[#65716b]">{registrosFiltrados.length} registro(s) no período selecionado.</p>
          </div>
          <select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }} className="h-9 rounded-lg border border-[#e2e8e4] px-2 text-xs font-bold text-[#65716b]"><option value={10}>10 por página</option><option value={25}>25 por página</option><option value={50}>50 por página</option></select>
        </header>
        {pagedRegistros.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-[#f7f9f8] text-[10px] uppercase tracking-wider text-[#65716b]">
                <tr>{['Data', 'Horário', 'Equipamento', 'Tipo', 'Descrição', 'Status'].map(label => <th key={label} className="border-b border-[#e2e8e4] px-4 py-3 font-bold">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-[#eef2f0]">
                {pagedRegistros.map(item => (
                  <tr key={item.id} className="hover:bg-[#f8fbf9]">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums">{formatDay(item.data)}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-[#65716b]">{item.horario || '—'}</td>
                    <td className="px-4 py-3 font-black">{item.equipamento}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#65716b]">{item.tipo}</td>
                    <td className="max-w-[280px] truncate px-4 py-3 text-[#65716b]" title={item.descricao}>{item.descricao}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone(item.status)}`}>{item.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-14 text-center text-sm text-[#65716b]">Nenhum registro entre {formatDay(periodo.inicio)} e {formatDay(periodo.fim)}.</p>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-[#eef2f0] px-5 py-4">
            <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
            <span className="text-xs font-medium text-[#65716b]">página {safePage} de {totalPages}</span>
          </div>
        )}
      </article>
    </section>
  );
}
