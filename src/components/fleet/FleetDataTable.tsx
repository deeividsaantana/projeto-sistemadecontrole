import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Eye, Pencil, Trash2 } from 'lucide-react';
import type { FleetCurrentState } from '../../fleet/domain';
import FleetMobileCard from './FleetMobileCard';
import FleetStatusBadge from './FleetStatusBadge';

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
      className="inline-flex items-center gap-1 font-black"
    >
      {label}
      {sortKey === key ? <ChevronDown size={12} className={sortDirection === 'asc' ? 'rotate-180' : ''} /> : <ChevronsUpDown size={12} className="opacity-50" />}
    </button>
  );
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <strong className="text-xs text-slate-800">{rows.length} registro(s)</strong>
          <span className="ml-2 text-[10px] font-bold text-emerald-700">{selectedIds.length} selecionado(s)</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="font-bold text-slate-500">
            Linhas
            <select
              value={pageSize}
              onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}
              className="ml-2 h-8 rounded-md border border-slate-300 bg-white px-2 font-black text-slate-700"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <button type="button" disabled={safePage <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="flex size-8 items-center justify-center rounded-md border border-slate-300 bg-white disabled:opacity-40" aria-label="Página anterior"><ChevronLeft size={15} /></button>
          <span className="min-w-14 text-center font-black text-slate-700">{safePage}/{totalPages}</span>
          <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))} className="flex size-8 items-center justify-center rounded-md border border-slate-300 bg-white disabled:opacity-40" aria-label="Próxima página"><ChevronRight size={15} /></button>
        </div>
      </div>
      <div className="grid gap-2 p-2 md:hidden">
        {pageRows.map(row => (
          <FleetMobileCard
            key={row.recordId}
            state={row}
            selected={selectedIds.includes(row.recordId)}
            onSelect={selected => toggleRow(row.recordId, selected)}
            onEdit={() => onEdit(row)}
            onDetails={() => onDetails(row)}
            onDelete={() => onDelete(row)}
          />
        ))}
        {!pageRows.length && (
          <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
            Nenhuma frota encontrada para os filtros.
          </div>
        )}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1390px] table-fixed border-collapse text-left text-xs">
          <colgroup>
            <col className="w-[42px]" />
            <col className="w-[110px]" />
            <col className="w-[165px]" />
            <col className="w-[92px]" />
            <col className="w-[190px]" />
            <col className="w-[90px]" />
            <col className="w-[145px]" />
            <col className="w-[76px]" />
            <col className="w-[95px]" />
            <col className="w-[130px]" />
            <col />
          <col className="w-[98px]" />
          <col className="w-[132px]" />
          </colgroup>
          <thead className="bg-slate-50 text-[9px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="border-b border-slate-200 p-2 text-center">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={togglePageSelection}
                  aria-label="Selecionar todos desta página"
                  className="size-4 accent-emerald-600"
                />
              </th>
              <th className="border-b border-slate-200 p-2">Grupo</th>
              <th className="border-b border-slate-200 p-2">Tipo</th>
              <th className="border-b border-slate-200 p-2">{header('Matrícula', 'employeeCode')}</th>
              <th className="border-b border-slate-200 p-2">{header('Motorista', 'driver')}</th>
              <th className="border-b border-slate-200 p-2">{header('Prefixo', 'prefix')}</th>
              <th className="border-b border-slate-200 p-2">{header('Status', 'status')}</th>
              <th className="border-b border-slate-200 p-2 text-center">{header('Saída', 'departure')}</th>
              <th className="border-b border-slate-200 p-2 text-center">{header('Parado', 'stopped')}</th>
              <th className="border-b border-slate-200 p-2">{header('Local', 'location')}</th>
              <th className="border-b border-slate-200 p-2">Observação</th>
              <th className="border-b border-slate-200 p-2 text-center">Aprovação</th>
              <th className="border-b border-slate-200 p-2 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.map((row, index) => {
              const selected = selectedIds.includes(row.recordId);
              return (
                <tr key={row.recordId} className={`transition-colors hover:bg-slate-50 ${selected ? 'bg-emerald-50' : index % 2 ? 'bg-slate-50/60' : 'bg-white'}`}>
                  <td className="p-2 text-center"><input type="checkbox" checked={selected} onChange={event => toggleRow(row.recordId, event.target.checked)} aria-label={`Selecionar ${row.equipment.prefix}`} className="size-4 accent-emerald-600" /></td>
                  <td className="truncate p-2 font-bold text-slate-700" title={row.equipment.family}>{row.equipment.family || '—'}</td>
                  <td className="truncate p-2 text-slate-600" title={row.equipment.equipmentType}>{row.equipment.equipmentType || '—'}</td>
                  <td className="p-2 font-mono font-bold text-slate-700">{row.driver?.employeeCode || '—'}</td>
                  <td className="truncate p-2 font-bold text-slate-900" title={row.driver?.employeeName}>{row.driver?.employeeName || 'Sem motorista'}</td>
                  <td className="p-2 font-black text-slate-950">{row.equipment.prefix}</td>
                  <td className="p-2"><FleetStatusBadge status={row.operationalStatus} compact /></td>
                  <td className="p-2 text-center font-mono">{row.departureTime || '—'}</td>
                  <td className="p-2 text-center font-mono font-bold">{row.stoppedDurationLabel}</td>
                  <td className="truncate p-2" title={row.location}>{row.location || 'Não informado'}</td>
                  <td className="p-2"><p className="line-clamp-2 leading-5 text-slate-600" title={[row.maintenanceReason, row.note].filter(Boolean).join('. ')}>{row.maintenanceReason ? `${row.maintenanceReason}. ` : ''}{row.note || '—'}</p></td>
                  <td className="p-2 text-center"><span className={`rounded-full px-2 py-1 text-[9px] font-black ${row.approvalStatus === 'APROVADO' ? 'bg-emerald-100 text-emerald-800' : row.approvalStatus === 'REJEITADO' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{row.approvalStatus || 'PENDENTE'}</span></td>
                  <td className="p-2"><div className="flex justify-center gap-1"><button type="button" onClick={() => onDetails(row)} title="Ver detalhes" className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"><Eye size={14} /></button>{canApprove && row.approvalStatus === 'PENDENTE' && onApprove && <><button type="button" onClick={() => onApprove(row, 'APROVADO')} title="Aprovar" className="rounded-md border border-emerald-200 p-2 text-emerald-700 hover:bg-emerald-50">✓</button><button type="button" onClick={() => onApprove(row, 'REJEITADO')} title="Rejeitar" className="rounded-md border border-rose-200 p-2 text-rose-700 hover:bg-rose-50">×</button></>}<button type="button" onClick={() => onEdit(row)} title="Editar" className="rounded-md border border-emerald-200 p-2 text-emerald-700 hover:bg-emerald-50"><Pencil size={14} /></button><button type="button" onClick={() => onDelete(row)} title="Excluir" className="rounded-md border border-rose-200 p-2 text-rose-700 hover:bg-rose-50"><Trash2 size={14} /></button></div></td>
                </tr>
              );
            })}
            {!pageRows.length && (
              <tr><td colSpan={13} className="p-12 text-center text-sm text-slate-500">Nenhuma frota encontrada para os filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
