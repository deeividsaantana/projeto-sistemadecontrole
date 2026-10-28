/**
 * VISÃO: Equipes
 * 
 * Componente isolado, <500 linhas
 */

import { useFiltragemGlobal, usePessoasPresencaStore } from '../store';
import type { GrupoEquipe } from '../../../src/types';

interface EquipesViewProps {
  onSaveGrupoEquipe: (grupo: GrupoEquipe, isNew: boolean) => void;
  onDeleteGrupoEquipe?: (id: string) => void;
}

export default function EquipesView({ onSaveGrupoEquipe, onDeleteGrupoEquipe }: EquipesViewProps) {
  const { equipesFiltradas } = useFiltragemGlobal();
  const { equipeEditando, setEquipeEditando } = usePessoasPresencaStore();
  
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Equipes ({equipesFiltradas.length})</h2>
        <button
          onClick={() => setEquipeEditando('nova')}
          className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
        >
          ➕ Nova equipe
        </button>
      </div>
      
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
              <div className="flex gap-2">
                <button
                  onClick={() => setEquipeEditando(equipe.id)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  ✏️ Editar
                </button>
                {onDeleteGrupoEquipe && (
                  <button
                    onClick={() => {
                      if (confirm(`Excluir equipe "${equipe.nome}"?`)) {
                        onDeleteGrupoEquipe(equipe.id);
                      }
                    }}
                    className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
                  >
                    🗑️ Excluir
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Modal de edição (se equipeEditando estiver setado) */}
      {equipeEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-4">
              {equipeEditando === 'nova' ? 'Nova Equipe' : 'Editar Equipe'}
            </h3>
            {/* Aqui viria o formulário */}
            <button
              onClick={() => setEquipeEditando(null)}
              className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ✅ VANTAGENS:
 * - Arquivo isolado (<300 linhas com formulário completo)
 * - Estado de edição no store compartilhado
 * - Callbacks recebidos via props (testável com mocks)
 */
