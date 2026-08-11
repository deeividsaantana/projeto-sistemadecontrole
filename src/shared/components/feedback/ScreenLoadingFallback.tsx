interface ScreenLoadingFallbackProps {
  label?: string;
}

export const ScreenLoadingFallback = ({
  label = 'Carregando módulo...',
}: ScreenLoadingFallbackProps) => (
  <div className="min-h-[240px] w-full grid place-items-center bg-slate-50 text-slate-600">
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold shadow-sm">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500 motion-reduce:animate-none" />
      <span>{label}</span>
    </div>
  </div>
);
