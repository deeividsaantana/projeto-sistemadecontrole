import type { ReactNode } from 'react';
import { ArrowRight, Building2, LayoutDashboard, LogOut, ShieldCheck } from 'lucide-react';
import type { ActiveScope } from '../context/activeScope';
import { PRIVATE_MODULES, type PrivateModule } from '../routing/privateRoutes';

const labels: Record<PrivateModule, string> = {
  home: 'Início', pending: 'Pendências', registries: 'Cadastros', materials: 'Materiais',
  inventory: 'Estoque', equipment: 'Equipamentos', fleet: 'Frota', fuel: 'Combustível',
  travels: 'Viagens', stakes: 'Estacas', field: 'Campo', presence: 'Presença', rdo: 'RDO',
  maintenance: 'Manutenção', reports: 'Relatórios', management: 'Gestão', admin: 'Administração',
};

interface SaaSShellProps {
  scope: ActiveScope;
  activeModule: PrivateModule;
  children: ReactNode;
}

export function SaaSShell({ scope, activeModule, children }: SaaSShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b border-slate-200 bg-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-5 lg:block">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center bg-emerald-700 text-white"><ShieldCheck size={18} /></span>
            <span><strong className="block text-sm font-black tracking-tight">RENEA</strong><small className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">SaaS operacional</small></span>
          </div>
          <div className="mt-6 hidden border-t border-slate-100 pt-4 lg:block">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Escopo ativo</p>
            <p className="mt-1 truncate text-xs font-bold text-slate-800">{scope.organizationId}</p>
            <p className="truncate text-xs text-slate-500">Obra {scope.projectId}</p>
          </div>
        </div>
        <nav aria-label="Módulos SaaS" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:px-3 lg:pb-5 lg:pt-6">
          {PRIVATE_MODULES.map(module => (
            <a key={module} href={`/app/${encodeURIComponent(scope.organizationId)}/${encodeURIComponent(scope.projectId)}/${module}`} className={`inline-flex shrink-0 items-center gap-2 px-3 py-2 text-xs font-bold transition lg:flex ${module === activeModule ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'}`} aria-current={module === activeModule ? 'page' : undefined}>
              {module === 'home' ? <LayoutDashboard size={15} /> : <ArrowRight size={15} />}{labels[module]}
            </a>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-16 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
          <div className="flex items-center gap-2 text-xs text-slate-500"><Building2 size={15} />{scope.organizationId} / {scope.projectId}</div>
          <span className="text-xs font-bold text-slate-500">Perfil: {scope.role}</span>
        </header>
        <main className="px-5 py-7 sm:px-8">{children}</main>
      </div>
    </div>
  );
}