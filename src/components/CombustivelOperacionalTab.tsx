import { useMemo, useState } from 'react';
import { ClipboardList, Droplets, FileSpreadsheet, Fuel, History, Plus, Search, Trash2 } from 'lucide-react';
import type { Abastecimento, Comboio, Empresa, Equipamento, TipoCombustivel } from '../types';

interface Props {
  empresas: Empresa[];
  equipamentos: Equipamento[];
  comboios: Comboio[];
  combustiveis: TipoCombustivel[];
  abastecimentos: Abastecimento[];
  onSaveAbastecimento: (item: Abastecimento, isNew: boolean) => void;
  onDeleteAbastecimento: (id: string) => void;
  onImportAbastecimentos?: (items: Abastecimento[], combustiveisImportados?: TipoCombustivel[]) => void;
  onOpenLubrificacao: () => void;
  onOpenCadastros?: () => void;
  onOpenSpreadsheetImport: () => void;
  isParsingSpreadsheet: boolean;
}

type View = 'resumo' | 'novo' | 'historico';

const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toTimeString().slice(0, 5);
const formatDate = (date: string) => date ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${date}T12:00:00`)) : 'Sem data';
const formatNumber = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export default function CombustivelOperacionalTab({
  equipamentos, comboios, combustiveis, abastecimentos, onSaveAbastecimento,
  onDeleteAbastecimento, onOpenLubrificacao, onOpenCadastros, onOpenSpreadsheetImport, isParsingSpreadsheet,
}: Props) {
  const [view, setView] = useState<View>('resumo');
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ data: today(), hora: now(), equipamentoId: '', tipoCombustivelId: '', comboioId: '', quantidadeLitros: '', leitura: '', responsavel: '', local: '', observacao: '' });
  const activeRecords = useMemo(() => abastecimentos.filter(item => !item.inativoEm && item.status !== 'Cancelado').sort((a, b) => `${b.data}${b.hora}`.localeCompare(`${a.data}${a.hora}`)), [abastecimentos]);
  const matched = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return activeRecords;
    return activeRecords.filter(item => [
      equipamentos.find(e => e.id === item.equipamentoId)?.prefixo,
      equipamentos.find(e => e.id === item.equipamentoId)?.nome,
      combustiveis.find(f => f.id === item.tipoCombustivelId)?.nome,
      item.responsavel, item.localAbastecimento, item.data,
    ].filter(Boolean).join(' ').toLowerCase().includes(term));
  }, [activeRecords, combustiveis, equipamentos, search]);
  const litersToday = activeRecords.filter(item => item.data === today()).reduce((sum, item) => sum + Number(item.quantidadeLitros || 0), 0);
  const pending = activeRecords.filter(item => item.revisaoStatus === 'Pendente' || item.status === 'Pendente' || item.alertas?.some(alert => alert.severidade !== 'info')).length;
  const uniqueFleet = new Set(activeRecords.filter(item => item.data === today()).map(item => item.equipamentoId)).size;
  const setField = (field: keyof typeof form, value: string) => setForm(current => ({ ...current, [field]: value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const quantity = Number(form.quantidadeLitros.replace(',', '.'));
    if (!form.equipamentoId || !form.tipoCombustivelId || !Number.isFinite(quantity) || quantity <= 0) {
      setError('Informe frota, combustível e uma quantidade válida.');
      return;
    }
    const reading = Number(form.leitura.replace(',', '.')) || 0;
    const selectedEquipment = equipamentos.find(item => item.id === form.equipamentoId);
    onSaveAbastecimento({
      id: crypto.randomUUID(), data: form.data, hora: form.hora, equipamentoId: form.equipamentoId,
      horimetroInicial: reading, kmInicial: reading, bombaInicial: 0, bombaFinal: quantity,
      quantidadeLitros: quantity, tipoCombustivelId: form.tipoCombustivelId, comboioId: form.comboioId,
      responsavel: form.responsavel.trim() || 'Não informado', operadorNome: selectedEquipment?.operadorResponsavelNome,
      localAbastecimento: form.local.trim(), observacao: form.observacao.trim(), status: 'OK', origem: 'Manual',
      competencia: form.data.slice(0, 7), criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString(),
    }, true);
    setForm({ data: today(), hora: now(), equipamentoId: '', tipoCombustivelId: '', comboioId: '', quantidadeLitros: '', leitura: '', responsavel: '', local: '', observacao: '' });
    setError('');
    setView('historico');
  };

  return (
    <section className="fuel-operations erp-module erp-module--lancamentos" aria-label="Central de combustível">
      <header className="fuel-operations__header">
        <div>
          <p>Operação de campo</p>
          <h1>Combustível</h1>
          <span>Abastecimentos rastreáveis por frota, comboio e responsável.</span>
        </div>
        <div className="fuel-operations__actions">
          <button type="button" className="fuel-action-muted" onClick={onOpenLubrificacao}><Droplets className="size-4" />Lubrificação</button>
          <button type="button" className="fuel-action-muted" onClick={onOpenSpreadsheetImport} disabled={isParsingSpreadsheet}><FileSpreadsheet className="size-4" />{isParsingSpreadsheet ? 'Lendo arquivo' : 'Importar'}</button>
          <button type="button" className="fuel-action-primary" onClick={() => setView('novo')}><Plus className="size-4" />Novo abastecimento</button>
        </div>
      </header>

      <nav className="fuel-operations__nav" aria-label="Área de combustível">
        {([['resumo', 'Resumo', Fuel], ['novo', 'Lançar', Plus], ['historico', 'Histórico', History]] as const).map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setView(key)} className={view === key ? 'is-active' : ''}><Icon className="size-4" />{label}</button>)}
      </nav>

      {view === 'resumo' && <>
        <div className="fuel-operations__metrics">
          <article><span>Abastecido hoje</span><strong>{formatNumber(litersToday)} L</strong><small>{activeRecords.filter(item => item.data === today()).length} lançamento(s) no dia</small></article>
          <article><span>Frota atendida</span><strong>{uniqueFleet}</strong><small>equipamento(s) abastecido(s)</small></article>
          <article className={pending ? 'is-warning' : ''}><span>Conferência</span><strong>{pending}</strong><small>{pending ? 'lançamento(s) requerem atenção' : 'nenhuma pendência na fila'}</small></article>
          <article><span>Base ativa</span><strong>{activeRecords.length}</strong><small>registros operacionais</small></article>
        </div>
        <div className="fuel-operations__empty-or-list">
          <div><p>Fluxo operacional</p><h2>Registre no campo, confira no escritório.</h2><span>O abastecimento alimenta a frota e mantém a rastreabilidade por equipamento.</span><button type="button" onClick={() => setView('novo')}><Plus className="size-4" />Lançar abastecimento</button></div>
          <aside><strong>Próximas ações</strong><button type="button" onClick={() => setView('historico')}><ClipboardList className="size-4" />Conferir lançamentos</button><button type="button" onClick={onOpenCadastros}><Fuel className="size-4" />Cadastrar combustível</button></aside>
        </div>
      </>}

      {view === 'novo' && <form className="fuel-entry-form" onSubmit={submit}>
        <div className="fuel-entry-form__title"><div><p>Novo lançamento</p><h2>Abastecimento de frota</h2></div><span>Campos com * são obrigatórios</span></div>
        {error && <p className="fuel-entry-form__error">{error}</p>}
        <div className="fuel-entry-form__grid">
          <label>Data<input type="date" value={form.data} onChange={e => setField('data', e.target.value)} required /></label>
          <label>Hora<input type="time" value={form.hora} onChange={e => setField('hora', e.target.value)} required /></label>
          <label className="span-2">Frota *<select value={form.equipamentoId} onChange={e => setField('equipamentoId', e.target.value)} required><option value="">Selecione o equipamento</option>{equipamentos.filter(item => item.status !== 'Desmobilizado').map(item => <option key={item.id} value={item.id}>{item.prefixo} · {item.nome}</option>)}</select></label>
          <label>Combustível *<select value={form.tipoCombustivelId} onChange={e => setField('tipoCombustivelId', e.target.value)} required><option value="">Selecionar</option>{combustiveis.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
          <label>Comboio<select value={form.comboioId} onChange={e => setField('comboioId', e.target.value)}><option value="">Não informado</option>{comboios.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
          <label>Quantidade (L) *<input inputMode="decimal" value={form.quantidadeLitros} onChange={e => setField('quantidadeLitros', e.target.value)} placeholder="0,0" required /></label>
          <label>Horímetro / KM<input inputMode="decimal" value={form.leitura} onChange={e => setField('leitura', e.target.value)} placeholder="Opcional" /></label>
          <label>Responsável<input value={form.responsavel} onChange={e => setField('responsavel', e.target.value)} placeholder="Nome de quem lançou" /></label>
          <label>Local<input value={form.local} onChange={e => setField('local', e.target.value)} placeholder="Frente, pátio ou apoio" /></label>
          <label className="span-2">Observação<textarea rows={3} value={form.observacao} onChange={e => setField('observacao', e.target.value)} placeholder="Informação relevante para conferência" /></label>
        </div>
        <footer><button type="button" onClick={() => setView('resumo')}>Cancelar</button><button type="submit"><Plus className="size-4" />Salvar abastecimento</button></footer>
      </form>}

      {view === 'historico' && <section className="fuel-history"><header><div><p>Conferência</p><h2>Histórico de abastecimentos</h2></div><label><Search className="size-4" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar frota, combustível ou responsável" /></label></header><div className="fuel-history__table"><table><thead><tr><th>Data</th><th>Frota</th><th>Combustível</th><th>Litros</th><th>Responsável</th><th></th></tr></thead><tbody>{matched.map(item => { const equipment = equipamentos.find(e => e.id === item.equipamentoId); const fuel = combustiveis.find(f => f.id === item.tipoCombustivelId); return <tr key={item.id}><td>{formatDate(item.data)}<small>{item.hora}</small></td><td><strong>{equipment?.prefixo || 'Não informado'}</strong><small>{equipment?.nome || 'Frota sem cadastro'}</small></td><td>{fuel?.nome || 'Não informado'}</td><td className="is-number">{formatNumber(Number(item.quantidadeLitros || 0))} L</td><td>{item.responsavel}</td><td><button type="button" onClick={() => setDeletingId(item.id)} aria-label="Excluir lançamento"><Trash2 className="size-4" /></button></td></tr>; })}{!matched.length && <tr><td colSpan={6} className="fuel-history__empty">Nenhum abastecimento encontrado.</td></tr>}</tbody></table></div></section>}
      {deletingId && <div className="fuel-delete-confirm" role="dialog" aria-modal="true"><div><p>Excluir lançamento?</p><span>O registro ficará inativo e deixará de compor os indicadores.</span><footer><button type="button" onClick={() => setDeletingId(null)}>Cancelar</button><button type="button" onClick={() => { onDeleteAbastecimento(deletingId); setDeletingId(null); }}>Excluir</button></footer></div></div>}
    </section>
  );
}
