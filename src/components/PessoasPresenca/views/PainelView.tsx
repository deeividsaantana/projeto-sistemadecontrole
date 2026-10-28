/**
 * VISÃO: Painel (Dashboard)
 * 
 * Métricas agregadas de presença:
 * - Cards de totais (presentes, ausentes, equipes)
 * - Alertas de equipes pendentes
 * - Gráfico de histórico (últimos 7 dias)
 * - Efetivo por empresa
 */

import { useMemo } from 'react';
import { useMetricasPainel } from '../hooks/useMetricasPainel';
import { usePessoasPresencaStore } from '../store';
import { Users, AlertTriangle, Check, X, Clock, TrendingUp } from 'lucide-react';

export default function PainelView() {
  const { globalData, setGlobalData, empresas } = usePessoasPresencaStore();
  const { contadores, equipesStatus, efetivoPorEmpresa, historico7Dias } = useMetricasPainel();
  
  // Nome das empresas
  const empresasNome = useMemo(() => {
    return new Map(empresas.map(e => [e.id, e.nome]));
  }, [empresas]);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Dashboard de Presença</h2>
          <p className="text-sm text-slate-600 mt-1">
            Acompanhamento em tempo real do efetivo
          </p>
        </div>
        
        {/* Seletor de data */}
        <input
          type="date"
          value={globalData}
          onChange={(e) => setGlobalData(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>
      
      {/* Cards de métricas principais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Presentes */}
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Presentes</p>
              <strong className="mt-2 block text-3xl font-black text-emerald-700">
                {contadores.presentes}
              </strong>
              <p className="mt-1 text-xs text-emerald-600">
                de {contadores.total} registros
              </p>
            </div>
            <div className="rounded-full bg-emerald-100 p-3">
              <Check className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>
        
        {/* Ausentes */}
        <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-rose-600">Ausentes</p>
              <strong className="mt-2 block text-3xl font-black text-rose-700">
                {contadores.ausentes}
              </strong>
              <p className="mt-1 text-xs text-rose-600">
                faltas hoje
              </p>
            </div>
            <div className="rounded-full bg-rose-100 p-3">
              <X className="h-6 w-6 text-rose-600" />
            </div>
          </div>
        </div>
        
        {/* Atrasos */}
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-amber-600">Atrasos</p>
              <strong className="mt-2 block text-3xl font-black text-amber-700">
                {contadores.atrasados}
              </strong>
              <p className="mt-1 text-xs text-amber-600">
                chegaram atrasados
              </p>
            </div>
            <div className="rounded-full bg-amber-100 p-3">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </div>
        
        {/* Equipes */}
        <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-sky-600">Equipes</p>
              <strong className="mt-2 block text-3xl font-black text-sky-700">
                {equipesStatus.enviaram}
              </strong>
              <p className="mt-1 text-xs text-sky-600">
                de {equipesStatus.total} ({equipesStatus.porcentagem}%)
              </p>
            </div>
            <div className="rounded-full bg-sky-100 p-3">
              <Users className="h-6 w-6 text-sky-600" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Alertas - Equipes pendentes */}
      {equipesStatus.pendentes.length > 0 && (
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-amber-100 p-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-amber-900">
                ⚠️ Atenção: {equipesStatus.pendentes.length} equipe(s) ainda não enviaram presença
              </h3>
              <div className="mt-3 space-y-1">
                {equipesStatus.pendentes.slice(0, 5).map(equipe => (
                  <div key={equipe.id} className="text-sm text-amber-800">
                    <span className="font-medium">{equipe.nome}</span>
                    {equipe.responsavel && (
                      <span className="text-amber-600"> · Encarregado: {equipe.responsavel}</span>
                    )}
                  </div>
                ))}
                {equipesStatus.pendentes.length > 5 && (
                  <p className="text-xs text-amber-600">
                    ... e mais {equipesStatus.pendentes.length - 5} equipes
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Grid: Histórico + Efetivo por Empresa */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Histórico últimos 7 dias */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-slate-600" />
            <h3 className="font-bold text-slate-900">Últimos 7 dias</h3>
          </div>
          
          <div className="space-y-3">
            {historico7Dias.map(dia => {
              const total = dia.presentes + dia.ausentes;
              const porcentagem = total > 0 ? (dia.presentes / total) * 100 : 0;
              const dataFormatada = new Date(dia.data + 'T12:00:00').toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
              });
              
              return (
                <div key={dia.data}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{dataFormatada}</span>
                    <span className="text-slate-600">
                      {dia.presentes} de {total} ({Math.round(porcentagem)}%)
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${porcentagem}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Efetivo por empresa */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-600" />
            <h3 className="font-bold text-slate-900">Efetivo por empresa</h3>
          </div>
          
          {efetivoPorEmpresa.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum registro hoje</p>
          ) : (
            <div className="space-y-4">
              {efetivoPorEmpresa.map(item => (
                <div key={item.empresaId}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">
                      {empresasNome.get(item.empresaId) || 'Empresa desconhecida'}
                    </span>
                    <span className="text-slate-600">
                      {item.presentes}/{item.total} ({item.porcentagem}%)
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${item.porcentagem}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
