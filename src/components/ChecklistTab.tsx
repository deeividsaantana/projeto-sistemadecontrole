/**
 * Checklist de equipamento, pensado para o celular na frente de serviço:
 * poucos toques por item e foto só quando precisa registrar evidência.
 */
import { useMemo, useRef, useState } from 'react';
import { Camera, ClipboardCheck, Plus, Trash2, X } from 'lucide-react';
import type { ChecklistEquipamento, Equipamento, ItemChecklist, ModeloChecklist, RespostaChecklist } from '../types';
import { MODELO_CHECKLIST_PADRAO, itensCriticosReprovados, resumoChecklist } from '../utils/checklist';
import { Badge, Card, EmptyState, Modal, PageHeader } from '../shared/ui';

interface ChecklistTabProps {
  checklists: ChecklistEquipamento[];
  modelo: ModeloChecklist;
  equipamentos: Equipamento[];
  responsavel: string;
  podeEditar: boolean;
  onSave: (checklist: ChecklistEquipamento) => void;
  onSaveModelo: (modelo: ModeloChecklist) => void;
}

const RESPOSTAS: RespostaChecklist[] = ['OK', 'Atenção', 'Não conforme', 'Não aplicável'];

const respostaClass: Record<RespostaChecklist, string> = {
  OK: 'bg-emerald-600 text-white border-emerald-600',
  'Atenção': 'bg-amber-500 text-white border-amber-500',
  'Não conforme': 'bg-rose-600 text-white border-rose-600',
  'Não aplicável': 'bg-slate-500 text-white border-slate-500',
};

const formatarData = (valor: string) => valor.split('-').reverse().join('/');

export default function ChecklistTab({
  checklists,
  modelo,
  equipamentos,
  responsavel,
  podeEditar,
  onSave,
  onSaveModelo,
}: ChecklistTabProps) {
  const [preenchendo, setPreenchendo] = useState(false);
  const [editandoModelo, setEditandoModelo] = useState(false);
  const [equipamentoId, setEquipamentoId] = useState('');
  const [itens, setItens] = useState<ItemChecklist[]>([]);
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState('');
  const [novoItem, setNovoItem] = useState('');
  const fotoAlvo = useRef<string | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  const itensDoModelo = modelo.itens.length ? modelo.itens : MODELO_CHECKLIST_PADRAO.itens;

  const iniciar = () => {
    setEquipamentoId('');
    setItens(itensDoModelo.map(item => ({
      itemId: item.id,
      descricao: item.descricao,
      critico: item.critico,
      resposta: 'OK' as RespostaChecklist,
    })));
    setObservacao('');
    setErro('');
    setPreenchendo(true);
  };

  const responder = (itemId: string, resposta: RespostaChecklist) => {
    setItens(atual => atual.map(item => item.itemId === itemId ? { ...item, resposta } : item));
  };

  const anotar = (itemId: string, texto: string) => {
    setItens(atual => atual.map(item => item.itemId === itemId ? { ...item, observacao: texto } : item));
  };

  const pedirFoto = (itemId: string) => {
    fotoAlvo.current = itemId;
    inputFoto.current?.click();
  };

  const receberFoto = (arquivo?: File) => {
    const alvo = fotoAlvo.current;
    if (!arquivo || !alvo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      const foto = String(leitor.result || '');
      setItens(atual => atual.map(item => item.itemId === alvo ? { ...item, foto } : item));
    };
    leitor.readAsDataURL(arquivo);
    if (inputFoto.current) inputFoto.current.value = '';
  };

  const salvar = () => {
    const equipamento = equipamentos.find(item => item.id === equipamentoId);
    if (!equipamento) {
      setErro('Selecione o equipamento.');
      return;
    }
    const semJustificativa = itens.find(item => item.resposta === 'Não conforme' && !item.observacao?.trim());
    if (semJustificativa) {
      setErro(`Descreva o problema em "${semJustificativa.descricao}" antes de salvar.`);
      return;
    }
    const agora = new Date();
    onSave({
      id: `chk-${agora.getTime()}`,
      modeloId: modelo.id,
      data: agora.toISOString().slice(0, 10),
      hora: agora.toTimeString().slice(0, 5),
      equipamentoId: equipamento.id,
      prefixo: equipamento.prefixo,
      responsavel,
      itens,
      observacao: observacao.trim() || undefined,
      criadoEm: agora.toISOString(),
    });
    setPreenchendo(false);
  };

  const historico = useMemo(
    () => [...checklists].sort((a, b) => `${b.data}${b.hora}`.localeCompare(`${a.data}${a.hora}`)).slice(0, 30),
    [checklists],
  );

  const criticosPendentes = itensCriticosReprovados(itens).length;

  return (
    <div id="checklist-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Checklist"
        description="Inspeção do equipamento antes da operação. Item crítico reprovado abre ordem de serviço na hora."
        actions={podeEditar ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditandoModelo(true)} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700">Itens do checklist</button>
            <button type="button" onClick={iniciar} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-800">
              <Plus className="h-4 w-4" /> Novo checklist
            </button>
          </div>
        ) : undefined}
      />

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {historico.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="Nenhum checklist registrado" description="Comece um checklist antes da saída do equipamento." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {historico.map(item => {
              const resumo = resumoChecklist(item.itens);
              return (
                <li key={item.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="font-mono text-sm font-black text-slate-900">{item.prefixo}</strong>
                      <span className="text-xs text-slate-500">{formatarData(item.data)} · {item.hora}</span>
                      {item.ordemServicoNumero && <Badge tone="danger">{item.ordemServicoNumero}</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{item.responsavel}{item.observacao ? ` · ${item.observacao}` : ''}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5 text-[10px] font-bold">
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">{resumo.ok} OK</span>
                    {resumo.atencao > 0 && <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800">{resumo.atencao} atenção</span>}
                    {resumo.naoConforme > 0 && <span className="rounded-full bg-rose-50 px-2 py-1 text-rose-700">{resumo.naoConforme} não conforme</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <input ref={inputFoto} type="file" accept="image/*" capture="environment" hidden onChange={event => receberFoto(event.target.files?.[0])} />

      <Modal
        open={preenchendo}
        title="Checklist do equipamento"
        size="lg"
        onClose={() => setPreenchendo(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-bold text-slate-500">
              {criticosPendentes > 0 ? `${criticosPendentes} item(ns) crítico(s) reprovado(s) — abrirá OS` : 'Nenhum item crítico reprovado'}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPreenchendo(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
              <button type="button" onClick={salvar} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Salvar checklist</button>
            </div>
          </div>
        )}
      >
        <label className="block text-xs font-bold text-slate-600">
          Equipamento
          <select
            value={equipamentoId}
            onChange={event => setEquipamentoId(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500"
          >
            <option value="">Selecione</option>
            {[...equipamentos]
              .sort((a, b) => a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true }))
              .map(item => <option key={item.id} value={item.id}>{item.prefixo} · {item.nome}</option>)}
          </select>
        </label>

        <ul className="mt-4 space-y-3">
          {itens.map(item => (
            <li key={item.itemId} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-slate-800">
                  {item.descricao}
                  {item.critico && <span className="ml-1.5 text-[10px] font-black uppercase text-rose-600">crítico</span>}
                </p>
                <button type="button" onClick={() => pedirFoto(item.itemId)} aria-label={`Foto de ${item.descricao}`} className={`shrink-0 rounded-lg border p-2 transition-colors ${item.foto ? 'border-emerald-500 text-emerald-700' : 'border-slate-200 text-slate-400 hover:border-emerald-500'}`}>
                  <Camera className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {RESPOSTAS.map(resposta => (
                  <button
                    key={resposta}
                    type="button"
                    onClick={() => responder(item.itemId, resposta)}
                    aria-pressed={item.resposta === resposta}
                    className={`min-h-11 rounded-lg border text-[11px] font-bold transition-colors ${item.resposta === resposta ? respostaClass[resposta] : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                  >
                    {resposta}
                  </button>
                ))}
              </div>
              {(item.resposta === 'Não conforme' || item.resposta === 'Atenção') && (
                <input
                  value={item.observacao || ''}
                  onChange={event => anotar(item.itemId, event.target.value)}
                  placeholder={item.resposta === 'Não conforme' ? 'Descreva o problema (obrigatório)' : 'O que observar'}
                  className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500"
                />
              )}
              {item.foto && <img src={item.foto} alt={`Evidência de ${item.descricao}`} className="mt-2 h-24 rounded-lg border border-slate-200 object-cover" />}
            </li>
          ))}
        </ul>

        <label className="mt-4 block text-xs font-bold text-slate-600">
          Observação geral
          <textarea value={observacao} onChange={event => setObservacao(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500" />
        </label>

        {erro && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-700">{erro}</p>}
      </Modal>

      <Modal
        open={editandoModelo}
        title="Itens do checklist"
        description="Vale para todos os próximos checklists."
        onClose={() => setEditandoModelo(false)}
        footer={<button type="button" onClick={() => setEditandoModelo(false)} className="min-h-11 w-full rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800 sm:w-auto">Concluir</button>}
      >
        <ul className="space-y-2">
          {itensDoModelo.map(item => (
            <li key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
              <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{item.descricao}</span>
              <label className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={item.critico}
                  onChange={event => onSaveModelo({
                    ...modelo,
                    itens: itensDoModelo.map(atual => atual.id === item.id ? { ...atual, critico: event.target.checked } : atual),
                    atualizadoEm: new Date().toISOString(),
                  })}
                  className="size-4 accent-emerald-600"
                />
                crítico
              </label>
              <button
                type="button"
                aria-label={`Remover ${item.descricao}`}
                onClick={() => onSaveModelo({ ...modelo, itens: itensDoModelo.filter(atual => atual.id !== item.id), atualizadoEm: new Date().toISOString() })}
                className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            value={novoItem}
            onChange={event => setNovoItem(event.target.value)}
            placeholder="Novo item de inspeção"
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            disabled={!novoItem.trim()}
            onClick={() => {
              onSaveModelo({
                ...modelo,
                itens: [...itensDoModelo, { id: `item-${Date.now()}`, descricao: novoItem.trim(), critico: false }],
                atualizadoEm: new Date().toISOString(),
              });
              setNovoItem('');
            }}
            className="min-h-11 shrink-0 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            Adicionar
          </button>
        </div>
      </Modal>
    </div>
  );
}
