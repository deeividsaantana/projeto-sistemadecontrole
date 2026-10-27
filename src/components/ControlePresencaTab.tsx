import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  MessageCircle,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Trash2,
  Undo2,
  Users,
  X,
  PieChart,
} from 'lucide-react';
import { companiesForTeams } from '../masterData/centralRegistry';
import {
  applyTeamSyncPlan,
  buildTeamSyncPlan,
  parseEfetivoRows,
  type TeamSyncPlan,
} from '../utils/teamSpreadsheetSync';
import { generateSecurePublicToken } from '../utils/publicLinkSecurity';
import { ConfirmDialog, Modal, PageHeader } from '../shared/ui';
import { AbasDaTela, idDaAba } from '../shared/ui/AbasDaTela';
import { TelaCheia } from '../shared/ui/TelaCheia';
import { TabelaPadrao, type ColunaTabela } from '../shared/ui/TabelaPadrao';
import { normalizeComparable } from '../utils/canonicalIdentity';
import { readableTeamText, recoverTeamGroups, teamRecordMatches } from '../utils/teamIdentity';
import type { SituacaoLancada } from '../utils/presencaManual';
import {
  AFASTAMENTOS_PREVISTOS,
  diasAntes,
  efetivoPorEmpresa,
  efetivoPorFrente,
  faltasRepetidas,
} from '../utils/painelPresenca';
import { CANTEIROS_ATIVOS, RAMOS_ATIVOS, contemTermo } from '../utils/frenteServico';
import RelatoriosPresenca from './presenca/RelatoriosPresenca';
import FormularioLancamentoPresenca from './presenca/FormularioLancamentoPresenca';
import reneaLogo from '../assets/images/logo-renea-dark.svg';
import { addCorporateSummarySheet, configureCorporateWorkbook, createCorporateWorkbook, downloadCorporateWorkbook, styleCorporateWorksheet } from '../utils/excelCorporate';
import { baixarPlanilhaEquipes } from '../utils/exportarEquipesExcel';
import { generateUniversalPdfReport } from '../utils/universalPdfReport';
import type {
  Empresa,
  Funcionario,
  GrupoEquipe,
  HistoricoPresenca,
  ObraLocal,
  PresencaApontamento,
  PresencaStatus,
} from '../types';

const STATUS_OPTIONS: PresencaStatus[] = [
  'Presente',
  'Atraso',
  'Saída antecipada',
  'Ausente',
  'Falta justificada',
  'Atestado',
  'Férias',
  'Baixada',
  'Recesso',
  'Afastado',
  'Desligado',
  'Outro',
];

const ACTIVE_BRANCHES: readonly string[] = RAMOS_ATIVOS;
const ACTIVE_SITES: readonly string[] = CANTEIROS_ATIVOS;

const STATUS_STYLES: Record<PresencaStatus, string> = {
  Presente: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Atraso: 'border-amber-200 bg-amber-50 text-amber-800',
  'Saída antecipada': 'border-amber-200 bg-amber-50 text-amber-800',
  Ausente: 'border-rose-200 bg-rose-50 text-rose-800',
  'Falta justificada': 'border-amber-200 bg-amber-50 text-amber-800',
  Atestado: 'border-sky-200 bg-sky-50 text-sky-800',
  // Afastamento previsto: mesma família visual, para o olho já saber que não
  // é falta antes de ler o texto.
  Férias: 'border-stone-200 bg-stone-100 text-stone-700',
  Baixada: 'border-stone-200 bg-stone-100 text-stone-700',
  Recesso: 'border-stone-200 bg-stone-100 text-stone-700',
  Afastado: 'border-orange-200 bg-orange-50 text-orange-800',
  Desligado: 'border-slate-300 bg-slate-100 text-slate-700',
  Outro: 'border-violet-200 bg-violet-50 text-violet-800',
};

const PANEL = 'rounded-xl border border-slate-200 bg-white';
const FOCO = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--renea-focus)';
const ROTULO_CAMPO = 'block text-xs font-bold text-[#5b6870]';
const FIELD = 'min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10';
const SECONDARY_BUTTON = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-emerald-700 hover:text-emerald-800 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45 ${FOCO}`;
const PRIMARY_BUTTON = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b4d] px-4 text-sm font-bold text-white transition hover:bg-emerald-800 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45 ${FOCO}`;

interface ControlePresencaTabProps {
  empresas: Empresa[];
  funcionarios: Funcionario[];
  obras: ObraLocal[];
  /** Canteiros do cadastro; sem isso usa a lista fixa de reserva. */
  canteiros?: readonly string[];
  gruposEquipe: GrupoEquipe[];
  presencasLink: PresencaApontamento[];
  historicoPresencas: HistoricoPresenca[];
  onSaveGrupoEquipe: (grupo: GrupoEquipe, isNew: boolean) => void;
  /** Sem ele, não aparece Excluir equipe: só o administrador exclui cadastro. */
  onDeleteGrupoEquipe?: (id: string) => void;
  onUpdatePresencaLink: (id: string, status: PresencaStatus, observacao: string, motivo: string) => void;
  /** Lançar a presença de uma equipe que não usou o link. */
  onLancarPresencaManual?: (
    grupo: GrupoEquipe,
    data: string,
    situacoes: SituacaoLancada[],
    observacaoDia: string,
  ) => void;
  /** Registros inativados, para ver e reativar. */
  presencasInativas?: PresencaApontamento[];
  /** Inativa (não apaga): sai das telas e dos relatórios e volta com Reativar. */
  onInativarPresencaLink?: (ids: string[]) => void;
  onReativarPresencaLink?: (ids: string[]) => void;
  /** Apaga os envios e a reserva do dia, liberando um novo apontamento. */
  onResetPresencaDia?: (grupoId: string, data: string) => Promise<{ success: boolean; message: string }>;
  /** Grava a sincronização já conferida pelo administrativo. */
  onSyncEquipesPlanilha?: (
    funcionarios: Funcionario[],
    gruposEquipe: GrupoEquipe[],
    resumo: TeamSyncPlan['resumo'],
  ) => Promise<{ success: boolean; message: string }>;
  /**
   * Envios do link público que já chegaram no Supabase mas ainda não foram
   * incorporados a este retrato local. Um número maior que zero por muito
   * tempo indica que o processamento em tempo real travou, mesmo sem erro
   * visível — o dado existe, só não foi puxado para cá ainda.
   */
  pendingPublicSubmissionsCount?: number;
  /**
   * Reconstrói o histórico de presença a partir dos envios originais do link
   * público (nunca apagados), para trazer de volta dias que sumiram do
   * retrato consolidado sem apagar nada que já esteja presente.
   */
  onRestorePresenceHistory?: () => Promise<{ success: boolean; message: string }>;
  /** Parte que abre primeiro; a aba Relatórios pede 'relatorios'. */
  viewInicial?: View;
}

type View = 'ao-vivo' | 'relatorios' | 'equipes' | 'registros' | 'historico';

const localToday = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const safeText = readableTeamText;
const safeIds = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item)) : [];

const normalizeGroup = (group: GrupoEquipe): GrupoEquipe => ({
  ...group,
  id: safeText(group?.id),
  nome: safeText(group?.nome),
  responsavel: safeText(group?.responsavel),
  frenteServico: safeText(group?.frenteServico),
  obraId: safeText(group?.obraId),
  funcionarioIds: safeIds(group?.funcionarioIds),
  funcionarioMatriculas: safeIds(group?.funcionarioMatriculas),
  token: safeText(group?.token),
  tokenGeral: safeText(group?.tokenGeral) || undefined,
  status: group?.status === 'inativo' ? 'inativo' : 'ativo',
  linkAtivo: group?.linkAtivo !== false,
  createdAt: safeText(group?.createdAt),
  updatedAt: safeText(group?.updatedAt),
});

const normalizeRecord = (record: PresencaApontamento): PresencaApontamento => ({
  ...record,
  id: safeText(record?.id),
  data: safeText(record?.data),
  horaEnvio: safeText(record?.horaEnvio),
  grupoId: safeText(record?.grupoId),
  grupoNome: safeText(record?.grupoNome),
  responsavel: safeText(record?.responsavel),
  frenteServico: safeText(record?.frenteServico),
  funcionarioId: safeText(record?.funcionarioId),
  funcionarioNome: safeText(record?.funcionarioNome),
  funcao: safeText(record?.funcao),
  observacao: safeText(record?.observacao),
  status: STATUS_OPTIONS.includes(record?.status) ? record.status : 'Outro',
});

const generateToken = () => Array.from(crypto.getRandomValues(new Uint32Array(4)))
  .map(part => part.toString(36))
  .join('-');

const presenceLink = (token: string) => `${window.location.origin}/presenca-link/${encodeURIComponent(token)}`;
const duplicateKey = (record: PresencaApontamento) => `${record.grupoId}|${record.data}|${record.funcionarioId}`;

const saveBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const dataBr = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');

/** "2026-09-03T14:05:00.000Z" vira "03/09/2026 11:05"; texto que não é data fica como veio. */
const quandoBr = (valor: string) => {
  const data = new Date(valor);
  if (!valor || Number.isNaN(data.getTime())) return valor || '—';
  return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const toCsv = (rows: Array<Array<string | number>>) => rows
  .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';'))
  .join('\n');

export default function ControlePresencaTab({
  empresas = [],
  funcionarios = [],
  obras = [],
  canteiros = ACTIVE_SITES,
  gruposEquipe = [],
  presencasLink = [],
  historicoPresencas = [],
  onSaveGrupoEquipe,
  onDeleteGrupoEquipe,
  onUpdatePresencaLink,
  onLancarPresencaManual,
  presencasInativas = [],
  onInativarPresencaLink,
  onReativarPresencaLink,
  onResetPresencaDia,
  onSyncEquipesPlanilha,
  pendingPublicSubmissionsCount = 0,
  onRestorePresenceHistory,
  viewInicial,
}: ControlePresencaTabProps) {
  const today = localToday();
  const safeFuncionarios = useMemo(() => (Array.isArray(funcionarios) ? funcionarios : []).filter(Boolean), [funcionarios]);
  const safeEmpresas = useMemo(() => (Array.isArray(empresas) ? empresas : []).filter(Boolean), [empresas]);
  // No editor de equipe só entram empresas que fornecem gente: locadoras e
  // fornecedores de material ficam de fora, salvo se já tiverem colaborador.
  const teamCompanies = useMemo(() => companiesForTeams(safeEmpresas, safeFuncionarios), [safeEmpresas, safeFuncionarios]);
  const safeObras = useMemo(() => (Array.isArray(obras) ? obras : []).filter(Boolean), [obras]);
  const safeRecords = useMemo(() => (Array.isArray(presencasLink) ? presencasLink : []).filter(Boolean).map(normalizeRecord), [presencasLink]);
  const inativos = useMemo(() => (Array.isArray(presencasInativas) ? presencasInativas : []).filter(Boolean).map(normalizeRecord), [presencasInativas]);
  const safeGroups = useMemo(() => recoverTeamGroups(
    (Array.isArray(gruposEquipe) ? gruposEquipe : []).filter(Boolean).map(normalizeGroup),
    safeRecords,
    safeFuncionarios,
  ), [gruposEquipe, safeFuncionarios, safeRecords]);
  const safeHistory = useMemo(() => (Array.isArray(historicoPresencas) ? historicoPresencas : []).filter(Boolean), [historicoPresencas]);

  const [view, setView] = useState<View>(viewInicial ?? 'ao-vivo');
  const [referenceDate, setReferenceDate] = useState(today);
  const [dashboardCompany, setDashboardCompany] = useState('todas');
  const [dashboardGroup, setDashboardGroup] = useState('todos');
  const [dashboardRole, setDashboardRole] = useState('todas');
  const [dashboardStatus, setDashboardStatus] = useState<'todos' | PresencaStatus>('todos');
  const [dashboardBranch, setDashboardBranch] = useState('todos');
  const [dashboardSite, setDashboardSite] = useState('todos');
  const [dashboardSearch, setDashboardSearch] = useState('');
  // No celular a gaveta nasce fechada: o painel tem de mostrar gente, não
  // formulário. No desktop sobra largura, então já abre.
  const [filtrosAbertos, setFiltrosAbertos] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1024,
  );
  const [recordDate, setRecordDate] = useState(today);
  const [recordGroup, setRecordGroup] = useState('todos');
  const [recordStatus, setRecordStatus] = useState<'todos' | PresencaStatus>('todos');
  const [recordSearch, setRecordSearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeCompany, setEmployeeCompany] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isGroupEditorOpen, setIsGroupEditorOpen] = useState(false);
  const groupEditorScrollRef = useRef<HTMLDivElement>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  // Ao editar, a lista abre só com quem já está na equipe; "Todos ativos" mostra o efetivo inteiro.
  const [membrosAoAbrir, setMembrosAoAbrir] = useState<string[] | null>(null);
  const [editingRecord, setEditingRecord] = useState<PresencaApontamento | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  /** Lista mostra os inativados, para reativar. */
  const [verInativos, setVerInativos] = useState(false);
  /** Últimos inativados, para o Desfazer do aviso. */
  const [desfazerInativacao, setDesfazerInativacao] = useState<string[]>([]);
  /** Equipe esperando confirmação para excluir (A29): um toque errado não apaga. */
  const [equipeExcluindo, setEquipeExcluindo] = useState<GrupoEquipe | null>(null);
  const [editStatus, setEditStatus] = useState<PresencaStatus>('Presente');
  const [editObservation, setEditObservation] = useState('');
  const [editReason, setEditReason] = useState('');
  // Sincronização pela planilha do efetivo: o plano é montado e conferido
  // antes de qualquer gravação.
  const [syncPlan, setSyncPlan] = useState<TeamSyncPlan | null>(null);
  const [syncFileName, setSyncFileName] = useState('');
  const [syncError, setSyncError] = useState('');
  const [syncBusy, setSyncBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [confirmandoInativacao, setConfirmandoInativacao] = useState(false);
  const [resumoZerarDia, setResumoZerarDia] = useState<{ equipe: string; quantos: number } | null>(null);
  const [restoringHistory, setRestoringHistory] = useState(false);
  // Lançamento manual: equipe escolhida, dia, e a situação de cada um.
  const [lancamento, setLancamento] = useState<{ grupoId: string; data: string; observacaoDia: string } | null>(null);
  const [situacoesLancadas, setSituacoesLancadas] = useState<Record<string, SituacaoLancada>>({});

  // O crachá no botão diz quantos recortes estão valendo: sem abrir a gaveta,
  // dá para saber se o número na tela é o efetivo todo ou um pedaço dele.
  const filtrosAtivos = [
    dashboardCompany !== 'todas',
    dashboardGroup !== 'todos',
    dashboardRole !== 'todas',
    dashboardStatus !== 'todos',
    dashboardBranch !== 'todos',
    dashboardSite !== 'todos',
    dashboardSearch.trim() !== '',
  ].filter(Boolean).length;

  const abrirLancamento = (grupoId: string) => {
    // A lista já vem com o que a equipe tem hoje: quem estiver apontado no dia
    // aparece com a situação atual, para o lançamento ser correção e não
    // recomeço.
    const jaApontado = new Map(
      dayRecords.filter(item => item.grupoId === grupoId).map(item => [item.funcionarioId, item]),
    );
    const grupo = safeGroups.find(item => item.id === grupoId);
    const inicial: Record<string, SituacaoLancada> = {};
    (grupo?.funcionarioIds || []).forEach(id => {
      const atual = jaApontado.get(id);
      if (atual) inicial[id] = { funcionarioId: id, status: atual.status, observacao: atual.observacao };
    });
    setSituacoesLancadas(inicial);
    setLancamento({ grupoId, data: referenceDate, observacaoDia: '' });
  };

  const limparFiltrosPainel = () => {
    setDashboardCompany('todas');
    setDashboardGroup('todos');
    setDashboardRole('todas');
    setDashboardStatus('todos');
    setDashboardBranch('todos');
    setDashboardSite('todos');
    setDashboardSearch('');
  };
  const liveViewRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef<HTMLElement>(null);

  const createEmptyGroup = (): GrupoEquipe => ({
    id: '',
    nome: '',
    responsavel: '',
    frenteServico: safeObras[0]?.nome || '',
    obraId: safeObras[0]?.id || '',
    funcionarioIds: [],
    funcionarioMatriculas: [],
    status: 'ativo',
    token: generateToken(),
    linkAtivo: true,
    createdAt: '',
    updatedAt: '',
  });

  const [groupForm, setGroupForm] = useState<GrupoEquipe>(() => createEmptyGroup());

  const activeGroups = useMemo(
    () => safeGroups.filter(group => group.status === 'ativo' && group.linkAtivo),
    [safeGroups],
  );
  const dayRecords = useMemo(() => safeRecords.filter(record => record.data === referenceDate), [referenceDate, safeRecords]);
  const roleOptions = useMemo(() => [...new Set(safeRecords.map(record => record.funcao).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [safeRecords]);
  const employeeById = useMemo(() => new Map(safeFuncionarios.map(employee => [employee.id, employee])), [safeFuncionarios]);
  const buscaPainel = normalizeComparable(dashboardSearch.trim());
  const recordMatchesDashboard = (record: PresencaApontamento) => {
    const employee = employeeById.get(record.funcionarioId);
    const operationalLocation = `${record.grupoNome} ${record.frenteServico}`.toLocaleLowerCase('pt-BR');
    return (dashboardCompany === 'todas' || employee?.empresaId === dashboardCompany)
      && (dashboardGroup === 'todos' || activeGroups.some(group => group.id === dashboardGroup && teamRecordMatches(group, record)))
      && (dashboardRole === 'todas' || record.funcao === dashboardRole)
      && (dashboardStatus === 'todos' || record.status === dashboardStatus)
      && (dashboardBranch === 'todos' || contemTermo(operationalLocation, dashboardBranch))
      && (dashboardSite === 'todos' || contemTermo(operationalLocation, dashboardSite))
      // Procurar uma pessoa pelo nome ou matrícula é o filtro que mais falta
      // quando alguém liga perguntando "o fulano bateu hoje?".
      && (!buscaPainel || normalizeComparable(
        `${record.funcionarioNome} ${employee?.matricula || ''} ${record.funcao}`,
      ).includes(buscaPainel));
  };
  const dashboardRecords = useMemo(
    () => dayRecords.filter(recordMatchesDashboard),
    [buscaPainel, dashboardBranch, dashboardCompany, dashboardGroup, dashboardRole, dashboardSite, dashboardStatus, dayRecords, employeeById],
  );
  // O relatório usa os mesmos filtros do painel, só que em todos os dias: o
  // período é escolhido dentro dele.
  const relatorioRegistros = useMemo(
    () => (view === 'relatorios' ? safeRecords.filter(recordMatchesDashboard) : []),
    [buscaPainel, dashboardBranch, dashboardCompany, dashboardGroup, dashboardRole, dashboardSite, dashboardStatus, employeeById, safeRecords, view],
  );
  const filtrosDescritos = [
    dashboardCompany !== 'todas' && `Empresa: ${safeEmpresas.find(company => company.id === dashboardCompany)?.nome || dashboardCompany}`,
    dashboardGroup !== 'todos' && `Equipe: ${activeGroups.find(group => group.id === dashboardGroup)?.nome || dashboardGroup}`,
    dashboardRole !== 'todas' && `Função: ${dashboardRole}`,
    dashboardStatus !== 'todos' && `Situação: ${dashboardStatus}`,
    dashboardBranch !== 'todos' && `Ramo: ${dashboardBranch}`,
    dashboardSite !== 'todos' && `Canteiro: ${dashboardSite}`,
    dashboardSearch.trim() && `Busca: ${dashboardSearch.trim()}`,
  ].filter((item): item is string => Boolean(item));
  const pendingGroups = useMemo(
    () => activeGroups.filter(group => !dayRecords.some(record => teamRecordMatches(group, record))),
    [activeGroups, dayRecords],
  );
  const dashboardPendingGroups = useMemo(
    () => pendingGroups.filter(group => {
      const location = `${group.nome} ${group.frenteServico}`.toLocaleLowerCase('pt-BR');
      return (dashboardGroup === 'todos' || group.id === dashboardGroup)
        && (dashboardBranch === 'todos' || contemTermo(location, dashboardBranch))
        && (dashboardSite === 'todos' || contemTermo(location, dashboardSite));
    }),
    [dashboardBranch, dashboardGroup, dashboardSite, pendingGroups],
  );

  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>();
    safeRecords.forEach(record => counts.set(duplicateKey(record), (counts.get(duplicateKey(record)) || 0) + 1));
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  }, [safeRecords]);

  const metrics = useMemo(() => {
    const plannedIds = new Set(activeGroups
      .filter(group => {
        const location = `${group.nome} ${group.frenteServico}`.toLocaleLowerCase('pt-BR');
        return (dashboardGroup === 'todos' || group.id === dashboardGroup)
          && (dashboardBranch === 'todos' || contemTermo(location, dashboardBranch))
          && (dashboardSite === 'todos' || contemTermo(location, dashboardSite));
      })
      .flatMap(group => group.funcionarioIds)
      .filter(id => {
        const employee = employeeById.get(id);
        return (dashboardCompany === 'todas' || employee?.empresaId === dashboardCompany)
          && (dashboardRole === 'todas' || employee?.cargo === dashboardRole);
      }));
    const planned = plannedIds.size;
    const present = dashboardRecords.filter(record => record.status === 'Presente').length;
    const absent = dashboardRecords.filter(record => record.status === 'Ausente').length;
    const justified = dashboardRecords.filter(record => ['Falta justificada', 'Atestado'].includes(record.status)).length;
    const latest = [...dashboardRecords].sort((a, b) => b.horaEnvio.localeCompare(a.horaEnvio))[0];
    return {
      planned,
      present,
      absent,
      justified,
      pending: dashboardPendingGroups.length,
      percent: planned ? Math.min(100, Math.round((present / planned) * 100)) : 0,
      latest: latest?.horaEnvio || '',
    };
  }, [activeGroups, dashboardBranch, dashboardCompany, dashboardGroup, dashboardPendingGroups.length, dashboardRecords, dashboardRole, dashboardSite, employeeById]);

  /** Ultimos 7 dias com movimento, do mais antigo para o mais recente. */
  const tendencia = useMemo(() => {
    const parsed = new Date(`${referenceDate}T12:00:00`);
    const base = Number.isNaN(parsed.getTime()) ? new Date(`${today}T12:00:00`) : parsed;
    return Array.from({ length: 7 }, (_, index) => {
      const dia = new Date(base);
      dia.setDate(dia.getDate() - (6 - index));
      const iso = dia.toISOString().slice(0, 10);
      const doDia = safeRecords.filter(record => record.data === iso && recordMatchesDashboard(record));
      return {
        iso,
        rotulo: iso.slice(8, 10) + '/' + iso.slice(5, 7),
        presentes: doDia.filter(record => record.status === 'Presente').length,
        total: doDia.length,
      };
    });
  }, [dashboardBranch, dashboardCompany, dashboardGroup, dashboardRole, dashboardSite, dashboardStatus, employeeById, referenceDate, safeRecords, today]);

  const picoTendencia = useMemo(
    () => Math.max(1, ...tendencia.map(item => item.presentes)),
    [tendencia],
  );

  /** Distribuicao completa das situacoes do dia, nao so presente/ausente. */
  const distribuicao = useMemo(() => STATUS_OPTIONS
    .map(status => ({ status, total: dashboardRecords.filter(record => record.status === status).length }))
    .filter(item => item.total > 0), [dashboardRecords]);

  // Por frente: várias equipes trabalham no mesmo Ramo, e é pelo Ramo que se
  // decide remanejar gente no meio do dia.
  const efetivoDasFrentes = useMemo(
    () => efetivoPorFrente(dashboardRecords, activeGroups, safeFuncionarios),
    [dashboardRecords, activeGroups, safeFuncionarios],
  );

  // Por empresa: é assim que se cobra quem não entrega o efetivo contratado.
  const efetivoDasEmpresas = useMemo(
    () => efetivoPorEmpresa(dashboardRecords, safeFuncionarios, safeEmpresas),
    [dashboardRecords, safeFuncionarios, safeEmpresas],
  );

  // O painel mostra o dia; quem falta sempre só aparece no mês. A janela de 30
  // dias termina na data de referência, não em hoje, para conferir o passado.
  const [minimoFaltas, setMinimoFaltas] = useState(3);
  const reincidentes = useMemo(
    () => faltasRepetidas(safeRecords, {
      minimo: minimoFaltas,
      desde: diasAntes(referenceDate, 30),
      ate: referenceDate,
    }),
    [safeRecords, minimoFaltas, referenceDate],
  );

  const funcoesDoDia = useMemo(() => {
    const mapa = new Map<string, number>();
    dashboardRecords.forEach(record => mapa.set(record.funcao || 'Função não informada', (mapa.get(record.funcao || 'Função não informada') || 0) + 1));
    return [...mapa.entries()].map(([funcao, total]) => ({ funcao, total })).sort((a, b) => b.total - a.total);
  }, [dashboardRecords]);
  const picoFuncoes = Math.max(1, ...funcoesDoDia.map(item => item.total));

  /** Quanta gente cada equipe confirmou no recorte, da maior para a menor. */
  const equipesDoDia = useMemo(() => {
    const mapa = new Map<string, { id: string; total: number }>();
    dashboardRecords.forEach(record => {
      const nome = record.grupoNome || 'Equipe não informada';
      const atual = mapa.get(nome) || { id: record.grupoId, total: 0 };
      mapa.set(nome, { id: atual.id || record.grupoId, total: atual.total + 1 });
    });
    return [...mapa.entries()].map(([nome, dados]) => ({ nome, ...dados })).sort((a, b) => b.total - a.total);
  }, [dashboardRecords]);
  const picoEquipes = Math.max(1, ...equipesDoDia.map(item => item.total));

  /** Quem esta ausente hoje, para o administrativo agir sem trocar de aba. */
  const ausentesDoDia = useMemo(
    () => dashboardRecords.filter(record => record.status === 'Ausente' || record.status === 'Falta justificada'),
    [dashboardRecords],
  );

  useGSAP(() => {
    if (view !== 'ao-vivo' || !liveViewRef.current) return;
    const scope = liveViewRef.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    scope.querySelectorAll<HTMLElement>('[data-count]').forEach(node => {
      const target = Number(node.dataset.count || 0);
      if (reduceMotion) {
        node.textContent = target.toLocaleString('pt-BR');
        return;
      }
      const counter = { current: 0 };
      gsap.to(counter, {
        current: target,
        duration: 0.7,
        ease: 'power2.out',
        onUpdate: () => { node.textContent = Math.round(counter.current).toLocaleString('pt-BR'); },
      });
    });

    // As barras crescem por escala, não por altura/largura. Animar tamanho
    // obriga o navegador a refazer o layout a cada quadro — no celular da obra
    // isso engasga. Escala roda na GPU e é o que as regras do projeto pedem.
    const trendBars = scope.querySelectorAll<HTMLElement>('[data-trend-bar]');
    trendBars.forEach(bar => { bar.style.height = `${bar.dataset.pct}%`; bar.style.transformOrigin = 'bottom'; });
    if (!reduceMotion) {
      gsap.fromTo(trendBars, { scaleY: 0.02 }, {
        scaleY: 1, duration: 0.6, ease: 'power3.out', stagger: 0.05, delay: 0.15,
      });
    }

    const distBars = scope.querySelectorAll<HTMLElement>('[data-dist-bar]');
    distBars.forEach(bar => { bar.style.width = `${bar.dataset.pct}%`; bar.style.transformOrigin = 'left'; });
    if (!reduceMotion) {
      gsap.fromTo(distBars, { scaleX: 0 }, {
        scaleX: 1, duration: 0.7, ease: 'power3.out', stagger: 0.06, delay: 0.1,
      });
    }

    // A barra do efetivo confirmado enche da esquerda, junto com o número.
    const barraEfetivo = scope.querySelector<HTMLElement>('[data-barra-efetivo]');
    if (barraEfetivo && !reduceMotion) {
      gsap.fromTo(barraEfetivo, { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power3.out', delay: 0.1 });
    }

    // Seta decorativa do card de efetivo: um leve vaivém contínuo sugere que o
    // número segue vivo, sem competir com a leitura do valor.
    const setaEfetivo = scope.querySelector<HTMLElement>('[data-seta-efetivo]');
    if (setaEfetivo && !reduceMotion) {
      gsap.to(setaEfetivo, { x: 5, duration: 1.3, ease: 'sine.inOut', repeat: -1, yoyo: true, delay: 0.5 });
    }

    // Os cartões entram em cascata, de baixo para cima e de leve: dá ritmo à
    // leitura sem atrasar quem só quer ver o número.
    if (!reduceMotion) {
      gsap.fromTo(
        scope.querySelectorAll<HTMLElement>('[data-cartao-painel]'),
        { autoAlpha: 0, y: 14 },
        {
          autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.07,
          clearProps: 'transform,opacity,visibility',
        },
      );
    }
  }, { scope: liveViewRef, dependencies: [view, metrics.present, tendencia, distribuicao] });

  // Registros e histórico são listas longas de conferência. A mesma cascata
  // curta do painel ao vivo dá referência de ordem sem atrasar a leitura.
  useGSAP(() => {
    const scope = tabRef.current;
    if (!scope || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rows = scope.querySelectorAll('[data-linha-lista]');
    if (!rows.length) return;
    gsap.fromTo(
      rows,
      { autoAlpha: 0, y: 8 },
      { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.02, ease: 'power2.out', clearProps: 'transform,opacity,visibility' },
    );
  }, { scope: tabRef, dependencies: [view] });

  const teamRows = useMemo(() => activeGroups.map(group => {
    const records = dayRecords.filter(record => teamRecordMatches(group, record));
    return {
      group,
      sent: records.length > 0,
      present: records.filter(record => record.status === 'Presente').length,
      total: group.funcionarioIds.length,
      updatedAt: [...records].sort((a, b) => b.horaEnvio.localeCompare(a.horaEnvio))[0]?.horaEnvio || '',
    };
  }), [activeGroups, dayRecords]);

  const filteredGroups = useMemo(() => {
    const query = teamSearch.trim().toLocaleLowerCase('pt-BR');
    return safeGroups.filter(group => !query || [group.nome, group.responsavel, group.frenteServico]
      .some(value => value.toLocaleLowerCase('pt-BR').includes(query)));
  }, [safeGroups, teamSearch]);

  const visibleEmployees = useMemo(() => {
    const query = employeeSearch.trim().toLocaleLowerCase('pt-BR');
    return safeFuncionarios
      .filter(employee => employee?.ativo && !['INATIVO', 'DESMOBILIZADO'].includes(safeText(employee.status)))
      .filter(employee => !membrosAoAbrir || membrosAoAbrir.includes(employee.id))
      .filter(employee => !employeeCompany || employee.empresaId === employeeCompany)
      .filter(employee => !query || [safeText(employee.nome), safeText(employee.cargo), safeText(employee.matricula)]
        .some(value => value.toLocaleLowerCase('pt-BR').includes(query)))
      .sort((a, b) => safeText(a.nome).localeCompare(safeText(b.nome), 'pt-BR'));
  }, [employeeCompany, employeeSearch, membrosAoAbrir, safeFuncionarios]);

  const filteredRecords = useMemo(() => {
    const query = recordSearch.trim().toLocaleLowerCase('pt-BR');
    return (verInativos ? inativos : safeRecords)
      .filter(record => !recordDate || record.data === recordDate)
      .filter(record => recordGroup === 'todos' || record.grupoId === recordGroup)
      .filter(record => recordStatus === 'todos' || record.status === recordStatus)
      .filter(record => !query || [record.funcionarioNome, record.funcao, record.responsavel, record.frenteServico]
        .some(value => value.toLocaleLowerCase('pt-BR').includes(query)))
      .sort((a, b) => `${b.data} ${b.horaEnvio}`.localeCompare(`${a.data} ${a.horaEnvio}`));
  }, [inativos, recordDate, recordGroup, recordSearch, recordStatus, safeRecords, verInativos]);

  const exportRows = filteredRecords.map(record => [
    record.data,
    record.grupoNome,
    record.responsavel,
    record.frenteServico,
    record.funcionarioNome,
    record.funcao,
    record.status,
    record.observacao,
    record.horaEnvio,
  ]);

  // O painel de edição é o mesmo elemento reaproveitado entre "Nova equipe" e
  // "Editar equipe": sem isso, quem tinha rolado até a lista de colaboradores
  // numa abertura anterior reabria o painel já rolado lá embaixo, parecendo
  // que "sumiu" o formulário. Trava o fundo também, para não rolar por baixo
  // do painel no celular.
  useEffect(() => {
    if (!isGroupEditorOpen) return;
    groupEditorScrollRef.current?.scrollTo({ top: 0 });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isGroupEditorOpen]);

  const openNewGroup = () => {
    setEditingGroupId(null);
    setMembrosAoAbrir(null);
    setGroupForm(createEmptyGroup());
    setFeedback('');
    setIsGroupEditorOpen(true);
  };

  const openGroup = (group: GrupoEquipe) => {
    setEditingGroupId(group.id);
    setGroupForm(normalizeGroup(group));
    setMembrosAoAbrir(safeIds(normalizeGroup(group).funcionarioIds));
    setFeedback('');
    setIsGroupEditorOpen(true);
  };

  const saveGroup = () => {
    if (!groupForm.nome.trim() || !groupForm.responsavel.trim() || !groupForm.frenteServico.trim()) {
      setFeedback('Informe o nome da equipe, o responsável e a frente de serviço.');
      return;
    }
    if (safeIds(groupForm.funcionarioIds).length === 0) {
      setFeedback('Selecione pelo menos um colaborador para a equipe.');
      return;
    }
    const now = new Date().toISOString();
    const funcionarioIds = [...new Set(safeIds(groupForm.funcionarioIds))]
      .filter(id => safeFuncionarios.some(employee => employee.id === id && employee.ativo));
    const payload: GrupoEquipe = {
      ...normalizeGroup(groupForm),
      id: editingGroupId || `grp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      funcionarioIds,
      funcionarioMatriculas: [...new Set(funcionarioIds
        .map(id => safeText(safeFuncionarios.find(employee => employee.id === id)?.matricula))
        .filter(Boolean))],
      token: groupForm.token || generateToken(),
      createdAt: groupForm.createdAt || now,
      updatedAt: now,
    };
    onSaveGrupoEquipe(payload, !editingGroupId);
    setIsGroupEditorOpen(false);
    setFeedback('Equipe salva e disponível no controle ao vivo.');
  };

  const copyLink = async (token: string, label = 'Link') => {
    const url = presenceLink(token);
    try {
      await navigator.clipboard.writeText(url);
      setFeedback(`${label} copiado.`);
    } catch {
      setFeedback(url);
    }
  };

  const shareOnWhatsApp = (group: GrupoEquipe) => {
    const message = `Olá ${group.responsavel}, registre a presença da equipe ${group.nome}: ${presenceLink(group.token)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const exportCsv = () => {
    const csv = toCsv([
      ['Data', 'Equipe', 'Responsável', 'Frente', 'Colaborador', 'Função', 'Status', 'Observação', 'Horário'],
      ...exportRows,
    ]);
    saveBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), `presenca-${today}.csv`);
  };

  // Lê a aba "Efetivo" e monta o plano. Nada é gravado aqui.
  const lerPlanilhaEfetivo = async (file: File) => {
    setSyncBusy(true);
    setSyncError('');
    setSyncPlan(null);
    try {
      const workbook = await createCorporateWorkbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.getWorksheet('Efetivo')
        || workbook.worksheets.find(item => /efetivo/i.test(item.name));
      if (!sheet) throw new Error('A planilha não tem a aba "Efetivo".');

      // O cabeçalho não fica na primeira linha: a aba abre com um título.
      let headerRow = 0;
      let headers: string[] = [];
      for (let row = 1; row <= Math.min(sheet.rowCount, 10); row += 1) {
        const values = (sheet.getRow(row).values as unknown[]).slice(1).map(value => String(value ?? '').trim());
        if (values.some(value => /mat/i.test(value)) && values.some(value => /encarregado/i.test(value))) {
          headerRow = row;
          headers = values;
          break;
        }
      }
      if (!headerRow) throw new Error('Não encontrei o cabeçalho com "MAT. COLAB." e "NOME ENCARREGADO".');

      const rows: Array<Record<string, unknown>> = [];
      for (let row = headerRow + 1; row <= sheet.rowCount; row += 1) {
        const values = (sheet.getRow(row).values as unknown[]).slice(1);
        const registro: Record<string, unknown> = {};
        headers.forEach((header, index) => {
          if (header) registro[header] = values[index];
        });
        if (Object.values(registro).some(value => value !== undefined && value !== null && String(value).trim())) {
          rows.push(registro);
        }
      }

      const { linhas, ignoradas, matriculasNaPlanilha } = parseEfetivoRows(rows);
      if (linhas.length === 0) throw new Error('Nenhuma linha aproveitável: confira as colunas de matrícula e encarregado.');
      const plano = buildTeamSyncPlan({
        linhas,
        ignoradas,
        matriculasNaPlanilha,
        funcionarios: safeFuncionarios,
        gruposEquipe: safeGroups,
        obraId: safeObras[0]?.id || '',
        empresaId: safeEmpresas[0]?.id || '',
        criarToken: () => generateSecurePublicToken('presenca'),
      });
      setSyncFileName(file.name);
      setSyncPlan(plano);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Não foi possível ler a planilha.');
    } finally {
      setSyncBusy(false);
    }
  };

  const confirmarSincronizacao = async () => {
    if (!syncPlan || !onSyncEquipesPlanilha) return;
    setSyncBusy(true);
    setSyncError('');
    const { funcionarios: proximosFuncionarios, gruposEquipe: proximasEquipes } =
      applyTeamSyncPlan(syncPlan, safeFuncionarios, safeGroups);
    try {
      const result = await onSyncEquipesPlanilha(proximosFuncionarios, proximasEquipes, syncPlan.resumo);
      if (!result.success) {
      setSyncError(`As equipes foram salvas neste computador, mas o Supabase não foi atualizado: ${result.message}`);
        return;
      }
      setSyncPlan(null);
      setSyncFileName('');
      const desmobilizados = syncPlan.resumo.desmobilizar > 0 ? ` ${syncPlan.resumo.desmobilizar} colaborador(es) desmobilizado(s) por sair da planilha.` : '';
      setFeedback(`Equipes sincronizadas no Supabase: ${syncPlan.resumo.criar} criadas, ${syncPlan.resumo.atualizar} atualizadas, ${syncPlan.resumo.desativar} desativadas.${desmobilizados}`);
    } finally {
      setSyncBusy(false);
    }
  };

  // Zerar o dia é a saída quando o apontamento sai errado: sem apagar a
  // reserva, a equipe fica travada e não consegue reenviar pelo link.
  const zerarDia = async () => {
    if (!onResetPresencaDia || recordGroup === 'todos' || resetBusy) return;
    const equipe = safeGroups.find(group => group.id === recordGroup);
    const quantos = safeRecords.filter(item => item.grupoId === recordGroup && item.data === recordDate).length;
    setResumoZerarDia({ equipe: equipe?.nome || recordGroup, quantos });
  };

  const confirmarZerarDia = async () => {
    if (!onResetPresencaDia || recordGroup === 'todos' || resetBusy) return;
    setResumoZerarDia(null);
    setResetBusy(true);
    try {
      const resposta = await onResetPresencaDia(recordGroup, recordDate);
      setFeedback(resposta.message);
    } finally {
      setResetBusy(false);
    }
  };

  const restoreHistory = async () => {
    if (!onRestorePresenceHistory || restoringHistory) return;
    setRestoringHistory(true);
    try {
      const resposta = await onRestorePresenceHistory();
      setFeedback(resposta.message);
    } finally {
      setRestoringHistory(false);
    }
  };

  const exportExcelRecords = async (records: PresencaApontamento[], reportDate: string, reportTitle: string) => {
    const workbook = await createCorporateWorkbook();
    configureCorporateWorkbook(workbook, reportTitle);
    const sheet = workbook.addWorksheet('Presença');
    sheet.columns = [
      { header: 'Data', key: 'data', width: 14 },
      { header: 'Equipe', key: 'equipe', width: 24 },
      { header: 'Responsável', key: 'responsavel', width: 26 },
      { header: 'Frente', key: 'frente', width: 28 },
      { header: 'Colaborador', key: 'colaborador', width: 34 },
      { header: 'Função', key: 'funcao', width: 28 },
      { header: 'Status', key: 'status', width: 20 },
      { header: 'Observação', key: 'observacao', width: 36 },
      { header: 'Horário', key: 'horario', width: 12 },
    ];
    records.forEach(record => sheet.addRow([
      record.data, record.grupoNome, record.responsavel, record.frenteServico,
      record.funcionarioNome, record.funcao, record.status, record.observacao, record.horaEnvio,
    ]));
    styleCorporateWorksheet(sheet, { title: reportTitle, headerRow: 1, lastColumn: 9, recordCount: records.length });
    addCorporateSummarySheet(workbook, reportTitle, [
      ['Registros exportados', records.length],
      ['Presentes', records.filter(record => record.status === 'Presente').length],
      ['Ausentes', records.filter(record => record.status === 'Ausente').length],
      ['Data de referência', reportDate.split('-').reverse().join('/')],
    ]);
    await downloadCorporateWorkbook(workbook, `RENEA_situacao_diaria_${reportDate}.xlsx`);
  };

  const exportPdfRecords = async (records: PresencaApontamento[], reportDate: string, reportTitle: string, pendingCount: number) => generateUniversalPdfReport({
    title: reportTitle,
    subtitle: 'Efetivo recebido diretamente das equipes de campo',
    company: 'RENEA INFRAESTRUTURA · Sistema Integrado de Gestão Operacional',
    orientation: 'landscape',
    fileName: `RENEA_situacao_diaria_${reportDate}.pdf`,
    period: reportDate,
    filters: [recordGroup === 'todos' ? 'Todas as equipes' : `Equipe: ${recordGroup}`, recordStatus === 'todos' ? 'Todos os status' : `Status: ${recordStatus}`],
    summary: [
      { label: 'Registros', value: records.length },
      { label: 'Presentes', value: records.filter(record => record.status === 'Presente').length },
      { label: 'Ausentes', value: records.filter(record => record.status === 'Ausente').length },
      { label: 'Equipes pendentes', value: pendingCount },
    ],
    columns: [
      { header: 'Data', dataKey: 'data' },
      { header: 'Equipe', dataKey: 'equipe' },
      { header: 'Responsável', dataKey: 'responsavel' },
      { header: 'Frente', dataKey: 'frente' },
      { header: 'Colaborador', dataKey: 'colaborador' },
      { header: 'Função', dataKey: 'funcao' },
      { header: 'Status', dataKey: 'status' },
      { header: 'Observação', dataKey: 'observacao' },
      { header: 'Horário', dataKey: 'horario' },
    ],
    rows: records.map(record => ({
      data: record.data,
      equipe: record.grupoNome,
      responsavel: record.responsavel,
      frente: record.frenteServico,
      colaborador: record.funcionarioNome,
      funcao: record.funcao,
      status: record.status,
      observacao: record.observacao,
      horario: record.horaEnvio,
    })),
  });

  const exportEquipesExcel = () => baixarPlanilhaEquipes(safeGroups, safeFuncionarios, safeEmpresas, today);

  const exportExcel = () => exportExcelRecords(filteredRecords, recordDate || today, 'Relatório de presença');
  const exportPdf = () => exportPdfRecords(filteredRecords, recordDate || today, 'Relatório de presença', pendingGroups.length);
  const exportDailyExcel = () => exportExcelRecords(dayRecords, referenceDate, 'Relatório da situação do dia');
  const exportDailyPdf = () => exportPdfRecords(dayRecords, referenceDate, 'Relatório da situação do dia', pendingGroups.length);

  const openRecordEditor = (record: PresencaApontamento) => {
    setEditingRecord(record);
    setEditStatus(record.status);
    setEditObservation(record.observacao);
    setEditReason('');
  };

  const saveRecordEdit = () => {
    if (!editingRecord || !editReason.trim()) return;
    onUpdatePresencaLink(editingRecord.id, editStatus, editObservation, editReason.trim());
    setEditingRecord(null);
    setFeedback('Presença atualizada com histórico de auditoria.');
  };

  const deleteSelectedRecords = () => {
    if (selectedRecordIds.length === 0) return;
    setConfirmandoInativacao(true);
  };

  const confirmarInativacaoRegistros = () => {
    onInativarPresencaLink?.(selectedRecordIds);
    setFeedback(`${selectedRecordIds.length} registro(s) de presença inativado(s). Eles ficam em "Inativados" e podem voltar.`);
    setDesfazerInativacao(selectedRecordIds);
    setSelectedRecordIds([]);
    setConfirmandoInativacao(false);
  };

  const reativarRegistros = (ids: string[]) => {
    if (ids.length === 0) return;
    onReativarPresencaLink?.(ids);
    setFeedback(`${ids.length} registro(s) de presença reativado(s).`);
    setDesfazerInativacao([]);
    setSelectedRecordIds([]);
  };

  const alternarInativos = () => {
    setVerInativos(atual => !atual);
    setSelectedRecordIds([]);
  };

  const navItems: Array<{ id: View; rotulo: string; icone: React.ComponentType<{ className?: string }> }> = [
    { id: 'ao-vivo', rotulo: 'Ao vivo', icone: Radio },
    { id: 'relatorios', rotulo: 'Relatórios', icone: PieChart },
    { id: 'equipes', rotulo: 'Equipes', icone: Users },
    { id: 'registros', rotulo: 'Registros', icone: FileSpreadsheet },
    { id: 'historico', rotulo: 'Histórico', icone: History },
  ];

  // Registros e Histórico são tabelas: a área de dados fica do tamanho da tela
  // e só as linhas rolam. O resto (painel, relatório, cartões de equipe) é
  // aba longa, que rola por dentro.
  const telaDeTabela = view === 'registros' || view === 'historico' || view === 'equipes';
  const nomeDoHistorico = (item: HistoricoPresenca) => safeText(employeeById.get(item.funcionarioId)?.nome) || item.funcionarioId;
  const todosFiltradosMarcados = filteredRecords.length > 0 && filteredRecords.every(record => selectedRecordIds.includes(record.id));
  const marcados = useMemo(() => new Set(selectedRecordIds), [selectedRecordIds]);

  const equipesQueEnviaramHoje = useMemo(
    () => new Set(safeGroups.filter(group => safeRecords.some(record => record.data === today && teamRecordMatches(group, record))).map(group => group.id)),
    [safeGroups, safeRecords, today],
  );
  const colunasEquipes: ColunaTabela<GrupoEquipe>[] = [
    {
      chave: 'equipe',
      titulo: 'Equipe',
      larguraMinima: 220,
      valorOrdenacao: group => group.nome,
      dica: group => group.nome,
      render: group => {
        const ativa = group.status === 'ativo' && group.linkAtivo;
        return (
          <span className="flex flex-wrap items-center gap-2">
            <strong className="font-bold text-slate-900">{group.nome || 'Equipe sem nome'}</strong>
            <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold uppercase ${ativa ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'}`}>{ativa ? 'Ativa' : 'Inativa'}</span>
          </span>
        );
      },
    },
    {
      chave: 'responsavel',
      titulo: 'Responsável · Frente',
      larguraMinima: 180,
      valorOrdenacao: group => group.responsavel,
      dica: group => `${group.responsavel || 'Sem responsável'} · ${group.frenteServico || 'Sem frente'}`,
      render: group => `${group.responsavel || 'Sem responsável'} · ${group.frenteServico || 'Sem frente'}`,
    },
    {
      chave: 'colaboradores',
      titulo: 'Pessoas',
      alinhamento: 'direita',
      valorOrdenacao: group => group.funcionarioIds.filter(id => employeeById.has(id)).length,
      render: group => group.funcionarioIds.filter(id => employeeById.has(id)).length,
    },
    {
      chave: 'hoje',
      titulo: 'Hoje',
      valorOrdenacao: group => (equipesQueEnviaramHoje.has(group.id) ? 1 : 0),
      render: group => (equipesQueEnviaramHoje.has(group.id)
        ? <span className="font-bold text-emerald-800">Enviada</span>
        : <span className="font-bold text-amber-800">Pendente</span>),
    },
  ];

  const colunasRegistros: ColunaTabela<PresencaApontamento>[] = [
    {
      chave: 'data',
      titulo: 'Data',
      larguraMinima: 120,
      valorOrdenacao: record => `${record.data} ${record.horaEnvio}`,
      dica: record => `${dataBr(record.data)} ${record.horaEnvio || ''}`.trim(),
      render: record => (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="tabular-nums"><strong className="font-bold text-slate-900">{dataBr(record.data)}</strong> {record.horaEnvio || '--:--'}</span>
          {duplicateKeys.has(duplicateKey(record)) && <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-1.5 py-0.5 text-xs font-bold text-rose-800"><AlertTriangle className="h-3 w-3" aria-hidden="true" /> Duplicado</span>}
        </span>
      ),
    },
    {
      chave: 'colaborador',
      titulo: 'Colaborador',
      larguraMinima: 200,
      valorOrdenacao: record => record.funcionarioNome,
      dica: record => [record.funcionarioNome, record.funcao].filter(Boolean).join(' · '),
      render: record => (
        <>
          <span className="font-bold text-slate-900">{record.funcionarioNome || 'Colaborador não informado'}</span>
          <span className="text-[#5b6870]"> · {record.funcao || 'Função não informada'}</span>
        </>
      ),
    },
    {
      chave: 'equipe',
      titulo: 'Equipe',
      larguraMinima: 180,
      valorOrdenacao: record => record.grupoNome,
      dica: record => [record.grupoNome, record.responsavel, record.frenteServico].filter(Boolean).join(' · '),
      render: record => (
        <>
          <span className="font-semibold text-slate-900">{record.grupoNome || 'Equipe não informada'}</span>
          {(record.responsavel || record.frenteServico) && <span className="text-[#5b6870]"> · {[record.responsavel, record.frenteServico].filter(Boolean).join(' · ')}</span>}
        </>
      ),
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      larguraMinima: 130,
      valorOrdenacao: record => record.status,
      dica: record => record.status,
      render: record => <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-bold ${STATUS_STYLES[record.status] || STATUS_STYLES.Outro}`}>{record.status}</span>,
    },
    {
      chave: 'observacao',
      titulo: 'Observação',
      larguraMinima: 160,
      render: record => record.observacao || '—',
      dica: record => record.observacao || undefined,
    },
  ];

  const colunasHistorico: ColunaTabela<HistoricoPresenca>[] = [
    { chave: 'data', titulo: 'Dia', larguraMinima: 100, valorOrdenacao: item => item.data, render: item => <span className="tabular-nums">{item.data.includes('-') ? dataBr(item.data) : item.data}</span> },
    { chave: 'colaborador', titulo: 'Colaborador', larguraMinima: 180, valorOrdenacao: item => nomeDoHistorico(item), render: item => <span className="font-bold text-slate-900">{nomeDoHistorico(item)}</span> },
    {
      chave: 'alteracao',
      titulo: 'Alteração',
      larguraMinima: 200,
      dica: item => `${item.valorAnterior} → ${item.valorNovo}`,
      render: item => (
        <span><span className="text-rose-700">{item.valorAnterior}</span> <ArrowRight className="mx-0.5 inline h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">para</span> <span className="font-bold text-emerald-800">{item.valorNovo}</span></span>
      ),
    },
    { chave: 'motivo', titulo: 'Motivo', larguraMinima: 180, render: item => item.motivo || '—', dica: item => item.motivo || undefined },
    { chave: 'editadoPor', titulo: 'Quem alterou', larguraMinima: 140, valorOrdenacao: item => item.editadoPor, render: item => item.editadoPor || '—' },
    { chave: 'editadoEm', titulo: 'Quando', larguraMinima: 140, valorOrdenacao: item => item.editadoEm, render: item => <span className="tabular-nums">{quandoBr(item.editadoEm)}</span> },
  ];

  const aviso = feedback ? (
    <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
      <span className="min-w-0 flex-1">{feedback}</span>
      {desfazerInativacao.length > 0 && <button type="button" onClick={() => reativarRegistros(desfazerInativacao)} className={`${SECONDARY_BUTTON} shrink-0`} data-testid="presenca-desfazer"><Undo2 className="h-4 w-4" aria-hidden="true" />Desfazer</button>}
      <button type="button" onClick={() => { setFeedback(''); setDesfazerInativacao([]); }} aria-label="Fechar mensagem" className={`grid size-11 shrink-0 place-items-center rounded-lg hover:bg-emerald-100 lg:size-9 ${FOCO}`}><X className="h-4 w-4" aria-hidden="true" /></button>
    </div>
  ) : null;

  const faixaPainel = (
    <section className={PANEL} aria-label="Recorte do painel">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => setFiltrosAbertos(atual => !atual)}
          aria-expanded={filtrosAbertos}
          aria-controls="presenca-filtros"
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 transition hover:border-emerald-700 ${FOCO}`}
        >
          <Filter className="h-4 w-4 text-emerald-800" aria-hidden="true" />
          Filtros
          {filtrosAtivos > 0 && (
            <span className="rounded-full bg-emerald-700 px-1.5 text-xs font-black text-white">{filtrosAtivos}</span>
          )}
          <ChevronDown className={`h-4 w-4 transition-transform ${filtrosAbertos ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>

        {view === 'relatorios' ? (
          <span className="inline-flex min-h-11 items-center rounded-lg px-1 text-xs font-semibold text-[#5b6870]">
            Os filtros valem para o relatório inteiro
          </span>
        ) : (
          <>
            <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5b6870]">Exibindo</span>
              <strong className="text-sm font-black text-emerald-800">{dashboardRecords.length} pessoas</strong>
            </span>

            <span className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-900">
              {dataBr(referenceDate)}
            </span>
          </>
        )}

        {filtrosAtivos > 0 && (
          <button
            type="button"
            onClick={limparFiltrosPainel}
            className={`ml-auto inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-black uppercase tracking-wider text-[#5b6870] hover:text-emerald-800 ${FOCO}`}
          >
            Limpar
          </button>
        )}
      </div>

      {filtrosAbertos && (
        <div id="presenca-filtros" className="grid gap-2 border-t border-slate-200 p-3 sm:grid-cols-2 xl:grid-cols-4">
          {view !== 'relatorios' && <label><span className="sr-only">Data de referência</span><input type="date" value={referenceDate} onChange={event => setReferenceDate(event.target.value)} max={today} className={FIELD} /></label>}
          <label><span className="sr-only">Empresa</span><select value={dashboardCompany} onChange={event => setDashboardCompany(event.target.value)} className={FIELD}><option value="todas">Todas as empresas</option>{safeEmpresas.map(company => <option key={company.id} value={company.id}>{company.nome}</option>)}</select></label>
          <label><span className="sr-only">Equipe</span><select value={dashboardGroup} onChange={event => setDashboardGroup(event.target.value)} className={FIELD}><option value="todos">Todas as equipes</option>{activeGroups.map(group => <option key={group.id} value={group.id}>{group.nome}</option>)}</select></label>
          <label><span className="sr-only">Função</span><select value={dashboardRole} onChange={event => setDashboardRole(event.target.value)} className={FIELD}><option value="todas">Todas as funções</option>{roleOptions.map(role => <option key={role}>{role}</option>)}</select></label>
          <label><span className="sr-only">Situação</span><select value={dashboardStatus} onChange={event => setDashboardStatus(event.target.value as 'todos' | PresencaStatus)} className={FIELD}><option value="todos">Todos os status</option>{STATUS_OPTIONS.map(status => <option key={status}>{status}</option>)}</select></label>
          <label><span className="sr-only">Ramo</span><select value={dashboardBranch} onChange={event => setDashboardBranch(event.target.value)} className={FIELD}><option value="todos">Todos os ramos</option>{ACTIVE_BRANCHES.map(branch => <option key={branch}>{branch}</option>)}</select></label>
          <label><span className="sr-only">Canteiro</span><select value={dashboardSite} onChange={event => setDashboardSite(event.target.value)} className={FIELD}><option value="todos">Todos os canteiros</option>{canteiros.map(site => <option key={site}>{site}</option>)}</select></label>
          <label><span className="sr-only">Buscar pessoa</span><input type="search" value={dashboardSearch} onChange={event => setDashboardSearch(event.target.value)} placeholder="Nome ou matrícula" className={FIELD} /></label>
        </div>
      )}
    </section>
  );

  const faixaEquipes = (
    <div className={`${PANEL} flex flex-col gap-2 p-3 sm:flex-row sm:flex-wrap sm:items-center`}>
      <label className="relative min-w-0 flex-1 sm:min-w-64">
        <span className="sr-only">Buscar equipe</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5b6870]" aria-hidden="true" />
        <input type="search" value={teamSearch} onChange={event => setTeamSearch(event.target.value)} placeholder="Buscar equipe, responsável ou frente" className={`${FIELD} pl-10`} />
      </label>
      {onSyncEquipesPlanilha && (
        <label className={`${SECONDARY_BUTTON} cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-(--renea-focus)`}>
          {syncBusy ? <RotateCcw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}
          {syncBusy ? 'Lendo planilha' : 'Sincronizar pela planilha'}
          <input
            type="file"
            accept=".xlsx,.xlsm"
            className="sr-only"
            disabled={syncBusy}
            onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void lerPlanilhaEfetivo(file);
            }}
          />
        </label>
      )}
      <button type="button" onClick={() => void exportEquipesExcel()} className={SECONDARY_BUTTON} title="Baixa um Excel com cada pessoa e a sua equipe"><Download className="h-4 w-4" aria-hidden="true" /> Exportar equipes</button>
      {syncError && (
        <div role="alert" className="w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{syncError}</div>
      )}
    </div>
  );

  const faixaRegistros = (
    <div className={`${PANEL} space-y-3 p-3`}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[170px_minmax(0,220px)_minmax(0,200px)_minmax(0,1fr)]">
        <label className="space-y-1">
          <span className={ROTULO_CAMPO}>Dia</span>
          <input type="date" value={recordDate} onChange={event => setRecordDate(event.target.value)} className={FIELD} aria-describedby="presenca-dia-dica" />
        </label>
        <label className="space-y-1">
          <span className={ROTULO_CAMPO}>Equipe</span>
          <select value={recordGroup} onChange={event => setRecordGroup(event.target.value)} className={FIELD}><option value="todos">Todas as equipes</option>{safeGroups.map(group => <option key={group.id} value={group.id}>{group.nome}</option>)}</select>
        </label>
        <label className="space-y-1">
          <span className={ROTULO_CAMPO}>Situação</span>
          <select value={recordStatus} onChange={event => setRecordStatus(event.target.value as 'todos' | PresencaStatus)} className={FIELD}><option value="todos">Todos os status</option>{STATUS_OPTIONS.map(status => <option key={status}>{status}</option>)}</select>
        </label>
        <label className="relative space-y-1">
          <span className={ROTULO_CAMPO}>Buscar</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5b6870]" aria-hidden="true" />
            <input type="search" value={recordSearch} onChange={event => setRecordSearch(event.target.value)} placeholder="Colaborador, função ou responsável" className={`${FIELD} pl-10`} />
          </span>
        </label>
      </div>
      <p id="presenca-dia-dica" className="sr-only">Apague o dia para ver todos os dias.</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setSelectedRecordIds(todosFiltradosMarcados ? [] : filteredRecords.map(record => record.id))} disabled={filteredRecords.length === 0} className={SECONDARY_BUTTON} aria-pressed={todosFiltradosMarcados} data-testid="presenca-marcar-filtrados">
          <Check className="h-4 w-4" aria-hidden="true" />
          {todosFiltradosMarcados ? 'Desmarcar todos' : `Marcar os ${filteredRecords.length}`}
        </button>
        {selectedRecordIds.length > 0 && (verInativos
          ? <button type="button" onClick={() => reativarRegistros(selectedRecordIds)} className={PRIMARY_BUTTON} data-testid="presenca-reativar"><RotateCcw className="h-4 w-4" aria-hidden="true" /> Reativar ({selectedRecordIds.length})</button>
          : <button type="button" onClick={deleteSelectedRecords} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 text-sm font-bold text-white transition hover:bg-rose-800 ${FOCO}`} data-testid="presenca-inativar"><Archive className="h-4 w-4" aria-hidden="true" /> Inativar ({selectedRecordIds.length})</button>)}
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          {(verInativos || inativos.length > 0) && <button type="button" onClick={alternarInativos} aria-pressed={verInativos} className={SECONDARY_BUTTON} data-testid="presenca-ver-inativos">{verInativos ? <><ChevronLeft className="h-4 w-4" aria-hidden="true" />Voltar aos ativos</> : <><Archive className="h-4 w-4" aria-hidden="true" />Inativados ({inativos.length})</>}</button>}
          {onRestorePresenceHistory && <button type="button" onClick={() => void restoreHistory()} disabled={restoringHistory} className={`${SECONDARY_BUTTON} disabled:cursor-not-allowed disabled:opacity-60`} title="Busca de novo todos os envios já feitos pelo link público e traz de volta dias que sumiram, sem apagar nada"><RotateCcw className={`h-4 w-4 ${restoringHistory ? 'animate-spin' : ''}`} aria-hidden="true" />{restoringHistory ? 'Recuperando...' : 'Recuperar histórico'}</button>}
          {onResetPresencaDia && (
            <button
              type="button"
              onClick={() => void zerarDia()}
              disabled={recordGroup === 'todos' || resetBusy}
              title={recordGroup === 'todos' ? 'Escolha uma equipe para zerar o dia' : 'Apaga o apontamento do dia e libera novo envio pelo link'}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-bold text-rose-800 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-45 ${FOCO}`}
            >
              <RotateCcw className={`h-4 w-4 ${resetBusy ? 'animate-spin' : ''}`} aria-hidden="true" />
              Zerar o dia
            </button>
          )}
          <button type="button" onClick={() => void exportPdf()} className={SECONDARY_BUTTON}><FileText className="h-4 w-4" aria-hidden="true" /> PDF</button>
          <button type="button" onClick={exportCsv} className={SECONDARY_BUTTON}><Download className="h-4 w-4" aria-hidden="true" /> CSV</button>
        </div>
      </div>
      {verInativos && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900" data-testid="presenca-aviso-inativos">Mostrando os registros inativados. Marque os que devem voltar e toque em Reativar.</p>}
    </div>
  );

  const faixaDaVista = view === 'ao-vivo' || view === 'relatorios' ? faixaPainel
    : view === 'equipes' ? faixaEquipes
      : view === 'registros' ? faixaRegistros
        : null;

  const acaoPrincipal = view === 'equipes'
    ? <button type="button" onClick={openNewGroup} className={PRIMARY_BUTTON}><Plus className="h-4 w-4" aria-hidden="true" /> Nova equipe</button>
    : view === 'registros'
      ? <button type="button" onClick={() => void exportExcel()} className={PRIMARY_BUTTON} disabled={filteredRecords.length === 0}><FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> Baixar Excel</button>
      : undefined;

  return (
    <TelaCheia ref={tabRef} id="presenca-tab" rotulo="Presença" className="text-slate-900"
      longa={!telaDeTabela} idAbaAtiva={idDaAba('presenca', view)} idDados="presenca-dados" chaveRolagem={view}
      cabecalho={<PageHeader
        eyebrow="Pessoas"
        title="Presença"
        abas={<AbasDaTela<View> id="presenca" rotulo="Seções do controle de presença" abas={navItems} ativa={view} onTrocar={setView} idPainel="presenca-dados" testId="presenca-aba" />}
        actions={acaoPrincipal}
      />}
      faixa={aviso || faixaDaVista ? <>{aviso}{faixaDaVista && <div className={aviso ? 'mt-2' : undefined}>{faixaDaVista}</div>}</> : undefined}
    >

      {view === 'ao-vivo' && pendingPublicSubmissionsCount > 0 && (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {pendingPublicSubmissionsCount === 1
              ? '1 envio do link público já chegou e está sendo processado agora.'
              : `${pendingPublicSubmissionsCount} envios do link público já chegaram e estão sendo processados agora.`}
            {' '}Se o número acima não crescer em alguns segundos, atualize a página.
          </span>
        </div>
      )}

      {/* Só a faixa de topo tem coluna lateral. Antes o grid de duas colunas
          envolvia a tela inteira: tudo que foi entrando ficou espremido em dois
          terços da largura e a direita virava um vazio de mil pixels. */}
      {view === 'ao-vivo' && (
        <div ref={liveViewRef} className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
            {/* Os 4 cards de estatística entram aqui, embaixo do efetivo, em vez
                de numa faixa própria abaixo das duas colunas: "Atenção agora"
                é naturalmente mais alto (lista de equipes pendentes), e sem
                esse preenchimento sobrava uma faixa em branco do lado esquerdo. */}
            <div className="space-y-5">
              <article data-cartao-painel className={`renea-card ${PANEL} relative overflow-hidden p-4 transition-shadow duration-200 hover:shadow-[0_12px_28px_-16px_rgba(16,24,32,0.25)] sm:p-5`}>
                <div data-seta-efetivo className="absolute right-5 top-5 text-emerald-800/20"><ArrowRight className="h-12 w-12" strokeWidth={1} /></div>
                <div className="relative">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Efetivo confirmado</p>
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-800"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-700" />{metrics.latest ? `Atualizado às ${metrics.latest}` : 'Aguardando o primeiro envio'}</span>
                  </div>
                  <div className="mt-4 flex items-end gap-3">
                    <strong data-count={metrics.present} className="text-4xl font-black tabular-nums tracking-[-0.045em] text-slate-900 sm:text-5xl">0</strong>
                    <div className="pb-1"><p className="text-base font-bold text-emerald-800">presentes</p><p className="text-xs text-slate-500">{metrics.planned ? `de ${metrics.planned} previstos` : 'sem efetivo previsto vinculado às equipes'}</p></div>
                  </div>
                  {/* Sem efetivo previsto não existe percentual: mostrar "0% confirmado"
                      ao lado de 32 presentes faz o painel parecer quebrado. */}
                  {metrics.planned > 0 ? (
                    <>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"><div data-barra-efetivo className="h-full origin-left rounded-full bg-[#176b4d]" style={{ width: `${metrics.percent}%` }} /></div>
                      <p className="mt-2 text-right text-xs font-bold tabular-nums text-slate-500">{metrics.percent}% confirmado</p>
                    </>
                  ) : (
                    <p className="mt-4 text-xs text-slate-500">Vincule os colaboradores às equipes em <strong className="font-bold text-slate-700">Equipes</strong> para acompanhar o percentual confirmado.</p>
                  )}
                </div>
              </article>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Ausentes', metrics.absent, 'text-rose-700'],
                  ['Justificados', metrics.justified, 'text-amber-700'],
                  ['Equipes pendentes', metrics.pending, 'text-slate-900'],
                  ['Equipes ativas', activeGroups.length, 'text-emerald-800'],
                ].map(([label, value, tone]) => (
                  <article key={String(label)} className={`${PANEL} p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-16px_rgba(16,24,32,0.3)] sm:p-5`}>
                    <strong data-count={value} className={`block text-3xl font-black tabular-nums ${tone}`}>0</strong>
                    <span className="mt-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500 sm:text-xs">{label}</span>
                  </article>
                ))}
              </div>
            </div>
            <div className="space-y-5">
            <article data-cartao-painel className={`renea-card ${PANEL} p-5`}>
              <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-700" /><h2 className="text-lg font-black text-slate-900">Atenção agora</h2></div>
              <div className="mt-4 space-y-2">
                {pendingGroups.length === 0 && metrics.absent === 0 ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">Todas as equipes enviaram e não há ausências abertas.</p> : null}
                {/* A equipe que não usou o link precisa de saída aqui mesmo: é
                    neste cartão que alguém descobre que falta apontamento. */}
                {pendingGroups.slice(0, 5).map(group => (
                  <div key={group.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <span><strong>{group.nome}</strong> ainda não enviou a presença.</span>
                    {onLancarPresencaManual && (
                      <button
                        type="button"
                        onClick={() => abrirLancamento(group.id)}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 text-xs font-bold text-amber-900 transition hover:border-emerald-700 hover:text-emerald-800"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Lançar presença
                      </button>
                    )}
                  </div>
                ))}
                {metrics.absent > 0 && <button type="button" onClick={() => { setRecordStatus('Ausente'); setView('registros'); }} className="flex w-full items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-left text-sm font-semibold text-rose-900"><span>{metrics.absent} ausência(s) aguardando conferência</span><ChevronRight className="h-4 w-4" /></button>}
              </div>
            </article>
            </div>
          </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <article data-cartao-painel className={`renea-card ${PANEL} flex flex-col p-5 md:col-span-2`}>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Confirmados nos últimos 7 dias</p>
                <div className="mt-5 flex min-h-28 flex-1 items-end gap-2">
                  {tendencia.map(item => (
                    <button type="button" key={item.iso} onClick={() => setReferenceDate(item.iso)} className="group flex h-full flex-1 flex-col items-center gap-1" title={`Ver ${item.presentes} presente(s) em ${item.rotulo}`}>
                      <span className="text-xs font-bold tabular-nums text-slate-500">{item.presentes || ''}</span>
                      <div className="flex w-full flex-1 items-end">
                        <div
                          data-trend-bar
                          data-pct={Math.max(3, (item.presentes / picoTendencia) * 100)}
                          className={`w-full cursor-pointer rounded-t-md transition-colors duration-200 ${item.iso === referenceDate ? 'bg-[#176b4d]' : 'bg-emerald-200 group-hover:bg-emerald-300'}`}
                        />
                      </div>
                      <span className="text-xs font-bold tabular-nums text-slate-500">{item.rotulo}</span>
                    </button>
                  ))}
                </div>
              </article>

              <article data-cartao-painel className={`renea-card ${PANEL} p-5`}>
                <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Efetivo por função</p><span className="text-xs font-black text-emerald-800">{referenceDate.split('-').reverse().join('/')}</span></div>
                {funcoesDoDia.length === 0 ? <p className="mt-6 text-sm text-slate-500">Nenhuma função registrada neste recorte.</p> : (
                  <div className="mt-4 space-y-3">
                    {funcoesDoDia.slice(0, 7).map(item => <button type="button" key={item.funcao} onClick={() => setDashboardRole(item.funcao)} className="group block w-full text-left" aria-label={`Filtrar ${item.funcao}: ${item.total}`}>
                      <div className="flex items-center justify-between gap-3 text-xs"><span className="truncate font-bold text-slate-700 group-hover:text-emerald-800">{item.funcao}</span><strong className="tabular-nums text-slate-900">{item.total}</strong></div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><span data-dist-bar data-pct={(item.total / picoFuncoes) * 100} className="block h-full rounded-full bg-emerald-500" /></div>
                    </button>)}
                  </div>
                )}
              </article>

              <article data-cartao-painel className={`renea-card ${PANEL} p-5`}>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Situações registradas no dia</p>
                {distribuicao.length === 0 ? (
                  <p className="mt-6 text-sm text-slate-500">Nenhum envio recebido para {referenceDate.split('-').reverse().join('/')}.</p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {distribuicao.map(item => (
                      <li key={item.status}><button type="button" onClick={() => setDashboardStatus(item.status)} className="group block w-full text-left">
                        <div className="flex items-center justify-between gap-3 text-xs font-bold">
                          <span className="flex items-center gap-1.5 text-slate-700 group-hover:text-emerald-800">
                            {item.status}
                            {AFASTAMENTOS_PREVISTOS.includes(item.status) && (
                              <span className="rounded-full border border-stone-300 bg-stone-100 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-stone-600">
                                Afastamento previsto
                              </span>
                            )}
                          </span>
                          <span className="tabular-nums text-slate-500">{item.total}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div data-dist-bar data-pct={(item.total / Math.max(1, dashboardRecords.length)) * 100} className="h-full rounded-full bg-[#176b4d]" />
                        </div>
                      </button></li>
                    ))}
                  </ul>
                )}
              </article>

              <article data-cartao-painel className={`renea-card ${PANEL} p-5 md:col-span-2`}>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Efetivo por equipe</p>
                {equipesDoDia.length === 0 ? <p className="mt-6 text-sm text-slate-500">Nenhuma equipe com envio neste recorte.</p> : (
                  <div className="mt-4 space-y-3">
                    {equipesDoDia.slice(0, 7).map(item => (
                      <button type="button" key={item.nome} onClick={() => setDashboardGroup(item.id || 'todos')} className="group block w-full text-left" aria-label={`Filtrar ${item.nome}: ${item.total} pessoa(s)`}>
                        <div className="flex items-center justify-between gap-3 text-xs"><span className="truncate font-bold text-slate-700 group-hover:text-emerald-800">{item.nome}</span><strong className="tabular-nums text-slate-900">{item.total}</strong></div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><span data-dist-bar data-pct={(item.total / picoEquipes) * 100} className="block h-full rounded-full bg-[#176b4d]" /></div>
                      </button>
                    ))}
                  </div>
                )}
              </article>

            </div>


            {ausentesDoDia.length > 0 && (
              <article data-cartao-painel className={`renea-card ${PANEL} overflow-hidden`}>
                <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-rose-700">Conferência</p>
                    <h2 className="mt-1 text-lg font-black tracking-tight text-slate-900">Quem não está em campo hoje</h2>
                  </div>
                  <span className="text-sm font-black tabular-nums text-rose-700">{ausentesDoDia.length}</span>
                </header>
                <ul className="divide-y divide-slate-200">
                  {ausentesDoDia.slice(0, 8).map(record => (
                    <li key={record.id} className="flex items-center gap-3 px-5 py-3">
                      <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${STATUS_STYLES[record.status] || STATUS_STYLES.Outro}`}>{record.status}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">{record.funcionarioNome}</p>
                        <p className="truncate text-xs text-slate-500">{record.grupoNome} · {record.observacao || 'Sem observação'}</p>
                      </div>
                      <button type="button" onClick={() => openRecordEditor(record)} className="shrink-0 text-xs font-bold text-emerald-800 hover:underline">Revisar</button>
                    </li>
                  ))}
                </ul>
                {ausentesDoDia.length > 8 && (
                  <button type="button" onClick={() => { setRecordStatus('Ausente'); setRecordDate(referenceDate); setView('registros'); }} className="w-full border-t border-slate-200 px-5 py-3 text-xs font-bold text-emerald-800 hover:bg-slate-50">
                    Ver todos os {ausentesDoDia.length} registros
                  </button>
                )}
              </article>
            )}

            <article data-cartao-painel className={`renea-card ${PANEL} overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-800">Equipes</p><h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">Situação do dia</h2></div>
                <div className="flex flex-wrap items-center gap-2">
                  <input type="date" value={referenceDate} onChange={event => setReferenceDate(event.target.value)} max={today} className={`${FIELD} w-auto`} aria-label="Data do relatório diário" />
                  <button type="button" onClick={() => void exportDailyExcel()} className={PRIMARY_BUTTON} disabled={dayRecords.length === 0} title="Baixar situação do dia em Excel"><FileSpreadsheet className="h-4 w-4" /> Excel</button>
                  <button type="button" onClick={() => void exportDailyPdf()} className={SECONDARY_BUTTON} disabled={dayRecords.length === 0} title="Imprimir situação do dia em PDF"><FileText className="h-4 w-4" /> PDF</button>
                  <button type="button" onClick={() => setView('equipes')} className="inline-flex items-center gap-1 px-2 text-sm font-bold text-emerald-800 hover:text-emerald-950">Gerenciar <ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="divide-y divide-slate-200">
                {teamRows.length === 0 ? (
                  <div className="px-5 py-12 text-center text-sm text-slate-500">Nenhuma equipe ativa cadastrada.</div>
                ) : teamRows.map(row => (
                  <div key={row.group.id} className="flex items-center gap-4 px-5 py-4">
                    <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${row.sent ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {row.sent ? <Check className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{row.group.nome}</p><p className="mt-0.5 truncate text-xs text-slate-500">{row.group.responsavel} · {row.group.frenteServico}</p></div>
                    <div className="text-right"><p className="text-lg font-black tabular-nums text-slate-900">{row.present}/{row.total}</p><p className={`text-xs font-bold uppercase tracking-[0.1em] ${row.sent ? 'text-emerald-800' : 'text-amber-800'}`}>{row.sent ? row.updatedAt || 'Recebido' : 'Pendente'}</p></div>
                  </div>
                ))}
              </div>
            </article>

            {/* Painel interativo: cada linha é um filtro. Clicar numa frente ou
                numa empresa recorta o painel inteiro por ela; clicar de novo
                desfaz. O número deixa de ser só leitura e vira o caminho. */}
            <div className="grid gap-5 xl:grid-cols-2">
              <article data-cartao-painel className={`renea-card ${PANEL} overflow-hidden`}>
                <div className="border-b border-slate-200 px-5 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-800">Frentes de serviço</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">Onde falta gente</h2>
                  <p className="mt-1 text-xs text-slate-500">Da maior falta para a menor. Toque numa frente para recortar o painel por ela.</p>
                </div>
                <ul className="divide-y divide-slate-200">
                  {efetivoDasFrentes.length === 0 && (
                    <li className="px-5 py-10 text-center text-sm text-slate-500">Nenhum apontamento no recorte.</li>
                  )}
                  {efetivoDasFrentes.slice(0, 8).map(linha => {
                    const ativo = dashboardBranch === linha.chave;
                    const falta = Math.max(0, linha.previstos - linha.confirmados);
                    return (
                      <li key={linha.chave}>
                        <button
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => setDashboardBranch(ativo ? 'todos' : linha.chave)}
                          className={`flex w-full items-center gap-3 px-5 py-3 text-left transition ${ativo ? 'bg-emerald-50' : 'hover:bg-[#f7f8f6]'}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-slate-900">{linha.rotulo}</p>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-[#176b4d]"
                                style={{ width: `${Math.min(100, linha.percentual ?? 0)}%` }}
                              />
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-base font-black tabular-nums text-slate-900">
                              {linha.confirmados}{linha.previstos > 0 ? <span className="text-xs font-bold text-slate-500">/{linha.previstos}</span> : null}
                            </p>
                            <p className={`text-xs font-bold ${falta > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
                              {falta > 0 ? `faltam ${falta}` : 'completa'}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </article>

              <article data-cartao-painel className={`renea-card ${PANEL} overflow-hidden`}>
                <div className="border-b border-slate-200 px-5 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-800">Empresas</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">Quem entregou efetivo</h2>
                  <p className="mt-1 text-xs text-slate-500">Toque numa empresa para ver só o efetivo dela.</p>
                </div>
                <ul className="divide-y divide-slate-200">
                  {efetivoDasEmpresas.length === 0 && (
                    <li className="px-5 py-10 text-center text-sm text-slate-500">Nenhum apontamento no recorte.</li>
                  )}
                  {efetivoDasEmpresas.map(linha => {
                    const ativo = dashboardCompany === linha.chave;
                    return (
                      <li key={linha.chave}>
                        <button
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => setDashboardCompany(ativo ? 'todas' : linha.chave)}
                          className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition ${ativo ? 'bg-emerald-50' : 'hover:bg-[#f7f8f6]'}`}
                        >
                          <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{linha.rotulo}</p>
                          <div className="shrink-0 text-right">
                            <p className="text-base font-black tabular-nums text-slate-900">{linha.confirmados}</p>
                            {linha.ausentes > 0 && <p className="text-xs font-bold text-rose-700">{linha.ausentes} ausente(s)</p>}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </article>
            </div>

            <article data-cartao-painel className={`renea-card ${PANEL} overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-800">Últimos 30 dias</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">Quem falta sempre</h2>
                  <p className="mt-1 text-xs text-slate-500">O painel mostra o dia; o problema aparece no mês. Toque no nome para ver os registros da pessoa.</p>
                </div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  <span className="sr-only">Mínimo de faltas</span>
                  <select
                    value={minimoFaltas}
                    onChange={event => setMinimoFaltas(Number(event.target.value))}
                    className={`${FIELD} w-auto`}
                  >
                    {[2, 3, 5, 8].map(quantidade => (
                      <option key={quantidade} value={quantidade}>{quantidade}+ faltas</option>
                    ))}
                  </select>
                </label>
              </div>
              <ul className="divide-y divide-slate-200">
                {reincidentes.length === 0 && (
                  <li className="px-5 py-10 text-center text-sm text-slate-500">
                    Ninguém com {minimoFaltas} faltas ou mais nos últimos 30 dias.
                  </li>
                )}
                {reincidentes.slice(0, 10).map(pessoa => (
                  <li key={pessoa.funcionarioId}>
                    <button
                      type="button"
                      onClick={() => { setDashboardSearch(pessoa.nome); setRecordSearch(pessoa.nome); setView('registros'); }}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-[#f7f8f6]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">{pessoa.nome}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{pessoa.funcao} · {pessoa.equipe}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {pessoa.datas.slice(0, 6).map(data => data.slice(8, 10) + '/' + data.slice(5, 7)).join(' · ')}
                          {pessoa.datas.length > 6 ? ` · +${pessoa.datas.length - 6}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-black tabular-nums text-rose-700">{pessoa.faltas}</p>
                        <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">faltas</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </article>
        </div>
      )}

      {view === 'relatorios' && (
        <RelatoriosPresenca
          registros={relatorioRegistros}
          funcionarios={safeFuncionarios}
          empresas={safeEmpresas}
          filtrosDescritos={filtrosDescritos}
          onVerPessoa={nome => { setRecordSearch(nome); setRecordDate(''); setRecordStatus('todos'); setRecordGroup('todos'); setView('registros'); }}
        />
      )}

      {view === 'equipes' && (
        <TabelaPadrao
          titulo="Equipes de presença"
          linhas={filteredGroups}
          colunas={colunasEquipes}
          idDaLinha={group => group.id}
          nomeDoItem={{ um: 'equipe', varios: 'equipes' }}
          ordenacaoInicial={{ chave: 'equipe', direcao: 'asc' }}
          vazio={teamSearch.trim() ? 'Nenhuma equipe com esse nome.' : 'Nenhuma equipe cadastrada. Toque em Nova equipe para começar.'}
          tituloAcoes="Ações"
          acoes={group => (
            <span className="flex flex-wrap items-center gap-2 md:flex-nowrap md:gap-1.5">
              <button type="button" onClick={() => openGroup(group)} className={`${SECONDARY_BUTTON} min-h-11 px-2.5 md:min-h-8 md:px-2`} aria-label={`Editar ${group.nome}`}><Edit3 className="h-4 w-4" aria-hidden="true" /> Editar</button>
              {group.token && <button type="button" onClick={() => copyLink(group.token, `Link de ${group.nome}`)} className={`${SECONDARY_BUTTON} min-h-11 px-2.5 md:min-h-8 md:px-2`} aria-label={`Copiar link de ${group.nome}`}><ClipboardCopy className="h-4 w-4" aria-hidden="true" /> Copiar<span className="md:sr-only"> link</span></button>}
              {group.token && <button type="button" onClick={() => shareOnWhatsApp(group)} className={`${PRIMARY_BUTTON} min-h-11 px-2.5 md:min-h-8 md:px-2`} aria-label={`Enviar link de ${group.nome} no WhatsApp`}><MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp</button>}
              <button type="button" onClick={() => openGroup({ ...group, token: generateToken() })} className={`${SECONDARY_BUTTON} min-h-11 px-2.5 md:min-h-8 md:px-2`} aria-label={`Renovar link de ${group.nome}`} title="Renovar link"><RotateCcw className="h-4 w-4" aria-hidden="true" /><span className="md:sr-only"> Renovar link</span></button>
              {onDeleteGrupoEquipe && <button type="button" onClick={() => setEquipeExcluindo(group)} className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-rose-700 hover:text-rose-900 md:min-h-8 ${FOCO}`} aria-label={`Excluir ${group.nome}`} title="Excluir equipe"><Trash2 className="h-4 w-4" aria-hidden="true" /><span className="md:sr-only"> Excluir</span></button>}
            </span>
          )}
          className="flex-1"
          testId="presenca-equipes"
        />
      )}

      {view === 'registros' && (
        <TabelaPadrao
          titulo={verInativos ? 'Registros de presença inativados' : 'Registros de presença'}
          linhas={filteredRecords}
          colunas={colunasRegistros}
          idDaLinha={record => record.id || `${duplicateKey(record)}-${record.horaEnvio}`}
          nomeDoItem={{ um: 'registro', varios: 'registros' }}
          vazio="Nenhum registro encontrado para os filtros escolhidos."
          selecao={{
            marcados,
            onAlternar: id => setSelectedRecordIds(atual => (atual.includes(id) ? atual.filter(item => item !== id) : [...atual, id])),
            onAlternarVarios: (ids, marcar) => setSelectedRecordIds(atual => (marcar ? [...new Set([...atual, ...ids])] : atual.filter(id => !ids.includes(id)))),
            rotulo: record => `Marcar presença de ${record.funcionarioNome || 'colaborador'} em ${dataBr(record.data)}`,
          }}
          tituloAcoes="Corrigir"
          acoes={record => (
            <button type="button" onClick={() => openRecordEditor(record)} className={`${SECONDARY_BUTTON} min-h-11 px-3 md:min-h-8`} aria-label={`Corrigir presença de ${record.funcionarioNome || 'colaborador'}`}>
              <Edit3 className="h-4 w-4" aria-hidden="true" /> Corrigir
            </button>
          )}
          className="flex-1"
          testId="presenca-registros"
        />
      )}

      {view === 'historico' && (
        <TabelaPadrao
          titulo="Correções feitas nos registros de presença"
          linhas={safeHistory}
          colunas={colunasHistorico}
          idDaLinha={item => item.id}
          nomeDoItem={{ um: 'correção', varios: 'correções' }}
          ordenacaoInicial={{ chave: 'editadoEm', direcao: 'desc' }}
          vazio="Nenhuma correção de presença registrada. Toda correção feita em Registros aparece aqui, com o motivo e quem fez."
          className="flex-1"
          testId="presenca-historico"
        />
      )}
      {syncPlan && createPortal(
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Conferir sincronização das equipes">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <h2 className="text-lg font-black text-slate-900">Conferir antes de gravar</h2>
                <p className="mt-1 text-sm text-slate-500">{syncFileName} · {syncPlan.resumo.pessoasNaPlanilha} pessoas na planilha</p>
              </div>
              <button type="button" onClick={() => setSyncPlan(null)} aria-label="Fechar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </header>

            <div className="grid grid-cols-2 gap-3 border-b border-slate-200 p-5 sm:grid-cols-5">
              {[
                { rotulo: 'Equipes novas', valor: syncPlan.resumo.criar },
                { rotulo: 'Atualizadas', valor: syncPlan.resumo.atualizar },
                { rotulo: 'Desativadas', valor: syncPlan.resumo.desativar },
                { rotulo: 'Colaboradores criados', valor: syncPlan.resumo.colaboradoresNovos },
                { rotulo: 'Saem do efetivo', valor: syncPlan.resumo.desmobilizar, destaque: syncPlan.resumo.desmobilizar > 0 },
              ].map(item => (
                <div key={item.rotulo} className={`rounded-xl p-3 ${item.destaque ? 'bg-rose-50' : 'bg-slate-50'}`}>
                  <strong className={`text-2xl font-black ${item.destaque ? 'text-rose-800' : 'text-slate-900'}`}>{item.valor}</strong>
                  <span className="mt-1 block text-xs text-slate-500">{item.rotulo}</span>
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {syncPlan.resumo.inalteradas > 0 && (
                <p className="mb-3 text-xs text-slate-500">{syncPlan.resumo.inalteradas} equipe(s) sem alteração, não listadas.</p>
              )}
              <ul className="space-y-2">
                {syncPlan.entradas.filter(entry => entry.acao !== 'inalterada').map(entry => (
                  <li key={entry.grupo.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md px-2 py-1 text-xs font-bold uppercase tracking-[0.1em] ${
                        entry.acao === 'criar' ? 'bg-emerald-100 text-emerald-800'
                          : entry.acao === 'desativar' ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-900'}`}
                      >{entry.acao}</span>
                      <strong className="text-sm font-bold text-slate-900">{entry.nome}</strong>
                      <span className="text-xs text-slate-500">{entry.total} pessoa(s)</span>
                    </div>
                    {entry.entram.length > 0 && (
                      <p className="mt-2 text-xs text-emerald-800"><b>Entram:</b> {entry.entram.map(item => item.nome).join(', ')}</p>
                    )}
                    {entry.saem.length > 0 && (
                      <p className="mt-1 text-xs text-rose-800"><b>Saem:</b> {entry.saem.map(item => item.nome).join(', ')}</p>
                    )}
                  </li>
                ))}
              </ul>
              {syncPlan.colaboradoresParaDesmobilizar.length > 0 && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
                  <p className="text-xs font-bold text-rose-900">{syncPlan.colaboradoresParaDesmobilizar.length} colaborador(es) fora da planilha — serão marcados como DESMOBILIZADO</p>
                  <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-xs text-rose-900">
                    {syncPlan.colaboradoresParaDesmobilizar.map(item => (
                      <li key={item.id}>{item.nome}{item.matricula ? ` · ${item.matricula}` : ''}{item.cargo ? ` · ${item.cargo}` : ''}</li>
                    ))}
                  </ul>
                </div>
              )}
              {syncPlan.colaboradoresReativados.length > 0 && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs font-bold text-emerald-900">{syncPlan.colaboradoresReativados.length} colaborador(es) de volta na planilha: voltam ao efetivo como ATIVO</p>
                  <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-xs text-emerald-900">
                    {syncPlan.colaboradoresReativados.map(item => (
                      <li key={item.id}>{item.nome}{item.matricula ? ` · ${item.matricula}` : ''}{item.cargo ? ` · ${item.cargo}` : ''}</li>
                    ))}
                  </ul>
                </div>
              )}
              {syncPlan.ignoradas.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-bold text-amber-900">{syncPlan.ignoradas.length} linha(s) ignorada(s)</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-amber-900">
                    {syncPlan.ignoradas.slice(0, 8).map(item => <li key={item.linha}>Linha {item.linha}: {item.motivo}</li>)}
                  </ul>
                </div>
              )}
            </div>

            <footer className="flex flex-col gap-3 border-t border-slate-200 p-5 sm:flex-row sm:justify-end">
              <p className="flex-1 text-xs text-slate-500">Equipes fora da planilha ficam inativas, nunca são excluídas. Colaboradores fora da planilha são marcados como desmobilizados (saem do efetivo), o cadastro nunca é apagado. Os links já distribuídos continuam valendo.</p>
              <button type="button" onClick={() => setSyncPlan(null)} className={SECONDARY_BUTTON}>Cancelar</button>
              <button type="button" onClick={() => void confirmarSincronizacao()} disabled={syncBusy} className={PRIMARY_BUTTON}>{syncBusy ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {syncBusy ? 'Gravando no Supabase' : 'Gravar sincronização'}</button>
            </footer>
          </div>
        </div>,
        document.body,
      )}

      {isGroupEditorOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/55 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label={editingGroupId ? 'Editar equipe' : 'Nova equipe'}>
          <div ref={groupEditorScrollRef} className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-[1.75rem] bg-white p-5  sm:rounded-[1.75rem] sm:p-7">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Controle ao vivo</p><h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{editingGroupId ? 'Editar equipe' : 'Nova equipe'}</h2></div><button type="button" onClick={() => setIsGroupEditorOpen(false)} className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:text-slate-900"><X className="h-5 w-5" /></button></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Nome da equipe</span><input value={groupForm.nome} onChange={event => setGroupForm(current => ({ ...current, nome: event.target.value }))} className={FIELD} /></label>
              <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Responsável</span><input value={groupForm.responsavel} onChange={event => setGroupForm(current => ({ ...current, responsavel: event.target.value }))} className={FIELD} /></label>
              <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Obra</span><select value={groupForm.obraId} onChange={event => { const work = safeObras.find(item => item.id === event.target.value); setGroupForm(current => ({ ...current, obraId: event.target.value, frenteServico: work?.nome || current.frenteServico })); }} className={FIELD}><option value="">Selecione</option>{safeObras.map(work => <option key={work.id} value={work.id}>{work.nome}</option>)}</select></label>
              <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Frente de serviço</span><input value={groupForm.frenteServico} onChange={event => setGroupForm(current => ({ ...current, frenteServico: event.target.value }))} className={FIELD} /></label>
              <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Situação</span><select value={groupForm.status} onChange={event => setGroupForm(current => ({ ...current, status: event.target.value as GrupoEquipe['status'] }))} className={FIELD}><option value="ativo">Ativa</option><option value="inativo">Inativa</option></select></label>
              <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={groupForm.linkAtivo} onChange={event => setGroupForm(current => ({ ...current, linkAtivo: event.target.checked }))} className="h-4 w-4 accent-emerald-700" /> Link de campo ativo</label>
            </div>
            <div className="mt-6 border-t border-slate-200 pt-5">{editingGroupId && <div className="mb-3 inline-flex rounded-xl border border-slate-300 bg-white p-1" role="group" aria-label="Quais colaboradores mostrar"><button type="button" aria-pressed={Boolean(membrosAoAbrir)} onClick={() => setMembrosAoAbrir(safeIds(groupForm.funcionarioIds))} className={`min-h-10 rounded-lg px-4 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--renea-focus) ${membrosAoAbrir ? 'bg-[#176b4d] text-white' : 'text-slate-600 hover:text-slate-900'}`}>Da equipe ({safeIds(groupForm.funcionarioIds).length})</button><button type="button" aria-pressed={!membrosAoAbrir} onClick={() => setMembrosAoAbrir(null)} className={`min-h-10 rounded-lg px-4 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--renea-focus) ${!membrosAoAbrir ? 'bg-[#176b4d] text-white' : 'text-slate-600 hover:text-slate-900'}`}>Todos ativos</button></div>}<div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={employeeSearch} onChange={event => setEmployeeSearch(event.target.value)} placeholder="Buscar colaborador, função ou matrícula" className={`${FIELD} pl-10`} /></div><select value={employeeCompany} onChange={event => setEmployeeCompany(event.target.value)} className={`${FIELD} sm:w-64`}><option value="">Todas as empresas</option>{teamCompanies.map(company => <option key={company.id} value={company.id}>{company.nome}</option>)}</select></div>
              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">{membrosAoAbrir && visibleEmployees.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">Nenhum colaborador ativo nesta equipe. Toque em <strong>Todos ativos</strong> para incluir.</p>}{visibleEmployees.map(employee => { const checked = safeIds(groupForm.funcionarioIds).includes(employee.id); return <label key={employee.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${checked ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-300'}`}><input type="checkbox" checked={checked} onChange={event => setGroupForm(current => ({ ...current, funcionarioIds: event.target.checked ? [...safeIds(current.funcionarioIds), employee.id] : safeIds(current.funcionarioIds).filter(id => id !== employee.id) }))} className="h-4 w-4 accent-emerald-700" /><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{employee.nome}</p><p className="truncate text-xs text-slate-500">{employee.cargo}{employee.matricula ? ` · ${employee.matricula}` : ''}</p></div></label>; })}</div>
            </div>
            {feedback && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{feedback}</p>}
            <div className="sticky bottom-0 mt-6 flex gap-3 border-t border-slate-200 bg-white pt-4"><button type="button" onClick={() => setIsGroupEditorOpen(false)} className={`${SECONDARY_BUTTON} flex-1`}>Cancelar</button><button type="button" onClick={saveGroup} className={`${PRIMARY_BUTTON} flex-1`}><CheckCircle2 className="h-4 w-4" /> Salvar equipe</button></div>
          </div>
        </div>,
        document.body,
      )}

      {editingRecord && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/55 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label="Atualizar presença">
          <div className="w-full max-w-lg rounded-t-[1.75rem] bg-white p-5  sm:rounded-[1.75rem] sm:p-7">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Registro auditável</p><h2 className="mt-1 text-2xl font-black text-slate-900">Atualizar presença</h2><p className="mt-1 text-sm text-slate-500">{editingRecord.funcionarioNome} · {editingRecord.grupoNome}</p></div><button type="button" onClick={() => setEditingRecord(null)} className="rounded-xl border border-slate-200 p-2.5 text-slate-500"><X className="h-5 w-5" /></button></div>
            <div className="mt-6 space-y-4"><label><span className="mb-1.5 block text-xs font-bold text-slate-600">Status</span><select value={editStatus} onChange={event => setEditStatus(event.target.value as PresencaStatus)} className={FIELD}>{STATUS_OPTIONS.map(status => <option key={status}>{status}</option>)}</select></label><label><span className="mb-1.5 block text-xs font-bold text-slate-600">Observação</span><textarea value={editObservation} onChange={event => setEditObservation(event.target.value)} rows={3} className={`${FIELD} py-3`} /></label><label><span className="mb-1.5 block text-xs font-bold text-slate-600">Motivo obrigatório</span><textarea value={editReason} onChange={event => setEditReason(event.target.value)} rows={3} className={`${FIELD} py-3`} /></label></div>
            <div className="mt-6 flex gap-3"><button type="button" onClick={() => setEditingRecord(null)} className={`${SECONDARY_BUTTON} flex-1`}>Cancelar</button><button type="button" onClick={saveRecordEdit} disabled={!editReason.trim()} className={`${PRIMARY_BUTTON} flex-1`}><CheckCircle2 className="h-4 w-4" /> Salvar</button></div>
          </div>
        </div>,
        document.body,
      )}

      <ConfirmDialog
        open={Boolean(equipeExcluindo)}
        tone="danger"
        title={`Excluir ${equipeExcluindo?.nome || 'a equipe'}?`}
        description="O link de presença desta equipe para de funcionar. A equipe vai para a Lixeira de Cadastros, de onde o administrador pode devolver com o mesmo link."
        confirmLabel="Excluir equipe"
        onConfirm={() => { if (equipeExcluindo) onDeleteGrupoEquipe?.(equipeExcluindo.id); setFeedback(`Equipe ${equipeExcluindo?.nome || ''} excluída. Ela fica na Lixeira de Cadastros.`); setEquipeExcluindo(null); }}
        onCancel={() => setEquipeExcluindo(null)}
      />
      <ConfirmDialog
        open={confirmandoInativacao}
        tone="warning"
        title={`Inativar ${selectedRecordIds.length} registro(s) de presença?`}
        description="Os apontamentos saem das telas e dos relatórios, mas continuam guardados. Para trazer de volta, abra Inativados e toque em Reativar."
        confirmLabel="Inativar"
        onConfirm={confirmarInativacaoRegistros}
        onCancel={() => setConfirmandoInativacao(false)}
      />
      <ConfirmDialog
        open={Boolean(resumoZerarDia)}
        tone="danger"
        busy={resetBusy}
        title={`Zerar o dia ${recordDate}?`}
        description={`Equipe ${resumoZerarDia?.equipe || ''}: ${resumoZerarDia?.quantos || 0} registro(s) serão apagados e a equipe poderá enviar a presença de novo pelo link. Esta ação não pode ser desfeita.`}
        confirmLabel="Zerar o dia"
        onConfirm={confirmarZerarDia}
        onCancel={() => setResumoZerarDia(null)}
      />

      {lancamento && onLancarPresencaManual && (() => {
        const grupo = safeGroups.find(item => item.id === lancamento.grupoId);
        if (!grupo) return null;
        const pessoas = (grupo.funcionarioIds || [])
          .map(id => employeeById.get(id))
          .filter((pessoa): pessoa is Funcionario => Boolean(pessoa));

        return (
          <FormularioLancamentoPresenca
            grupo={grupo}
            pessoas={pessoas}
            hoje={today}
            data={lancamento.data}
            observacaoDia={lancamento.observacaoDia}
            situacoes={situacoesLancadas}
            opcoesStatus={STATUS_OPTIONS}
            onData={data => setLancamento(atual => atual && { ...atual, data })}
            onObservacaoDia={observacaoDia => setLancamento(atual => atual && { ...atual, observacaoDia })}
            onSituacao={(pessoaId, status, observacao) => setSituacoesLancadas(atuais => {
              if (!status) {
                const { [pessoaId]: _removida, ...resto } = atuais;
                return resto;
              }
              return { ...atuais, [pessoaId]: { funcionarioId: pessoaId, status, observacao } };
            })}
            onTodosPresentes={() => setSituacoesLancadas(atuais => {
              const proximas = { ...atuais };
              pessoas.forEach(pessoa => {
                if (!proximas[pessoa.id]?.status) proximas[pessoa.id] = { funcionarioId: pessoa.id, status: 'Presente' };
              });
              return proximas;
            })}
            onSalvar={() => {
              onLancarPresencaManual(
                grupo,
                lancamento.data,
                Object.values(situacoesLancadas).filter(item => item.status),
                lancamento.observacaoDia,
              );
              setFeedback(`Presença de ${grupo.nome} lançada pelo painel.`);
              setLancamento(null);
            }}
            onFechar={() => setLancamento(null)}
          />
        );
      })()}
    </TelaCheia>
  );
}
