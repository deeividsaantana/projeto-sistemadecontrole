/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useEquipamentosExternos } from '../hooks/useEquipamentosExternos';

import { 
  Empresa, 
  ObraLocal, 
  Equipamento, 
  Funcionario, 
  Comboio, 
  TipoCombustivel, 
  ProdutoLubrificacao, 
  EtapaServico, 
  Abastecimento, 
  Lubrificacao, 
  RdoDiario,
  HistoryLog,
  ListaPresenca,
  OrdemServico
} from '../types';

import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  BarChart, 
  Bar, 
  Cell, 
  PieChart, 
  Pie 
} from 'recharts';

import { 
  Droplets, 
  Truck, 
  Building2, 
  Activity, 
  AlertTriangle, 
  Wrench, 
  ClipboardList, 
  Clock, 
  TrendingUp, 
  ArrowUpRight,
  ShieldAlert,
  MapPin
} from 'lucide-react';

interface DashboardProps {
  empresas: Empresa[];
  obras: ObraLocal[];
  equipamentos: Equipamento[];
  funcionarios: Funcionario[];
  comboios: Comboio[];
  combustiveis: TipoCombustivel[];
  lubrificantes: ProdutoLubrificacao[];
  etapas: EtapaServico[];
  abastecimentos: Abastecimento[];
  lubrificacoes: Lubrificacao[];
  rdos: RdoDiario[];
  historyLogs: HistoryLog[];
  listasPresenca?: ListaPresenca[];
  ordensServico?: OrdemServico[];
  onNavigate: (tab: string) => void;
}

export default function Dashboard({
  empresas,
  obras,
  equipamentos,
  funcionarios,
  comboios,
  combustiveis,
  lubrificantes,
  etapas,
  abastecimentos,
  lubrificacoes,
  rdos,
  historyLogs,
  listasPresenca = [],
  ordensServico = [],
  onNavigate
}: DashboardProps) {

  // 1. Calculations & Metrics
  const totalLiters = abastecimentos.reduce((acc, curr) => acc + curr.quantidadeLitros, 0);
  
  const equipamentosExternos = useEquipamentosExternos();
  const activeEquipments = equipamentos.filter(e => e.status === 'Ativo' || e.status === 'Mobilizado').length;
  const stoppedEquipments = equipamentos.filter(e => e.status === 'Parado' || e.status === 'Esperando motorista').length;
  const localMaintenanceEquipments = equipamentos.filter(e => e.status === 'Manutenção').length;
  const maintenanceEquipments = equipamentosExternos.manutencao ?? localMaintenanceEquipments;

  // 2. Consumption by fleet (rank)
  const consumptionByFleet = equipamentos.map(eq => {
    const liters = abastecimentos
      .filter(ab => ab.equipamentoId === eq.id)
      .reduce((acc, curr) => acc + curr.quantidadeLitros, 0);
    return {
      prefixo: eq.prefixo,
      nome: eq.nome,
      liters
    };
  }).filter(item => item.liters > 0)
    .sort((a, b) => b.liters - a.liters)
    .slice(0, 5); // top 5

  // 3. Consumption by Company
  const consumptionByCompany = empresas.map(emp => {
    // Abastecimentos for equipments owned by this company
    const liters = abastecimentos.filter(ab => {
      const eq = equipamentos.find(e => e.id === ab.equipamentoId);
      return eq && eq.empresaId === emp.id;
    }).reduce((acc, curr) => acc + curr.quantidadeLitros, 0);

    return {
      nome: emp.nome,
      liters
    };
  }).filter(item => item.liters > 0);

  // 4. Group Fuel by Day Chart Data
  const fuelByDayMap: { [date: string]: number } = {};
  abastecimentos.forEach(ab => {
    // Format date beautifully (e.g., "22/06")
    const parts = ab.data.split('-');
    const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : ab.data;
    fuelByDayMap[label] = (fuelByDayMap[label] || 0) + ab.quantidadeLitros;
  });

  // Sort dates
  const fuelByDayData = Object.keys(fuelByDayMap).map(date => ({
    date,
    litros: fuelByDayMap[date]
  })).sort((a, b) => {
    const [dayA, monthA] = a.date.split('/');
    const [dayB, monthB] = b.date.split('/');
    return Number(monthA) - Number(monthB) || Number(dayA) - Number(dayB);
  });

  // 5. Group Fuel by Fuel Type Chart Data
  const fuelByTypeMap: { [typeName: string]: number } = {};
  abastecimentos.forEach(ab => {
    const type = combustiveis.find(t => t.id === ab.tipoCombustivelId);
    const typeName = type ? type.nome : 'Outros';
    fuelByTypeMap[typeName] = (fuelByTypeMap[typeName] || 0) + ab.quantidadeLitros;
  });

  const fuelByTypeData = Object.keys(fuelByTypeMap).map(name => ({
    name,
    value: fuelByTypeMap[name]
  }));

  // New calculations for additional dashboards
  const consumptionByObra = obras.map(site => {
    const liters = abastecimentos.filter(ab => {
      const eq = equipamentos.find(e => e.id === ab.equipamentoId);
      return eq && eq.localAtualId === site.id;
    }).reduce((acc, curr) => acc + curr.quantidadeLitros, 0);

    return {
      nome: site.nome,
      litros: liters
    };
  }).filter(item => item.litros > 0);

  const statusCounts = [
    { name: 'Ativo / Mobilizado', value: activeEquipments, color: '#10b981' },
    { name: 'Parado', value: stoppedEquipments, color: '#f43f5e' },
    { name: 'Em Manutenção', value: maintenanceEquipments, color: '#f59e0b' }
  ].filter(item => item.value > 0);

  const headcountByObra = obras.map(site => {
    const siteLists = listasPresenca.filter(p => p.obraId === site.id);
    let presentCount = 0;
    if (siteLists.length > 0) {
      const latest = [...siteLists].sort((a, b) => b.data.localeCompare(a.data))[0];
      presentCount = latest.funcionarios.filter(f => f.presente).length;
    } else {
      const siteRdos = rdos.filter(r => r.obraLocalId === site.id);
      if (siteRdos.length > 0) {
        presentCount = Math.round(siteRdos.reduce((acc, curr) => acc + curr.quantidadeEquipe, 0) / siteRdos.length);
      }
    }
    return {
      nome: site.nome,
      presencas: presentCount
    };
  }).filter(item => item.presencas > 0);

  // 7. Today's attendance summary (most recent diário per obra, prioritizing today's date)
  const todayStr = new Date().toISOString().split('T')[0];
  const latestListaPorObra = obras.map(site => {
    const siteLists = listasPresenca.filter(p => p.obraId === site.id);
    if (siteLists.length === 0) return null;
    return [...siteLists].sort((a, b) => b.data.localeCompare(a.data))[0];
  }).filter((x): x is ListaPresenca => x !== null);

  const totalFuncionariosListados = latestListaPorObra.reduce((acc, l) => acc + l.funcionarios.length, 0);
  const totalPresentesListados = latestListaPorObra.reduce((acc, l) => acc + l.funcionarios.filter(f => f.presente).length, 0);
  const percPresencaGeral = totalFuncionariosListados > 0 ? Math.round((totalPresentesListados / totalFuncionariosListados) * 100) : 0;
  const listasDeHoje = listasPresenca.filter(l => l.data === todayStr).length;

  // 8. Maintenance (Ordens de Serviço) summary
  const osAbertas = ordensServico.filter(os => os.status === 'Aberta' || os.status === 'Em Andamento' || os.status === 'Aguardando Peça');
  const osUrgentes = osAbertas.filter(os => os.prioridade === 'Urgente');
  const osConcluidasNoMes = ordensServico.filter(os => {
    if (os.status !== 'Concluída' || !os.dataConclusao) return false;
    const now = new Date();
    const concl = new Date(os.dataConclusao + 'T00:00:00');
    return concl.getMonth() === now.getMonth() && concl.getFullYear() === now.getFullYear();
  }).length;
  const osPorTipo = ['Preventiva', 'Corretiva', 'Preditiva', 'Revisão'].map(tipo => ({
    tipo,
    count: osAbertas.filter(os => os.tipo === tipo).length
  })).filter(x => x.count > 0);

  // Recharts colors for fuel types (shades of green and dark gray)
  const PIE_COLORS = ['#10b981', '#34d399', '#059669', '#047857', '#6ee7b7'];

  // 6. Dynamic Alerts & Pendencies
  const pendingAlerts: { id: string; type: 'warning' | 'info' | 'danger'; text: string; details: string }[] = [];

  // Maintenance equipment alerts
  equipamentos.filter(e => e.status === 'Manutenção').forEach(eq => {
    pendingAlerts.push({
      id: `alert-maint-${eq.id}`,
      type: 'warning',
      text: `Equipamento em Manutenção: ${eq.prefixo}`,
      details: `${eq.nome} necessita liberação da oficina.`
    });
  });

  // Urgent open service orders
  osUrgentes.forEach(os => {
    const eq = equipamentos.find(e => e.id === os.equipamentoId);
    pendingAlerts.push({
      id: `alert-os-${os.id}`,
      type: 'danger',
      text: `OS Urgente: ${os.numero}`,
      details: `${eq ? eq.prefixo : 'Equipamento'} — ${os.descricao || os.tipo}`
    });
  });

  // Missing drivers
  equipamentos.filter(e => e.status === 'Esperando motorista').forEach(eq => {
    pendingAlerts.push({
      id: `alert-op-${eq.id}`,
      type: 'info',
      text: `${eq.prefixo} aguarda operador`,
      details: `Status está definido como "Esperando motorista" em ${obras.find(o => o.id === eq.localAtualId)?.nome || 'Canteiro'}.`
    });
  });

  // Active RDO issues
  rdos.filter(r => r.pendencias && r.pendencias.trim() !== '').forEach(rdo => {
    const ob = obras.find(o => o.id === rdo.obraLocalId);
    pendingAlerts.push({
      id: `alert-rdo-${rdo.id}`,
      type: 'danger',
      text: `Pendência de RDO (${rdo.data})`,
      details: `Na obra ${ob ? ob.nome : 'Obra'}: "${rdo.pendencias}"`
    });
  });

  return (
    <div className="space-y-6" id="dashboard-tab">
      
      {/* 1. Header Greetings */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Olá, Administrador
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Aqui está o resumo operacional das frentes de serviço da Renea Infraestrutura.
          </p>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => onNavigate('lancamentos')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            Novo Lançamento
          </button>
          <button 
            onClick={() => onNavigate('reports')}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            Ver Relatórios
          </button>
        </div>
      </div>

      {/* 2. KPI Scorecard Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="kpi-grid">
        {/* KPI 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-sm relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="p-3 bg-emerald-600/10 text-emerald-400 rounded-xl">
            <Droplets className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-mono">Abastecido</span>
            <span className="text-xl font-black text-white font-mono block mt-1">{totalLiters.toLocaleString('pt-BR')} L</span>
            <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Consumo acumulado
            </span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all"></div>
        </div>

        {/* KPI 2 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-sm relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="p-3 bg-emerald-600/10 text-emerald-400 rounded-xl">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-mono">Equipamentos Ativos</span>
            <span className="text-xl font-black text-white font-mono block mt-1">{activeEquipments}</span>
            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Operando em campo</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-sm relative overflow-hidden group hover:border-rose-500/30 transition-all">
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-mono">Frota Parada</span>
            <span className="text-xl font-black text-white font-mono block mt-1">{stoppedEquipments}</span>
            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Sem operador ou inativo</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-sm relative overflow-hidden group hover:border-amber-500/30 transition-all">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-mono">Em Manutenção</span>
            <span className="text-xl font-black text-white font-mono block mt-1">{maintenanceEquipments}</span>
            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
              {equipamentosExternos.manutencao !== null ? 'Sincronizado com manutenção externa' : 'Oficina de campo / corretiva'}
            </span>
          </div>
        </div>
      </div>

      {/* 2.5 Presença & Manutenção Summary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="presenca-manutencao-summary-row">
        {/* Presença Summary Card */}
        <button
          onClick={() => onNavigate('presenca')}
          className="text-left bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-emerald-500/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs uppercase tracking-widest font-black text-slate-400 font-mono flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              Presença Hoje
            </h2>
            <span className="text-[9px] text-emerald-400 font-bold group-hover:underline">Ver detalhes →</span>
          </div>

          <div className="flex items-center gap-6">
            <div>
              <span className="text-3xl font-black text-white font-mono block">{percPresencaGeral}%</span>
              <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                {totalPresentesListados} de {totalFuncionariosListados} no último diário por obra
              </span>
            </div>
            <div className="flex-1 h-2.5 bg-slate-950 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${percPresencaGeral >= 85 ? 'bg-emerald-500' : percPresencaGeral >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                style={{ width: `${percPresencaGeral}%` }}
              ></div>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 mt-3">
            {listasDeHoje > 0 ? `${listasDeHoje} diário(s) de presença registrado(s) hoje.` : 'Nenhum diário de presença registrado hoje ainda.'}
          </p>
        </button>

        {/* Manutenção Summary Card */}
        <button
          onClick={() => onNavigate('manutencao')}
          className="text-left bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-amber-500/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs uppercase tracking-widest font-black text-slate-400 font-mono flex items-center gap-1.5">
              <Wrench className="w-4 h-4 text-amber-400" />
              Manutenção de Equipamentos
            </h2>
            <span className="text-[9px] text-amber-400 font-bold group-hover:underline">Ver detalhes →</span>
          </div>

          <div className="flex items-center gap-6">
            <div>
              <span className="text-3xl font-black text-white font-mono block">{osAbertas.length}</span>
              <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">Ordens de serviço em aberto</span>
            </div>
            {osUrgentes.length > 0 && (
              <div className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                <span className="text-[10px] font-black text-rose-400">{osUrgentes.length} urgente{osUrgentes.length !== 1 ? 's' : ''}</span>
              </div>
            )}
            <span className="text-[10px] text-slate-500 ml-auto">{osConcluidasNoMes} concluída(s) no mês</span>
          </div>

          {osPorTipo.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {osPorTipo.map(item => (
                <span key={item.tipo} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-400">
                  {item.tipo}: {item.count}
                </span>
              ))}
            </div>
          )}
        </button>
      </div>

      {/* 3. Main Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-charts">
        
        {/* Left 2 Columns: Fueling Over Time Area Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xs uppercase tracking-widest font-black text-slate-400 font-mono">Fluxo de Abastecimento Diário</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Litros fornecidos pelo comboio de apoio operacional por dia.</p>
            </div>
            <div className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-lg border border-emerald-500/20 uppercase font-mono">
              Litros (L)
            </div>
          </div>

          <div className="h-64 w-full">
            {fuelByDayData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">
                Nenhum lançamento de abastecimento disponível para gerar gráfico.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={fuelByDayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorLiters" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    stroke="#475569" 
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#475569" 
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                    labelStyle={{ color: '#94a3b8', fontWeight: 'bold', fontSize: '11px' }}
                    itemStyle={{ color: '#10b981', fontSize: '12px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="litros" 
                    stroke="#10b981" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorLiters)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right Column: Fuel Types Pie distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-xs uppercase tracking-widest font-black text-slate-400 font-mono">Combustível por Tipo</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">Distribuição do volume abastecido por classe de combustível.</p>
          </div>

          <div className="h-44 w-full flex items-center justify-center my-2">
            {fuelByTypeData.length === 0 ? (
              <div className="text-xs text-slate-500 italic">
                Sem dados de tipo de combustível.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={fuelByTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {fuelByTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie Chart Legend with percentages */}
          <div className="space-y-1">
            {fuelByTypeData.map((item, idx) => (
              <div key={item.name} className="flex items-center justify-between text-xxs font-semibold">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></span>
                  <span>{item.name}</span>
                </div>
                <span className="font-mono text-white">{item.value.toLocaleString('pt-BR')} L</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 3b. Worksite Performance & Resources Dashboards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="worksite-analytics-row">
        {/* Chart 1: Consumption by Worksite */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="mb-4">
            <h2 className="text-xs uppercase tracking-widest font-black text-slate-400 font-mono">Consumo por Canteiro (L)</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">Litragem de abastecimento acumulada por obra ou frente de serviço.</p>
          </div>
          <div className="h-56 w-full">
            {consumptionByObra.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">
                Nenhum abastecimento registrado nos canteiros ativos.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={consumptionByObra} layout="vertical" margin={{ top: 5, right: 15, left: -10, bottom: 5 }}>
                  <XAxis type="number" stroke="#475569" fontSize={9} tickLine={false} />
                  <YAxis dataKey="nome" type="category" stroke="#475569" fontSize={9} tickLine={false} width={80} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                    itemStyle={{ color: '#10b981', fontSize: '11px' }}
                  />
                  <Bar dataKey="litros" fill="#059669" radius={[0, 4, 4, 0]}>
                    {consumptionByObra.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#10b981' : '#047857'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Fleet Status Availability */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-xs uppercase tracking-widest font-black text-slate-400 font-mono">Status da Frota</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">Distribuição operacional em tempo real de todos os equipamentos.</p>
          </div>
          <div className="h-40 w-full flex items-center justify-center">
            {statusCounts.length === 0 ? (
              <div className="text-xs text-slate-500 italic">Sem equipamentos cadastrados.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusCounts}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusCounts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="space-y-1 mt-2 border-t border-slate-800/60 pt-2">
            {statusCounts.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xxs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                  <span className="text-slate-400">{item.name}</span>
                </div>
                <span className="text-white font-mono">{item.value} {item.value === 1 ? 'maquina' : 'máquinas'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 3: Active Presence by Worksite */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="mb-4">
            <h2 className="text-xs uppercase tracking-widest font-black text-slate-400 font-mono">Efetivo de Mão de Obra</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">Número de funcionários ativos em campo por canteiro de obras.</p>
          </div>
          <div className="h-56 w-full">
            {headcountByObra.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">
                Nenhum registro de equipe ativa ou presença encontrado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={headcountByObra} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="nome" stroke="#475569" fontSize={9} tickLine={false} />
                  <YAxis stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                    itemStyle={{ color: '#34d399', fontSize: '11px' }}
                  />
                  <Bar dataKey="presencas" fill="#34d399" radius={[4, 4, 0, 0]}>
                    {headcountByObra.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#34d399' : '#059669'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 4. Rankings & Pending Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-lists-row">
        
        {/* Left Column: Top Fleet consumption */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 font-mono flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-emerald-400" />
              Consumo por Frota (Top 5)
            </h3>
            <span className="text-[9px] text-slate-500 font-mono font-bold">LITRAGEM</span>
          </div>

          <div className="space-y-4">
            {consumptionByFleet.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-6 text-center">Nenhum equipamento abastecido recentemente.</p>
            ) : (
              consumptionByFleet.map((item, index) => {
                const maxLiters = consumptionByFleet[0]?.liters || 1;
                const percentage = (item.liters / maxLiters) * 100;
                return (
                  <div key={item.prefixo} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-emerald-400 font-mono mr-1">{item.prefixo}</span>
                        <span className="text-slate-400 text-xxs truncate max-w-[120px] inline-block align-bottom">{item.nome}</span>
                      </div>
                      <span className="font-mono font-bold text-white text-xxs">{item.liters.toLocaleString('pt-BR')} L</span>
                    </div>
                    {/* Visual custom progress bar */}
                    <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center Column: Consumo por Empresa */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 font-mono flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-400" />
              Consumo por Empresa
            </h3>
            <span className="text-[9px] text-slate-500 font-mono font-bold">LITROS</span>
          </div>

          <div className="space-y-4.5">
            {consumptionByCompany.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-6 text-center">Sem dados de consumo por empresa.</p>
            ) : (
              consumptionByCompany.map((item) => (
                <div key={item.nome} className="flex items-center justify-between border-b border-slate-800/40 pb-2.5 last:border-0 last:pb-0">
                  <div className="truncate max-w-[160px]">
                    <span className="text-xs font-bold text-slate-200 block truncate">{item.nome}</span>
                  </div>
                  <span className="font-mono text-xs font-black text-white">{item.liters.toLocaleString('pt-BR')} L</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Dynamic Alerts Panel (Crucial for Operational decisions) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 font-mono flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              Alertas & Pendências
            </h3>
            <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 text-[9px] font-bold rounded font-mono">
              {pendingAlerts.length} ATIVOS
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-52 space-y-3 pr-1">
            {pendingAlerts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-6">
                <p className="text-xs text-emerald-400 font-bold mb-1">✓ Sem pendências críticas</p>
                <p className="text-[10px] text-slate-500">Toda a frota e RDOs estão atualizados e conformes.</p>
              </div>
            ) : (
              pendingAlerts.map(alert => {
                const borderClass = alert.type === 'danger' 
                  ? 'border-rose-500/20 bg-rose-500/5 text-rose-400' 
                  : alert.type === 'warning' 
                  ? 'border-amber-500/20 bg-amber-500/5 text-amber-400' 
                  : 'border-blue-500/20 bg-blue-500/5 text-blue-400';

                return (
                  <div key={alert.id} className={`border p-3 rounded-xl space-y-1 ${borderClass}`}>
                    <div className="flex items-start gap-1.5 justify-between">
                      <span className="text-xxs font-black uppercase tracking-wider block">{alert.text}</span>
                    </div>
                    <p className="text-xxs text-slate-400 leading-relaxed">{alert.details}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* 5. Recent RDO & Audit Log row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="recent-rdo-audit-row">
        {/* Left Column: Recent RDOs logged */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 font-mono flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-emerald-400" />
              RDOs Diários Recentes
            </h3>
            <button 
              onClick={() => onNavigate('lancamentos')}
              className="text-[10px] font-bold text-emerald-400 hover:underline cursor-pointer"
            >
              Lançar RDO
            </button>
          </div>

          <div className="space-y-3.5">
            {rdos.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4 text-center">Nenhum RDO lançado até o momento.</p>
            ) : (
              rdos.slice(0, 3).map(rdo => {
                const ob = obras.find(o => o.id === rdo.obraLocalId);
                const et = etapas.find(e => e.id === rdo.etapaServicoId);
                const statusColor = rdo.statusAtividade === 'Concluído' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : rdo.statusAtividade === 'Andamento' 
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

                return (
                  <div key={rdo.id} className="border border-slate-800/80 rounded-xl p-3.5 bg-slate-950/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xxs font-bold text-slate-400 font-mono flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {ob ? ob.nome : 'Obra Geral'}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2 py-0.5 rounded-md">
                        {rdo.data.split('-').reverse().join('/')}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-200 line-clamp-1">{rdo.servicoExecutado}</p>
                    <div className="flex items-center justify-between pt-1 text-xxs text-slate-400">
                      <span>Equipe: {rdo.quantidadeEquipe} pessoas</span>
                      <span className={`px-2 py-0.5 border text-[9px] font-bold rounded-full ${statusColor}`}>
                        {rdo.statusAtividade}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Audit Logs timeline */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 font-mono flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-400" />
              Histórico Operacional de Alterações
            </h3>
            <span className="text-[9px] text-slate-500 font-mono font-bold">LOGS</span>
          </div>

          <div className="space-y-3">
            {historyLogs.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4 text-center">Nenhum histórico operacional registrado.</p>
            ) : (
              historyLogs.slice(0, 4).map(log => {
                const actionColor = log.acao === 'Criou' 
                  ? 'text-emerald-400' 
                  : log.acao === 'Editou' 
                  ? 'text-amber-400' 
                  : 'text-rose-400';

                return (
                  <div key={log.id} className="text-xxs flex items-start gap-3 border-b border-slate-800/30 pb-2.5 last:border-0 last:pb-0">
                    <span className="text-slate-500 font-mono whitespace-nowrap mt-0.5">{log.timestamp.split(' ')[1] || log.timestamp}</span>
                    <div className="flex-1 space-y-0.5">
                      <p className="text-slate-200 font-semibold leading-relaxed">
                        <strong className={actionColor}>{log.acao}</strong> em <span className="text-slate-400">{log.tela}</span>: {log.descricao}
                      </p>
                      <span className="text-[10px] text-slate-500 block">Operador: {log.usuario}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
