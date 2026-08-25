import React, { useMemo, useState } from 'react';
import { Banknote, Fuel, Hammer, HardHat, Package, Truck, Wrench } from 'lucide-react';
import type {
  Abastecimento, ApontamentoRamo, ApontamentoRamoRegistro, ControleEstacas, Empresa, Equipamento,
  ListaPresenca, MaterialRegistro, ObraLocal, OrdemServico, ParteDiariaEquipamento,
  PresencaApontamento, TicketJazida,
} from '../types';
import { buildExecutiveAnalytics } from '../utils/executiveAnalytics';

type Props = {
  empresas: Empresa[]; obras: ObraLocal[]; equipamentos: Equipamento[]; abastecimentos: Abastecimento[];
  ticketsJazida: TicketJazida[]; estacas: ControleEstacas; listasPresenca: ListaPresenca[];
  presencasLink: PresencaApontamento[]; apontamentos: ApontamentoRamoRegistro[]; ramos: ApontamentoRamo[];
  materiais: MaterialRegistro[]; ordensServico: OrdemServico[]; partesDiarias: ParteDiariaEquipamento[];
};

const monthRange = () => {
  const date = new Date();
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const iso = (value: Date) => new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
};

export default function ExecutiveOverviewV27(props: Props) {
  const range = monthRange();
  const [dataInicio, setDataInicio] = useState(range.start);
  const [dataFim, setDataFim] = useState(range.end);
  const [obraId, setObraId] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [ramo, setRamo] = useState('');
  const analytics = useMemo(() => buildExecutiveAnalytics({
    equipamentos: props.equipamentos,
    abastecimentos: props.abastecimentos,
    ticketsJazida: props.ticketsJazida,
    estacas: props.estacas,
    listasPresenca: props.listasPresenca,
    presencasLink: props.presencasLink,
    apontamentos: props.apontamentos,
    materiais: props.materiais,
    ordensServico: props.ordensServico,
    partesDiarias: props.partesDiarias,
    filters: { dataInicio, dataFim, obraId, empresaId, ramo },
  }), [props, dataInicio, dataFim, obraId, empresaId, ramo]);
  const cards = [
    { label: 'Combustível', value: `${analytics.combustivel.litros.toLocaleString('pt-BR')} L`, detail: `${analytics.combustivel.pendencias} pendências`, icon: Fuel },
    { label: 'Viagens', value: analytics.viagens.registros, detail: `${analytics.viagens.volumeM3.toLocaleString('pt-BR')} m³`, icon: Truck },
    { label: 'Estacas', value: `${analytics.estacas.cravadoM.toLocaleString('pt-BR')} m`, detail: `${analytics.estacas.sobraM.toLocaleString('pt-BR')} m de saldo`, icon: Hammer },
    { label: 'Produção', value: analytics.producao.apontamentos, detail: `${analytics.producao.pessoasApontadas} pessoas apontadas`, icon: HardHat },
    { label: 'Materiais', value: analytics.materiais.registros, detail: `${analytics.materiais.divergencias} divergências`, icon: Package },
    { label: 'Manutenção', value: analytics.equipamentos.manutencao, detail: 'Ordens e disponibilidade da frota', icon: Wrench },
    { label: 'Custo consolidado', value: `R$ ${analytics.custos.total.toLocaleString('pt-BR')}`, detail: 'Materiais + manutenção + estacas', icon: Banknote },
  ];

  return (
    <section className="executive-overview">
      <aside className="executive-command">
        <p>Comando executivo</p>
        <h2>Operação consolidada</h2>
        <span>Refine a leitura sem alterar os registros de origem.</span>
      <div className="executive-filters">
        <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="input-dark" />
        <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="input-dark" />
        <select value={obraId} onChange={e => setObraId(e.target.value)} className="input-dark"><option value="">Todas as obras</option>{props.obras.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
        <select value={empresaId} onChange={e => setEmpresaId(e.target.value)} className="input-dark"><option value="">Todas as empresas</option>{props.empresas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
        <select value={ramo} onChange={e => setRamo(e.target.value)} className="input-dark"><option value="">Todos os ramos</option>{props.ramos.map(item => <option key={item.id} value={item.id}>{item.ramoNome}</option>)}</select>
      </div>
      </aside>
      <div className="executive-surface">
        <div className="executive-surface__heading"><p>Indicadores do período</p><span>Dados do sistema</span></div>
      <div className="executive-metrics">
        {cards.map(({ label, value, detail, icon: Icon }) => <div key={label} className="executive-metric"><div className="executive-metric__icon"><Icon className="h-4 w-4" strokeWidth={1.7} /></div><p className="executive-metric__label">{label}</p><p className="executive-metric__value">{value}</p><p className="executive-metric__detail">{detail}</p></div>)}
      </div>
      </div>
    </section>
  );
}
