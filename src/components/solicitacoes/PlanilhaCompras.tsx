import { useEffect, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { loadProcurementSheetRows, type ProcurementSheetRow } from '../../services/procurementSheetApi';

const date = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—';

export function PlanilhaCompras() {
  const [rows, setRows] = useState<ProcurementSheetRow[]>([]);
  const [sheet, setSheet] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { let ativo = true; setLoading(true); loadProcurementSheetRows(sheet).then(data => { if (ativo) setRows(data); }).catch(e => { if (ativo) setError(e instanceof Error ? e.message : 'Falha ao carregar.'); }).finally(() => { if (ativo) setLoading(false); }); return () => { ativo = false; }; }, [sheet]);
  return <section aria-label="Visualização da planilha de compras" className="min-h-0 overflow-auto rounded-xl border border-slate-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
      <div className="flex items-center gap-2 font-black text-slate-800"><FileSpreadsheet className="size-4 text-[#176b4d]" /> Planilha sincronizada</div>
      <select aria-label="Aba da planilha" value={sheet} onChange={e => setSheet(e.target.value)} className="min-h-9 rounded-lg border border-slate-300 px-2 text-sm font-bold"><option value="">Solicitações</option><option value="Prioridade">Prioridade</option><option value="Substituição">Substituição</option></select>
    </div>
    {error ? <p role="alert" className="p-4 text-sm font-bold text-rose-700">{error}</p> : loading ? <p className="p-4 text-sm text-slate-500">Carregando dados sincronizados…</p> : <div className="min-w-[900px] overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600"><tr>{['Data','Pedido','Solicitante','Item','Unidade','Quantidade','SC','Entrega'].map(h => <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2">{date(row.request_date)}</td><td className="px-3 py-2 font-bold">{row.source_request_number || '—'}</td><td className="px-3 py-2">{row.requester_name || '—'}</td><td className="max-w-[360px] truncate px-3 py-2" title={row.item_description || ''}>{row.item_description || '—'}</td><td className="px-3 py-2">{row.unit || '—'}</td><td className="px-3 py-2 text-right font-bold">{row.quantity_requested ?? '—'}</td><td className="px-3 py-2">{row.source_purchase_order || '—'}</td><td className="px-3 py-2">{date(row.delivery_deadline)}</td></tr>)}</tbody></table></div>}
  </section>;
}
