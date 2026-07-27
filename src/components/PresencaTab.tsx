import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Calendar, 
  Search, 
  Plus, 
  Trash2, 
  Edit, 
  Check, 
  X, 
  ExternalLink, 
  RefreshCw, 
  FileSpreadsheet, 
  UserCheck,
  UserX,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { Funcionario, ObraLocal, ListaPresenca, PresencaItem } from '../types';

interface PresencaTabProps {
  funcionarios: Funcionario[];
  obras: ObraLocal[];
  listasPresenca: ListaPresenca[];
  onSaveListaPresenca: (lista: ListaPresenca, isNew: boolean) => void;
  onDeleteListaPresenca: (id: string) => void;
}

export default function PresencaTab({
  funcionarios,
  obras,
  listasPresenca,
  onSaveListaPresenca,
  onDeleteListaPresenca
}: PresencaTabProps) {
  const [subTab, setSubTab] = useState<'presenca' | 'integracao'>('presenca');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState<{
    data: string;
    obraId: string;
    responsavel: string;
    observacoes: string;
    items: { [funcionarioId: string]: { presente: boolean; observacao: string } };
  }>({
    data: new Date().toISOString().split('T')[0],
    obraId: '',
    responsavel: '',
    observacoes: '',
    items: {}
  });

  // Filter states
  const [filterObra, setFilterObra] = useState<string>('todos');
  const [filterDataInicio, setFilterDataInicio] = useState<string>('');
  const [filterDataFim, setFilterDataFim] = useState<string>('');
  const [filterFaixaPresenca, setFilterFaixaPresenca] = useState<string>('todos');

  const handleOpenCreate = () => {
    // Pre-populate items with all active employees marked as Present
    const initialItems: { [funcionarioId: string]: { presente: boolean; observacao: string } } = {};
    funcionarios.filter(f => f.ativo).forEach(f => {
      initialItems[f.id] = { presente: true, observacao: '' };
    });

    setFormData({
      data: new Date().toISOString().split('T')[0],
      obraId: obras[0]?.id || '',
      responsavel: '',
      observacoes: '',
      items: initialItems
    });
    setEditingId(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (lista: ListaPresenca) => {
    const items: { [funcionarioId: string]: { presente: boolean; observacao: string } } = {};
    
    // First, map existing statuses
    lista.funcionarios.forEach(item => {
      items[item.funcionarioId] = { presente: item.presente, observacao: item.observacao || '' };
    });

    // Populate missing active employees as present just in case
    funcionarios.filter(f => f.ativo).forEach(f => {
      if (!items[f.id]) {
        items[f.id] = { presente: true, observacao: '' };
      }
    });

    setFormData({
      data: lista.data,
      obraId: lista.obraId,
      responsavel: lista.responsavel,
      observacoes: lista.observacoes || '',
      items
    });
    setEditingId(lista.id);
    setIsFormOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.obraId) {
      alert('Selecione uma obra para registrar a lista.');
      return;
    }

    const itemsArray: PresencaItem[] = Object.entries(formData.items).map(([funcionarioId, itemData]) => {
      const data = itemData as { presente: boolean; observacao: string };
      return {
        funcionarioId,
        presente: data.presente,
        observacao: data.observacao
      };
    });

    const finalObject: ListaPresenca = {
      id: editingId || `pre-${Date.now()}`,
      data: formData.data,
      obraId: formData.obraId,
      responsavel: formData.responsavel,
      funcionarios: itemsArray,
      observacoes: formData.observacoes
    };

    onSaveListaPresenca(finalObject, editingId === null);
    setIsFormOpen(false);
    setEditingId(null);
  };

  // Filtered lists
  const filteredListas = listasPresenca.filter(lista => {
    // Obra filter
    if (filterObra !== 'todos' && lista.obraId !== filterObra) return false;

    // Date range filter
    if (filterDataInicio && lista.data < filterDataInicio) return false;
    if (filterDataFim && lista.data > filterDataFim) return false;

    // Presence range filter
    if (filterFaixaPresenca !== 'todos') {
      const total = lista.funcionarios.length;
      const presentes = lista.funcionarios.filter(f => f.presente).length;
      const perc = total > 0 ? (presentes / total) * 100 : 0;
      if (filterFaixaPresenca === 'alta' && perc < 85) return false;
      if (filterFaixaPresenca === 'media' && (perc < 50 || perc >= 85)) return false;
      if (filterFaixaPresenca === 'baixa' && perc >= 50) return false;
    }

    // Search query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const obra = obras.find(o => o.id === lista.obraId)?.nome.toLowerCase() || '';
      const resp = lista.responsavel.toLowerCase();
      const obs = (lista.observacoes || '').toLowerCase();
      return obra.includes(q) || resp.includes(q) || obs.includes(q) || lista.data.includes(q);
    }

    return true;
  }).sort((a, b) => b.data.localeCompare(a.data));

  const clearFilters = () => {
    setFilterObra('todos');
    setFilterDataInicio('');
    setFilterDataFim('');
    setFilterFaixaPresenca('todos');
    setSearchQuery('');
  };

  const hasActiveFilters = filterObra !== 'todos' || filterDataInicio !== '' || filterDataFim !== '' || filterFaixaPresenca !== 'todos' || searchQuery !== '';

  return (
    <div className="space-y-6" id="manutencao-tab-root">
      {/* Tab Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-850 p-6 rounded-3xl shadow-xl">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400" />
            Controle de Presença
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gerencie o diário de presença dos funcionários por canteiro de obra.
          </p>
        </div>

        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-center">
          <button
            onClick={() => setSubTab('presenca')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === 'presenca' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Listas de Presença
          </button>
          <button
            onClick={() => setSubTab('integracao')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === 'integracao' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            Integração externa
          </button>
        </div>
      </div>

      {/* RENDER VIEW: LISTAS DE PRESENÇA */}
      {subTab === 'presenca' && (
        <div className="space-y-6">
          {!isFormOpen ? (
            <>
              {/* Toolbar */}
              <div className="flex flex-col md:flex-row md:items-center gap-4 bg-slate-900 border border-slate-850 p-4 rounded-2xl">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-600" />
                  <input
                    type="text"
                    placeholder="Filtrar por data, obra, responsável ou observação..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={filterObra}
                    onChange={(e) => setFilterObra(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                  >
                    <option value="todos">Todas as Obras</option>
                    {obras.map(o => (
                      <option key={o.id} value={o.id}>{o.nome}</option>
                    ))}
                  </select>

                  <input
                    type="date"
                    value={filterDataInicio}
                    onChange={(e) => setFilterDataInicio(e.target.value)}
                    title="Data inicial"
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                  />
                  <span className="text-slate-700 text-xs">até</span>
                  <input
                    type="date"
                    value={filterDataFim}
                    onChange={(e) => setFilterDataFim(e.target.value)}
                    title="Data final"
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                  />

                  <select
                    value={filterFaixaPresenca}
                    onChange={(e) => setFilterFaixaPresenca(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                  >
                    <option value="todos">Qualquer % Presença</option>
                    <option value="alta">Alta (≥ 85%)</option>
                    <option value="media">Média (50–84%)</option>
                    <option value="baixa">Baixa (&lt; 50%)</option>
                  </select>

                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-[11px] font-bold text-rose-400 hover:underline cursor-pointer"
                    >
                      Limpar filtros
                    </button>
                  )}

                  <button
                    onClick={handleOpenCreate}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer ml-auto"
                  >
                    <Plus className="w-4 h-4" />
                    Registrar Presença
                  </button>
                </div>
              </div>

              <div className="text-[10px] text-slate-600 font-mono px-1">
                {filteredListas.length} diário{filteredListas.length !== 1 ? 's' : ''} encontrado{filteredListas.length !== 1 ? 's' : ''}
              </div>

              {/* Attendance Sheets Table */}
              <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-lg">
                {filteredListas.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 space-y-3">
                    <Users className="w-10 h-10 text-slate-700 mx-auto" />
                    <div>
                      <p className="text-sm font-semibold text-slate-400">Nenhum diário de presença cadastrado</p>
                      <p className="text-xs text-slate-500 mt-1">Crie um novo diário ou ative a sincronização em tempo real na aba ao lado.</p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase bg-slate-950/40">
                          <th className="py-3.5 px-4 font-semibold">Data</th>
                          <th className="py-3.5 px-4 font-semibold">Obra</th>
                          <th className="py-3.5 px-4 font-semibold">Responsável</th>
                          <th className="py-3.5 px-4 font-semibold text-center">Presenças / Total</th>
                          <th className="py-3.5 px-4 font-semibold">Observações</th>
                          <th className="py-3.5 px-4 font-semibold text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {filteredListas.map((lista) => {
                          const obra = obras.find(o => o.id === lista.obraId);
                          const total = lista.funcionarios.length;
                          const presentes = lista.funcionarios.filter(f => f.presente).length;
                          const perc = total > 0 ? Math.round((presentes / total) * 100) : 0;

                          return (
                            <tr key={lista.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="py-3.5 px-4 font-bold text-slate-200">
                                <span className="flex items-center gap-2">
                                  <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                                  {new Date(lista.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-300 font-medium">
                                {obra ? obra.nome : 'Obra não identificada'}
                              </td>
                              <td className="py-3.5 px-4 text-slate-400">
                                {lista.responsavel}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <div className="inline-flex flex-col items-center">
                                  <span className="font-mono font-bold text-slate-200">
                                    {presentes} / {total}
                                  </span>
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full mt-1 ${
                                    perc >= 85 ? 'bg-emerald-500/10 text-emerald-400' :
                                    perc >= 50 ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
                                  }`}>
                                    {perc}% Presentes
                                  </span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-slate-400 max-w-xs truncate">
                                {lista.observacoes || <span className="italic text-slate-600">Sem observações</span>}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleOpenEdit(lista)}
                                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                                    title="Editar Presença"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm('Tem certeza que deseja apagar este diário de presença?')) {
                                        onDeleteListaPresenca(lista.id);
                                      }
                                    }}
                                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                                    title="Excluir Presença"
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
            /* FORM TO CREATE/EDIT ATTENDANCE LIST */
            <motion.form 
              onSubmit={handleSave}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 border border-slate-850 p-6 rounded-3xl shadow-xl space-y-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  {editingId ? '✏️ Editar Controle de Presença' : '➕ Novo Controle de Presença'}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-1.5 bg-slate-950 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Metadata Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Data do Diário</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-500" />
                    <input
                      type="date"
                      required
                      value={formData.data}
                      onChange={(e) => setFormData(prev => ({ ...prev, data: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Obra de Lotação</label>
                  <select
                    required
                    value={formData.obraId}
                    onChange={(e) => setFormData(prev => ({ ...prev, obraId: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer h-[38px]"
                  >
                    <option value="" disabled>Selecione a Obra...</option>
                    {obras.map(o => (
                      <option key={o.id} value={o.id}>{o.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Apontador / Responsável</label>
                  <input
                    type="text"
                    required
                    placeholder="Nome do responsável"
                    value={formData.responsavel}
                    onChange={(e) => setFormData(prev => ({ ...prev, responsavel: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Employee Attendance Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">Lista de Funcionários Ativos</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...formData.items };
                        Object.keys(updated).forEach(id => {
                          updated[id].presente = true;
                        });
                        setFormData(prev => ({ ...prev, items: updated }));
                      }}
                      className="text-[10px] font-bold text-emerald-400 hover:underline cursor-pointer"
                    >
                      Marcar Todos Presentes
                    </button>
                    <span className="text-slate-700">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...formData.items };
                        Object.keys(updated).forEach(id => {
                          updated[id].presente = false;
                        });
                        setFormData(prev => ({ ...prev, items: updated }));
                      }}
                      className="text-[10px] font-bold text-rose-400 hover:underline cursor-pointer"
                    >
                      Marcar Todos Ausentes
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/60 font-mono text-[9px] uppercase text-slate-500">
                        <th className="py-2.5 px-4 font-semibold">Funcionário</th>
                        <th className="py-2.5 px-4 font-semibold">Cargo</th>
                        <th className="py-2.5 px-4 font-semibold text-center">Frequência</th>
                        <th className="py-2.5 px-4 font-semibold">Observação Individual</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {funcionarios.filter(f => f.ativo).map(func => {
                        const state = formData.items[func.id] || { presente: true, observacao: '' };
                        return (
                          <tr key={func.id} className="hover:bg-slate-900/40">
                            <td className="py-2.5 px-4 font-bold text-slate-200">
                              {func.nome}
                            </td>
                            <td className="py-2.5 px-4 text-slate-400">
                              {func.cargo}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <div className="inline-flex rounded-lg overflow-hidden border border-slate-800 bg-slate-900 p-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormData(prev => {
                                      const updated = { ...prev.items };
                                      updated[func.id] = { ...state, presente: true };
                                      return { ...prev, items: updated };
                                    });
                                  }}
                                  className={`px-3 py-1 text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer ${
                                    state.presente 
                                      ? 'bg-emerald-600 text-white shadow-sm rounded-md' 
                                      : 'text-slate-500 hover:text-slate-300'
                                  }`}
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  PRESENTE
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormData(prev => {
                                      const updated = { ...prev.items };
                                      updated[func.id] = { ...state, presente: false };
                                      return { ...prev, items: updated };
                                    });
                                  }}
                                  className={`px-3 py-1 text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer ${
                                    !state.presente 
                                      ? 'bg-rose-600 text-white shadow-sm rounded-md' 
                                      : 'text-slate-500 hover:text-slate-300'
                                  }`}
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  AUSENTE
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 px-4">
                              <input
                                type="text"
                                placeholder="ex: Atestado, atraso..."
                                value={state.observacao}
                                onChange={(e) => {
                                  setFormData(prev => {
                                    const updated = { ...prev.items };
                                    updated[func.id] = { ...state, observacao: e.target.value };
                                    return { ...prev, items: updated };
                                  });
                                }}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* General Observations */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Observações Gerais</label>
                <textarea
                  rows={2}
                  placeholder="Observações importantes do dia (clima, ocorrências, atrasos)"
                  value={formData.observacoes}
                  onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
                />
              </div>

              {/* Submit / Cancel Buttons */}
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
                  Salvar Presenças
                </button>
              </div>
            </motion.form>
          )}
        </div>
      )}

      {/* RENDER VIEW: INTEGRAÇÃO EXTERNA */}
      {subTab === 'integracao' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-4 shadow-md">
              <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Recepção segura de presenças
              </h3>

              <p className="text-xs text-slate-400 leading-relaxed">
                Os apontamentos enviados pelos links oficiais entram em uma fila protegida e são incorporados ao painel administrativo sem criar registros fictícios.
              </p>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">Modo de integração</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold font-mono text-emerald-400">Automático e validado</span>
                  </div>
                </div>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-300">ATIVO</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl text-center">
                  <span className="text-[9px] text-slate-500 font-mono block uppercase">Diários cadastrados</span>
                  <span className="text-xl font-extrabold text-white block mt-1 font-mono">{listasPresenca.length}</span>
                </div>
                <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl text-center">
                  <span className="text-[9px] text-slate-500 font-mono block uppercase">Dados simulados</span>
                  <span className="text-[10px] font-black text-emerald-400 block mt-2 font-mono">DESATIVADOS</span>
                </div>
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl text-xs leading-relaxed text-amber-200 flex gap-3">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Nenhum botão desta tela gera ou altera presenças. Registros somente entram por lançamento manual identificado ou pelos links oficiais validados.</span>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl shadow-lg space-y-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Aplicativo legado externo</p>
                <h3 className="mt-1 text-lg font-extrabold text-white">Consulta ao sistema anterior</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">O endereço abaixo permanece disponível apenas para consulta e transição. Ele não é tratado como fonte automática de dados deste painel.</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <span className="truncate text-[11px] font-mono text-slate-400">dynamic-manatee-66561d.netlify.app</span>
                <a
                  href="https://dynamic-manatee-66561d.netlify.app/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-emerald-400 hover:bg-slate-700 hover:text-emerald-300"
                >
                  Abrir em nova guia
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-850/60 p-4 rounded-xl text-slate-500 text-[10px] font-mono leading-relaxed flex gap-2">
              <AlertCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                A fila segura registra origem, horário do servidor e identificador de cada envio antes de incorporá-lo aos relatórios gerenciais.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
