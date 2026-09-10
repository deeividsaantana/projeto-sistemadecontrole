import React, { useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Link2,
  MessageCircle,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  applyTeamSyncPlan,
  buildTeamSyncPlan,
  parseEfetivoRows,
  type TeamSyncPlan,
} from '../utils/teamSpreadsheetSync';
import { generateSecurePublicToken } from '../utils/publicLinkSecurity';
import { ConfirmDialog, Modal, PageHeader } from '../shared/ui';
import { normalizeComparable } from '../utils/canonicalIdentity';
import type { SituacaoLancada } from '../utils/presencaManual';
import {
  diasAntes,
  efetivoPorEmpresa,
  efetivoPorFrente,
  faltasRepetidas,
} from '../utils/painelPresenca';
import { CANTEIROS_ATIVOS, RAMOS_ATIVOS, contemTermo } from '../utils/frenteServico';
import reneaLogo from '../assets/images/logo-renea-dark.svg';
import { addCorporateSummarySheet, configureCorporateWorkbook, createCorporateWorkbook, downloadCorporateWorkbook, styleCorporateWorksheet } from '../utils/excelCorporate';
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
  'Afastado',
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
  Férias: 'border-stone-200 bg-stone-100 text-stone-700',
  Afastado: 'border-orange-200 bg-orange-50 text-orange-800',
  Outro: 'border-violet-200 bg-violet-50 text-violet-800',
};

const PANEL = 'rounded-xl border border-[#e2e8e4] bg-white';
const FIELD = 'min-h-11 w-full rounded-lg border border-[#e2e8e4] bg-white px-3 text-sm text-[#14231e] outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10';
const SECONDARY_BUTTON = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#e2e8e4] bg-white px-4 text-sm font-semibold text-[#26362f] transition hover:border-emerald-700 hover:text-emerald-800 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/15';
const PRIMARY_BUTTON = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#087653] px-4 text-sm font-bold text-white transition hover:bg-[#066344] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/20 disabled:cursor-not-allowed disabled:opacity-45';

interface ControlePresencaTabProps {
  empresas: Empresa[];
  funcionarios: Funcionario[];
  obras: ObraLocal[];
  gruposEquipe: GrupoEquipe[];
  presencasLink: PresencaApontamento[];
  historicoPresencas: HistoricoPresenca[];
  onSaveGrupoEquipe: (grupo: GrupoEquipe, isNew: boolean) => void;
  onDeleteGrupoEquipe: (id: string) => void;
  onUpdatePresencaLink: (id: string, status: PresencaStatus, observacao: string, motivo: string) => void;
  /** Lançar a presença de uma equipe que não usou o link. */
  onLancarPresencaManual?: (
    grupo: GrupoEquipe,
    data: string,
    situacoes: SituacaoLancada[],
    observacaoDia: string,
  ) => void;
  onDeletePresencaLink?: (ids: string[]) => void;
  /** Apaga os envios e a reserva do dia, liberando um novo apontamento. */
  onResetPresencaDia?: (grupoId: string, data: string) => Promise<{ success: boolean; message: string }>;
  /** Grava a sincronização já conferida pelo administrativo. */
  onSyncEquipesPlanilha?: (
    funcionarios: Funcionario[],
    gruposEquipe: GrupoEquipe[],
    resumo: TeamSyncPlan['resumo'],
  ) => Promise<{ success: boolean; message: string }>;
  /**
   * Envios do link público que já chegaram no Firebase mas ainda não foram
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
}

type View = 'ao-vivo' | 'equipes' | 'registros' | 'historico';

const localToday = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const safeText = (value: unknown) => typeof value === 'string' ? value : '';
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

const toCsv = (rows: Array<Array<string | number>>) => rows
  .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';'))
  .join('\n');

export default function ControlePresencaTab({
  empresas = [],
  funcionarios = [],
  obras = [],
  gruposEquipe = [],
  presencasLink = [],
  historicoPresencas = [],
  onSaveGrupoEquipe,
  onDeleteGrupoEquipe,
  onUpdatePresencaLink,
  onLancarPresencaManual,
  onDeletePresencaLink,
  onResetPresencaDia,
  onSyncEquipesPlanilha,
  pendingPublicSubmissionsCount = 0,
  onRestorePresenceHistory,
}: ControlePresencaTabProps) {
  const today = localToday();
  const safeFuncionarios = useMemo(() => (Array.isArray(funcionarios) ? funcionarios : []).filter(Boolean), [funcionarios]);
  const safeEmpresas = useMemo(() => (Array.isArray(empresas) ? empresas : []).filter(Boolean), [empresas]);
  const safeObras = useMemo(() => (Array.isArray(obras) ? obras : []).filter(Boolean), [obras]);
  const safeGroups = useMemo(() => (Array.isArray(gruposEquipe) ? gruposEquipe : []).filter(Boolean).map(normalizeGroup), [gruposEquipe]);
  const safeRecords = useMemo(() => (Array.isArray(presencasLink) ? presencasLink : []).filter(Boolean).map(normalizeRecord), [presencasLink]);
  const safeHistory = useMemo(() => (Array.isArray(historicoPresencas) ? historicoPresencas : []).filter(Boolean), [historicoPresencas]);

  const [view, setView] = useState<View>('ao-vivo');
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
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<PresencaApontamento | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
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
  const [confirmandoLinkGeral, setConfirmandoLinkGeral] = useState(false);
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
  const generalToken = useMemo(() => activeGroups.find(group => group.tokenGeral)?.tokenGeral || '', [activeGroups]);
  const dayRecords = useMemo(() => safeRecords.filter(record => record.data === referenceDate), [referenceDate, safeRecords]);
  const roleOptions = useMemo(() => [...new Set(safeRecords.map(record => record.funcao).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [safeRecords]);
  const employeeById = useMemo(() => new Map(safeFuncionarios.map(employee => [employee.id, employee])), [safeFuncionarios]);
  const buscaPainel = normalizeComparable(dashboardSearch.trim());
  const recordMatchesDashboard = (record: PresencaApontamento) => {
    const employee = employeeById.get(record.funcionarioId);
    const operationalLocation = `${record.grupoNome} ${record.frenteServico}`.toLocaleLowerCase('pt-BR');
    return (dashboardCompany === 'todas' || employee?.empresaId === dashboardCompany)
      && (dashboardGroup === 'todos' || record.grupoId === dashboardGroup)
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
  const sentGroupIds = useMemo(() => new Set(dayRecords.map(record => record.grupoId).filter(Boolean)), [dayRecords]);
  const pendingGroups = useMemo(() => activeGroups.filter(group => !sentGroupIds.has(group.id)), [activeGroups, sentGroupIds]);
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
    () => efetivoPorFrente(dashboardRecords, activeGroups),
    [dashboardRecords, activeGroups],
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

  /**
   * Ramos e canteiros ativos da obra, sempre a lista inteira. Frente sem gente
   * no dia aparece com zero em vez de sumir: quem olha o painel precisa saber
   * que a frente existe e está vazia, não achar que ela não foi cadastrada.
   */
  const porFrente = useMemo(() => {
    const contar = (termos: readonly string[]) => termos.map(termo => ({
      termo,
      total: dashboardRecords.filter(record => contemTermo(`${record.grupoNome} ${record.frenteServico}`, termo)).length,
    }));
    const ramos = contar(ACTIVE_BRANCHES);
    const canteiros = contar(ACTIVE_SITES);
    const semVinculo = dashboardRecords.filter(record => {
      const local = `${record.grupoNome} ${record.frenteServico}`;
      return ![...ACTIVE_BRANCHES, ...ACTIVE_SITES].some(termo => contemTermo(local, termo));
    }).length;
    return { ramos, canteiros, semVinculo, pico: Math.max(1, ...ramos.map(i => i.total), ...canteiros.map(i => i.total)) };
  }, [dashboardRecords]);

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

  const teamRows = useMemo(() => activeGroups.map(group => {
    const records = dayRecords.filter(record => record.grupoId === group.id);
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
      .filter(employee => !employeeCompany || employee.empresaId === employeeCompany)
      .filter(employee => !query || [safeText(employee.nome), safeText(employee.cargo), safeText(employee.matricula)]
        .some(value => value.toLocaleLowerCase('pt-BR').includes(query)))
      .sort((a, b) => safeText(a.nome).localeCompare(safeText(b.nome), 'pt-BR'));
  }, [employeeCompany, employeeSearch, safeFuncionarios]);

  const filteredRecords = useMemo(() => {
    const query = recordSearch.trim().toLocaleLowerCase('pt-BR');
    return safeRecords
      .filter(record => !recordDate || record.data === recordDate)
      .filter(record => recordGroup === 'todos' || record.grupoId === recordGroup)
      .filter(record => recordStatus === 'todos' || record.status === recordStatus)
      .filter(record => !query || [record.funcionarioNome, record.funcao, record.responsavel, record.frenteServico]
        .some(value => value.toLocaleLowerCase('pt-BR').includes(query)))
      .sort((a, b) => `${b.data} ${b.horaEnvio}`.localeCompare(`${a.data} ${a.horaEnvio}`));
  }, [recordDate, recordGroup, recordSearch, recordStatus, safeRecords]);

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

  const openNewGroup = () => {
    setEditingGroupId(null);
    setGroupForm(createEmptyGroup());
    setFeedback('');
    setIsGroupEditorOpen(true);
  };

  const openGroup = (group: GrupoEquipe) => {
    setEditingGroupId(group.id);
    setGroupForm(normalizeGroup(group));
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

  const generateGeneralLink = () => {
    const host = activeGroups.find(group => group.tokenGeral) || activeGroups[0];
    if (!host) {
      setFeedback('Crie uma equipe ativa antes de gerar o link geral.');
      return;
    }
    if (generalToken) { setConfirmandoLinkGeral(true); return; }
    trocarLinkGeral(host);
  };

  const trocarLinkGeral = (host: GrupoEquipe) => {
    onSaveGrupoEquipe({ ...host, tokenGeral: `geral-${generateToken()}`, updatedAt: new Date().toISOString() }, false);
    setFeedback(generalToken ? 'Link geral renovado.' : 'Link geral criado.');
    setConfirmandoLinkGeral(false);
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

      const { linhas, ignoradas } = parseEfetivoRows(rows);
      if (linhas.length === 0) throw new Error('Nenhuma linha aproveitável: confira as colunas de matrícula e encarregado.');
      const plano = buildTeamSyncPlan({
        linhas,
        ignoradas,
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
        setSyncError(`As equipes foram salvas neste computador, mas o Firebase não foi atualizado: ${result.message}`);
        return;
      }
      setSyncPlan(null);
      setSyncFileName('');
      setFeedback(`Equipes sincronizadas no Firebase: ${syncPlan.resumo.criar} criadas, ${syncPlan.resumo.atualizar} atualizadas, ${syncPlan.resumo.desativar} desativadas.`);
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
    onDeletePresencaLink?.(selectedRecordIds);
    setFeedback(`${selectedRecordIds.length} registro(s) de presença inativado(s).`);
    setSelectedRecordIds([]);
    setConfirmandoInativacao(false);
  };

  const navItems: Array<{ id: View; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'ao-vivo', label: 'Ao vivo', icon: Radio },
    { id: 'equipes', label: 'Equipes', icon: Users },
    { id: 'registros', label: 'Registros', icon: FileSpreadsheet },
    { id: 'historico', label: 'Histórico', icon: History },
  ];

  return (
    <section id="presenca-tempo-real" className="mx-auto w-full max-w-[1440px] space-y-5 pb-24 text-[#14231e] lg:pb-8">
      {/* O cabeçalho antigo era um hero: logo repetido, foto de fundo e os sete
          filtros sempre abertos. Media 307px no desktop e 788px no celular —
          mais alto que a própria tela de 727px, ou seja, uma tela inteira de
          rolagem antes da primeira pessoa aparecer. Agora usa o mesmo cabeçalho
          compacto das outras telas, e os filtros viram uma gaveta que só abre
          quando alguém quer filtrar. */}
      <PageHeader
        eyebrow="Controle em tempo real"
        title="Presença ao vivo"
        description="Acompanhe as equipes, compartilhe o link oficial e receba cada envio assim que ele chegar."
      />

      <nav aria-label="Seções do controle de presença" className={`${PANEL} grid grid-cols-4 p-1.5 sm:flex sm:gap-1.5`}>
        {navItems.map(item => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button key={item.id} type="button" onClick={() => setView(item.id)} aria-current={active ? 'page' : undefined} className={`flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 text-[11px] font-bold transition sm:min-w-32 sm:text-sm ${active ? 'bg-emerald-700 text-white' : 'text-[#65716b] hover:bg-emerald-50 hover:text-[#14231e]'}`}>
              <Icon className="h-4 w-4" /> <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <section className={PANEL} aria-label="Recorte do painel">
        <div className="flex flex-wrap items-center gap-2 p-3">
          <button
            type="button"
            onClick={() => setFiltrosAbertos(atual => !atual)}
            aria-expanded={filtrosAbertos}
            aria-controls="presenca-filtros"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#e2e8e4] bg-white px-3 text-xs font-bold text-[#14231e] transition hover:border-emerald-700"
          >
            <Filter className="h-4 w-4 text-emerald-800" />
            Filtros
            {filtrosAtivos > 0 && (
              <span className="rounded-full bg-emerald-700 px-1.5 text-[11px] font-black text-white">{filtrosAtivos}</span>
            )}
            <ChevronDown className={`h-4 w-4 transition-transform ${filtrosAbertos ? 'rotate-180' : ''}`} />
          </button>

          <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#e2e8e4] bg-[#f5f8f6] px-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Exibindo</span>
            <strong className="text-sm font-black text-emerald-800">{dashboardRecords.length} pessoas</strong>
          </span>

          <span className="inline-flex min-h-11 items-center rounded-lg border border-[#e2e8e4] bg-[#f5f8f6] px-3 text-xs font-bold text-[#14231e]">
            {referenceDate.split('-').reverse().join('/')}
          </span>

          {filtrosAtivos > 0 && (
            <button
              type="button"
              onClick={limparFiltrosPainel}
              className="ml-auto inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-emerald-800"
            >
              Limpar
            </button>
          )}
        </div>

        {filtrosAbertos && (
          <div id="presenca-filtros" className="grid gap-2 border-t border-[#e2e8e4] p-3 sm:grid-cols-2 xl:grid-cols-4">
            <label><span className="sr-only">Data de referência</span><input type="date" value={referenceDate} onChange={event => setReferenceDate(event.target.value)} max={today} className={FIELD} /></label>
            <label><span className="sr-only">Empresa</span><select value={dashboardCompany} onChange={event => setDashboardCompany(event.target.value)} className={FIELD}><option value="todas">Todas as empresas</option>{safeEmpresas.map(company => <option key={company.id} value={company.id}>{company.nome}</option>)}</select></label>
            <label><span className="sr-only">Equipe</span><select value={dashboardGroup} onChange={event => setDashboardGroup(event.target.value)} className={FIELD}><option value="todos">Todas as equipes</option>{activeGroups.map(group => <option key={group.id} value={group.id}>{group.nome}</option>)}</select></label>
            <label><span className="sr-only">Função</span><select value={dashboardRole} onChange={event => setDashboardRole(event.target.value)} className={FIELD}><option value="todas">Todas as funções</option>{roleOptions.map(role => <option key={role}>{role}</option>)}</select></label>
            <label><span className="sr-only">Situação</span><select value={dashboardStatus} onChange={event => setDashboardStatus(event.target.value as 'todos' | PresencaStatus)} className={FIELD}><option value="todos">Todos os status</option>{STATUS_OPTIONS.map(status => <option key={status}>{status}</option>)}</select></label>
            <label><span className="sr-only">Ramo</span><select value={dashboardBranch} onChange={event => setDashboardBranch(event.target.value)} className={FIELD}><option value="todos">Todos os ramos</option>{ACTIVE_BRANCHES.map(branch => <option key={branch}>{branch}</option>)}</select></label>
            <label><span className="sr-only">Canteiro</span><select value={dashboardSite} onChange={event => setDashboardSite(event.target.value)} className={FIELD}><option value="todos">Todos os canteiros</option>{ACTIVE_SITES.map(site => <option key={site}>{site}</option>)}</select></label>
            <label><span className="sr-only">Buscar pessoa</span><input type="search" value={dashboardSearch} onChange={event => setDashboardSearch(event.target.value)} placeholder="Nome ou matrícula" className={FIELD} /></label>
          </div>
        )}
      </section>

      {feedback && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} aria-label="Fechar mensagem" className="rounded-lg p-1 hover:bg-emerald-100"><X className="h-4 w-4" /></button>
        </div>
      )}

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
            <article data-cartao-painel className={`renea-card ${PANEL} relative overflow-hidden p-5 transition-shadow duration-200 hover:shadow-[0_12px_28px_-16px_rgba(16,24,32,0.25)] sm:p-7`}>
              <div className="absolute right-6 top-6 text-emerald-800/20"><ArrowRight className="h-24 w-24" strokeWidth={1} /></div>
              <div className="relative">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#65716b]">Efetivo confirmado</p>
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-800"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-700" />{metrics.latest ? `Atualizado às ${metrics.latest}` : 'Aguardando o primeiro envio'}</span>
                </div>
                <div className="mt-7 flex items-end gap-3">
                  <strong data-count={metrics.present} className="text-7xl font-black tabular-nums tracking-[-0.075em] text-[#101a22] sm:text-8xl">0</strong>
                  <div className="pb-2"><p className="text-2xl font-bold text-emerald-800">presentes</p><p className="text-sm text-[#65716b]">{metrics.planned ? `de ${metrics.planned} previstos` : 'sem efetivo previsto vinculado às equipes'}</p></div>
                </div>
                {/* Sem efetivo previsto não existe percentual: mostrar "0% confirmado"
                    ao lado de 32 presentes faz o painel parecer quebrado. */}
                {metrics.planned > 0 ? (
                  <>
                    <div className="mt-7 h-2 overflow-hidden rounded-full bg-[#e8e5db]"><div data-barra-efetivo className="h-full origin-left rounded-full bg-[#087653]" style={{ width: `${metrics.percent}%` }} /></div>
                    <p className="mt-2 text-right text-xs font-bold tabular-nums text-[#65716b]">{metrics.percent}% confirmado</p>
                  </>
                ) : (
                  <p className="mt-7 text-xs text-[#79847e]">Vincule os colaboradores às equipes em <strong className="font-bold text-[#26362f]">Equipes</strong> para acompanhar o percentual confirmado.</p>
                )}
              </div>
            </article>
            <aside className="space-y-5">
            <article data-cartao-painel className={`renea-card ${PANEL} p-5`}>
              <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#14231e] text-white"><Link2 className="h-5 w-5" /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-800">Link oficial</p><h2 className="mt-0.5 text-lg font-black text-[#101a22]">Registro de campo</h2></div></div>
              <p className="mt-4 text-sm leading-6 text-[#65716b]">Um endereço seguro para o responsável escolher a equipe e enviar a presença diretamente ao painel.</p>
              {generalToken ? (
                <div className="mt-4 space-y-3"><input readOnly value={presenceLink(generalToken)} className={`${FIELD} font-mono text-xs`} /><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => copyLink(generalToken, 'Link geral')} className={SECONDARY_BUTTON}><ClipboardCopy className="h-4 w-4" /> Copiar</button><button type="button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Registre a presença da sua equipe: ${presenceLink(generalToken)}`)}`, '_blank', 'noopener,noreferrer')} className={PRIMARY_BUTTON}><MessageCircle className="h-4 w-4" /> WhatsApp</button></div></div>
              ) : <button type="button" onClick={generateGeneralLink} className={`${PRIMARY_BUTTON} mt-4 w-full`}><Plus className="h-4 w-4" /> Criar link geral</button>}
              {generalToken && <button type="button" onClick={generateGeneralLink} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#65716b] hover:text-emerald-800"><RotateCcw className="h-3.5 w-3.5" /> Renovar link com segurança</button>}
            </article>

            <article data-cartao-painel className={`renea-card ${PANEL} p-5`}>
              <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-700" /><h2 className="text-lg font-black text-[#101a22]">Atenção agora</h2></div>
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
            </aside>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Ausentes', metrics.absent, 'text-rose-700'],
                ['Justificados', metrics.justified, 'text-amber-700'],
                ['Equipes pendentes', metrics.pending, 'text-[#101a22]'],
                ['Equipes ativas', activeGroups.length, 'text-emerald-800'],
              ].map(([label, value, tone]) => (
                <article key={String(label)} className={`${PANEL} p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-16px_rgba(16,24,32,0.3)] sm:p-5`}>
                  <strong data-count={value} className={`block text-3xl font-black tabular-nums ${tone}`}>0</strong>
                  <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-[#65716b] sm:text-xs">{label}</span>
                </article>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <article data-cartao-painel className={`renea-card ${PANEL} flex flex-col p-5 md:col-span-2`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#65716b]">Confirmados nos últimos 7 dias</p>
                <div className="mt-5 flex min-h-28 flex-1 items-end gap-2">
                  {tendencia.map(item => (
                    <button type="button" key={item.iso} onClick={() => setReferenceDate(item.iso)} className="group flex h-full flex-1 flex-col items-center gap-1" title={`Ver ${item.presentes} presente(s) em ${item.rotulo}`}>
                      <span className="text-[10px] font-bold tabular-nums text-[#65716b]">{item.presentes || ''}</span>
                      <div className="flex w-full flex-1 items-end">
                        <div
                          data-trend-bar
                          data-pct={Math.max(3, (item.presentes / picoTendencia) * 100)}
                          className={`w-full cursor-pointer rounded-t-md transition-colors duration-200 ${item.iso === referenceDate ? 'bg-[#087653]' : 'bg-[#bfded0] group-hover:bg-[#8fc7ab]'}`}
                        />
                      </div>
                      <span className="text-[9px] font-bold tabular-nums text-[#79847e]">{item.rotulo}</span>
                    </button>
                  ))}
                </div>
              </article>

              <article data-cartao-painel className={`renea-card ${PANEL} p-5`}>
                <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#65716b]">Efetivo por função</p><span className="text-[10px] font-black text-emerald-800">{referenceDate.split('-').reverse().join('/')}</span></div>
                {funcoesDoDia.length === 0 ? <p className="mt-6 text-sm text-[#65716b]">Nenhuma função registrada neste recorte.</p> : (
                  <div className="mt-4 space-y-3">
                    {funcoesDoDia.slice(0, 7).map(item => <button type="button" key={item.funcao} onClick={() => setDashboardRole(item.funcao)} className="group block w-full text-left" aria-label={`Filtrar ${item.funcao}: ${item.total}`}>
                      <div className="flex items-center justify-between gap-3 text-xs"><span className="truncate font-bold text-[#26362f] group-hover:text-emerald-800">{item.funcao}</span><strong className="tabular-nums text-[#101a22]">{item.total}</strong></div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#eef2f0]"><span data-dist-bar data-pct={(item.total / picoFuncoes) * 100} className="block h-full rounded-full bg-[#12a273]" /></div>
                    </button>)}
                  </div>
                )}
              </article>

              <article data-cartao-painel className={`renea-card ${PANEL} p-5`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#65716b]">Situações registradas no dia</p>
                {distribuicao.length === 0 ? (
                  <p className="mt-6 text-sm text-[#65716b]">Nenhum envio recebido para {referenceDate.split('-').reverse().join('/')}.</p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {distribuicao.map(item => (
                      <li key={item.status}><button type="button" onClick={() => setDashboardStatus(item.status)} className="group block w-full text-left">
                        <div className="flex items-center justify-between gap-3 text-xs font-bold">
                          <span className="text-[#26362f] group-hover:text-emerald-800">{item.status}</span>
                          <span className="tabular-nums text-[#65716b]">{item.total}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#eef2f0]">
                          <div data-dist-bar data-pct={(item.total / Math.max(1, dashboardRecords.length)) * 100} className="h-full rounded-full bg-[#087653]" />
                        </div>
                      </button></li>
                    ))}
                  </ul>
                )}
              </article>

              <article data-cartao-painel className={`renea-card ${PANEL} p-5 md:col-span-2`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#65716b]">Efetivo por equipe</p>
                {equipesDoDia.length === 0 ? <p className="mt-6 text-sm text-[#65716b]">Nenhuma equipe com envio neste recorte.</p> : (
                  <div className="mt-4 space-y-3">
                    {equipesDoDia.slice(0, 7).map(item => (
                      <button type="button" key={item.nome} onClick={() => setDashboardGroup(item.id || 'todos')} className="group block w-full text-left" aria-label={`Filtrar ${item.nome}: ${item.total} pessoa(s)`}>
                        <div className="flex items-center justify-between gap-3 text-xs"><span className="truncate font-bold text-[#26362f] group-hover:text-emerald-800">{item.nome}</span><strong className="tabular-nums text-[#101a22]">{item.total}</strong></div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#eef2f0]"><span data-dist-bar data-pct={(item.total / picoEquipes) * 100} className="block h-full rounded-full bg-[#087653]" /></div>
                      </button>
                    ))}
                  </div>
                )}
              </article>

            <article data-cartao-painel className={`renea-card ${PANEL} p-5 md:col-span-2`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#65716b]">Efetivo por ramo e canteiro</p>
                <span className="text-[10px] font-semibold text-[#79847e]">A lista mostra todas as frentes ativas, inclusive as que estão sem gente hoje.</span>
              </div>
              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                {([['Ramos', porFrente.ramos, setDashboardBranch], ['Canteiros', porFrente.canteiros, setDashboardSite]] as const).map(([titulo, itens, aplicar]) => (
                  <div key={titulo}>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8d968f]">{titulo}</p>
                    <div className="mt-3 space-y-2">
                      {itens.map(item => (
                        <button
                          type="button"
                          key={item.termo}
                          onClick={() => aplicar(item.termo)}
                          disabled={item.total === 0}
                          className="group flex w-full items-center gap-3 text-left disabled:cursor-default"
                          aria-label={`${item.termo}: ${item.total} pessoa(s)`}
                        >
                          <span className={`w-36 shrink-0 truncate text-xs font-bold ${item.total ? 'text-[#26362f] group-hover:text-emerald-800' : 'text-[#9aa39d]'}`}>{item.termo}</span>
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef2f0]">
                            <span data-dist-bar data-pct={(item.total / porFrente.pico) * 100} className={`block h-full rounded-full ${item.total ? 'bg-[#12a273]' : 'bg-transparent'}`} />
                          </span>
                          <strong className={`w-8 shrink-0 text-right text-xs tabular-nums ${item.total ? 'text-[#101a22]' : 'text-[#b3bab5]'}`}>{item.total}</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {porFrente.semVinculo > 0 && (
                <p className="mt-4 border-t border-[#eef2f0] pt-3 text-xs text-[#65716b]">
                  <strong className="tabular-nums text-[#101a22]">{porFrente.semVinculo}</strong> apontamento(s) sem ramo ou canteiro reconhecido no nome da equipe ou da frente de serviço.
                </p>
              )}
            </article>
            </div>


            {ausentesDoDia.length > 0 && (
              <article data-cartao-painel className={`renea-card ${PANEL} overflow-hidden`}>
                <header className="flex items-center justify-between gap-3 border-b border-[#e4e0d6] px-5 py-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-rose-700">Conferência</p>
                    <h2 className="mt-1 text-lg font-black tracking-tight text-[#101a22]">Quem não está em campo hoje</h2>
                  </div>
                  <span className="text-sm font-black tabular-nums text-rose-700">{ausentesDoDia.length}</span>
                </header>
                <ul className="divide-y divide-[#ebe7dc]">
                  {ausentesDoDia.slice(0, 8).map(record => (
                    <li key={record.id} className="flex items-center gap-3 px-5 py-3">
                      <span className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${STATUS_STYLES[record.status] || STATUS_STYLES.Outro}`}>{record.status}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#101a22]">{record.funcionarioNome}</p>
                        <p className="truncate text-xs text-[#65716b]">{record.grupoNome} · {record.observacao || 'Sem observação'}</p>
                      </div>
                      <button type="button" onClick={() => openRecordEditor(record)} className="shrink-0 text-xs font-bold text-emerald-800 hover:underline">Revisar</button>
                    </li>
                  ))}
                </ul>
                {ausentesDoDia.length > 8 && (
                  <button type="button" onClick={() => { setRecordStatus('Ausente'); setRecordDate(referenceDate); setView('registros'); }} className="w-full border-t border-[#ebe7dc] px-5 py-3 text-xs font-bold text-emerald-800 hover:bg-[#f8fbf9]">
                    Ver todos os {ausentesDoDia.length} registros
                  </button>
                )}
              </article>
            )}

            <article data-cartao-painel className={`renea-card ${PANEL} overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e0d6] px-5 py-4">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-800">Equipes</p><h2 className="mt-1 text-xl font-black tracking-tight text-[#101a22]">Situação do dia</h2></div>
                <div className="flex flex-wrap items-center gap-2">
                  <input type="date" value={referenceDate} onChange={event => setReferenceDate(event.target.value)} max={today} className={`${FIELD} w-auto`} aria-label="Data do relatório diário" />
                  <button type="button" onClick={() => void exportDailyExcel()} className={PRIMARY_BUTTON} disabled={dayRecords.length === 0} title="Baixar situação do dia em Excel"><FileSpreadsheet className="h-4 w-4" /> Excel</button>
                  <button type="button" onClick={() => void exportDailyPdf()} className={SECONDARY_BUTTON} disabled={dayRecords.length === 0} title="Imprimir situação do dia em PDF"><FileText className="h-4 w-4" /> PDF</button>
                  <button type="button" onClick={() => setView('equipes')} className="inline-flex items-center gap-1 px-2 text-sm font-bold text-emerald-800 hover:text-emerald-950">Gerenciar <ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="divide-y divide-[#ebe7dc]">
                {teamRows.length === 0 ? (
                  <div className="px-5 py-12 text-center text-sm text-[#65716b]">Nenhuma equipe ativa cadastrada.</div>
                ) : teamRows.map(row => (
                  <div key={row.group.id} className="flex items-center gap-4 px-5 py-4">
                    <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${row.sent ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {row.sent ? <Check className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#101a22]">{row.group.nome}</p><p className="mt-0.5 truncate text-xs text-[#65716b]">{row.group.responsavel} · {row.group.frenteServico}</p></div>
                    <div className="text-right"><p className="text-lg font-black tabular-nums text-[#101a22]">{row.present}/{row.total}</p><p className={`text-[10px] font-bold uppercase tracking-[0.1em] ${row.sent ? 'text-emerald-800' : 'text-amber-800'}`}>{row.sent ? row.updatedAt || 'Recebido' : 'Pendente'}</p></div>
                  </div>
                ))}
              </div>
            </article>

            {/* Painel interativo: cada linha é um filtro. Clicar numa frente ou
                numa empresa recorta o painel inteiro por ela; clicar de novo
                desfaz. O número deixa de ser só leitura e vira o caminho. */}
            <div className="grid gap-5 xl:grid-cols-2">
              <article data-cartao-painel className={`renea-card ${PANEL} overflow-hidden`}>
                <div className="border-b border-[#e4e0d6] px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-800">Frentes de serviço</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-[#101a22]">Onde falta gente</h2>
                  <p className="mt-1 text-xs text-[#65716b]">Da maior falta para a menor. Toque numa frente para recortar o painel por ela.</p>
                </div>
                <ul className="divide-y divide-[#ebe7dc]">
                  {efetivoDasFrentes.length === 0 && (
                    <li className="px-5 py-10 text-center text-sm text-[#65716b]">Nenhum apontamento no recorte.</li>
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
                            <p className="truncate text-sm font-bold text-[#101a22]">{linha.rotulo}</p>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e8e5db]">
                              <div
                                className="h-full rounded-full bg-[#087653]"
                                style={{ width: `${Math.min(100, linha.percentual ?? 0)}%` }}
                              />
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-base font-black tabular-nums text-[#101a22]">
                              {linha.confirmados}{linha.previstos > 0 ? <span className="text-xs font-bold text-[#65716b]">/{linha.previstos}</span> : null}
                            </p>
                            <p className={`text-[11px] font-bold ${falta > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
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
                <div className="border-b border-[#e4e0d6] px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-800">Empresas</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-[#101a22]">Quem entregou efetivo</h2>
                  <p className="mt-1 text-xs text-[#65716b]">Toque numa empresa para ver só o efetivo dela.</p>
                </div>
                <ul className="divide-y divide-[#ebe7dc]">
                  {efetivoDasEmpresas.length === 0 && (
                    <li className="px-5 py-10 text-center text-sm text-[#65716b]">Nenhum apontamento no recorte.</li>
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
                          <p className="min-w-0 flex-1 truncate text-sm font-bold text-[#101a22]">{linha.rotulo}</p>
                          <div className="shrink-0 text-right">
                            <p className="text-base font-black tabular-nums text-[#101a22]">{linha.confirmados}</p>
                            {linha.ausentes > 0 && <p className="text-[11px] font-bold text-rose-700">{linha.ausentes} ausente(s)</p>}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </article>
            </div>

            <article data-cartao-painel className={`renea-card ${PANEL} overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e0d6] px-5 py-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-800">Últimos 30 dias</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-[#101a22]">Quem falta sempre</h2>
                  <p className="mt-1 text-xs text-[#65716b]">O painel mostra o dia; o problema aparece no mês. Toque no nome para ver os registros da pessoa.</p>
                </div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
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
              <ul className="divide-y divide-[#ebe7dc]">
                {reincidentes.length === 0 && (
                  <li className="px-5 py-10 text-center text-sm text-[#65716b]">
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
                        <p className="truncate text-sm font-bold text-[#101a22]">{pessoa.nome}</p>
                        <p className="mt-0.5 truncate text-xs text-[#65716b]">{pessoa.funcao} · {pessoa.equipe}</p>
                        <p className="mt-1 truncate text-[11px] text-[#79847e]">
                          {pessoa.datas.slice(0, 6).map(data => data.slice(8, 10) + '/' + data.slice(5, 7)).join(' · ')}
                          {pessoa.datas.length > 6 ? ` · +${pessoa.datas.length - 6}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-black tabular-nums text-rose-700">{pessoa.faltas}</p>
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#65716b]">faltas</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </article>
        </div>
      )}

      {view === 'equipes' && (
        <div className="space-y-4">
          <div className={`${PANEL} flex flex-col gap-3 p-4 sm:flex-row sm:items-center`}>
            <div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#79847e]" /><input value={teamSearch} onChange={event => setTeamSearch(event.target.value)} placeholder="Buscar equipe, responsável ou frente" className={`${FIELD} pl-10`} /></div>
            {syncError && (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">{syncError}</div>
            )}
            {onSyncEquipesPlanilha && (
              <label className={`${SECONDARY_BUTTON} cursor-pointer`}>
                {syncBusy ? <RotateCcw className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                {syncBusy ? 'Lendo planilha' : 'Sincronizar pela planilha'}
                <input
                  type="file"
                  accept=".xlsx,.xlsm"
                  className="hidden"
                  disabled={syncBusy}
                  onChange={event => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void lerPlanilhaEfetivo(file);
                  }}
                />
              </label>
            )}
            <button type="button" onClick={openNewGroup} className={PRIMARY_BUTTON}><Plus className="h-4 w-4" /> Nova equipe</button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredGroups.map(group => {
              const members = group.funcionarioIds.map(id => safeFuncionarios.find(employee => employee.id === id)).filter(Boolean) as Funcionario[];
              return (
                <article key={group.id} className={`${PANEL} p-5`}>
                  <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f0eee6] text-[#14231e]"><Users className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black text-[#101a22]">{group.nome || 'Equipe sem nome'}</h2><span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${group.status === 'ativo' && group.linkAtivo ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'}`}>{group.status === 'ativo' && group.linkAtivo ? 'Ativa' : 'Inativa'}</span></div><p className="mt-1 text-sm text-[#65716b]">{group.responsavel || 'Sem responsável'} · {group.frenteServico || 'Sem frente'}</p></div><button type="button" onClick={() => openGroup(group)} className="rounded-xl border border-[#ddd9cd] p-2.5 text-[#65716b] hover:border-emerald-700 hover:text-emerald-800" aria-label={`Editar ${group.nome}`}><Edit3 className="h-4 w-4" /></button></div>
                  <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-[#f7f5ef] p-3"><strong className="text-2xl font-black text-[#101a22]">{members.length}</strong><span className="ml-2 text-xs text-[#65716b]">colaboradores</span></div><div className="rounded-xl bg-[#f7f5ef] p-3"><strong className="text-sm font-black text-[#101a22]">{group.linkAtivo ? 'Disponível' : 'Pausado'}</strong><span className="mt-1 block text-xs text-[#65716b]">link da equipe</span></div></div>
                  {group.token && <div className="mt-4 flex gap-2"><button type="button" onClick={() => copyLink(group.token, `Link de ${group.nome}`)} className={`${SECONDARY_BUTTON} flex-1`}><ClipboardCopy className="h-4 w-4" /> Copiar</button><button type="button" onClick={() => shareOnWhatsApp(group)} className={`${PRIMARY_BUTTON} flex-1`}><MessageCircle className="h-4 w-4" /> Enviar</button></div>}
                  <div className="mt-4 flex items-center justify-between border-t border-[#ebe7dc] pt-4"><button type="button" onClick={() => onDeleteGrupoEquipe(group.id)} className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 hover:text-rose-900"><Trash2 className="h-3.5 w-3.5" /> Excluir</button><button type="button" onClick={() => openGroup({ ...group, token: generateToken() })} className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950"><RotateCcw className="h-3.5 w-3.5" /> Renovar token</button></div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {view === 'registros' && (
        <div className="space-y-4">
          <div className={`${PANEL} grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[160px_220px_220px_1fr_auto]`}>
            <input type="date" value={recordDate} onChange={event => setRecordDate(event.target.value)} className={FIELD} />
            <select value={recordGroup} onChange={event => setRecordGroup(event.target.value)} className={FIELD}><option value="todos">Todas as equipes</option>{safeGroups.map(group => <option key={group.id} value={group.id}>{group.nome}</option>)}</select>
            <select value={recordStatus} onChange={event => setRecordStatus(event.target.value as 'todos' | PresencaStatus)} className={FIELD}><option value="todos">Todos os status</option>{STATUS_OPTIONS.map(status => <option key={status}>{status}</option>)}</select>
            <div className="relative"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#79847e]" /><input value={recordSearch} onChange={event => setRecordSearch(event.target.value)} placeholder="Buscar colaborador, função ou responsável" className={`${FIELD} pl-10`} /></div>
            {onResetPresencaDia && (
              <button
                type="button"
                onClick={() => void zerarDia()}
                disabled={recordGroup === 'todos' || resetBusy}
                title={recordGroup === 'todos' ? 'Escolha uma equipe para zerar o dia' : 'Apaga o apontamento do dia e libera novo envio pelo link'}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-bold text-rose-800 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {resetBusy ? <RotateCcw className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Zerar o dia
              </button>
            )}
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void exportExcel()} className={PRIMARY_BUTTON} title="Exportar Excel"><FileSpreadsheet className="h-4 w-4" /><span className="hidden sm:inline">Excel</span></button><button type="button" onClick={() => void exportPdf()} className={SECONDARY_BUTTON} title="Exportar PDF"><FileText className="h-4 w-4" /></button><button type="button" onClick={exportCsv} className={SECONDARY_BUTTON} title="Exportar CSV"><Download className="h-4 w-4" /></button>{onRestorePresenceHistory && <button type="button" onClick={() => void restoreHistory()} disabled={restoringHistory} className={`${SECONDARY_BUTTON} disabled:cursor-not-allowed disabled:opacity-60`} title="Busca de novo todos os envios já feitos pelo link público e traz de volta dias que sumiram, sem apagar nada"><RotateCcw className={`h-4 w-4 ${restoringHistory ? 'animate-spin' : ''}`} /><span className="hidden sm:inline">{restoringHistory ? 'Recuperando...' : 'Recuperar histórico'}</span></button>}{selectedRecordIds.length > 0 && <button type="button" onClick={deleteSelectedRecords} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 text-sm font-bold text-white transition hover:bg-rose-800"><Trash2 className="h-4 w-4" /> Excluir ({selectedRecordIds.length})</button>}</div>
          </div>
          <label className="flex min-h-11 items-center gap-2 px-1 text-xs font-bold text-[#53605a]"><input type="checkbox" checked={filteredRecords.length > 0 && filteredRecords.every(record => selectedRecordIds.includes(record.id))} onChange={event => setSelectedRecordIds(event.target.checked ? filteredRecords.map(record => record.id) : [])} className="h-4 w-4 accent-emerald-700" /> Selecionar registros filtrados</label>
          <div className="grid gap-3">
            {filteredRecords.length === 0 ? <div className={`${PANEL} px-5 py-14 text-center text-sm text-[#65716b]`}>Nenhum registro encontrado para os filtros selecionados.</div> : filteredRecords.map(record => {
              const duplicated = duplicateKeys.has(duplicateKey(record));
              return (
                <article key={record.id || `${duplicateKey(record)}-${record.horaEnvio}`} className={`${PANEL} grid gap-4 p-4 lg:grid-cols-[28px_150px_1.2fr_1.2fr_180px_auto] lg:items-center`}>
                  <label className="flex items-start justify-center pt-1"><input type="checkbox" checked={selectedRecordIds.includes(record.id)} onChange={event => setSelectedRecordIds(current => event.target.checked ? [...new Set([...current, record.id])] : current.filter(id => id !== record.id))} aria-label={`Selecionar presença de ${record.funcionarioNome}`} className="h-4 w-4 accent-emerald-700" /></label><div><p className="text-xs font-bold text-[#65716b]">{record.data.split('-').reverse().join('/')}</p><p className="mt-1 text-lg font-black tabular-nums text-[#101a22]">{record.horaEnvio || '--:--'}</p>{duplicated && <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-800"><AlertTriangle className="h-3 w-3" /> Duplicado</span>}</div>
                  <div><p className="text-sm font-black text-[#101a22]">{record.funcionarioNome || 'Colaborador não informado'}</p><p className="mt-1 text-xs text-[#65716b]">{record.funcao || 'Função não informada'}</p></div>
                  <div><p className="text-sm font-bold text-[#101a22]">{record.grupoNome || 'Equipe não informada'}</p><p className="mt-1 text-xs text-[#65716b]">{record.responsavel} · {record.frenteServico}</p></div>
                  <span className={`w-fit rounded-lg border px-3 py-2 text-xs font-bold ${STATUS_STYLES[record.status] || STATUS_STYLES.Outro}`}>{record.status}</span>
                  <button type="button" onClick={() => openRecordEditor(record)} className={SECONDARY_BUTTON}><Edit3 className="h-4 w-4" /> Atualizar</button>
                  {record.observacao && <p className="border-t border-[#ebe7dc] pt-3 text-sm text-[#65716b] lg:col-span-6">{record.observacao}</p>}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {view === 'historico' && (
        <div className="grid gap-3">
          {safeHistory.length === 0 ? <div className={`${PANEL} px-5 py-14 text-center text-sm text-[#65716b]`}>Nenhuma alteração de presença registrada.</div> : safeHistory.map(item => {
            const employee = safeFuncionarios.find(person => person.id === item.funcionarioId);
            return (
              <article key={item.id} className={`${PANEL} grid gap-3 p-4 md:grid-cols-[180px_1fr_1fr] md:items-center`}>
                <div><p className="text-xs font-bold text-[#65716b]">{item.data}</p><p className="mt-1 text-sm font-black text-[#101a22]">{safeText(employee?.nome) || item.funcionarioId}</p></div>
                <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-[#79847e]">Alteração</p><p className="mt-1 text-sm text-[#26362f]"><span className="text-rose-700">{item.valorAnterior}</span> <ArrowRight className="mx-1 inline h-3.5 w-3.5" /> <span className="font-bold text-emerald-800">{item.valorNovo}</span></p><p className="mt-1 text-xs text-[#65716b]">{item.motivo}</p></div>
                <div className="md:text-right"><p className="text-sm font-semibold text-[#26362f]">{item.editadoPor}</p><p className="mt-1 text-xs text-[#65716b]">{item.editadoEm}</p></div>
              </article>
            );
          })}
        </div>
      )}

      {syncPlan && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Conferir sincronização das equipes">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white">
            <header className="flex items-start justify-between gap-4 border-b border-[#ebe7dc] p-5">
              <div>
                <h2 className="text-lg font-black text-[#101a22]">Conferir antes de gravar</h2>
                <p className="mt-1 text-sm text-[#65716b]">{syncFileName} · {syncPlan.resumo.pessoasNaPlanilha} pessoas na planilha</p>
              </div>
              <button type="button" onClick={() => setSyncPlan(null)} aria-label="Fechar" className="rounded-lg p-2 text-[#65716b] hover:bg-[#f2f0e8]"><X className="h-5 w-5" /></button>
            </header>

            <div className="grid grid-cols-2 gap-3 border-b border-[#ebe7dc] p-5 sm:grid-cols-4">
              {[
                { rotulo: 'Equipes novas', valor: syncPlan.resumo.criar },
                { rotulo: 'Atualizadas', valor: syncPlan.resumo.atualizar },
                { rotulo: 'Desativadas', valor: syncPlan.resumo.desativar },
                { rotulo: 'Colaboradores criados', valor: syncPlan.resumo.colaboradoresNovos },
              ].map(item => (
                <div key={item.rotulo} className="rounded-xl bg-[#f7f5ef] p-3">
                  <strong className="text-2xl font-black text-[#101a22]">{item.valor}</strong>
                  <span className="mt-1 block text-xs text-[#65716b]">{item.rotulo}</span>
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {syncPlan.resumo.inalteradas > 0 && (
                <p className="mb-3 text-xs text-[#65716b]">{syncPlan.resumo.inalteradas} equipe(s) sem alteração, não listadas.</p>
              )}
              <ul className="space-y-2">
                {syncPlan.entradas.filter(entry => entry.acao !== 'inalterada').map(entry => (
                  <li key={entry.grupo.id} className="rounded-xl border border-[#e2e8e4] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${
                        entry.acao === 'criar' ? 'bg-emerald-100 text-emerald-800'
                          : entry.acao === 'desativar' ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-900'}`}
                      >{entry.acao}</span>
                      <strong className="text-sm font-bold text-[#101a22]">{entry.nome}</strong>
                      <span className="text-xs text-[#65716b]">{entry.total} pessoa(s)</span>
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
              {syncPlan.ignoradas.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-bold text-amber-900">{syncPlan.ignoradas.length} linha(s) ignorada(s)</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-amber-900">
                    {syncPlan.ignoradas.slice(0, 8).map(item => <li key={item.linha}>Linha {item.linha}: {item.motivo}</li>)}
                  </ul>
                </div>
              )}
            </div>

            <footer className="flex flex-col gap-3 border-t border-[#ebe7dc] p-5 sm:flex-row sm:justify-end">
              <p className="flex-1 text-xs text-[#65716b]">Equipes fora da planilha ficam inativas, nunca são excluídas. Os links já distribuídos continuam valendo.</p>
              <button type="button" onClick={() => setSyncPlan(null)} className={SECONDARY_BUTTON}>Cancelar</button>
              <button type="button" onClick={() => void confirmarSincronizacao()} disabled={syncBusy} className={PRIMARY_BUTTON}>{syncBusy ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {syncBusy ? 'Gravando no Firebase' : 'Gravar sincronização'}</button>
            </footer>
          </div>
        </div>
      )}

      {isGroupEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#101a22]/55 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label={editingGroupId ? 'Editar equipe' : 'Nova equipe'}>
          <div className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-[1.75rem] bg-[#fffefa] p-5  sm:rounded-[1.75rem] sm:p-7">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-800">Controle ao vivo</p><h2 className="mt-1 text-2xl font-black tracking-tight text-[#101a22]">{editingGroupId ? 'Editar equipe' : 'Nova equipe'}</h2></div><button type="button" onClick={() => setIsGroupEditorOpen(false)} className="rounded-xl border border-[#ddd9cd] p-2.5 text-[#65716b] hover:text-[#101a22]"><X className="h-5 w-5" /></button></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label><span className="mb-1.5 block text-xs font-bold text-[#53605a]">Nome da equipe</span><input value={groupForm.nome} onChange={event => setGroupForm(current => ({ ...current, nome: event.target.value }))} className={FIELD} /></label>
              <label><span className="mb-1.5 block text-xs font-bold text-[#53605a]">Responsável</span><input value={groupForm.responsavel} onChange={event => setGroupForm(current => ({ ...current, responsavel: event.target.value }))} className={FIELD} /></label>
              <label><span className="mb-1.5 block text-xs font-bold text-[#53605a]">Obra</span><select value={groupForm.obraId} onChange={event => { const work = safeObras.find(item => item.id === event.target.value); setGroupForm(current => ({ ...current, obraId: event.target.value, frenteServico: work?.nome || current.frenteServico })); }} className={FIELD}><option value="">Selecione</option>{safeObras.map(work => <option key={work.id} value={work.id}>{work.nome}</option>)}</select></label>
              <label><span className="mb-1.5 block text-xs font-bold text-[#53605a]">Frente de serviço</span><input value={groupForm.frenteServico} onChange={event => setGroupForm(current => ({ ...current, frenteServico: event.target.value }))} className={FIELD} /></label>
              <label><span className="mb-1.5 block text-xs font-bold text-[#53605a]">Situação</span><select value={groupForm.status} onChange={event => setGroupForm(current => ({ ...current, status: event.target.value as GrupoEquipe['status'] }))} className={FIELD}><option value="ativo">Ativa</option><option value="inativo">Inativa</option></select></label>
              <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-[#d8d4c8] bg-white px-3 text-sm font-semibold text-[#26362f]"><input type="checkbox" checked={groupForm.linkAtivo} onChange={event => setGroupForm(current => ({ ...current, linkAtivo: event.target.checked }))} className="h-4 w-4 accent-emerald-700" /> Link de campo ativo</label>
            </div>
            <div className="mt-6 border-t border-[#e4e0d6] pt-5"><div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#79847e]" /><input value={employeeSearch} onChange={event => setEmployeeSearch(event.target.value)} placeholder="Buscar colaborador, função ou matrícula" className={`${FIELD} pl-10`} /></div><select value={employeeCompany} onChange={event => setEmployeeCompany(event.target.value)} className={`${FIELD} sm:w-64`}><option value="">Todas as empresas</option>{safeEmpresas.map(company => <option key={company.id} value={company.id}>{company.nome}</option>)}</select></div>
              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">{visibleEmployees.map(employee => { const checked = safeIds(groupForm.funcionarioIds).includes(employee.id); return <label key={employee.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${checked ? 'border-emerald-300 bg-emerald-50' : 'border-[#e1ddd2] bg-white hover:border-emerald-300'}`}><input type="checkbox" checked={checked} onChange={event => setGroupForm(current => ({ ...current, funcionarioIds: event.target.checked ? [...safeIds(current.funcionarioIds), employee.id] : safeIds(current.funcionarioIds).filter(id => id !== employee.id) }))} className="h-4 w-4 accent-emerald-700" /><div className="min-w-0"><p className="truncate text-sm font-bold text-[#101a22]">{employee.nome}</p><p className="truncate text-xs text-[#65716b]">{employee.cargo}{employee.matricula ? ` · ${employee.matricula}` : ''}</p></div></label>; })}</div>
            </div>
            {feedback && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{feedback}</p>}
            <div className="sticky bottom-0 mt-6 flex gap-3 border-t border-[#e4e0d6] bg-[#fffefa] pt-4"><button type="button" onClick={() => setIsGroupEditorOpen(false)} className={`${SECONDARY_BUTTON} flex-1`}>Cancelar</button><button type="button" onClick={saveGroup} className={`${PRIMARY_BUTTON} flex-1`}><CheckCircle2 className="h-4 w-4" /> Salvar equipe</button></div>
          </div>
        </div>
      )}

      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#101a22]/55 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label="Atualizar presença">
          <div className="w-full max-w-lg rounded-t-[1.75rem] bg-[#fffefa] p-5  sm:rounded-[1.75rem] sm:p-7">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-800">Registro auditável</p><h2 className="mt-1 text-2xl font-black text-[#101a22]">Atualizar presença</h2><p className="mt-1 text-sm text-[#65716b]">{editingRecord.funcionarioNome} · {editingRecord.grupoNome}</p></div><button type="button" onClick={() => setEditingRecord(null)} className="rounded-xl border border-[#ddd9cd] p-2.5 text-[#65716b]"><X className="h-5 w-5" /></button></div>
            <div className="mt-6 space-y-4"><label><span className="mb-1.5 block text-xs font-bold text-[#53605a]">Status</span><select value={editStatus} onChange={event => setEditStatus(event.target.value as PresencaStatus)} className={FIELD}>{STATUS_OPTIONS.map(status => <option key={status}>{status}</option>)}</select></label><label><span className="mb-1.5 block text-xs font-bold text-[#53605a]">Observação</span><textarea value={editObservation} onChange={event => setEditObservation(event.target.value)} rows={3} className={`${FIELD} py-3`} /></label><label><span className="mb-1.5 block text-xs font-bold text-[#53605a]">Motivo obrigatório</span><textarea value={editReason} onChange={event => setEditReason(event.target.value)} rows={3} className={`${FIELD} py-3`} /></label></div>
            <div className="mt-6 flex gap-3"><button type="button" onClick={() => setEditingRecord(null)} className={`${SECONDARY_BUTTON} flex-1`}>Cancelar</button><button type="button" onClick={saveRecordEdit} disabled={!editReason.trim()} className={`${PRIMARY_BUTTON} flex-1`}><CheckCircle2 className="h-4 w-4" /> Salvar</button></div>
          </div>
        </div>
      )}

      <div className="fixed inset-x-3 bottom-[calc(.75rem+env(safe-area-inset-bottom))] z-30 grid grid-cols-4 gap-1 rounded-lg border border-[#d8d4c8] bg-[#fffefa]/95 p-1.5  backdrop-blur lg:hidden">
        {navItems.map(item => { const Icon = item.icon; const active = view === item.id; return <button key={item.id} type="button" onClick={() => setView(item.id)} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold ${active ? 'bg-[#14231e] text-white' : 'text-[#65716b]'}`}><Icon className="h-4 w-4" />{item.label}</button>; })}
      </div>

      <ConfirmDialog
        open={confirmandoInativacao}
        tone="warning"
        title={`Inativar ${selectedRecordIds.length} registro(s) de presença?`}
        description="Os apontamentos saem das telas e dos relatórios, mas continuam guardados e podem voltar."
        confirmLabel="Inativar"
        onConfirm={confirmarInativacaoRegistros}
        onCancel={() => setConfirmandoInativacao(false)}
      />
      <ConfirmDialog
        open={confirmandoLinkGeral}
        tone="warning"
        title="Renovar o link geral?"
        description="O endereço atual deixa de funcionar na hora. Quem já tem o link antigo salvo no celular precisará receber o novo."
        confirmLabel="Renovar"
        onConfirm={() => {
          const host = activeGroups.find(group => group.tokenGeral) || activeGroups[0];
          if (host) trocarLinkGeral(host);
        }}
        onCancel={() => setConfirmandoLinkGeral(false)}
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
        const conferidos = pessoas.filter(pessoa => situacoesLancadas[pessoa.id]?.status).length;

        return (
          <Modal
            open
            size="lg"
            title={`Lançar presença · ${grupo.nome}`}
            onClose={() => setLancamento(null)}
            footer={(
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-bold text-[#65716b]">
                  {conferidos} de {pessoas.length} conferido(s)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLancamento(null)}
                    className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={conferidos === 0}
                    onClick={() => {
                      onLancarPresencaManual(
                        grupo,
                        lancamento.data,
                        Object.values(situacoesLancadas).filter(item => item.status),
                        lancamento.observacaoDia,
                      );
                      setFeedback(`Presença de ${grupo.nome} lançada pelo painel.`);
                      setLancamento(null);
                    }}
                    className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    Lançar presença
                  </button>
                </div>
              </div>
            )}
          >
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Dia</span>
                  <input
                    type="date"
                    max={today}
                    value={lancamento.data}
                    onChange={event => setLancamento(atual => atual && { ...atual, data: event.target.value })}
                    className={FIELD}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Observação do dia</span>
                  <input
                    value={lancamento.observacaoDia}
                    onChange={event => setLancamento(atual => atual && { ...atual, observacaoDia: event.target.value })}
                    placeholder="Chuva, parada de frente…"
                    className={FIELD}
                  />
                </label>
              </div>

              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">
                O lançamento fica marcado como feito pelo painel, com o seu nome. Relançar o mesmo dia
                corrige as situações escolhidas e não duplica ninguém.
              </p>

              <ul className="space-y-2">
                {pessoas.map(pessoa => {
                  const atual = situacoesLancadas[pessoa.id]?.status;
                  return (
                    <li key={pessoa.id} className="rounded-lg border border-[#e2e8e4] p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <strong className="text-sm font-bold text-[#101a22]">{pessoa.nome}</strong>
                        <span className="text-[11px] text-[#65716b]">{pessoa.cargo}{pessoa.matricula ? ` · Mat. ${pessoa.matricula}` : ''}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {STATUS_OPTIONS.map(status => (
                          <button
                            key={status}
                            type="button"
                            aria-pressed={atual === status}
                            onClick={() => setSituacoesLancadas(atuais => ({
                              ...atuais,
                              [pessoa.id]: { funcionarioId: pessoa.id, status, observacao: atuais[pessoa.id]?.observacao },
                            }))}
                            className={`min-h-10 rounded-lg border px-3 text-xs font-bold transition ${
                              atual === status
                                ? 'border-emerald-700 bg-emerald-700 text-white'
                                : 'border-[#e2e8e4] bg-white text-[#65716b] hover:border-emerald-700'
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Modal>
        );
      })()}
    </section>
  );
}
