import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  RefreshCw,
  Search,
  Send,
  Users,
} from 'lucide-react';
import type { Empresa, Funcionario, GrupoEquipe, ObraLocal, PresencaStatus } from '../types';
import reneaLogo from '../assets/images/logo-renea-dark.svg';
import './presencaTempoRealPublica.css';

const PRIMARY_STATUSES: PresencaStatus[] = ['Presente', 'Ausente', 'Falta justificada', 'Atestado'];
const SECONDARY_STATUSES: PresencaStatus[] = ['Férias', 'Afastado', 'Outro'];

interface SubmissionResult {
  success: boolean;
  message: string;
  submissionId?: string;
  createdAtIso?: string;
}

interface Props {
  token: string;
  gruposEquipe: GrupoEquipe[];
  funcionarios: Funcionario[];
  empresas: Empresa[];
  obras: ObraLocal[];
  isLoadingCloud: boolean;
  loadError: string;
  onRetry: () => void;
  onSubmitPresenca: (
    grupo: GrupoEquipe,
    data: string,
    items: Array<{ funcionarioId: string; status: PresencaStatus; observacao: string }>,
  ) => Promise<SubmissionResult>;
}

type ItemState = { status?: PresencaStatus; observacao: string };

const todayInput = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
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

export default function PresencaTempoRealPublica({
  token,
  gruposEquipe = [],
  funcionarios = [],
  empresas = [],
  obras = [],
  isLoadingCloud,
  loadError,
  onRetry,
  onSubmitPresenca,
}: Props) {
  const generalLink = isGeneralToken(token);
  const [date, setDate] = useState(todayInput());
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const deferredGroupSearch = useDeferredValue(groupSearch);
  const deferredEmployeeSearch = useDeferredValue(employeeSearch);
  const [items, setItems] = useState<Record<string, ItemState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);

  useEffect(() => {
    setDraftHydrated(false);
    const draft = readDraft(token);
    if (draft) {
      setDate(draft.date);
      setSelectedGroupId(draft.selectedGroupId);
      setItems(draft.items);
      setResult(draft.result);
    }
    setDraftHydrated(true);
  }, [token]);

  useEffect(() => {
    if (!draftHydrated) return;
    writeDraft(token, { date, selectedGroupId, items, result });
  }, [date, draftHydrated, items, result, selectedGroupId, token]);

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
    : activeGroups.find(item => item.token === token), [activeGroups, generalLink, selectedGroupId, token]);

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
    setItems(current => Object.fromEntries(groupEmployees.map(employee => [
      employee.id,
      current[employee.id] || { observacao: '' },
    ])));
    setEmployeeSearch('');
    setError('');
    setResult(current => current?.submissionId ? current : null);
  }, [group, groupEmployees]);

  const reviewed = groupEmployees.filter(employee => Boolean(items[employee.id]?.status)).length;
  const pending = Math.max(0, groupEmployees.length - reviewed);
  const progress = groupEmployees.length ? Math.round((reviewed / groupEmployees.length) * 100) : 0;

  const setStatus = (employeeId: string, status: PresencaStatus) => {
    setItems(current => ({
      ...current,
      [employeeId]: { observacao: current[employeeId]?.observacao || '', status },
    }));
    setError('');
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
      })));
      if (!response.success) {
        setError(response.message);
        return;
      }
      setResult(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível enviar a presença.');
    } finally {
      setSubmitting(false);
    }
  };

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
            <AlertTriangle className="presence-public__state-icon presence-public__state-icon--warning" />
            <h1>Link indisponível</h1>
            <p>O endereço expirou, foi renovado ou está inativo. Solicite o link atual ao responsável.</p>
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
            {filteredGroups.length === 0 ? <p className="presence-public__empty">Nenhuma equipe encontrada.</p> : filteredGroups.map(item => (
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

  if (result) {
    const counts = Object.values(items).reduce<Record<string, number>>((summary, item) => {
      const status = item.status || 'Outro';
      summary[status] = (summary[status] || 0) + 1;
      return summary;
    }, {});
    return (
      <main className="presence-public presence-public--center">
        <section className="presence-public__success-card">
          <img src={reneaLogo} alt="RENEA Infraestrutura" className="presence-public__logo" />
          <CheckCircle2 className="presence-public__success-icon" />
          <h1>Presença enviada</h1>
          <p>{group.nome} atualizada no controle em tempo real.</p>
          <time>{new Date(result.createdAtIso || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>
          <div className="presence-public__success-total"><strong>{groupEmployees.length}</strong><span>colaboradores</span></div>
          <div className="presence-public__summary-grid">
            <div><strong>{counts.Presente || 0}</strong><span>Presentes</span></div>
            <div><strong>{counts.Ausente || 0}</strong><span>Ausentes</span></div>
            <div><strong>{counts.Atestado || 0}</strong><span>Atestados</span></div>
            <div><strong>{(counts['Falta justificada'] || 0) + (counts.Férias || 0) + (counts.Afastado || 0) + (counts.Outro || 0)}</strong><span>Outros</span></div>
          </div>
          {result.submissionId && <p className="presence-public__audit-id">ID do envio: {result.submissionId}</p>}
          <button type="button" onClick={() => { setResult(null); setItems({}); if (generalLink) setSelectedGroupId(''); }} className="presence-public__primary"><ArrowLeft className="h-4 w-4" /> Voltar às equipes</button>
        </section>
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
          <label>Data do apontamento<input type="date" value={date} onChange={event => setDate(event.target.value)} max={todayInput()} /></label>
        </section>
        <div className="presence-public__search"><Search className="h-5 w-5" /><input inputMode="search" enterKeyHint="search" autoComplete="off" value={employeeSearch} onChange={event => setEmployeeSearch(event.target.value)} placeholder="Buscar colaborador" aria-label="Buscar colaborador" /></div>
        <form onSubmit={submit} className="presence-public__form">
          <section className="presence-public__employee-list">
            {visibleEmployees.map(employee => {
              const selected = items[employee.id]?.status;
              return (
                <article key={employee.id} className="presence-public__employee-card">
                  <div className="presence-public__employee-heading">
                    <span className="presence-public__avatar">{safeText(employee.nome).split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()}</span>
                    <div><h2>{employee.nome}</h2><p>{employee.cargo} · {companyName(employee)}</p></div>
                    {selected && <Check className="h-5 w-5 text-emerald-700" />}
                  </div>
                  <div className="presence-public__status-grid">
                    {PRIMARY_STATUSES.map(status => <button key={status} type="button" onClick={() => setStatus(employee.id, status)} data-selected={selected === status}>{selected === status && <Check className="h-4 w-4" />}{status}</button>)}
                  </div>
                  <select value={SECONDARY_STATUSES.includes(selected as PresencaStatus) ? selected : ''} onChange={event => event.target.value && setStatus(employee.id, event.target.value as PresencaStatus)}><option value="">Outras situações</option>{SECONDARY_STATUSES.map(status => <option key={status}>{status}</option>)}</select>
                  <textarea value={items[employee.id]?.observacao || ''} onChange={event => setItems(current => ({ ...current, [employee.id]: { ...current[employee.id], observacao: event.target.value } }))} rows={2} placeholder="Observação opcional" />
                </article>
              );
            })}
          </section>
          {error && <div role="alert" className="presence-public__error"><AlertTriangle className="h-5 w-5" /><span>{error}</span></div>}
          <div className="presence-public__submit-bar"><div><Clock3 className="h-5 w-5" /><strong>{pending}</strong><span>pendente{pending === 1 ? '' : 's'}</span></div><button type="submit" disabled={submitting || pending > 0}>{submitting ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}{submitting ? 'Enviando' : 'Revisar e enviar'}</button></div>
        </form>
      </div>
    </main>
  );
}
