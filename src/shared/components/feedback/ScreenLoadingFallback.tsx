interface ScreenLoadingFallbackProps {
  label?: string;
}

export const ScreenLoadingFallback = ({
  label = 'Carregando módulo...',
}: ScreenLoadingFallbackProps) => (
  <div className="min-h-[240px] w-full grid place-items-center bg-slate-950 text-slate-300">
    <div className="flex items-center gap-3 text-sm font-semibold">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500" />
      {label}
    </div>
  </div>
);
