import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ClipboardPaste, Pencil, RotateCcw, Save, Trash2, UserRound, Users } from 'lucide-react';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO } from '../cadastros/estilos';
import type { ControleEquipamentoDiario, Funcionario } from '../../types';
import {
  lerRelacaoOperadoresGuardada,
  normalizeDriverCode,
  OPERATIONAL_DRIVER_REFERENCE,
  parseDriverList,
  reconcileOperationalDriversDay,
  OPERATIONAL_DRIVER_REFERENCE_STORAGE_KEY,
  type OperationalDriverReferenceItem,
  type OperationalDriverReferenceStatus,
} from '../../fleet/operationalDriverReference';

interface Props {
  records: ControleEquipamentoDiario[];
  date: string;
  drivers: Funcionario[];
  /** Grava em Motoristas quem veio na lista colada e ainda não estava lá. */
  onAddDrivers?: (drivers: Funcionario[]) => void;
  onLancar?: (preset: { codigoFuncionario?: string }) => void;
  /** Troca entre Equipamentos e Operadores, no cabeçalho do cartão. */
  alternador: ReactNode;
}

type VisibilityFilter = 'pending' | 'all' | 'informed';

const LIMITE = 12;

const formatDate = (date: string): string => /^\d{4}-\d{2}-\d{2}$/.test(date)
  ? new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR')
  : date;

/** "ADILSON PIRES DA CRUZ" vira "Adilson Cruz": cabe no cartão e ainda identifica. */
const nomeCurto = (nome: string): string => {
  const partes = nome.toLocaleLowerCase('pt-BR').split(' ').filter(parte => parte && !['da', 'de', 'do', 'das', 'dos', 'e'].includes(parte));
  const curto = partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1]}` : partes.join(' ');
  return curto.replace(/(^|\s)\S/g, letra => letra.toLocaleUpperCase('pt-BR'));
};

const guardarRelacao = (relacao: OperationalDriverReferenceItem[] | null) => {
  try {
    if (relacao) localStorage.setItem(OPERATIONAL_DRIVER_REFERENCE_STORAGE_KEY, JSON.stringify(relacao));
    else localStorage.removeItem(OPERATIONAL_DRIVER_REFERENCE_STORAGE_KEY);
  } catch {
    // Sem memória do aparelho a relação vale só nesta visita.
  }
};

const tom = (item: OperationalDriverReferenceStatus): { cartao: string; texto: string } => {
  if (!item.informed) return { cartao: 'border-amber-200 bg-amber-50', texto: 'text-amber-700' };
  if (item.prefixes.length > 1) return { cartao: 'border-rose-200 bg-rose-50', texto: 'text-rose-700' };
  if (item.operationalStatus === 'Em manutenção' || item.operationalStatus === 'Aguardando manutenção') return { cartao: 'border-rose-200 bg-rose-50', texto: 'text-rose-700' };
  return { cartao: 'border-emerald-200 bg-emerald-50/70', texto: 'text-emerald-700' };
};

const DriverChip = ({ item, onLancar }: { item: OperationalDriverReferenceStatus; onLancar?: Props['onLancar'] }) => {
  const { cartao, texto } = tom(item);
  const lancavel = !item.informed && Boolean(onLancar);
  const Raiz = lancavel ? 'button' : 'div';
  return (
    <li className="min-w-0" title={`${item.matricula} · ${item.nome}`}>
    <Raiz {...(lancavel ? { type: 'button' as const, onClick: () => onLancar?.({ codigoFuncionario: item.matricula }), 'aria-label': `Lançar ${item.nome}` } : {})} className={`flex min-h-14 w-full min-w-0 flex-col items-start justify-between gap-1 rounded-xl border px-3 py-2 text-left sm:flex-row sm:items-center sm:gap-3 ${cartao} ${lancavel ? `transition duration-200 hover:border-[#176b4d] hover:shadow-[0_6px_16px_-10px_rgba(15,40,31,0.45)] active:scale-[0.98] ${FOCO}` : ''}`}>
      <div className="w-full min-w-0 sm:w-auto">
        <strong className="block truncate text-sm font-bold text-slate-950">{nomeCurto(item.nome)}</strong>
        <span className="block font-mono text-[11px] font-semibold text-slate-500">{item.matricula}</span>
      </div>
      <span className={`inline-flex shrink-0 items-center gap-1 text-left text-[11px] font-bold uppercase sm:text-right ${texto}`}>
        {item.informed ? <CheckCircle2 size={15} aria-hidden="true"/> : <AlertTriangle size={15} aria-hidden="true"/>}
        <span>
          {item.informed ? <span className="font-mono">{item.prefixes.join(' + ')}</span> : 'A confirmar'}
          {item.informed && (item.prefixes.length > 1
            ? <small className="block text-[11px] font-semibold">Em {item.prefixes.length} caminhões</small>
            : item.departureTime ? <small className="block text-[11px] font-semibold">{item.departureTime}</small> : null)}
        </span>
      </span>
    </Raiz>
    </li>
  );
};

export default function FleetDriverReference({ records, date, drivers, onAddDrivers, onLancar, alternador }: Props) {
  const [visibility, setVisibility] = useState<VisibilityFilter>('pending');
  const [aberto, setAberto] = useState(false);
  const [editing, setEditing] = useState(false);
  const [colando, setColando] = useState(false);
  const [textoColado, setTextoColado] = useState('');
  const [escolhido, setEscolhido] = useState('');
  const [relacaoGuardada, setRelacaoGuardada] = useState(lerRelacaoOperadoresGuardada);
  const reference = relacaoGuardada || OPERATIONAL_DRIVER_REFERENCE;

  const trocarRelacao = (proxima: OperationalDriverReferenceItem[] | null) => {
    setRelacaoGuardada(proxima);
    guardarRelacao(proxima);
  };

  const reconciliation = useMemo(
    () => reconcileOperationalDriversDay(records, date, reference),
    [date, records, reference],
  );
  const progress = reconciliation.total ? Math.round((reconciliation.informed / reconciliation.total) * 100) : 0;
  const visibleItems = visibility === 'all'
    ? reconciliation.items
    : reconciliation.items.filter(item => visibility === 'informed' ? item.informed : !item.informed);
  const visiveis = aberto ? visibleItems : visibleItems.slice(0, LIMITE);
  const restantes = visibleItems.length - visiveis.length;

  const codigosNaRelacao = new Set(reference.map(item => normalizeDriverCode(item.matricula)));
  const foraDaRelacao = drivers.filter(driver =>
    driver.ativo !== false && !codigosNaRelacao.has(normalizeDriverCode(driver.matricula)));
  const codigosEmMotoristas = new Set(drivers.map(driver => normalizeDriverCode(driver.matricula)));
  const lista = useMemo(() => parseDriverList(textoColado), [textoColado]);
  const novosEmMotoristas = lista.itens.filter(item => !codigosEmMotoristas.has(normalizeDriverCode(item.matricula)));
  /** Da relação, quem ainda não pode ser escolhido no lançamento por faltar em Motoristas. */
  const faltamEmMotoristas = reference.filter(item => !codigosEmMotoristas.has(normalizeDriverCode(item.matricula)));

  const incluirEmMotoristas = (itens: readonly OperationalDriverReferenceItem[]) => {
    if (!itens.length || !onAddDrivers) return;
    const agora = Date.now();
    onAddDrivers(itens.map((item, index) => ({
      id: `motorista-operacional-${agora}-${index}`,
      matricula: item.matricula,
      nome: item.nome,
      cargo: 'OPERADOR DE CAMINHAO BASCULANTE',
      telefone: '',
      empresaId: drivers[0]?.empresaId || 'emp-1',
      ativo: true,
      status: 'ATIVO',
      area: 'FROTAS OPERACIONAIS',
      divisao: 'OPERAÇÃO',
    })));
  };

  const aplicarListaColada = () => {
    if (!lista.itens.length) return;
    incluirEmMotoristas(novosEmMotoristas);
    trocarRelacao(lista.itens);
    setTextoColado('');
    setColando(false);
  };

  return (
    <section className={`${CARTAO} overflow-hidden`} aria-labelledby="driver-reference-title">
      <header className="grid gap-4 border-b border-slate-100 p-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[#176b4d]"><Users className="size-5" aria-hidden="true"/></span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#176b4d]">Conferência do dia · {formatDate(date)}</p>
            <h2 id="driver-reference-title" className="mt-0.5 text-lg font-bold text-slate-950">Operadores do dia</h2>
            <p className="mt-0.5 text-sm text-slate-500">{reference.length} operadores esperados{relacaoGuardada ? ', relação escolhida à mão' : ', lista de operadores de basculante de 16/10/2026'}.</p>
            <div className="mt-2">{alternador}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-[#f7f8f6] text-center sm:grid-cols-4">
          <div className="px-4 py-2"><span className="block text-[11px] font-bold uppercase text-slate-500">Esperados</span><strong className="text-xl font-bold tabular-nums text-slate-950">{reconciliation.total}</strong></div>
          <div className="border-l border-slate-200 px-4 py-2"><span className="block text-[11px] font-bold uppercase text-emerald-700">Em operação</span><strong className="text-xl font-bold tabular-nums text-emerald-700">{reconciliation.operating}</strong></div>
          <div className="border-l border-t border-slate-200 px-4 py-2 sm:border-t-0"><span className="block text-[11px] font-bold uppercase text-slate-500">Lançados</span><strong className="text-xl font-bold tabular-nums text-slate-950">{reconciliation.informed}</strong></div>
          <div className="border-l border-t border-slate-200 px-4 py-2 sm:border-t-0"><span className="block text-[11px] font-bold uppercase text-amber-700">A confirmar</span><strong className="text-xl font-bold tabular-nums text-amber-700">{reconciliation.missing}</strong></div>
        </div>
      </header>

      <div className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-slate-500"><span>Operadores lançados</span><span>{progress}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#176b4d] transition-[width] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]" style={{ width: `${progress}%` }}/></div>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#f7f8f6] p-1 ring-1 ring-inset ring-slate-200" role="group" aria-label="Filtrar operadores">
            {([
              ['pending', `A confirmar ${reconciliation.missing}`],
              ['all', `Todos ${reconciliation.total}`],
              ['informed', `Lançados ${reconciliation.informed}`],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={visibility === id} onClick={() => setVisibility(id)} className={`min-h-10 rounded-xl px-3 text-xs font-bold transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${visibility === id ? 'bg-white text-[#176b4d] ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'} ${FOCO}`}>{label}</button>
            ))}
          </div>
          <button type="button" onClick={() => { setEditing(value => !value); setColando(false); }} className={BOTAO_SECUNDARIO} data-testid="frota-operadores-editar">
            {editing ? <Save className="size-4" aria-hidden="true"/> : <Pencil className="size-4" aria-hidden="true"/>}
            {editing ? 'Concluir edição' : 'Editar relação'}
          </button>
        </div>

        {faltamEmMotoristas.length > 0 && onAddDrivers && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="frota-operadores-faltam">
            <p><strong>{faltamEmMotoristas.length} operador(es) da relação não estão em Motoristas</strong> e por isso não aparecem no lançamento: {faltamEmMotoristas.map(item => nomeCurto(item.nome)).join(', ')}.</p>
            <button type="button" onClick={() => incluirEmMotoristas(faltamEmMotoristas)} className={BOTAO_PRIMARIO}>Incluir em Motoristas</button>
          </div>
        )}

        {editing && (
          <section className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3" aria-label="Editor da relação de operadores">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#176b4d]">Operadores esperados</p>
                <p className="text-xs text-emerald-900">Tire quem saiu, inclua quem entrou ou cole a lista inteira do Excel.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {relacaoGuardada && <button type="button" onClick={() => trocarRelacao(null)} className={BOTAO_SECUNDARIO}><RotateCcw className="size-4" aria-hidden="true"/>Voltar ao padrão</button>}
                <button type="button" onClick={() => setColando(value => !value)} className={BOTAO_PRIMARIO} data-testid="frota-operadores-colar"><ClipboardPaste className="size-4" aria-hidden="true"/>Colar lista</button>
              </div>
            </div>

            {colando && (
              <div className="mb-3 rounded-xl border border-emerald-100 bg-white p-3">
                <label className="text-sm font-semibold text-slate-700" htmlFor="frota-operadores-texto">Cole aqui as linhas da planilha (matrícula e nome)</label>
                <textarea id="frota-operadores-texto" value={textoColado} onChange={event => setTextoColado(event.target.value)} rows={6} placeholder={'103177\tADILSON PIRES DA CRUZ\n101671\tANDERSON PEIXOTO DA SILVA'} className={`${CAMPO} mt-1 py-2 font-mono`}/>
                {textoColado.trim() && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <p className="text-slate-700" role="status">
                      <strong>{lista.itens.length} operadores lidos.</strong>
                      {novosEmMotoristas.length > 0 && ` ${novosEmMotoristas.length} ainda não estão em Motoristas e entram lá também.`}
                      {lista.ignoradas.length > 0 && <span className="text-amber-700"> {lista.ignoradas.length} linha(s) sem matrícula ou nome ficaram de fora.</span>}
                    </p>
                    <button type="button" disabled={!lista.itens.length} onClick={aplicarListaColada} className={BOTAO_PRIMARIO}>Usar estes {lista.itens.length}</button>
                  </div>
                )}
              </div>
            )}

            <div className="mb-2 flex flex-col gap-2 sm:flex-row">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Incluir operador da lista de Motoristas</span>
                <select value={escolhido} onChange={event => setEscolhido(event.target.value)} className={CAMPO}>
                  <option value="">Incluir operador de Motoristas…</option>
                  {foraDaRelacao.map(driver => <option key={driver.id} value={driver.id}>{driver.matricula} · {driver.nome}</option>)}
                </select>
              </label>
              <button type="button" disabled={!escolhido} onClick={() => {
                const driver = drivers.find(item => item.id === escolhido);
                if (!driver) return;
                trocarRelacao([...reference, { matricula: String(driver.matricula || ''), nome: driver.nome }]);
                setEscolhido('');
              }} className={BOTAO_SECUNDARIO}>Incluir</button>
            </div>

            <ul className="max-h-72 divide-y divide-emerald-50 overflow-auto rounded-xl border border-emerald-100 bg-white">
              {reference.map(item => (
                <li key={item.matricula} className="flex items-center gap-3 px-3 py-1.5">
                  <span className="w-16 shrink-0 font-mono text-sm font-bold text-slate-700">{item.matricula}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{item.nome}</span>
                  <button type="button" aria-label={`Tirar ${item.nome} da relação`} onClick={() => trocarRelacao(reference.filter(atual => atual.matricula !== item.matricula))} className={`grid size-10 place-items-center rounded-lg text-rose-700 hover:bg-rose-50 ${FOCO}`}><Trash2 className="size-4" aria-hidden="true"/></button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {onLancar && reconciliation.missing > 0 && visibility !== 'informed' && <p className="mt-3 text-xs font-semibold text-slate-500">Toque em quem está “A confirmar” para lançar direto.</p>}

        {reconciliation.missing === 0 && visibility === 'pending' ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"><CheckCircle2 className="size-5" aria-hidden="true"/><div><strong className="block text-sm">Todos os operadores lançados</strong><span className="text-xs">Os {reconciliation.total} operadores esperados aparecem em algum lançamento nesta data.</span></div></div>
        ) : visibleItems.length ? (
          <article className="mt-4 rounded-[1.25rem] bg-[#f7f8f6] p-1.5 ring-1 ring-slate-200">
            <header className="mb-1.5 flex items-center justify-between gap-3 rounded-[0.9rem] bg-white px-3 py-2.5"><div className="flex items-center gap-2"><UserRound className="size-4 text-[#176b4d]" aria-hidden="true"/><h3 className="text-sm font-bold uppercase tracking-wide text-slate-950">Operadores de basculante</h3></div><span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">{reconciliation.informed}/{reconciliation.total}</span></header>
            <ul data-conferencia-lista className="grid grid-cols-2 gap-1.5 p-1 lg:grid-cols-3 2xl:grid-cols-4" data-testid="frota-operadores-lista">{visiveis.map(item => <DriverChip key={item.matricula} item={item} onLancar={onLancar}/>)}</ul>
            {(restantes > 0 || aberto) && (
              <button type="button" onClick={() => setAberto(value => !value)} aria-expanded={aberto} className={`mt-1 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold text-slate-700 ring-1 ring-slate-200 transition hover:text-[#176b4d] hover:ring-emerald-300 ${FOCO}`}>
                {aberto ? 'Mostrar menos' : `Ver os outros ${restantes} operadores`}
                <ChevronDown className={`size-4 transition duration-300 ${aberto ? 'rotate-180' : ''}`} aria-hidden="true"/>
              </button>
            )}
          </article>
        ) : (
          <p className="mt-4 rounded-2xl bg-[#f7f8f6] p-6 text-center text-sm text-slate-500">Nenhum operador nesta lista.</p>
        )}

        {(reconciliation.unexpectedDrivers.length > 0 || reconciliation.duplicateDrivers.length > 0) && (
          <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
            {reconciliation.unexpectedDrivers.length > 0 && <details className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sky-800"><summary className={`cursor-pointer font-bold ${FOCO}`}>{reconciliation.unexpectedDrivers.length} operador(es) de basculante fora da relação</summary><p className="mt-1">{reconciliation.unexpectedDrivers.join(', ')}</p></details>}
            {reconciliation.duplicateDrivers.length > 0 && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800"><strong>Operador em mais de um caminhão no dia:</strong> {reconciliation.duplicateDrivers.join(', ')}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
