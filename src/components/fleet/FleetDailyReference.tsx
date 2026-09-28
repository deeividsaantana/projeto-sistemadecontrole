import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ClipboardCheck, Pencil, Plus, Save, Trash2, Truck } from 'lucide-react';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CARTAO, FOCO } from '../cadastros/estilos';
import type { ControleEquipamentoDiario } from '../../types';
import {
  reconcileOperationalFleetDay,
  OPERATIONAL_FLEET_REFERENCE,
  OPERATIONAL_FLEET_REFERENCE_STORAGE_KEY,
  type OperationalFleetReferenceGroup,
  type OperationalFleetReferenceStatus,
} from '../../fleet/operationalFleetReference';

interface Props {
  records: ControleEquipamentoDiario[];
  date: string;
}

type VisibilityFilter = 'pending' | 'all' | 'informed';

const GROUPS: readonly OperationalFleetReferenceGroup[] = ['Basculantes', 'Apoio'];

/** Quantos equipamentos cada grupo mostra antes de pedir para abrir o resto. */
const LIMITE_POR_GRUPO = 8;

const formatDate = (date: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR');
};

const statusTone = (item: OperationalFleetReferenceStatus): string => {
  if (!item.informed) return 'border-amber-200 bg-amber-50';
  if (item.operationalStatus === 'Em manutenção' || item.operationalStatus === 'Aguardando manutenção') return 'border-rose-200 bg-rose-50';
  return 'border-emerald-200 bg-emerald-50/70';
};

const statusTextTone = (item: OperationalFleetReferenceStatus): string => {
  if (!item.informed) return 'text-amber-700';
  if (item.operationalStatus === 'Em manutenção' || item.operationalStatus === 'Aguardando manutenção') return 'text-rose-700';
  return 'text-emerald-700';
};

const FleetChip = ({ item }: { item: OperationalFleetReferenceStatus }) => (
  <li className={`flex min-h-14 min-w-0 flex-col items-start justify-between gap-1 rounded-xl border px-3 py-2 sm:flex-row sm:items-center sm:gap-3 ${statusTone(item)}`}>
    <div className="w-full min-w-0 sm:w-auto">
      <strong className="block font-mono text-sm font-bold text-slate-950">{item.prefix}</strong>
      <span className="block truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.equipmentType}</span>
    </div>
    <span className={`inline-flex shrink-0 items-center gap-1 text-left text-[11px] sm:text-right font-bold uppercase ${statusTextTone(item)}`}>
      {item.informed ? <CheckCircle2 size={15}/> : <AlertTriangle size={15}/>}
      <span>{item.informed ? item.operationalStatus || 'Informado' : 'A confirmar'}{item.departureTime ? <small className="block text-[11px] font-semibold">{item.departureTime}</small> : null}</span>
    </span>
  </li>
);

export default function FleetDailyReference({ records, date }: Props) {
  const [visibility, setVisibility] = useState<VisibilityFilter>('pending');
  /**
   * A relação-base tem 39 equipamentos. Listar todos de uma vez empurra os
   * filtros e a tabela para 2.000 px abaixo no celular, e o operador que abre a
   * tela para lançar precisa rolar tudo antes de chegar no que veio fazer.
   * Cada grupo mostra os primeiros e abre o resto sob demanda.
   */
  const [gruposAbertos, setGruposAbertos] = useState<OperationalFleetReferenceGroup[]>([]);
  const [editing, setEditing] = useState(false);
  const [reference, setReference] = useState(() => {
    try {
      const raw = localStorage.getItem(OPERATIONAL_FLEET_REFERENCE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) && parsed.length ? parsed : [...OPERATIONAL_FLEET_REFERENCE];
    } catch { return [...OPERATIONAL_FLEET_REFERENCE]; }
  });
  useEffect(() => {
    if (!editing) return;
    localStorage.setItem(OPERATIONAL_FLEET_REFERENCE_STORAGE_KEY, JSON.stringify(reference));
  }, [editing, reference]);
  const reconciliation = useMemo(
    () => reconcileOperationalFleetDay(records, date, reference),
    [date, records, reference],
  );
  const progress = reconciliation.total
    ? Math.round((reconciliation.informed / reconciliation.total) * 100)
    : 0;
  const visibleItems = visibility === 'all'
    ? reconciliation.items
    : reconciliation.items.filter(item => visibility === 'informed' ? item.informed : !item.informed);

  return (
    <section className={`${CARTAO} overflow-hidden`} aria-labelledby="fleet-reference-title">
      <header className="grid gap-4 border-b border-slate-100 p-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[#176b4d]"><ClipboardCheck className="size-5" aria-hidden="true"/></span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#176b4d]">Conferência do dia · {formatDate(date)}</p>
            <h2 id="fleet-reference-title" className="mt-0.5 text-lg font-bold text-slate-950">Relação operacional do dia</h2>
            <p className="mt-0.5 text-sm text-slate-500">{reference.length} equipamentos esperados. Quem não foi lançado aparece como “A confirmar”.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-[#f7f8f6] text-center sm:grid-cols-4">
          <div className="px-4 py-2"><span className="block text-[11px] font-bold uppercase text-slate-500">Esperados</span><strong className="text-xl font-bold tabular-nums text-slate-950">{reconciliation.total}</strong></div>
          <div className="border-l border-slate-200 px-4 py-2"><span className="block text-[11px] font-bold uppercase text-emerald-700">Em operação</span><strong className="text-xl font-bold tabular-nums text-emerald-700">{reconciliation.operating}</strong></div>
          <div className="border-l border-t border-slate-200 px-4 py-2 sm:border-t-0"><span className="block text-[11px] font-bold uppercase text-rose-700">Manutenção</span><strong className="text-xl font-bold tabular-nums text-rose-700">{reconciliation.maintenance}</strong></div>
          <div className="border-l border-t border-slate-200 px-4 py-2 sm:border-t-0"><span className="block text-[11px] font-bold uppercase text-amber-700">A confirmar</span><strong className="text-xl font-bold tabular-nums text-amber-700">{reconciliation.missing}</strong></div>
        </div>
      </header>

      <div className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-slate-500"><span>Preenchimento do dia</span><span>{progress}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#176b4d] transition-[width] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]" style={{ width: `${progress}%` }}/></div>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#f7f8f6] p-1 ring-1 ring-inset ring-slate-200" role="group" aria-label="Filtrar relação operacional">
            {([
              ['pending', `A confirmar ${reconciliation.missing}`],
              ['all', `Todos ${reconciliation.total}`],
              ['informed', `Informados ${reconciliation.informed}`],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setVisibility(id)} className={`min-h-10 rounded-xl px-3 text-xs font-bold transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${visibility === id ? 'bg-white text-[#176b4d] ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'} ${FOCO}`}>{label}</button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f7f8f6] px-3 py-2 text-sm text-slate-700"><p><strong>Fechamento da relação:</strong> {reconciliation.operating} em operação + {reconciliation.maintenance} em manutenção + {reconciliation.missing} a confirmar = {reconciliation.operating + reconciliation.maintenance + reconciliation.missing} de {reconciliation.total} equipamentos esperados. <span className="text-slate-500">{reconciliation.informed} já informados.</span></p><button type="button" onClick={() => setEditing(value => !value)} className={BOTAO_SECUNDARIO}>{editing ? <Save className="size-4" aria-hidden="true"/> : <Pencil className="size-4" aria-hidden="true"/>} {editing ? 'Concluir edição' : 'Editar relação'}</button></div>

        {editing && <section className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3" aria-label="Editor da relação operacional"><div className="mb-2 flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-wide text-[#176b4d]">Relação esperada</p><p className="text-xs text-emerald-900">Altere, remova ou inclua equipamentos esperados no dia.</p></div><button type="button" onClick={() => setReference(items => [...items, { prefix: `NOVO-${items.length + 1}`, group: 'Basculantes', equipmentType: 'Caminhão Basculante' }])} className={BOTAO_PRIMARIO}><Plus className="size-4" aria-hidden="true"/>Adicionar equipamento</button></div><div className="max-h-72 overflow-auto rounded-xl border border-emerald-100 bg-white"><table className="w-full min-w-[620px] text-left text-xs"><thead className="sticky top-0 bg-emerald-100 text-[10px] uppercase tracking-wide text-emerald-900"><tr><th className="px-3 py-2">Prefixo</th><th className="px-3 py-2">Grupo</th><th className="px-3 py-2">Tipo de equipamento</th><th className="px-3 py-2 text-right">Ação</th></tr></thead><tbody className="divide-y divide-emerald-50">{reference.map((item, index) => <tr key={`${item.prefix}-${index}`}><td className="px-3 py-1.5"><input aria-label={`Prefixo ${index + 1}`} value={item.prefix} onChange={event => setReference(items => items.map((current, currentIndex) => currentIndex === index ? { ...current, prefix: event.target.value.toUpperCase() } : current))} className="min-h-10 w-28 rounded-lg border border-slate-200 px-2 font-mono text-sm"/></td><td className="px-3 py-1.5"><select aria-label={`Grupo ${index + 1}`} value={item.group} onChange={event => setReference(items => items.map((current, currentIndex) => currentIndex === index ? { ...current, group: event.target.value as OperationalFleetReferenceGroup } : current))} className="min-h-10 rounded-lg border border-slate-200 px-2 text-sm"><option value="Basculantes">Basculantes</option><option value="Apoio">Apoio</option></select></td><td className="px-3 py-1.5"><input aria-label={`Tipo ${index + 1}`} value={item.equipmentType} onChange={event => setReference(items => items.map((current, currentIndex) => currentIndex === index ? { ...current, equipmentType: event.target.value } : current))} className="min-h-10 w-full rounded-lg border border-slate-200 px-2 text-sm"/></td><td className="px-3 py-1.5 text-right"><button type="button" aria-label={`Excluir ${item.prefix}`} onClick={() => setReference(items => items.filter((_, currentIndex) => currentIndex !== index))} className={`grid size-10 place-items-center rounded-lg text-rose-700 hover:bg-rose-50 ${FOCO}`}><Trash2 className="size-4" aria-hidden="true"/></button></td></tr>)}</tbody></table></div></section>}

        {reconciliation.missing === 0 && visibility === 'pending' ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"><CheckCircle2 className="size-5" aria-hidden="true"/><div><strong className="block text-sm">Relação completa</strong><span className="text-xs">Os {reconciliation.total} equipamentos foram informados nesta data.</span></div></div>
        ) : (
          /* items-start: sem isso os dois grupos esticam até a altura do maior e o
             de Apoio, com 7 itens ao lado de 32, vira um cartão com meio metro
             de vazio. */
          <div className="mt-4 grid items-start gap-4 xl:grid-cols-2">
            {GROUPS.map(group => {
              const groupItems = visibleItems.filter(item => item.group === group);
              const allGroupItems = reconciliation.items.filter(item => item.group === group);
              const informed = allGroupItems.filter(item => item.informed).length;
              if (!groupItems.length) return null;
              const aberto = gruposAbertos.includes(group);
              const visiveis = aberto ? groupItems : groupItems.slice(0, LIMITE_POR_GRUPO);
              const restantes = groupItems.length - visiveis.length;
              return (
                <article key={group} className="rounded-[1.25rem] bg-[#f7f8f6] p-1.5 ring-1 ring-slate-200">
                  <header className="mb-1.5 flex items-center justify-between gap-3 rounded-[0.9rem] bg-white px-3 py-2.5"><div className="flex items-center gap-2"><Truck className="size-4 text-[#176b4d]" aria-hidden="true"/><h3 className="text-sm font-bold uppercase tracking-wide text-slate-950">{group}</h3></div><span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">{informed}/{allGroupItems.length}</span></header>
                  <ul className="grid grid-cols-2 gap-1.5 p-1">{visiveis.map(item => <FleetChip key={item.prefix} item={item}/>)}</ul>
                  {(restantes > 0 || aberto) && (
                    <button
                      type="button"
                      onClick={() => setGruposAbertos(atual => aberto ? atual.filter(item => item !== group) : [...atual, group])}
                      aria-expanded={aberto}
                      className={`mt-1 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold text-slate-700 ring-1 ring-slate-200 transition hover:text-[#176b4d] hover:ring-emerald-300 ${FOCO}`}
                    >
                      {aberto ? 'Mostrar menos' : `Ver os outros ${restantes} de ${group}`}
                      <ChevronDown className={`size-4 transition duration-300 ${aberto ? 'rotate-180' : ''}`} aria-hidden="true"/>
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {(reconciliation.unexpectedPrefixes.length > 0 || reconciliation.duplicatePrefixes.length > 0) && (
          <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
            {reconciliation.unexpectedPrefixes.length > 0 && <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sky-800"><strong>Fora da relação-base:</strong> {reconciliation.unexpectedPrefixes.join(', ')}</p>}
            {reconciliation.duplicatePrefixes.length > 0 && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800"><strong>Prefixos duplicados no dia:</strong> {reconciliation.duplicatePrefixes.join(', ')}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
