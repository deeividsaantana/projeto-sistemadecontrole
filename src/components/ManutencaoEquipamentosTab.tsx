/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Wrench,
  Search,
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  Truck,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Filter,
  Gauge
} from 'lucide-react';
import { Equipamento, OrdemServico } from '../types';

interface ManutencaoEquipamentosTabProps {
  equipamentos: Equipamento[];
  ordensServico: OrdemServico[];
  onSaveOrdemServico: (item: OrdemServico, isNew: boolean) => void;
  onDeleteOrdemServico: (id: string) => void;
  onUpdateEquipamentoStatus: (equipamentoId: string, status: Equipamento['status']) => void;
}

const STATUS_OPTIONS: OrdemServico['status'][] = ['Aberta', 'Em Andamento', 'Aguardando Peça', 'Concluída', 'Cancelada'];
const TIPO_OPTIONS: OrdemServico['tipo'][] = ['Preventiva', 'Corretiva', 'Preditiva', 'Revisão'];
const PRIORIDADE_OPTIONS: OrdemServico['prioridade'][] = ['Baixa', 'Média', 'Alta', 'Urgente'];

const STATUS_STYLE: Record<OrdemServico['status'], string> = {
  'Aberta': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Em Andamento': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Aguardando Peça': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Concluída': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Cancelada': 'bg-slate-500/10 text-slate-400 border-slate-500/20'
};

const PRIORIDADE_STYLE: Record<OrdemServico['prioridade'], string> = {
  'Baixa': 'bg-slate-800 text-slate-400',
  'Média': 'bg-blue-500/10 text-blue-400',
  'Alta': 'bg-amber-500/10 text-amber-400',
  'Urgente': 'bg-rose-500/10 text-rose-400'
};

function gerarNumeroOS(ordens: OrdemServico[]): string {
  const max = ordens.reduce((acc, os) => {
    const match = os.numero.match(/(\d+)$/);
    const n = match ? parseInt(match[1], 10) : 0;
    return Math.max(acc, n);
  }, 0);
  return `OS-${String(max + 1).padStart(4, '0')}`;
}

export default function ManutencaoEquipamentosTab({
  equipamentos,
  ordensServico,
  onSaveOrdemServico,
  onDeleteOrdemServico,
  onUpdateEquipamentoStatus
}: ManutencaoEquipamentosTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [filterPrioridade, setFilterPrioridade] = useState<string>('todos');
  const [filterEquipamentoId, setFilterEquipamentoId] = useState<string>('todos');

  // Form state
  const [formData, setFormData] = useState<Omit<OrdemServico, 'id' | 'numero'>>({
    equipamentoId: '',
    tipo: 'Corretiva',
    prioridade: 'Média',
    descricao: '',
    status: 'Aberta',
    dataAbertura: new Date().toISOString().split('T')[0],
    dataConclusao: '',
    responsavel: '',
    custoEstimado: undefined,
    custoFinal: undefined,
    observacao: ''
  });

  const handleOpenCreate = (equipamentoIdPreSelecionado?: string) => {
    setFormData({
      equipamentoId: equipamentoIdPreSelecionado || '',
      tipo: 'Corretiva',
      prioridade: 'Média',
      descricao: '',
      status: 'Aberta',
      dataAbertura: new Date().toISOString().split('T')[0],
      dataConclusao: '',
      responsavel: '',
      custoEstimado: undefined,
      custoFinal: undefined,
      observacao: ''
    });
    setEditingId(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (os: OrdemServico) => {
    setFormData({
      equipamentoId: os.equipamentoId,
      tipo: os.tipo,
      prioridade: os.prioridade,
      descricao: os.descricao,
      status: os.status,
      dataAbertura: os.dataAbertura,
      dataConclusao: os.dataConclusao || '',
      responsavel: os.responsavel,
      custoEstimado: os.custoEstimado,
      custoFinal: os.custoFinal,
      observacao: os.observacao
    });
    setEditingId(os.id);
    setIsFormOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.equipamentoId) {
      alert('Selecione um equipamento para a Ordem de Serviço.');
      return;
    }

    const finalObject: OrdemServico = {
      id: editingId || `os-${Date.now()}`,
      numero: editingId
        ? ordensServico.find(o => o.id === editingId)?.numero || gerarNumeroOS(ordensServico)
        : gerarNumeroOS(ordensServico),
      ...formData
    };

    onSaveOrdemServico(finalObject, editingId === null);

    // Reflete o status da OS automaticamente no cadastro do equipamento,
    // mantendo o painel de frota e o dashboard sempre coerentes.
    if (finalObject.status === 'Aberta' || finalObject.status === 'Em Andamento' || finalObject.status === 'Aguardando Peça') {
      onUpdateEquipamentoStatus(finalObject.equipamentoId, 'Manutenção');
    } else if (finalObject.status === 'Concluída') {
      onUpdateEquipamentoStatus(finalObject.equipamentoId, 'Ativo');
    }

    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleQuickStatusChange = (os: OrdemServico, status: OrdemServico['status']) => {
    const updated: OrdemServico = {
      ...os,
      status,
      dataConclusao: status === 'Concluída' ? new Date().toISOString().split('T')[0] : os.dataConclusao
    };
    onSaveOrdemServico(updated, false);

    if (status === 'Aberta' || status === 'Em Andamento' || status === 'Aguardando Peça') {
      onUpdateEquipamentoStatus(os.equipamentoId, 'Manutenção');
    } else if (status === 'Concluída') {
      onUpdateEquipamentoStatus(os.equipamentoId, 'Ativo');
    }
  };

  // Filtered & searched list
  const filteredOrdens = ordensServico.filter(os => {
    if (filterStatus !== 'todos' && os.status !== filterStatus) return false;
    if (filterTipo !== 'todos' && os.tipo !== filterTipo) return false;
    if (filterPrioridade !== 'todos' && os.prioridade !== filterPrioridade) return false;
    if (filterEquipamentoId !== 'todos' && os.equipamentoId !== filterEquipamentoId) return false;

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const eq = equipamentos.find(e => e.id === os.equipamentoId);
      const eqLabel = eq ? `${eq.prefixo} ${eq.nome}`.toLowerCase() : '';
      return (
        os.numero.toLowerCase().includes(q) ||
        os.descricao.toLowerCase().includes(q) ||
        os.responsavel.toLowerCase().includes(q) ||
        eqLabel.includes(q)
      );
    }

    return true;
  }).sort((a, b) => b.dataAbertura.localeCompare(a.dataAbertura));

  const openCount = ordensServico.filter(o => o.status === 'Aberta' || o.status === 'Em Andamento' || o.status === 'Aguardando Peça').length;
  const urgentCount = ordensServico.filter(o => o.prioridade === 'Urgente' && o.status !== 'Concluída' && o.status !== 'Cancelada').length;

  const clearFilters = () => {
    setFilterStatus('todos');
    setFilterTipo('todos');
    setFilterPrioridade('todos');
    setFilterEquipamentoId('todos');
    setSearchQuery('');
  };

  const hasActiveFilters = filterStatus !== 'todos' || filterTipo !== 'todos' || filterPrioridade !== 'todos' || filterEquipamentoId !== 'todos' || searchQuery !== '';

  return (
    <div className="space-y-6" id="manutencao-equipamentos-tab-root">
      {/* Tab Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-850 p-6 rounded-3xl shadow-xl">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Wrench className="w-6 h-6 text-emerald-400" />
            Manutenção de Equipamentos
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gerencie ordens de serviço, status de manutenção e histórico da frota.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-[11px] font-bold text-slate-300 font-mono">{openCount} OS Abertas</span>
          </div>
          {urgentCount > 0 && (
            <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-[11px] font-bold text-rose-400 font-mono">{urgentCount} Urgentes</span>
            </div>
          )}
        </div>
      </div>

      {!isFormOpen ? (
        <>
          {/* Toolbar + Filtros completos */}
          <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-600" />
                <input
                  type="text"
                  placeholder="Buscar por OS, equipamento, descrição ou responsável..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <button
                onClick={() => handleOpenCreate()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Nova Ordem de Serviço
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <span className="text-[10px] font-bold text-slate-500 font-mono uppercase flex items-center gap-1.5 mr-1">
                <Filter className="w-3.5 h-3.5" />
                Filtros:
              </span>

              <select
                value={filterEquipamentoId}
                onChange={(e) => setFilterEquipamentoId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="todos">Todos os Equipamentos</option>
                {equipamentos.map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.prefixo} — {eq.nome}</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="todos">Todos os Status</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="todos">Todos os Tipos</option>
                {TIPO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              <select
                value={filterPrioridade}
                onChange={(e) => setFilterPrioridade(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="todos">Todas as Prioridades</option>
                {PRIORIDADE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-[11px] font-bold text-rose-400 hover:underline cursor-pointer ml-1"
                >
                  Limpar filtros
                </button>
              )}

              <span className="text-[10px] text-slate-600 font-mono ml-auto">
                {filteredOrdens.length} resultado{filteredOrdens.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* OS Table */}
          <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-lg">
            {filteredOrdens.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-3">
                <Wrench className="w-10 h-10 text-slate-700 mx-auto" />
                <div>
                  <p className="text-sm font-semibold text-slate-400">Nenhuma ordem de serviço encontrada</p>
                  <p className="text-xs text-slate-500 mt-1">Crie uma nova OS ou ajuste os filtros acima.</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase bg-slate-950/40">
                      <th className="py-3.5 px-4 font-semibold">OS</th>
                      <th className="py-3.5 px-4 font-semibold">Equipamento</th>
                      <th className="py-3.5 px-4 font-semibold">Tipo</th>
                      <th className="py-3.5 px-4 font-semibold">Prioridade</th>
                      <th className="py-3.5 px-4 font-semibold">Abertura</th>
                      <th className="py-3.5 px-4 font-semibold">Status</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredOrdens.map((os) => {
                      const eq = equipamentos.find(e => e.id === os.equipamentoId);
                      return (
                        <tr key={os.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-emerald-400 font-mono">{os.numero}</td>
                          <td className="py-3.5 px-4 text-slate-300 font-medium">
                            <div className="flex items-center gap-1.5">
                              <Truck className="w-3.5 h-3.5 text-slate-500" />
                              <span>{eq ? `${eq.prefixo} — ${eq.nome}` : 'Equipamento removido'}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5 max-w-xs truncate">{os.descricao}</p>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400">{os.tipo}</td>
                          <td className="py-3.5 px-4">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${PRIORIDADE_STYLE[os.prioridade]}`}>
                              {os.prioridade}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-600" />
                              {new Date(os.dataAbertura + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <select
                              value={os.status}
                              onChange={(e) => handleQuickStatusChange(os, e.target.value as OrdemServico['status'])}
                              className={`text-[10px] font-black px-2 py-1 rounded-lg border cursor-pointer focus:outline-none ${STATUS_STYLE[os.status]}`}
                            >
                              {STATUS_OPTIONS.map(s => <option key={s} value={s} className="bg-slate-900 text-slate-200">{s}</option>)}
                            </select>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEdit(os)}
                                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                                title="Editar OS"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Tem certeza que deseja apagar a ${os.numero}?`)) {
                                    onDeleteOrdemServico(os.id);
                                  }
                                }}
                                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Excluir OS"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* FORM TO CREATE/EDIT OS */
        <motion.form
          onSubmit={handleSave}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 border border-slate-850 p-6 rounded-3xl shadow-xl space-y-6"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <Wrench className="w-5 h-5 text-emerald-400" />
              {editingId ? '✏️ Editar Ordem de Serviço' : '➕ Nova Ordem de Serviço'}
            </h2>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="p-1.5 bg-slate-950 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Equipamento</label>
              <select
                required
                value={formData.equipamentoId}
                onChange={(e) => setFormData(prev => ({ ...prev, equipamentoId: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer h-[38px]"
              >
                <option value="" disabled>Selecione o equipamento...</option>
                {equipamentos.map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.prefixo} — {eq.nome}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Responsável</label>
              <input
                type="text"
                required
                placeholder="Nome do mecânico/responsável"
                value={formData.responsavel}
                onChange={(e) => setFormData(prev => ({ ...prev, responsavel: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Tipo de Manutenção</label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value as OrdemServico['tipo'] }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer h-[38px]"
              >
                {TIPO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Prioridade</label>
              <select
                value={formData.prioridade}
                onChange={(e) => setFormData(prev => ({ ...prev, prioridade: e.target.value as OrdemServico['prioridade'] }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer h-[38px]"
              >
                {PRIORIDADE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Data de Abertura</label>
              <input
                type="date"
                required
                value={formData.dataAbertura}
                onChange={(e) => setFormData(prev => ({ ...prev, dataAbertura: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as OrdemServico['status'] }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer h-[38px]"
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {formData.status === 'Concluída' && (
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Data de Conclusão</label>
                <input
                  type="date"
                  value={formData.dataConclusao}
                  onChange={(e) => setFormData(prev => ({ ...prev, dataConclusao: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Custo Estimado (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={formData.custoEstimado ?? ''}
                onChange={(e) => setFormData(prev => ({ ...prev, custoEstimado: e.target.value ? Number(e.target.value) : undefined }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Descrição do Problema / Serviço</label>
            <textarea
              rows={2}
              required
              placeholder="Descreva o problema relatado ou o serviço a ser realizado"
              value={formData.descricao}
              onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Observações</label>
            <textarea
              rows={2}
              placeholder="Peças trocadas, observações técnicas, etc."
              value={formData.observacao}
              onChange={(e) => setFormData(prev => ({ ...prev, observacao: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Salvar Ordem de Serviço
            </button>
          </div>
        </motion.form>
      )}
    </div>
  );
}
