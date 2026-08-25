/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useEquipamentosExternos } from '../hooks/useEquipamentosExternos';

import { 
  Empresa, 
  ObraLocal, 
  Equipamento, 
  Funcionario, 
  Comboio, 
  TipoCombustivel, 
  ProdutoLubrificacao, 
  Abastecimento, 
  Lubrificacao, 
  HistoryLog,
  ListaPresenca,
  OrdemServico,
  TicketJazida,
  ControleEstacas,
  PresencaApontamento,
  ApontamentoRamo,
  ApontamentoRamoRegistro,
  MaterialRegistro,
  ParteDiariaEquipamento
} from '../types';
import ExecutiveOverviewV27 from './ExecutiveOverviewV27';
import { getOperationalFuelLiters, splitOperationalFuelRecords } from '../utils/fuelAnalyticsSafety';
import rodoviaDuplicada from '../assets/renea-editorial/rodovia-duplicada.jpg';
import rodoviaSerra from '../assets/renea-editorial/rodovia-serra.jpg';
import ponteConstrucao from '../assets/renea-editorial/ponte-construcao.jpg';

gsap.registerPlugin(ScrollTrigger, useGSAP);

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
  Clock, 
  TrendingUp, 
  ArrowUpRight,
  ShieldAlert,
  ChevronDown
} from 'lucide-react';

interface DashboardProps {
  empresas: Empresa[];
  obras: ObraLocal[];
  equipamentos: Equipamento[];
  funcionarios: Funcionario[];
  comboios: Comboio[];
  combustiveis: TipoCombustivel[];
  lubrificantes: ProdutoLubrificacao[];
  abastecimentos: Abastecimento[];
  lubrificacoes: Lubrificacao[];
  historyLogs: HistoryLog[];
  listasPresenca?: ListaPresenca[];
  ordensServico?: OrdemServico[];
  ticketsJazida?: TicketJazida[];
  estacas?: ControleEstacas;
  presencasLink?: PresencaApontamento[];
  apontamentoRamos?: ApontamentoRamo[];
  apontamentoRamoRegistros?: ApontamentoRamoRegistro[];
  materiaisRegistros?: MaterialRegistro[];
  partesDiariasEquipamentos?: ParteDiariaEquipamento[];
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
  abastecimentos,
  lubrificacoes,
  historyLogs,
  listasPresenca = [],
  ordensServico = [],
  ticketsJazida = [],
  estacas = { lotes: [], cravacoes: [] },
  presencasLink = [],
  apontamentoRamos = [],
  apontamentoRamoRegistros = [],
  materiaisRegistros = [],
  partesDiariasEquipamentos = [],
  onNavigate
}: DashboardProps) {

  const dashboardRef = useRef<HTMLDivElement>(null);

  // 1. Calculations & Metrics
  const { operational: operationalFuel, review: excludedFuelRecords } = useMemo(
    () => splitOperationalFuelRecords(abastecimentos),
    [abastecimentos],
  );
  const totalLiters = operationalFuel.reduce((acc, curr) => acc + (getOperationalFuelLiters(curr) || 0), 0);
  const fuelLaunchCount = operationalFuel.length;
  
  const equipamentosExternos = useEquipamentosExternos();
  const activeEquipments = equipamentos.filter(e => e.status === 'Ativo' || e.status === 'Mobilizado').length;
  const stoppedEquipments = equipamentos.filter(e => e.status === 'Parado' || e.status === 'Esperando motorista').length;
  const localMaintenanceEquipments = equipamentos.filter(e => e.status === 'Manutenção').length;
  const maintenanceEquipments = equipamentosExternos.manutencao ?? localMaintenanceEquipments;

  // 2. Consumption by fleet (rank)
  const consumptionByFleet = Array.from(operationalFuel.reduce((map, ab) => {
    const eq = equipamentos.find(item => item.id === ab.equipamentoId);
    const key = eq?.id || ab.prefixoInformado || 'sem-prefixo';
    const current = map.get(key) || {
      prefixo: eq?.prefixo || ab.prefixoInformado || 'Sem prefixo',
      nome: eq?.nome || 'Pendente de cadastro',
      liters: 0
    };
    current.liters += getOperationalFuelLiters(ab) || 0;
    map.set(key, current);
    return map;
  }, new Map<string, { prefixo: string; nome: string; liters: number }>()).values())
    .filter(item => item.liters > 0)
    .sort((a, b) => b.liters - a.liters)
    .slice(0, 5); // top 5

  // 3. Consumption by Company
  const consumptionByCompany = empresas.map(emp => {
    // Abastecimentos for equipments owned by this company
    const liters = operationalFuel.filter(ab => {
      const eq = equipamentos.find(e => e.id === ab.equipamentoId);
      return eq && eq.empresaId === emp.id;
    }).reduce((acc, curr) => acc + (getOperationalFuelLiters(curr) || 0), 0);

    return {
      nome: emp.nome,
      liters
    };
  }).filter(item => item.liters > 0);

  // 4. Group Fuel by Day Chart Data
  const fuelByDayMap: { [date: string]: number } = {};
  operationalFuel.forEach(ab => {
    // Format date beautifully (e.g., "22/06")
    const parts = ab.data.split('-');
    const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : ab.data;
    fuelByDayMap[label] = (fuelByDayMap[label] || 0) + (getOperationalFuelLiters(ab) || 0);
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
  operationalFuel.forEach(ab => {
    const type = combustiveis.find(t => t.id === ab.tipoCombustivelId);
    const typeName = type ? type.nome : 'Outros';
    fuelByTypeMap[typeName] = (fuelByTypeMap[typeName] || 0) + (getOperationalFuelLiters(ab) || 0);
  });

  const fuelByTypeData = Object.keys(fuelByTypeMap).map(name => ({
    name,
    value: fuelByTypeMap[name]
  }));

  // New calculations for additional dashboards
  const consumptionByObra = obras.map(site => {
    const liters = operationalFuel.filter(ab => {
      const eq = equipamentos.find(e => e.id === ab.equipamentoId);
      return eq && eq.localAtualId === site.id;
    }).reduce((acc, curr) => acc + (getOperationalFuelLiters(curr) || 0), 0);

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
    }
    return {
      nome: site.nome,
      presencas: presentCount
    };
  }).filter(item => item.presencas > 0);

  // 7. Today's attendance summary (most recent diário per obra, prioritizing today's date)
  const nowLocal = new Date();
  const todayStr = new Date(nowLocal.getTime() - nowLocal.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
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

  type BuilderSource = 'abastecimentos' | 'lubrificacoes' | 'presenca' | 'manutencao' | 'equipamentos' | 'historico';
  type BuilderMetric = 'count' | 'litros' | 'quantidade' | 'equipe' | 'custo';
  type BuilderGroup = 'dia' | 'mes' | 'frota' | 'empresa' | 'obra' | 'status' | 'responsavel' | 'produto' | 'origem' | 'acao' | 'tela';

  const [builderSource, setBuilderSource] = useState<BuilderSource>('abastecimentos');
  const [builderMetric, setBuilderMetric] = useState<BuilderMetric>('litros');
  const [builderGroup, setBuilderGroup] = useState<BuilderGroup>('dia');
  const [builderStart, setBuilderStart] = useState('');
  const [builderEnd, setBuilderEnd] = useState('');
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  const sourceOptions: Array<{ id: BuilderSource; label: string }> = [
    { id: 'abastecimentos', label: 'Combustível' },
    { id: 'lubrificacoes', label: 'Lubrificação' },
    { id: 'presenca', label: 'Presença' },
    { id: 'manutencao', label: 'Manutenção' },
    { id: 'equipamentos', label: 'Equipamentos' },
    { id: 'historico', label: 'Histórico' },
  ];

  const metricOptions: Array<{ id: BuilderMetric; label: string }> = [
    { id: 'count', label: 'Quantidade de registros' },
    { id: 'litros', label: 'Litros' },
    { id: 'quantidade', label: 'Quantidade operacional' },
    { id: 'equipe', label: 'Equipe / presença' },
    { id: 'custo', label: 'Custo' },
  ];

  const groupOptions: Array<{ id: BuilderGroup; label: string }> = [
    { id: 'dia', label: 'Dia' },
    { id: 'mes', label: 'Mês' },
    { id: 'frota', label: 'Frota' },
    { id: 'empresa', label: 'Empresa' },
    { id: 'obra', label: 'Obra/local' },
    { id: 'status', label: 'Status' },
    { id: 'responsavel', label: 'Responsável' },
    { id: 'produto', label: 'Produto' },
    { id: 'origem', label: 'Origem' },
    { id: 'acao', label: 'Ação' },
    { id: 'tela', label: 'Aba/tela' },
  ];

  const historyDateToIso = (timestamp: string) => {
    const match = String(timestamp || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
  };

  const formatGroupDate = (date: string) => {
    if (!date) return 'Sem data';
    if (builderGroup === 'mes') return date.slice(0, 7);
    return date.split('-').reverse().join('/');
  };

  const builderRecords = useMemo(() => {
    type BuilderRecord = {
      date: string;
      value: number;
      frota?: string;
      empresa?: string;
      obra?: string;
      status?: string;
      responsavel?: string;
      produto?: string;
      origem?: string;
      acao?: string;
      tela?: string;
    };

    const inRange = (date: string) => (!builderStart || date >= builderStart) && (!builderEnd || date <= builderEnd);
    const equipmentInfo = (id: string, prefixoInformado?: string) => {
      const eq = equipamentos.find(item => item.id === id);
      const empresa = empresas.find(item => item.id === eq?.empresaId)?.nome;
      const obra = obras.find(item => item.id === eq?.localAtualId)?.nome;
      return { eq, empresa, obra, frota: eq?.prefixo || prefixoInformado || 'Sem prefixo' };
    };

    let records: BuilderRecord[] = [];
    if (builderSource === 'abastecimentos') {
      records = operationalFuel.map(item => {
        const info = equipmentInfo(item.equipamentoId, item.prefixoInformado);
        return {
          date: item.data,
          value: builderMetric === 'litros' ? (getOperationalFuelLiters(item) || 0) : 1,
          frota: info.frota,
          empresa: info.empresa || 'Sem empresa',
          obra: info.obra || 'Sem obra',
          status: item.status || 'OK',
          responsavel: item.responsavel || 'Sem responsável',
          produto: combustiveis.find(fuel => fuel.id === item.tipoCombustivelId)?.nome || 'Sem produto',
          origem: item.origem || 'Manual',
          tela: 'Combustível',
        };
      });
    } else if (builderSource === 'lubrificacoes') {
      records = lubrificacoes.map(item => {
        const info = equipmentInfo(item.equipamentoId);
        return {
          date: item.data,
          value: builderMetric === 'quantidade' || builderMetric === 'litros' ? Number(item.quantidade || 0) : 1,
          frota: info.frota,
          empresa: info.empresa || 'Sem empresa',
          obra: info.obra || 'Sem obra',
          status: item.status || 'OK',
          responsavel: item.responsavel || 'Sem responsável',
          produto: lubrificantes.find(prod => prod.id === item.produtoLubrificacaoId)?.nome || item.compartimento || 'Sem produto',
          origem: 'Manual',
          tela: 'Lubrificação',
        };
      });
    } else if (builderSource === 'presenca') {
      records = listasPresenca.map(item => {
        const presentes = item.funcionarios.filter(func => func.presente).length;
        return {
          date: item.data,
          value: builderMetric === 'equipe' || builderMetric === 'quantidade' ? presentes : 1,
          obra: obras.find(obra => obra.id === item.obraId)?.nome || 'Sem obra',
          status: `${presentes}/${item.funcionarios.length} presentes`,
          responsavel: item.responsavel || 'Sem responsável',
          produto: 'Presença',
          origem: 'Lista',
          tela: 'Presença',
        };
      });
    } else if (builderSource === 'manutencao') {
      records = ordensServico.map(item => {
        const info = equipmentInfo(item.equipamentoId);
        return {
          date: item.dataAbertura,
          value: builderMetric === 'custo' ? Number(item.custoFinal || item.custoEstimado || 0) : 1,
          frota: info.frota,
          empresa: info.empresa || 'Sem empresa',
          obra: info.obra || 'Sem obra',
          status: item.status,
          responsavel: item.responsavel || 'Sem responsável',
          produto: item.tipo,
          origem: item.prioridade,
          tela: 'Manutenção',
        };
      });
    } else if (builderSource === 'equipamentos') {
      records = equipamentos.map(item => ({
        date: todayStr,
        value: builderMetric === 'quantidade' ? Number(item.horasDisponiveis || 0) : 1,
        frota: item.prefixo,
        empresa: empresas.find(emp => emp.id === item.empresaId)?.nome || 'Sem empresa',
        obra: obras.find(obra => obra.id === item.localAtualId)?.nome || 'Sem obra',
        status: item.status,
        produto: item.tipo || 'Equipamento',
        origem: item.marca || 'Cadastro',
        tela: 'Equipamentos',
      }));
    } else {
      records = historyLogs.map(item => ({
        date: historyDateToIso(item.timestamp),
        value: 1,
        status: item.acao,
        responsavel: item.usuario || 'Operador',
        produto: item.tela,
        origem: item.acao,
        acao: item.acao,
        tela: item.tela,
      }));
    }

    return records.filter(item => inRange(item.date));
  }, [builderSource, builderMetric, builderStart, builderEnd, operationalFuel, lubrificacoes, listasPresenca, ordensServico, equipamentos, empresas, obras, combustiveis, lubrificantes, historyLogs, todayStr]);

  const builderData = useMemo(() => {
    const map = new Map<string, number>();
    builderRecords.forEach(record => {
      const key = builderGroup === 'dia' || builderGroup === 'mes'
        ? formatGroupDate(record.date)
        : record[builderGroup] || 'Não informado';
      map.set(key, (map.get(key) || 0) + record.value);
    });
    return Array.from(map.entries())
      .map(([name, valor]) => ({ name, valor }))
      .sort((a, b) => (builderGroup === 'dia' || builderGroup === 'mes' ? a.name.localeCompare(b.name) : b.valor - a.valor))
      .slice(0, 20);
  }, [builderRecords, builderGroup]);

  const builderTotal = builderData.reduce((sum, item) => sum + item.valor, 0);

  // Recharts colors for fuel types (shades of green and dark gray)
  const PIE_COLORS = ['#10b981', '#34d399', '#059669', '#047857', '#6ee7b7'];

  // 6. Dynamic Alerts & Pendencies
  const pendingAlerts: { id: string; type: 'warning' | 'info' | 'danger'; text: string; details: string; tab?: string }[] = [];

  const fuelRecordsForReview = abastecimentos.filter(item =>
    (item.status && item.status !== 'OK') ||
    !item.equipamentoId ||
    excludedFuelRecords.some(excluded => excluded.id === item.id) ||
    (item.alertas || []).some(alert => alert.severidade === 'critico' || alert.severidade === 'aviso')
  );
  if (fuelRecordsForReview.length > 0) {
    const unknownPrefixes = fuelRecordsForReview.filter(item => !item.equipamentoId).length;
    pendingAlerts.push({
      id: 'alert-fuel-review',
      type: fuelRecordsForReview.some(item => item.status === 'Erro de importação') ? 'danger' : 'warning',
      text: `${fuelRecordsForReview.length} abastecimento(s) para conferir`,
      details: excludedFuelRecords.length
        ? `${excludedFuelRecords.length} registro(s) foram preservados, mas ficaram fora dos indicadores por volume inválido, fora da faixa ou cancelamento.`
        : unknownPrefixes
        ? `${unknownPrefixes} lançamento(s) têm prefixo ainda não vinculado. Os dados foram preservados.`
        : 'Há divergências de bomba, leitura, quantidade ou possível duplicidade aguardando revisão.',
      tab: 'lancamentos',
    });
  }

  const activeSites = obras.filter(site => site.status === 'Ativa');
  const sitesWithoutAttendanceToday = activeSites.filter(site =>
    !listasPresenca.some(list => list.obraId === site.id && list.data === todayStr)
  );
  if (sitesWithoutAttendanceToday.length > 0) {
    pendingAlerts.push({
      id: 'alert-attendance-today',
      type: 'info',
      text: `${sitesWithoutAttendanceToday.length} obra(s) sem presença hoje`,
      details: sitesWithoutAttendanceToday.slice(0, 3).map(site => site.nome).join(', '),
      tab: 'presenca',
    });
  }

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
      details: `${eq ? eq.prefixo : 'Equipamento'} - ${os.descricao || os.tipo}`
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

  useGSAP(() => {
    const root = dashboardRef.current;
    if (!root) return;

    const mediaQuery = gsap.matchMedia();
    mediaQuery.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo('.dashboard-intro__content',
        { autoAlpha: 0, y: 44 },
        { autoAlpha: 1, y: 0, duration: 1.05, ease: 'power3.out' },
      );
      gsap.fromTo('.dashboard-intro__gallery figure',
        { autoAlpha: 0, scale: 0.82, y: 54 },
        { autoAlpha: 1, scale: 1, y: 0, duration: 1.15, stagger: 0.16, ease: 'power3.out', delay: 0.15 },
      );
      gsap.to('.dashboard-intro__backdrop', {
        scale: 1.08,
        filter: 'saturate(0.62) brightness(0.64)',
        ease: 'none',
        scrollTrigger: {
          trigger: '.dashboard-intro',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });

      gsap.utils.toArray<HTMLElement>('.gsap-media').forEach(media => {
        gsap.fromTo(media,
          { autoAlpha: 0.32, scale: 0.84 },
          {
            autoAlpha: 1,
            scale: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: media,
              start: 'top 88%',
              end: 'center 48%',
              scrub: true,
            },
          },
        );
      });

      if (window.matchMedia('(min-width: 1024px)').matches) {
        ScrollTrigger.create({
          trigger: '.motion-chapter',
          start: 'top 6rem',
          end: 'bottom bottom',
          pin: '.motion-chapter__pin',
          pinSpacing: false,
          anticipatePin: 1,
        });
      }
    });

    return () => mediaQuery.revert();
  }, { scope: dashboardRef });


  return (
    <div id="dashboard-tab" ref={dashboardRef}>
      
      {/* 1. Header Greetings */}
      <section className="dashboard-intro">
        <img className="dashboard-intro__backdrop" src={rodoviaDuplicada} alt="Vista aérea de rodovia duplicada em operação" />
        <div className="dashboard-intro__shade" />
        <div className="dashboard-intro__content">
          <p className="dashboard-intro__eyebrow">Sistema de controle operacional</p>
          <h1 className="dashboard-intro__title">Controle que acompanha a operação.</h1>
          <p className="dashboard-intro__copy">Monitoramento integrado das frentes de serviço, frota e indicadores críticos.</p>
          <div className="dashboard-intro__actions">
          <button 
            onClick={() => onNavigate('lancamentos')}
            className="dashboard-intro__primary"
          >
            Novo lançamento <ArrowUpRight className="h-4 w-4" />
          </button>
          <button 
            onClick={() => onNavigate('reports')}
            className="dashboard-intro__secondary"
          >
            Ver Relatórios
          </button>
          </div>
        </div>
        <div className="dashboard-intro__gallery" aria-label="Registros fotográficos da operação">
          <figure><img src={rodoviaSerra} alt="Trecho rodoviário em implantação" /></figure>
          <figure><img src={ponteConstrucao} alt="Ponte em construção" /></figure>
        </div>
      </section>

      <div className="operational-marquee" aria-hidden="true">
        <div className="operational-marquee__track">
          {[0, 1].map(copy => (
            <React.Fragment key={copy}>
              <span>Frota conectada</span><i />
              <span>Combustível rastreável</span><i />
              <span>Presença em campo</span><i />
              <span>Manutenção coordenada</span><i />
              <span>Relatórios consolidados</span><i />
            </React.Fragment>
          ))}
        </div>
      </div>

      <ExecutiveOverviewV27
        empresas={empresas}
        obras={obras}
        equipamentos={equipamentos}
        abastecimentos={abastecimentos}
        ticketsJazida={ticketsJazida}
        estacas={estacas}
        listasPresenca={listasPresenca}
        presencasLink={presencasLink}
        apontamentos={apontamentoRamoRegistros}
        ramos={apontamentoRamos}
        materiais={materiaisRegistros}
        ordensServico={ordensServico}
        partesDiarias={partesDiariasEquipamentos}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" id="dashboard-builder">
        <button type="button" onClick={() => setIsBuilderOpen(value => !value)} className="flex w-full flex-col gap-2 text-left md:flex-row md:items-center md:justify-between" aria-expanded={isBuilderOpen}>
          <div>
            <h2 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-700">
              <Activity className="h-4 w-4 text-emerald-600" />
              Personalizar análise
            </h2>
            <p className="mt-0.5 text-[10px] text-slate-500">Abra apenas quando precisar montar um gráfico por fonte, métrica e período.</p>
          </div>
          <span className="flex items-center gap-2 text-[10px] font-bold text-emerald-700">
            {builderRecords.length} registro(s)
            <ChevronDown className={`h-4 w-4 transition-transform ${isBuilderOpen ? 'rotate-180' : ''}`} />
          </span>
        </button>

        {isBuilderOpen && <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <label className="text-[10px] font-bold uppercase text-slate-500">
            Fonte
            <select
              value={builderSource}
              onChange={event => {
                const source = event.target.value as BuilderSource;
                setBuilderSource(source);
                if (source === 'abastecimentos') setBuilderMetric('litros');
                else if (source === 'presenca') setBuilderMetric('equipe');
                else if (source === 'manutencao') setBuilderMetric('count');
                else setBuilderMetric('count');
              }}
              className="mt-1 h-10 w-full rounded-md border border-slate-800 bg-slate-950 px-3 text-xs text-white outline-none focus:border-emerald-500"
            >
              {sourceOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase text-slate-500">
            Métrica
            <select
              value={builderMetric}
              onChange={event => setBuilderMetric(event.target.value as BuilderMetric)}
              className="mt-1 h-10 w-full rounded-md border border-slate-800 bg-slate-950 px-3 text-xs text-white outline-none focus:border-emerald-500"
            >
              {metricOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase text-slate-500">
            Agrupar por
            <select
              value={builderGroup}
              onChange={event => setBuilderGroup(event.target.value as BuilderGroup)}
              className="mt-1 h-10 w-full rounded-md border border-slate-800 bg-slate-950 px-3 text-xs text-white outline-none focus:border-emerald-500"
            >
              {groupOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase text-slate-500">
            Data inicial
            <input
              type="date"
              value={builderStart}
              onChange={event => setBuilderStart(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-slate-800 bg-slate-950 px-3 text-xs text-white outline-none focus:border-emerald-500"
            />
          </label>
          <label className="text-[10px] font-bold uppercase text-slate-500">
            Data final
            <input
              type="date"
              value={builderEnd}
              onChange={event => setBuilderEnd(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-slate-800 bg-slate-950 px-3 text-xs text-white outline-none focus:border-emerald-500"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
          <div className="h-72 rounded-xl border border-slate-800 bg-slate-950 p-3">
            {builderData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">Sem dados para o filtro escolhido.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={builderData} margin={{ top: 10, right: 14, left: -20, bottom: 26 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} interval={0} angle={-18} textAnchor="end" height={48} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', color: '#0f172a', boxShadow: '0 12px 28px rgba(15,23,42,.14)' }} labelStyle={{ color: '#334155', fontWeight: 700 }} itemStyle={{ color: '#047857', fontSize: '11px' }} />
                  <Bar dataKey="valor" fill="#34d399" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="max-h-72 overflow-auto rounded-xl border border-slate-800 bg-slate-950">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-900 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Grupo</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {builderData.map(item => (
                  <tr key={item.name}>
                    <td className="px-3 py-2 text-slate-300">{item.name}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-white">{item.valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                {!builderData.length && (
                  <tr><td colSpan={2} className="px-3 py-8 text-center text-slate-500">Nada encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>}
      </section>

      <section className="motion-chapter">
        <header className="motion-chapter__pin">
          <p>Operação de campo</p>
          <h2>Do canteiro à decisão.</h2>
          <span>Imagens reais e indicadores percorrem o mesmo fluxo operacional.</span>
        </header>
        <div className="motion-chapter__flow">
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
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', color: '#0f172a', boxShadow: '0 12px 28px rgba(15,23,42,.14)' }}
                    labelStyle={{ color: '#334155', fontWeight: 'bold', fontSize: '11px' }}
                    itemStyle={{ color: '#047857', fontSize: '12px' }}
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
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', color: '#0f172a', boxShadow: '0 12px 28px rgba(15,23,42,.14)' }}
                    itemStyle={{ color: '#047857', fontSize: '11px' }}
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

        <figure className="dashboard-fleet-visual gsap-media">
          <img src={rodoviaSerra} alt="Infraestrutura rodoviária acompanhada pelo sistema" />
          <figcaption><strong>Dados conectados ao campo.</strong></figcaption>
        </figure>

      </div>
        </div>
      </section>

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
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', color: '#0f172a', boxShadow: '0 12px 28px rgba(15,23,42,.14)' }}
                    itemStyle={{ color: '#047857', fontSize: '11px' }}
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
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', color: '#0f172a', boxShadow: '0 12px 28px rgba(15,23,42,.14)' }}
                    itemStyle={{ color: '#047857', fontSize: '11px' }}
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
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', color: '#0f172a', boxShadow: '0 12px 28px rgba(15,23,42,.14)' }}
                    itemStyle={{ color: '#047857', fontSize: '11px' }}
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
                <p className="text-[10px] text-slate-500">Toda a frota está atualizada e sem alertas críticos.</p>
              </div>
            ) : (
              pendingAlerts.map(alert => {
                const borderClass = alert.type === 'danger' 
                  ? 'border-rose-500/20 bg-rose-500/5 text-rose-400' 
                  : alert.type === 'warning' 
                  ? 'border-amber-500/20 bg-amber-500/5 text-amber-400' 
                  : 'border-blue-500/20 bg-blue-500/5 text-blue-400';

                return (
                  <button key={alert.id} type="button" onClick={() => alert.tab && onNavigate(alert.tab)} className={`block w-full border p-3 rounded-xl space-y-1 text-left ${borderClass} ${alert.tab ? 'cursor-pointer hover:brightness-125' : 'cursor-default'}`}>
                    <div className="flex items-start gap-1.5 justify-between">
                      <span className="text-xxs font-black uppercase tracking-wider block">{alert.text}</span>
                    </div>
                    <p className="text-xxs text-slate-400 leading-relaxed">{alert.details}</p>
                  </button>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* 5. Operational audit log */}
      <div className="grid grid-cols-1 gap-6" id="operational-audit-row">
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

      <section className="dashboard-action">
        <div>
          <p>Controle integrado</p>
          <h2>
            Transforme obra
            <span className="dashboard-action__inline-image"><img src={ponteConstrucao} alt="" /></span>
            em decisão confiável.
          </h2>
        </div>
        <div className="dashboard-action__buttons">
          <button type="button" onClick={() => onNavigate('consulta-geral')}>Abrir Consulta Geral <ArrowUpRight className="h-4 w-4" /></button>
          <button type="button" onClick={() => onNavigate('reports')}>Gerar Relatórios</button>
        </div>
      </section>

    </div>
  );
}
