import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { loadProcurementSheet, type ProcurementSheetRow, type ProcurementSyncRun } from '../../services/procurementSheetApi';
import { Campo } from '../../shared/ui/Lancamento';
import { TabelaPadrao, type ColunaTabela } from '../../shared/ui/TabelaPadrao';
import { CAMPO } from '../cadastros/estilos';

const date = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—';
// "OK" na previsão quer dizer entregue: o banco guarda só datas, o texto fica no raw_data.
const entrega = (row: ProcurementSheetRow) => row.delivery_deadline ? date(row.delivery_deadline) : String(row.raw_data?.delivery_deadline ?? '').trim() || '—';
const leitura = (run: ProcurementSyncRun | null) => {
  if (!run?.finished_at) return 'Ainda não lida';
  const quando = new Date(run.finished_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return run.status === 'SUCESSO' ? `Lida em ${quando}` : `Falhou em ${quando}`;
};

export function PlanilhaCompras() {
  const [rows, setRows] = useState<ProcurementSheetRow[]>([]);
  const [sheet, setSheet] = useState('Solicitações');
  const [run, setRun] = useState<ProcurementSyncRun | null>(null);
  const [escrita, setEscrita] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setError('');
    loadProcurementSheet(sheet).then(data => { if (ativo) { setRows(data.rows); setRun(data.lastRun); setEscrita(data.escrita); } }).catch(e => { if (ativo) setError(e instanceof Error ? e.message : 'Falha ao carregar.'); }).finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [sheet]);
  const colunas = useMemo<readonly ColunaTabela<ProcurementSheetRow>[]>(() => [
    { chave: 'data', titulo: 'Data', render: row => date(row.request_date), valorOrdenacao: row => row.request_date },
    { chave: 'pedido', titulo: 'Pedido', render: row => row.source_request_number || '—', valorOrdenacao: row => row.source_request_number },
    { chave: 'solicitante', titulo: 'Solicitante', render: row => row.requester_name || '—', valorOrdenacao: row => row.requester_name },
    { chave: 'item', titulo: 'Item', render: row => row.item_description || '—', dica: row => row.item_description || undefined },
    { chave: 'unidade', titulo: 'Unidade', render: row => row.unit || '—' },
    { chave: 'quantidade', titulo: 'Quantidade', alinhamento: 'direita', render: row => row.quantity_requested ?? '—', valorOrdenacao: row => row.quantity_requested },
    { chave: 'sc', titulo: 'SC', render: row => row.source_purchase_order || '—', valorOrdenacao: row => row.source_purchase_order },
    { chave: 'entrega', titulo: 'Entrega', render: entrega, valorOrdenacao: row => row.delivery_deadline },
  ], []);
  return <section aria-label="Visualização da planilha de compras" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-200 px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 font-black text-slate-800"><FileSpreadsheet className="size-4 shrink-0 text-[#176b4d]" aria-hidden="true" /><h2>Planilha sincronizada</h2><span title={run?.error_message || undefined} className={`truncate text-xs font-bold ${run && run.status !== 'SUCESSO' ? 'text-rose-700' : 'text-slate-500'}`}>{leitura(run)}</span>{escrita !== null && <span className={`text-xs font-bold ${escrita ? 'text-[#176b4d]' : 'text-[#c2410c]'}`}>{escrita ? 'O site também grava nela' : 'O site ainda não grava nela'}</span>}</div>
      <Campo rotulo="Aba da planilha" para="planilha-aba" className="flex min-w-44 items-center gap-2 [&>label]:mb-0"><select id="planilha-aba" value={sheet} onChange={event => setSheet(event.target.value)} className={`${CAMPO} min-h-9 py-1`}><option value="Solicitações">Solicitações</option><option value="Prioridade">Prioridade</option><option value="Substituição">Substituição</option></select></Campo>
    </header>
    {error ? <p role="alert" className="p-4 text-sm font-bold text-rose-700">{error}</p> : <TabelaPadrao titulo="Linhas da planilha de compras" linhas={rows} colunas={colunas} idDaLinha={row => row.id} carregando={loading} vazio="Nenhuma linha sincronizada" nomeDoItem={{ um: 'linha', varios: 'linhas' }} densa exportar className="min-h-0 flex-1 rounded-none border-0" />}
  </section>;
}
