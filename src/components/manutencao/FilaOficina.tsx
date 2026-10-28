/**
 * Fila de oficina: as OS em curso, ordenadas pelo tempo parado do
 * equipamento. Fica dentro de "Hoje", logo abaixo dos cartões do dia.
 */
import { Wrench } from 'lucide-react';
import type { OrdemServico } from '../../types';
import type { MaintenanceQueueItem } from '../../utils/maintenanceQueue';
import { EQUIPMENT_FAMILY_LABELS, equipmentFamilyIcon } from '../../utils/equipmentPresentation';
import { proximoStatusManutencao } from '../../utils/manutencao';
import { EmptyState, statusTone } from '../../shared/ui';
import { CARTAO, FOCO } from '../cadastros/estilos';

const formatarData = (valor?: string) => (valor ? valor.slice(0, 10).split('-').reverse().join('/') : '—');
const formatarHoras = (valor?: number) => (valor === undefined ? '—' : `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`);

interface Props {
  fila: readonly MaintenanceQueueItem[];
  ordensServico: readonly OrdemServico[];
  podeEditar: boolean;
  onAvancar: (ordem: OrdemServico) => void;
  onEditar: (ordem: OrdemServico) => void;
}

export function FilaOficina({ fila, ordensServico, podeEditar, onAvancar, onEditar }: Props) {
  return (
    <section aria-labelledby="manutencao-fila-titulo" data-manutencao-reveal>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="manutencao-fila-titulo" className="text-base font-black text-slate-900">Fila de oficina</h2>
          <p className="text-sm text-slate-600">OS em curso, da que está parada há mais tempo para a mais nova.</p>
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums text-slate-600">{fila.length} em curso</span>
      </div>
      {fila.length === 0
        ? <EmptyState compact icon={Wrench} title="Nenhuma OS em curso" description="Nenhum equipamento está esperando a oficina." />
        : (
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {fila.slice(0, 12).map(item => {
              const Icon = equipmentFamilyIcon(item.familia);
              const ordem = ordensServico.find(candidata => candidata.id === item.ordemId);
              const proximo = ordem ? proximoStatusManutencao(ordem.status) : undefined;
              return (
                <article key={item.ordemId} className={`${CARTAO} p-3.5 transition duration-200 hover:border-emerald-300`}>
                  <header className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-800" role="img" aria-label={EQUIPMENT_FAMILY_LABELS[item.familia]}>
                      <Icon className="size-5" strokeWidth={1.7} aria-hidden="true" />
                    </span>
                    <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <strong className="block truncate text-base font-black text-slate-900">{item.prefixo}</strong>
                        <span className="block line-clamp-2 break-words text-xs font-bold uppercase tracking-wide text-slate-500">{item.equipamentoNome}</span>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${statusTone(item.status)}`}>{item.status}</span>
                    </div>
                  </header>
                  <p className="mt-3 line-clamp-2 text-sm font-semibold text-slate-700" title={item.motivo}>{item.motivo}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 border-y border-slate-100 py-2.5 text-xs">
                    <div><dt className="text-[#5b6870]">Desde</dt><dd className="mt-0.5 font-bold text-slate-700">{formatarData(item.desde)}</dd></div>
                    <div className="text-right"><dt className="text-[#5b6870]">Tempo da OS</dt><dd className="mt-0.5 font-black tabular-nums text-rose-700">{formatarHoras(item.horasParadas)}</dd></div>
                  </dl>
                  <footer className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#5b6870]">{item.numero}</span>
                    <span className="flex gap-1.5">
                      {podeEditar && proximo && ordem && <button type="button" onClick={() => onAvancar(ordem)} className={`min-h-11 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-bold text-emerald-800 transition hover:border-emerald-500 md:min-h-10 ${FOCO}`}>{proximo}</button>}
                      {podeEditar && ordem && <button type="button" aria-label={`Editar ${item.numero}`} onClick={() => onEditar(ordem)} className={`min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-600 transition hover:border-emerald-500 hover:text-emerald-800 md:min-h-10 ${FOCO}`}>Editar</button>}
                    </span>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
    </section>
  );
}
