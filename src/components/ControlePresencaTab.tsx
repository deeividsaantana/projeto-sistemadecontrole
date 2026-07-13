import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ClipboardCopy,
  Download,
  Edit,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Link2,
  MessageCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Users,
  X
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { addCorporateSummarySheet, configureCorporateWorkbook, downloadCorporateWorkbook, styleCorporateWorksheet } from '../utils/excelCorporate';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GENERAL_PRESENCE_TOKEN } from './PresencaLinkExterno';
import {
  Funcionario,
  GrupoEquipe,
  HistoricoPresenca,
  ObraLocal,
  PresencaApontamento,
  PresencaStatus
} from '../types';

const STATUS_OPTIONS: PresencaStatus[] = [
  'Presente',
  'Ausente',
  'Falta justificada',
  'Atestado',
  'Férias',
  'Afastado',
  'Outro'
];

const statusClasses: Record<PresencaStatus, string> = {
  Presente: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  Ausente: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
  'Falta justificada': 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  Atestado: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  Férias: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  Afastado: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
  Outro: 'bg-violet-500/10 text-violet-300 border-violet-500/20'
};

interface ControlePresencaTabProps {
  funcionarios: Funcionario[];
  obras: ObraLocal[];
  gruposEquipe: GrupoEquipe[];
  presencasLink: PresencaApontamento[];
  historicoPresencas: HistoricoPresenca[];
  onSaveGrupoEquipe: (grupo: GrupoEquipe, isNew: boolean) => void;
  onDeleteGrupoEquipe: (id: string) => void;
  onUpdatePresencaLink: (id: string, status: PresencaStatus, observacao: string, motivo: string) => void;
  onRefreshFromFirebase: () => Promise<{ success: boolean; message: string }>;
}

type SubTab = 'dashboard' | 'grupos' | 'apontamentos' | 'historico';

const getTodayInput = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
};

const generateToken = () => {
  const random = crypto.getRandomValues(new Uint32Array(4));
  return Array.from(random)
    .map(part => part.toString(36))
    .join('-');
};

const buildPresenceLink = (token: string) => `${window.location.origin}/presenca-link/${encodeURIComponent(token)}`;
const presenceDuplicateKey = (item: PresencaApontamento) => `${item.grupoId}|${item.data}|${item.funcionarioId}`;

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
  rows
    .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\n');

export default function ControlePresencaTab({
  funcionarios,
  obras,
  gruposEquipe,
  presencasLink,
  historicoPresencas,
  onSaveGrupoEquipe,
  onDeleteGrupoEquipe,
  onUpdatePresencaLink,
  onRefreshFromFirebase
}: ControlePresencaTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('dashboard');
  const [dataReferencia, setDataReferencia] = useState(getTodayInput());
  const [filtroData, setFiltroData] = useState(getTodayInput());
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('todos');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [filtroFrente, setFiltroFrente] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | PresencaStatus>('todos');
  const [filtroFuncionario, setFiltroFuncionario] = useState('');
  const [grupoSearch, setGrupoSearch] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [feedback, setFeedback] = useState('');

  const emptyGroup: GrupoEquipe = {
    id: '',
    nome: '',
    responsavel: '',
    frenteServico: obras[0]?.nome || '',
    obraId: obras[0]?.id || '',
    funcionarioIds: [],
    status: 'ativo',
    token: generateToken(),
    linkAtivo: true,
    createdAt: '',
    updatedAt: ''
  };

  const [isGroupFormOpen, setIsGroupFormOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState<GrupoEquipe>(emptyGroup);
  const [editingRecord, setEditingRecord] = useState<PresencaApontamento | null>(null);
  const [editStatus, setEditStatus] = useState<PresencaStatus>('Presente');
  const [editObservacao, setEditObservacao] = useState('');
  const [editMotivo, setEditMotivo] = useState('');

  const activeGroups = useMemo(
    () => gruposEquipe.filter(grupo => grupo.status === 'ativo' && grupo.linkAtivo),
    [gruposEquipe]
  );

  const recordsForReferenceDate = useMemo(
    () => presencasLink.filter(item => item.data === dataReferencia),
    [presencasLink, dataReferencia]
  );

  const sentGroupIds = useMemo(
    () => new Set(recordsForReferenceDate.map(item => item.grupoId)),
    [recordsForReferenceDate]
  );

  const duplicatePresenceKeys = useMemo(() => {
    const counts = new Map<string, number>();
    presencasLink.forEach(item => {
      const key = presenceDuplicateKey(item);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([key]) => key));
  }, [presencasLink]);

  const pendingGroups = useMemo(
    () => activeGroups.filter(grupo => !sentGroupIds.has(grupo.id)),
    [activeGroups, sentGroupIds]
  );

  const dashboard = useMemo(() => {
    const planned = activeGroups.reduce((total, grupo) => total + grupo.funcionarioIds.length, 0);
    const present = recordsForReferenceDate.filter(item => item.status === 'Presente').length;
    const absent = recordsForReferenceDate.filter(item => item.status === 'Ausente').length;
    const justified = recordsForReferenceDate.filter(item => item.status === 'Falta justificada').length;
    const duplicates = recordsForReferenceDate.filter(item => duplicatePresenceKeys.has(presenceDuplicateKey(item))).length;
    const sent = sentGroupIds.size;
    const percent = planned > 0 ? Math.round((present / planned) * 100) : 0;
    return { planned, present, absent, justified, duplicates, sent, pending: pendingGroups.length, percent };
  }, [activeGroups, duplicatePresenceKeys, pendingGroups.length, recordsForReferenceDate, sentGroupIds.size]);

  const filteredRecords = useMemo(() => {
    return presencasLink.filter(item => {
      if (filtroData && item.data !== filtroData) return false;
      if (periodoInicio && item.data < periodoInicio) return false;
      if (periodoFim && item.data > periodoFim) return false;
      if (filtroGrupo !== 'todos' && item.grupoId !== filtroGrupo) return false;
      if (filtroResponsavel && !item.responsavel.toLowerCase().includes(filtroResponsavel.toLowerCase())) return false;
      if (filtroFrente && !item.frenteServico.toLowerCase().includes(filtroFrente.toLowerCase())) return false;
      if (filtroStatus !== 'todos' && item.status !== filtroStatus) return false;
      if (filtroFuncionario && !item.funcionarioNome.toLowerCase().includes(filtroFuncionario.toLowerCase())) return false;
      return true;
    }).sort((a, b) => `${b.data} ${b.horaEnvio}`.localeCompare(`${a.data} ${a.horaEnvio}`));
  }, [filtroData, filtroFrente, filtroFuncionario, filtroGrupo, filtroResponsavel, filtroStatus, periodoFim, periodoInicio, presencasLink]);

  const alertas = useMemo(() => {
    const ausencias = recordsForReferenceDate.filter(item => item.status === 'Ausente');
    const foraHorario = recordsForReferenceDate.filter(item => item.horaEnvio < '06:00' || item.horaEnvio > '09:00');
    const manyAbsenceGroups = activeGroups.filter(grupo => {
      const groupRows = recordsForReferenceDate.filter(item => item.grupoId === grupo.id);
      const absentRows = groupRows.filter(item => item.status === 'Ausente');
      return absentRows.length >= 3 || (groupRows.length > 0 && absentRows.length / groupRows.length >= 0.3);
    });
    const duplicateGroups = activeGroups.filter(grupo =>
      recordsForReferenceDate.some(item => item.grupoId === grupo.id && duplicatePresenceKeys.has(presenceDuplicateKey(item)))
    );

    return [
      ...pendingGroups.map(grupo => ({
        title: 'Grupo pendente',
        text: `${grupo.nome} ainda não enviou a presença de ${dataReferencia}.`,
        type: 'warning' as const
      })),
      ...duplicateGroups.map(grupo => ({
        title: 'Envio duplicado para conferência',
        text: `${grupo.nome} possui mais de um envio em ${dataReferencia}. Confira os registros antes de editar ou excluir.`,
        type: 'error' as const
      })),
      ...ausencias.slice(0, 5).map(item => ({
        title: 'Funcionário ausente',
        text: `${item.funcionarioNome} foi marcado como ausente no grupo ${item.grupoNome}.`,
        type: 'error' as const
      })),
      ...manyAbsenceGroups.map(grupo => ({
        title: 'Muitas ausências',
        text: `${grupo.nome} tem volume elevado de ausências no apontamento do dia.`,
        type: 'warning' as const
      })),
      ...foraHorario.slice(0, 3).map(item => ({
        title: 'Envio fora do horário',
        text: `${item.grupoNome} enviou registro às ${item.horaEnvio}.`,
        type: 'warning' as const
      }))
    ];
  }, [activeGroups, dataReferencia, duplicatePresenceKeys, pendingGroups, recordsForReferenceDate]);

  const visibleFuncionarios = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();
    return funcionarios
      .filter(func => func.ativo)
      .filter(func => !query || func.nome.toLowerCase().includes(query) || func.cargo.toLowerCase().includes(query))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [employeeSearch, funcionarios]);

  const filteredGroups = useMemo(() => {
    const query = grupoSearch.trim().toLowerCase();
    return gruposEquipe.filter(grupo =>
      !query ||
      grupo.nome.toLowerCase().includes(query) ||
      grupo.responsavel.toLowerCase().includes(query) ||
      grupo.frenteServico.toLowerCase().includes(query)
    );
  }, [grupoSearch, gruposEquipe]);

  const handleOpenCreateGroup = () => {
    setEditingGroupId(null);
    setGroupForm({ ...emptyGroup, token: generateToken() });
    setIsGroupFormOpen(true);
    setFeedback('');
  };

  const handleOpenEditGroup = (grupo: GrupoEquipe) => {
    setEditingGroupId(grupo.id);
    setGroupForm(grupo);
    setIsGroupFormOpen(true);
    setFeedback('');
  };

  const handleSaveGroup = () => {
    if (!groupForm.nome.trim() || !groupForm.responsavel.trim() || !groupForm.frenteServico.trim()) {
      setFeedback('Preencha nome do grupo, responsável e frente de serviço.');
      return;
    }
    if (groupForm.funcionarioIds.length === 0) {
      setFeedback('Vincule pelo menos um funcionário ao grupo.');
      return;
    }

    const now = new Date().toISOString();
    const payload: GrupoEquipe = {
      ...groupForm,
      id: editingGroupId || `grp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      token: groupForm.token || generateToken(),
      createdAt: groupForm.createdAt || now,
      updatedAt: now
    };
    onSaveGrupoEquipe(payload, !editingGroupId);
    setIsGroupFormOpen(false);
    setFeedback('');
  };

  const handleCopyLink = async (token: string) => {
    const link = buildPresenceLink(token);
    try {
      await navigator.clipboard.writeText(link);
      setFeedback('Link copiado para a área de transferência.');
    } catch {
      setFeedback(link);
    }
  };

  const handleCopyGeneralLink = async () => {
    const link = buildPresenceLink(GENERAL_PRESENCE_TOKEN);
    try {
      await navigator.clipboard.writeText(link);
      setFeedback('Link único copiado para a área de transferência.');
    } catch {
      setFeedback(link);
    }
  };

  const handleShareGeneralWhatsApp = () => {
    const link = buildPresenceLink(GENERAL_PRESENCE_TOKEN);
    const text = `Olá, preencha a presença da sua equipe selecionando o grupo no link: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const handleShareWhatsApp = (grupo: GrupoEquipe) => {
    const text = `Olá ${grupo.responsavel}, preencha a presença do grupo ${grupo.nome}: ${buildPresenceLink(grupo.token)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const rowsForExport = filteredRecords.map(item => [
    item.data,
    item.grupoNome,
    item.responsavel,
    item.frenteServico,
    item.funcionarioNome,
    item.funcao,
    item.status,
    item.observacao,
    item.horaEnvio
  ]);

  const handleExportCsv = () => {
    const csv = toCsv([
      ['Data', 'Grupo', 'Responsável', 'Frente de serviço', 'Funcionário', 'Função', 'Status', 'Observação', 'Horário'],
      ...rowsForExport
    ]);
    downloadBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), `presenca-${getTodayInput()}.csv`);
  };

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    configureCorporateWorkbook(workbook, 'Controle de Presença');
    const sheet = workbook.addWorksheet('Controle de Presença');
    sheet.columns = [
      { header: 'Data', key: 'data', width: 14 },
      { header: 'Grupo', key: 'grupo', width: 22 },
      { header: 'Responsável', key: 'responsavel', width: 26 },
      { header: 'Frente de serviço', key: 'frente', width: 30 },
      { header: 'Funcionário', key: 'funcionario', width: 34 },
      { header: 'Função', key: 'funcao', width: 28 },
      { header: 'Status', key: 'status', width: 20 },
      { header: 'Observação', key: 'observacao', width: 36 },
      { header: 'Horário', key: 'hora', width: 12 }
    ];
    rowsForExport.forEach(row => sheet.addRow(row));
    styleCorporateWorksheet(sheet, { title: 'Controle de Presença', headerRow: 1, lastColumn: 9, recordCount: rowsForExport.length });
    addCorporateSummarySheet(workbook, 'Controle de Presença', [
      ['Registros exportados', rowsForExport.length],
      ['Data de referência', getTodayInput().split('-').reverse().join('/')],
    ]);
    await downloadCorporateWorkbook(workbook, `RENEA_presenca_${getTodayInput()}.xlsx`);
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(13);
    doc.text('Sistema Renea - Controle de Presença', 14, 14);
    doc.setFontSize(9);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 20);
    autoTable(doc, {
      startY: 26,
      head: [['Data', 'Grupo', 'Responsável', 'Frente', 'Funcionário', 'Função', 'Status', 'Observação', 'Horário']],
      body: rowsForExport,
      styles: { fontSize: 7, cellPadding: 1.8 },
      headStyles: { fillColor: [6, 95, 70] }
    });
    doc.save(`presenca-${getTodayInput()}.pdf`);
  };

  const openEditRecord = (record: PresencaApontamento) => {
    setEditingRecord(record);
    setEditStatus(record.status);
    setEditObservacao(record.observacao);
    setEditMotivo('');
  };

  const confirmEditRecord = () => {
    if (!editingRecord || !editMotivo.trim()) return;
    onUpdatePresencaLink(editingRecord.id, editStatus, editObservacao, editMotivo);
    setEditingRecord(null);
  };

  const handleRefresh = async () => {
    const result = await onRefreshFromFirebase();
    setFeedback(result.message);
  };

  const Metric = ({ label, value, tone }: { label: string; value: string | number; tone?: string }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">{label}</p>
      <p className={`text-2xl font-black mt-1 ${tone || 'text-slate-100'}`}>{value}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-black uppercase tracking-widest text-[10px]">
            <ShieldCheck className="w-4 h-4" />
            Apontamento de Presença por Link
          </div>
          <h2 className="text-2xl font-black text-white mt-1">Controle de Presença</h2>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Cadastre equipes, gere links seguros para responsáveis e acompanhe os apontamentos recebidos do campo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:border-emerald-600 hover:text-white flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar do Firebase
          </button>
          <button
            onClick={handleOpenCreateGroup}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Criar grupo
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-200 text-xs font-semibold flex items-center justify-between gap-3">
          <span>{feedback}</span>
          <button onClick={() => setFeedback('')} className="text-emerald-200 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        {[
          ['dashboard', 'Dashboard'],
          ['grupos', 'Grupos / Equipes'],
          ['apontamentos', 'Apontamentos'],
          ['historico', 'Histórico']
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSubTab(id as SubTab)}
            className={`px-3 py-2 rounded-xl text-xs font-black transition-colors ${
              subTab === id
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === 'dashboard' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-xs font-bold text-slate-400">Data do painel</label>
            <input
              type="date"
              value={dataReferencia}
              onChange={e => setDataReferencia(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
            <Metric label="Previstos" value={dashboard.planned} />
            <Metric label="Presentes" value={dashboard.present} tone="text-emerald-300" />
            <Metric label="Ausentes" value={dashboard.absent} tone="text-rose-300" />
            <Metric label="Justificadas" value={dashboard.justified} tone="text-amber-300" />
            <Metric label="Enviaram" value={dashboard.sent} tone="text-blue-300" />
            <Metric label="Pendentes" value={dashboard.pending} tone="text-orange-300" />
            <Metric label="Duplicados" value={dashboard.duplicates} tone={dashboard.duplicates ? 'text-rose-300' : 'text-emerald-300'} />
            <Metric label="% Presença" value={`${dashboard.percent}%`} tone="text-emerald-300" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <BellRing className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-black text-white">Notificações internas do dia</h3>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {alertas.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-sm">Nenhum alerta para a data selecionada.</div>
                ) : (
                  alertas.map((alerta, index) => (
                    <div
                      key={`${alerta.title}-${index}`}
                      className={`p-3 rounded-xl border text-xs ${
                        alerta.type === 'error'
                          ? 'bg-rose-500/10 border-rose-500/20 text-rose-200'
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-100'
                      }`}
                    >
                      <p className="font-black uppercase tracking-wider text-[10px]">{alerta.title}</p>
                      <p className="mt-1">{alerta.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-black text-white">Grupos pendentes</h3>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {pendingGroups.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-sm">Todos os grupos ativos enviaram presença.</div>
                ) : (
                  pendingGroups.map(grupo => (
                    <div key={grupo.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{grupo.nome}</p>
                        <p className="text-[11px] text-slate-400 truncate">{grupo.responsavel} • {grupo.frenteServico}</p>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-orange-300">Pendente</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'grupos' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 text-[10px] uppercase tracking-widest font-black">
              <Link2 className="w-3.5 h-3.5" />
              Link único de presença (todos os grupos)
            </div>
            <p className="text-xs text-slate-400">
              Compartilhe este único link com todos os responsáveis. Ao abrir, a pessoa escolhe a aba do grupo dela
              antes de apontar a presença — não é preciso gerar um link por equipe.
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={buildPresenceLink(GENERAL_PRESENCE_TOKEN)}
                className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono"
              />
              <button onClick={handleCopyGeneralLink} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200" title="Copiar link único">
                <ClipboardCopy className="w-4 h-4" />
              </button>
              <button onClick={handleShareGeneralWhatsApp} className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white" title="Compartilhar no WhatsApp">
                <MessageCircle className="w-4 h-4" />
              </button>
              <a
                href={buildPresenceLink(GENERAL_PRESENCE_TOKEN)}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                title="Abrir link único"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={grupoSearch}
                onChange={e => setGrupoSearch(e.target.value)}
                placeholder="Buscar por grupo, responsável ou frente"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {isGroupFormOpen && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black text-white">{editingGroupId ? 'Editar grupo' : 'Criar grupo'}</h3>
                <button onClick={() => setIsGroupFormOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                <label className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Nome do grupo</span>
                  <input
                    value={groupForm.nome}
                    onChange={e => setGroupForm(prev => ({ ...prev, nome: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Responsável</span>
                  <input
                    value={groupForm.responsavel}
                    onChange={e => setGroupForm(prev => ({ ...prev, responsavel: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Obra/local</span>
                  <select
                    value={groupForm.obraId || ''}
                    onChange={e => {
                      const obra = obras.find(item => item.id === e.target.value);
                      setGroupForm(prev => ({ ...prev, obraId: e.target.value, frenteServico: obra?.nome || prev.frenteServico }));
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  >
                    <option value="">Sem obra vinculada</option>
                    {obras.map(obra => <option key={obra.id} value={obra.id}>{obra.nome}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Frente de serviço</span>
                  <input
                    value={groupForm.frenteServico}
                    onChange={e => setGroupForm(prev => ({ ...prev, frenteServico: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  />
                </label>
              </div>

              <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
                <label className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Token do link</span>
                  <input
                    value={groupForm.token}
                    onChange={e => setGroupForm(prev => ({ ...prev, token: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 font-mono"
                  />
                </label>
                <button
                  onClick={() => setGroupForm(prev => ({ ...prev, token: generateToken() }))}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-black flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Gerar link
                </button>
              </div>

              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <input
                    type="checkbox"
                    checked={groupForm.status === 'ativo'}
                    onChange={e => setGroupForm(prev => ({ ...prev, status: e.target.checked ? 'ativo' : 'inativo' }))}
                    className="accent-emerald-600"
                  />
                  Grupo ativo
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <input
                    type="checkbox"
                    checked={groupForm.linkAtivo}
                    onChange={e => setGroupForm(prev => ({ ...prev, linkAtivo: e.target.checked }))}
                    className="accent-emerald-600"
                  />
                  Link ativo
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Vincular funcionários</span>
                  <input
                    value={employeeSearch}
                    onChange={e => setEmployeeSearch(e.target.value)}
                    placeholder="Filtrar funcionários"
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                  {visibleFuncionarios.map(func => (
                    <label key={func.id} className="flex items-start gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-sm">
                      <input
                        type="checkbox"
                        checked={groupForm.funcionarioIds.includes(func.id)}
                        onChange={e => setGroupForm(prev => ({
                          ...prev,
                          funcionarioIds: e.target.checked
                            ? Array.from(new Set([...prev.funcionarioIds, func.id]))
                            : prev.funcionarioIds.filter(id => id !== func.id)
                        }))}
                        className="mt-1 accent-emerald-600"
                      />
                      <span className="min-w-0">
                        <span className="block text-slate-100 font-bold truncate">{func.nome}</span>
                        <span className="block text-[11px] text-slate-500 truncate">{func.cargo}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => setIsGroupFormOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveGroup}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-500 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Salvar grupo
                </button>
              </div>
            </div>
          )}

          <div className="grid xl:grid-cols-2 gap-4">
            {filteredGroups.map(grupo => {
              const link = buildPresenceLink(grupo.token);
              const groupEmployees = grupo.funcionarioIds
                .map(id => funcionarios.find(func => func.id === id))
                .filter(Boolean) as Funcionario[];
              return (
                <div key={grupo.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-white truncate">{grupo.nome}</h3>
                        <span className={`text-[9px] px-2 py-1 rounded-full border font-black uppercase ${
                          grupo.status === 'ativo' && grupo.linkAtivo
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                            : 'bg-slate-500/10 text-slate-400 border-slate-700'
                        }`}>
                          {grupo.status === 'ativo' && grupo.linkAtivo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{grupo.responsavel} • {grupo.frenteServico}</p>
                      <p className="text-[11px] text-slate-500 mt-1">{groupEmployees.length} funcionário(s) vinculado(s)</p>
                    </div>
                    <button
                      onClick={() => handleOpenEditGroup(grupo)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="Editar grupo"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-slate-500 mb-2">
                      <Link2 className="w-3.5 h-3.5" />
                      Link individual deste grupo
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={link}
                        className="flex-1 min-w-0 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono"
                      />
                      <button onClick={() => handleCopyLink(grupo.token)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200" title="Copiar link">
                        <ClipboardCopy className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleShareWhatsApp(grupo)} className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white" title="Compartilhar no WhatsApp">
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <a href={link} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200" title="Abrir link">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {groupEmployees.slice(0, 8).map(func => (
                      <span key={func.id} className="text-[10px] px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                        {func.nome}
                      </span>
                    ))}
                    {groupEmployees.length > 8 && (
                      <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-800 text-slate-400">
                        +{groupEmployees.length - 8}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between gap-2">
                    <button
                      onClick={() => onDeleteGrupoEquipe(grupo.id)}
                      className="text-[11px] font-bold text-rose-300 hover:text-rose-200"
                    >
                      Excluir grupo
                    </button>
                    <button
                      onClick={() => handleOpenEditGroup({ ...grupo, token: generateToken() })}
                      className="text-[11px] font-bold text-emerald-300 hover:text-emerald-200 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Recriar token
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {subTab === 'apontamentos' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="grid md:grid-cols-3 xl:grid-cols-7 gap-3">
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Data</span>
                <input type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Início</span>
                <input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Fim</span>
                <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Grupo</span>
                <select value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
                  <option value="todos">Todos</option>
                  {gruposEquipe.map(grupo => <option key={grupo.id} value={grupo.id}>{grupo.nome}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Responsável</span>
                <input value={filtroResponsavel} onChange={e => setFiltroResponsavel(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Frente</span>
                <input value={filtroFrente} onChange={e => setFiltroFrente(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Status</span>
                <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as 'todos' | PresencaStatus)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
                  <option value="todos">Todos</option>
                  {STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
            </div>
            <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
              <input
                value={filtroFuncionario}
                onChange={e => setFiltroFuncionario(e.target.value)}
                placeholder="Filtrar funcionário"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              />
              <div className="flex flex-wrap gap-2">
                <button onClick={handleExportExcel} className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel
                </button>
                <button onClick={handleExportPdf} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-black flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  PDF
                </button>
                <button onClick={handleExportCsv} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-black flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  CSV
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-xl">
            <table className="w-full min-w-[1100px] text-left">
              <thead className="bg-slate-950 text-[10px] uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-3 py-3">Data</th>
                  <th className="px-3 py-3">Grupo</th>
                  <th className="px-3 py-3">Responsável</th>
                  <th className="px-3 py-3">Frente de serviço</th>
                  <th className="px-3 py-3">Funcionário</th>
                  <th className="px-3 py-3">Função</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Observação</th>
                  <th className="px-3 py-3">Horário</th>
                  <th className="px-3 py-3">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-10 text-center text-slate-500">Nenhum apontamento encontrado.</td>
                  </tr>
                ) : (
                  filteredRecords.map(item => {
                    const isDuplicate = duplicatePresenceKeys.has(presenceDuplicateKey(item));
                    return (
                    <tr key={item.id} className={isDuplicate ? 'bg-rose-500/5 hover:bg-rose-500/10' : 'hover:bg-slate-800/40'}>
                      <td className="px-3 py-3 text-slate-300 font-mono">
                        {item.data}
                        {isDuplicate && (
                          <span className="mt-1 flex w-fit items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-black text-rose-300">
                            <AlertTriangle className="h-3 w-3" /> Duplicado
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-white font-bold">{item.grupoNome}</td>
                      <td className="px-3 py-3 text-slate-300">{item.responsavel}</td>
                      <td className="px-3 py-3 text-slate-300">{item.frenteServico}</td>
                      <td className="px-3 py-3 text-white">{item.funcionarioNome}</td>
                      <td className="px-3 py-3 text-slate-400">{item.funcao}</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-1 rounded-full border text-[10px] font-black ${statusClasses[item.status]}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-400 max-w-xs truncate">{item.observacao || '-'}</td>
                      <td className="px-3 py-3 text-slate-300 font-mono">{item.horaEnvio}</td>
                      <td className="px-3 py-3">
                        <button onClick={() => openEditRecord(item)} className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-[10px] font-bold">
                          Atualizar presença
                        </button>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'historico' && (
        <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-xl">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-slate-950 text-[10px] uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-3 py-3">Data</th>
                <th className="px-3 py-3">Funcionário</th>
                <th className="px-3 py-3">Quem editou</th>
                <th className="px-3 py-3">Quando</th>
                <th className="px-3 py-3">Motivo</th>
                <th className="px-3 py-3">Anterior</th>
                <th className="px-3 py-3">Novo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs">
              {historicoPresencas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-500">Nenhuma alteração registrada.</td>
                </tr>
              ) : (
                historicoPresencas.map(item => {
                  const funcionario = funcionarios.find(func => func.id === item.funcionarioId);
                  return (
                    <tr key={item.id}>
                      <td className="px-3 py-3 text-slate-300 font-mono">{item.data}</td>
                      <td className="px-3 py-3 text-white">{funcionario?.nome || item.funcionarioId}</td>
                      <td className="px-3 py-3 text-slate-300">{item.editadoPor}</td>
                      <td className="px-3 py-3 text-slate-300">{item.editadoEm}</td>
                      <td className="px-3 py-3 text-slate-400">{item.motivo}</td>
                      <td className="px-3 py-3 text-rose-200">{item.valorAnterior}</td>
                      <td className="px-3 py-3 text-emerald-200">{item.valorNovo}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-white">Atualizar presença</h3>
                <p className="text-sm text-slate-400">{editingRecord.funcionarioNome} • {editingRecord.grupoNome}</p>
              </div>
              <button onClick={() => setEditingRecord(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <label className="space-y-1 block">
              <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Status de presença</span>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value as PresencaStatus)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
                {STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>

            <label className="space-y-1 block">
              <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Observação</span>
              <textarea value={editObservacao} onChange={e => setEditObservacao(e.target.value)} rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 resize-none" />
            </label>

            <label className="space-y-1 block">
              <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Motivo da alteração</span>
              <textarea value={editMotivo} onChange={e => setEditMotivo(e.target.value)} rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 resize-none" />
            </label>

            {!editMotivo.trim() && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-100 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                Informe o motivo para registrar o histórico de alteração.
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingRecord(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700">
                Cancelar
              </button>
              <button
                onClick={confirmEditRecord}
                disabled={!editMotivo.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Salvar atualização
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
