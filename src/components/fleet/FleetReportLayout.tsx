import React from 'react';
import type { FleetCurrentState, FleetReportViewModel } from '../../fleet/domain';
import reneaLogo from '../../assets/images/renea_logo_new.png';
import spmarLogo from '../../assets/images/spmar_logo.png';

interface Props {
  viewModel: FleetReportViewModel;
}

const metrics = (viewModel: FleetReportViewModel) => [
  { label: 'Data', value: viewModel.reportDateLabel, className: 'bg-slate-100' },
  { label: 'Total CBs', value: viewModel.metrics.total, className: 'bg-slate-100' },
  { label: 'Em operação', value: viewModel.metrics.operating, className: 'bg-emerald-50' },
  { label: 'Em manutenção', value: viewModel.metrics.maintenance + viewModel.metrics.waitingMaintenance, className: 'bg-rose-50' },
  { label: 'À disposição', value: viewModel.metrics.available, className: 'bg-sky-50' },
  { label: 'Horas paradas', value: viewModel.metrics.stoppedDurationLabel, className: 'bg-amber-50' },
];

function ReportHeader({ viewModel }: Props) {
  return (
    <>
      <header className="grid grid-cols-[120px_1fr_120px] items-center gap-4">
        <img src={reneaLogo} alt="RENEA" className="max-h-12 max-w-[110px] object-contain object-left" />
        <div className="text-center"><h1 className="text-base font-black uppercase tracking-wide text-slate-900">Relatório Diário de Situação Operacional</h1><h2 className="text-sm font-black uppercase text-slate-800">dos Caminhões Basculantes (CBs)</h2><p className="mt-1 text-[10px] text-slate-500">{viewModel.operationName}</p></div>
        <img src={spmarLogo} alt="SPMAR" className="ml-auto max-h-12 max-w-[110px] object-contain object-right" />
      </header>
      <div className="mt-2 h-1 bg-emerald-700" />
      <div className="mt-2 grid grid-cols-6 gap-1">{metrics(viewModel).map(metric=><div key={metric.label} className={`border border-slate-300 px-2 py-1 text-center ${metric.className}`}><p className="text-[8px] font-black uppercase text-slate-500">{metric.label}</p><strong className="text-sm text-slate-900">{metric.value}</strong></div>)}</div>
    </>
  );
}

function EmptyReportRow({ columns, text }: { columns: number; text: string }) {
  return <tr><td colSpan={columns} className="border border-slate-300 px-2 py-6 text-center text-xs text-slate-500">{text}</td></tr>;
}

function OperationTable({ rows }: { rows: FleetCurrentState[] }) {
  return (
    <section className="mt-3"><h3 className="border border-slate-300 bg-slate-200 px-2 py-1 text-[10px] font-black uppercase text-slate-800">Operação - Alto Tietê</h3><table className="w-full table-fixed border-collapse text-[9px]"><colgroup><col className="w-[10%]"/><col className="w-[20%]"/><col className="w-[9%]"/><col className="w-[13%]"/><col className="w-[11%]"/><col className="w-[11%]"/><col className="w-[26%]"/></colgroup><thead><tr className="bg-slate-100">{['Matrícula','Nome / Motorista','Prefixo','Status Atual','Saída / Aracaré','Tempo Parado','Observação'].map(label=><th key={label} className="border border-slate-300 px-1 py-1 font-black">{label}</th>)}</tr></thead><tbody>{rows.map((state,index)=><tr key={state.recordId} className={index%2?'bg-slate-50':'bg-white'}><td className="border border-slate-300 px-1 py-1 text-center">{state.driver?.employeeCode||'—'}</td><td className="border border-slate-300 px-1 py-1">{state.driver?.employeeName||'Sem motorista'}</td><td className="border border-slate-300 px-1 py-1 text-center font-black">{state.equipment.prefix}</td><td className="border border-slate-300 px-1 py-1 text-center font-bold text-emerald-700">{state.operationalStatus}</td><td className="border border-slate-300 px-1 py-1 text-center">{state.departureTime||'—'}</td><td className="border border-slate-300 px-1 py-1 text-center">{state.stoppedDurationLabel}</td><td className="break-words border border-slate-300 px-1 py-1 leading-4">{state.note||state.maintenanceReason||'—'}</td></tr>)}{!rows.length&&<EmptyReportRow columns={7} text="Nenhum CB em operação neste período."/>}</tbody></table></section>
  );
}

function MaintenanceTable({ rows }: { rows: FleetCurrentState[] }) {
  return <section className="mt-3"><h3 className="border border-slate-300 bg-slate-200 px-2 py-1 text-[10px] font-black uppercase text-slate-800">CBs em manutenção</h3><table className="w-full table-fixed border-collapse text-[9px]"><colgroup><col className="w-[12%]"/><col className="w-[12%]"/><col className="w-[14%]"/><col className="w-[18%]"/><col className="w-[44%]"/></colgroup><thead><tr className="bg-slate-100">{['Prefixo','Entrada','Tempo Parado','Status Atual','Ocorrência / Motivo'].map(label=><th key={label} className="border border-slate-300 px-1 py-1 font-black">{label}</th>)}</tr></thead><tbody>{rows.map(state=><tr key={state.recordId} className="bg-rose-50/60"><td className="border border-slate-300 px-1 py-1 text-center font-black">{state.equipment.prefix}</td><td className="border border-slate-300 px-1 py-1 text-center">{state.maintenanceEntryTime||'Não informado'}</td><td className="border border-slate-300 px-1 py-1 text-center">{state.stoppedDurationLabel}</td><td className="border border-slate-300 px-1 py-1 text-center font-bold text-rose-700">{state.operationalStatus}</td><td className="break-words border border-slate-300 px-1 py-1 leading-4">{state.maintenanceReason||state.note||'Não informado'}</td></tr>)}{!rows.length&&<EmptyReportRow columns={5} text="Nenhum CB em manutenção."/>}</tbody></table></section>;
}

function AvailableTable({ rows }: { rows: FleetCurrentState[] }) {
  return <section className="mt-3"><h3 className="border border-slate-300 bg-slate-200 px-2 py-1 text-[10px] font-black uppercase text-slate-800">CBs à disposição</h3><table className="w-full table-fixed border-collapse text-[9px]"><colgroup><col className="w-[10%]"/><col className="w-[20%]"/><col className="w-[9%]"/><col className="w-[13%]"/><col className="w-[10%]"/><col className="w-[11%]"/><col className="w-[27%]"/></colgroup><thead><tr className="bg-slate-100">{['Matrícula','Nome / Motorista','Prefixo','Status Atual','Desde','Tempo Parado','Observação'].map(label=><th key={label} className="border border-slate-300 px-1 py-1 font-black">{label}</th>)}</tr></thead><tbody>{rows.map(state=><tr key={state.recordId} className="bg-sky-50/60"><td className="border border-slate-300 px-1 py-1 text-center">{state.driver?.employeeCode||'—'}</td><td className="border border-slate-300 px-1 py-1">{state.driver?.employeeName||'Sem motorista'}</td><td className="border border-slate-300 px-1 py-1 text-center font-black">{state.equipment.prefix}</td><td className="border border-slate-300 px-1 py-1 text-center font-bold text-sky-700">{state.operationalStatus}</td><td className="border border-slate-300 px-1 py-1 text-center">{state.availableSince||state.releaseTime||'—'}</td><td className="border border-slate-300 px-1 py-1 text-center">{state.stoppedDurationLabel}</td><td className="break-words border border-slate-300 px-1 py-1 leading-4">{state.note||'—'}</td></tr>)}{!rows.length&&<EmptyReportRow columns={7} text="Nenhum CB à disposição."/>}</tbody></table></section>;
}

function ReportFooter({ page, viewModel }: { page: number; viewModel: FleetReportViewModel }) {
  return <footer className="mt-auto flex justify-between border-t border-slate-300 pt-1 text-[8px] text-slate-500"><span>{viewModel.companyLabel} · Gerado pelo Sistema RENEA</span><span>Página {page} de 2</span></footer>;
}

export default function FleetReportLayout({ viewModel }: Props) {
  return (
    <section id="fleet-print-report" className="hidden print:block">
      <article className="fleet-report-page"><ReportHeader viewModel={viewModel}/><OperationTable rows={viewModel.operating}/><ReportFooter page={1} viewModel={viewModel}/></article>
      <article className="fleet-report-page break-before-page"><ReportHeader viewModel={viewModel}/><MaintenanceTable rows={viewModel.maintenance}/><AvailableTable rows={viewModel.available}/><ReportFooter page={2} viewModel={viewModel}/></article>
    </section>
  );
}
