import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 60_000,
    },
    mutations: {
      retry: false,
    },
  },
});

interface ApplicationErrorBoundaryState {
  error: Error | null;
}

interface ApplicationErrorBoundaryProps {
  children?: ReactNode;
}

class ApplicationErrorBoundary extends Component<ApplicationErrorBoundaryProps, ApplicationErrorBoundaryState> {
  state: ApplicationErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ApplicationErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Falha não tratada na interface do ERP.', error, errorInfo);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <main className="relative grid min-h-screen place-items-center overflow-hidden bg-white px-5 py-8 text-slate-950 sm:p-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-emerald-700" />
        <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full border border-emerald-100" />
        <div className="pointer-events-none absolute -bottom-36 -left-28 size-96 rounded-full border border-slate-100" />

        <section className="relative w-full max-w-2xl border border-slate-200 bg-white p-6 shadow-[0_24px_65px_rgba(15,40,31,0.08)] sm:p-10" aria-labelledby="interface-error-title">
          <header className="flex items-center justify-between border-b border-slate-100 pb-5">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-700"><ShieldCheck size={20} strokeWidth={2.1} /></div>
              <div>
                <p className="text-sm font-black tracking-[-0.03em] text-slate-900">RENEA</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Central operacional</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700"><i className="size-2 rounded-full bg-emerald-500" />Dados preservados</span>
          </header>

          <div className="mt-9 grid gap-7 sm:grid-cols-[auto_1fr] sm:items-start">
            <div className="grid size-14 place-items-center rounded-full border border-amber-200 bg-amber-50 text-amber-600"><AlertTriangle size={26} strokeWidth={1.8} /></div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">Recuperação necessária</p>
              <h1 id="interface-error-title" className="mt-3 max-w-lg text-3xl font-black leading-[1.02] tracking-[-0.055em] text-slate-950 sm:text-4xl">Não foi possível abrir esta tela.</h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">Os seus registros permanecem protegidos. Atualize o sistema para tentar novamente; se a falha continuar, informe o horário para que a equipe possa localizar o ocorrido.</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-11 items-center justify-center gap-2 bg-emerald-700 px-5 text-sm font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"><RefreshCw size={16} />Tentar novamente</button>
                <button type="button" onClick={() => window.history.back()} className="inline-flex min-h-11 items-center justify-center gap-2 border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"><ArrowLeft size={16} />Voltar</button>
              </div>
            </div>
          </div>

          <footer className="mt-10 border-t border-slate-100 pt-4 text-[11px] leading-5 text-slate-400">RENEA ERP · A recuperação não altera lançamentos, cadastros ou históricos.</footer>
        </section>
      </main>
    );
  }
}

export const AppProviders = ({ children }: PropsWithChildren) => (
  <ApplicationErrorBoundary>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </ApplicationErrorBoundary>
);
