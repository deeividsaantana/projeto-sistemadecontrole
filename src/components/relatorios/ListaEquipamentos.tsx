import { useMemo } from 'react';
import type { Equipamento, ControleEquipamentoDiario } from '../../types';

interface Props {
  equipamentos: readonly Equipamento[];
  registros: readonly ControleEquipamentoDiario[];
}

interface EquipamentoComAtividade extends Equipamento {
  atividades: number;
}

export function ListaEquipamentos({ equipamentos, registros }: Props) {
  const equipamentosComAtividade = useMemo(() => {
    const mapa = new Map<string, number>();

    registros.forEach((reg) => {
      mapa.set(reg.equipamentoId, (mapa.get(reg.equipamentoId) || 0) + 1);
    });

    return equipamentos
      .map(eq => ({
        ...eq,
        atividades: mapa.get(eq.id) || 0,
      }))
      .sort((a, b) => b.atividades - a.atividades);
  }, [equipamentos, registros]);

  const totalAtividades = equipamentosComAtividade.reduce((acc, eq) => acc + eq.atividades, 0);
  const maxAtividades = Math.max(...equipamentosComAtividade.map(eq => eq.atividades), 1);

  return (
    <div className="space-y-6 rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-slate-50 p-6">
      <div className="flex items-end justify-between border-b border-cyan-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-cyan-950">Atividade de Equipamentos</h2>
          <p className="mt-2 text-sm font-medium text-cyan-700">
            {equipamentosComAtividade.length}
            {' '}
            {equipamentosComAtividade.length === 1 ? 'equipamento' : 'equipamentos'}
            {' '}
            em operação
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-cyan-600">{totalAtividades}</p>
          <p className="text-xs font-medium text-slate-600">operações total</p>
        </div>
      </div>

      <div className="grid gap-3">
        {equipamentosComAtividade.map(eq => {
          const percentual = (eq.atividades / maxAtividades) * 100;
          return (
            <div
              key={eq.id}
              className="group rounded-lg border border-cyan-200 bg-white p-4 transition-all hover:border-cyan-400 hover:bg-cyan-50 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex-1">
                  <p className="font-bold text-slate-950 group-hover:text-cyan-900">{eq.prefixo}</p>
                  <p className="text-xs text-slate-500 group-hover:text-cyan-700">{eq.modelo || 'Sem modelo'}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-cyan-600 text-lg">{eq.atividades}</p>
                  <p className="text-xs font-medium text-slate-600">operações</p>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 transition-all duration-300"
                  style={{ width: `${percentual}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
