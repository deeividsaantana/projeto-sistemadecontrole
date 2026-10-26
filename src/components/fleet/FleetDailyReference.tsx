import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, FOCO } from '../cadastros/estilos';
import type { ControleEquipamentoDiario } from '../../types';
import {
  lerRelacaoEquipamentos,
  reconcileOperationalFleetDay,
  OPERATIONAL_FLEET_REFERENCE_STORAGE_KEY,
  type OperationalFleetReferenceGroup,
  type OperationalFleetReferenceItem,
  type OperationalFleetReferenceStatus,
} from '../../fleet/operationalFleetReference';
import { TabelaPadrao, type ColunaTabela } from '../../shared/ui/TabelaPadrao';
import { useEntradaDeLista } from '../../shared/hooks/useEntradaDeLista';
import { AvisoRecolhivel, ResumoConferencia, SituacaoConferencia, type FiltroConferencia } from './ConferenciaDoDia';

interface Props {
  records: ControleEquipamentoDiario[];
  date: string;
  /** Avisa a tela quando a relação muda, para o número na aba acompanhar. */
  onRelacaoChange?: () => void;
  /** Abre o lançamento novo já com o prefixo ou a matrícula de quem falta. */
  onLancar?: (preset: { prefixo?: string; codigoFuncionario?: string }) => void;
}

const GROUPS: readonly OperationalFleetReferenceGroup[] = ['Basculantes', 'Apoio'];

const tomDaSituacao = (item: OperationalFleetReferenceStatus): string => {
  if (!item.informed) return 'text-amber-700';
  if (item.operationalStatus === 'Em manutenção' || item.operationalStatus === 'Aguardando manutenção') return 'text-rose-700';
  return 'text-emerald-700';
};

const COLUNAS: readonly ColunaTabela<OperationalFleetReferenceStatus>[] = [
  { chave: 'prefix', titulo: 'Prefixo', valorOrdenacao: item => item.prefix, render: item => <span className="font-mono font-bold text-slate-950">{item.prefix}</span> },
  { chave: 'group', titulo: 'Grupo', valorOrdenacao: item => item.group, render: item => item.group },
  { chave: 'type', titulo: 'Tipo', valorOrdenacao: item => item.equipmentType, render: item => item.equipmentType },
  {
    chave: 'status',
    titulo: 'Situação',
    valorOrdenacao: item => (item.informed ? item.operationalStatus || 'Informado' : ''),
    dica: item => (item.informed ? item.operationalStatus || 'Informado' : 'A confirmar'),
    render: item => <SituacaoConferencia informado={item.informed} tom={tomDaSituacao(item)} texto={item.informed ? item.operationalStatus || 'Informado' : 'A confirmar'} />,
  },
  { chave: 'departure', titulo: 'Saída', valorOrdenacao: item => item.departureTime || '', render: item => <span className="font-mono">{item.departureTime || '—'}</span> },
];

const COLUNAS_EDITOR = (
  mudar: (indice: number, parcial: Partial<OperationalFleetReferenceItem>) => void,
): readonly ColunaTabela<OperationalFleetReferenceItem & { indice: number }>[] => [
  { chave: 'prefix', titulo: 'Prefixo', render: item => <input aria-label={`Prefixo ${item.indice + 1}`} value={item.prefix} onChange={event => mudar(item.indice, { prefix: event.target.value.toUpperCase() })} className={`${CAMPO} w-28 font-mono`} /> },
  {
    chave: 'group',
    titulo: 'Grupo',
    render: item => (
      <select aria-label={`Grupo ${item.indice + 1}`} value={item.group} onChange={event => mudar(item.indice, { group: event.target.value as OperationalFleetReferenceGroup })} className={`${CAMPO} w-auto`}>
        {GROUPS.map(grupo => <option key={grupo} value={grupo}>{grupo}</option>)}
      </select>
    ),
  },
  { chave: 'type', titulo: 'Tipo de equipamento', render: item => <input aria-label={`Tipo ${item.indice + 1}`} value={item.equipmentType} onChange={event => mudar(item.indice, { equipmentType: event.target.value })} className={CAMPO} /> },
];

/**
 * Aba Equipamentos do Controle de Frotas: a relação escolhida à mão (os
 * basculantes e o apoio) conferida contra os lançamentos do dia, na tabela
 * padrão. Quem falta tem o botão Lançar na própria linha.
 */
export default function FleetDailyReference({ records, date, onLancar, onRelacaoChange }: Props) {
  const [visibility, setVisibility] = useState<FiltroConferencia>('pending');
  const [editing, setEditing] = useState(false);
  const [reference, setReference] = useState(lerRelacaoEquipamentos);
  useEffect(() => {
    if (!editing) return;
    try {
      localStorage.setItem(OPERATIONAL_FLEET_REFERENCE_STORAGE_KEY, JSON.stringify(reference));
    } catch {
      // Sem memória do aparelho a relação vale só nesta visita.
    }
    onRelacaoChange?.();
  }, [editing, reference, onRelacaoChange]);
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
  const porGrupo = GROUPS.map(grupo => {
    const itens = reconciliation.items.filter(item => item.group === grupo);
    return `${grupo} ${itens.filter(item => item.informed).length}/${itens.length}`;
  }).join(' · ');
  const escopo = useEntradaDeLista<HTMLDivElement>([visibility, date]);
  const mudarItem = (indice: number, parcial: Partial<OperationalFleetReferenceItem>) =>
    setReference(itens => itens.map((atual, posicao) => (posicao === indice ? { ...atual, ...parcial } : atual)));
  const linhasEditor = reference.map((item, indice) => ({ ...item, indice }));

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3" aria-labelledby="fleet-reference-title">
      <ResumoConferencia
        id="fleet-reference-title"
        Icone={ClipboardCheck}
        data={date}
        titulo="Relação operacional do dia"
        descricao={<>{reference.length} equipamentos esperados ({porGrupo}). Quem não foi lançado aparece como “A confirmar”.</>}
        contadores={[
          { rotulo: 'Esperados', valor: reconciliation.total },
          { rotulo: 'Em operação', valor: reconciliation.operating, tom: 'text-emerald-700' },
          { rotulo: 'Manutenção', valor: reconciliation.maintenance, tom: 'text-rose-700' },
          { rotulo: 'A confirmar', valor: reconciliation.missing, tom: 'text-amber-700' },
        ]}
        rotuloProgresso="Preenchimento do dia"
        progresso={progress}
        filtro={visibility}
        onFiltro={setVisibility}
        rotuloFiltro="Filtrar relação operacional"
        opcoesFiltro={[
          ['pending', `A confirmar ${reconciliation.missing}`],
          ['all', `Todos ${reconciliation.total}`],
          ['informed', `Informados ${reconciliation.informed}`],
        ]}
        acao={<button type="button" onClick={() => setEditing(value => !value)} className={BOTAO_SECUNDARIO}>{editing ? <Save className="size-4" aria-hidden="true" /> : <Pencil className="size-4" aria-hidden="true" />} {editing ? 'Concluir edição' : 'Editar relação'}</button>}
      />

      {editing && (
        <section className="flex shrink-0 flex-col gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3 [--tabela-altura-max:18rem]" aria-label="Editor da relação operacional">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#176b4d]">Relação esperada</p>
              <p className="text-sm text-emerald-900">Altere, remova ou inclua equipamentos esperados no dia.</p>
            </div>
            <button type="button" onClick={() => setReference(items => [...items, { prefix: `NOVO-${items.length + 1}`, group: 'Basculantes', equipmentType: 'Caminhão Basculante' }])} className={BOTAO_PRIMARIO}><Plus className="size-4" aria-hidden="true" />Adicionar equipamento</button>
          </div>
          <TabelaPadrao
            titulo="Relação esperada de equipamentos"
            linhas={linhasEditor}
            colunas={COLUNAS_EDITOR(mudarItem)}
            idDaLinha={item => String(item.indice)}
            nomeDoItem={{ um: 'equipamento esperado', varios: 'equipamentos esperados' }}
            semPaginacao
            tituloAcoes="Tirar"
            acoes={item => (
              <button type="button" aria-label={`Excluir ${item.prefix}`} onClick={() => setReference(items => items.filter((_, posicao) => posicao !== item.indice))} className={`grid size-11 place-items-center rounded-lg text-rose-700 hover:bg-rose-50 md:size-9 ${FOCO}`}>
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            )}
          />
        </section>
      )}

      {onLancar && reconciliation.missing > 0 && visibility !== 'informed' && <p className="shrink-0 text-sm font-semibold text-[#5b6870]">Use “Lançar” na linha de quem está “A confirmar” para lançar direto.</p>}

      <div ref={escopo} className="flex min-h-[16rem] flex-1 flex-col">
        <TabelaPadrao
          titulo="Equipamentos esperados no dia"
          testId="frota-equipamentos-lista"
          linhas={visibleItems}
          colunas={COLUNAS}
          idDaLinha={item => `${item.group}-${item.prefix}`}
          nomeDoItem={{ um: 'equipamento', varios: 'equipamentos' }}
          acoes={onLancar ? item => (!item.informed
            ? <button type="button" onClick={() => onLancar({ prefixo: item.prefix })} aria-label={`Lançar ${item.prefix}`} className={`${BOTAO_PRIMARIO} min-h-11 px-3 md:min-h-8`}><Plus className="size-4" aria-hidden="true" />Lançar</button>
            : null) : undefined}
          tituloAcoes="Lançar"
          vazio={reconciliation.missing === 0 && visibility === 'pending' ? (
            <div className="m-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"><CheckCircle2 className="size-5" aria-hidden="true" /><div><strong className="block text-sm">Relação completa</strong><span className="text-sm">Os {reconciliation.total} equipamentos foram informados nesta data.</span></div></div>
          ) : 'Nenhum equipamento nesta lista.'}
        />
      </div>

      {(reconciliation.unexpectedPrefixes.length > 0 || reconciliation.duplicatePrefixes.length > 0) && (
        <div className="grid shrink-0 gap-2 sm:grid-cols-2">
          {reconciliation.unexpectedPrefixes.length > 0 && <AvisoRecolhivel tom="border-sky-200 bg-sky-50 text-sky-800" titulo={`${reconciliation.unexpectedPrefixes.length} lançado(s) fora da relação`}>{reconciliation.unexpectedPrefixes.join(', ')}</AvisoRecolhivel>}
          {reconciliation.duplicatePrefixes.length > 0 && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"><strong>Prefixos duplicados no dia:</strong> {reconciliation.duplicatePrefixes.join(', ')}</p>}
        </div>
      )}
    </section>
  );
}
