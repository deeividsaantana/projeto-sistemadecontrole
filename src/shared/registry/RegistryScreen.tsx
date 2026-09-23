import { useState } from 'react';
import { Inbox, Plus, Search, Trash2, Edit } from 'lucide-react';
import { PageHeader, Modal, TableShell, TableHead, TableBody, Pagination, EmptyState, Badge, ConfirmDialog } from '../ui';
import type { RegistryConfig, RegistryField } from './registryTypes';
import { useRegistryState } from './useRegistryState';
import { isDuplicateOfExisting } from './duplicateDetection';

interface Props<T extends { id: string }> {
  config: RegistryConfig<T>;
  items: readonly T[];
  onSave: (item: T, isNew: boolean, onError?: (err: Error) => void) => void;
  onDelete: (id: string) => void;
}

const inputClass = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500';

const fieldValue = <T,>(item: Record<string, unknown>, field: RegistryField<T>) =>
  item[field.key] ?? (field.type === 'checkbox' ? false : field.type === 'number' ? 0 : '');

const FieldInput = <T,>({ field, value, onChange }: { field: RegistryField<T>; value: unknown; onChange: (value: unknown) => void }) => {
  if (field.type === 'checkbox') {
    return <input type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} className="h-4 w-4" />;
  }
  if (field.type === 'select') {
    return (
      <select value={String(value ?? '')} onChange={e => onChange(e.target.value)} className={inputClass}>
        <option value="">Selecione…</option>
        {(field.options || []).map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }
  return (
    <input
      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
      value={value == null ? '' : String(value)}
      placeholder={field.placeholder}
      onChange={e => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)}
      className={inputClass}
      required={field.required}
    />
  );
};

export default function RegistryScreen<T extends { id: string }>({ config, items, onSave, onDelete }: Props<T>) {
  const state = useRegistryState(items, config);
  const [editing, setEditing] = useState<T | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formDraft, setFormDraft] = useState<Record<string, unknown>>({});
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [batchDrafts, setBatchDrafts] = useState<Record<string, unknown>[] | null>(null);
  const [batchErrors, setBatchErrors] = useState<Record<number, string>>({});

  const openNew = () => { setEditing(null); setFormDraft({ ...config.emptyItem() }); setFormError(''); setFormOpen(true); };
  const openEdit = (item: T) => { setEditing(item); setFormDraft({ ...item }); setFormError(''); setFormOpen(true); };

  const validate = (draft: Record<string, unknown>, ignoreId?: string): string | undefined => {
    for (const field of config.fields) {
      if (field.required && !fieldValue(draft, field)) return `${field.label} é obrigatório.`;
    }
    const candidate = draft as T;
    const others = state.scoped.filter(item => item.id !== ignoreId);
    if (isDuplicateOfExisting(candidate, others, config.operationalKey)) {
      if (config.duplicateMode === 'bloqueia') return `Já existe um registro com a mesma chave (${config.operationalKey(candidate)}).`;
    }
    return config.extraValidation?.(candidate);
  };

  const submitForm = () => {
    const error = validate(formDraft, editing?.id);
    if (error) { setFormError(error); return; }
    const isNew = !editing;
    const id = editing?.id ?? `${config.idPrefix}-${Date.now()}`;
    onSave({ ...(formDraft as T), id }, isNew, err => setFormError(err.message));
    setFormOpen(false);
  };

  const startBatch = () => { setBatchDrafts([{ ...config.emptyItem() }]); setBatchErrors({}); };
  const addBatchRow = () => setBatchDrafts(current => [...(current || []), { ...config.emptyItem() }]);
  const updateBatchRow = (index: number, key: string, value: unknown) =>
    setBatchDrafts(current => (current || []).map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  const saveBatch = () => {
    const drafts = batchDrafts || [];
    const nextErrors: Record<number, string> = {};
    const stillOpen: Record<string, unknown>[] = [];
    drafts.forEach((draft, index) => {
      const hasAnyValue = config.fields.some(field => fieldValue(draft, field));
      if (!hasAnyValue) return; // linha em branco não preenchida: ignora, não é erro
      const error = validate(draft);
      if (error) { nextErrors[stillOpen.length] = error; stillOpen.push(draft); return; }
      onSave({ ...(draft as T), id: `${config.idPrefix}-${Date.now()}-${index}` }, true);
    });
    setBatchErrors(nextErrors);
    setBatchDrafts(stillOpen.length > 0 ? stillOpen : null);
  };

  const columns = config.fields.filter(field => field.type !== 'checkbox' || field.quickEdit);

  return (
    <div className="space-y-4">
      <PageHeader
        title={config.label}
        description={`${state.filtered.length} registro(s)${state.duplicateCount > 0 ? ` · ${state.duplicateCount} em possível duplicidade` : ''}`}
        actions={<button type="button" onClick={openNew} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-xs font-black text-white"><Plus className="h-4 w-4" /> Novo</button>}
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[9px] font-black uppercase text-slate-500">Total</p><strong className="text-xl text-slate-800">{state.scoped.length}</strong></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[9px] font-black uppercase text-slate-500">Filtrados</p><strong className="text-xl text-slate-800">{state.filtered.length}</strong></div>
        <div className={`rounded-xl border p-3 ${state.duplicateCount > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}><p className="text-[9px] font-black uppercase text-slate-500">Possíveis duplicados</p><strong className="text-xl text-slate-800">{state.duplicateCount}</strong></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[9px] font-black uppercase text-slate-500">Página</p><strong className="text-xl text-slate-800">{state.page}/{state.totalPages}</strong></div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input value={state.search} onChange={e => { state.setSearch(e.target.value); state.setPage(1); }} placeholder="Buscar" className={`${inputClass} pl-8`} />
        </label>
        <button type="button" onClick={startBatch} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700">Adicionar linhas</button>
      </div>

      {batchDrafts && (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
          {batchDrafts.map((draft, index) => (
            <div key={index} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-2 sm:grid-cols-4">
              {config.fields.map(field => (
                <FieldInput key={field.key} field={field} value={fieldValue(draft, field)} onChange={value => updateBatchRow(index, field.key, value)} />
              ))}
              {batchErrors[index] && <p className="sm:col-span-4 text-[10px] font-bold text-rose-600">{batchErrors[index]}</p>}
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setBatchDrafts(null)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700">Cancelar</button>
            <button type="button" onClick={addBatchRow} className="rounded-md border border-emerald-500 bg-white px-4 py-2 text-xs font-black text-emerald-700">+ linha</button>
            <button type="button" onClick={saveBatch} className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-black text-white">Salvar todas</button>
          </div>
        </div>
      )}

      <TableShell>
        <TableHead>
          <tr>
            {columns.map(field => <th key={field.key} className="py-3 px-4 text-left">{field.label}</th>)}
            <th className="py-3 px-4 text-right">Ações</th>
          </tr>
        </TableHead>
        <TableBody>
          {state.paged.length === 0 ? (
            <tr><td colSpan={columns.length + 1}><EmptyState icon={Inbox} title="Nenhum registro encontrado" /></td></tr>
          ) : state.paged.map(item => (
            <tr key={item.id} className="border-b border-slate-100">
              {columns.map(field => (
                <td key={field.key} className="py-2 px-4">
                  {field.quickEdit
                    ? <FieldInput field={field} value={fieldValue(item as Record<string, unknown>, field)} onChange={value => onSave({ ...item, [field.key]: value }, false)} />
                    : field.type === 'checkbox'
                      ? <Badge tone={fieldValue(item as Record<string, unknown>, field) ? 'success' : 'neutral'}>{fieldValue(item as Record<string, unknown>, field) ? 'Sim' : 'Não'}</Badge>
                      : String(fieldValue(item as Record<string, unknown>, field) ?? '—')}
                </td>
              ))}
              <td className="py-2 px-4 text-right">
                <button type="button" onClick={() => openEdit(item)} className="mr-2 text-slate-500 hover:text-emerald-700"><Edit className="h-4 w-4" /></button>
                <button type="button" onClick={() => setDeleteId(item.id)} className="text-slate-500 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </td>
            </tr>
          ))}
        </TableBody>
      </TableShell>

      <Pagination page={state.page} totalPages={state.totalPages} onChange={state.setPage} />

      <Modal
        open={formOpen}
        title={editing ? `Editar ${config.label}` : `Novo em ${config.label}`}
        onClose={() => setFormOpen(false)}
        onSubmit={submitForm}
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFormOpen(false)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700">Cancelar</button>
            <button type="button" onClick={submitForm} className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-black text-white">Salvar</button>
          </div>
        )}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {config.fields.map(field => (
            <label key={field.key} className="space-y-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {field.label}{field.required ? ' *' : ''}
              <FieldInput field={field} value={fieldValue(formDraft, field)} onChange={value => setFormDraft(current => ({ ...current, [field.key]: value }))} />
            </label>
          ))}
        </div>
        {formError && <p className="mt-2 text-xs font-bold text-rose-600">{formError}</p>}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Excluir registro"
        description="Esta ação não pode ser desfeita."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) onDelete(deleteId); setDeleteId(null); }}
      />
    </div>
  );
}
