import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  ClipboardCopy,
  Download,
  Edit,
  ExternalLink,
  Link2,
  MessageCircle,
  Plus,
  Save,
  Search,
  Trash2,
  X
} from 'lucide-react';
import {
  ApontamentoQuantidadeItem,
  ApontamentoRamo,
  ApontamentoRamoRegistro,
  ClimaApontamento,
  CondicaoApontamento,
  TurnoApontamento
} from '../types';
import {
  APONTAMENTO_CLIMAS,
  APONTAMENTO_CONDICOES,
  APONTAMENTO_LINK_TOKEN,
  APONTAMENTO_TURNOS,
  totalQuantidade
} from '../utils/apontamentoRamosConfig';

interface ApontamentoRamosTabProps {
  ramos: ApontamentoRamo[];
  registros: ApontamentoRamoRegistro[];
  onSaveRamo: (ramo: ApontamentoRamo, isNew: boolean) => void;
  onDeleteRamo: (id: string) => void;
  onSaveRegistro: (registro: ApontamentoRamoRegistro) => void;
  onDeleteRegistro: (id: string) => void;
}

type SubTab = 'dashboard' | 'ramos' | 'apontamentos';

const getTodayInput = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
};

const buildApontamentoLink = () => `${window.location.origin}/apontamento-link/${encodeURIComponent(APONTAMENTO_LINK_TOKEN)}`;

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const toCsv = (rows: Array<Array<string | number>>) =>
  rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');

export default function ApontamentoRamosTab({
  ramos,
  registros,
  onSaveRamo,
  onDeleteRamo,
  onSaveRegistro,
  onDeleteRegistro
}: ApontamentoRamosTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('dashboard');
  const [search, setSearch] = useState('');
  const [registroSearch, setRegistroSearch] = useState('');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [filtroCanteiro, setFiltroCanteiro] = useState('todos');
  const [filtroRamo, setFiltroRamo] = useState('todos');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRegistro, setEditingRegistro] = useState<ApontamentoRamoRegistro | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<ApontamentoRamo>({
    id: '',
    canteiroNome: '',
    ramoNome: '',
    responsavel: '',
    token: APONTAMENTO_LINK_TOKEN,
    status: 'ativo',
    linkAtivo: true,
    observacao: ''
  });

  const today = getTodayInput();
  const generalLink = buildApontamentoLink();
  const canteiros = useMemo(() => Array.from(new Set(ramos.map(item => item.canteiroNome))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [ramos]);

  const filteredRamos = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ramos.filter(ramo => {
      if (filtroCanteiro !== 'todos' && ramo.canteiroNome !== filtroCanteiro) return false;
      if (!q) return true;
      return `${ramo.canteiroNome} ${ramo.ramoNome} ${ramo.responsavel} ${ramo.observacao || ''}`.toLowerCase().includes(q);
    }).sort((a, b) => a.canteiroNome.localeCompare(b.canteiroNome) || a.ramoNome.localeCompare(b.ramoNome));
  }, [filtroCanteiro, ramos, search]);

  const filteredRegistros = useMemo(() => {
    const q = registroSearch.trim().toLowerCase();
    return registros.filter(reg => {
      if (periodoInicio && reg.data < periodoInicio) return false;
      if (periodoFim && reg.data > periodoFim) return false;
      if (filtroCanteiro !== 'todos' && reg.canteiroNome !== filtroCanteiro) return false;
      if (filtroRamo !== 'todos' && reg.ramoId !== filtroRamo) return false;
      if (q && !`${reg.canteiroNome} ${reg.ramoNome} ${reg.empresa} ${reg.responsavel} ${reg.funcaoApontador} ${reg.descricaoAtividade} ${reg.observacao}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => b.data.localeCompare(a.data) || b.horaEnvio.localeCompare(a.horaEnvio));
  }, [filtroCanteiro, filtroRamo, periodoFim, periodoInicio, registroSearch, registros]);

  const enviadosHoje = registros.filter(reg => reg.data === today).length;
  const totalMaoObra = filteredRegistros.reduce((sum, reg) => sum + totalQuantidade(reg.funcoes), 0);
  const totalEquipamentos = filteredRegistros.reduce((sum, reg) => sum + totalQuantidade(reg.equipamentos), 0);
  const pendentesHoje = ramos.filter(ramo => ramo.status === 'ativo' && ramo.linkAtivo && !registros.some(reg => reg.ramoId === ramo.id && reg.data === today));

  const openCreate = () => {
    setEditingId(null);
    setForm({
      id: `ramo-${Date.now()}`,
      canteiroNome: canteiros[0] || 'Rua Padre Eustáquio',
      ramoNome: '',
      responsavel: 'Apontador RENEA',
      token: APONTAMENTO_LINK_TOKEN,
      status: 'ativo',
      linkAtivo: true,
      observacao: ''
    });
    setIsFormOpen(true);
  };

  const openEdit = (ramo: ApontamentoRamo) => {
    setEditingId(ramo.id);
    setForm({ ...ramo, token: APONTAMENTO_LINK_TOKEN });
    setIsFormOpen(true);
  };

  const saveRamo = () => {
    if (!form.canteiroNome.trim() || !form.ramoNome.trim() || !form.responsavel.trim()) {
      alert('Preencha canteiro, ramo e responsável.');
      return;
    }
    onSaveRamo({
      ...form,
      id: editingId || form.id || `ramo-${Date.now()}`,
      canteiroNome: form.canteiroNome.trim(),
      ramoNome: form.ramoNome.trim(),
      responsavel: form.responsavel.trim(),
      token: APONTAMENTO_LINK_TOKEN,
      observacao: form.observacao?.trim()
    }, editingId === null);
    setIsFormOpen(false);
    setEditingId(null);
  };

  const openEditRegistro = (registro: ApontamentoRamoRegistro) => {
    setEditingRegistro(JSON.parse(JSON.stringify(registro)) as ApontamentoRamoRegistro);
    setSubTab('apontamentos');
  };

  const updateRegistroRamo = (ramoId: string) => {
    const ramo = ramos.find(item => item.id === ramoId);
    if (!ramo) return;
    setEditingRegistro(prev => prev ? ({
      ...prev,
      ramoId: ramo.id,
      canteiroNome: ramo.canteiroNome,
      ramoNome: ramo.ramoNome
    }) : prev);
  };

  const updateRegistroQuantidade = (
    field: 'funcoes' | 'equipamentos',
    nome: string,
    quantidade: number
  ) => {
    setEditingRegistro(prev => prev ? ({
      ...prev,
      [field]: prev[field].map(item =>
        item.nome === nome ? { ...item, quantidade: Math.max(0, Number(quantidade) || 0) } : item
      )
    }) : prev);
  };

  const saveRegistro = () => {
    if (!editingRegistro) return;
    if (!editingRegistro.data || !editingRegistro.ramoId || !editingRegistro.responsavel.trim()) {
      alert('Preencha data, ramo e nome do apontador.');
      return;
    }
    onSaveRegistro({
      ...editingRegistro,
      empresa: editingRegistro.empresa.trim() || 'RENEA',
      responsavel: editingRegistro.responsavel.trim(),
      funcaoApontador: editingRegistro.funcaoApontador.trim() || 'Apontador',
      funcoes: editingRegistro.funcoes.map(item => ({ ...item, quantidade: Math.max(0, Number(item.quantidade) || 0) })),
      equipamentos: editingRegistro.equipamentos.map(item => ({ ...item, quantidade: Math.max(0, Number(item.quantidade) || 0) })),
      descricaoAtividade: editingRegistro.descricaoAtividade.trim(),
      observacao: editingRegistro.observacao.trim()
    });
    setEditingRegistro(null);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(buildApontamentoLink());
    alert('Link copiado.');
  };

  const shareWhatsApp = () => {
    const link = buildApontamentoLink();
    const message = `Apontamento RENEA - link geral por ramo\n\nAbra o link, escolha o ramo e preencha o apontamento diário:\n${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const exportCsv = () => {
    const rows: Array<Array<string | number>> = [
      ['Data', 'Hora', 'Canteiro', 'Ramo', 'Empresa', 'Responsável', 'Função', 'Total Funções', 'Total Equipamentos', 'Manhã', 'Tarde', 'Noite', 'Atividade', 'Observação'],
      ...filteredRegistros.map(reg => [
        reg.data.split('-').reverse().join('/'),
        reg.horaEnvio,
        reg.canteiroNome,
        reg.ramoNome,
        reg.empresa,
        reg.responsavel,
        reg.funcaoApontador,
        totalQuantidade(reg.funcoes),
        totalQuantidade(reg.equipamentos),
        `${reg.clima.Manhã}/${reg.condicao.Manhã}`,
        `${reg.clima.Tarde}/${reg.condicao.Tarde}`,
        `${reg.clima.Noite}/${reg.condicao.Noite}`,
        reg.descricaoAtividade,
        reg.observacao
      ])
    ];
    downloadBlob(new Blob([`\ufeff${toCsv(rows)}`], { type: 'text/csv;charset=utf-8' }), `Renea_Apontamentos_Ramos_${periodoInicio || 'inicio'}_${periodoFim || 'fim'}.csv`);
  };

  return (
    <div className="space-y-6" id="apontamento-ramos-tab">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-850 p-6 rounded-3xl shadow-xl">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            Apontamentos
          </h1>
          <p className="text-xs text-slate-400 mt-1">Links por ramo para substituir a folha de apontamento enviada por foto.</p>
        </div>

        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto">
          {[
            ['dashboard', 'Dashboard'],
            ['ramos', 'Ramos'],
            ['apontamentos', 'Registros']
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSubTab(id as SubTab)}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${subTab === id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <MetricCard label="Ramos ativos" value={ramos.filter(r => r.status === 'ativo' && r.linkAtivo).length} hint={`${ramos.length} cadastrados`} />
            <MetricCard label="Enviados hoje" value={enviadosHoje} hint={today.split('-').reverse().join('/')} />
            <MetricCard label="Pendentes hoje" value={pendentesHoje.length} hint="links ativos sem envio" tone="amber" />
            <MetricCard label="Mão de obra" value={totalMaoObra} hint="no filtro atual" />
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            {canteiros.map(canteiro => {
              const itemRamos = ramos.filter(ramo => ramo.canteiroNome === canteiro);
              return (
                <div key={canteiro} className="bg-slate-900 border border-slate-850 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-black text-white">{canteiro}</h2>
                    <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-1">
                      {registros.filter(reg => reg.canteiroNome === canteiro && reg.data === today).length}/{itemRamos.length} hoje
                    </span>
                  </div>
                  <div className="space-y-2">
                    {itemRamos.map(ramo => {
                      const sent = registros.some(reg => reg.ramoId === ramo.id && reg.data === today);
                      return (
                        <div key={ramo.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
                          <span className="text-xs font-bold text-slate-200">{ramo.ramoNome}</span>
                          <span className={`text-[9px] font-black uppercase ${sent ? 'text-emerald-400' : 'text-amber-400'}`}>{sent ? 'Enviado' : 'Pendente'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {subTab === 'ramos' && (
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between bg-slate-900 border border-slate-850 p-4 rounded-2xl">
            <div className="w-full lg:max-w-none p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex flex-col xl:flex-row xl:items-center gap-3">
                <div className="min-w-0 xl:w-56">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-emerald-400">
                    <Link2 className="w-3.5 h-3.5" />
                    Link geral
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Um único link para todos os canteiros e ramos.</p>
                </div>
                <input readOnly value={generalLink} className="flex-1 min-w-0 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono" />
                <div className="flex items-center gap-2">
                  <button onClick={copyLink} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200" title="Copiar link geral">
                    <ClipboardCopy className="w-4 h-4" />
                  </button>
                  <button onClick={shareWhatsApp} className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white" title="Compartilhar no WhatsApp">
                    <MessageCircle className="w-4 h-4" />
                  </button>
                  <a href={generalLink} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200" title="Abrir link geral">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between bg-slate-900 border border-slate-850 p-4 rounded-2xl">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por canteiro, ramo ou responsável" className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
            </div>
            <select value={filtroCanteiro} onChange={e => setFiltroCanteiro(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
              <option value="todos">Todos os canteiros</option>
              {canteiros.map(canteiro => <option key={canteiro} value={canteiro}>{canteiro}</option>)}
            </select>
            <button onClick={openCreate} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Novo ramo
            </button>
          </div>

          {isFormOpen && (
            <RamoForm form={form} setForm={setForm} editingId={editingId} onCancel={() => setIsFormOpen(false)} onSave={saveRamo} />
          )}

          <div className="grid xl:grid-cols-2 gap-4">
            {filteredRamos.map(ramo => {
              const totalRegistros = registros.filter(reg => reg.ramoId === ramo.id).length;
              return (
                <div key={ramo.id} className="bg-slate-900 border border-slate-850 rounded-2xl p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-black text-white truncate">{ramo.canteiroNome}</h3>
                      <p className="text-sm text-emerald-300 font-bold mt-1">{ramo.ramoNome}</p>
                      <p className="text-xs text-slate-400 mt-1">{ramo.responsavel} - {totalRegistros} apontamento(s)</p>
                    </div>
                    <button onClick={() => openEdit(ramo)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300" title="Editar">
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex justify-between gap-2">
                    <button onClick={() => onDeleteRamo(ramo.id)} className="text-[11px] font-bold text-rose-300 hover:text-rose-200 flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir
                    </button>
                    <span className="text-[11px] font-bold text-slate-500 font-mono">link geral ativo</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {subTab === 'apontamentos' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
            <input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
            <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input value={registroSearch} onChange={e => setRegistroSearch(e.target.value)} placeholder="Buscar apontamento" className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
            </div>
            <select value={filtroCanteiro} onChange={e => setFiltroCanteiro(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
              <option value="todos">Todos os canteiros</option>
              {canteiros.map(canteiro => <option key={canteiro} value={canteiro}>{canteiro}</option>)}
            </select>
            <select value={filtroRamo} onChange={e => setFiltroRamo(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
              <option value="todos">Todos os ramos</option>
              {ramos.filter(ramo => filtroCanteiro === 'todos' || ramo.canteiroNome === filtroCanteiro).map(ramo => <option key={ramo.id} value={ramo.id}>{ramo.ramoNome}</option>)}
            </select>
            <button onClick={exportCsv} disabled={filteredRegistros.length === 0} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-black flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              CSV
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MetricCard label="Registros" value={filteredRegistros.length} hint="no filtro" />
            <MetricCard label="Mão de obra" value={totalMaoObra} hint="quantidade total" />
            <MetricCard label="Equipamentos" value={totalEquipamentos} hint="quantidade total" />
          </div>

          {editingRegistro && (
            <RegistroForm
              registro={editingRegistro}
              ramos={ramos}
              setRegistro={setEditingRegistro}
              onCancel={() => setEditingRegistro(null)}
              onSave={saveRegistro}
              onRamoChange={updateRegistroRamo}
              onQuantidadeChange={updateRegistroQuantidade}
            />
          )}

          <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Canteiro/Ramo</th>
                    <th className="py-3 px-4">Empresa</th>
                    <th className="py-3 px-4">Apontador</th>
                    <th className="py-3 px-4 text-center">Funções</th>
                    <th className="py-3 px-4 text-center">Equip.</th>
                    <th className="py-3 px-4">Tempo/Condição</th>
                    <th className="py-3 px-4">Atividade</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredRegistros.length === 0 ? (
                    <tr><td colSpan={9} className="py-10 text-center text-slate-500">Nenhum apontamento encontrado para os filtros.</td></tr>
                  ) : filteredRegistros.map(reg => (
                    <tr key={reg.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono text-slate-300">
                        <span className="font-black text-white">{reg.data.split('-').reverse().join('/')}</span>
                        <span className="block text-[10px] text-slate-500">{reg.horaEnvio}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-black text-emerald-300 block">{reg.canteiroNome}</span>
                        <span className="text-slate-400">{reg.ramoNome}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{reg.empresa || '-'}</td>
                      <td className="py-3 px-4 text-slate-300">
                        <span className="font-black text-white block">{reg.responsavel || '-'}</span>
                        <span className="text-[10px] text-slate-500">{reg.funcaoApontador || 'Apontador'}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-black text-white font-mono">{totalQuantidade(reg.funcoes)}</td>
                      <td className="py-3 px-4 text-center font-black text-white font-mono">{totalQuantidade(reg.equipamentos)}</td>
                      <td className="py-3 px-4 text-slate-400">{`M: ${reg.clima.Manhã}/${reg.condicao.Manhã} | T: ${reg.clima.Tarde}/${reg.condicao.Tarde} | N: ${reg.clima.Noite}/${reg.condicao.Noite}`}</td>
                      <td className="py-3 px-4 text-slate-300 max-w-md">{reg.descricaoAtividade || '-'}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEditRegistro(reg)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200" title="Editar registro">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => onDeleteRegistro(reg.id)} className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300" title="Excluir registro">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, hint, tone = 'emerald' }: { label: string; value: number | string; hint: string; tone?: 'emerald' | 'amber' | 'rose' }) {
  const color = tone === 'rose' ? 'text-rose-400' : tone === 'amber' ? 'text-amber-400' : 'text-emerald-400';
  return (
    <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl">
      <span className="text-[10px] text-slate-500 uppercase font-mono font-bold">{label}</span>
      <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
      <span className="text-[10px] text-slate-500">{hint}</span>
    </div>
  );
}

function RamoForm({
  form,
  setForm,
  editingId,
  onCancel,
  onSave
}: {
  form: ApontamentoRamo;
  setForm: React.Dispatch<React.SetStateAction<ApontamentoRamo>>;
  editingId: string | null;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="bg-slate-900 border border-slate-850 rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-white">{editingId ? 'Editar ramo' : 'Criar ramo'}</h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Canteiro</span>
          <input value={form.canteiroNome} onChange={e => setForm(prev => ({ ...prev, canteiroNome: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Ramo</span>
          <input value={form.ramoNome} onChange={e => setForm(prev => ({ ...prev, ramoNome: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Responsável</span>
          <input value={form.responsavel} onChange={e => setForm(prev => ({ ...prev, responsavel: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <input type="checkbox" checked={form.status === 'ativo'} onChange={e => setForm(prev => ({ ...prev, status: e.target.checked ? 'ativo' : 'inativo' }))} className="accent-emerald-600" />
          Ramo ativo
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <input type="checkbox" checked={form.linkAtivo} onChange={e => setForm(prev => ({ ...prev, linkAtivo: e.target.checked }))} className="accent-emerald-600" />
          Link ativo
        </label>
      </div>
      <textarea value={form.observacao || ''} onChange={e => setForm(prev => ({ ...prev, observacao: e.target.value }))} rows={2} placeholder="Observação do ramo" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 resize-none" />
      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700">Cancelar</button>
        <button onClick={onSave} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-500 flex items-center gap-2">
          <Save className="w-4 h-4" />
          Salvar ramo
        </button>
      </div>
    </div>
  );
}

function RegistroForm({
  registro,
  ramos,
  setRegistro,
  onCancel,
  onSave,
  onRamoChange,
  onQuantidadeChange
}: {
  registro: ApontamentoRamoRegistro;
  ramos: ApontamentoRamo[];
  setRegistro: React.Dispatch<React.SetStateAction<ApontamentoRamoRegistro | null>>;
  onCancel: () => void;
  onSave: () => void;
  onRamoChange: (ramoId: string) => void;
  onQuantidadeChange: (field: 'funcoes' | 'equipamentos', nome: string, quantidade: number) => void;
}) {
  const updateClima = (turno: TurnoApontamento, value: ClimaApontamento) => {
    setRegistro(prev => prev ? ({ ...prev, clima: { ...prev.clima, [turno]: value } }) : prev);
  };

  const updateCondicao = (turno: TurnoApontamento, value: CondicaoApontamento) => {
    setRegistro(prev => prev ? ({ ...prev, condicao: { ...prev.condicao, [turno]: value } }) : prev);
  };

  const renderQuantidades = (
    title: string,
    field: 'funcoes' | 'equipamentos',
    items: ApontamentoQuantidadeItem[]
  ) => (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h4 className="text-xs font-black text-white">{title}</h4>
        <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/10 rounded-full px-2 py-1">
          {totalQuantidade(items)}
        </span>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {items.map(item => (
          <label key={item.nome} className="flex items-center justify-between gap-2 rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <span className="text-[11px] font-bold text-slate-300 truncate">{item.nome}</span>
            <input
              type="number"
              min={0}
              value={item.quantidade}
              onChange={e => onQuantidadeChange(field, item.nome, Number(e.target.value))}
              className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-right text-sm text-white font-black outline-none focus:border-emerald-500"
            />
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-4 space-y-4 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-white">Editar registro de apontamento</h3>
          <p className="text-[11px] text-slate-500 mt-1">Ajuste o lançamento salvo e clique em salvar.</p>
        </div>
        <button onClick={onCancel} className="text-slate-400 hover:text-white" title="Fechar edição">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Data</span>
          <input
            type="date"
            value={registro.data}
            onChange={e => setRegistro(prev => prev ? ({ ...prev, data: e.target.value }) : prev)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Hora</span>
          <input
            type="time"
            value={registro.horaEnvio}
            onChange={e => setRegistro(prev => prev ? ({ ...prev, horaEnvio: e.target.value }) : prev)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
          />
        </label>
        <label className="space-y-1 xl:col-span-2">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Canteiro / Ramo</span>
          <select
            value={registro.ramoId}
            onChange={e => onRamoChange(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
          >
            {ramos.map(ramo => (
              <option key={ramo.id} value={ramo.id}>{ramo.canteiroNome} - {ramo.ramoNome}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Empresa</span>
          <input
            value={registro.empresa}
            onChange={e => setRegistro(prev => prev ? ({ ...prev, empresa: e.target.value }) : prev)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Nome do apontador</span>
          <input
            value={registro.responsavel}
            onChange={e => setRegistro(prev => prev ? ({ ...prev, responsavel: e.target.value }) : prev)}
            placeholder="Nome do apontador"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
          />
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Função do apontador</span>
          <input
            value={registro.funcaoApontador}
            onChange={e => setRegistro(prev => prev ? ({ ...prev, funcaoApontador: e.target.value }) : prev)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
          />
        </label>
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        {renderQuantidades('Funções', 'funcoes', registro.funcoes)}
        {renderQuantidades('Equipamentos', 'equipamentos', registro.equipamentos)}
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
        <h4 className="text-xs font-black text-white mb-3">Tempo e condição</h4>
        <div className="grid md:grid-cols-3 gap-3">
          {APONTAMENTO_TURNOS.map(turno => (
            <div key={turno} className="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-2">
              <span className="text-[11px] font-black text-emerald-300">{turno}</span>
              <select
                value={registro.clima[turno]}
                onChange={e => updateClima(turno, e.target.value as ClimaApontamento)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
              >
                {APONTAMENTO_CLIMAS.map(clima => <option key={clima} value={clima}>{clima}</option>)}
              </select>
              <select
                value={registro.condicao[turno]}
                onChange={e => updateCondicao(turno, e.target.value as CondicaoApontamento)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
              >
                {APONTAMENTO_CONDICOES.map(condicao => <option key={condicao} value={condicao}>{condicao}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Atividade do dia</span>
          <textarea
            rows={4}
            value={registro.descricaoAtividade}
            onChange={e => setRegistro(prev => prev ? ({ ...prev, descricaoAtividade: e.target.value }) : prev)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 resize-none"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Observação</span>
          <textarea
            rows={4}
            value={registro.observacao}
            onChange={e => setRegistro(prev => prev ? ({ ...prev, observacao: e.target.value }) : prev)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 resize-none"
          />
        </label>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700">Cancelar</button>
        <button onClick={onSave} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-500 flex items-center gap-2">
          <Save className="w-4 h-4" />
          Salvar registro
        </button>
      </div>
    </div>
  );
}
