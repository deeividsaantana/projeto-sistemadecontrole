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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-950">Lista de Equipamentos</h2>
        <p className="mt-1 text-sm text-slate-600">
          {equipamentosComAtividade.length}
          {' '}
          {equipamentosComAtividade.length === 1 ? 'equipamento' : 'equipamentos'}
          {' '}
          cadastrado
          {equipamentosComAtividade.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid gap-3">
        {equipamentosComAtividade.map(eq => (
          <div
            key={eq.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100"
          >
            <div>
              <p className="font-bold text-slate-950">{eq.prefixo}</p>
              <p className="text-xs text-slate-600">{eq.modelo || 'Sem modelo'}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-emerald-700">{eq.atividades}</p>
              <p className="text-xs text-slate-600">lançamentos</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
