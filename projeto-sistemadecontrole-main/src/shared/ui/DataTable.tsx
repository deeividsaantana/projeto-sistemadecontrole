import { useMemo, useState, type ReactNode } from 'react';
import { Pagination } from './Pagination';
import { TableBody, TableHead, TableShell } from './TableShell';

export interface DataTableColumn<T> {
  id: string;
  label: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right';
}

interface DataTableProps<T> {
  caption: string;
  rows: readonly T[];
  columns: readonly DataTableColumn<T>[];
  getRowId: (row: T) => string;
  minWidth?: number;
  pageSize?: number;
  loading?: boolean;
  emptyMessage?: string;
}

type SortState = { columnId: string; direction: 'ascending' | 'descending' } | null;

/** Local table for already scoped result sets. Remote pagination will be a separate data adapter. */
export function DataTable<T>({ caption, rows, columns, getRowId, minWidth = 720, pageSize = 50, loading = false, emptyMessage = 'Nenhum registro encontrado.' }: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(1);
  const collator = useMemo(() => new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' }), []);
  const sorted = useMemo(() => {
    const column = columns.find(item => item.id === sort?.columnId);
    if (!column?.sortValue || !sort) return rows;
    const direction = sort.direction === 'ascending' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const first = column.sortValue!(a);
      const second = column.sortValue!(b);
      if (first == null && second == null) return 0;
      if (first == null) return 1;
      if (second == null) return -1;
      const comparison = typeof first === 'number' && typeof second === 'number'
        ? first - second
        : collator.compare(String(first), String(second));
      return comparison * direction;
    });
  }, [collator, columns, rows, sort]);
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(sorted.length / safePageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = sorted.slice((currentPage - 1) * safePageSize, currentPage * safePageSize);

  const changeSort = (columnId: string) => {
    setSort(current => current?.columnId === columnId && current.direction === 'ascending'
      ? { columnId, direction: 'descending' }
      : { columnId, direction: 'ascending' });
    setPage(1);
  };

  return (
    <>
      <TableShell minWidth={minWidth}>
        <caption className="sr-only">{caption}</caption>
        <TableHead>
          <tr>
            {columns.map(column => (
              <th
                key={column.id}
                scope="col"
                aria-sort={sort?.columnId === column.id ? sort.direction : undefined}
                className={`p-3 ${column.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {column.sortValue ? (
                  <button
                    type="button"
                    onClick={() => changeSort(column.id)}
                    className="inline-flex min-h-9 items-center gap-1 rounded px-1 text-inherit hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
                  >
                    {column.label}
                    <span aria-hidden="true">{sort?.columnId === column.id ? sort.direction === 'ascending' ? '↑' : '↓' : '↕'}</span>
                  </button>
                ) : column.label}
              </th>
            ))}
          </tr>
        </TableHead>
        <TableBody>
          {loading ? <tr><td colSpan={columns.length} className="p-8 text-center text-slate-600" role="status">Carregando registros…</td></tr>
            : visible.length === 0 ? <tr><td colSpan={columns.length} className="p-8 text-center text-slate-600">{emptyMessage}</td></tr>
              : visible.map(row => (
            <tr key={getRowId(row)} className="transition-colors hover:bg-slate-50">
              {columns.map(column => <td key={column.id} className="p-3">{column.cell(row)}</td>)}
            </tr>
              ))}
        </TableBody>
      </TableShell>
      {!loading && totalPages > 1 && <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />}
    </>
  );
}
