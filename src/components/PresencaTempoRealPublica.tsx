import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  History,
  RefreshCw,
  Save,
  Search,
  Send,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import type {
  Empresa,
  Funcionario,
  FuncionarioDisponivel,
  GrupoEquipe,
  ObraLocal,
  PresencaApontamento,
  PresencaStatus,
} from '../types';
import reneaLogo from '../assets/images/logo-renea-branco.png';
import './presencaTempoRealPublica.css';

const PRIMARY_STATUSES: PresencaStatus[] = ['Presente', 'Ausente', 'Falta justificada', 'Atestado'];
const SECONDARY_STATUSES: PresencaStatus[] = ['Férias', 'Afastado', 'Outro'];

interface SubmissionResult {
  success: boolean;
  message: string;
  submissionId?: string;
  createdAtIso?: string;
}

interface RecordUpdateResult {
  success: boolean;
  message: string;
  record?: PresencaApontamento;
}

interface MemberAddResult {
  success: boolean;
  message: string;
  funcionario?: Funcionario;
}

interface MemberRemoveResult {
  success: boolean;
  message: string;
  funcionarioId?: string;
}

interface Props {
  token: string;
  gruposEquipe: GrupoEquipe[];
  funcionarios: Funcionario[];
  funcionariosDisponiveis?: FuncionarioDisponivel[];
  empresas: Empresa[];
  obras: ObraLocal[];
  meuGrupo?: GrupoEquipe | null;
  meusRegistros?: PresencaApontamento[];
  datasDisponiveis?: string[];
  dataSelecionada?: string;
  dataAtual?: string;
  onSelectDate?: (data: string) => void;
  isLoadingCloud: boolean;
  loadError: string;
  onRetry: () => void;
  onSubmitPresenca: (
    grupo: GrupoEquipe,
    data: string,
    items: Array<{ funcionarioId: string; status: PresencaStatus; observacao: string }>,
    observacaoDia: string,
  ) => Promise<SubmissionResult>;
  onUpdateRecord: (
    grupoId: string,
    funcionarioId: string,
    status: PresencaStatus,
    observacao: string,
  ) => Promise<RecordUpdateResult>;
  onAddMember?: (grupoId: string, funcionarioId: string) => Promise<MemberAddResult>;
  onRemoveMember?: (grupoId: string, funcionarioId: string) => Promise<MemberRemoveResult>;
  observacaoDia?: string;
  onSaveDayNote?: (grupoId: string, observacaoDia: string) => Promise<{ success: boolean; message: string }>;
}

type ItemState = { status?: PresencaStatus; observacao: string };

const todayInput = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

// Rótulo curto para a régua de dias: "Hoje" para a data corrente e
// "seg 01/09" para os dias anteriores já enviados pela equipe.
const formatDayLabel = (iso: string, today: string) => {
  if (!iso) return '';
  if (iso === today) return 'Hoje';
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  const weekday = new Date(Date.UTC(year, month - 1, day))
    .toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' })
    .replace('.', '');
  return `${weekday} ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
};

const safeText = (value: unknown) => typeof value === 'string' ? value : '';
const isGeneralToken = (token: string) => token.startsWith('geral-');
const draftStorageKey = (token: string) => `renea_public_presence_${token}`;

type PresenceDraft = {
  date: string;
  selectedGroupId: string;
  items: Record<string, ItemState>;
  result: SubmissionResult | null;
};

const readDraft = (token: string): PresenceDraft | null => {
  try {
    const raw = sessionStorage.getItem(draftStorageKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PresenceDraft>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      date: typeof parsed.date === 'string' ? parsed.date : todayInput(),
      selectedGroupId: typeof parsed.selectedGroupId === 'string' ? parsed.selectedGroupId : '',
      items: parsed.items && typeof parsed.items === 'object' ? parsed.items as Record<string, ItemState> : {},
      result: parsed.result && typeof parsed.result === 'object' ? parsed.result as SubmissionResult : null,
    };
  } catch {
    return null;
  }
};

const writeDraft = (token: string, draft: PresenceDraft) => {
  try {
    sessionStorage.setItem(draftStorageKey(token), JSON.stringify(draft));
  } catch {
    // A storage failure must never interrupt field registration.
  }
};

// Um cartão por colaborador, isolado do resto da tela. Sem esta fronteira, um
// toque em "Presente" reconstruía a lista inteira — em uma equipe de quarenta
// pessoas são centenas de botões redesenhados a cada toque, e o aparelho do
// encarregado engasga justamente no momento em que ele está apontando rápido.
interface EmployeeCardProps {
  employee: Funcionario;
  empresaNome: string;
  status?: PresencaStatus;
  observacao: string;
  erro: string;
  onStatus: (funcionarioId: string, status: PresencaStatus) => void;
  onObservacao: (funcionarioId: string, observacao: string) => void;
  podeRemover: boolean;
  confirmandoRemocao: boolean;
  removendo: boolean;
  removocaoEmCurso: boolean;
  onPedirRemocao: (funcionarioId: string) => void;
  onCancelarRemocao: () => void;
  onConfirmarRemocao: (employee: Funcionario) => void;
}

const EmployeeCard = memo(function EmployeeCard({
  employee,
  empresaNome,
  status,
  observacao,
  erro,
  onStatus,
  onObservacao,
  podeRemover,
  confirmandoRemocao,
  removendo,
  removocaoEmCurso,
  onPedirRemocao,
  onCancelarRemocao,
  onConfirmarRemocao,
}: EmployeeCardProps) {
  const iniciais = safeText(employee.nome).split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  return (
    <article className="presence-public__employee-card">
      <div className="presence-public__employee-heading">
        <span className="presence-public__avatar">{iniciais}</span>
        <div><h2>{employee.nome}</h2><p>{employee.cargo} · {empresaNome}</p></div>
        {status && <Check className="h-5 w-5 text-emerald-700" />}
      </div>
      <div className="presence-public__status-grid">
        {PRIMARY_STATUSES.map(option => (
          <button key={option} type="button" onClick={() => onStatus(employee.id, option)} data-selected={status === option}>
            {status === option && <Check className="h-4 w-4" />}{option}
          </button>
        ))}
      </div>
      <select
        value={SECONDARY_STATUSES.includes(status as PresencaStatus) ? status : ''}
        onChange={event => event.target.value && onStatus(employee.id, event.target.value as PresencaStatus)}
      >
        <option value="">Outras situações</option>
        {SECONDARY_STATUSES.map(option => <option key={option}>{option}</option>)}
      </select>
      <textarea
        value={observacao}
        onChange={event => onObservacao(employee.id, event.target.value)}
        rows={2}
        placeholder="Observação opcional"
      />
      {erro && <div role="alert" className="presence-public__card-error">{erro}</div>}
      {podeRemover && (
        <div className="presence-public__remove-member">
          {confirmandoRemocao ? (
            <div className="presence-public__remove-confirm" role="group" aria-label={`Confirmar remoção de ${employee.nome}`}>
              <span>Remover este colaborador da equipe?</span>
              <button type="button" onClick={onCancelarRemocao} disabled={removendo}>Cancelar</button>
              <button type="button" data-danger onClick={() => onConfirmarRemocao(employee)} disabled={removendo}>
                {removendo ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {removendo ? 'Removendo' : 'Sim, remover'}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => onPedirRemocao(employee.id)} disabled={removocaoEmCurso}>
              <Trash2 className="h-4 w-4" /> Remover da equipe
            </button>
          )}
        </div>
      )}
    </article>
  );
});

// Cartao da tela "ja enviado" (edicao pontual, em tempo real). Mesma razao
// do EmployeeCard acima: sem memo, cada toque em uma situacao redesenhava a
// equipe inteira -- e essa e a tela que o encarregado usa o turno todo pra
// corrigir situacao a situacao.
interface SubmittedEmployeeCardProps {
  employee: Funcionario;
  empresaNome: string;
  currentStatus?: PresencaStatus;
  draftObservacao: string;
  observacaoDirty: boolean;
  isSaving: boolean;
  cardError: string;
  feedback: string;
  onUpdateStatus: (employeeId: string, status: PresencaStatus, observacaoOverride?: string) => void;
  onObservacaoChange: (employeeId: string, value: string) => void;
  podeRemover: boolean;
  confirmandoRemocao: boolean;
  removendo: boolean;
  removocaoEmCurso: boolean;
  onPedirRemocao: (funcionarioId: string) => void;
  onCancelarRemocao: () => void;
  onConfirmarRemocao: (employee: Funcionario) => void;
}

const SubmittedEmployeeCard = memo(function SubmittedEmployeeCard({
  employee,
  empresaNome,
  currentStatus,
  draftObservacao,
  observacaoDirty,
  isSaving,
  cardError,
  feedback,
  onUpdateStatus,
  onObservacaoChange,
  podeRemover,
  confirmandoRemocao,
  removendo,
  removocaoEmCurso,
  onPedirRemocao,
  onCancelarRemocao,
  onConfirmarRemocao,
}: SubmittedEmployeeCardProps) {
  return (
    <article className="presence-public__employee-card">
      <div className="presence-public__employee-heading">
        <span className="presence-public__avatar">{safeText(employee.nome).split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()}</span>
        <div><h2>{employee.nome}</h2><p>{employee.cargo} · {empresaNome}{employee.matricula ? ` · Mat. ${employee.matricula}` : ''}</p></div>
        {currentStatus && <span className="presence-public__status-pill">{currentStatus}</span>}
      </div>
      <div className="presence-public__status-grid">
        {PRIMARY_STATUSES.map(status => (
          <button key={status} type="button" disabled={isSaving} onClick={() => onUpdateStatus(employee.id, status)} data-selected={currentStatus === status}>
            {currentStatus === status && <Check className="h-4 w-4" />}{status}
          </button>
        ))}
      </div>
      <select
        value={SECONDARY_STATUSES.includes(currentStatus as PresencaStatus) ? currentStatus : ''}
        disabled={isSaving}
        onChange={event => event.target.value && onUpdateStatus(employee.id, event.target.value as PresencaStatus)}
      >
        <option value="">Outras situações</option>
        {SECONDARY_STATUSES.map(status => <option key={status}>{status}</option>)}
      </select>
      <textarea
        value={draftObservacao}
        disabled={isSaving}
        onChange={event => onObservacaoChange(employee.id, event.target.value)}
        rows={2}
        placeholder="Observação opcional"
      />
      {observacaoDirty && (
        <button
          type="button"
          className="presence-public__save-note"
          disabled={isSaving || !currentStatus}
          onClick={() => onUpdateStatus(employee.id, currentStatus as PresencaStatus, draftObservacao)}
        >
          {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar observação
        </button>
      )}
      {cardError && <div role="alert" className="presence-public__card-error">{cardError}</div>}
      {!cardError && feedback && <div role="status" className="presence-public__card-feedback">{feedback}</div>}
      {podeRemover && (
        <div className="presence-public__remove-member">
          {confirmandoRemocao ? (
            <div className="presence-public__remove-confirm" role="group" aria-label={`Confirmar remoção de ${employee.nome}`}>
              <span>Remover este colaborador da equipe?</span>
              <button type="button" onClick={onCancelarRemocao} disabled={removendo}>Cancelar</button>
              <button type="button" data-danger onClick={() => onConfirmarRemocao(employee)} disabled={removendo}>
                {removendo ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {removendo ? 'Removendo' : 'Sim, remover'}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => onPedirRemocao(employee.id)} disabled={removocaoEmCurso}>
              <Trash2 className="h-4 w-4" /> Remover da equipe
            </button>
          )}
        </div>
      )}
    </article>
  );
});

export default function PresencaTempoRealPublica({
  token,
  gruposEquipe = [],
  funcionarios = [],
  funcionariosDisponiveis = [],
  empresas = [],
  obras = [],
  meuGrupo = null,
  meusRegistros = [],
  datasDisponiveis = [],
  dataSelecionada = '',
  dataAtual = '',
  onSelectDate,
  isLoadingCloud,
  loadError,
  onRetry,
  onSubmitPresenca,
  onUpdateRecord,
  onAddMember,
  onRemoveMember,
  observacaoDia = '',
  onSaveDayNote,
}: Props) {
  const generalLink = isGeneralToken(token);
  const [date, setDate] = useState(todayInput());
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const deferredGroupSearch = useDeferredValue(groupSearch);
  const deferredEmployeeSearch = useDeferredValue(employeeSearch);
  const [items, setItems] = useState<Record<string, ItemState>>({});
  const currentDayDraftRef = useRef<Record<string, ItemState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [showDraftSuccessScreen, setShowDraftSuccessScreen] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<SubmissionResult | null>(null);
  // Comprovante animado do envio. Aparece logo apos enviar e volta a aparecer
  // sempre que o link e reaberto num dia ja enviado, para que o apontador veja
  // quantos estao e em que situacao antes de decidir ajustar alguma coisa.
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const receiptShownForRef = useRef('');
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [draftFeedback, setDraftFeedback] = useState('');
  const [savingEmployeeId, setSavingEmployeeId] = useState('');
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [savedFeedback, setSavedFeedback] = useState<Record<string, string>>({});
  const [observacaoDrafts, setObservacaoDrafts] = useState<Record<string, string>>({});
  // Inclusao de colaborador direto da frente de servico.
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const deferredAddSearch = useDeferredValue(addSearch);
  const [addingEmployeeId, setAddingEmployeeId] = useState('');
  const [addError, setAddError] = useState('');
  const [addFeedback, setAddFeedback] = useState('');
  const [removeConfirmEmployeeId, setRemoveConfirmEmployeeId] = useState('');
  const [removingEmployeeId, setRemovingEmployeeId] = useState('');
  const removingEmployeeIdRef = useRef('');
  useEffect(() => { removingEmployeeIdRef.current = removingEmployeeId; }, [removingEmployeeId]);
  const itemsRef = useRef<Record<string, ItemState>>({});
  useEffect(() => { itemsRef.current = items; }, [items]);
  const [memberFeedback, setMemberFeedback] = useState('');
  // Observação do dia: vale para a equipe toda, não para uma pessoa.
  const [dayNote, setDayNote] = useState('');
  const [dayNoteSaving, setDayNoteSaving] = useState(false);
  const [dayNoteFeedback, setDayNoteFeedback] = useState('');

  useEffect(() => {
    setDraftHydrated(false);
    const draft = readDraft(token);
    if (draft) {
      setDate(draft.date);
      setSelectedGroupId(draft.selectedGroupId);
      setItems(draft.items);
      currentDayDraftRef.current = draft.items;
      setResult(draft.result);
    }
    setDraftHydrated(true);
  }, [token]);

  useEffect(() => {
    if (!draftHydrated) return;
    if (dataSelecionada && dataAtual && dataSelecionada !== dataAtual) return;
    const draftWriteTimer = window.setTimeout(() => {
      writeDraft(token, { date, selectedGroupId, items, result });
    }, 250);

    return () => window.clearTimeout(draftWriteTimer);
  }, [dataAtual, dataSelecionada, date, draftHydrated, items, result, selectedGroupId, token]);

  const activeGroups = useMemo(() => (Array.isArray(gruposEquipe) ? gruposEquipe : [])
    .filter(group => group?.status === 'ativo' && group?.linkAtivo)
    .map(group => ({ ...group, funcionarioIds: Array.isArray(group.funcionarioIds) ? group.funcionarioIds.filter(Boolean) : [] })), [gruposEquipe]);

  const filteredGroups = useMemo(() => {
    const query = deferredGroupSearch.trim().toLocaleLowerCase('pt-BR');
    return activeGroups.filter(group => !query || [safeText(group.nome), safeText(group.responsavel), safeText(group.frenteServico)]
      .some(value => value.toLocaleLowerCase('pt-BR').includes(query)));
  }, [activeGroups, deferredGroupSearch]);

  const group = useMemo(() => generalLink
    ? activeGroups.find(item => item.id === selectedGroupId)
    : (meuGrupo || activeGroups.find(item => item.token === token)), [activeGroups, generalLink, meuGrupo, selectedGroupId, token]);

  const groupEmployees = useMemo(() => {
    if (!group) return [];
    const byId = new Map((Array.isArray(funcionarios) ? funcionarios : []).filter(Boolean).map(employee => [employee.id, employee]));
    return group.funcionarioIds.map(id => byId.get(id)).filter((employee): employee is Funcionario => Boolean(employee?.ativo));
  }, [funcionarios, group]);

  const visibleEmployees = useMemo(() => {
    const query = deferredEmployeeSearch.trim().toLocaleLowerCase('pt-BR');
    return groupEmployees.filter(employee => !query || [safeText(employee.nome), safeText(employee.cargo), safeText(employee.matricula)]
      .some(value => value.toLocaleLowerCase('pt-BR').includes(query)));
  }, [deferredEmployeeSearch, groupEmployees]);

  const workName = useMemo(() => {
    if (!group) return '';
    return (Array.isArray(obras) ? obras : []).find(work => work?.id === group.obraId)?.nome || group.frenteServico;
  }, [group, obras]);

  const companyName = (employee: Funcionario) => (Array.isArray(empresas) ? empresas : [])
    .find(company => company?.id === employee.empresaId)?.nome || 'Empresa não informada';

  useEffect(() => {
    if (!group) return;
    setItems(current => Object.fromEntries(groupEmployees.map(employee => {
      const existing = current[employee.id];
      if (existing?.status) return [employee.id, existing];
      const remote = meusRegistros.find(record => record.funcionarioId === employee.id);
      if (remote) return [employee.id, { status: remote.status, observacao: remote.observacao || '' }];
      return [employee.id, existing || { observacao: '' }];
    })));
    setEmployeeSearch('');
    setError('');
    setResult(current => current?.submissionId ? current : null);
  }, [group, groupEmployees, meusRegistros]);

  const reviewed = groupEmployees.filter(employee => Boolean(items[employee.id]?.status)).length;
  const pending = Math.max(0, groupEmployees.length - reviewed);
  const progress = groupEmployees.length ? Math.round((reviewed / groupEmployees.length) * 100) : 0;
  // Ao trocar de dia, a lista passa a refletir exatamente o que foi enviado
  // naquela data. O rascunho local do dia corrente não é tocado na primeira
  // carga, apenas quando o responsável realmente navega para outro dia.
  const seededDateRef = useRef<string | null>(null);
  useEffect(() => {
    if (!dataSelecionada) return;
    const previousDate = seededDateRef.current;
    seededDateRef.current = dataSelecionada;
    if (previousDate === null || previousDate === dataSelecionada) return;
    setItems(dataSelecionada === dataAtual
      ? currentDayDraftRef.current
      : Object.fromEntries(meusRegistros.map(record => [
        record.funcionarioId,
        { status: record.status, observacao: record.observacao || '' },
      ])));
    setObservacaoDrafts({});
    setSavedFeedback({});
    setCardErrors({});
    setEmployeeSearch('');
  }, [dataAtual, dataSelecionada, meusRegistros]);

  const alreadySubmitted = meusRegistros.length > 0 || Boolean(result?.submissionId);
  // Dias anteriores abrem em consulta: o serviço público só aceita alteração
  // na data corrente, então a interface não oferece edição fora dela.
  const viewingPastDay = Boolean(dataSelecionada && dataAtual && dataSelecionada !== dataAtual);
  // O dia corrente encabeça a régua mesmo sem envio ainda, para que a volta
  // de um dia anterior seja sempre possível.
  const dayOptions = useMemo(() => {
    const previousDays = datasDisponiveis.filter(dia => dia !== dataAtual);
    return dataAtual ? [dataAtual, ...previousDays] : previousDays;
  }, [dataAtual, datasDisponiveis]);

  // Ao abrir o link num dia que já foi enviado, o comprovante volta a aparecer
  // uma vez: mostra quantos estão e em que situação, e é dali que se decide
  // ajustar a lista. Trocar de dia reapresenta o comprovante daquele dia.
  useEffect(() => {
    if (!group || !dataSelecionada || meusRegistros.length === 0) return;
    const receiptKey = `${group.id}|${dataSelecionada}`;
    if (receiptShownForRef.current === receiptKey) return;
    receiptShownForRef.current = receiptKey;
    setShowSuccessScreen(true);
  }, [dataSelecionada, group, meusRegistros]);

  // Só entra na lista quem não está em nenhuma equipe do link. A busca aceita
  // nome, cargo ou matrícula — é como o apontador identifica a pessoa no campo.
  const addableEmployees = useMemo(() => {
    const assigned = new Set(groupEmployees.map(employee => employee.id));
    const query = deferredAddSearch.trim().toLocaleLowerCase('pt-BR');
    return (Array.isArray(funcionariosDisponiveis) ? funcionariosDisponiveis : [])
      .filter(employee => employee?.id && !assigned.has(employee.id))
      .filter(employee => !query || [safeText(employee.nome), safeText(employee.cargo), safeText(employee.matricula)]
        .some(value => value.toLocaleLowerCase('pt-BR').includes(query)));
  }, [deferredAddSearch, funcionariosDisponiveis, groupEmployees]);

  const canAddMembers = Boolean(onAddMember && group && !viewingPastDay);
  const canRemoveMembers = Boolean(onRemoveMember && group && !viewingPastDay);

  useEffect(() => {
    setDayNote(observacaoDia);
    setDayNoteFeedback('');
  }, [observacaoDia, dataSelecionada]);

  const dayNoteDirty = dayNote.trim() !== (observacaoDia || '').trim();

  const saveDayNote = async () => {
    if (!group || !onSaveDayNote || dayNoteSaving) return;
    setDayNoteSaving(true);
    try {
      const response = await onSaveDayNote(group.id, dayNote.trim());
      setDayNoteFeedback(response.message);
    } catch (caught) {
      setDayNoteFeedback(caught instanceof Error ? caught.message : 'Não foi possível salvar a observação.');
    } finally {
      setDayNoteSaving(false);
    }
  };


  const addMember = async (employee: FuncionarioDisponivel) => {
    if (!group || !onAddMember || addingEmployeeId) return;
    setAddingEmployeeId(employee.id);
    setAddError('');
    try {
      const response = await onAddMember(group.id, employee.id);
      if (!response.success) {
        setAddError(response.message);
        return;
      }
      setAddFeedback(response.message);
      setAddSearch('');
      // O recarregamento traz a equipe já com o novo integrante e o retira do
      // catálogo de disponíveis, sem que o apontador precise fechar o link.
      onRetry();
    } catch (caught) {
      setAddError(caught instanceof Error ? caught.message : 'Não foi possível incluir este colaborador.');
    } finally {
      setAddingEmployeeId('');
    }
  };

  // Estavel por toda a vida do componente: nao depende de removingEmployeeId
  // (lido pela ref), entao um cartao tocando "remover" nao invalida a
  // identidade que os outros cartoes memoizados recebem como prop.
  const removeMember = useCallback(async (employee: Funcionario) => {
    if (!group || !onRemoveMember || removingEmployeeIdRef.current) return;
    setRemovingEmployeeId(employee.id);
    setCardErrors(current => ({ ...current, [employee.id]: '' }));
    setMemberFeedback('');
    try {
      const response = await onRemoveMember(group.id, employee.id);
      if (!response.success) {
        setCardErrors(current => ({ ...current, [employee.id]: response.message }));
        return;
      }
      setItems(current => {
        const next = { ...current };
        delete next[employee.id];
        currentDayDraftRef.current = next;
        return next;
      });
      setRemoveConfirmEmployeeId('');
      setMemberFeedback(response.message);
    } catch (caught) {
      setCardErrors(current => ({
        ...current,
        [employee.id]: caught instanceof Error ? caught.message : 'Não foi possível remover este colaborador.',
      }));
    } finally {
      setRemovingEmployeeId('');
    }
  }, [group, onRemoveMember]);

  // Otimista: a tela muda no toque, antes da rede responder. Quem aponta em
  // campo nao pode esperar um round-trip pra ver o proprio toque acontecer.
  // Se o servidor recusar, volta pro estado anterior e mostra o erro no
  // cartao. Estavel (useCallback + itemsRef) pelo mesmo motivo do removeMember.
  const updateStatus = useCallback(async (employeeId: string, status: PresencaStatus, observacaoOverride?: string) => {
    if (!group || viewingPastDay) return;
    const previous = itemsRef.current[employeeId];
    const observacaoValue = (observacaoOverride ?? previous?.observacao ?? '').trim();
    const next = { status, observacao: observacaoValue };
    itemsRef.current = { ...itemsRef.current, [employeeId]: next };
    setItems(current => ({ ...current, [employeeId]: next }));
    setCardErrors(current => ({ ...current, [employeeId]: '' }));
    setSavingEmployeeId(employeeId);
    try {
      const response = await onUpdateRecord(group.id, employeeId, status, observacaoValue);
      if (!response.success) {
        itemsRef.current = { ...itemsRef.current, [employeeId]: previous || next };
        setItems(current => ({ ...current, [employeeId]: previous || current[employeeId] }));
        setCardErrors(current => ({ ...current, [employeeId]: response.message }));
        return;
      }
      setObservacaoDrafts(current => {
        if (!(employeeId in current)) return current;
        const draft = { ...current };
        delete draft[employeeId];
        return draft;
      });
      setSavedFeedback(current => ({
        ...current,
        [employeeId]: `Atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      }));
    } catch (caught) {
      itemsRef.current = { ...itemsRef.current, [employeeId]: previous || next };
      setItems(current => ({ ...current, [employeeId]: previous || current[employeeId] }));
      setCardErrors(current => ({
        ...current,
        [employeeId]: caught instanceof Error ? caught.message : 'Não foi possível salvar a alteração.',
      }));
    } finally {
      setSavingEmployeeId('');
    }
  }, [group, viewingPastDay, onUpdateRecord]);

  // Identidade estavel: e o que permite ao cartao memoizado ignorar o toque
  // dado no colaborador do lado.
  const setStatus = useCallback((employeeId: string, status: PresencaStatus) => {
    setItems(current => {
      const next = {
        ...current,
        [employeeId]: { observacao: current[employeeId]?.observacao || '', status },
      };
      currentDayDraftRef.current = next;
      return next;
    });
    setError('');
    setDraftSaved(false);
    setDraftFeedback('Alterações ainda não enviadas');
  }, []);

  const setObservacao = useCallback((employeeId: string, observacao: string) => {
    setItems(current => {
      const next = { ...current, [employeeId]: { ...current[employeeId], observacao } };
      currentDayDraftRef.current = next;
      return next;
    });
    setDraftSaved(false);
    setDraftFeedback('Alterações ainda não enviadas');
  }, []);

  const pedirRemocao = useCallback((employeeId: string) => setRemoveConfirmEmployeeId(employeeId), []);
  const cancelarRemocao = useCallback(() => setRemoveConfirmEmployeeId(''), []);

  const setObservacaoDraft = useCallback((employeeId: string, value: string) => {
    setObservacaoDrafts(current => ({ ...current, [employeeId]: value }));
  }, []);

  const saveDraft = async () => {
    if (savingDraft || submitting) return;
    setSavingDraft(true);
    setDraftSaved(false);
    setError('');
    try {
      writeDraft(token, { date, selectedGroupId: group?.id || selectedGroupId, items, result: null });
      setDraftFeedback('Rascunho salvo neste aparelho · Ainda não enviado');
      setDraftSaved(true);
      setDraftSavedAt(new Date().toISOString());
      setShowDraftSuccessScreen(true);
    } finally {
      setSavingDraft(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!group || submitting) return;
    if (!groupEmployees.length) {
      setError('A equipe não possui colaboradores ativos. Solicite a revisão do cadastro.');
      return;
    }
    if (pending > 0) {
      setError(`Revise a situação de ${pending} colaborador${pending === 1 ? '' : 'es'} antes de enviar.`);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await onSubmitPresenca(group, date, groupEmployees.map(employee => ({
        funcionarioId: employee.id,
        status: items[employee.id].status as PresencaStatus,
        observacao: items[employee.id].observacao.trim(),
      })), dayNote.trim());
      if (!response.success) {
        setError(response.message);
        return;
      }
      setResult(response);
      receiptShownForRef.current = `${group.id}|${dataSelecionada || date}`;
      setShowSuccessScreen(true);
      setDraftFeedback('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível enviar a presença.');
    } finally {
      setSubmitting(false);
    }
  };


  const dayNoteSection = group && onSaveDayNote && !viewingPastDay ? (
    <section className="presence-public__daynote">
      <label htmlFor="presenca-observacao-dia">Observação do dia</label>
      <textarea
        id="presenca-observacao-dia"
        rows={2}
        value={dayNote}
        disabled={dayNoteSaving}
        onChange={event => { setDayNote(event.target.value); setDayNoteFeedback(''); }}
        placeholder="Chuva, parada de frente, acidente… vale para a equipe toda"
      />
      {alreadySubmitted && dayNoteDirty && (
        <button type="button" onClick={() => void saveDayNote()} disabled={dayNoteSaving}>
          {dayNoteSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar observação do dia
        </button>
      )}
      {dayNoteFeedback && <p role="status">{dayNoteFeedback}</p>}
    </section>
  ) : null;

  // O bloco de inclusão acompanha as duas telas de lista — antes e depois do
  // envio — porque alguém pode chegar na frente a qualquer momento do dia.
  const addMemberSection = canAddMembers && group ? (
    <section className="presence-public__add-member">
      <button
        type="button"
        className="presence-public__add-toggle"
        aria-expanded={isAddPanelOpen}
        onClick={() => {
          setIsAddPanelOpen(open => !open);
          setAddError('');
          setAddFeedback('');
        }}
      >
        {isAddPanelOpen ? <X className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
        <span>{isAddPanelOpen ? 'Fechar inclusão' : 'Adicionar colaborador à equipe'}</span>
      </button>
      {addFeedback && !isAddPanelOpen && (
        <p role="status" className="presence-public__add-feedback"><Check className="h-4 w-4" /> {addFeedback}</p>
      )}
      {isAddPanelOpen && (
        <div className="presence-public__add-panel">
          <p className="presence-public__add-help">
            Escolha quem chegou na frente de serviço. Só aparece aqui quem está no efetivo ativo e ainda não pertence a nenhuma equipe.
          </p>
          <div className="presence-public__search">
            <Search className="h-5 w-5" />
            <input
              autoFocus
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              value={addSearch}
              onChange={event => setAddSearch(event.target.value)}
              placeholder="Buscar por nome, cargo ou matrícula"
              aria-label="Buscar colaborador para incluir na equipe"
            />
          </div>
          <p className="presence-public__search-meta" aria-live="polite">
            {addableEmployees.length} {addableEmployees.length === 1 ? 'colaborador disponível' : 'colaboradores disponíveis'}
          </p>
          {addError && <div role="alert" className="presence-public__card-error">{addError}</div>}
          {addFeedback && <div role="status" className="presence-public__card-feedback">{addFeedback}</div>}
          <div className="presence-public__add-list">
            {addableEmployees.length === 0 ? (
              <p className="presence-public__empty">
                {funcionariosDisponiveis.length === 0
                  ? 'Todo o efetivo ativo já está distribuído entre as equipes.'
                  : 'Nenhum colaborador encontrado com esse termo.'}
              </p>
            ) : addableEmployees.slice(0, 40).map(employee => (
              <button
                key={employee.id}
                type="button"
                className="presence-public__add-option"
                disabled={Boolean(addingEmployeeId)}
                onClick={() => void addMember(employee)}
              >
                <span className="presence-public__avatar">
                  {safeText(employee.nome).split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()}
                </span>
                <div>
                  <strong>{employee.nome}</strong>
                  <span>{employee.cargo}{employee.matricula ? ` · Mat. ${employee.matricula}` : ''}</span>
                </div>
                {addingEmployeeId === employee.id
                  ? <RefreshCw className="h-5 w-5 animate-spin" />
                  : <UserPlus className="h-5 w-5" />}
              </button>
            ))}
          </div>
          {addableEmployees.length > 40 && (
            <p className="presence-public__search-meta">Refine a busca para ver os demais.</p>
          )}
        </div>
      )}
    </section>
  ) : null;

  if (isLoadingCloud && activeGroups.length === 0) {
    return (
      <main className="presence-public presence-public--center" aria-busy="true">
        <section className="presence-public__loading" aria-label="Carregando presença">
          <img src={reneaLogo} alt="RENEA Infraestrutura" className="presence-public__logo" />
          <div className="presence-public__loading-line" />
          <div className="presence-public__loading-line presence-public__loading-line--short" />
          <p>Preparando as equipes em tempo real</p>
        </section>
      </main>
    );
  }

  if (loadError && activeGroups.length === 0) {
    return (
      <main className="presence-public presence-public--center">
        <section className="presence-public__state-card">
          <AlertTriangle className="presence-public__state-icon presence-public__state-icon--warning" />
          <h1>Não foi possível abrir a presença</h1>
          <p>{loadError}</p>
          <button type="button" onClick={onRetry} className="presence-public__primary"><RefreshCw className="h-4 w-4" /> Tentar novamente</button>
        </section>
      </main>
    );
  }

  if (!group) {
    if (!generalLink) {
      return (
        <main className="presence-public presence-public--center">
          <section className="presence-public__state-card">
            <CheckCircle2 className="presence-public__success-icon" />
            <h1>Presença de hoje concluída</h1>
            <p>Esta equipe já enviou a situação do dia. O formulário será liberado automaticamente amanhã.</p>
          </section>
        </main>
      );
    }

    return (
      <main className="presence-public">
        <header className="presence-public__header">
          <img src={reneaLogo} alt="RENEA Infraestrutura" className="presence-public__logo" />
          <span><i /> Controle ao vivo</span>
        </header>
        <div className="presence-public__content presence-public__content--narrow">
          <section className="presence-public__intro">
            <p className="presence-public__eyebrow">Registro de campo</p>
            <h1>Escolha sua equipe</h1>
            <p>Selecione o grupo correto para começar a conferência.</p>
          </section>
          <div className="presence-public__search"><Search className="h-5 w-5" /><input autoFocus inputMode="search" enterKeyHint="search" autoComplete="off" value={groupSearch} onChange={event => setGroupSearch(event.target.value)} placeholder="Buscar equipe ou responsável" aria-label="Buscar equipe ou responsável" /></div>
          <p className="presence-public__search-meta" aria-live="polite">{filteredGroups.length} {filteredGroups.length === 1 ? 'equipe encontrada' : 'equipes encontradas'}</p>
          <section className="presence-public__group-list">
            {filteredGroups.length === 0 ? <p className="presence-public__empty">{activeGroups.length === 0 ? 'Todas as equipes já enviaram a presença de hoje. Elas estarão disponíveis novamente amanhã.' : 'Nenhuma equipe encontrada.'}</p> : filteredGroups.map(item => (
              <button key={item.id} type="button" onClick={() => setSelectedGroupId(item.id)} className="presence-public__group-button">
                <div><strong>{item.nome}</strong><span>{item.responsavel} · {item.frenteServico}</span></div>
                <div className="presence-public__group-count"><b>{item.funcionarioIds.length}</b><span>pessoas</span></div>
                <ChevronRight className="h-5 w-5" />
              </button>
            ))}
          </section>
        </div>
      </main>
    );
  }

  if (showDraftSuccessScreen && group) {
    const draftCounts = groupEmployees.reduce<Record<string, number>>((summary, employee) => {
      const status = items[employee.id]?.status || 'Pendente';
      summary[status] = (summary[status] || 0) + 1;
      return summary;
    }, {});
    const draftOutsideCount = (draftCounts.Ausente || 0) + (draftCounts['Falta justificada'] || 0)
      + (draftCounts.Atestado || 0) + (draftCounts.Férias || 0) + (draftCounts.Afastado || 0) + (draftCounts.Outro || 0);
    return (
      <main className="presence-public presence-public--center">
        <section className="presence-public__success-card presence-public__success-card--draft">
          <img src={reneaLogo} alt="RENEA Infraestrutura" className="presence-public__logo" />
          <CheckCircle2 className="presence-public__success-icon" />
          <p className="presence-public__draft-badge">Não enviado</p>
          <h1>Rascunho salvo</h1>
          <p>{group.nome} ficou salvo somente neste aparelho.</p>
          <time>{draftSavedAt ? new Date(draftSavedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</time>
          <div className="presence-public__success-total"><strong>{reviewed}</strong><span>conferidos de {groupEmployees.length}</span></div>
          <div className="presence-public__summary-grid">
            <div><strong>{draftCounts.Presente || 0}</strong><span>Presentes</span></div>
            <div><strong>{draftOutsideCount}</strong><span>Fora</span></div>
            <div><strong>{draftCounts.Atestado || 0}</strong><span>Atestados</span></div>
            <div><strong>{draftCounts.Pendente || 0}</strong><span>Pendentes</span></div>
          </div>
          <p className="presence-public__draft-warning"><Clock3 className="h-4 w-4" /> Este rascunho ainda não foi enviado para o controle de presença.</p>
          <button type="button" onClick={() => setShowDraftSuccessScreen(false)} className="presence-public__primary">
            Continuar preenchendo <ChevronRight className="h-4 w-4" />
          </button>
        </section>
      </main>
    );
  }

  if (showSuccessScreen && (result || meusRegistros.length > 0)) {
    // Recém-enviado, o comprovante conta o que está na tela. Reaberto, conta o
    // que o serviço devolveu para aquele dia — inclusive quem foi incluído ou
    // teve a situação alterada depois do envio original.
    const receiptRoster = result
      ? groupEmployees.map(employee => items[employee.id]?.status || 'Outro')
      : meusRegistros.map(record => record.status || 'Outro');
    const counts = receiptRoster.reduce<Record<string, number>>((summary, status) => {
      summary[status] = (summary[status] || 0) + 1;
      return summary;
    }, {});
    const foraCount = (counts.Ausente || 0) + (counts['Falta justificada'] || 0)
      + (counts.Atestado || 0) + (counts.Férias || 0) + (counts.Afastado || 0) + (counts.Outro || 0);
    const receiptIso = result?.createdAtIso
      || meusRegistros.map(record => record.updatedAt || record.createdAt).filter(Boolean).sort().at(-1)
      || '';
    const receiptDayLabel = formatDayLabel(dataSelecionada || dataAtual, dataAtual);
    return (
      <main className="presence-public presence-public--center">
        <section className="presence-public__success-card">
          <img src={reneaLogo} alt="RENEA Infraestrutura" className="presence-public__logo" />
          <CheckCircle2 className="presence-public__success-icon" />
          <h1>{result ? 'Presença enviada' : 'Presença registrada'}</h1>
          <p>
            {result
              ? `${group.nome} atualizada no controle em tempo real.`
              : `${group.nome} · apontamento de ${receiptDayLabel.toLocaleLowerCase('pt-BR')} já enviado.`}
          </p>
          <time>{receiptIso ? new Date(receiptIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</time>
          <div className="presence-public__success-total"><strong>{counts.Presente || 0}</strong><span>presentes de {receiptRoster.length}</span></div>
          <div className="presence-public__summary-grid">
            <div><strong>{counts.Presente || 0}</strong><span>Presentes</span></div>
            <div><strong>{foraCount}</strong><span>Fora</span></div>
            <div><strong>{counts.Ausente || 0}</strong><span>Ausentes</span></div>
            <div><strong>{counts.Atestado || 0}</strong><span>Atestados</span></div>
          </div>
          {result?.submissionId && <p className="presence-public__audit-id">ID do envio: {result.submissionId}</p>}
          <button type="button" onClick={() => setShowSuccessScreen(false)} className="presence-public__primary">
            {viewingPastDay ? 'Ver a lista deste dia' : 'Voltar e alterar a lista'} <ChevronRight className="h-4 w-4" />
          </button>
          {dayOptions.length > 1 && onSelectDate && (
            <section className="presence-public__receipt-history" aria-label="Histórico de apontamentos da equipe">
              <p><History className="h-4 w-4" /> Histórico da equipe</p>
              <div className="presence-public__daybar presence-public__daybar--receipt">
                {dayOptions.map(dia => (
                  <button
                    key={dia}
                    type="button"
                    className="presence-public__day"
                    data-selected={dia === dataSelecionada}
                    aria-current={dia === dataSelecionada ? 'date' : undefined}
                    disabled={isLoadingCloud}
                    onClick={() => onSelectDate(dia)}
                  >
                    {formatDayLabel(dia, dataAtual)}
                  </button>
                ))}
              </div>
            </section>
          )}
        </section>
      </main>
    );
  }

  if (alreadySubmitted) {
    const counts = Object.values(items).reduce<Record<string, number>>((summary, item) => {
      const status = item.status || 'Outro';
      summary[status] = (summary[status] || 0) + 1;
      return summary;
    }, {});
    return (
      <main className="presence-public">
        <header className="presence-public__header">
          <button type="button" onClick={() => generalLink && setSelectedGroupId('')} aria-label="Voltar às equipes" disabled={!generalLink}><ArrowLeft className="h-5 w-5" /></button>
          <img src={reneaLogo} alt="RENEA Infraestrutura" className="presence-public__logo" />
          <span><i /> Ao vivo</span>
        </header>
        <div className="presence-public__content">
          <section className="presence-public__intro presence-public__intro--form">
            <p className="presence-public__eyebrow">Registro de campo</p>
            {viewingPastDay
              ? <h1 className="presence-public__done-title"><CalendarDays className="h-7 w-7" /> Apontamento de {formatDayLabel(dataSelecionada, dataAtual)}</h1>
              : <h1 className="presence-public__done-title"><CheckCircle2 className="h-7 w-7" /> Apontamento realizado</h1>}
            <p>{group.nome} · {workName} · {reviewed} de {groupEmployees.length} colaboradores registrados{!viewingPastDay && result?.createdAtIso ? ` · enviado às ${new Date(result.createdAtIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
            <button type="button" className="presence-public__receipt-link" onClick={() => setShowSuccessScreen(true)}>
              <CheckCircle2 className="h-4 w-4" /> Ver comprovante do dia
            </button>
            </section>
          {dayOptions.length > 1 && onSelectDate && (
            <section className="presence-public__daybar" aria-label="Dias com apontamento enviado">
              {dayOptions.map(dia => (
                <button
                  key={dia}
                  type="button"
                  className="presence-public__day"
                  data-selected={dia === dataSelecionada}
                  aria-current={dia === dataSelecionada ? 'date' : undefined}
                  disabled={isLoadingCloud}
                  onClick={() => onSelectDate(dia)}
                >
                  {formatDayLabel(dia, dataAtual)}
                </button>
              ))}
            </section>
          )}
          <div className="presence-public__summary-grid presence-public__summary-grid--compact">
            <div><strong>{counts.Presente || 0}</strong><span>Presentes</span></div>
            <div><strong>{counts.Ausente || 0}</strong><span>Ausentes</span></div>
            <div><strong>{counts.Atestado || 0}</strong><span>Atestados</span></div>
            <div><strong>{(counts['Falta justificada'] || 0) + (counts.Férias || 0) + (counts.Afastado || 0) + (counts.Outro || 0)}</strong><span>Outros</span></div>
          </div>
          {dayNoteSection}
          {viewingPastDay && observacaoDia && (
            <section className="presence-public__daynote presence-public__daynote--readonly">
              <label>Observação do dia</label>
              <p>{observacaoDia}</p>
            </section>
          )}
          {addMemberSection}
          {memberFeedback && <p role="status" className="presence-public__member-feedback"><Check className="h-4 w-4" /> {memberFeedback}</p>}
          <div className="presence-public__search"><Search className="h-5 w-5" /><input inputMode="search" enterKeyHint="search" autoComplete="off" value={employeeSearch} onChange={event => setEmployeeSearch(event.target.value)} placeholder="Buscar por nome ou matrícula" aria-label="Buscar colaborador" /></div>
          <p className="presence-public__search-meta" aria-live="polite">{viewingPastDay ? 'Dia anterior: consulta apenas. Alterações somente no dia de hoje.' : 'Toque em uma situação para atualizar na hora'}</p>
          <section className="presence-public__employee-list">
            {visibleEmployees.map(employee => {
              const currentStatus = items[employee.id]?.status;
              const savedObservacao = items[employee.id]?.observacao || '';
              const draftObservacao = observacaoDrafts[employee.id] ?? savedObservacao;
              const observacaoDirty = draftObservacao.trim() !== savedObservacao.trim();
              if (viewingPastDay) {
                return (
                  <article key={employee.id} className="presence-public__employee-card">
                    <div className="presence-public__employee-heading">
                      <span className="presence-public__avatar">{safeText(employee.nome).split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()}</span>
                      <div><h2>{employee.nome}</h2><p>{employee.cargo} · {companyName(employee)}{employee.matricula ? ` · Mat. ${employee.matricula}` : ''}</p></div>
                      {currentStatus && <span className="presence-public__status-pill">{currentStatus}</span>}
                    </div>
                    {savedObservacao && <p className="presence-public__readonly-note">{savedObservacao}</p>}
                  </article>
                );
              }
              return (
                <SubmittedEmployeeCard
                  key={employee.id}
                  employee={employee}
                  empresaNome={companyName(employee)}
                  currentStatus={currentStatus}
                  draftObservacao={draftObservacao}
                  observacaoDirty={observacaoDirty}
                  isSaving={savingEmployeeId === employee.id}
                  cardError={cardErrors[employee.id] || ''}
                  feedback={savedFeedback[employee.id] || ''}
                  onUpdateStatus={updateStatus}
                  onObservacaoChange={setObservacaoDraft}
                  podeRemover={canRemoveMembers}
                  confirmandoRemocao={removeConfirmEmployeeId === employee.id}
                  removendo={removingEmployeeId === employee.id}
                  removocaoEmCurso={Boolean(removingEmployeeId)}
                  onPedirRemocao={pedirRemocao}
                  onCancelarRemocao={cancelarRemocao}
                  onConfirmarRemocao={removeMember}
                />
              );
            })}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="presence-public">
      <header className="presence-public__header">
        <button type="button" onClick={() => generalLink && setSelectedGroupId('')} aria-label="Voltar às equipes" disabled={!generalLink}><ArrowLeft className="h-5 w-5" /></button>
        <img src={reneaLogo} alt="RENEA Infraestrutura" className="presence-public__logo" />
        <span><i /> Ao vivo</span>
      </header>
      <div className="presence-public__content">
        <section className="presence-public__intro presence-public__intro--form">
          <p className="presence-public__eyebrow">Registro de campo</p>
          <h1>Registrar presença</h1>
          <p>{group.nome} · {workName}</p>
        </section>
        <section className="presence-public__progress-card">
          <div><strong>{reviewed}</strong><span> de {groupEmployees.length} conferidos</span></div><b>{progress}%</b>
          <div className="presence-public__progress-track"><i style={{ width: `${progress}%` }} /></div>
          <label>Data do apontamento<input type="date" value={date} onChange={event => setDate(event.target.value)} min={todayInput()} max={todayInput()} /></label>
        </section>
        {dayOptions.length > 1 && onSelectDate && (
          <section className="presence-public__daybar" aria-label="Dias com apontamento enviado">
            {dayOptions.map(dia => (
              <button
                key={dia}
                type="button"
                className="presence-public__day"
                data-selected={dia === dataSelecionada}
                aria-current={dia === dataSelecionada ? 'date' : undefined}
                disabled={isLoadingCloud}
                onClick={() => onSelectDate(dia)}
              >
                {formatDayLabel(dia, dataAtual)}
              </button>
            ))}
          </section>
        )}
        {dayNoteSection}
        {addMemberSection}
        {memberFeedback && <p role="status" className="presence-public__member-feedback"><Check className="h-4 w-4" /> {memberFeedback}</p>}
        <div className="presence-public__search"><Search className="h-5 w-5" /><input inputMode="search" enterKeyHint="search" autoComplete="off" value={employeeSearch} onChange={event => setEmployeeSearch(event.target.value)} placeholder="Buscar colaborador" aria-label="Buscar colaborador" /></div>
        <form onSubmit={submit} className="presence-public__form">
          <section className="presence-public__employee-list">
            {visibleEmployees.map(employee => (
              <EmployeeCard
                key={employee.id}
                employee={employee}
                empresaNome={companyName(employee)}
                status={items[employee.id]?.status}
                observacao={items[employee.id]?.observacao || ''}
                erro={cardErrors[employee.id] || ''}
                onStatus={setStatus}
                onObservacao={setObservacao}
                podeRemover={canRemoveMembers}
                confirmandoRemocao={removeConfirmEmployeeId === employee.id}
                removendo={removingEmployeeId === employee.id}
                removocaoEmCurso={Boolean(removingEmployeeId)}
                onPedirRemocao={pedirRemocao}
                onCancelarRemocao={cancelarRemocao}
                onConfirmarRemocao={removeMember}
              />
            ))}
          </section>
          {error && <div role="alert" className="presence-public__error"><AlertTriangle className="h-5 w-5" /><span>{error}</span></div>}
          {draftFeedback && <div role="status" className="presence-public__draft-status"><Clock3 className="h-5 w-5" /><span>{draftFeedback}</span></div>}
          <div className="presence-public__submit-bar"><div className="presence-public__pending-count"><Clock3 className="h-5 w-5" /><strong>{pending}</strong><span>pendente{pending === 1 ? '' : 's'}</span></div><div className="presence-public__submit-actions"><button type="button" onClick={() => void saveDraft()} disabled={submitting || savingDraft} data-saved={draftSaved || undefined}>{savingDraft ? <RefreshCw className="h-5 w-5 animate-spin" /> : draftSaved ? <CheckCircle2 className="h-5 w-5" /> : <Save className="h-5 w-5" />}{savingDraft ? 'Salvando' : draftSaved ? 'Rascunho salvo' : 'Salvar rascunho'}</button><button type="submit" disabled={submitting || savingDraft || pending > 0}>{submitting ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}{submitting ? 'Enviando' : 'Enviar presença'}</button></div></div>
        </form>
      </div>
    </main>
  );
}
