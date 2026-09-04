import React, { useMemo, useState } from 'react';
import {
  CalendarRange,
  ChevronRight,
  Download,
  Droplets,
  Search,
  Truck,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import type {
  Abastecimento,
  ControleEquipamentoDiario,
  Equipamento,
  PresencaApontamento,
  TicketJazida,
} from '../types';

interface PeriodoTabProps {
  presencas: PresencaApontamento[];
  controlesEquipamentos: ControleEquipamentoDiario[];
  abastecimentos: Abastecimento[];
  ticketsJazida: TicketJazida[];
  equipamentos: Equipamento[];
}

type ModuloDetalhe = 'presenca' | 'frota' | 'combustivel' | 'tickets';

const PANEL = 'rounded-xl border border-[#e2e8e4] bg-white';
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
  const [detalhe, setDetalhe] = useState<{ dia: string; modulo: ModuloDetalhe } | null>(null);

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

  const dias = useMemo(() => {
    const todas = new Set<string>([
      ...periodo.presencas.map(item => item.data),
      ...periodo.frota.map(item => item.data),
      ...periodo.combustivel.map(item => item.data),
      ...periodo.tickets.map(item => item.data),
    ]);
    return [...todas].sort((a, b) => b.localeCompare(a)).map(dia => {
      const presencaDia = periodo.presencas.filter(item => item.data === dia);
      const frotaDia = periodo.frota.filter(item => item.data === dia);
      const combustivelDia = periodo.combustivel.filter(item => item.data === dia);
      const ticketsDia = periodo.tickets.filter(item => item.data === dia);
      return {
        dia,
        presentes: presencaDia.filter(item => item.status === 'Presente').length,
        ausentes: presencaDia.filter(item => item.status === 'Ausente').length,
        presencaTotal: presencaDia.length,
        frotaTotal: frotaDia.length,
        frotaOperando: frotaDia.filter(item => item.status === 'Em operação').length,
        frotaManutencao: frotaDia.filter(item => item.status === 'Em manutenção' || item.status === 'Aguardando manutenção').length,
        litros: combustivelDia.reduce((total, item) => total + (Number(item.quantidadeLitros) || 0), 0),
        combustivelTotal: combustivelDia.length,
        ticketsTotal: ticketsDia.length,
        metrosCubicos: ticketsDia.reduce((total, item) => total + (Number(item.quantidadeM3) || 0), 0),
      };
    });
  }, [periodo]);

  const totais = useMemo(() => ({
    dias: dias.length,
    presentes: dias.reduce((total, item) => total + item.presentes, 0),
    presencaTotal: dias.reduce((total, item) => total + item.presencaTotal, 0),
    frotaTotal: periodo.frota.length,
    frotaManutencao: dias.reduce((total, item) => total + item.frotaManutencao, 0),
    litros: dias.reduce((total, item) => total + item.litros, 0),
    ticketsTotal: periodo.tickets.length,
    metrosCubicos: dias.reduce((total, item) => total + item.metrosCubicos, 0),
  }), [dias, periodo]);

  const filtroTexto = busca.trim().toLocaleLowerCase('pt-BR');
  const combina = (...campos: unknown[]) => !filtroTexto
    || campos.some(campo => String(campo ?? '').toLocaleLowerCase('pt-BR').includes(filtroTexto));

  const registrosDetalhe = useMemo(() => {
    if (!detalhe) return [];
    const { dia, modulo } = detalhe;
    if (modulo === 'presenca') {
      return periodo.presencas
        .filter(item => item.data === dia)
        .filter(item => combina(item.funcionarioNome, item.grupoNome, item.funcao, item.responsavel, item.status));
    }
    if (modulo === 'frota') {
      return periodo.frota
        .filter(item => item.data === dia)
        .filter(item => combina(item.prefixo, item.nomeMotorista, item.status, item.familia, item.observacao, item.motivoManutencao));
    }
    if (modulo === 'combustivel') {
      return periodo.combustivel
        .filter(item => item.data === dia)
        .filter(item => {
          const frota = equipamentos.find(equipamento => equipamento.id === item.equipamentoId);
          return combina(frota?.prefixo, item.prefixoInformado, item.responsavel, item.observacao);
        });
    }
    return periodo.tickets
      .filter(item => item.data === dia)
      .filter(item => combina(item.ticketNumero, item.prefixo, item.placa, item.tipoMaterial, item.destinoObra, item.nomeLegivel));
  }, [combina, detalhe, equipamentos, periodo]);

  const exportarResumo = () => downloadCsv(
    `periodo_${periodo.inicio}_a_${periodo.fim}.csv`,
    ['Data', 'Presentes', 'Ausentes', 'Presença (registros)', 'Frota (lançamentos)', 'Em operação', 'Em manutenção', 'Abastecimentos', 'Litros', 'Tickets', 'm³'],
    dias.map(item => [
      formatDay(item.dia), item.presentes, item.ausentes, item.presencaTotal,
      item.frotaTotal, item.frotaOperando, item.frotaManutencao,
      item.combustivelTotal, decimal(item.litros, 1), item.ticketsTotal, decimal(item.metrosCubicos, 1),
    ]),
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
      <header className={`${PANEL} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
              <CalendarRange className="h-4 w-4" /> Consolidado por período
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">Registros de {formatDay(periodo.inicio)} a {formatDay(periodo.fim)}</h1>
            <p className="mt-1 text-sm text-[#65716b]">Presença, frota, combustível e jazida no mesmo intervalo, com o detalhe de cada dia.</p>
          </div>
          <button type="button" onClick={exportarResumo} className={CHIP}>
            <Download className="mr-2 h-4 w-4" /> Exportar resumo
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[repeat(2,minmax(0,180px))_1fr]">
          <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#65716b]">
            Do dia
            <input type="date" value={from} max={to} onChange={event => setFrom(event.target.value)} className={`${FIELD} mt-1`} />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#65716b]">
            Até o dia
            <input type="date" value={to} min={from} onChange={event => setTo(event.target.value)} className={`${FIELD} mt-1`} />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            {presets.map(([label, aplicar]) => (
              <button key={label} type="button" onClick={aplicar} className={CHIP}>{label}</button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => (
          <article key={card.label} className={`${PANEL} p-4 sm:p-5`}>
            <div className="flex items-start justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#65716b]">{card.label}</span>
              <card.icone className="h-4 w-4 text-emerald-700" />
            </div>
            <strong className="mt-3 block text-3xl font-black tabular-nums tracking-[-0.04em]">{card.valor}</strong>
            <span className="mt-1 block text-xs text-[#65716b]">{card.apoio}</span>
          </article>
        ))}
      </div>

      <article className={`${PANEL} overflow-hidden`}>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8e4] px-5 py-4">
          <div>
            <h2 className="text-sm font-black">Dia a dia</h2>
            <p className="mt-1 text-xs text-[#65716b]">{totais.dias} dia(s) com movimento no intervalo. Clique em um número para abrir o detalhe.</p>
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-[#f7f9f8] text-[10px] uppercase tracking-wider text-[#65716b]">
              <tr>
                {['Data', 'Presentes', 'Ausentes', 'Frota', 'Manutenção', 'Litros', 'Tickets', 'm³'].map(label => (
                  <th key={label} className="border-b border-[#e2e8e4] px-4 py-3 font-bold">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef2f0]">
              {dias.map(item => (
                <tr key={item.dia} className="hover:bg-[#f8fbf9]">
                  <td className="px-4 py-3 font-black tabular-nums">{formatDay(item.dia)}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setDetalhe({ dia: item.dia, modulo: 'presenca' })} className="font-bold tabular-nums text-emerald-800 hover:underline">
                      {item.presentes}
                    </button>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-rose-700">{item.ausentes}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setDetalhe({ dia: item.dia, modulo: 'frota' })} className="font-bold tabular-nums text-emerald-800 hover:underline">
                      {item.frotaTotal}
                    </button>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-amber-700">{item.frotaManutencao}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setDetalhe({ dia: item.dia, modulo: 'combustivel' })} className="font-bold tabular-nums text-emerald-800 hover:underline">
                      {decimal(item.litros, 1)}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setDetalhe({ dia: item.dia, modulo: 'tickets' })} className="font-bold tabular-nums text-emerald-800 hover:underline">
                      {item.ticketsTotal}
                    </button>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{decimal(item.metrosCubicos, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {dias.length === 0 && (
          <p className="px-5 py-14 text-center text-sm text-[#65716b]">Nenhum registro entre {formatDay(periodo.inicio)} e {formatDay(periodo.fim)}.</p>
        )}
      </article>

      {detalhe && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-5" onClick={() => setDetalhe(null)}>
          <div
            className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            onClick={event => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4 border-b border-[#e2e8e4] px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Detalhe de {formatDay(detalhe.dia)}</p>
                <h3 className="mt-1 text-lg font-black">{registrosDetalhe.length} registro(s)</h3>
              </div>
              <button type="button" onClick={() => setDetalhe(null)} aria-label="Fechar detalhe" className="rounded-lg p-2 text-[#65716b] hover:bg-[#f2f5f3]">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex flex-wrap gap-2 border-b border-[#e2e8e4] px-5 py-3">
              {([['presenca', 'Presença'], ['frota', 'Frota'], ['combustivel', 'Combustível'], ['tickets', 'Tickets']] as Array<[ModuloDetalhe, string]>).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDetalhe({ dia: detalhe.dia, modulo: id })}
                  className={`inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-bold transition ${detalhe.modulo === id ? 'bg-emerald-700 text-white' : 'border border-[#e2e8e4] text-[#26362f] hover:border-emerald-700'}`}
                >
                  {label}
                </button>
              ))}
              <label className="relative ml-auto min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#79847e]" />
                <input
                  value={busca}
                  onChange={event => setBusca(event.target.value)}
                  placeholder="Filtrar neste dia"
                  className={`${FIELD} pl-10`}
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {registrosDetalhe.length === 0 && (
                <p className="py-12 text-center text-sm text-[#65716b]">Nenhum registro para este filtro.</p>
              )}

              {detalhe.modulo === 'frota' && (
                <div className="grid gap-3">
                  {(registrosDetalhe as ControleEquipamentoDiario[]).map(registro => (
                    <article key={registro.id} className={`${PANEL} p-4`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black">{registro.prefixo} · {registro.familia || 'Sem família'}</p>
                          <p className="mt-1 text-xs text-[#65716b]">{registro.nomeMotorista || 'Sem motorista'} · matrícula {registro.codigoFuncionario || '—'}</p>
                        </div>
                        <span className="rounded-lg border border-[#e2e8e4] px-3 py-1 text-xs font-bold text-[#26362f]">{registro.status}</span>
                      </div>
                      <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-3 lg:grid-cols-5">
                        {[
                          ['Saída', registro.horaSaida],
                          ['Entrada manutenção', registro.horaEntradaManutencao],
                          ['Liberação', registro.horaLiberacao],
                          ['Origem', registro.origem],
                          ['Aprovação', registro.aprovacao?.status || 'PENDENTE'],
                        ].map(([rotulo, valor]) => (
                          <div key={String(rotulo)}>
                            <dt className="font-bold uppercase tracking-[0.1em] text-[#79847e]">{rotulo}</dt>
                            <dd className="mt-0.5 tabular-nums">{String(valor || '—')}</dd>
                          </div>
                        ))}
                      </dl>
                      {(registro.motivoManutencao || registro.observacao) && (
                        <p className="mt-3 border-t border-[#eef2f0] pt-3 text-xs text-[#65716b]">
                          {registro.motivoManutencao ? `Motivo: ${registro.motivoManutencao}. ` : ''}{registro.observacao}
                        </p>
                      )}
                      {asArray(registro.eventos).length > 0 && (
                        <ul className="mt-3 space-y-1 border-t border-[#eef2f0] pt-3 text-[11px] text-[#65716b]">
                          {asArray(registro.eventos).map(evento => (
                            <li key={evento.id} className="flex items-start gap-2">
                              <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-emerald-700" />
                              <span>{new Date(evento.ocorridoEm).toLocaleString('pt-BR')} · {evento.tipo}{evento.statusNovo ? ` → ${evento.statusNovo}` : ''}{evento.observacao ? ` · ${evento.observacao}` : ''}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  ))}
                </div>
              )}

              {detalhe.modulo === 'presenca' && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-[#f7f9f8] text-[10px] uppercase tracking-wider text-[#65716b]">
                      <tr>{['Colaborador', 'Função', 'Equipe', 'Situação', 'Hora', 'Observação'].map(label => <th key={label} className="px-3 py-2 font-bold">{label}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-[#eef2f0]">
                      {(registrosDetalhe as PresencaApontamento[]).map(registro => (
                        <tr key={registro.id}>
                          <td className="px-3 py-2 font-bold">{registro.funcionarioNome}</td>
                          <td className="px-3 py-2 text-[#65716b]">{registro.funcao || '—'}</td>
                          <td className="px-3 py-2">{registro.grupoNome}</td>
                          <td className="px-3 py-2 font-bold">{registro.status}</td>
                          <td className="px-3 py-2 tabular-nums">{registro.horaEnvio || '—'}</td>
                          <td className="px-3 py-2 text-[#65716b]">{registro.observacao || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {detalhe.modulo === 'combustivel' && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-[#f7f9f8] text-[10px] uppercase tracking-wider text-[#65716b]">
                      <tr>{['Frota', 'Hora', 'Litros', 'Bomba inicial', 'Bomba final', 'Responsável'].map(label => <th key={label} className="px-3 py-2 font-bold">{label}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-[#eef2f0]">
                      {(registrosDetalhe as Abastecimento[]).map(registro => {
                        const frota = equipamentos.find(equipamento => equipamento.id === registro.equipamentoId);
                        return (
                          <tr key={registro.id}>
                            <td className="px-3 py-2 font-bold">{frota?.prefixo || registro.prefixoInformado || '—'}</td>
                            <td className="px-3 py-2 tabular-nums">{registro.hora || '—'}</td>
                            <td className="px-3 py-2 font-bold tabular-nums">{decimal(Number(registro.quantidadeLitros) || 0, 1)}</td>
                            <td className="px-3 py-2 tabular-nums">{decimal(Number(registro.bombaInicial) || 0, 1)}</td>
                            <td className="px-3 py-2 tabular-nums">{decimal(Number(registro.bombaFinal) || 0, 1)}</td>
                            <td className="px-3 py-2 text-[#65716b]">{registro.responsavel || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {detalhe.modulo === 'tickets' && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-[#f7f9f8] text-[10px] uppercase tracking-wider text-[#65716b]">
                      <tr>{['Ticket', 'Prefixo', 'Placa', 'Material', 'Quantidade', 'Destino', 'Saída'].map(label => <th key={label} className="px-3 py-2 font-bold">{label}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-[#eef2f0]">
                      {(registrosDetalhe as TicketJazida[]).map(registro => (
                        <tr key={registro.id}>
                          <td className="px-3 py-2 font-black tabular-nums">{registro.ticketNumero}</td>
                          <td className="px-3 py-2 font-bold">{registro.prefixo}</td>
                          <td className="px-3 py-2">{registro.placa || '—'}</td>
                          <td className="px-3 py-2">{registro.tipoMaterial}</td>
                          <td className="px-3 py-2 tabular-nums">{decimal(Number(registro.quantidadeM3) || 0, 1)} {registro.unidadeQuantidade || 'm³'}</td>
                          <td className="px-3 py-2">{registro.destinoOutro || registro.destinoObra}</td>
                          <td className="px-3 py-2 tabular-nums">{registro.horaSaida || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
