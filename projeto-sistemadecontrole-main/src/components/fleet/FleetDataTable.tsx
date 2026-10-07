import { useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Pencil, Trash2, X } from 'lucide-react';
import type { FleetCurrentState } from '../../fleet/domain';
import FleetMobileCard from './FleetMobileCard';
import FleetStatusBadge from './FleetStatusBadge';
import { CAMPO, CARTAO, FOCO, TOM_SITUACAO } from '../cadastros/estilos';

type SortKey =
  | 'employeeCode'
  | 'driver'
  | 'prefix'
  | 'status'
  | 'departure'
  | 'stopped'
  | 'location';

interface Props {
  rows: FleetCurrentState[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onEdit: (state: FleetCurrentState) => void;
  onDetails: (state: FleetCurrentState) => void;
  onDelete: (state: FleetCurrentState) => void;
  canApprove?: boolean;
  onApprove?: (state: FleetCurrentState, status: 'APROVADO' | 'REJEITADO') => void;
}

const getSortValue = (row: FleetCurrentState, key: SortKey): string | number => {
  switch (key) {
    case 'employeeCode':
      return row.driver?.employeeCode || '';
    case 'driver':
      return row.driver?.employeeName || '';
    case 'prefix':
      return row.equipment.normalizedPrefix;
    case 'status':
      return row.operationalStatus;
    case 'departure':
      return row.departureTime || '';
    case 'stopped':
      return row.stoppedMinutes ?? -1;
    case 'location':
      return row.location || '';
  }
};

export default function FleetDataTable({
  rows,
  selectedIds,
  onSelectionChange,
  onEdit,
  onDetails,
  onDelete,
  canApprove = false,
  onApprove,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('prefix');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const sortedRows = useMemo(() => [...rows].sort((left, right) => {
    const a = getSortValue(left, sortKey);
    const b = getSortValue(right, sortKey);
    const result = typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
    return sortDirection === 'asc' ? result : -result;
  }), [rows, sortDirection, sortKey]);
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageIds = pageRows.map(row => row.recordId);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  // Cascata curta ao trocar de página, ordenação ou filtro: dá referência de
  // leitura sem atrasar quem opera a tabela o dia inteiro.
  useGSAP(() => {
    if (!bodyRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(
      bodyRef.current.querySelectorAll('tr'),
      { autoAlpha: 0, y: 8 },
      { autoAlpha: 1, y: 0, duration: 0.32, stagger: 0.025, ease: 'power2.out', clearProps: 'transform,opacity,visibility' },
    );
  }, { scope: bodyRef, dependencies: [safePage, sortKey, sortDirection, pageSize, rows.length] });
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDirection(direction => direction === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setPage(1);
  };
  const togglePageSelection = () => {
    if (allPageSelected) {
      onSelectionChange(selectedIds.filter(id => !pageIds.includes(id)));
    } else {
      onSelectionChange([...new Set([...selectedIds, ...pageIds])]);
    }
  };
  const toggleRow = (id: string, selected: boolean) => {
    onSelectionChange(selected
      ? [...new Set([...selectedIds, id])]
      : selectedIds.filter(current => current !== id));
  };
  const header = (label: string, key: SortKey) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      aria-label={`Ordenar por ${label}`}
      className={`inline-flex min-h-8 items-center gap-1 rounded-lg font-bold uppercase tracking-[0.1em] transition hover:text-[#176b4d] ${FOCO}`}
    >
      {label}
      {sortKey === key ? <ChevronDown className={`size-3.5 transition ${sortDirection === 'asc' ? 'rotate-180' : ''}`} aria-hidden="true" /> : <ChevronsUpDown className="size-3.5 opacity-40" aria-hidden="true" />}
    </button>
  );
  const aprovacao = (row: FleetCurrentState) => (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${row.approvalStatus === 'APROVADO' ? TOM_SITUACAO.ok : row.approvalStatus === 'REJEITADO' ? 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200' : TOM_SITUACAO.alerta}`}>
      {row.approvalStatus === 'APROVADO' ? 'Aprovado' : row.approvalStatus === 'REJEITADO' ? 'Rejeitado' : 'Pendente'}
    </span>
  );
  const ICONE = `grid size-10 place-items-center rounded-xl border transition duration-200 active:scale-[0.96] ${FOCO}`;
  return (
    <section className={`${CARTAO} overflow-hidden`} aria-label="Lançamentos do dia" data-fleet-enter>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <p className="text-sm text-slate-600">
          <strong className="font-bold text-slate-900">{rows.length}</strong> lançamento(s)
          {selectedIds.length > 0 && <span className="ml-2 font-bold text-[#176b4d]">{selectedIds.length} marcado(s)</span>}
        </p>
        <div className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-2 font-semibold text-slate-500">
            Linhas
            <select
              value={pageSize}
              onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}
              className={`${CAMPO} w-auto min-h-10 font-bold`}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <button type="button" disabled={safePage <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className={`${ICONE} border-slate-200 text-slate-600 hover:border-emerald-400 disabled:opacity-40`} aria-label="Página anterior"><ChevronLeft className="size-4" aria-hidden="true" /></button>
          <span className="min-w-12 text-center font-bold tabular-nums text-slate-700">{safePage}/{totalPages}</span>
          <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))} className={`${ICONE} border-slate-200 text-slate-600 hover:border-emerald-400 disabled:opacity-40`} aria-label="Próxima página"><ChevronRight className="size-4" aria-hidden="true" /></button>
        </div>
      </div>
      <div className="grid gap-2 bg-[#f7f8f6] p-2 lg:hidden">
        {pageRows.length > 0 && (
          <label className="flex min-h-11 items-center gap-3 px-2 text-sm font-semibold text-slate-600">
            <input type="checkbox" checked={allPageSelected} onChange={togglePageSelection} className="size-5 accent-[#176b4d]" />
            Selecionar todos desta página
          </label>
        )}
        {pageRows.map(row => (
          <FleetMobileCard
            key={row.recordId}
            state={row}
            selected={selectedIds.includes(row.recordId)}
            onSelect={selected => toggleRow(row.recordId, selected)}
            onEdit={() => onEdit(row)}
            onDetails={() => onDetails(row)}
            onDelete={() => onDelete(row)}
            canApprove={canApprove}
            onApprove={onApprove ? status => onApprove(row, status) : undefined}
          />
        ))}
        {!pageRows.length && <Vazio />}
      </div>
      <div className="hidden lg:block">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-12" />
            <col className="w-[15%]" />
            <col className="w-[19%]" />
            <col className="w-[14%]" />
            <col className="w-[9%]" />
            <col className="w-[12%]" />
            <col />
            <col className="w-[8%]" />
            <col className="w-[9.5rem]" />
          </colgroup>
          <thead className="bg-[#f7f8f6] text-[11px] text-slate-500">
            <tr>
              <th className="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={togglePageSelection}
                  aria-label="Selecionar todos desta página"
                  className="size-4 accent-[#176b4d]"
                />
              </th>
              <th className="px-2 py-2">{header('Máquina', 'prefix')}</th>
              <th className="px-2 py-2">{header('Motorista', 'driver')}</th>
              <th className="px-2 py-2">{header('Situação', 'status')}</th>
              <th className="px-2 py-2">{header('Saída', 'departure')}</th>
              <th className="px-2 py-2">{header('Local', 'location')}</th>
              <th className="px-2 py-2 font-bold uppercase tracking-[0.1em]">Observação</th>
              <th className="px-2 py-2 font-bold uppercase tracking-[0.1em]">Aprovação</th>
              <th className="px-3 py-2 text-right font-bold uppercase tracking-[0.1em]">Ações</th>
            </tr>
          </thead>
          <tbody ref={bodyRef} className="divide-y divide-slate-100">
            {pageRows.map(row => {
              const selected = selectedIds.includes(row.recordId);
              const observacao = [row.maintenanceReason, row.note].filter(Boolean).join('. ');
              return (
                <tr key={row.recordId} className={`transition-colors duration-200 hover:bg-emerald-50/40 ${selected ? 'bg-emerald-50/70' : 'bg-white'}`}>
                  <td className="px-3 py-2.5 text-center"><input type="checkbox" checked={selected} onChange={event => toggleRow(row.recordId, event.target.checked)} aria-label={`Selecionar ${row.equipment.prefix}`} className="size-4 accent-[#176b4d]" /></td>
                  <td className="px-2 py-2.5">
                    <button type="button" onClick={() => onDetails(row)} className={`block max-w-full rounded-lg text-left ${FOCO}`}>
                      <span className="block font-mono text-sm font-bold text-slate-950 hover:text-[#176b4d]">{row.equipment.prefix}</span>
                      <span className="block truncate text-xs text-slate-500" title={[row.equipment.family, row.equipment.equipmentType].filter(Boolean).join(' · ')}>{row.equipment.equipmentType || row.equipment.family || 'Sem tipo'}</span>
                    </button>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="block truncate font-semibold text-slate-900" title={row.driver?.employeeName}>{row.driver?.employeeName || <span className="font-normal text-slate-400">Sem motorista</span>}</span>
                    {row.driver?.employeeCode && <span className="block font-mono text-xs text-slate-500">{row.driver.employeeCode}</span>}
                  </td>
                  <td className="px-2 py-2.5"><FleetStatusBadge status={row.operationalStatus} compact /></td>
                  <td className="px-2 py-2.5">
                    <span className="block font-mono font-semibold text-slate-800">{row.departureTime || '—'}</span>
                    {row.stoppedMinutes ? <span className="block text-xs text-slate-500">parado {row.stoppedDurationLabel}</span> : null}
                  </td>
                  <td className="truncate px-2 py-2.5 text-slate-700" title={row.location}>{row.location || <span className="text-slate-400">Não informado</span>}</td>
                  <td className="px-2 py-2.5"><p className="line-clamp-2 text-xs leading-5 text-slate-600" title={observacao}>{observacao || '—'}</p></td>
                  <td className="px-2 py-2.5">{aprovacao(row)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      {canApprove && row.approvalStatus === 'PENDENTE' && onApprove && <>
                        <button type="button" onClick={() => onApprove(row, 'APROVADO')} aria-label={`Aprovar ${row.equipment.prefix}`} title="Aprovar" className={`${ICONE} border-emerald-200 text-[#176b4d] hover:bg-emerald-50`}><Check className="size-4" aria-hidden="true" /></button>
                        <button type="button" onClick={() => onApprove(row, 'REJEITADO')} aria-label={`Rejeitar ${row.equipment.prefix}`} title="Rejeitar" className={`${ICONE} border-rose-200 text-rose-700 hover:bg-rose-50`}><X className="size-4" aria-hidden="true" /></button>
                      </>}
                      <button type="button" onClick={() => onEdit(row)} aria-label={`Editar ${row.equipment.prefix}`} title="Editar" className={`${ICONE} border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-[#176b4d]`}><Pencil className="size-4" aria-hidden="true" /></button>
                      <button type="button" onClick={() => onDelete(row)} aria-label={`Excluir ${row.equipment.prefix}`} title="Excluir" className={`${ICONE} border-slate-200 text-slate-500 hover:border-rose-300 hover:text-rose-700`}><Trash2 className="size-4" aria-hidden="true" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!pageRows.length && (
              <tr><td colSpan={9}><Vazio /></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Vazio() {
  return (
    <div className="grid place-items-center gap-1 px-6 py-12 text-center">
      <p className="text-base font-bold text-slate-800">Nenhum lançamento com esses filtros</p>
      <p className="text-sm text-slate-500">Troque o dia, limpe os filtros ou faça um novo lançamento.</p>
    </div>
  );
}
