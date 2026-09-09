import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import type { Abastecimento, ControleEquipamentoDiario, Empresa, Equipamento, Funcionario, GrupoEquipe, ObraLocal, OrdemServico, PresencaApontamento, TicketJazida, VinculoOperadorEquipamento } from '../types';
import { normalizeComparable } from '../utils/canonicalIdentity';
import {
  Button,
  DataTable,
  Field,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
  SelectField,
  StatusBadge,
} from '../shared/ui';

type GeneralRow = {
  id: string;
  module: string;
  title: string;
  detail: string;
  meta: string;
  status: string;
  driver?: string;
  date?: string;
  company?: string;
  equipmentType?: string;
  prefix?: string;
  maintenance?: boolean;
  location?: string;
  tab: string;
};

type Props = {
  empresas: Empresa[];
  obras: ObraLocal[];
  equipamentos: Equipamento[];
  funcionarios: Funcionario[];
  abastecimentos: Abastecimento[];
  tickets: TicketJazida[];
  ordensServico: OrdemServico[];
  controlesEquipamentos: ControleEquipamentoDiario[];
  gruposEquipe: GrupoEquipe[];
  presencas: PresencaApontamento[];
  vinculos: VinculoOperadorEquipamento[];
  onLink: (funcionarioId: string, equipamentoId: string, observacao?: string) => void;
  onUnlink: (vinculoId: string) => void;
  onNavigate: (tab: string) => void;
};

const normalize = normalizeComparable;

export default function ConsultaGeralTab({ empresas, obras, equipamentos, funcionarios, abastecimentos, tickets, ordensServico, controlesEquipamentos, gruposEquipe, presencas, vinculos, onLink, onUnlink, onNavigate }: Props) {
  const [query, setQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [companyFilter, setCompanyFilter] = useState('Todas');
  const [equipmentTypeFilter, setEquipmentTypeFilter] = useState('Todos');
  const [driverFilter, setDriverFilter] = useState('Todos');
  const [maintenanceFilter, setMaintenanceFilter] = useState('Todas');
  const [prefixFilter, setPrefixFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [linkEmployee, setLinkEmployee] = useState('');
  const [linkEquipment, setLinkEquipment] = useState('');
  const [linkNote, setLinkNote] = useState('');

  const rows = useMemo<GeneralRow[]>(() => {
    const equipmentStatus = (equipment: Equipamento) => {
      const openOrder = ordensServico.find(order => order.equipamentoId === equipment.id && !['Concluída', 'Cancelada'].includes(order.status));
      if (openOrder?.status === 'Aguardando Peça') return 'Aguardando manutenção';
      if (openOrder) return 'Em manutenção';
      if (equipment.status === 'Mobilizado' || equipment.status === 'Ativo') return 'Mobilizado';
      if (equipment.status === 'Desmobilizado') return 'Desmobilizado';
      if (equipment.status === 'Parado') return 'Equipamento parado';
      if (equipment.status === 'Esperando motorista') return 'Aguardando motorista';
      if (equipment.status === 'Manutenção') return 'Em manutenção';
      return equipment.status;
    };
    const linkedDriver = (equipment: Equipamento) => {
      const activeLink = vinculos.find(link => link.equipamentoId === equipment.id && link.status === 'ATIVO');
      return activeLink?.funcionarioNome || equipment.operadorResponsavelNome || funcionarios.find(person => person.id === equipment.operadorResponsavelId)?.nome || 'Motorista não vinculado';
    };
    return [
    ...empresas.map(item => ({ id: `empresa-${item.id}`, module: 'Empresas', title: item.nome, detail: item.cnpj || 'CNPJ não informado', meta: item.responsavel || 'Responsável não informado', status: item.status || 'ATIVO', tab: 'cadastros' })),
    ...obras.map(item => ({ id: `obra-${item.id}`, module: 'Obras', title: item.nome, detail: item.endereco || 'Endereço não informado', meta: item.responsavel || 'Responsável não informado', status: item.status, tab: 'cadastros' })),
    ...equipamentos.map(item => ({ id: `equipamento-${item.id}`, module: 'Frota', title: `${item.prefixo || 'Sem prefixo'} · ${item.nome}`, detail: [item.marca, item.modelo, item.placa || item.seriePlaca].filter(Boolean).join(' · ') || 'Identificação incompleta', meta: `${item.tipo || item.categoriaFrota || 'Equipamento'} · ${linkedDriver(item)} · ${empresas.find(company => company.id === item.empresaId)?.nome || 'Empresa não vinculada'}`, driver: linkedDriver(item), company: empresas.find(company => company.id === item.empresaId)?.nome, equipmentType: item.tipo || item.categoriaFrota || item.familia, prefix: item.prefixo, maintenance: equipmentStatus(item).toLocaleLowerCase('pt-BR').includes('manutenção'), status: equipmentStatus(item), tab: 'controle-equipamentos' })),
    ...funcionarios.map(item => { const linked = equipamentos.filter(equipment => equipment.operadorResponsavelId === item.id || normalize(equipment.operadorResponsavelNome) === normalize(item.nome)); return { id: `funcionario-${item.id}`, module: 'Colaboradores', title: item.nome, detail: [item.matricula, item.cargo].filter(Boolean).join(' · '), meta: linked.length ? `Frota vinculada: ${linked.map(eq => eq.prefixo).join(', ')}` : [item.area, item.liderNome].filter(Boolean).join(' · ') || 'Sem equipamento vinculado', status: item.status || (item.ativo ? 'ATIVO' : 'INATIVO'), tab: 'cadastros' }; }),
    ...abastecimentos.map(item => ({ id: `abastecimento-${item.id}`, module: 'Combustível', title: `${item.prefixoInformado || equipamentos.find(eq => eq.id === item.equipamentoId)?.prefixo || 'Sem prefixo'} · ${item.quantidadeLitros} L`, detail: item.hora ? `Abastecimento às ${item.hora}` : 'Abastecimento registrado', meta: item.responsavel || item.origem || 'Origem não informada', date: item.data, status: item.status || 'OK', tab: 'lancamentos' })),
    ...tickets.map(item => ({ id: `ticket-${item.id}`, module: 'Tickets', title: `Ticket ${item.ticketNumero || 'sem número'}`, detail: `${item.prefixo || 'Sem prefixo'} · ${item.placa || 'Sem placa'}`, meta: `${item.data} · ${item.tipoMaterial || 'Material não informado'}`, status: item.statusFluxo || item.status || 'Pendente', tab: 'tickets-jazida' })),
    ...ordensServico.map(item => { const equipment = equipamentos.find(eq=>eq.id===item.equipamentoId); return ({ id: `os-${item.id}`, module: 'Frota', title: `${item.numero} · ${equipment?.prefixo || 'Frota não localizada'}`, detail: item.descricao || item.motivo || 'Sem descrição', meta: `${item.dataAbertura} · ${item.responsavel}`, date: item.dataAbertura, company: empresas.find(company=>company.id===equipment?.empresaId)?.nome, equipmentType: equipment?.tipo || equipment?.familia, prefix: equipment?.prefixo, maintenance: true, status: item.status, tab: 'controle-equipamentos' }); }),
    ...controlesEquipamentos.map(item => { const equipment = equipamentos.find(eq=>eq.id===item.equipamentoId || normalize(eq.prefixo)===normalize(item.prefixo)); return ({ id: `controle-${item.id}`, module: 'Basculantes', title: `${item.prefixo} · ${item.nomeMotorista || 'Aguardando motorista'}`, detail: [item.motivoManutencao, item.observacao].filter(Boolean).join(' · ') || item.familia, meta: `${item.data} · Saída ${item.horaSaida || '—'} · Retorno ${item.horaLiberacao || '—'}`, date: item.data, driver: item.nomeMotorista, company: empresas.find(company=>company.id===equipment?.empresaId)?.nome, equipmentType: item.familia || equipment?.tipo, prefix: item.prefixo, maintenance: item.status.toLocaleLowerCase('pt-BR').includes('manutenção'), status: item.status, tab: 'controle-equipamentos' }); }),
    ...gruposEquipe.map(item => ({ id: `grupo-${item.id}`, module: 'Equipes', title: item.nome, detail: `${item.responsavel} · ${item.funcionarioIds.length} colaborador(es)`, meta: item.frenteServico, status: item.status, tab: 'presenca' })),
    ...presencas.map(item => ({ id: `presenca-${item.id}`, module: 'Presenças', title: item.funcionarioNome, detail: `${item.grupoNome} · ${item.funcao}`, meta: `${item.data} ${item.horaEnvio}`, date: item.data, driver: item.funcionarioNome, status: item.status, tab: 'presenca' })),
    ];
  }, [empresas, obras, equipamentos, funcionarios, abastecimentos, tickets, ordensServico, controlesEquipamentos, gruposEquipe, presencas, vinculos]);

  const modules = ['Todos', ...Array.from(new Set(rows.map(row => row.module)))];
  const statuses = ['Todos', ...Array.from(new Set(rows.map(row => row.status).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  const companies = ['Todas', ...Array.from(new Set(rows.map(row => row.company).filter((value): value is string => Boolean(value)))).sort((a,b)=>a.localeCompare(b,'pt-BR'))];
  const equipmentTypes = ['Todos', ...Array.from(new Set(rows.map(row => row.equipmentType).filter((value): value is string => Boolean(value)))).sort((a,b)=>a.localeCompare(b,'pt-BR'))];
  const drivers = ['Todos', ...Array.from(new Set(rows.map(row => row.driver).filter((value): value is string => Boolean(value)))).sort((a,b)=>a.localeCompare(b,'pt-BR'))];
  const filtered = useMemo(() => {
    const term = normalize(query);
    return rows.filter(row => (moduleFilter === 'Todos' || row.module === moduleFilter)
      && (statusFilter === 'Todos' || row.status === statusFilter)
      && (companyFilter === 'Todas' || row.company === companyFilter)
      && (equipmentTypeFilter === 'Todos' || row.equipmentType === equipmentTypeFilter)
      && (driverFilter === 'Todos' || row.driver === driverFilter)
      && (maintenanceFilter === 'Todas' || (maintenanceFilter === 'Com manutenção' ? row.maintenance === true : row.maintenance !== true))
      && (!prefixFilter || normalize(row.prefix).includes(normalize(prefixFilter)))
      && (!locationFilter || normalize(row.location).includes(normalize(locationFilter)))
      && (!dateFrom || Boolean(row.date && row.date >= dateFrom))
      && (!dateTo || Boolean(row.date && row.date <= dateTo))
      && (!term || normalize(`${row.title} ${row.detail} ${row.meta} ${row.status}`).includes(term)));
  }, [rows, moduleFilter, statusFilter, companyFilter, equipmentTypeFilter, driverFilter, maintenanceFilter, prefixFilter, locationFilter, dateFrom, dateTo, query]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Abas da referência mapeadas para os módulos que a consulta já monta: nenhuma
  // fonte de dado nova, só um atalho para o filtro que já existia no seletor.
  const ABAS: Array<{ id: string; rotulo: string; modulos: string[] }> = [
    { id: 'equipamentos', rotulo: 'Equipamentos', modulos: ['Frota', 'Basculantes'] },
    { id: 'colaboradores', rotulo: 'Colaboradores', modulos: ['Colaboradores', 'Equipes', 'Presenças'] },
    { id: 'manutencoes', rotulo: 'Manutenções', modulos: ['Basculantes'] },
    { id: 'viagens', rotulo: 'Viagens', modulos: ['Tickets'] },
    { id: 'abastecimentos', rotulo: 'Abastecimentos', modulos: ['Combustível'] },
  ];

  return (
    <div className="renea-page-viewport space-y-5" id="consulta-geral-tab">
      <PageHeader
        eyebrow="Consulta geral"
        photo="ponte-construcao"
        title="Consulta Geral"
        description="Pesquise equipamentos, colaboradores, equipes e registros."
        actions={<Button variant="primary" icon={Download} onClick={() => window.print()}>Exportar</Button>}
      />

      <div className="flex flex-wrap gap-1.5">
        {ABAS.map(aba => {
          const ativa = aba.modulos.includes(moduleFilter);
          return (
            <button
              key={aba.id}
              type="button"
              onClick={() => { setModuleFilter(aba.modulos[0]); setPage(1); }}
              aria-pressed={ativa}
              className={`h-9 rounded-lg px-4 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 active:scale-[0.98] ${ativa
                ? 'bg-[#087353] text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-400'}`}
            >
              {aba.rotulo}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => { setModuleFilter('Todos'); setPage(1); }}
          aria-pressed={moduleFilter === 'Todos'}
          className={`h-9 rounded-lg px-4 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 active:scale-[0.98] ${moduleFilter === 'Todos'
            ? 'bg-[#087353] text-white'
            : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-400'}`}
        >
          Todos
        </button>
      </div>

      <FilterBar
        acao={<Button variant="primary" icon={Search} onClick={() => setPage(1)} className="h-9">Consultar</Button>}
      >
        <SelectField label="Tipo" value={equipmentTypeFilter} onChange={event => { setEquipmentTypeFilter(event.target.value); setPage(1); }} className="min-w-40">
          {equipmentTypes.map(value => <option key={value}>{value}</option>)}
        </SelectField>
        <SelectField label="Situação" value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }} className="min-w-40">
          {statuses.map(value => <option key={value}>{value}</option>)}
        </SelectField>
        <SelectField label="Empresa" value={companyFilter} onChange={event => { setCompanyFilter(event.target.value); setPage(1); }} className="min-w-40">
          {companies.map(value => <option key={value}>{value}</option>)}
        </SelectField>
        <Field label="Data" type="date" value={dateFrom} onChange={event => { setDateFrom(event.target.value); setPage(1); }} className="min-w-36" />
        <SearchInput
          className="min-w-56 flex-1"
          label="Buscar registros"
          value={query}
          onChange={valor => { setQuery(valor); setPage(1); }}
          placeholder="Buscar..."
        />
      </FilterBar>

      <details className="rounded-xl border border-slate-200 bg-white p-5">
        <summary className="cursor-pointer text-[13px] font-semibold text-slate-700">Vínculo motorista ↔ equipamento</summary>
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 pt-3 md:flex-row md:items-center md:justify-between"><div><h2 className="sr-only">Vínculo motorista e equipamento</h2><p className="mt-1 text-xs text-slate-500">Fonte canônica em tempo real; um novo vínculo encerra automaticamente o vínculo anterior do colaborador ou da frota.</p></div><span className="text-xs font-black text-emerald-700">{vinculos.filter(link => link.status === 'ATIVO').length} vínculo(s) ativo(s)</span></div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <select value={linkEmployee} onChange={event => setLinkEmployee(event.target.value)} className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"><option value="">Selecione o colaborador</option>{funcionarios.filter(item => item.ativo && !['INATIVO', 'DESMOBILIZADO'].includes(item.status || '')).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).map(item => <option key={item.id} value={item.id}>{item.nome} · {item.matricula || item.cargo}</option>)}</select>
          <select value={linkEquipment} onChange={event => setLinkEquipment(event.target.value)} className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"><option value="">Selecione o equipamento</option>{equipamentos.filter(item => item.status !== 'Desmobilizado').sort((a,b)=>a.prefixo.localeCompare(b.prefixo,'pt-BR',{numeric:true})).map(item => <option key={item.id} value={item.id}>{item.prefixo} · {item.nome} · {item.status}</option>)}</select>
          <input value={linkNote} onChange={event => setLinkNote(event.target.value)} placeholder="Observação do vínculo" className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700" />
          <button type="button" disabled={!linkEmployee || !linkEquipment} onClick={() => { onLink(linkEmployee, linkEquipment, linkNote); setLinkNote(''); }} className="h-11 rounded-xl bg-emerald-600 px-5 text-xs font-black text-white disabled:opacity-40">Confirmar vínculo</button>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-slate-50 text-[9px] uppercase tracking-wider text-slate-500"><tr><th className="p-3">Colaborador</th><th>Equipamento</th><th>Início</th><th>Fim</th><th>Responsável</th><th>Status</th><th className="pr-3 text-right">Ação</th></tr></thead><tbody className="divide-y divide-slate-100">{vinculos.slice(0,100).map(link => <tr key={link.id}><td className="p-3 font-bold text-slate-900">{link.funcionarioNome}</td><td className="font-mono font-black text-emerald-700">{link.equipamentoPrefixo}</td><td>{new Date(link.inicioEm).toLocaleString('pt-BR')}</td><td>{link.fimEm ? new Date(link.fimEm).toLocaleString('pt-BR') : '—'}</td><td>{link.responsavelAlteracao}</td><td><span className={`rounded-full px-2 py-1 text-[9px] font-black ${link.status === 'ATIVO' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{link.status}</span></td><td className="pr-3 text-right">{link.status === 'ATIVO' && <button type="button" onClick={() => onUnlink(link.id)} className="font-black text-rose-600 hover:underline">Encerrar</button>}</td></tr>)}</tbody></table></div>
      </details>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-sm font-black text-slate-900">Resultados</h2><span className="text-xs font-bold text-emerald-700">{filtered.length} encontrado(s)</span></div>
          <select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }} className="h-9 rounded-lg border border-slate-200 px-2 text-xs font-bold text-slate-600"><option value={10}>10 por página</option><option value={25}>25 por página</option><option value={50}>50 por página</option><option value={100}>100 por página</option></select>
        </div>
        <DataTable
          larguraMinima={980}
          itens={pagedRows}
          chaveDe={row => row.id}
          vazio={<div className="px-5 py-16 text-center text-[13px] text-slate-500">Nenhum registro encontrado com os filtros informados.</div>}
          acoes={[{ rotulo: 'Abrir no módulo', onSelect: row => onNavigate(row.tab) }]}
          colunas={[
            { chave: 'prefixo', titulo: 'Prefixo', render: row => <span className="font-semibold text-slate-900">{row.prefix || row.title}</span> },
            { chave: 'tipo', titulo: 'Tipo', render: row => row.equipmentType || row.module },
            { chave: 'descricao', titulo: 'Descrição', render: row => <span className="line-clamp-1" title={row.detail}>{row.detail || '—'}</span>, larguraMinima: 220 },
            { chave: 'situacao', titulo: 'Situação', render: row => <StatusBadge>{row.status}</StatusBadge> },
            { chave: 'equipe', titulo: 'Equipe', render: row => row.driver || row.company || '—', ocultarNoCelular: true },
            { chave: 'atualizacao', titulo: 'Última atualização', render: row => row.date ? row.date.split('-').reverse().join('/') : '—', ocultarNoCelular: true },
          ]}
        />
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
            <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
            <span className="text-xs font-medium text-slate-500">página {safePage} de {totalPages}</span>
          </div>
        )}
      </section>
    </div>
  );
}
