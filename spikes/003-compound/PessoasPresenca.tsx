/**
 * SPIKE 003: Compound Component Pattern
 * 
 * Conceito: Componente raiz + Context interno + sub-componentes compostos
 * Inspirado em: Radix UI, Reach UI
 * Risco: Curva de aprendizado (padrão avançado)
 */

import { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import type { 
  Empresa, 
  Funcionario, 
  GrupoEquipe, 
  PresencaApontamento,
  PresencaStatus 
} from '../../src/types';

// ==================== CONTEXT INTERNO ====================

interface PessoasPresencaContextValue {
  // Dados
  empresas: Empresa[];
  funcionarios: Funcionario[];
  gruposEquipe: GrupoEquipe[];
  presencasLink: PresencaApontamento[];
  
  // Filtros compartilhados
  globalSearch: string;
  setGlobalSearch: (search: string) => void;
  globalEmpresa: string;
  setGlobalEmpresa: (empresa: string) => void;
  globalData: string;
  setGlobalData: (data: string) => void;
  
  // Dados computados
  funcionariosFiltrados: Funcionario[];
  equipesFiltradas: GrupoEquipe[];
  
  // Callbacks
  onSaveGrupoEquipe: (grupo: GrupoEquipe, isNew: boolean) => void;
  onDeleteGrupoEquipe?: (id: string) => void;
  onUpdatePresencaLink: (id: string, status: PresencaStatus, observacao: string, motivo: string) => void;
}

const PessoasPresencaContext = createContext<PessoasPresencaContextValue | null>(null);

function usePessoasPresenca() {
  const context = useContext(PessoasPresencaContext);
  if (!context) {
    throw new Error('Este componente deve ser usado dentro de <PessoasPresenca>');
  }
  return context;
}

// ==================== COMPONENTE RAIZ ====================

interface PessoasPresencaProps {
  children: ReactNode;
  empresas: Empresa[];
  funcionarios: Funcionario[];
  gruposEquipe: GrupoEquipe[];
  presencasLink: PresencaApontamento[];
  onSaveGrupoEquipe: (grupo: GrupoEquipe, isNew: boolean) => void;
  onDeleteGrupoEquipe?: (id: string) => void;
  onUpdatePresencaLink: (id: string, status: PresencaStatus, observacao: string, motivo: string) => void;
}

function PessoasPresencaRoot({ children, ...props }: PessoasPresencaProps) {
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalEmpresa, setGlobalEmpresa] = useState('todas');
  const [globalData, setGlobalData] = useState(new Date().toISOString().slice(0, 10));
  
  // Dados computados
  const funcionariosFiltrados = useMemo(() => {
    return props.funcionarios.filter(f => {
      const matchEmpresa = globalEmpresa === 'todas' || f.empresaId === globalEmpresa;
      const matchSearch = !globalSearch || 
        f.nome.toLowerCase().includes(globalSearch.toLowerCase()) ||
        f.matricula?.includes(globalSearch);
      return matchEmpresa && matchSearch;
    });
  }, [props.funcionarios, globalEmpresa, globalSearch]);
  
  const equipesFiltradas = useMemo(() => {
    return props.gruposEquipe.filter(e => {
      const matchEmpresa = globalEmpresa === 'todas' || 
        e.funcionarioIds.some(id => {
          const func = props.funcionarios.find(f => f.id === id);
          return func?.empresaId === globalEmpresa;
        });
      return matchEmpresa;
    });
  }, [props.gruposEquipe, props.funcionarios, globalEmpresa]);
  
  const value: PessoasPresencaContextValue = {
    empresas: props.empresas,
    funcionarios: props.funcionarios,
    gruposEquipe: props.gruposEquipe,
    presencasLink: props.presencasLink,
    globalSearch,
    setGlobalSearch,
    globalEmpresa,
    setGlobalEmpresa,
    globalData,
    setGlobalData,
    funcionariosFiltrados,
    equipesFiltradas,
    onSaveGrupoEquipe: props.onSaveGrupoEquipe,
    onDeleteGrupoEquipe: props.onDeleteGrupoEquipe,
    onUpdatePresencaLink: props.onUpdatePresencaLink,
  };
  
  return (
    <PessoasPresencaContext.Provider value={value}>
      <div className="p-6">
        {children}
      </div>
    </PessoasPresencaContext.Provider>
  );
}

// ==================== SUB-COMPONENTES ====================

// Header
function Header({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-slate-900">Pessoas & Presença</h1>
      {children}
    </div>
  );
}

// Filtros
function Filtros() {
  const { empresas, globalSearch, setGlobalSearch, globalEmpresa, setGlobalEmpresa } = usePessoasPresenca();
  
  return (
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
    </div>
  );
}

// Painel
function Painel() {
  const { presencasLink, globalData, equipesFiltradas } = usePessoasPresenca();
  
  const metricas = useMemo(() => {
    const registrosHoje = presencasLink.filter(p => p.data === globalData);
    const presentes = registrosHoje.filter(p => p.status === 'Presente').length;
    const ausentes = registrosHoje.filter(p => p.status === 'Ausente').length;
    const equipesEnviaram = new Set(registrosHoje.map(p => p.grupoId)).size;
    
    return { presentes, ausentes, totalEquipes: equipesFiltradas.length, equipesEnviaram };
  }, [presencasLink, globalData, equipesFiltradas]);
  
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Dashboard</h2>
      <div className="grid grid-cols-4 gap-4">
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
    </div>
  );
}

// Equipes
function Equipes() {
  const { equipesFiltradas, onSaveGrupoEquipe, onDeleteGrupoEquipe } = usePessoasPresenca();
  
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Equipes ({equipesFiltradas.length})</h2>
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
              <button className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-bold text-white">
                ✏️ Editar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Colaboradores
function Colaboradores() {
  const { funcionariosFiltrados } = usePessoasPresenca();
  const [selecionado, setSelecionado] = useState<string | null>(null);
  
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Colaboradores ({funcionariosFiltrados.length})</h2>
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Nome</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Matrícula</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Função</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {funcionariosFiltrados.slice(0, 20).map(func => (
              <tr key={func.id} onClick={() => setSelecionado(func.id)} className="cursor-pointer hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{func.nome}</td>
                <td className="px-4 py-3 text-slate-600">{func.matricula || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{func.cargo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== EXPORT COMPOUND ====================

export const PessoasPresenca = Object.assign(PessoasPresencaRoot, {
  Header,
  Filtros,
  Painel,
  Equipes,
  Colaboradores,
});

// ==================== USO ====================

/**
 * EXEMPLO DE USO:
 * 
 * <PessoasPresenca
 *   empresas={empresas}
 *   funcionarios={funcionarios}
 *   gruposEquipe={gruposEquipe}
 *   presencasLink={presencasLink}
 *   onSaveGrupoEquipe={handleSave}
 * >
 *   <PessoasPresenca.Header>
 *     <nav>Abas aqui</nav>
 *   </PessoasPresenca.Header>
 * 
 *   <PessoasPresenca.Filtros />
 * 
 *   {view === 'painel' && <PessoasPresenca.Painel />}
 *   {view === 'equipes' && <PessoasPresenca.Equipes />}
 *   {view === 'colaboradores' && <PessoasPresenca.Colaboradores />}
 * </PessoasPresenca>
 * 
 * ✅ FLEXÍVEL: Escolhe quais componentes renderizar
 * ✅ COMPOSIÇÃO: Fácil adicionar novos sub-componentes
 * ⚠️ CURVA: Padrão avançado, precisa conhecer Context + Compound Pattern
 */

// ==================== ANÁLISE ====================

/**
 * ✅ FUNCIONA?
 * Sim, padrão funciona perfeitamente.
 * 
 * ✅ MANUTENIBILIDADE?
 * BOA. Sub-componentes isolados no mesmo arquivo.
 * 
 * ⚠️ TESTABILIDADE?
 * MÉDIA. Precisa mockar Context em cada teste.
 * 
 * ✅ PERFORMANCE?
 * BOA. Context otimizado com useMemo.
 * 
 * ⚠️ BUNDLE SIZE?
 * MÉDIA. Sem lazy load automático (tudo num arquivo).
 * 
 * ⚠️ COMPLEXIDADE?
 * ALTA. Compound Pattern é avançado.
 * 
 * ==================== VEREDITO ====================
 * 
 * ⚠️ PARTIAL
 * 
 * MOTIVO:
 * - Padrão elegante e flexível
 * - MAS: Curva de aprendizado ALTA
 * - MAS: Sem lazy load automático (precisa implementar manual)
 * - MAS: Tudo num arquivo (não escala bem)
 * 
 * MELHOR PARA:
 * - Bibliotecas de componentes (Radix, Reach)
 * - Design systems
 * 
 * NÃO IDEAL PARA:
 * - Features de aplicação (melhor usar Spike 002)
 * 
 * RECOMENDAÇÃO:
 * ⚠️ Usar só se equipe já conhece o padrão.
 * ✅ Caso contrário, usar Spike 002 (State + Router).
 */
