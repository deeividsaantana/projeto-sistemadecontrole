import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import type { Abastecimento, ControleEstacas, Equipamento, Funcionario, PresencaApontamento, TicketJazida } from '../types';
import { generateUniversalPdfReport, type UniversalPdfColumn } from '../utils/universalPdfReport';

type Props = {
  abastecimentos: Abastecimento[]; estacas: ControleEstacas; tickets: TicketJazida[];
  equipamentos: Equipamento[]; funcionarios: Funcionario[]; presencas: PresencaApontamento[];
  dataInicio: string; dataFim: string;
};
type Report = { id: string; label: string; columns: UniversalPdfColumn[]; rows: object[] };
const periodFilter = (start: string, end: string) => (item: { data?: string }) => (!start || !item.data || item.data >= start) && (!end || !item.data || item.data <= end);

export default function UniversalPdfCenter(props: Props) {
  const [generating, setGenerating] = useState('');
  const within = periodFilter(props.dataInicio, props.dataFim);
  const reports: Report[] = [
    { id: 'abastecimentos', label: 'Combustível / Abastecimentos', columns: [['Data','data'],['Hora','hora'],['Prefixo','prefixo'],['Litros','litros'],['Bomba inicial','bombaInicial'],['Bomba final','bombaFinal'],['Responsável','responsavel']].map(([header,dataKey])=>({header,dataKey})), rows: props.abastecimentos.filter(within).map(item => ({ ...item, prefixo: item.prefixoInformado || item.equipamentoId, litros: item.quantidadeLitros })) },
    { id: 'cravacoes', label: 'Cravações', columns: [['Data','data'],['Estaca','identificacao'],['Perfil','perfil'],['Comprimento (m)','comprimentoM'],['Cravado (m)','comprimentoCravadoM'],['Sobra (m)','sobraM'],['Responsável','responsavel']].map(([header,dataKey])=>({header,dataKey})), rows: props.estacas.cravacoes.filter(within) },
    { id: 'estacas', label: 'Estacas / Lotes', columns: [['Data','data'],['NF','notaFiscal'],['Material','descricao'],['Perfil','perfilModelo'],['Comprimento (m)','comprimentoM'],['Peso (kg)','pesoKg'],['Status','status']].map(([header,dataKey])=>({header,dataKey})), rows: props.estacas.lotes.filter(within) },
    { id: 'jazida', label: 'Jazida / Tickets', columns: [['Data','data'],['Ticket','ticketNumero'],['Material','tipoMaterial'],['Quantidade (m³)','quantidadeM3'],['Placa','placa'],['Status','statusFluxo'],['Responsável','responsavel']].map(([header,dataKey])=>({header,dataKey})), rows: props.tickets.filter(within).map(item => ({ ...item, responsavel: item.responsavelLiberacao })) },
    { id: 'equipamentos', label: 'Equipamentos', columns: [['Prefixo','prefixo'],['Equipamento','nome'],['Tipo','tipo'],['Marca','marca'],['Modelo','modelo'],['Placa/Série','seriePlaca'],['Status','status']].map(([header,dataKey])=>({header,dataKey})), rows: props.equipamentos },
    { id: 'efetivo', label: 'Efetivo', columns: [['Data','data'],['Colaborador','funcionarioNome'],['Função','funcao'],['Grupo','grupoNome'],['Status','status'],['Responsável','responsavel'],['Frente','frenteServico']].map(([header,dataKey])=>({header,dataKey})), rows: props.presencas.filter(within) },
    { id: 'colaboradores', label: 'Colaboradores / Cadastros', columns: [['Matrícula','matricula'],['Colaborador','nome'],['Função','cargo'],['Área','area'],['Líder','liderNome'],['Responsável','responsavelArea'],['Status','statusExibicao']].map(([header,dataKey])=>({header,dataKey})), rows: props.funcionarios.map(item => ({ ...item, statusExibicao: item.status || (item.ativo ? 'ATIVO' : 'INATIVO') })) },
  ];
  const exportReport = async (report: Report) => {
    setGenerating(report.id);
    try { await generateUniversalPdfReport({ title: `Relatório de ${report.label}`, columns: report.columns, rows: report.rows, period: `${props.dataInicio.split('-').reverse().join('/')} a ${props.dataFim.split('-').reverse().join('/')}`, filters: ['Dados atuais do sistema', `Período: ${props.dataInicio} a ${props.dataFim}`], summary: [{ label: 'Registros', value: report.rows.length }], orientation: report.columns.length > 7 ? 'landscape' : 'portrait' }); }
    finally { setGenerating(''); }
  };
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm print:hidden"><div className="mb-4"><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-700">Padrão institucional único</p><h2 className="text-xl font-black text-slate-900">Central universal de PDFs</h2><p className="text-xs text-slate-500">Todos os módulos usam o mesmo cabeçalho, logo, metadados, tabela, paginação e rodapé.</p></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{reports.map(report => <button key={report.id} type="button" disabled={Boolean(generating)} onClick={() => void exportReport(report)} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-emerald-400 hover:shadow-sm disabled:opacity-50"><span className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><FileText className="h-4 w-4"/></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-800">{report.label}</strong><span className="text-[10px] text-slate-500">{report.rows.length} registro(s)</span></span><span className="text-[10px] font-black text-emerald-700">{generating === report.id ? 'GERANDO...' : 'PDF'}</span></button>)}</div></section>;
}
