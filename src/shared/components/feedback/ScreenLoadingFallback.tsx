import { Skeleton } from '../../ui';

interface ScreenLoadingFallbackProps {
  label?: string;
}

/**
 * Espera do carregamento da tela. Antes era um spinner no meio do vazio: a
 * página pulava do nada para o conteúdo inteiro. Agora o esqueleto já ocupa o
 * lugar do cabeçalho, dos indicadores e da tabela, então o que chega encaixa no
 * espaço que já estava reservado, sem solavanco.
 */
export const ScreenLoadingFallback = ({
  label = 'Carregando módulo...',
}: ScreenLoadingFallbackProps) => (
  <div className="min-h-full w-full bg-[#f6f7f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9" role="status" aria-label={label}>
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
      <div className="min-w-0 space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-9 w-32 rounded-lg" />
    </div>

    <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map(indice => (
        <div key={indice} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>

    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <Skeleton className="h-3 w-40" />
      </div>
      <ul className="divide-y divide-slate-100">
        {[0, 1, 2, 3, 4, 5].map(indice => (
          <li key={indice} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-20 rounded-md" />
          </li>
        ))}
      </ul>
    </div>
  </div>
);
