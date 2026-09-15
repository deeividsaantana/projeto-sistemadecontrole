import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, LayoutGrid, Search } from 'lucide-react';
import { Modal } from '../../shared/ui';
import type { NavigationGroupView } from './NavigationMenu';

interface ModuleHubDialogProps {
  activeTab: string;
  groups: NavigationGroupView[];
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR');

/** Hub das rotas menos frequentes, sem aumentar a navegação operacional diária. */
export function ModuleHubDialog({ activeTab, groups, open, onClose, onNavigate }: ModuleHubDialogProps) {
  const [query, setQuery] = useState('');
  const fieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    window.setTimeout(() => fieldRef.current?.focus(), 0);
  }, [open]);

  const filteredGroups = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return groups;
    return groups
      .map(group => ({
        ...group,
        items: group.items.filter(item => normalize(`${group.label} ${item.label}`).includes(term)),
      }))
      .filter(group => group.items.length > 0);
  }, [groups, query]);

  const openModule = (tab: string) => {
    onClose();
    onNavigate(tab);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Todos os módulos"
      description="Acesso aos módulos permitidos para o seu perfil."
      className="sm:max-w-6xl sm:rounded-lg"
    >
      <label className="relative block">
        <span className="mb-2 block text-xs font-semibold text-slate-700">Buscar módulo</span>
        <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-slate-400" aria-hidden="true" />
        <input
          ref={fieldRef}
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Ex.: medições, cronograma, qualidade"
          className="min-h-11 w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
        />
      </label>

      {filteredGroups.length === 0 ? (
        <div className="flex min-h-44 flex-col items-center justify-center border-t border-slate-100 text-center">
          <LayoutGrid className="h-6 w-6 text-slate-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-slate-700">Nenhum módulo encontrado</p>
          <p className="mt-1 text-xs text-slate-500">Tente buscar pelo nome da operação ou do cadastro.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredGroups.map(group => (
            <section key={group.label} aria-label={group.label} className="border-t border-slate-200 pt-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">{group.label}</p>
              <div className="divide-y divide-slate-100">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const current = item.id === activeTab;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openModule(item.id)}
                      className={`group flex min-h-11 w-full items-center gap-3 py-2 text-left transition-colors ${current ? 'text-emerald-800' : 'text-slate-700 hover:text-emerald-800'}`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${current ? 'text-emerald-700' : 'text-slate-400 group-hover:text-emerald-700'}`} strokeWidth={1.75} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </Modal>
  );
}
