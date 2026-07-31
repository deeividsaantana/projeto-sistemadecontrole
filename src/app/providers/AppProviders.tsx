import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

class ApplicationErrorBoundary extends Component<PropsWithChildren, ApplicationErrorBoundaryState> {
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
      <main className="min-h-screen bg-slate-950 text-slate-100 grid place-items-center p-6">
        <section className="w-full max-w-xl rounded-2xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-400">Falha de interface</p>
          <h1 className="mt-2 text-xl font-bold">O sistema preservou os dados, mas esta tela não pôde ser exibida.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Recarregue a aplicação. Se o problema continuar, registre a tela e o horário para análise.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-500"
          >
            Recarregar sistema
          </button>
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
