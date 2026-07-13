import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  FilePenLine,
  Eye,
  History,
  Loader2,
  PackageCheck,
  Save,
  Search,
  Send,
  Truck,
  X,
} from 'lucide-react';
import { DestinoObraJazida, TicketJazida, TipoMaterialJazida, TipoTicketJazida } from '../types';
import reneaLogo from '../assets/images/logo-renea-branco.svg';
import SignaturePad from './SignaturePad';

interface TicketLinkExternoProps {
  tickets: TicketJazida[];
  isLoadingCloud: boolean;
  loadError?: string;
  onReserveNumber: () => Promise<string>;
  onSaveTicket: (ticket: TicketJazida) => Promise<{ success: boolean; message: string }>;
}

const MATERIALS: TipoMaterialJazida[] = ['Solo', 'Rachão', 'BGS', 'Brita', 'Areia', 'Outros'];
const DESTINATIONS: DestinoObraJazida[] = [
  'Ramo 200', 'Ramo 300', 'Ramo 500', 'Ramo 600', 'Ramo 800', 'Ramo 900', 'Ramo 1000',
  'Ramo 2000', 'Agulha', 'Ramo 200 Alargamento', 'Ramo 500 Marginal', 'Ramo 600 Ferradura',
  'Rua Padre Eustáquio', 'SP066 Ibar', 'Canteiro da Marginal', 'Jazida', 'Outros',
];
const DRAFT_KEY = 'renea_ticket_link_drafts_v2';
const DEVICE_KEY = 'renea_ticket_device_id_v1';
const HISTORY_KEY = 'renea_ticket_link_history_v1';

const twoDigits = (value: number) => String(value).padStart(2, '0');
const nowTime = () => {
  const now = new Date();
  return `${twoDigits(now.getHours())}:${twoDigits(now.getMinutes())}`;
};
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${twoDigits(now.getMonth() + 1)}-${twoDigits(now.getDate())}`;
};

const getDeviceId = () => {
  const created = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    localStorage.setItem(DEVICE_KEY, created);
  } catch {
    return created;
  }
  return created;
};

const emptyTicket = (type: TipoTicketJazida, number: string, deviceId: string): TicketJazida => ({
  id: `ticket-link-${type === 'Liberação' ? 'lib' : 'rec'}-${number}`,
  tipoTicket: type,
  ticketNumero: number,
  prefixo: '',
  placa: '',
  data: today(),
  horaSaida: nowTime(),
  horaChegada: nowTime(),
  tipoMaterial: 'Solo',
  quantidadeM3: 1,
  unidadeQuantidade: 'm³',
  destinoObra: 'Ramo 200',
  destinoOutro: '',
  estaca: '',
  responsavelLiberacao: '',
  nomeLegivel: '',
  empresa: 'RENEA',
  observacao: '',
  statusFluxo: 'Rascunho',
  origemRegistro: 'Link',
  dispositivoId: deviceId,
  criadoEm: new Date().toISOString(),
  atualizadoEm: new Date().toISOString(),
});

const cloneForReceipt = (release: TicketJazida, deviceId: string): TicketJazida => ({
  ...emptyTicket('Recebimento', release.ticketNumero, deviceId),
  prefixo: release.prefixo,
  placa: release.placa,
  tipoMaterial: release.tipoMaterial,
  materialOutro: release.materialOutro,
  quantidadeM3: release.quantidadeM3,
  unidadeQuantidade: release.unidadeQuantidade || 'm³',
  destinoObra: release.destinoObra,
  destinoOutro: release.destinoOutro,
});

const readDrafts = (deviceId: string): TicketJazida[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]') as TicketJazida[];
    return stored.filter(item => item.dispositivoId === deviceId);
  } catch {
    return [];
  }
};

const storeDrafts = (drafts: TicketJazida[]) => {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts.slice(0, 8)));
    return true;
  } catch {
    return false;
  }
};

const readOwnHistory = (deviceId: string): TicketJazida[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as TicketJazida[];
    return stored
      .filter(item => item.dispositivoId === deviceId && item.statusFluxo === 'Enviado')
      .sort((a, b) => String(b.enviadoEm || b.atualizadoEm || '').localeCompare(String(a.enviadoEm || a.atualizadoEm || '')))
      .slice(0, 20);
  } catch {
    return [];
  }
};

const storeOwnHistory = (items: TicketJazida[]) => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 20)));
  } catch {
    // O envio ao banco continua funcionando mesmo se o aparelho estiver sem espaço local.
  }
};

export default function TicketLinkExterno({
  tickets,
  isLoadingCloud,
  loadError = '',
  onReserveNumber,
  onSaveTicket,
}: TicketLinkExternoProps) {
  const [deviceId] = useState(getDeviceId);
  const [screen, setScreen] = useState<'home' | 'form' | 'success'>('home');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<TicketJazida | null>(null);
  const [drafts, setDrafts] = useState<TicketJazida[]>(() => readDrafts(deviceId));
  const [ownHistory, setOwnHistory] = useState<TicketJazida[]>(() => readOwnHistory(deviceId));
  const [viewingOwnTicket, setViewingOwnTicket] = useState<TicketJazida | null>(null);
  const [search, setSearch] = useState('');
  const [showReceiptSearch, setShowReceiptSearch] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const pendingReceipts = useMemo(() => {
    const sentReceipts = new Set(
      tickets
        .filter(ticket => ticket.tipoTicket === 'Recebimento' && ticket.statusFluxo !== 'Rascunho')
        .map(ticket => ticket.ticketNumero),
    );
    const normalizedSearch = search.trim().toLowerCase();
    if (normalizedSearch.length < 2) return [];
    return tickets
      .filter(ticket => (ticket.tipoTicket || 'Liberação') === 'Liberação')
      .filter(ticket => ticket.statusFluxo !== 'Rascunho' && !sentReceipts.has(ticket.ticketNumero))
      .filter(ticket => !normalizedSearch || [ticket.ticketNumero, ticket.placa, ticket.prefixo]
        .some(value => value.toLowerCase().includes(normalizedSearch)))
      .sort((a, b) => Number(b.ticketNumero) - Number(a.ticketNumero));
  }, [tickets, search]);

  useEffect(() => {
    const remoteOwnDrafts = tickets.filter(ticket =>
      ticket.statusFluxo === 'Rascunho' && ticket.dispositivoId === deviceId,
    );
    if (remoteOwnDrafts.length === 0) return;
    setDrafts(current => {
      const indexed = new Map(remoteOwnDrafts.map(item => [item.id, item]));
      current.forEach(item => {
        const remote = indexed.get(item.id);
        if (!remote || String(item.atualizadoEm || '') > String(remote.atualizadoEm || '')) {
          indexed.set(item.id, item);
        }
      });
      const merged = Array.from(indexed.values())
        .sort((a, b) => String(b.atualizadoEm || '').localeCompare(String(a.atualizadoEm || '')))
        .slice(0, 8);
      storeDrafts(merged);
      return merged;
    });
  }, [tickets, deviceId]);

  useEffect(() => {
    const remoteOwnSent = tickets.filter(ticket =>
      ticket.statusFluxo === 'Enviado' && ticket.dispositivoId === deviceId,
    );
    if (remoteOwnSent.length === 0) return;
    setOwnHistory(current => {
      const indexed = new Map(current.map(item => [item.id, item]));
      remoteOwnSent.forEach(item => indexed.set(item.id, item));
      const merged = Array.from(indexed.values())
        .sort((a, b) => String(b.enviadoEm || b.atualizadoEm || '').localeCompare(String(a.enviadoEm || a.atualizadoEm || '')))
        .slice(0, 20);
      storeOwnHistory(merged);
      return merged;
    });
  }, [tickets, deviceId]);

  useEffect(() => {
    if (!form || screen !== 'form' || form.statusFluxo !== 'Rascunho') return;
    const next = [form, ...drafts.filter(item => item.id !== form.id)].slice(0, 8);
    storeDrafts(next);
    setDrafts(previous => {
      const withoutCurrent = previous.filter(item => item.id !== form.id);
      return [form, ...withoutCurrent].slice(0, 8);
    });
  }, [form, screen]);

  const update = <K extends keyof TicketJazida,>(key: K, value: TicketJazida[K]) => {
    setForm(current => current ? { ...current, [key]: value, atualizadoEm: new Date().toISOString() } : current);
    setError('');
  };

  const beginRelease = async () => {
    setIsStarting(true);
    setError('');
    try {
      const number = await onReserveNumber();
      setForm(emptyTicket('Liberação', number, deviceId));
      setStep(1);
      setScreen('form');
    } catch {
      setError('Não foi possível reservar o número agora. Confira a internet e tente novamente.');
    } finally {
      setIsStarting(false);
    }
  };

  const beginReceipt = (release: TicketJazida) => {
    setForm(cloneForReceipt(release, deviceId));
    setStep(1);
    setError('');
    setScreen('form');
  };

  const editDraft = (draft: TicketJazida) => {
    setForm(draft);
    setStep(1);
    setError('');
    setScreen('form');
  };

  const validateStep = (targetStep = step) => {
    if (!form) return false;
    if (targetStep === 1 && (!form.prefixo.trim() || !form.placa.trim() || !form.data)) {
      setError('Informe prefixo, placa e data para continuar.');
      return false;
    }
    if (targetStep === 2) {
      if (!form.quantidadeM3 || form.quantidadeM3 <= 0 || !form.destinoObra) {
        setError('Informe a quantidade e o destino da carga.');
        return false;
      }
      if (form.tipoMaterial === 'Outros' && !form.materialOutro?.trim()) {
        setError('Descreva o material selecionado como Outros.');
        return false;
      }
      if (form.destinoObra === 'Outros' && !form.destinoOutro?.trim()) {
        setError('Descreva o destino ou ramo de descarga.');
        return false;
      }
      if (form.tipoTicket === 'Recebimento' && typeof form.cargaConforme !== 'boolean') {
        setError('Informe se a carga está conforme.');
        return false;
      }
    }
    setError('');
    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) setStep(current => Math.min(3, current + 1));
  };

  const persist = async (send: boolean) => {
    if (!form) return;
    if (send) {
      if (!validateStep(1) || !validateStep(2)) return;
      if (!form.nomeLegivel.trim() || !form.assinaturaDigital) {
        setError('Informe o nome legível e faça a assinatura digital antes de enviar.');
        return;
      }
    }

    setIsSaving(true);
    setError('');
    const saved: TicketJazida = {
      ...form,
      responsavelLiberacao: form.responsavelLiberacao || form.nomeLegivel,
      assinaturaResponsavel: form.nomeLegivel,
      statusFluxo: send ? 'Enviado' : 'Rascunho',
      atualizadoEm: new Date().toISOString(),
      ...(send
        ? { enviadoEm: new Date().toISOString() }
        : form.enviadoEm ? { enviadoEm: form.enviadoEm } : {}),
    };

    try {
      const result = await onSaveTicket(saved);
      if (!result.success) throw new Error(result.message);
      if (send) {
        const nextDrafts = drafts.filter(item => item.id !== saved.id);
        setDrafts(nextDrafts);
        storeDrafts(nextDrafts);
        setOwnHistory(current => {
          const nextHistory = [saved, ...current.filter(item => item.id !== saved.id)]
            .sort((a, b) => String(b.enviadoEm || b.atualizadoEm || '').localeCompare(String(a.enviadoEm || a.atualizadoEm || '')))
            .slice(0, 20);
          storeOwnHistory(nextHistory);
          return nextHistory;
        });
        setForm(saved);
        setMessage(result.message || 'Ticket enviado com sucesso.');
        setScreen('success');
      } else {
        const nextDrafts = [saved, ...drafts.filter(item => item.id !== saved.id)].slice(0, 8);
        setDrafts(nextDrafts);
        storeDrafts(nextDrafts);
        setMessage('Rascunho salvo. Você pode continuar depois neste aparelho.');
        setScreen('home');
      }
    } catch (saveError) {
      console.error('Falha técnica ao enviar ticket:', saveError);
      const detail = saveError instanceof Error ? saveError.message : '';
      setError(detail.includes('já foi enviado por outra pessoa')
        ? detail
        : 'Não foi possível salvar agora. Verifique a internet e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingCloud) {
    return (
      <div className="min-h-screen bg-slate-950 text-white grid place-items-center p-6">
        <div className="text-center space-y-4">
          <Loader2 className="mx-auto h-9 w-9 animate-spin text-emerald-400" />
          <p className="text-sm font-bold">Carregando tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-slate-950 px-4 py-4 text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <img src={reneaLogo} alt="RENEA" className="h-8 w-auto" />
          <div className="text-right">
            <p className="text-xs font-black uppercase text-emerald-400">Tickets digitais</p>
            <p className="text-[11px] text-slate-400">Liberação e recebimento</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        {screen === 'home' && (
          <div className="space-y-6">
            <section>
              <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">O que você vai registrar?</h1>
              <p className="mt-1 text-sm text-slate-500">Escolha uma opção para começar.</p>
            </section>

            {message && (
              <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> {message}
              </div>
            )}
            {loadError && <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">{loadError}</div>}
            {error && <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={beginRelease}
                disabled={isStarting}
                className="flex min-h-32 items-center gap-4 rounded-md bg-emerald-600 p-5 text-left text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
              >
                {isStarting ? <Loader2 className="h-8 w-8 animate-spin" /> : <Truck className="h-8 w-8" />}
                <span><b className="block text-lg">Nova liberação</b><small className="text-emerald-50">Saída de um caminhão</small></span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReceiptSearch(true);
                  window.setTimeout(() => document.getElementById('recebimentos-pendentes')?.scrollIntoView({ behavior: 'smooth' }), 50);
                }}
                className="flex min-h-32 items-center gap-4 rounded-md border-2 border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-emerald-400"
              >
                <PackageCheck className="h-8 w-8 text-emerald-600" />
                <span><b className="block text-lg">Recebimento</b><small className="text-slate-500">Confirmar chegada da carga</small></span>
              </button>
            </div>

            {drafts.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2"><FilePenLine className="h-5 w-5 text-amber-600" /><h2 className="font-black">Meus rascunhos</h2></div>
                <div className="grid gap-2">
                  {drafts.map(draft => (
                    <button key={draft.id} type="button" onClick={() => editDraft(draft)} className="flex items-center justify-between gap-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-left">
                      <span><b className="block text-sm">Ticket {draft.ticketNumero} · {draft.tipoTicket}</b><small className="text-slate-500">{draft.placa || 'Placa não informada'} · {draft.prefixo || 'Prefixo não informado'}</small></span>
                      <ArrowRight className="h-5 w-5 text-amber-700" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {ownHistory.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2"><History className="h-5 w-5 text-emerald-700" /><div><h2 className="font-black">Meus envios</h2><p className="text-xs text-slate-500">Somente tickets enviados neste aparelho.</p></div></div>
                  <span className="text-xs font-bold text-slate-400">{ownHistory.length}</span>
                </div>
                <div className="grid gap-2">
                  {ownHistory.slice(0, 8).map(item => {
                    const receiptAlreadySent = ownHistory.some(historyItem => historyItem.tipoTicket === 'Recebimento' && historyItem.ticketNumero === item.ticketNumero);
                    return (
                      <div key={item.id} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div><b className="block text-sm text-slate-950">Ticket {item.ticketNumero} · {item.tipoTicket}</b><small className="text-slate-500">{item.placa || 'Sem placa'} · {item.prefixo || 'Sem prefixo'} · {item.data.split('-').reverse().join('/')}</small></div>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setViewingOwnTicket(item)} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-xs font-black text-slate-700"><Eye className="h-4 w-4" /> Visualizar</button>
                            {(item.tipoTicket || 'Liberação') === 'Liberação' && !receiptAlreadySent && <button type="button" onClick={() => beginReceipt(item)} className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-3 text-xs font-black text-white"><PackageCheck className="h-4 w-4" /> Fazer recebimento</button>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {showReceiptSearch && <section id="recebimentos-pendentes" className="space-y-3 scroll-mt-4">
              <div className="flex items-center justify-between gap-3">
                <div><h2 className="font-black">Localizar liberação</h2><p className="text-xs text-slate-500">Pesquise o caminhão que chegou.</p></div>
                <button type="button" onClick={() => { setShowReceiptSearch(false); setSearch(''); }} className="text-xs font-bold text-slate-500">Fechar</button>
              </div>
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar ticket, placa ou prefixo" className="h-12 w-full rounded-md border border-slate-300 bg-white pl-10 pr-4 text-sm outline-none focus:border-emerald-500" />
              </label>
              <div className="grid gap-2">
                {search.trim().length < 2 ? (
                  <div className="rounded-md border border-slate-200 bg-white p-5 text-center text-sm text-slate-500">Digite pelo menos dois caracteres para pesquisar.</div>
                ) : pendingReceipts.length === 0 ? (
                  <div className="rounded-md border border-slate-200 bg-white p-5 text-center text-sm text-slate-500">Nenhuma liberação pendente encontrada. Tickets concluídos não aparecem aqui.</div>
                ) : pendingReceipts.slice(0, 20).map(release => (
                  <button key={release.id} type="button" onClick={() => beginReceipt(release)} className="flex items-center justify-between gap-4 rounded-md border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-emerald-400">
                    <span><b className="block text-sm text-slate-900">Ticket {release.ticketNumero} · {release.placa}</b><small className="text-slate-500">{release.prefixo} · {release.tipoMaterial} · {release.quantidadeM3} {release.unidadeQuantidade || 'm³'}</small></span>
                    <ArrowRight className="h-5 w-5 shrink-0 text-emerald-600" />
                  </button>
                ))}
              </div>
            </section>}
          </div>
        )}

        {screen === 'form' && form && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <button type="button" onClick={() => setScreen('home')} className="inline-flex h-10 items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft className="h-4 w-4" /> Voltar</button>
              <span className="rounded-md bg-slate-950 px-3 py-2 text-sm font-black text-white">Ticket {form.ticketNumero}</span>
            </div>

            <div className="grid grid-cols-3 gap-2" aria-label={`Etapa ${step} de 3`}>
              {[1, 2, 3].map(item => <div key={item} className={`h-2 rounded-full ${item <= step ? 'bg-emerald-500' : 'bg-slate-300'}`} />)}
            </div>
            <div><p className="text-xs font-black uppercase text-emerald-700">{form.tipoTicket} · etapa {step} de 3</p><h1 className="text-2xl font-black">{step === 1 ? 'Veículo e horário' : step === 2 ? 'Dados da carga' : 'Responsável e assinatura'}</h1></div>

            <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              {step === 1 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Prefixo" required><input value={form.prefixo} onChange={event => update('prefixo', event.target.value.toUpperCase())} className="ticket-input" placeholder="Ex.: CB-102" /></Field>
                  <Field label="Placa" required><input value={form.placa} onChange={event => update('placa', event.target.value.toUpperCase())} className="ticket-input" placeholder="ABC1D23" /></Field>
                  <Field label="Data" required><input type="date" value={form.data} onChange={event => update('data', event.target.value)} className="ticket-input" /></Field>
                  <Field label={form.tipoTicket === 'Liberação' ? 'Hora de saída' : 'Hora de chegada'} required>
                    <input type="time" value={form.tipoTicket === 'Liberação' ? form.horaSaida : form.horaChegada} onChange={event => update(form.tipoTicket === 'Liberação' ? 'horaSaida' : 'horaChegada', event.target.value)} className="ticket-input" />
                  </Field>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <Field label="Tipo de material" required>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {MATERIALS.map(material => (
                        <button key={material} type="button" onClick={() => update('tipoMaterial', material)} className={`flex h-12 items-center justify-between rounded-md border px-3 text-sm font-bold ${form.tipoMaterial === material ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600'}`}>
                          {material}{form.tipoMaterial === material && <Check className="h-4 w-4" />}
                        </button>
                      ))}
                    </div>
                  </Field>
                  {form.tipoMaterial === 'Outros' && <Field label="Qual material?" required><input value={form.materialOutro || ''} onChange={event => update('materialOutro', event.target.value)} className="ticket-input" /></Field>}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Quantidade" required><input type="number" min="0.01" step="0.01" value={form.quantidadeM3} onChange={event => update('quantidadeM3', Number(event.target.value))} className="ticket-input" /></Field>
                    <Field label="Unidade" required><div className="grid h-12 grid-cols-2 rounded-md bg-slate-100 p-1">{(['m³', 'caçamba'] as const).map(unit => <button key={unit} type="button" onClick={() => update('unidadeQuantidade', unit)} className={`rounded text-sm font-black ${form.unidadeQuantidade === unit ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>{unit}</button>)}</div></Field>
                  </div>
                  <Field label={form.tipoTicket === 'Liberação' ? 'Destino / obra' : 'Ramo de descarga'} required><select value={form.destinoObra} onChange={event => update('destinoObra', event.target.value)} className="ticket-input">{DESTINATIONS.map(destination => <option key={destination}>{destination}</option>)}</select></Field>
                  {form.destinoObra === 'Outros' && <Field label={form.tipoTicket === 'Liberação' ? 'Qual destino?' : 'Qual ramo de descarga?'} required><input value={form.destinoOutro || ''} onChange={event => update('destinoOutro', event.target.value)} className="ticket-input" /></Field>}
                  {form.tipoTicket === 'Recebimento' && (
                    <>
                      <Field label="Estaca"><input value={form.estaca || ''} onChange={event => update('estaca', event.target.value)} className="ticket-input" placeholder="Ex.: 120+10" /></Field>
                      <Field label="Carga conforme?" required><div className="grid grid-cols-2 gap-2">{[true, false].map(value => <button key={String(value)} type="button" onClick={() => update('cargaConforme', value)} className={`h-12 rounded-md border text-sm font-black ${form.cargaConforme === value ? value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-500'}`}>{value ? 'Sim' : 'Não'}</button>)}</div></Field>
                      <Field label="Observações (opcional)"><textarea value={form.observacao} onChange={event => update('observacao', event.target.value)} className="ticket-input min-h-24 resize-y py-3" placeholder="Registre somente se necessário" /></Field>
                    </>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <Field label={form.tipoTicket === 'Liberação' ? 'Responsável pela liberação' : 'Responsável pelo recebimento'} required><input value={form.nomeLegivel} onChange={event => { update('nomeLegivel', event.target.value); update('responsavelLiberacao', event.target.value); }} className="ticket-input" placeholder="Nome completo e legível" /></Field>
                  <SignaturePad value={form.assinaturaDigital} onChange={value => update('assinaturaDigital', value)} />
                  <div className="rounded-md bg-slate-50 p-4 text-xs text-slate-600"><b className="block text-slate-900">Resumo do Ticket {form.ticketNumero}</b>{form.prefixo} · {form.placa} · {form.tipoMaterial === 'Outros' ? form.materialOutro : form.tipoMaterial} · {form.quantidadeM3} {form.unidadeQuantidade}</div>
                </div>
              )}
            </section>

            {error && <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <button type="button" onClick={() => persist(false)} disabled={isSaving} className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-5 text-sm font-black text-slate-700"><Save className="h-4 w-4" /> Salvar rascunho</button>
              <div className="flex gap-2">
                {step > 1 && <button type="button" onClick={() => setStep(current => current - 1)} className="h-12 flex-1 rounded-md border border-slate-300 bg-white px-5 text-sm font-black sm:flex-none">Voltar</button>}
                {step < 3 ? <button type="button" onClick={nextStep} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-slate-950 px-6 text-sm font-black text-white sm:flex-none">Continuar <ArrowRight className="h-4 w-4" /></button> : <button type="button" onClick={() => persist(true)} disabled={isSaving} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-emerald-600 px-6 text-sm font-black text-white sm:flex-none">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar ticket</button>}
              </div>
            </div>
            <p className="flex items-center justify-center gap-2 text-center text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" /> O preenchimento fica salvo neste aparelho enquanto você avança.</p>
          </div>
        )}

        {screen === 'success' && form && (
          <div className="mx-auto max-w-lg space-y-6 py-8 text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" />
            <div><p className="text-xs font-black uppercase text-emerald-700">Enviado com sucesso</p><h1 className="mt-1 text-3xl font-black">Ticket {form.ticketNumero}</h1><p className="mt-2 text-sm text-slate-500">{form.tipoTicket} registrada e disponível no painel administrativo.</p></div>
            <div className="grid gap-3">
              {form.tipoTicket === 'Liberação' && <button type="button" onClick={() => beginReceipt(form)} className="inline-flex h-14 items-center justify-center gap-3 rounded-md bg-emerald-600 px-5 font-black text-white"><PackageCheck className="h-5 w-5" /> Preencher recebimento deste ticket</button>}
              <button type="button" onClick={() => setViewingOwnTicket(form)} className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-5 font-black text-slate-700"><Eye className="h-5 w-5" /> Visualizar comprovante</button>
              <button type="button" onClick={beginRelease} disabled={isStarting} className="inline-flex h-14 items-center justify-center gap-3 rounded-md bg-slate-950 px-5 font-black text-white"><Truck className="h-5 w-5" /> Próximo caminhão</button>
              <button type="button" onClick={() => { setMessage(''); setForm(null); setScreen('home'); }} className="h-12 font-bold text-slate-600">Voltar ao início</button>
            </div>
          </div>
        )}
      </main>

      {viewingOwnTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setViewingOwnTicket(null)}>
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div><p className="text-xs font-black uppercase text-emerald-700">{viewingOwnTicket.tipoTicket}</p><h2 className="text-xl font-black">Ticket {viewingOwnTicket.ticketNumero}</h2></div>
              <button type="button" onClick={() => setViewingOwnTicket(null)} aria-label="Fechar visualização" className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-500"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-5 p-5">
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200 sm:grid-cols-4">
                {[['Prefixo', viewingOwnTicket.prefixo], ['Placa', viewingOwnTicket.placa], ['Data', viewingOwnTicket.data.split('-').reverse().join('/')], [viewingOwnTicket.tipoTicket === 'Recebimento' ? 'Chegada' : 'Saída', viewingOwnTicket.tipoTicket === 'Recebimento' ? viewingOwnTicket.horaChegada || viewingOwnTicket.horaSaida : viewingOwnTicket.horaSaida]].map(([label, value]) => <div key={label} className="bg-white p-3"><span className="block text-[10px] font-black uppercase text-slate-500">{label}</span><strong className="mt-1 block text-sm">{value || '—'}</strong></div>)}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-slate-200 p-4"><span className="text-[10px] font-black uppercase text-slate-500">Material e quantidade</span><p className="mt-2 font-bold">{viewingOwnTicket.tipoMaterial === 'Outros' ? viewingOwnTicket.materialOutro : viewingOwnTicket.tipoMaterial} · {viewingOwnTicket.quantidadeM3} {viewingOwnTicket.unidadeQuantidade || 'm³'}</p></div>
                <div className="rounded-md border border-slate-200 p-4"><span className="text-[10px] font-black uppercase text-slate-500">{viewingOwnTicket.tipoTicket === 'Recebimento' ? 'Ramo de descarga' : 'Destino / obra'}</span><p className="mt-2 font-bold">{viewingOwnTicket.destinoObra === 'Outros' ? viewingOwnTicket.destinoOutro : viewingOwnTicket.destinoObra}</p></div>
              </div>
              {viewingOwnTicket.observacao && <div className="rounded-md border border-slate-200 p-4"><span className="text-[10px] font-black uppercase text-slate-500">Observações</span><p className="mt-2 text-sm">{viewingOwnTicket.observacao}</p></div>}
              {viewingOwnTicket.assinaturaDigital && <div className="rounded-md border border-slate-200 p-4"><span className="text-[10px] font-black uppercase text-slate-500">Assinatura digital</span><img src={viewingOwnTicket.assinaturaDigital} alt="Assinatura do responsável" className="mx-auto mt-2 h-28 max-w-full object-contain" /><p className="border-t border-slate-300 pt-1 text-center text-xs font-bold">{viewingOwnTicket.nomeLegivel}</p></div>}
              {(viewingOwnTicket.tipoTicket || 'Liberação') === 'Liberação' && !ownHistory.some(item => item.tipoTicket === 'Recebimento' && item.ticketNumero === viewingOwnTicket.ticketNumero) && <button type="button" onClick={() => { const release = viewingOwnTicket; setViewingOwnTicket(null); beginReceipt(release); }} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 font-black text-white"><PackageCheck className="h-5 w-5" /> Fazer recebimento deste ticket</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block space-y-2"><span className="text-xs font-black uppercase text-slate-600">{label}{required && <span className="text-rose-600"> *</span>}</span>{children}</label>;
}
