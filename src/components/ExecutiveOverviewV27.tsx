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
    { label: 'Manutenção', value: analytics.equipamentos.manutencao, detail: `${analytics.equipamentos.partesPendentes} partes pendentes`, icon: Wrench },
    { label: 'Custo consolidado', value: `R$ ${analytics.custos.total.toLocaleString('pt-BR')}`, detail: 'Materiais + manutenção + estacas', icon: Banknote },
  ];

  return (
    <section className="space-y-4 rounded-2xl border border-emerald-500/20 bg-slate-950 p-5">
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">ERP v2.7 · Painel executivo</p>
        <h2 className="text-xl font-black text-white">Operação consolidada</h2>
      </div>
      <div className="grid gap-2 md:grid-cols-5">
        <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="input-dark" />
        <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="input-dark" />
        <select value={obraId} onChange={e => setObraId(e.target.value)} className="input-dark"><option value="">Todas as obras</option>{props.obras.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
        <select value={empresaId} onChange={e => setEmpresaId(e.target.value)} className="input-dark"><option value="">Todas as empresas</option>{props.empresas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
        <select value={ramo} onChange={e => setRamo(e.target.value)} className="input-dark"><option value="">Todos os ramos</option>{props.ramos.map(item => <option key={item.id} value={item.id}>{item.ramoNome}</option>)}</select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, detail, icon: Icon }) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</p><Icon className="h-4 w-4 text-emerald-400" /></div><p className="mt-2 text-xl font-black text-white">{value}</p><p className="mt-1 text-[10px] text-slate-500">{detail}</p></div>)}
      </div>
    </section>
  );
}
