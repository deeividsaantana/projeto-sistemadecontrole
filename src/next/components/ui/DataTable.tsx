import type { ReactNode } from 'react';
import { EmptyState, ErrorState, LoadingState } from './States';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

const ALIGN_CLASS: Record<NonNullable<DataTableColumn<unknown>['align']>, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  error,
  onRetry,
  emptyTitle = 'Nenhum registro encontrado',
  emptyDescription,
}: DataTableProps<T>) {
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState description={error} onRetry={onRetry} />;
  if (rows.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)]">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="bg-[var(--color-surface-sunken)]">
            {columns.map(column => (
              <th
                key={column.key}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[var(--color-ink-muted)] ${ALIGN_CLASS[column.align ?? 'left']}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={rowKey(row)} className="border-t border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-sunken)]/60">
              {columns.map(column => (
                <td key={column.key} className={`px-4 py-2.5 text-[var(--color-ink-primary)] ${ALIGN_CLASS[column.align ?? 'left']} ${column.className ?? ''}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
