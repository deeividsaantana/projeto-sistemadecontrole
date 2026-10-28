/**
 * SPIKE 001: Component Merger
 * 
 * Conceito: Mesclar ControlePresencaTab + ColaboradoresTab em 1 componente gigante
 * Risco: Manutenibilidade de ~3000 linhas
 */

import { useState, useMemo } from 'react';
import type { 
  Empresa, 
  Funcionario, 
  GrupoEquipe, 
  PresencaApontamento,
  HistoricoPresenca,
  ControleEquipamentoDiario,
  TicketJazida,
  PresencaStatus 
} from '../../src/types';

// Props unificadas (combinação de ambos componentes)
interface PessoasPresencaProps {
  // Dados
  empresas: Empresa[];
  funcionarios: Funcionario[];
  gruposEquipe: GrupoEquipe[];
  presencasLink: PresencaApontamento[];
  historicoPresencas: HistoricoPresenca[];
  controlesEquipamentos: ControleEquipamentoDiario[];
  ticketsJazida: TicketJazida[];
  
  // Callbacks
  onSaveGrupoEquipe: (grupo: GrupoEquipe, isNew: boolean) => void;
  onDeleteGrupoEquipe?: (id: string) => void;
  onUpdatePresencaLink: (id: string, status: PresencaStatus, observacao: string, motivo: string) => void;
  onAlterarSituacao?: (proximo: Funcionario, descricao: string) => void;
  onNavigate: (tab: string) => void;
}

// Abas principais
type MainView = 'painel' | 'equipes' | 'colaboradores';

export default function PessoasPresenca({
  empresas,
  funcionarios,
  gruposEquipe,
  presencasLink,
  historicoPresencas,
  controlesEquipamentos,
  ticketsJazida,
  onSaveGrupoEquipe,
  onDeleteGrupoEquipe,
  onUpdatePresencaLink,
  onAlterarSituacao,
  onNavigate,
}: PessoasPresencaProps) {
  // ==================== ESTADOS ====================
  
  // Navegação
  const [mainView, setMainView] = useState<MainView>('painel');
  
  // Filtros globais (compartilhados entre visões)
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalEmpresa, setGlobalEmpresa] = useState('todas');
  const [globalData, setGlobalData] = useState(new Date().toISOString().slice(0, 10));
  
  // Estado específico da visão Colaboradores
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState<string | null>(null);
  
  // Estado específico da visão Equipes
  const [equipeEditando, setEquipeEditando] = useState<string | null>(null);
  
  // ==================== MEMOS COMPARTILHADOS ====================
  
  // Funcionários filtrados (usado em TODAS visões)
  const funcionariosFiltrados = useMemo(() => {
    return funcionarios.filter(f => {
      const matchEmpresa = globalEmpresa === 'todas' || f.empresaId === globalEmpresa;
      const matchSearch = !globalSearch || 
        f.nome.toLowerCase().includes(globalSearch.toLowerCase()) ||
        f.matricula?.includes(globalSearch);
      return matchEmpresa && matchSearch;
    });
  }, [funcionarios, globalEmpresa, globalSearch]);
  
  // Equipes filtradas
  const equipesFiltradas = useMemo(() => {
    return gruposEquipe.filter(e => {
      const matchEmpresa = globalEmpresa === 'todas' || 
        e.funcionarioIds.some(id => {
          const func = funcionarios.find(f => f.id === id);
          return func?.empresaId === globalEmpresa;
        });
      return matchEmpresa;
    });
  }, [gruposEquipe, funcionarios, globalEmpresa]);
  
  // Métricas do Painel
  const metricas = useMemo(() => {
    const registrosHoje = presencasLink.filter(p => p.data === globalData);
    const presentes = registrosHoje.filter(p => p.status === 'Presente').length;
    const ausentes = registrosHoje.filter(p => p.status === 'Ausente').length;
    const totalEquipes = equipesFiltradas.length;
    const equipesEnviaram = new Set(registrosHoje.map(p => p.grupoId)).size;
    
    return { presentes, ausentes, totalEquipes, equipesEnviaram };
  }, [presencasLink, globalData, equipesFiltradas]);
  
  // ==================== RENDERIZAÇÃO CONDICIONAL ====================
  
  // 🔴 PROBLEMA: Toda lógica de cada visão fica AQUI (vai virar 3000 linhas)
  
  return (
    <div className="p-6">
      {/* Header com navegação */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Pessoas & Presença</h1>
        
        {/* Abas principais */}
        <div className="mt-4 flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setMainView('painel')}
            className={`px-4 py-2 font-medium ${
              mainView === 'painel'
                ? 'border-b-2 border-emerald-600 text-emerald-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📊 Painel
          </button>
          <button
            onClick={() => setMainView('equipes')}
            className={`px-4 py-2 font-medium ${
              mainView === 'equipes'
                ? 'border-b-2 border-emerald-600 text-emerald-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            👥 Equipes
          </button>
          <button
            onClick={() => setMainView('colaboradores')}
            className={`px-4 py-2 font-medium ${
              mainView === 'colaboradores'
                ? 'border-b-2 border-emerald-600 text-emerald-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📋 Colaboradores
          </button>
        </div>
      </div>
      
      {/* Filtros globais */}
      <div className="mb-6 flex gap-3">
        <input
          type="text"
          placeholder="🔍 Buscar..."
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2"
        />
        <select
          value={globalEmpresa}
          onChange={(e) => setGlobalEmpresa(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-2"
        >
          <option value="todas">Todas empresas</option>
          {empresas.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.nome}</option>
          ))}
        </select>
        {mainView === 'painel' && (
          <input
            type="date"
            value={globalData}
            onChange={(e) => setGlobalData(e.target.value)}
            className="rounded-lg border border-slate-300 px-4 py-2"
          />
        )}
      </div>
      
      {/* Conteúdo dinâmico por visão */}
      {mainView === 'painel' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Dashboard</h2>
          
          {/* Cards de métricas */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Presentes</p>
              <strong className="text-2xl font-black text-emerald-600">{metricas.presentes}</strong>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Ausentes</p>
              <strong className="text-2xl font-black text-rose-600">{metricas.ausentes}</strong>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Equipes</p>
              <strong className="text-2xl font-black text-slate-900">{metricas.totalEquipes}</strong>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Enviaram</p>
              <strong className="text-2xl font-black text-sky-600">{metricas.equipesEnviaram}</strong>
            </div>
          </div>
          
          {/* Lista de equipes pendentes */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h3 className="font-bold text-amber-900 mb-2">⚠️ Atenção agora</h3>
            <p className="text-sm text-amber-800">
              {metricas.totalEquipes - metricas.equipesEnviaram} equipes ainda não enviaram presença
            </p>
          </div>
        </div>
      )}
      
      {mainView === 'equipes' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Equipes ({equipesFiltradas.length})</h2>
          
          {/* Lista de equipes */}
          <div className="space-y-2">
            {equipesFiltradas.map(equipe => (
              <div key={equipe.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <strong className="font-bold text-slate-900">{equipe.nome}</strong>
                    <p className="text-sm text-slate-600">
                      Encarregado: {equipe.responsavel} · {equipe.funcionarioIds.length} membros
                    </p>
                  </div>
                  <button
                    onClick={() => setEquipeEditando(equipe.id)}
                    className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                  >
                    ✏️ Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {mainView === 'colaboradores' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Colaboradores ({funcionariosFiltrados.length})</h2>
          
          {/* Tabela de colaboradores */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Matrícula</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Função</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {funcionariosFiltrados.slice(0, 20).map(func => (
                  <tr
                    key={func.id}
                    onClick={() => setColaboradorSelecionado(func.id)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{func.nome}</td>
                    <td className="px-4 py-3 text-slate-600">{func.matricula || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{func.cargo}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">
                        {func.ativo ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Sidebar da ficha (se selecionado) */}
          {colaboradorSelecionado && (
            <div className="fixed right-0 top-0 h-screen w-96 border-l border-slate-200 bg-white p-6 shadow-xl">
              <button
                onClick={() => setColaboradorSelecionado(null)}
                className="mb-4 text-sm font-bold text-slate-600 hover:text-slate-900"
              >
                ← Voltar
              </button>
              <h3 className="text-xl font-bold text-slate-900">
                {funcionarios.find(f => f.id === colaboradorSelecionado)?.nome}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Matrícula: {funcionarios.find(f => f.id === colaboradorSelecionado)?.matricula}
              </p>
              {/* Aqui viriam os cards de presença, frota, etc */}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== ANÁLISE DO SPIKE ====================

/**
 * ✅ FUNCIONA?
 * Sim, protótipo renderiza e alterna entre visões.
 * 
 * ❌ MANUTENIBILIDADE?
 * PÉSSIMA. Este arquivo já tem ~300 linhas com funcionalidade MÍNIMA.
 * Com TODA lógica dos 2 componentes originais, chegaria em ~3500 linhas.
 * 
 * ⚠️ TESTABILIDADE?
 * DIFÍCIL. Lógica de cada visão está misturada no mesmo componente.
 * Testes precisariam mockar o componente inteiro.
 * 
 * ✅ PERFORMANCE?
 * OK. Filtros compartilhados evitam recálculo.
 * 
 * ❌ BUNDLE SIZE?
 * RUIM. Componente único = bundle carrega tudo de uma vez (sem lazy load).
 * 
 * ==================== VEREDITO ====================
 * 
 * ❌ REJECTED
 * 
 * MOTIVO:
 * Componente de 3500 linhas é IMPOSSÍVEL de manter.
 * - Qualquer mudança afeta tudo
 * - Difícil de testar isoladamente
 * - Merge conflicts constantes em equipe
 * - Impossível lazy load por visão
 * 
 * RECOMENDAÇÃO:
 * NÃO usar esta abordagem. Ir para Spike 002 (State + Router) ou 003 (Compound).
 */
