/**
 * VISÃO: Painel (Dashboard)
 * 
 * Componente isolado, <500 linhas
 * Usa hooks customizados do store para dados
 */

import { useMetricasPainel } from '../store';

export default function PainelView() {
  const metricas = useMetricasPainel();
  
  return (
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
      
      {/* Aqui viriam: gráficos, tabelas, etc */}
    </div>
  );
}

/**
 * ✅ VANTAGENS:
 * - Arquivo pequeno (<200 linhas com funcionalidade completa)
 * - Testável isoladamente (mock useMetricasPainel)
 * - Lazy load automático
 * - Mudança aqui não afeta EquipesView ou ColaboradoresView
 */
