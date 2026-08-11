import React, { useMemo, useState } from 'react';
import { Building2, Fuel, HardHat, Package, Search, TicketCheck, Truck, Users } from 'lucide-react';
import type { Abastecimento, Empresa, Equipamento, Funcionario, MaterialRegistro, ObraLocal, OrdemServico, ParteDiariaEquipamento, TicketJazida, VinculoOperadorEquipamento } from '../types';

type GeneralRow = {
  id: string;
  module: string;
  title: string;
  detail: string;
  meta: string;
  status: string;
  driver?: string;
  tab: string;
};

type Props = {
  empresas: Empresa[];
  obras: ObraLocal[];
  equipamentos: Equipamento[];
  funcionarios: Funcionario[];
  abastecimentos: Abastecimento[];
  tickets: TicketJazida[];
  materiais: MaterialRegistro[];
  ordensServico: OrdemServico[];
  partesDiarias: ParteDiariaEquipamento[];
  vinculos: VinculoOperadorEquipamento[];
  onLink: (funcionarioId: string, equipamentoId: string, observacao?: string) => void;
  onUnlink: (vinculoId: string) => void;
  onNavigate: (tab: string) => void;
};

const normalize = (value: unknown) => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

export default function ConsultaGeralTab({ empresas, obras, equipamentos, funcionarios, abastecimentos, tickets, materiais, ordensServico, partesDiarias, vinculos, onLink, onUnlink, onNavigate }: Props) {
  const [query, setQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [linkEmployee, setLinkEmployee] = useState('');
  const [linkEquipment, setLinkEquipment] = useState('');
  const [linkNote, setLinkNote] = useState('');

  const rows = useMemo<GeneralRow[]>(() => {
    const today = new Date().toISOString().slice(0, 10);
    const equipmentStatus = (equipment: Equipamento) => {
      const openOrder = ordensServico.find(order => order.equipamentoId === equipment.id && !['Concluída', 'Cancelada'].includes(order.status));
      if (openOrder?.status === 'Aguardando Peça') return 'Aguardando manutenção';
      if (openOrder) return 'Em manutenção';
      const latestPart = partesDiarias.filter(part => part.equipamentoId === equipment.id).sort((a, b) => `${b.data}|${b.atualizadoEm}`.localeCompare(`${a.data}|${a.atualizadoEm}`))[0];
      if (latestPart?.data === today && latestPart.totalHorasTrabalhadas > 0) return 'Em serviço';
      if (equipment.status === 'Mobilizado' || equipment.status === 'Ativo') return 'Mobilizado';
      if (equipment.status === 'Desmobilizado') return 'Desmobilizado';
      if (equipment.status === 'Parado') return 'Equipamento parado';
      if (equipment.status === 'Esperando motorista') return 'Aguardando motorista';
      if (equipment.status === 'Manutenção') return 'Em manutenção';
      return equipment.status;
    };
    const linkedDriver = (equipment: Equipamento) => {
      const activeLink = vinculos.find(link => link.equipamentoId === equipment.id && link.status === 'ATIVO');
      const latestPart = partesDiarias.filter(part => part.equipamentoId === equipment.id && part.operadorNome).sort((a, b) => `${b.data}|${b.atualizadoEm}`.localeCompare(`${a.data}|${a.atualizadoEm}`))[0];
      return activeLink?.funcionarioNome || latestPart?.operadorNome || equipment.operadorResponsavelNome || funcionarios.find(person => person.id === equipment.operadorResponsavelId)?.nome || 'Motorista não vinculado';
    };
    return [
    ...empresas.map(item => ({ id: `empresa-${item.id}`, module: 'Empresas', title: item.nome, detail: item.cnpj || 'CNPJ não informado', meta: item.responsavel || 'Responsável não informado', status: item.status || 'ATIVO', tab: 'cadastros' })),
    ...obras.map(item => ({ id: `obra-${item.id}`, module: 'Obras', title: item.nome, detail: item.endereco || 'Endereço não informado', meta: item.responsavel || 'Responsável não informado', status: item.status, tab: 'cadastros' })),
    ...equipamentos.map(item => ({ id: `equipamento-${item.id}`, module: 'Frota', title: `${item.prefixo || 'Sem prefixo'} · ${item.nome}`, detail: [item.marca, item.modelo, item.placa || item.seriePlaca].filter(Boolean).join(' · ') || 'Identificação incompleta', meta: `${item.tipo || item.categoriaFrota || 'Equipamento'} · ${linkedDriver(item)}`, driver: linkedDriver(item), status: equipmentStatus(item), tab: 'manutencao' })),
    ...funcionarios.map(item => { const linked = equipamentos.filter(equipment => equipment.operadorResponsavelId === item.id || normalize(equipment.operadorResponsavelNome) === normalize(item.nome)); return { id: `funcionario-${item.id}`, module: 'Colaboradores', title: item.nome, detail: [item.matricula, item.cargo].filter(Boolean).join(' · '), meta: linked.length ? `Frota vinculada: ${linked.map(eq => eq.prefixo).join(', ')}` : [item.area, item.liderNome].filter(Boolean).join(' · ') || 'Sem equipamento vinculado', status: item.status || (item.ativo ? 'ATIVO' : 'INATIVO'), tab: 'cadastros' }; }),
    ...abastecimentos.map(item => ({ id: `abastecimento-${item.id}`, module: 'Combustível', title: `${item.prefixoInformado || equipamentos.find(eq => eq.id === item.equipamentoId)?.prefixo || 'Sem prefixo'} · ${item.quantidadeLitros} L`, detail: `${item.data} ${item.hora || ''}`.trim(), meta: item.responsavel || item.origem || 'Origem não informada', status: item.status || 'OK', tab: 'lancamentos' })),
    ...tickets.map(item => ({ id: `ticket-${item.id}`, module: 'Tickets', title: `Ticket ${item.ticketNumero || 'sem número'}`, detail: `${item.prefixo || 'Sem prefixo'} · ${item.placa || 'Sem placa'}`, meta: `${item.data} · ${item.tipoMaterial || 'Material não informado'}`, status: item.statusFluxo || item.status || 'Pendente', tab: 'tickets-jazida' })),
    ...materiais.map(item => ({ id: `material-${item.id}`, module: 'Materiais', title: item.material || 'Material sem descrição', detail: `${item.quantidade || 0} ${item.unidade || ''}`.trim(), meta: [item.data, item.fornecedor, item.nota].filter(Boolean).join(' · '), status: item.status || 'Registrado', tab: 'materiais' })),
    ];
  }, [empresas, obras, equipamentos, funcionarios, abastecimentos, tickets, materiais, ordensServico, partesDiarias, vinculos]);

  const modules = ['Todos', ...Array.from(new Set(rows.map(row => row.module)))];
  const statuses = ['Todos', ...Array.from(new Set(rows.map(row => row.status).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  const filtered = useMemo(() => {
    const term = normalize(query);
    return rows.filter(row => (moduleFilter === 'Todos' || row.module === moduleFilter)
      && (statusFilter === 'Todos' || row.status === statusFilter)
      && (!term || normalize(`${row.title} ${row.detail} ${row.meta} ${row.status}`).includes(term)))
      .slice(0, 250);
  }, [rows, moduleFilter, statusFilter, query]);

  const cards = [
    ['Empresas', empresas.length, Building2], ['Obras', obras.length, HardHat], ['Frota', equipamentos.length, Truck],
    ['Colaboradores', funcionarios.length, Users], ['Combustível', abastecimentos.length, Fuel], ['Tickets', tickets.length, TicketCheck], ['Materiais', materiais.length, Package],
  ] as const;

  return (
    <div className="space-y-5" id="consulta-geral-tab">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Central de consulta operacional</span>
        <h1 className="mt-2 text-2xl font-black text-slate-900">Consulta Geral</h1>
        <p className="mt-1 text-sm text-slate-500">Localize cadastros e movimentos de todo o sistema sem abrir cada módulo.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px_220px]">
          <label className="relative min-w-0">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar nome, prefixo, placa, matrícula, ticket, NF, material..." className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/10" />
          </label>
          <select value={moduleFilter} onChange={event => setModuleFilter(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500">
            {modules.map(module => <option key={module}>{module}</option>)}
          </select>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500">
            {statuses.map(status => <option key={status}>{status}</option>)}
          </select>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {cards.map(([label, value, Icon]) => <button key={label} type="button" onClick={() => setModuleFilter(label)} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md"><Icon className="h-5 w-5 text-emerald-600" /><strong className="mt-3 block text-2xl font-black text-slate-900">{value}</strong><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span></button>)}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between"><div><h2 className="text-sm font-black text-slate-900">Vínculo motorista ↔ equipamento</h2><p className="mt-1 text-xs text-slate-500">Fonte canônica em tempo real; um novo vínculo encerra automaticamente o vínculo anterior do colaborador ou da frota.</p></div><span className="text-xs font-black text-emerald-700">{vinculos.filter(link => link.status === 'ATIVO').length} vínculo(s) ativo(s)</span></div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <select value={linkEmployee} onChange={event => setLinkEmployee(event.target.value)} className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"><option value="">Selecione o colaborador</option>{funcionarios.filter(item => item.ativo && !['INATIVO', 'DESMOBILIZADO'].includes(item.status || '')).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).map(item => <option key={item.id} value={item.id}>{item.nome} · {item.matricula || item.cargo}</option>)}</select>
          <select value={linkEquipment} onChange={event => setLinkEquipment(event.target.value)} className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"><option value="">Selecione o equipamento</option>{equipamentos.filter(item => item.status !== 'Desmobilizado').sort((a,b)=>a.prefixo.localeCompare(b.prefixo,'pt-BR',{numeric:true})).map(item => <option key={item.id} value={item.id}>{item.prefixo} · {item.nome} · {item.status}</option>)}</select>
          <input value={linkNote} onChange={event => setLinkNote(event.target.value)} placeholder="Observação do vínculo" className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700" />
          <button type="button" disabled={!linkEmployee || !linkEquipment} onClick={() => { onLink(linkEmployee, linkEquipment, linkNote); setLinkNote(''); }} className="h-11 rounded-xl bg-emerald-600 px-5 text-xs font-black text-white disabled:opacity-40">Confirmar vínculo</button>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-slate-50 text-[9px] uppercase tracking-wider text-slate-500"><tr><th className="p-3">Colaborador</th><th>Equipamento</th><th>Início</th><th>Fim</th><th>Responsável</th><th>Status</th><th className="pr-3 text-right">Ação</th></tr></thead><tbody className="divide-y divide-slate-100">{vinculos.slice(0,100).map(link => <tr key={link.id}><td className="p-3 font-bold text-slate-900">{link.funcionarioNome}</td><td className="font-mono font-black text-emerald-700">{link.equipamentoPrefixo}</td><td>{new Date(link.inicioEm).toLocaleString('pt-BR')}</td><td>{link.fimEm ? new Date(link.fimEm).toLocaleString('pt-BR') : '—'}</td><td>{link.responsavelAlteracao}</td><td><span className={`rounded-full px-2 py-1 text-[9px] font-black ${link.status === 'ATIVO' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{link.status}</span></td><td className="pr-3 text-right">{link.status === 'ATIVO' && <button type="button" onClick={() => onUnlink(link.id)} className="font-black text-rose-600 hover:underline">Encerrar</button>}</td></tr>)}</tbody></table></div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h2 className="text-sm font-black text-slate-900">Resultados</h2><span className="text-xs font-bold text-emerald-700">{filtered.length} exibido(s)</span></div>
        <div className="divide-y divide-slate-100">
          {filtered.length ? filtered.map(row => <button key={row.id} type="button" onClick={() => onNavigate(row.tab)} className="grid w-full min-w-0 gap-2 px-5 py-4 text-left transition hover:bg-emerald-50/60 md:grid-cols-[140px_1fr_1fr_170px] md:items-center"><span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-600">{row.module}</span><span className="min-w-0"><b className="block truncate text-sm text-slate-900">{row.title}</b><small className="block truncate text-slate-500">{row.detail}</small></span><span className="min-w-0 truncate text-xs text-slate-500" title={row.meta}>{row.meta}</span><span className="text-xs font-black text-emerald-700 md:text-right">{row.status}</span></button>) : <div className="px-5 py-16 text-center text-sm text-slate-500">Nenhum registro encontrado com os filtros informados.</div>}
        </div>
      </section>
    </div>
  );
}
