import { useEffect, useState } from 'react';
import { PageHeader } from '../../shared/ui';
import type { PrivateRoute } from './privateRoutes';
import { resolveActiveScope, type ActiveScope } from '../context/activeScope';
import { loadSupabaseMemberships } from '../../supabase/memberships';
import { isSupabaseCloudEnabled } from '../../platform/cloudProvider';
import { SaaSShell } from '../shell/SaaSShell';

interface PrivateRouteAppProps {
  route: PrivateRoute;
}

type ScopeState = { status: 'loading' } | { status: 'ready'; scope: ActiveScope } | { status: 'denied'; message: string };

export function PrivateRouteApp({ route }: PrivateRouteAppProps) {
  const [state, setState] = useState<ScopeState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const loadScope = async () => {
      if (!isSupabaseCloudEnabled) {
        setState({ status: 'denied', message: 'O contexto SaaS ainda não está habilitado neste ambiente.' });
        return;
      }
      try {
        const memberships = await loadSupabaseMemberships();
        const scope = resolveActiveScope(route.organizationId, route.projectId, memberships);
        if (!cancelled) setState(scope ? { status: 'ready', scope } : { status: 'denied', message: 'Sua conta não possui acesso a esta organização ou obra.' });
      } catch (error) {
        if (!cancelled) setState({ status: 'denied', message: error instanceof Error ? error.message : 'Não foi possível validar o acesso.' });
      }
    };
    void loadScope();
    return () => { cancelled = true; };
  }, [route.organizationId, route.projectId]);

  if (state.status === 'loading') return <main className="grid min-h-screen place-items-center text-sm text-slate-600">Validando acesso…</main>;
  if (state.status === 'denied') return <main className="grid min-h-screen place-items-center px-6 text-center"><p className="max-w-md text-sm text-rose-700">{state.message}</p></main>;

  return (
    <SaaSShell scope={state.scope} activeModule={route.module}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title={route.module === 'home' ? 'Início SaaS' : route.module}
          description={`Organização ${state.scope.organizationId} · obra ${state.scope.projectId} · perfil ${state.scope.role}`}
        />
        <section className="mt-6 border border-slate-200 bg-white p-6" aria-live="polite">
          <h2 className="text-lg font-bold">Módulo preparado</h2>
          <p className="mt-2 text-sm text-slate-600">O escopo autorizado está ativo. A migração funcional desta área seguirá sem alterar o fluxo legado.</p>
        </section>
      </div>
    </SaaSShell>
  );
}