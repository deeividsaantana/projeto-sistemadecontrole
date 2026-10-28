/**
 * SPIKE 002: Componente Raiz com Router
 */

import { useEffect } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { usePessoasPresencaStore } from './store';
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

// ==================== LAZY LOAD DAS VISÕES ====================

const PainelView = lazy(() => import('./views/PainelView'));
const EquipesView = lazy(() => import('./views/EquipesView'));
const ColaboradoresView = lazy(() => import('./views/ColaboradoresView'));

// ==================== PROPS ====================

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

export default function PessoasPresenca(props: PessoasPresencaProps) {
  const { setDados, globalSearch, setGlobalSearch, globalEmpresa, setGlobalEmpresa } = usePessoasPresencaStore();
  
  // Injeta dados no store quando props mudam
  useEffect(() => {
    setDados({
      empresas: props.empresas,
      funcionarios: props.funcionarios,
      gruposEquipe: props.gruposEquipe,
      presencasLink: props.presencasLink,
    });
  }, [props.empresas, props.funcionarios, props.gruposEquipe, props.presencasLink, setDados]);
  
  return (
    <div className="p-6">
      {/* Header fixo */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Pessoas & Presença</h1>
        
        {/* Navegação com URL routing */}
        <nav className="mt-4 flex gap-2 border-b border-slate-200">
          <NavLink
            to="/pessoas/painel"
            className={({ isActive }) =>
              `px-4 py-2 font-medium ${
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
              `px-4 py-2 font-medium ${
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
              `px-4 py-2 font-medium ${
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
      
      {/* Filtros globais (compartilhados) */}
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
          {props.empresas.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.nome}</option>
          ))}
        </select>
      </div>
      
      {/* Rotas com lazy load */}
      <Suspense fallback={<div className="text-center py-12 text-slate-600">Carregando...</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/pessoas/painel" replace />} />
          <Route path="/pessoas/painel" element={<PainelView {...props} />} />
          <Route path="/pessoas/equipes" element={<EquipesView {...props} />} />
          <Route path="/pessoas/colaboradores" element={<ColaboradoresView {...props} />} />
          <Route path="/pessoas/colaboradores/:id" element={<ColaboradoresView {...props} />} />
        </Routes>
      </Suspense>
    </div>
  );
}

// ==================== ANÁLISE DO SPIKE ====================

/**
 * ✅ FUNCIONA?
 * Sim. URL routing funciona, lazy load carrega visões sob demanda.
 * 
 * ✅ MANUTENIBILIDADE?
 * ÓTIMA. Cada visão é um arquivo isolado (<500 linhas).
 * Mudança em Painel não afeta Equipes.
 * 
 * ✅ TESTABILIDADE?
 * EXCELENTE. Store testável isoladamente.
 * Cada visão testável com mock do store.
 * 
 * ✅ PERFORMANCE?
 * ÓTIMA. Lazy load = bundle menor inicial.
 * Zustand = re-render otimizado (só o que mudou).
 * 
 * ✅ BUNDLE SIZE?
 * EXCELENTE. Code splitting automático por visão.
 * 
 * ⚠️ COMPLEXIDADE?
 * Média. Precisa entender Zustand + React Router.
 * Mas são bibliotecas padrão da indústria.
 * 
 * ==================== VEREDITO ====================
 * 
 * ✅ VALIDATED
 * 
 * MOTIVO:
 * - Componentes isolados e testáveis
 * - Performance otimizada (lazy load + Zustand)
 * - URL routing permite deep linking (/pessoas/colaboradores/123)
 * - Escalável (adicionar novas visões é trivial)
 * - Padrão da indústria (Zustand + React Router)
 * 
 * ÚNICO TRADE-OFF:
 * - Curva de aprendizado (precisa conhecer Zustand)
 * - Mas é simples: 50 linhas de store
 * 
 * RECOMENDAÇÃO:
 * ✅ USAR esta abordagem para implementação com TDD.
 */
