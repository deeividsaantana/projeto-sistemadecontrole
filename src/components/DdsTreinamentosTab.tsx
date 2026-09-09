/**
 * DDS e treinamentos: o que foi passado em campo e a validade das formações,
 * com aviso de vencimento antes de virar problema.
 */
import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, GraduationCap, Paperclip, Plus, ShieldCheck } from 'lucide-react';
import type { Funcionario, RegistroDDS, Treinamento } from '../types';
import { DIAS_ALERTA_VENCIMENTO, situacaoTreinamento, treinamentosParaAlertar } from '../utils/treinamentos';
import { Badge, Card, EmptyState, Modal, SegmentedControl, PageHeader, TableBody, TableHead, TableShell, isoDay } from '../shared/ui';

interface DdsTreinamentosTabProps {
  registrosDds: RegistroDDS[];
  treinamentos: Treinamento[];
  funcionarios: Funcionario[];
  responsavel: string;
  podeEditar: boolean;
  onSaveDds: (registro: RegistroDDS) => void;
  onSaveTreinamento: (treinamento: Treinamento) => void;
}

const formatarData = (valor?: string) => (valor ? valor.slice(0, 10).split('-').reverse().join('/') : '—');

const situacaoTone: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  'Válido': 'success',
  'Vence em breve': 'warning',
  'Vencido': 'danger',
  'Sem vencimento': 'neutral',
};

export default function DdsTreinamentosTab({
  registrosDds,
  treinamentos,
  funcionarios,
  responsavel,
  podeEditar,
  onSaveDds,
  onSaveTreinamento,
}: DdsTreinamentosTabProps) {
  const hoje = isoDay(new Date());
  const [aba, setAba] = useState<'dds' | 'treinamentos'>('dds');
  const [formDds, setFormDds] = useState(false);
  const [formTreinamento, setFormTreinamento] = useState(false);
  const [erro, setErro] = useState('');
  const inputDocumento = useRef<HTMLInputElement>(null);

  const [dds, setDds] = useState({ data: hoje, tema: '', observacao: '', participantesIds: [] as string[], documento: '' });
  const [treino, setTreino] = useState({ funcionarioId: '', nome: '', dataRealizacao: hoje, dataVencimento: '', observacao: '' });

  const alertas = useMemo(() => treinamentosParaAlertar(treinamentos, hoje), [treinamentos, hoje]);

  const ddsOrdenados = useMemo(
    () => [...registrosDds].sort((a, b) => b.data.localeCompare(a.data)),
    [registrosDds],
  );
  const treinamentosOrdenados = useMemo(
    () => [...treinamentos].sort((a, b) => (a.dataVencimento || '9999').localeCompare(b.dataVencimento || '9999')),
    [treinamentos],
  );

  const ativos = useMemo(
    () => funcionarios.filter(item => item.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [funcionarios],
  );

  const receberDocumento = (arquivo?: File) => {
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => setDds(atual => ({ ...atual, documento: String(leitor.result || '') }));
    leitor.readAsDataURL(arquivo);
    if (inputDocumento.current) inputDocumento.current.value = '';
  };

  const salvarDds = () => {
    if (!dds.tema.trim()) {
      setErro('Informe o tema do DDS.');
      return;
    }
    if (dds.participantesIds.length === 0) {
      setErro('Marque quem participou.');
      return;
    }
    onSaveDds({
      id: `dds-${Date.now()}`,
      data: dds.data,
      tema: dds.tema.trim(),
      responsavel,
      participantesIds: dds.participantesIds,
      observacao: dds.observacao.trim() || undefined,
      documento: dds.documento || undefined,
      criadoEm: new Date().toISOString(),
    });
    setDds({ data: hoje, tema: '', observacao: '', participantesIds: [], documento: '' });
    setErro('');
    setFormDds(false);
  };

  const salvarTreinamento = () => {
    const funcionario = funcionarios.find(item => item.id === treino.funcionarioId);
    if (!funcionario) {
      setErro('Selecione o colaborador.');
      return;
    }
    if (!treino.nome.trim()) {
      setErro('Informe o treinamento.');
      return;
    }
    onSaveTreinamento({
      id: `trn-${Date.now()}`,
      funcionarioId: funcionario.id,
      funcionarioNome: funcionario.nome,
      nome: treino.nome.trim(),
      dataRealizacao: treino.dataRealizacao,
      dataVencimento: treino.dataVencimento || undefined,
      observacao: treino.observacao.trim() || undefined,
      criadoEm: new Date().toISOString(),
    });
    setTreino({ funcionarioId: '', nome: '', dataRealizacao: hoje, dataVencimento: '', observacao: '' });
    setErro('');
    setFormTreinamento(false);
  };

  return (
    <div id="dds-treinamentos-tab" className="renea-page min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        eyebrow="Segurança e capacitação"
        photo="ponte-construcao"
        title="DDS e Treinamentos"
        description="Diálogos de segurança em campo e validade das formações do efetivo."
        actions={podeEditar ? (
          <button
            type="button"
            onClick={() => { setErro(''); aba === 'dds' ? setFormDds(true) : setFormTreinamento(true); }}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-800"
          >
            <Plus className="h-4 w-4" /> {aba === 'dds' ? 'Registrar DDS' : 'Novo treinamento'}
          </button>
        ) : undefined}
      />

      {alertas.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            {alertas.length} treinamento(s) vencido(s) ou vencendo em até {DIAS_ALERTA_VENCIMENTO} dias
          </p>
          <ul className="mt-2 space-y-1 text-[11px] text-amber-900">
            {alertas.slice(0, 5).map(item => (
              <li key={item.treinamento.id}>
                <strong>{item.treinamento.funcionarioNome}</strong> · {item.treinamento.nome} · {item.situacao.toLowerCase()} em {formatarData(item.treinamento.dataVencimento)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <SegmentedControl
        className="mt-4"
        label="Seções de DDS e treinamentos"
        items={[{ id: 'dds', label: 'DDS' }, { id: 'treinamentos', label: 'Treinamentos' }] as const}
        value={aba}
        onChange={setAba}
      />

      {aba === 'dds' ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {ddsOrdenados.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Nenhum DDS registrado" description="Registre o diálogo de segurança feito com a equipe." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {ddsOrdenados.map(item => (
                <li key={item.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-bold text-slate-800">{item.tema}</strong>
                    <p className="truncate text-xs text-slate-500">
                      {formatarData(item.data)} · {item.responsavel} · {item.participantesIds.length} participante(s)
                      {item.observacao ? ` · ${item.observacao}` : ''}
                    </p>
                  </div>
                  {item.documento && <Badge tone="info">Com documento</Badge>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {treinamentosOrdenados.length === 0 ? (
            <EmptyState icon={GraduationCap} title="Nenhum treinamento registrado" description="Cadastre as formações e a validade de cada uma." />
          ) : (
            <TableShell minWidth={760}>
              <TableHead>
                <tr>
                  <th className="p-3">Colaborador</th>
                  <th className="p-3">Treinamento</th>
                  <th className="p-3">Realização</th>
                  <th className="p-3">Vencimento</th>
                  <th className="p-3">Situação</th>
                </tr>
              </TableHead>
              <TableBody>
                {treinamentosOrdenados.map(item => {
                  const situacao = situacaoTreinamento(item, hoje);
                  return (
                    <tr key={item.id} className="transition-colors hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-800">{item.funcionarioNome}</td>
                      <td className="p-3 text-slate-700">{item.nome}</td>
                      <td className="p-3 text-slate-600">{formatarData(item.dataRealizacao)}</td>
                      <td className="p-3 text-slate-600">{formatarData(item.dataVencimento)}</td>
                      <td className="p-3"><Badge tone={situacaoTone[situacao]}>{situacao}</Badge></td>
                    </tr>
                  );
                })}
              </TableBody>
            </TableShell>
          )}
        </div>
      )}

      <input ref={inputDocumento} type="file" accept="image/*,application/pdf" hidden onChange={event => receberDocumento(event.target.files?.[0])} />

      <Modal
        open={formDds}
        title="Registrar DDS"
        size="md"
        onClose={() => setFormDds(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setFormDds(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={salvarDds} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Salvar DDS</button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            Data
            <input type="date" value={dds.data} onChange={event => setDds({ ...dds, data: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Documento da lista
            <button type="button" onClick={() => inputDocumento.current?.click()} className={`mt-1 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border text-xs font-bold transition-colors ${dds.documento ? 'border-emerald-500 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-emerald-500'}`}>
              <Paperclip className="h-4 w-4" /> {dds.documento ? 'Anexado' : 'Anexar foto ou PDF'}
            </button>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Tema
            <input value={dds.tema} onChange={event => setDds({ ...dds, tema: event.target.value })} placeholder="Ex: Trabalho em altura" className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Observação
            <textarea value={dds.observacao} onChange={event => setDds({ ...dds, observacao: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
        </div>

        <p className="mt-4 text-xs font-bold text-slate-600">Participantes ({dds.participantesIds.length})</p>
        <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
          {ativos.map(item => {
            const marcado = dds.participantesIds.includes(item.id);
            return (
              <li key={item.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => setDds(atual => ({
                      ...atual,
                      participantesIds: marcado
                        ? atual.participantesIds.filter(id => id !== item.id)
                        : [...atual.participantesIds, item.id],
                    }))}
                    className="size-4 accent-emerald-600"
                  />
                  <span className="min-w-0 truncate">{item.nome}<span className="text-slate-400"> · {item.cargo}</span></span>
                </label>
              </li>
            );
          })}
        </ul>
        {erro && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-700">{erro}</p>}
      </Modal>

      <Modal
        open={formTreinamento}
        title="Novo treinamento"
        size="md"
        onClose={() => setFormTreinamento(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setFormTreinamento(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={salvarTreinamento} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Salvar treinamento</button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Colaborador
            <select value={treino.funcionarioId} onChange={event => setTreino({ ...treino, funcionarioId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Selecione</option>
              {ativos.map(item => <option key={item.id} value={item.id}>{item.nome}{item.matricula ? ` · ${item.matricula}` : ''}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Treinamento
            <input value={treino.nome} onChange={event => setTreino({ ...treino, nome: event.target.value })} placeholder="Ex: NR-35 Trabalho em altura" className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Realização
            <input type="date" value={treino.dataRealizacao} onChange={event => setTreino({ ...treino, dataRealizacao: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Vencimento
            <input type="date" value={treino.dataVencimento} onChange={event => setTreino({ ...treino, dataVencimento: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Observação
            <textarea value={treino.observacao} onChange={event => setTreino({ ...treino, observacao: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
        </div>
        {erro && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-700">{erro}</p>}
      </Modal>
    </div>
  );
}
