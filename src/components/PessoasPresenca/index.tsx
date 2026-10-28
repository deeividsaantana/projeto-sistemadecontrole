/**
 * COMPONENTE RAIZ: Pessoas & Presença
 * 
 * Módulo unificado que combina:
 * - ControlePresencaTab (gestão de equipes + presença)
 * - ColaboradoresTab (ficha individual)
 * 
 * Arquitetura:
 * - Zustand store para estado compartilhado
 * - React Router para URL routing
 * - Lazy load das visões (code splitting)
 * - Filtros globais compartilhados
 */

import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { usePessoasPresencaStore } from './store';
import { Search, Filter } from 'lucide-react';
import type {
  Empresa,
  Funcionario,
  GrupoEquipe,
  PresencaApontamento,
  HistoricoPresenca,
  ControleEquipamentoDiario,
  TicketJazida,
  ChecklistEquipamento,
  ObraLocal,
  PresencaStatus,
} from '../../types';

// ==================== LAZY LOAD DAS VISÕES ====================

const PainelView = lazy(() => import('./views/PainelView'));
const EquipesView = lazy(() => import('./views/EquipesView'));
const ColaboradoresView = lazy(() => import('./views/ColaboradoresView'));

// ==================== PROPS ====================

interface PessoasPresencaProps {
  // Dados
  empresas: Empresa[];
  funcionarios: Funcionario[];
  obras: ObraLocal[];
  canteiros?: readonly string[];
  gruposEquipe: GrupoEquipe[];
  presencasLink: PresencaApontamento[];
  historicoPresencas: HistoricoPresenca[];
  presencasInativas?: PresencaApontamento[];
  controlesEquipamentos: ControleEquipamentoDiario[];
  ticketsJazida: TicketJazida[];
  checklists?: ChecklistEquipamento[];
  
  // Callbacks
  onSaveGrupoEquipe: (grupo: GrupoEquipe, isNew: boolean) => void;
  onDeleteGrupoEquipe?: (id: string) => void;
  onUpdatePresencaLink: (id: string, status: PresencaStatus, observacao: string, motivo: string) => void;
  onLancarPresencaManual?: (
    grupo: GrupoEquipe,
    data: string,
    situacoes: Array<{ funcionarioId: string; status: PresencaStatus }>,
    observacaoDia: string
  ) => void;
  onInativarPresencaLink?: (ids: string[]) => void;
  onReativarPresencaLink?: (ids: string[]) => void;
  onResetPresencaDia?: (grupoId: string, data: string) => Promise<{ success: boolean; message: string }>;
  onSyncEquipesPlanilha?: (
    funcionarios: Funcionario[],
    gruposEquipe: GrupoEquipe[],
    resumo: any
  ) => Promise<{ success: boolean; message: string }>;
  onRestorePresenceHistory?: () => Promise<{ success: boolean; message: string }>;
  onAlterarSituacao?: (proximo: Funcionario, descricao: string) => void;
  onNavigate: (tab: string) => void;
  podeAbrir?: (tab: string) => boolean;
  pendingPublicSubmissionsCount?: number;
  viewInicial?: string;
  responsavel?: string;
}

// ==================== COMPONENTE ====================

export default function PessoasPresenca(props: PessoasPresencaProps) {
  const {
    setDados,
    globalSearch,
    setGlobalSearch,
    globalEmpresa,
    setGlobalEmpresa,
    globalSituacao,
    setGlobalSituacao,
  } = usePessoasPresencaStore();
  
  // Injeta dados no store quando props mudam
  useEffect(() => {
    setDados({
      empresas: props.empresas,
      funcionarios: props.funcionarios,
      gruposEquipe: props.gruposEquipe,
      presencasLink: props.presencasLink,
      historicoPresencas: props.historicoPresencas,
      controlesEquipamentos: props.controlesEquipamentos,
      ticketsJazida: props.ticketsJazida,
      checklists: props.checklists || [],
      obras: props.obras,
    });
  }, [
    props.empresas,
    props.funcionarios,
    props.gruposEquipe,
    props.presencasLink,
    props.historicoPresencas,
    props.controlesEquipamentos,
    props.ticketsJazida,
    props.checklists,
    props.obras,
    setDados,
  ]);
  
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header fixo */}
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Pessoas & Presença</h1>
            <p className="mt-1 text-sm text-slate-600">
              Gestão unificada de equipes, colaboradores e presença
            </p>
          </div>
        </div>
        
        {/* Navegação com URL routing */}
        <nav className="flex gap-2 border-b border-slate-200">
          <NavLink
            to="/pessoas/painel"
            end
            className={({ isActive }) =>
              `px-4 py-2.5 font-medium transition-colors ${
                isActive
                  ? 'border-b-2 border-emerald-600 text-emerald-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`
            }
          >
            📊 Painel
          </NavLink>
          <NavLink
            to="/pessoas/equipes"
            className={({ isActive }) =>
              `px-4 py-2.5 font-medium transition-colors ${
                isActive
                  ? 'border-b-2 border-emerald-600 text-emerald-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`
            }
          >
            👥 Equipes
          </NavLink>
          <NavLink
            to="/pessoas/colaboradores"
            className={({ isActive }) =>
              `px-4 py-2.5 font-medium transition-colors ${
                isActive
                  ? 'border-b-2 border-emerald-600 text-emerald-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`
            }
          >
            📋 Colaboradores
          </NavLink>
        </nav>
      </div>
      
      {/* Filtros globais (compartilhados entre todas visões) */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Busca */}
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="🔍 Buscar por nome, matrícula, função..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        
        {/* Filtro por empresa */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            value={globalEmpresa}
            onChange={(e) => setGlobalEmpresa(e.target.value)}
            className="appearance-none rounded-lg border border-slate-300 py-2.5 pl-10 pr-10 text-sm font-medium focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="todas">Todas empresas</option>
            {props.empresas.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.nome}</option>
            ))}
          </select>
        </div>
        
        {/* Filtro por situação */}
        <select
          value={globalSituacao}
          onChange={(e) => setGlobalSituacao(e.target.value as typeof globalSituacao)}
          className="appearance-none rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="Todas">Todas situações</option>
          <option value="ATIVO">Ativos</option>
          <option value="INATIVO">Inativos</option>
          <option value="FÉRIAS">Férias</option>
          <option value="AFASTADO">Afastados</option>
          <option value="DESMOBILIZADO">Desmobilizados</option>
        </select>
        
        {/* Limpar filtros */}
        {(globalSearch || globalEmpresa !== 'todas' || globalSituacao !== 'Todas') && (
          <button
            onClick={() => {
              setGlobalSearch('');
              setGlobalEmpresa('todas');
              setGlobalSituacao('Todas');
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Limpar filtros
          </button>
        )}
      </div>
      
      {/* Rotas com lazy load */}
      <Suspense 
        fallback={
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div>
              <p className="mt-3 text-sm text-slate-600">Carregando...</p>
            </div>
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Navigate to="/pessoas/painel" replace />} />
          <Route path="/painel" element={<PainelView />} />
          <Route 
            path="/equipes" 
            element={
              <EquipesView
                onSaveGrupoEquipe={props.onSaveGrupoEquipe}
                onDeleteGrupoEquipe={props.onDeleteGrupoEquipe}
                onLancarPresencaManual={props.onLancarPresencaManual}
              />
            } 
          />
          <Route 
            path="/colaboradores" 
            element={
              <ColaboradoresView
                onAlterarSituacao={props.onAlterarSituacao}
                onNavigate={props.onNavigate}
              />
            } 
          />
          <Route 
            path="/colaboradores/:id" 
            element={
              <ColaboradoresView
                onAlterarSituacao={props.onAlterarSituacao}
                onNavigate={props.onNavigate}
              />
            } 
          />
        </Routes>
      </Suspense>
    </div>
  );
}
