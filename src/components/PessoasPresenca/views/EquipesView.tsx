/**
 * VISÃO: Equipes
 * 
 * Gestão completa de equipes:
 * - Lista de equipes filtradas
 * - CRUD (Criar, Editar, Deletar)
 * - Modal de edição com busca de colaboradores
 * - Lançamento rápido de presença
 */

import { useState, useMemo } from 'react';
import { useFiltragemGlobal } from '../hooks/useFiltragemGlobal';
import { usePessoasPresencaStore } from '../store';
import { Users, Edit3, Trash2, Plus, X, Search } from 'lucide-react';
import type { GrupoEquipe, Funcionario, PresencaStatus } from '../../../types';

interface EquipesViewProps {
  onSaveGrupoEquipe: (grupo: GrupoEquipe, isNew: boolean) => void;
  onDeleteGrupoEquipe?: (id: string) => void;
  onLancarPresencaManual?: (
    grupo: GrupoEquipe,
    data: string,
    situacoes: Array<{ funcionarioId: string; status: PresencaStatus }>,
    observacaoDia: string
  ) => void;
}

export default function EquipesView({
  onSaveGrupoEquipe,
  onDeleteGrupoEquipe,
  onLancarPresencaManual,
}: EquipesViewProps) {
  const { equipesFiltradas } = useFiltragemGlobal();
  const { 
    funcionarios, 
    obras,
    equipeEditando, 
    setEquipeEditando, 
    gruposEquipe 
  } = usePessoasPresencaStore();
  
  const [buscaFuncionario, setBuscaFuncionario] = useState('');
  const [formData, setFormData] = useState<Partial<GrupoEquipe>>({});
  
  // Equipe sendo editada
  const equipeSelecionada = useMemo(() => {
    if (!equipeEditando || equipeEditando === 'nova') return null;
    return gruposEquipe.find(e => e.id === equipeEditando) || null;
  }, [equipeEditando, gruposEquipe]);
  
  // Funcionários disponíveis para adicionar
  const funcionariosDisponiveis = useMemo(() => {
    const termo = buscaFuncionario.toLowerCase();
    return funcionarios
      .filter(f => f.ativo)
      .filter(f => {
        if (!termo) return true;
        return (
          f.nome.toLowerCase().includes(termo) ||
          f.matricula?.toLowerCase().includes(termo) ||
          f.cargo.toLowerCase().includes(termo)
        );
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [funcionarios, buscaFuncionario]);
  
  // Handler de abertura de modal
  const handleNova = () => {
    setEquipeEditando('nova');
    setFormData({
      id: '',
      nome: '',
      responsavel: '',
      frenteServico: '',
      obraId: obras[0]?.id || '',
      funcionarioIds: [],
      funcionarioMatriculas: [],
      token: '',
      status: 'ativo',
      linkAtivo: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };
  
  const handleEditar = (equipe: GrupoEquipe) => {
    setEquipeEditando(equipe.id);
    setFormData(equipe);
  };
  
  const handleFechar = () => {
    setEquipeEditando(null);
    setFormData({});
    setBuscaFuncionario('');
  };
  
  // Handler de salvar
  const handleSalvar = () => {
    if (!formData.nome || !formData.responsavel) {
      alert('Preencha nome e encarregado');
      return;
    }
    
    const isNew = equipeEditando === 'nova';
    const grupo: GrupoEquipe = {
      id: isNew ? `equipe-${Date.now()}` : formData.id!,
      nome: formData.nome,
      responsavel: formData.responsavel,
      frenteServico: formData.frenteServico || '',
      obraId: formData.obraId || obras[0]?.id || '',
      funcionarioIds: formData.funcionarioIds || [],
      funcionarioMatriculas: formData.funcionarioMatriculas || [],
      token: formData.token || '',
      status: formData.status || 'ativo',
      linkAtivo: formData.linkAtivo !== false,
      createdAt: formData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    onSaveGrupoEquipe(grupo, isNew);
    handleFechar();
  };
  
  // Handler de adicionar/remover funcionário
  const toggleFuncionario = (func: Funcionario) => {
    const ids = formData.funcionarioIds || [];
    const matriculas = formData.funcionarioMatriculas || [];
    
    if (ids.includes(func.id)) {
      setFormData({
        ...formData,
        funcionarioIds: ids.filter(id => id !== func.id),
        funcionarioMatriculas: matriculas.filter(m => m !== func.matricula),
      });
    } else {
      setFormData({
        ...formData,
        funcionarioIds: [...ids, func.id],
        funcionarioMatriculas: func.matricula ? [...matriculas, func.matricula] : matriculas,
      });
    }
  };
  
  // Handler de deletar
  const handleDeletar = (equipe: GrupoEquipe) => {
    if (!onDeleteGrupoEquipe) return;
    
    if (confirm(`Tem certeza que deseja excluir a equipe "${equipe.nome}"?\n\nIsso irá remover TODOS os registros de presença associados!`)) {
      onDeleteGrupoEquipe(equipe.id);
    }
  };
  
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header - responsivo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">Equipes</h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            {equipesFiltradas.length} {equipesFiltradas.length === 1 ? 'equipe' : 'equipes'}
          </p>
        </div>
        
        <button
          onClick={handleNova}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600 px-3 sm:px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nova equipe</span>
          <span className="sm:hidden">Nova</span>
        </button>
      </div>
      
      {/* Lista de equipes - responsivo */}
      <div className="space-y-2 sm:space-y-3">
        {equipesFiltradas.length === 0 ? (
          <div className="rounded-lg sm:rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 sm:p-12 text-center">
            <Users className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-slate-400" />
            <h3 className="mt-3 sm:mt-4 text-sm sm:text-base font-bold text-slate-900">Nenhuma equipe encontrada</h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-600">
              Ajuste os filtros ou crie uma nova equipe
            </p>
          </div>
        ) : (
          equipesFiltradas.map(equipe => (
            <div key={equipe.id} className="rounded-lg sm:rounded-xl border border-slate-200 bg-white p-3 sm:p-5 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">{equipe.nome}</h3>
                    <span className={`inline-flex rounded-full px-2 sm:px-2.5 py-0.5 text-xs font-bold ${
                      equipe.status === 'ativo'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {equipe.status === 'ativo' ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                  
                  <div className="mt-1.5 sm:mt-2 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-x-4 sm:gap-y-1 text-xs sm:text-sm text-slate-600">
                    <span className="truncate">
                      <strong className="font-medium text-slate-900">Encarregado:</strong> {equipe.responsavel}
                    </span>
                    <span>
                      <strong className="font-medium text-slate-900">Membros:</strong> {equipe.funcionarioIds.length}
                    </span>
                    {equipe.frenteServico && (
                      <span className="truncate">
                        <strong className="font-medium text-slate-900">Frente:</strong> {equipe.frenteServico}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-1.5 sm:gap-2 shrink-0">
                  <button
                    onClick={() => handleEditar(equipe)}
                    className="rounded-lg border border-slate-300 bg-white p-1.5 sm:p-2 text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400/50"
                    title="Editar equipe"
                  >
                    <Edit3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                  
                  {onDeleteGrupoEquipe && (
                    <button
                      onClick={() => handleDeletar(equipe)}
                      className="rounded-lg border border-rose-300 bg-white p-1.5 sm:p-2 text-rose-700 transition-colors hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-400/50"
                      title="Excluir equipe"
                    >
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Modal de edição - responsivo */}
      {equipeEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="w-full h-full sm:h-auto sm:max-w-3xl sm:max-h-[90vh] overflow-y-auto sm:rounded-xl bg-white shadow-2xl">
            {/* Header do modal */}
            <div className="sticky top-0 border-b border-slate-200 bg-white px-4 sm:px-6 py-3 sm:py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {equipeEditando === 'nova' ? 'Nova Equipe' : 'Editar Equipe'}
                </h3>
                <button
                  onClick={handleFechar}
                  className="rounded-lg p-1.5 sm:p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>
            </div>
            
            {/* Corpo do modal - responsivo */}
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
              {/* Nome */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                  Nome da equipe *
                </label>
                <input
                  type="text"
                  value={formData.nome || ''}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Equipe 01 - Terraplenagem"
                  className="w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              
              {/* Encarregado */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                  Encarregado *
                </label>
                <input
                  type="text"
                  value={formData.responsavel || ''}
                  onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                  placeholder="Nome do encarregado"
                  className="w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              
              {/* Frente de Serviço */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                  Frente de Serviço
                </label>
                <input
                  type="text"
                  value={formData.frenteServico || ''}
                  onChange={(e) => setFormData({ ...formData, frenteServico: e.target.value })}
                  placeholder="Ex: Terraplenagem, Drenagem, Pavimentação"
                  className="w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2 sm:py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              
              {/* Membros */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  Membros da equipe ({formData.funcionarioIds?.length || 0})
                </label>
                
                {/* Busca de funcionários */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={buscaFuncionario}
                    onChange={(e) => setBuscaFuncionario(e.target.value)}
                    placeholder="Buscar por nome, matrícula ou função..."
                    className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                
                {/* Lista de funcionários */}
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                  {funcionariosDisponiveis.slice(0, 50).map(func => {
                    const selecionado = formData.funcionarioIds?.includes(func.id);
                    
                    return (
                      <button
                        key={func.id}
                        onClick={() => toggleFuncionario(func)}
                        className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                          selecionado
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <strong className="font-medium">{func.nome}</strong>
                            <p className="text-xs text-slate-600">
                              {func.matricula} · {func.cargo}
                            </p>
                          </div>
                          {selecionado && (
                            <div className="rounded-full bg-emerald-600 p-1">
                              <X className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* Footer do modal */}
            <div className="sticky bottom-0 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleFechar}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvar}
                  className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
                >
                  {equipeEditando === 'nova' ? 'Criar equipe' : 'Salvar alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
