import { ReactNode } from 'react';
import { cn } from './styles';

interface MetricGridProps {
  children: ReactNode;
  /** Número de colunas (1-4). Default: 4 no desktop, 2 no tablet, 1 no mobile */
  cols?: 1 | 2 | 3 | 4;
  className?: string;
}

export function MetricGrid({ children, cols = 4, className }: MetricGridProps) {
  const colsMap = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-4 sm:gap-5', colsMap[cols], className)}>
      {children}
    </div>
  );
}
