import { useState, useMemo } from 'react';
import type { EquipmentCycle, CycleStatus } from '../../fleet/cycleHistory';
import { calcularMetricasCiclos, extrairFasesCiclo } from '../../fleet/cycleHistory';
import { CycleTimeline } from './CycleTimeline';

interface Props {
  ciclos: EquipmentCycle[];
  equipamentos: Map<string, { prefixo: string; nome: string }>;
}

interface Filtros {
  equipamentoId: string;
  dataInicio: string;
  dataFim: string;
  status: CycleStatus | '';
  busca: string;
}

export const HistoricoCiclos: React.FC<Props> = ({ ciclos, equipamentos }) => {
  const [filtros, setFiltros] = useState<Filtros>({
    equipamentoId: '',
    dataInicio: '',
    dataFim: '',
    status: '',
    busca: '',
  });
  const [cicloSelecionado, setCicloSelecionado] = useState<string | null>(null);

  const ciclosFiltrados = useMemo(() => {
    return ciclos.filter(ciclo => {
      if (filtros.equipamentoId && ciclo.equipamentoId !== filtros.equipamentoId) return false;
      if (filtros.dataInicio && ciclo.dataInicio < filtros.dataInicio) return false;
      if (filtros.dataFim && ciclo.dataInicio > filtros.dataFim) return false;
      if (filtros.status && ciclo.statusAtual !== filtros.status) return false;
      if (filtros.busca && !ciclo.prefixo.toLowerCase().includes(filtros.busca.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [ciclos, filtros]);

  const metricas = useMemo(() => {
    return calcularMetricasCiclos(ciclosFiltrados);
  }, [ciclosFiltrados]);

  const equipamentosUnicos = Array.from(
    new Map(ciclos.map(c => [c.equipamentoId, { id: c.equipamentoId, prefixo: c.prefixo }])).values()
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">Histórico de Ciclos</h1>
        <p className="text-sm text-slate-600 mt-1">Rastreamento de transições operacionais</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-green-700 uppercase mb-1">Em Operação</div>
          <div className="text-2xl font-bold text-green-600">
            {Math.floor(metricas.totalOperacao / 60)}h {metricas.totalOperacao % 60}m
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-orange-700 uppercase mb-1">Manutenção</div>
          <div className="text-2xl font-bold text-orange-600">
            {Math.floor(metricas.totalManutencao / 60)}h {metricas.totalManutencao % 60}m
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-blue-700 uppercase mb-1">À Disposição</div>
          <div className="text-2xl font-bold text-blue-600">
            {Math.floor(metricas.totalParado / 60)}h {metricas.totalParado % 60}m
          </div>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-indigo-700 uppercase mb-1">Disponibilidade</div>
          <div className="text-2xl font-bold text-indigo-600">{metricas.disponibilidade}%</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="border border-slate-200 rounded-xl p-4 bg-white">
        <h3 className="font-semibold text-slate-800 mb-4">Filtros</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Equipamento */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Equipamento</label>
            <select
              value={filtros.equipamentoId}
              onChange={e => setFiltros({ ...filtros, equipamentoId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {equipamentosUnicos.map(eq => (
                <option key={eq.id} value={eq.id}>
                  {eq.prefixo}
                </option>
              ))}
            </select>
          </div>

          {/* Data início */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">De</label>
            <input
              type="date"
              value={filtros.dataInicio}
              onChange={e => setFiltros({ ...filtros, dataInicio: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Data fim */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Até</label>
            <input
              type="date"
              value={filtros.dataFim}
              onChange={e => setFiltros({ ...filtros, dataFim: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
            <select
              value={filtros.status}
              onChange={e => setFiltros({ ...filtros, status: e.target.value as CycleStatus | '' })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="Em operação">Em operação</option>
              <option value="Em manutenção">Em manutenção</option>
              <option value="À disposição">À disposição</option>
              <option value="Aguardando manutenção">Aguardando manutenção</option>
            </select>
          </div>

          {/* Busca */}
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Busca</label>
            <input
              type="text"
              value={filtros.busca}
              onChange={e => setFiltros({ ...filtros, busca: e.target.value })}
              placeholder="Prefixo..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Limpar filtros */}
          <div className="flex items-end">
            <button
              onClick={() => setFiltros({
                equipamentoId: '',
                dataInicio: '',
                dataFim: '',
                status: '',
                busca: '',
              })}
              className="w-full px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg text-sm transition-colors"
            >
              Limpar
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-3">
          Mostrando {ciclosFiltrados.length} de {ciclos.length} ciclos
        </p>
      </div>

      {/* Lista de ciclos */}
      <div className="space-y-4">
        {ciclosFiltrados.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-slate-600">Nenhum ciclo encontrado com esses filtros</p>
          </div>
        ) : (
          ciclosFiltrados.map(ciclo => (
            <div
              key={ciclo.id}
              className="border border-slate-200 rounded-xl p-4 bg-white hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setCicloSelecionado(cicloSelecionado === ciclo.id ? null : ciclo.id)}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-semibold text-slate-800">{ciclo.prefixo}</h4>
                  <p className="text-xs text-slate-600">{ciclo.dataInicio}</p>
                </div>
                <div className="text-right">
                  <div className={`inline-block px-2 py-1 rounded-lg text-xs font-semibold ${
                    ciclo.statusAtual === 'Em operação' ? 'bg-green-100 text-green-700' :
                    ciclo.statusAtual === 'Em manutenção' ? 'bg-orange-100 text-orange-700' :
                    ciclo.statusAtual === 'À disposição' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {ciclo.statusAtual}
                  </div>
                </div>
              </div>

              {/* Resumo */}
              <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                <div className="bg-slate-50 p-2 rounded">
                  <span className="text-slate-600">Eventos:</span>
                  <span className="font-semibold ml-1">{ciclo.eventos.length}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded">
                  <span className="text-slate-600">Duração:</span>
                  <span className="font-semibold ml-1">
                    {ciclo.duracao ? `${Math.floor(ciclo.duracao / 60)}h ${ciclo.duracao % 60}m` : '—'}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded">
                  <span className="text-slate-600">Atualizado:</span>
                  <span className="font-semibold ml-1">
                    {ciclo.eventos[ciclo.eventos.length - 1]?.hora || '—'}
                  </span>
                </div>
              </div>

              {/* Timeline expandida */}
              {cicloSelecionado === ciclo.id && (
                <div className="border-t border-slate-200 pt-4 mt-4">
                  <CycleTimeline ciclo={ciclo} prefixo={ciclo.prefixo} />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
