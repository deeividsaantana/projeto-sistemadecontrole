import { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardPaste, Pencil, Plus, RotateCcw, Save, Trash2, Users } from 'lucide-react';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, FOCO } from '../cadastros/estilos';
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
import { TabelaPadrao, type ColunaTabela } from '../../shared/ui/TabelaPadrao';
import { useEntradaDeLista } from '../../shared/hooks/useEntradaDeLista';
import { AvisoRecolhivel, GradeConferencia, ResumoConferencia, type CartaoConferencia, type FiltroConferencia } from './ConferenciaDoDia';

interface Props {
  records: ControleEquipamentoDiario[];
  date: string;
  drivers: Funcionario[];
  /** Grava em Motoristas quem veio na lista colada e ainda não estava lá. */
  onAddDrivers?: (drivers: Funcionario[]) => void;
  onLancar?: (preset: { codigoFuncionario?: string }) => void;
  /** Avisa a tela quando a relação muda, para o número na aba acompanhar. */
  onRelacaoChange?: () => void;
}

/** "ADILSON PIRES DA CRUZ" vira "Adilson Cruz": cabe no aviso e ainda identifica. */
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

const COLUNAS_EDITOR: readonly ColunaTabela<OperationalDriverReferenceItem>[] = [
  { chave: 'matricula', titulo: 'Matrícula', render: item => <span className="font-mono font-bold">{item.matricula}</span> },
  { chave: 'nome', titulo: 'Nome', render: item => item.nome },
];

/** Aba Operadores do Controle de Frotas, com a mesma conferência dos equipamentos, na tabela padrão. */
export default function FleetDriverReference({ records, date, drivers, onAddDrivers, onLancar, onRelacaoChange }: Props) {
  const [visibility, setVisibility] = useState<FiltroConferencia>('pending');
  const [editing, setEditing] = useState(false);
  const [colando, setColando] = useState(false);
  const [textoColado, setTextoColado] = useState('');
  const [escolhido, setEscolhido] = useState('');
  const [relacaoGuardada, setRelacaoGuardada] = useState(lerRelacaoOperadoresGuardada);
  const reference = relacaoGuardada || OPERATIONAL_DRIVER_REFERENCE;

  const trocarRelacao = (proxima: OperationalDriverReferenceItem[] | null) => {
    setRelacaoGuardada(proxima);
    guardarRelacao(proxima);
    onRelacaoChange?.();
  };

  const reconciliation = useMemo(
    () => reconcileOperationalDriversDay(records, date, reference),
    [date, records, reference],
  );
  const progress = reconciliation.total ? Math.round((reconciliation.informed / reconciliation.total) * 100) : 0;
  const visibleItems = visibility === 'all'
    ? reconciliation.items
    : reconciliation.items.filter(item => visibility === 'informed' ? item.informed : !item.informed);
  const cartoes: CartaoConferencia[] = visibleItems.map(item => ({
    id: item.matricula,
    titulo: item.nome,
    detalhe: item.matricula,
    informado: item.informed,
    situacao: item.operationalStatus,
    saida: item.departureTime,
    onde: item.prefixes.join(' + ') || undefined,
    rotuloLancar: `Lançar ${item.nome}`,
    onLancar: onLancar ? () => onLancar({ codigoFuncionario: item.matricula }) : undefined,
  }));
  const escopo = useEntradaDeLista<HTMLDivElement>([visibility, date]);

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
    <section className="flex min-h-0 flex-1 flex-col gap-3" aria-labelledby="driver-reference-title">
      <ResumoConferencia
        id="driver-reference-title"
        Icone={Users}
        data={date}
        titulo="Operadores do dia"
        descricao={<>{reference.length} operadores esperados{relacaoGuardada ? ', relação escolhida à mão' : ', lista de operadores de basculante de 16/10/2026'}.</>}
        contadores={[
          { rotulo: 'Esperados', valor: reconciliation.total },
          { rotulo: 'Em operação', valor: reconciliation.operating, tom: 'text-emerald-700' },
          { rotulo: 'Lançados', valor: reconciliation.informed },
          { rotulo: 'Faltantes', valor: reconciliation.missing, tom: 'text-amber-700' },
        ]}
        rotuloProgresso="Operadores lançados"
        progresso={progress}
        filtro={visibility}
        onFiltro={setVisibility}
        rotuloFiltro="Filtrar operadores"
        opcoesFiltro={[
          ['pending', `Faltantes ${reconciliation.missing}`],
          ['all', `Todos ${reconciliation.total}`],
          ['informed', `Lançados ${reconciliation.informed}`],
        ]}
        acao={(
          <button type="button" onClick={() => { setEditing(value => !value); setColando(false); }} className={BOTAO_SECUNDARIO} data-testid="frota-operadores-editar">
            {editing ? <Save className="size-4" aria-hidden="true" /> : <Pencil className="size-4" aria-hidden="true" />}
            {editing ? 'Concluir edição' : 'Editar relação'}
          </button>
        )}
      />

      {faltamEmMotoristas.length > 0 && onAddDrivers && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="frota-operadores-faltam">
          <p className="min-w-0 flex-1 lg:truncate" title={faltamEmMotoristas.map(item => item.nome).join(', ')}><strong>{faltamEmMotoristas.length} operador(es) da relação não estão em Motoristas</strong> e por isso não aparecem no lançamento: {faltamEmMotoristas.map(item => nomeCurto(item.nome)).join(', ')}.</p>
          <button type="button" onClick={() => incluirEmMotoristas(faltamEmMotoristas)} className={`${BOTAO_PRIMARIO} shrink-0 lg:min-h-9`}>Incluir em Motoristas</button>
        </div>
      )}

      {editing && (
        <section className="flex shrink-0 flex-col gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3 [--tabela-altura-max:18rem]" aria-label="Editor da relação de operadores">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#176b4d]">Operadores esperados</p>
              <p className="text-sm text-emerald-900">Tire quem saiu, inclua quem entrou ou cole a lista inteira do Excel.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {relacaoGuardada && <button type="button" onClick={() => trocarRelacao(null)} className={BOTAO_SECUNDARIO}><RotateCcw className="size-4" aria-hidden="true" />Voltar ao padrão</button>}
              <button type="button" onClick={() => setColando(value => !value)} aria-expanded={colando} className={BOTAO_PRIMARIO} data-testid="frota-operadores-colar"><ClipboardPaste className="size-4" aria-hidden="true" />Colar lista</button>
            </div>
          </div>

          {colando && (
            <div className="rounded-xl border border-emerald-100 bg-white p-3">
              <label className="text-sm font-semibold text-slate-700" htmlFor="frota-operadores-texto">Cole aqui as linhas da planilha (matrícula e nome)</label>
              <textarea id="frota-operadores-texto" value={textoColado} onChange={event => setTextoColado(event.target.value)} rows={6} placeholder={'103177\tADILSON PIRES DA CRUZ\n101671\tANDERSON PEIXOTO DA SILVA'} className={`${CAMPO} mt-1 py-2 font-mono`} />
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

          <div className="flex flex-col gap-2 sm:flex-row">
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

          <TabelaPadrao
            titulo="Operadores esperados"
            linhas={reference}
            colunas={COLUNAS_EDITOR}
            idDaLinha={item => item.matricula}
            nomeDoItem={{ um: 'operador esperado', varios: 'operadores esperados' }}
            semPaginacao
            tituloAcoes="Tirar"
            acoes={item => (
              <button type="button" aria-label={`Tirar ${item.nome} da relação`} onClick={() => trocarRelacao(reference.filter(atual => atual.matricula !== item.matricula))} className={`grid size-11 place-items-center rounded-lg text-rose-700 hover:bg-rose-50 md:size-9 ${FOCO}`}>
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            )}
          />
        </section>
      )}


      <div ref={escopo} className="flex min-h-[16rem] flex-1 flex-col">
        <GradeConferencia
          testId="frota-operadores-lista"
          itens={cartoes}
          nomeFaltantes="Operadores faltantes"
          nomeLancados="Operadores lançados"
          colunas="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          vazio={reconciliation.missing === 0 && visibility === 'pending' ? (
            <div className="m-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"><CheckCircle2 className="size-5" aria-hidden="true" /><div><strong className="block text-sm">Todos os operadores lançados</strong><span className="text-sm">Os {reconciliation.total} operadores esperados aparecem em algum lançamento nesta data.</span></div></div>
          ) : 'Nenhum operador nesta lista.'}
        />
      </div>

      {(reconciliation.unexpectedDrivers.length > 0 || reconciliation.duplicateDrivers.length > 0) && (
        <div className="grid shrink-0 gap-2 sm:grid-cols-2">
          {reconciliation.unexpectedDrivers.length > 0 && <AvisoRecolhivel tom="border-sky-200 bg-sky-50 text-sky-800" titulo={`${reconciliation.unexpectedDrivers.length} operador(es) de basculante fora da relação`}>{reconciliation.unexpectedDrivers.join(', ')}</AvisoRecolhivel>}
          {reconciliation.duplicateDrivers.length > 0 && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"><strong>Operador em mais de um caminhão no dia:</strong> {reconciliation.duplicateDrivers.join(', ')}</p>}
        </div>
      )}
    </section>
  );
}
