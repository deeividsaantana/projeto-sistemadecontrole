/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react';import { migrarEfetivoObra3 } from './utils/migracaoEfetivoObra3';

import { RouteMotion, isoDay } from './shared/ui';
import { 
  Empresa, 
  ObraLocal, 
  Equipamento, 
  VinculoOperadorEquipamento,
  Funcionario, 
  FuncionarioDisponivel,
  Comboio,
  Canteiro,
  TipoCombustivel,
  ProdutoLubrificacao, 
  EtapaServico, 
  Abastecimento, 
  Lubrificacao, 
  HistoryLog,
  ListaPresenca,
  OrdemServico,
  ChecklistEquipamento,
  ApontamentoOperacional,
  RegistroDDS,
  Material,
  FrenteServico,
  DiarioObra,
  ServicoObra,
  RegistroProducao,
  PlanejamentoItem,
  PrevistoMaterial,
  RotinaDiaria,
  PendenciaRotina,
  ModeloRotina,
  ModeloFvs,
  FichaVerificacaoServico,
  Inspecao,
  NaoConformidade,
  Medicao,
  DocumentoArquivo,
  Ocorrencia,
  LancamentoCusto,
  OrcamentoItem,
  MovimentoMaterial,
  Treinamento,
  ModeloChecklist,
  GrupoEquipe,
  PresencaApontamento,
  PresencaStatus,
  HistoricoPresenca,
  TicketJazida,
  ControleEquipamentoDiario,
  PeriodoArquivado,
  ControleEstacas
} from './types';

import { 
  INITIAL_EMPRESAS, 
  INITIAL_OBRAS, 
  INITIAL_EQUIPAMENTOS, 
  INITIAL_FUNCIONARIOS, 
  INITIAL_COMBOIOS,
  INITIAL_CANTEIROS,
  INITIAL_TIPOS_COMBUSTIVEL,
  INITIAL_PRODUTOS_LUBRIFICACAO, 
  INITIAL_ETAPAS_SERVICO, 
  INITIAL_ABASTECIMENTOS, 
  INITIAL_LUBRIFICACOES,
  INITIAL_PRESENCAS,
  INITIAL_ORDENS_SERVICO,
  INITIAL_GRUPOS_EQUIPES,
  INITIAL_FRENTES_SERVICO,
  INITIAL_PRESENCAS_LINK,
  INITIAL_HISTORICO_PRESENCAS,
  INITIAL_TICKETS_JAZIDA,
  hydrateInitialOperationalSeedData,
} from './utils/initialData';
import { registrosComCanteiroRenomeado } from './utils/frenteServico';
import { INITIAL_CONTROLE_ESTACAS } from './utils/initialEstacasData';
import { INITIAL_CONTROLE_EQUIPAMENTOS_DIARIO } from './utils/initialControleEquipamentosDiario';
import { OPERATIONAL_DRIVERS } from './fleet/operationalDrivers';
import { juntarComLancamentoDoDia } from './fleet/duplicidadeDiaria';
import { aplicarCadastroSge, type PreviaCadastroSge } from './fleet/sgeApontamentos';
import { enqueueOfflineCommand, flushOfflineCommands } from './utils/offlineQueue';
import { useOfflineQueueCount } from './hooks/useOfflineQueue';
import {
  inferFleetCategory,
  normalizeAvailabilityTarget,
} from './utils/equipmentOperations';
import { filterNovelFuelImports } from './utils/fuelImportIdentity';
import type { FuelImportedMasterData } from './utils/fuelMasterDataImport';
import { mergeImportedRecords } from './utils/importMerge';
import { garantirOrdemAutomaticaDaFrota, liberarMaquinasDaOrdemConcluida, reconciliarHistoricoManutencaoDaFrota } from './utils/manutencao';
import {
  LOCAL_FUEL_RESET_STORAGE_KEY,
  LOCAL_FUEL_RESET_VERSION,
  shouldResetLocalFuel,
} from './utils/localFuelReset';
import type { SecaoMateriais } from './components/materiais/MateriaisSecoes';
import type { DestinoRelatorio } from './components/RelatoriosTab';

// Subcomponents Imports
import Dashboard from './components/Dashboard';
const CadastrosTab = lazy(() => import('./components/CadastrosTab'));
const LancamentosTab = lazy(() => import('./components/LancamentosTab'));
const ControlePresencaTab = lazy(() => import('./components/ControlePresencaTab'));
const TicketsJazidaTab = lazy(() => import('./components/TicketsJazidaTab'));
const PresencaTempoRealPublica = lazy(() => import('./components/PresencaTempoRealPublica'));
const TicketLinkExterno = lazy(() => import('./components/TicketLinkExterno'));
const ControleEquipamentosDiarioTab = lazy(() => import('./components/ControleEquipamentosDiarioTab'));
const QuadroFrota = lazy(() => import('./components/quadroFrota/QuadroFrota'));
const ManutencaoTab = lazy(() => import('./components/ManutencaoTab'));
const ColaboradoresTab = lazy(() => import('./components/ColaboradoresTab'));
const MateriaisTab = lazy(() => import('./components/MateriaisTab'));
const MeuDiaTab = lazy(() => import('./components/MeuDiaTab'));
const DiarioObraTab = lazy(() => import('./components/DiarioObraTab'));
const PlanejamentoTab = lazy(() => import('./components/PlanejamentoTab'));
const RelatoriosTab = lazy(() => import('./components/RelatoriosTab'));
const AdministracaoTab = lazy(() => import('./components/AdministracaoTab'));
const EstacasTab = lazy(() => import('./components/EstacasTab'));
import OfflineStatusV29 from './components/OfflineStatusV29';

// A base histórica de materiais fica em um chunk separado para não pesar no
// login e nas demais telas. Ela é carregada antes da hidratação dos dados.
// Motion and Logo Import
import reneaLogo from './assets/images/logo-renea-transparent.png';
import reneaLogoWhite from './assets/images/logo-renea-branco.png';

// Supabase is authoritative for authentication and synchronization.
const db = undefined;
import { supabaseAuth as auth, type SupabaseAuthUser as User } from './auth/supabaseAuth';
import { loadSupabaseMemberships } from './supabase/memberships';
import {
  downloadCloudBackup,
  formatCloudSyncError,
  getCloudConnectionStatus,
  readKnownCloudSignatures,
  uploadCloudBackup,
  type CloudData,
} from './cloud/cloudSyncGateway';
import {
  deletePublicTicket,
  subscribePublicTickets,
  reservePublicTicketNumber,
  reservePublicTicketNumbers,
  savePublicTicket,
} from './supabase/tickets';
import {
  markPublicSubmissionsProcessed,
  subscribePendingMaterialUses,
  subscribePendingPublicSubmissions,
  type PublicSubmission,
} from './supabase/submissions';
import { mergeMaterialUseMovements, movementsFromMaterialUse, type MaterialUseSubmission } from './modules/materials/materialFieldUse';
import { fetchAllPresenceSubmissions } from './supabase/submissionRecovery';
import { juntarPresencaBaixada, presenceBusinessKey, presencasFaltantes, resumoRecuperadas } from './utils/presencaRecuperacao';
import { captureCloudBaseline, mergeCloudTable, normalizeCloudBaseline, type CloudBaseline } from './cloudMerge';
import { apagarDeVez, aplicarExclusoes, criarExclusao, restaurarExclusao, type ExclusaoRegistro } from './cloud/exclusoes';
import { protegerContraEncolhimento } from './cloud/protecaoEncolhimento';
import { manterNovidadesLocais } from './cloud/novidadesLocais';
import { manterEdicoesLocais } from './cloud/edicoesLocais';
import {
  addPublicPresenceMember,
  resetPresenceDay,
  removePublicPresenceMember,
  updatePublicPresenceDayNote,
  loadPublicPresenceConfig,
  reservePublicTicketNumberViaApi,
  savePublicTicketViaApi,
  searchPendingPublicTickets,
  submitPublicPresence,
  updatePublicPresenceRecord,
  validatePublicTicketAccess,
} from './publicApi';
import { enrichFuelDataset } from './utils/fuelOperations';
import { estabilizarLinksPublicos } from './utils/publicLinkSecurity';
import { estaAtivo, inativar, reativar, somenteAtivos } from './utils/inativacao';
import { aplicarPresencaManual, montarPresencaManual, type SituacaoLancada } from './utils/presencaManual';
import { aplicarSituacao, descreverMudanca, type MudancaDeSituacao } from './utils/situacaoColaborador';
import {
  normalizePresenceLists,
  normalizeRuntimeCollection,
  normalizeStakeControl,
  normalizeTeamGroups,
} from './utils/runtimeDataSafety';
import { commitStorageBatch, isStorageQuotaExceededError } from './utils/resilientStorage';
import { retirarPendentesDaReserva } from './utils/reservaArmazenamento';
import { parseStoredJson, readStoredFlag, writeStorageValue, writeStoredFlag } from './data/localStore';
import { MODELO_CHECKLIST_PADRAO } from './utils/checklist';
import { STORAGE_KEYS } from './data/storageKeys';
import { describeInvalidBackup, validateSystemBackup } from './utils/systemBackup';
import type { MasterWorkbookReviewRow } from './masterData/masterWorkbook';
import { validateCentralRecord } from './masterData/centralRegistry';
import { inactivateEmpresa, inactivateEquipamento, inactivateFuncionario, normalizeEmpresa, normalizeFuncionario, saveRegistryItem } from './masterData/registryCommands';
import { removerEquipamentosDoQuadro } from './modules/frota/quadroFrota';
import { rotuloAbastecimento } from './modules/frota/lixeiraCombustivel';
import { usosDoCadastro } from './masterData/registryDependencies';
import { mergeEmpresaImport, mergeEquipamentoImport, mergeFuncionarioImport } from './masterData/registryImportMerge';
import { TIPOS_POR_CATEGORIA_EMPRESA, categoriaCadastro, isCategoriaEmpresa, type CadastroCategoriaId } from './utils/cadastrosCategorias';
import { appendMovement, applyMaterialImport, saveMaterial } from './modules/materials/materialCommands';
import { desfazerNotasRepetidas } from './modules/materials/notaDuplicada';
import { ticketsRepetidosParaExcluir } from './utils/ticketDuplicateDetection';
import { recordTabUsage } from './usageTelemetry';
import {
  ALL_NAVIGATION_ITEMS,
  SIDEBAR_NAVIGATION_GROUPS,
  ROLE_ACCESS,
  destinoDaAba,
  roleFromMembership,
  type UserRole,
} from './app/navigation/navigation';
import { NavigationMenu } from './app/shell/NavigationMenu';
import { DesktopTopBar } from './app/shell/DesktopTopBar';
import { NotificationCenter } from './app/shell/NotificationCenter';
import { PesquisaGlobal } from './app/shell/PesquisaGlobal';
import { alertasDoSistema } from './utils/alertas';
import { pode } from './utils/permissoes';
import {
  alertasVisiveis,
  carregarPreferencias,
  type PreferenciasNotificacao,
} from './utils/notificacoes';
import { DesktopSidebar } from './app/shell/DesktopSidebar';
import { APP_VERSION_LABEL } from './app/version';
import {
  getPresenceTokenFromUrl,
  getTicketAccessTokenFromUrl,
  isTicketLinkUrl,
} from './app/routing/publicRoutes';
import { ScreenLoadingFallback } from './shared/components/feedback/ScreenLoadingFallback';
import { ToastViewport } from './shared/components/feedback/ToastViewport';
import { AuthLoadingScreen, LoginScreen } from './auth/LoginScreen';
import {
  getLoginErrorMessage,
  normalizeLoginEmail,
  sendPasswordRecoveryEmail,
  signInWithCorporateEmail,
  signOutCurrentUser,
} from './auth/authService';
import {
  recordSessionActivity,
  SESSION_ACTIVITY_EVENTS,
  SESSION_INACTIVITY_MS,
} from './auth/sessionActivity';
import {
  createNotification,
  getInitialNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  persistNotifications,
  prependNotifications,
  type NotificationSource,
  type NotificationType,
} from './notifications/notificationService';

// Icons Import
import {
  Menu,
  X,
  LogOut,
  FolderPlus,
  Search,
} from 'lucide-react';

import { AppNotification } from './types';

type CadastroImportTarget = CadastroCategoriaId;
type CadastroImportRow = Record<string, string>;

const normalizeImportText = (value: string = '') =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const getImportValue = (row: CadastroImportRow, aliases: string[]) => {
  const lookup = Object.entries(row).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[normalizeImportText(key)] = String(value || '').trim();
    return acc;
  }, {});
  for (const alias of aliases) {
    const value = lookup[normalizeImportText(alias)];
    if (value) return value;
  }
  return '';
};

const numberFromImport = (value: string) => {
  const cleaned = String(value || '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mergeSeedRecords = <T,>(current: T[], seed: T[], getKey: (item: T) => string) => {
  const keys = new Set(current.map(item => getKey(item)).filter(Boolean));
  const next = [...current];
  seed.forEach(item => {
    const key = getKey(item);
    if (!key || keys.has(key)) return;
    keys.add(key);
    next.push(item);
  });
  return next;
};

const mergeSeedRecordsPreferSeed = <T,>(current: T[], seed: T[], getKey: (item: T) => string) => {
  const seedByKey = new Map(seed.map(item => [getKey(item), item]));
  const next = current.map(item => {
    const seedItem = seedByKey.get(getKey(item));
    if (seedItem && getKey(item).startsWith('CA')) {
      return item;
    }
    return seedItem ?? item;
  });
  const currentKeys = new Set(current.map(getKey));
  seed.forEach(item => {
    if (!currentKeys.has(getKey(item))) next.push(item);
  });
  return next;
};

const mergeTicketCollections = (current: TicketJazida[], incoming: TicketJazida[]) => {
  const indexed = new Map(current.map(item => [item.id, item]));
  incoming.forEach(item => indexed.set(item.id, item));
  return Array.from(indexed.values());
};

const mergeRecordsById = <T extends { id: string }>(current: T[], incoming: T[]): T[] => {
  const indexed = new Map(current.map(item => [item.id, item]));
  incoming.forEach(item => indexed.set(item.id, item));
  return Array.from(indexed.values());
};

/**
 * De qual chave local sai cada tabela do retrato da nuvem. Fica em um só
 * lugar porque duas rotinas dependem dela: gravar o que foi baixado e montar
 * a base de comparação usada para não desfazer exclusões na mesclagem.
 */
const CLOUD_STORAGE_KEYS: Array<[string, string]> = [
  ['empresas', 'renea_empresas'],
  ['obras', 'renea_obras'],
  ['equipamentos', 'renea_equipamentos'],
  ['funcionarios', 'renea_funcionarios'],
  ['motoristasOperacionais', STORAGE_KEYS.motoristasOperacionais],
  ['comboios', 'renea_comboios'],
  ['canteiros', 'renea_canteiros'],
  ['combustiveis', 'renea_combustiveis'],
  ['lubrificantes', 'renea_lubrificantes'],
  ['etapas', 'renea_etapas'],
  ['abastecimentos', 'renea_abastecimentos'],
  ['lubrificacoes', 'renea_lubrificacoes'],
  ['ticketsJazida', 'renea_tickets_jazida'],
  ['listasPresenca', 'renea_listas_presenca'],
  ['ordensServico', 'renea_ordens_servico'],
  ['gruposEquipe', 'renea_grupos_equipes'],
  ['presencasLink', 'renea_presencas_link'],
  ['historicoPresencas', 'renea_historico_presencas'],
  ['controleEquipamentosDiario', 'renea_controle_equipamentos_diario'],
  ['checklists', STORAGE_KEYS.checklists],
  ['apontamentosOperacionais', STORAGE_KEYS.apontamentosOperacionais],
  ['registrosDds', STORAGE_KEYS.registrosDds],
  ['treinamentos', STORAGE_KEYS.treinamentos],
  ['materiaisCadastro', STORAGE_KEYS.materiaisCadastro],
  ['materiaisMovimentos', STORAGE_KEYS.materiaisMovimentos],
  ['materiaisPrevistos', STORAGE_KEYS.materiaisPrevistos],
  ['rotinasDiarias', STORAGE_KEYS.rotinasDiarias],
  ['pendenciasRotina', STORAGE_KEYS.pendenciasRotina],
  ['modelosRotina', STORAGE_KEYS.modelosRotina],
  ['frentesServico', STORAGE_KEYS.frentesServico],
  ['diariosObra', STORAGE_KEYS.diariosObra],
  ['servicosObra', STORAGE_KEYS.servicosObra],
  ['producaoRegistros', STORAGE_KEYS.producaoRegistros],
  ['planejamentoItens', STORAGE_KEYS.planejamentoItens],
  ['modelosFvs', STORAGE_KEYS.modelosFvs],
  ['fichasFvs', STORAGE_KEYS.fichasFvs],
  ['inspecoes', STORAGE_KEYS.inspecoes],
  ['naoConformidades', STORAGE_KEYS.naoConformidades],
  ['medicoes', STORAGE_KEYS.medicoes],
  ['documentos', STORAGE_KEYS.documentos],
  ['ocorrencias', STORAGE_KEYS.ocorrencias],
  ['lancamentosCusto', STORAGE_KEYS.lancamentosCusto],
  ['orcamentoItens', STORAGE_KEYS.orcamentoItens],
  ['modelosChecklist', STORAGE_KEYS.modelosChecklist],
  ['periodosArquivados', 'renea_periodos_arquivados'],
  ['masterDataReviewQueue', 'renea_master_data_review_queue'],
  ['notifications', 'renea_notifications'],
  ['historyLogs', 'renea_history_logs'],
  ['exclusoes', STORAGE_KEYS.exclusoes],
];

/**
 * Monta a base a partir do que já está salvo neste aparelho. Só faz sentido
 * chamar quando se sabe que o local está igual à nuvem — é aí que o retrato
 * local vale como referência do que existia antes das próximas alterações.
 */
const captureBaselineFromLocalStorage = (): CloudBaseline => {
  const snapshot: Record<string, unknown> = {};
  for (const [cloudKey, storageKey] of CLOUD_STORAGE_KEYS) {
    snapshot[cloudKey] = parseStoredJson(localStorage.getItem(storageKey), storageKey, [] as unknown[]);
  }
  return captureCloudBaseline(snapshot);
};

/** Só as tabelas que este aparelho realmente tem salvas, sem cair na semente. */
const readStoredCloudTables = (): Record<string, unknown> => {
  const snapshot: Record<string, unknown> = {};
  for (const [cloudKey, storageKey] of CLOUD_STORAGE_KEYS) {
    if (localStorage.getItem(storageKey) === null) continue;
    snapshot[cloudKey] = parseStoredJson(localStorage.getItem(storageKey), storageKey, [] as unknown[]);
  }
  return snapshot;
};

const readPersistedCloudBaseline = (): CloudBaseline | undefined => {
  if (typeof localStorage === 'undefined') return undefined;
  const raw = localStorage.getItem(STORAGE_KEYS.cloudBaseline);
  if (!raw) return undefined;
  try {
    return normalizeCloudBaseline(JSON.parse(raw));
  } catch {
    return undefined;
  }
};

const persistCloudBaseline = (baseline: CloudBaseline) => {
  writeStorageValue(localStorage, STORAGE_KEYS.cloudBaseline, JSON.stringify(baseline));
};

/** Intervalo mínimo entre duas checagens de nuvem, para não pagar uma leitura por clique. */
const SYNC_CHECK_MIN_INTERVAL_MS = 15_000;
/**
 * Rede de segurança para quando o ouvinte em tempo real cai sem avisar. Com
 * as checagens ao trocar de tela, voltar à aba e reconectar, este pulso não
 * precisa ser frequente — a cada minuto só gerava leitura cobrada à toa.
 */
const SYNC_FALLBACK_INTERVAL_MS = 5 * 60_000;

/** Marca o navegador que ainda não baixou a nuvem nenhuma vez. */
const AGUARDANDO_PRIMEIRO_DOWNLOAD = 'renea_aguardando_primeiro_download';

const mergePresenceRecords = (current: PresencaApontamento[], incoming: PresencaApontamento[]) => {
  const indexed = new Map(current.map(item => [presenceBusinessKey(item), item]));
  incoming.forEach(item => indexed.set(presenceBusinessKey(item), item));
  return Array.from(indexed.values());
};

const getInitialTabFromUrl = () => {
  if (typeof window === 'undefined') return 'dashboard';
  const params = new URLSearchParams(window.location.search);
  if (params.get('lista') === '1' || params.get('lista') === 'true') return 'lancamentos';
  return params.get('tab') || params.get('aba') || 'dashboard';
};

const getCombustivelViewFromUrl = (): 'novo' | 'historico' | undefined => {
  if (typeof window === 'undefined') return undefined;
  const view = new URLSearchParams(window.location.search).get('combustivel');
  if (view === 'novo') return 'novo';
  // Endereços antigos (resumo, relatório, por máquina) caem na lista.
  return view ? 'historico' : undefined;
};

const isCombustivelListOnlyUrl = () => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('lista') === '1' || params.get('lista') === 'true';
};

export default function App() {
  // Login State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('admin');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [loginNotice, setLoginNotice] = useState<string>('');
  const activeUserName = currentUser?.displayName || currentUser?.email || 'Usuário RENEA';

  // Notification and Toast States
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeToasts, setActiveToasts] = useState<AppNotification[]>([]);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState<boolean>(false);

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>(() => getInitialTabFromUrl());
  const combustivelUrlView = getCombustivelViewFromUrl();
  const combustivelListaSomente = isCombustivelListOnlyUrl();
  const combustivelViewInicial = combustivelListaSomente ? 'historico' : combustivelUrlView;
  // A aba fica no endereço (?tab=): o F5 reabre a mesma tela e o voltar do
  // navegador ou do Android volta para a tela anterior em vez de sair do app
  // (M9). Roda antes do efeito do Combustível abaixo, que lê o mesmo endereço.
  const abaJaNoEndereco = useRef(false);
  useEffect(() => {
    if (!isLoggedIn || isTicketLinkUrl() || getPresenceTokenFromUrl()) return;
    const url = new URL(window.location.href);
    const anterior = url.searchParams.get('tab');
    if (activeTab !== 'lancamentos') {
      url.searchParams.delete('combustivel');
      url.searchParams.delete('lista');
    }
    url.searchParams.delete('aba');
    url.searchParams.set('tab', activeTab);
    const primeira = !abaJaNoEndereco.current;
    abaJaNoEndereco.current = true;
    if (url.href === window.location.href) return;
    // A primeira tela e a troca forçada pelo perfil não viram um passo do voltar.
    const substituir = primeira || !anterior || !ROLE_ACCESS[currentUserRole].includes(anterior);
    window.history[substituir ? 'replaceState' : 'pushState'](null, '', url);
  }, [activeTab, isLoggedIn, currentUserRole]);
  useEffect(() => {
    const voltar = () => setActiveTab(getInitialTabFromUrl());
    window.addEventListener('popstate', voltar);
    return () => window.removeEventListener('popstate', voltar);
  }, []);
  useEffect(() => {
    const targetTab = getInitialTabFromUrl();
    if (targetTab !== activeTab && (getCombustivelViewFromUrl() || isCombustivelListOnlyUrl())) {
      setActiveTab(targetTab);
    }
  }, [activeTab]);
  // Parte de Materiais pedida por outro lugar (aviso, busca); a vez remonta a tela na parte certa.
  const [materiaisPedido, setMateriaisPedido] = useState<{ secao?: SecaoMateriais; vez: number }>({ vez: 0 });
  /** Aba aberta pela aba Relatórios: ela já entra na parte de relatório. */
  const [relatorioPedido, setRelatorioPedido] = useState<DestinoRelatorio | ''>('');
  // Recorte de datas do painel. Fica aqui, e não dentro do Dashboard, porque
  // o controle é renderizado na barra superior, ao lado do estado da nuvem.
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [menuSearch, setMenuSearch] = useState<string>('');
  const [pesquisaAberta, setPesquisaAberta] = useState(false);
  // Preferência de notificação é do dispositivo: fica no navegador e não sobe
  // para a nuvem, senão silenciar no celular apagaria o alerta do gestor.
  const [preferenciasNotificacao] = useState<PreferenciasNotificacao>(
    () => typeof localStorage === 'undefined' ? { categoriasSilenciadas: [], mostrarSistema: true } : carregarPreferencias(localStorage),
  );

  // Estado do provedor de nuvem ativo. O gateway usa somente Supabase e
  // o período de dual-write fora dos componentes operacionais.
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(false);
  // Evita repetir o mesmo aviso de falha de sincronização a cada salvamento
  // enquanto a causa não muda (ex.: ficar sem internet por vários lançamentos).
  const lastSyncFailureRef = useRef<{ message: string; at: number }>({ message: '', at: 0 });
  const presenceIngestFailureRef = useRef<{ message: string; at: number }>({ message: '', at: 0 });
  const presenceSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  // Conta envios ao Supabase em andamento. Um download que caia bem no meio
  // desse intervalo (por exemplo, ao voltar o foco na aba logo depois de
  // salvar algo) leria a nuvem antes do envio terminar de publicá-la, e
  // sobrescreveria o lançamento que acabou de ser feito com a versão antiga.
  const uploadsInFlightRef = useRef(0);
  const isCheckingSyncRef = useRef(false);
  const lastSyncCheckAtRef = useRef(0);
  const automaticDownloadInFlightRef = useRef(false);
  const pendingRemoteVersionRef = useRef('');
  const publicTicketIdsRef = useRef<Set<string>>(new Set());
  const requestAutomaticRemoteSyncRef = useRef<(updatedAt: string) => void>(() => undefined);
  const currentUserRoleRef = useRef<UserRole>('admin');
  // Ids por tabela da última sincronização concluída neste aparelho. A base é
  // persistida: sem ela, recarregar a página apagava a memória da exclusão e a
  // mesclagem seguinte trazia o registro remoto de volta.
  const cloudBaselineRef = useRef<CloudBaseline | undefined>(readPersistedCloudBaseline());
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState<boolean>(true);
  const [lastCloudSync, setLastCloudSync] = useState<string>('');
  currentUserRoleRef.current = currentUserRole;
  // Quantos envios do link público de presença já estão no Supabase, pendentes
  // de entrar neste retrato local. Serve só de diagnóstico visível: se ficar
  // preso em um número maior que zero, o processamento em tempo real travou.
  const [pendingPublicSubmissionsCount, setPendingPublicSubmissionsCount] = useState(0);

  const acquirePresenceSync = async (): Promise<() => void> => {
    const previous = presenceSyncQueueRef.current;
    let release = () => undefined;
    presenceSyncQueueRef.current = new Promise<void>(resolve => { release = resolve; });
    await previous;
    return release;
  };

  // Database States
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [obras, setObras] = useState<ObraLocal[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [motoristasOperacionais, setMotoristasOperacionais] = useState<Funcionario[]>([...OPERATIONAL_DRIVERS]);
  const [comboios, setComboios] = useState<Comboio[]>([]);
  const [canteiros, setCanteiros] = useState<Canteiro[]>([]);
  const [combustiveis, setCombustiveis] = useState<TipoCombustivel[]>([]);
  const [lubrificantes, setLubrificantes] = useState<ProdutoLubrificacao[]>([]);
  const [etapas, setEtapas] = useState<EtapaServico[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [lubrificacoes, setLubrificacoes] = useState<Lubrificacao[]>([]);
  const [ticketsJazida, setTicketsJazida] = useState<TicketJazida[]>([]);
  const [externalPublicTickets, setExternalPublicTickets] = useState<TicketJazida[]>([]);
  const [listasPresenca, setListasPresenca] = useState<ListaPresenca[]>([]);
  const [ordensServico, setOrdensServico] = useState<OrdemServico[]>([]);
  const [checklists, setChecklists] = useState<ChecklistEquipamento[]>([]);
  const [apontamentosOperacionais, setApontamentosOperacionais] = useState<ApontamentoOperacional[]>([]);
  const [registrosDds, setRegistrosDds] = useState<RegistroDDS[]>([]);
  const [treinamentos, setTreinamentos] = useState<Treinamento[]>([]);
  const [materiaisCadastro, setMateriaisCadastro] = useState<Material[]>([]);
  const [materiaisMovimentos, setMateriaisMovimentos] = useState<MovimentoMaterial[]>([]);
  // Lançamento desfeito continua guardado para o histórico, mas nenhuma outra
  // tela soma ele: só a aba Materiais mostra o registro, marcado como desfeito.
  const materiaisMovimentosVigentes = useMemo(() => materiaisMovimentos.filter(item => !item.canceladoEm), [materiaisMovimentos]);
  const [materiaisPrevistos, setMateriaisPrevistos] = useState<PrevistoMaterial[]>([]);
  const [rotinasDiarias, setRotinasDiarias] = useState<RotinaDiaria[]>([]);
  const [pendenciasRotina, setPendenciasRotina] = useState<PendenciaRotina[]>([]);
  const [modelosRotina, setModelosRotina] = useState<ModeloRotina[]>([]);
  const [frentesServico, setFrentesServico] = useState<FrenteServico[]>([]);
  const [diariosObra, setDiariosObra] = useState<DiarioObra[]>([]);
  const [servicosObra, setServicosObra] = useState<ServicoObra[]>([]);
  const [producaoRegistros, setProducaoRegistros] = useState<RegistroProducao[]>([]);
  const [planejamentoItens, setPlanejamentoItens] = useState<PlanejamentoItem[]>([]);
  const [modelosFvs, setModelosFvs] = useState<ModeloFvs[]>([]);
  const [fichasFvs, setFichasFvs] = useState<FichaVerificacaoServico[]>([]);
  const [inspecoes, setInspecoes] = useState<Inspecao[]>([]);
  const [naoConformidades, setNaoConformidades] = useState<NaoConformidade[]>([]);
  const [medicoes, setMedicoes] = useState<Medicao[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoArquivo[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [lancamentosCusto, setLancamentosCusto] = useState<LancamentoCusto[]>([]);
  const [orcamentoItens, setOrcamentoItens] = useState<OrcamentoItem[]>([]);
  const [modeloChecklist, setModeloChecklist] = useState<ModeloChecklist>(MODELO_CHECKLIST_PADRAO);
  const [gruposEquipe, setGruposEquipe] = useState<GrupoEquipe[]>([]);
  const [presencasLink, setPresencasLink] = useState<PresencaApontamento[]>([]);

  // Registro inativado sai das telas e dos totais num ponto só. Filtrar aqui,
  // e não em cada tela, é o que garante que nenhuma delas fique de fora — e
  // que os cálculos continuem vendo exatamente o mesmo conjunto que viam
  // quando a exclusão era definitiva. O arquivo completo continua no estado,
  // que é o que vai para o armazenamento e para a nuvem.
  const canteirosNomes = useMemo(() => canteiros.map(item => item.nome), [canteiros]);
  const abastecimentosAtivos = useMemo(() => somenteAtivos(abastecimentos), [abastecimentos]);
  const ticketsJazidaAtivos = useMemo(() => somenteAtivos(ticketsJazida), [ticketsJazida]);
  const presencasLinkAtivas = useMemo(() => somenteAtivos(presencasLink), [presencasLink]);
  const presencasLinkInativas = useMemo(() => presencasLink.filter(item => !estaAtivo(item)), [presencasLink]);
  const [historicoPresencas, setHistoricoPresencas] = useState<HistoricoPresenca[]>([]);
  const [controleEquipamentosDiario, setControleEquipamentosDiario] = useState<ControleEquipamentoDiario[]>([]);
  const [controleEstacas, setControleEstacas] = useState<ControleEstacas>(INITIAL_CONTROLE_ESTACAS);
  const [periodosArquivados, setPeriodosArquivados] = useState<PeriodoArquivado[]>([]);
  const [vinculosOperadorEquipamento, setVinculosOperadorEquipamento] = useState<VinculoOperadorEquipamento[]>([]);
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);
  const [exclusoes, setExclusoes] = useState<ExclusaoRegistro[]>([]);
  const [isExternalPresenceLoading, setIsExternalPresenceLoading] = useState<boolean>(Boolean(getPresenceTokenFromUrl()));
  const [externalPresenceLoadError, setExternalPresenceLoadError] = useState('');
  const [externalMeuGrupo, setExternalMeuGrupo] = useState<GrupoEquipe | null>(null);
  const [externalFuncionariosDisponiveis, setExternalFuncionariosDisponiveis] = useState<FuncionarioDisponivel[]>([]);
  const [externalMeusRegistros, setExternalMeusRegistros] = useState<PresencaApontamento[]>([]);
  const [externalDatasDisponiveis, setExternalDatasDisponiveis] = useState<string[]>([]);
  const [externalDataSelecionada, setExternalDataSelecionada] = useState('');
  const [externalDataAtual, setExternalDataAtual] = useState('');
  const [externalObservacaoDia, setExternalObservacaoDia] = useState('');
  const [externalPresenceHistory, setExternalPresenceHistory] = useState<Record<string, PresencaApontamento[]>>({});
  const [externalPresenceDayNotes, setExternalPresenceDayNotes] = useState<Record<string, string>>({});
  const [isExternalTicketLoading, setIsExternalTicketLoading] = useState<boolean>(isTicketLinkUrl());
  const [externalTicketLoadError, setExternalTicketLoadError] = useState('');
  const [publicLinksRotationPending, setPublicLinksRotationPending] = useState(
    () => readStoredFlag(localStorage, STORAGE_KEYS.publicLinksRotationPendingV31),
  );
  const externalPresenceToken = getPresenceTokenFromUrl();
  const externalTicketAccessToken = getTicketAccessTokenFromUrl();
  const externalTicketLink = isTicketLinkUrl();

  useEffect(() => {
    if (!isLoggedIn || !currentUser || externalTicketLink || externalPresenceToken) return;
    const navigationItem = ALL_NAVIGATION_ITEMS.find(item => item.id === activeTab);
    if (!navigationItem) return;
    const timer = window.setTimeout(() => {
      void recordTabUsage(navigationItem.id, navigationItem.label);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [activeTab, isLoggedIn, currentUser, externalTicketLink, externalPresenceToken]);

  useEffect(() => {
    // Endereço antigo guardado (F5, favorito) abre a tela onde o dado mora hoje.
    if (isLoggedIn && !ROLE_ACCESS[currentUserRole].includes(activeTab)) {
      setActiveTab(destinoDaAba(activeTab, ROLE_ACCESS[currentUserRole]) || 'dashboard');
    }
  }, [activeTab, currentUserRole, isLoggedIn]);

  // Hydrate states from localstorage on mount
  useEffect(() => {
    let cancelled = false;
    const hydrateLocalData = async () => {
      if (externalTicketLink || externalPresenceToken) return;

      const isDataLoadedV2 = readStoredFlag(localStorage, STORAGE_KEYS.dataLoadedV2);
      // A base de exemplo (seed) só é usada na primeira carga do aparelho e na
      // migração pontual da planilha operacional (shouldMigrateSpreadsheetSeed,
      // mais abaixo). Com as duas já feitas, baixar e processar esses módulos
      // (~1,6 MB) a cada abertura do app não tinha efeito nenhum — só custava tempo.
      const needsSeedData = !isDataLoadedV2
        || !readStoredFlag(localStorage, STORAGE_KEYS.planilhasOperacionaisV2);
      if (needsSeedData) {
        try {
          await hydrateInitialOperationalSeedData();
          if (cancelled) return;
        } catch (error) {
          console.error('Falha ao carregar a base historica inicial:', error);
        }
      }

    if (!isDataLoadedV2) {
      const initialStorageEntries = [
        { key: 'renea_empresas', value: JSON.stringify(INITIAL_EMPRESAS) },
        { key: 'renea_obras', value: JSON.stringify(INITIAL_OBRAS) },
        { key: 'renea_equipamentos', value: JSON.stringify(INITIAL_EQUIPAMENTOS) },
        { key: 'renea_funcionarios', value: JSON.stringify(INITIAL_FUNCIONARIOS) },
        { key: 'renea_comboios', value: JSON.stringify(INITIAL_COMBOIOS) },
        { key: 'renea_canteiros', value: JSON.stringify(INITIAL_CANTEIROS) },
        { key: 'renea_combustiveis', value: JSON.stringify(INITIAL_TIPOS_COMBUSTIVEL) },
        { key: 'renea_lubrificantes', value: JSON.stringify(INITIAL_PRODUTOS_LUBRIFICACAO) },
        { key: 'renea_etapas', value: JSON.stringify(INITIAL_ETAPAS_SERVICO) },
        { key: 'renea_abastecimentos', value: JSON.stringify(INITIAL_ABASTECIMENTOS) },
        { key: 'renea_lubrificacoes', value: JSON.stringify(INITIAL_LUBRIFICACOES) },
        { key: 'renea_tickets_jazida', value: JSON.stringify(INITIAL_TICKETS_JAZIDA) },
        { key: 'renea_listas_presenca', value: JSON.stringify(INITIAL_PRESENCAS) },
        { key: 'renea_ordens_servico', value: JSON.stringify(INITIAL_ORDENS_SERVICO) },
        { key: 'renea_grupos_equipes', value: JSON.stringify(INITIAL_GRUPOS_EQUIPES) },
        { key: 'renea_presencas_link', value: JSON.stringify(INITIAL_PRESENCAS_LINK) },
        { key: 'renea_historico_presencas', value: JSON.stringify(INITIAL_HISTORICO_PRESENCAS) },
        { key: 'renea_controle_equipamentos_diario', value: JSON.stringify(INITIAL_CONTROLE_EQUIPAMENTOS_DIARIO) },
        { key: 'renea_controle_estacas', value: JSON.stringify(INITIAL_CONTROLE_ESTACAS) },
        { key: 'renea_periodos_arquivados', value: '[]' },
        { key: STORAGE_KEYS.frentesServico, value: JSON.stringify(INITIAL_FRENTES_SERVICO) },
        { key: 'renea_master_data_review_queue', value: '[]' },
        { key: 'renea_history_logs', value: JSON.stringify([]) },
        { key: 'renea_notifications', value: '[]' },
      ].filter(entry => localStorage.getItem(entry.key) === null);
      commitStorageBatch(localStorage, [
        ...initialStorageEntries,
        { key: 'renea_data_loaded_v2', value: 'true' },
        // Navegador sem nenhum dado (aba anônima, computador novo): o que está
        // aqui é só a semente do sistema. Nada sobe até a nuvem ser baixada.
        { key: AGUARDANDO_PRIMEIRO_DOWNLOAD, value: 'true' },
        { key: 'renea_colaboradores_planilha_v1', value: 'true' },
        { key: 'renea_planilhas_operacionais_v2', value: 'true' },
      ]);

      setEmpresas(INITIAL_EMPRESAS);
      setObras(INITIAL_OBRAS);
      setEquipamentos(INITIAL_EQUIPAMENTOS);
      setFuncionarios(INITIAL_FUNCIONARIOS);
      setMotoristasOperacionais([...OPERATIONAL_DRIVERS]);
      setComboios(INITIAL_COMBOIOS);
      setCanteiros(INITIAL_CANTEIROS);
      setCombustiveis(INITIAL_TIPOS_COMBUSTIVEL);
      setLubrificantes(INITIAL_PRODUTOS_LUBRIFICACAO);
      setEtapas(INITIAL_ETAPAS_SERVICO);
      setAbastecimentos(INITIAL_ABASTECIMENTOS);
      setLubrificacoes(INITIAL_LUBRIFICACOES);
      setTicketsJazida(INITIAL_TICKETS_JAZIDA);
      setListasPresenca(INITIAL_PRESENCAS);
      setOrdensServico(INITIAL_ORDENS_SERVICO);
      setGruposEquipe(INITIAL_GRUPOS_EQUIPES);
      setPresencasLink(INITIAL_PRESENCAS_LINK);
      setHistoricoPresencas(INITIAL_HISTORICO_PRESENCAS);
      setControleEquipamentosDiario(INITIAL_CONTROLE_EQUIPAMENTOS_DIARIO);
      setControleEstacas(INITIAL_CONTROLE_ESTACAS);
      setPeriodosArquivados([]);
      setHistoryLogs([]);
      setNotifications(getInitialNotifications());
    }
    {
      const savedEmpresas = localStorage.getItem('renea_empresas');
      const savedObras = localStorage.getItem('renea_obras');
      const savedEquipamentos = localStorage.getItem('renea_equipamentos');
      const savedFuncionarios = localStorage.getItem('renea_funcionarios');
      const savedMotoristasOperacionais = localStorage.getItem(STORAGE_KEYS.motoristasOperacionais);
      const savedComboios = localStorage.getItem('renea_comboios');
      const savedCanteiros = localStorage.getItem('renea_canteiros');
      const savedCombustiveis = localStorage.getItem('renea_combustiveis');
      const savedLubrificantes = localStorage.getItem('renea_lubrificantes');
      const savedEtapas = localStorage.getItem('renea_etapas');
      const resetLocalFuel = shouldResetLocalFuel(localStorage.getItem(LOCAL_FUEL_RESET_STORAGE_KEY));
      const savedAbastecimentos = resetLocalFuel ? '[]' : localStorage.getItem('renea_abastecimentos');
      const savedLubrificacoes = localStorage.getItem('renea_lubrificacoes');
      const savedTicketsJazida = localStorage.getItem('renea_tickets_jazida');
      const savedListasPresenca = localStorage.getItem('renea_listas_presenca');
      const savedOrdensServico = localStorage.getItem('renea_ordens_servico');
      const savedGruposEquipe = localStorage.getItem('renea_grupos_equipes');
      const savedPresencasLink = localStorage.getItem('renea_presencas_link');
      const savedHistoricoPresencas = localStorage.getItem('renea_historico_presencas');
      const savedControleEquipamentosDiario = localStorage.getItem('renea_controle_equipamentos_diario');
      const savedControleEstacas = localStorage.getItem('renea_controle_estacas');
      const savedPeriodosArquivados = localStorage.getItem('renea_periodos_arquivados');
      const savedVinculosOperadorEquipamento = localStorage.getItem('renea_vinculos_operador_equipamento');
      const savedHistory = localStorage.getItem('renea_history_logs');
      const savedNotifications = localStorage.getItem('renea_notifications');
      const shouldMigratePresencePeople = !readStoredFlag(localStorage, STORAGE_KEYS.colaboradoresPlanilhaV1);
      const shouldMigrateSpreadsheetSeed = !readStoredFlag(localStorage, STORAGE_KEYS.planilhasOperacionaisV2);
      const parsedEquipamentos = parseStoredJson(savedEquipamentos, 'renea_equipamentos', INITIAL_EQUIPAMENTOS);
      const parsedEmpresas = parseStoredJson(savedEmpresas, 'renea_empresas', INITIAL_EMPRESAS);
      const parsedComboios = parseStoredJson(savedComboios, 'renea_comboios', INITIAL_COMBOIOS);
      const parsedAbastecimentos = parseStoredJson(savedAbastecimentos, 'renea_abastecimentos', INITIAL_ABASTECIMENTOS);
      const parsedTicketsJazida = parseStoredJson(savedTicketsJazida, 'renea_tickets_jazida', INITIAL_TICKETS_JAZIDA);
      const parsedControleEstacas = normalizeStakeControl(
        parseStoredJson(savedControleEstacas, 'renea_controle_estacas', INITIAL_CONTROLE_ESTACAS),
      );
      const parsedGruposEquipe = normalizeTeamGroups(
        shouldMigratePresencePeople
          ? INITIAL_GRUPOS_EQUIPES
          : parseStoredJson(savedGruposEquipe, 'renea_grupos_equipes', INITIAL_GRUPOS_EQUIPES),
      );
      const parsedListasPresenca = normalizePresenceLists(
        shouldMigratePresencePeople
          ? INITIAL_PRESENCAS
          : parseStoredJson(savedListasPresenca, 'renea_listas_presenca', INITIAL_PRESENCAS),
      );
      // O endereço de presença que o encarregado guardou no celular não pode
      // mudar sozinho — nem em atualização do sistema, nem quando a nuvem
      // devolve o grupo. A troca dos tokens fracos herdados é feita uma vez
      // por aparelho e nunca mais; depois disso só o botão "Renovar link"
      // troca o endereço, porque aí é decisão de alguém.
      const securedPublicLinks = estabilizarLinksPublicos(
        parsedGruposEquipe,
        readStoredFlag(localStorage, STORAGE_KEYS.linksPublicosEstaveisV1),
      );
      const loadedEquipamentos = shouldMigrateSpreadsheetSeed
        ? mergeSeedRecordsPreferSeed(parsedEquipamentos, INITIAL_EQUIPAMENTOS, item => item.prefixo.trim().toLowerCase())
        : parsedEquipamentos;
      const loadedEmpresas = shouldMigrateSpreadsheetSeed
        ? mergeSeedRecords(parsedEmpresas, INITIAL_EMPRESAS, item => item.id)
        : parsedEmpresas;
      const loadedComboios = shouldMigrateSpreadsheetSeed
        ? mergeSeedRecords(parsedComboios, INITIAL_COMBOIOS, item => item.placa.trim().toLowerCase())
        : parsedComboios;
      const loadedAbastecimentos = resetLocalFuel ? [] : shouldMigrateSpreadsheetSeed
        ? mergeSeedRecords(parsedAbastecimentos, INITIAL_ABASTECIMENTOS, item => `${item.data}|${item.equipamentoId}|${item.hora}|${item.quantidadeLitros}|${item.bombaInicial}`)
        : parsedAbastecimentos;
      const loadedTicketsJazida = shouldMigrateSpreadsheetSeed
        ? mergeSeedRecords(parsedTicketsJazida, INITIAL_TICKETS_JAZIDA, item => `${item.tipoTicket || 'Liberação'}|${item.data}|${item.ticketNumero}|${item.prefixo}`)
        : parsedTicketsJazida;
      const loadedControleEstacas = shouldMigrateSpreadsheetSeed
        ? {
            lotes: mergeSeedRecords(parsedControleEstacas.lotes, INITIAL_CONTROLE_ESTACAS.lotes, item => item.id),
            cravacoes: mergeSeedRecords(parsedControleEstacas.cravacoes, INITIAL_CONTROLE_ESTACAS.cravacoes, item => item.id),
          }
        : parsedControleEstacas;
      setEmpresas(loadedEmpresas);
      setObras(parseStoredJson(savedObras, 'renea_obras', INITIAL_OBRAS));
      setEquipamentos(loadedEquipamentos);
      setFuncionarios(shouldMigratePresencePeople ? INITIAL_FUNCIONARIOS : parseStoredJson(savedFuncionarios, 'renea_funcionarios', INITIAL_FUNCIONARIOS));
      setMotoristasOperacionais(parseStoredJson(savedMotoristasOperacionais, STORAGE_KEYS.motoristasOperacionais, [...OPERATIONAL_DRIVERS]));
      setComboios(loadedComboios);
      setCanteiros(parseStoredJson(savedCanteiros, 'renea_canteiros', INITIAL_CANTEIROS));
      setCombustiveis(parseStoredJson(savedCombustiveis, 'renea_combustiveis', INITIAL_TIPOS_COMBUSTIVEL));
      setLubrificantes(parseStoredJson(savedLubrificantes, 'renea_lubrificantes', INITIAL_PRODUTOS_LUBRIFICACAO));
      setEtapas(parseStoredJson(savedEtapas, 'renea_etapas', INITIAL_ETAPAS_SERVICO));
      setAbastecimentos(loadedAbastecimentos);
      setLubrificacoes(parseStoredJson(savedLubrificacoes, 'renea_lubrificacoes', INITIAL_LUBRIFICACOES));
      setTicketsJazida(loadedTicketsJazida);
      setListasPresenca(parsedListasPresenca);
      setOrdensServico(parseStoredJson(savedOrdensServico, 'renea_ordens_servico', INITIAL_ORDENS_SERVICO));
      setChecklists(parseStoredJson(localStorage.getItem(STORAGE_KEYS.checklists), STORAGE_KEYS.checklists, [] as ChecklistEquipamento[]));
      setApontamentosOperacionais(parseStoredJson(localStorage.getItem(STORAGE_KEYS.apontamentosOperacionais), STORAGE_KEYS.apontamentosOperacionais, [] as ApontamentoOperacional[]));
      setRegistrosDds(parseStoredJson(localStorage.getItem(STORAGE_KEYS.registrosDds), STORAGE_KEYS.registrosDds, [] as RegistroDDS[]));
      setTreinamentos(parseStoredJson(localStorage.getItem(STORAGE_KEYS.treinamentos), STORAGE_KEYS.treinamentos, [] as Treinamento[]));
      setMateriaisCadastro(parseStoredJson(localStorage.getItem(STORAGE_KEYS.materiaisCadastro), STORAGE_KEYS.materiaisCadastro, [] as Material[]));
      setMateriaisMovimentos(parseStoredJson(localStorage.getItem(STORAGE_KEYS.materiaisMovimentos), STORAGE_KEYS.materiaisMovimentos, [] as MovimentoMaterial[]));
      setMateriaisPrevistos(parseStoredJson(localStorage.getItem(STORAGE_KEYS.materiaisPrevistos), STORAGE_KEYS.materiaisPrevistos, [] as PrevistoMaterial[]));
      setRotinasDiarias(parseStoredJson(localStorage.getItem(STORAGE_KEYS.rotinasDiarias), STORAGE_KEYS.rotinasDiarias, [] as RotinaDiaria[]));
      setPendenciasRotina(parseStoredJson(localStorage.getItem(STORAGE_KEYS.pendenciasRotina), STORAGE_KEYS.pendenciasRotina, [] as PendenciaRotina[]));
      setModelosRotina(parseStoredJson(localStorage.getItem(STORAGE_KEYS.modelosRotina), STORAGE_KEYS.modelosRotina, [] as ModeloRotina[]));
      setFrentesServico(parseStoredJson(localStorage.getItem(STORAGE_KEYS.frentesServico), STORAGE_KEYS.frentesServico, INITIAL_FRENTES_SERVICO));
      setDiariosObra(parseStoredJson(localStorage.getItem(STORAGE_KEYS.diariosObra), STORAGE_KEYS.diariosObra, [] as DiarioObra[]));
      setServicosObra(parseStoredJson(localStorage.getItem(STORAGE_KEYS.servicosObra), STORAGE_KEYS.servicosObra, [] as ServicoObra[]));
      setProducaoRegistros(parseStoredJson(localStorage.getItem(STORAGE_KEYS.producaoRegistros), STORAGE_KEYS.producaoRegistros, [] as RegistroProducao[]));
      setPlanejamentoItens(parseStoredJson(localStorage.getItem(STORAGE_KEYS.planejamentoItens), STORAGE_KEYS.planejamentoItens, [] as PlanejamentoItem[]));
      setModelosFvs(parseStoredJson(localStorage.getItem(STORAGE_KEYS.modelosFvs), STORAGE_KEYS.modelosFvs, [] as ModeloFvs[]));
      setFichasFvs(parseStoredJson(localStorage.getItem(STORAGE_KEYS.fichasFvs), STORAGE_KEYS.fichasFvs, [] as FichaVerificacaoServico[]));
      setInspecoes(parseStoredJson(localStorage.getItem(STORAGE_KEYS.inspecoes), STORAGE_KEYS.inspecoes, [] as Inspecao[]));
      setNaoConformidades(parseStoredJson(localStorage.getItem(STORAGE_KEYS.naoConformidades), STORAGE_KEYS.naoConformidades, [] as NaoConformidade[]));
      setMedicoes(parseStoredJson(localStorage.getItem(STORAGE_KEYS.medicoes), STORAGE_KEYS.medicoes, [] as Medicao[]));
      setDocumentos(parseStoredJson(localStorage.getItem(STORAGE_KEYS.documentos), STORAGE_KEYS.documentos, [] as DocumentoArquivo[]));
      setOcorrencias(parseStoredJson(localStorage.getItem(STORAGE_KEYS.ocorrencias), STORAGE_KEYS.ocorrencias, [] as Ocorrencia[]));
      setLancamentosCusto(parseStoredJson(localStorage.getItem(STORAGE_KEYS.lancamentosCusto), STORAGE_KEYS.lancamentosCusto, [] as LancamentoCusto[]));
      setOrcamentoItens(parseStoredJson(localStorage.getItem(STORAGE_KEYS.orcamentoItens), STORAGE_KEYS.orcamentoItens, [] as OrcamentoItem[]));
      const modelosSalvos = parseStoredJson(localStorage.getItem(STORAGE_KEYS.modelosChecklist), STORAGE_KEYS.modelosChecklist, [] as ModeloChecklist[]);
      if (modelosSalvos[0]) setModeloChecklist(modelosSalvos[0]);
      setGruposEquipe(securedPublicLinks.gruposEquipe);
      setPresencasLink(parseStoredJson(savedPresencasLink, 'renea_presencas_link', INITIAL_PRESENCAS_LINK));
      setHistoricoPresencas(parseStoredJson(savedHistoricoPresencas, 'renea_historico_presencas', INITIAL_HISTORICO_PRESENCAS));
      setControleEquipamentosDiario(parseStoredJson(savedControleEquipamentosDiario, 'renea_controle_equipamentos_diario', INITIAL_CONTROLE_EQUIPAMENTOS_DIARIO));
      setControleEstacas(loadedControleEstacas);
      setPeriodosArquivados(parseStoredJson(savedPeriodosArquivados, 'renea_periodos_arquivados', [] as PeriodoArquivado[]));
      setVinculosOperadorEquipamento(parseStoredJson(savedVinculosOperadorEquipamento, 'renea_vinculos_operador_equipamento', [] as VinculoOperadorEquipamento[]));
      setHistoryLogs(parseStoredJson(savedHistory, 'renea_history_logs', [] as HistoryLog[]));
      setExclusoes(parseStoredJson(localStorage.getItem(STORAGE_KEYS.exclusoes), STORAGE_KEYS.exclusoes, [] as ExclusaoRegistro[]));
      setNotifications(parseStoredJson(savedNotifications, 'renea_notifications', getInitialNotifications()));

      // Efetivo do EFETIVO_OBRA_3 em quem já usa o sistema. A semente acima só
      // vale no primeiro acesso do navegador; sem esta passagem, quem já tinha
      // o RENEA aberto ficaria com as equipes antigas para sempre. A função é
      // conservadora de propósito: ninguém é apagado, e o token do link
      // público de presença é preservado equipe por equipe.
      // Navegador sem dados ainda vai baixar as equipes da nuvem: rodar a
      // passagem sobre a semente criava uma equipe nova por encarregado, que
      // depois subia para a nuvem em dobro (16/10/2026). Aí só grava a marca.
      if (!readStoredFlag(localStorage, STORAGE_KEYS.efetivoObra3V1) && savedGruposEquipe === null) {
        writeStoredFlag(localStorage, STORAGE_KEYS.efetivoObra3V1, true);
      } else if (!readStoredFlag(localStorage, STORAGE_KEYS.efetivoObra3V1)) {
        const migrado = migrarEfetivoObra3(
          parseStoredJson(savedFuncionarios, 'renea_funcionarios', INITIAL_FUNCIONARIOS),
          securedPublicLinks.gruposEquipe,
          parseStoredJson(localStorage.getItem(STORAGE_KEYS.frentesServico), STORAGE_KEYS.frentesServico, [] as FrenteServico[]),
          INITIAL_FUNCIONARIOS,
          INITIAL_GRUPOS_EQUIPES,
          INITIAL_FRENTES_SERVICO,
        );
        setFuncionarios(migrado.funcionarios);
        setGruposEquipe(migrado.grupos);
        setFrentesServico(migrado.frentes);
        writeStorageValue(localStorage, 'renea_funcionarios', JSON.stringify(migrado.funcionarios));
        writeStorageValue(localStorage, 'renea_grupos_equipes', JSON.stringify(migrado.grupos));
        writeStorageValue(localStorage, STORAGE_KEYS.frentesServico, JSON.stringify(migrado.frentes));
        writeStoredFlag(localStorage, STORAGE_KEYS.efetivoObra3V1, true);
        console.info('[RENEA] Efetivo atualizado pelo EFETIVO_OBRA_3:', migrado.resumo);
      }

      if (shouldMigratePresencePeople) {
        // Grava a marca de "já migrado" no mesmo lote atômico das tabelas que
        // ela protege. Antes eram gravações separadas: se o navegador ficasse
        // sem espaço bem no fim da lista, as tabelas já tinham sido resetadas
        // mas a marca não gravava — e a próxima vez que o app abrisse repetia
        // o reset, apagando de novo qualquer presença lançada nesse meio tempo.
        try {
          commitStorageBatch(localStorage, [
            { key: 'renea_funcionarios', value: JSON.stringify(INITIAL_FUNCIONARIOS) },
            { key: 'renea_listas_presenca', value: JSON.stringify(INITIAL_PRESENCAS) },
            { key: 'renea_grupos_equipes', value: JSON.stringify(securedPublicLinks.gruposEquipe) },
            { key: 'renea_presencas_link', value: JSON.stringify(INITIAL_PRESENCAS_LINK) },
            { key: 'renea_historico_presencas', value: JSON.stringify(INITIAL_HISTORICO_PRESENCAS) },
            { key: 'renea_colaboradores_planilha_v1', value: 'true' },
          ]);
          // A gravação acima é atômica: ou a marca de "já migrado" entra junto
          // com as tabelas, ou nada muda. Como não há mais o risco de repetir
          // silenciosamente a cada abertura, isto não precisa mais alarmar
          // quem está usando — fica só no registro técnico.
          console.info('Migração única de colaboradores/presença aplicada neste aparelho.');
        } catch (error) {
          console.error('Migração de colaboradores/presença falhou; nada foi alterado neste aparelho.', error);
        }
      }
      if (securedPublicLinks.changed) {
        writeStorageValue(localStorage, 'renea_grupos_equipes', JSON.stringify(securedPublicLinks.gruposEquipe));
        writeStoredFlag(localStorage, STORAGE_KEYS.publicLinksRotationPendingV31, true);
        setPublicLinksRotationPending(true);
      }
      writeStoredFlag(localStorage, STORAGE_KEYS.linksPublicosEstaveisV1, true);
      if (!savedControleEstacas) {
        writeStorageValue(localStorage, 'renea_controle_estacas', JSON.stringify(INITIAL_CONTROLE_ESTACAS));
      }
      if (!savedPeriodosArquivados) {
        writeStorageValue(localStorage, 'renea_periodos_arquivados', JSON.stringify([]));
      }
      if (resetLocalFuel) {
        commitStorageBatch(localStorage, [
          { key: 'renea_abastecimentos', value: '[]' },
          { key: LOCAL_FUEL_RESET_STORAGE_KEY, value: LOCAL_FUEL_RESET_VERSION },
        ]);
      }
      if (shouldMigrateSpreadsheetSeed) {
        writeStorageValue(localStorage, 'renea_empresas', JSON.stringify(loadedEmpresas));
        writeStorageValue(localStorage, 'renea_equipamentos', JSON.stringify(loadedEquipamentos));
        writeStorageValue(localStorage, 'renea_comboios', JSON.stringify(loadedComboios));
        writeStorageValue(localStorage, 'renea_abastecimentos', JSON.stringify(loadedAbastecimentos));
        writeStorageValue(localStorage, 'renea_tickets_jazida', JSON.stringify(loadedTicketsJazida));
        writeStorageValue(localStorage, 'renea_controle_estacas', JSON.stringify(loadedControleEstacas));
        writeStorageValue(localStorage, 'renea_planilhas_operacionais_v2', 'true');
      }
      // Compatibilidade com aparelhos que já tinham uma versão sincronizada
      // antes desta correção. A fotografia é feita ainda durante a hidratação,
      // antes que o usuário possa excluir qualquer registro nesta sessão.
      if (!cloudBaselineRef.current && localStorage.getItem(STORAGE_KEYS.lastCloudSyncIso)) {
        const initialBaseline = captureBaselineFromLocalStorage();
        cloudBaselineRef.current = initialBaseline;
        persistCloudBaseline(initialBaseline);
      }
    }
    };
    void hydrateLocalData();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => auth.onAuthStateChanged(async user => {
    if (!user) {
      setCurrentUser(null);
      setIsLoggedIn(false);
      setIsAuthenticating(false);
      return;
    }
    try {
      // No Supabase, a autorização é uma associação explícita na organização;
      // A autorização vem da associação do usuário no Supabase.
      const memberships = await loadSupabaseMemberships();
      const membership = memberships[0];
      if (!membership) {
        await signOutCurrentUser(auth);
        setCurrentUser(null);
        setIsLoggedIn(false);
        setLoginError('Sua conta existe, mas ainda não foi autorizada para acessar o sistema.');
        return;
      }
      setCurrentUserRole(roleFromMembership(membership.role, user.app_metadata?.role));
      setCurrentUser(user);
      setIsLoggedIn(true);
    } catch (error) {
      console.error('Falha ao validar a autorização do usuário:', error);
      setCurrentUser(null);
      setIsLoggedIn(false);
      setLoginError('Não foi possível validar sua autorização. Tente entrar novamente.');
    } finally {
      setIsAuthenticating(false);
    }
  }), []);

  useEffect(() => {
    if (!isLoggedIn) return;
    let timeoutId: number | undefined;
    const expireSession = async () => {
      await signOutCurrentUser(auth);
      setCurrentUser(null);
      setIsLoggedIn(false);
      setPassword('');
      setLoginNotice('Sua sessão foi encerrada por inatividade.');
    };
    const refreshActivity = () => {
      recordSessionActivity(localStorage);
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => { void expireSession(); }, SESSION_INACTIVITY_MS);
    };
    SESSION_ACTIVITY_EVENTS.forEach(eventName => window.addEventListener(eventName, refreshActivity, { passive: true }));
    refreshActivity();
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      SESSION_ACTIVITY_EVENTS.forEach(eventName => window.removeEventListener(eventName, refreshActivity));
    };
  }, [isLoggedIn]);

  // Check the real Firestore connection only after authentication.
  useEffect(() => {
    setIsAutoSyncEnabled(true);
    writeStoredFlag(localStorage, STORAGE_KEYS.autoSync, true);
    
    const savedLastSync = localStorage.getItem('renea_last_cloud_sync') || '';
    setLastCloudSync(savedLastSync);

    if (!isLoggedIn || externalTicketLink || externalPresenceToken) {
      setIsCloudConnected(false);
      return;
    }

    const checkConnection = async () => {
      try {
        const status = await getCloudConnectionStatus(db);
        setIsCloudConnected(status.connected);

        // O horario remoto nao pode ser gravado como uma sincronizacao local.
        // Esse marcador so e atualizado depois de um upload/download concluido;
        // caso contrario um navegador novo acredita que ja baixou a nuvem e o
        // primeiro snapshot em tempo real e descartado.
      } catch (error) {
        console.warn('Falha ao validar a conexão real com a nuvem:', error);
        setIsCloudConnected(false);
      }
    };
    void checkConnection();
  }, [isLoggedIn, externalTicketLink, externalPresenceToken]);

  /** Le uma tabela do armazenamento local, com o padrao usado hoje como reserva. */
  const readTable = <T,>(storageKey: string, fallback: T): T =>
    parseStoredJson<T>(localStorage.getItem(storageKey), storageKey, fallback);

  /**
   * Le do armazenamento local o retrato completo que vai para a nuvem. Existe
   * em um lugar so porque antes esta lista de 20 tabelas estava duplicada em
   * dois pontos, e o envio dependia da ORDEM de 20 parametros posicionais:
   * trocar dois de lugar publicava uma tabela no campo de outra, em silencio.
   */
  const readLocalCloudTables = (): CloudData => ({
    empresas: readTable('renea_empresas', INITIAL_EMPRESAS),
    obras: readTable('renea_obras', INITIAL_OBRAS),
    equipamentos: readTable('renea_equipamentos', INITIAL_EQUIPAMENTOS),
    funcionarios: readTable('renea_funcionarios', INITIAL_FUNCIONARIOS),
    motoristasOperacionais: readTable(STORAGE_KEYS.motoristasOperacionais, motoristasOperacionais),
    comboios: readTable('renea_comboios', INITIAL_COMBOIOS),
    canteiros: readTable('renea_canteiros', INITIAL_CANTEIROS),
    combustiveis: readTable('renea_combustiveis', INITIAL_TIPOS_COMBUSTIVEL),
    lubrificantes: readTable('renea_lubrificantes', INITIAL_PRODUTOS_LUBRIFICACAO),
    etapas: readTable('renea_etapas', INITIAL_ETAPAS_SERVICO),
    abastecimentos: readTable('renea_abastecimentos', INITIAL_ABASTECIMENTOS),
    lubrificacoes: readTable('renea_lubrificacoes', INITIAL_LUBRIFICACOES),
    ticketsJazida: readTable('renea_tickets_jazida', [] as TicketJazida[]),
    checklists: readTable(STORAGE_KEYS.checklists, [] as ChecklistEquipamento[]),
    apontamentosOperacionais: readTable(STORAGE_KEYS.apontamentosOperacionais, [] as ApontamentoOperacional[]),
    registrosDds: readTable(STORAGE_KEYS.registrosDds, [] as RegistroDDS[]),
    treinamentos: readTable(STORAGE_KEYS.treinamentos, [] as Treinamento[]),
    materiaisCadastro: readTable(STORAGE_KEYS.materiaisCadastro, [] as Material[]),
    materiaisMovimentos: readTable(STORAGE_KEYS.materiaisMovimentos, [] as MovimentoMaterial[]),
    materiaisPrevistos: readTable(STORAGE_KEYS.materiaisPrevistos, [] as PrevistoMaterial[]),
    rotinasDiarias: readTable(STORAGE_KEYS.rotinasDiarias, [] as RotinaDiaria[]),
    pendenciasRotina: readTable(STORAGE_KEYS.pendenciasRotina, [] as PendenciaRotina[]),
    modelosRotina: readTable(STORAGE_KEYS.modelosRotina, [] as ModeloRotina[]),
    frentesServico: readTable(STORAGE_KEYS.frentesServico, [] as FrenteServico[]),
    diariosObra: readTable(STORAGE_KEYS.diariosObra, [] as DiarioObra[]),
    servicosObra: readTable(STORAGE_KEYS.servicosObra, [] as ServicoObra[]),
    producaoRegistros: readTable(STORAGE_KEYS.producaoRegistros, [] as RegistroProducao[]),
    planejamentoItens: readTable(STORAGE_KEYS.planejamentoItens, [] as PlanejamentoItem[]),
    modelosFvs: readTable(STORAGE_KEYS.modelosFvs, [] as ModeloFvs[]),
    fichasFvs: readTable(STORAGE_KEYS.fichasFvs, [] as FichaVerificacaoServico[]),
    inspecoes: readTable(STORAGE_KEYS.inspecoes, [] as Inspecao[]),
    naoConformidades: readTable(STORAGE_KEYS.naoConformidades, [] as NaoConformidade[]),
    medicoes: readTable(STORAGE_KEYS.medicoes, [] as Medicao[]),
    documentos: readTable(STORAGE_KEYS.documentos, [] as DocumentoArquivo[]),
    ocorrencias: readTable(STORAGE_KEYS.ocorrencias, [] as Ocorrencia[]),
    lancamentosCusto: readTable(STORAGE_KEYS.lancamentosCusto, [] as LancamentoCusto[]),
    orcamentoItens: readTable(STORAGE_KEYS.orcamentoItens, [] as OrcamentoItem[]),
    modelosChecklist: readTable(STORAGE_KEYS.modelosChecklist, [] as ModeloChecklist[]),
    listasPresenca: readTable('renea_listas_presenca', INITIAL_PRESENCAS),
    ordensServico: readTable('renea_ordens_servico', INITIAL_ORDENS_SERVICO),
    gruposEquipe: readTable('renea_grupos_equipes', INITIAL_GRUPOS_EQUIPES),
    presencasLink: readTable('renea_presencas_link', INITIAL_PRESENCAS_LINK),
    historicoPresencas: readTable('renea_historico_presencas', INITIAL_HISTORICO_PRESENCAS),
    controleEquipamentosDiario: readTable('renea_controle_equipamentos_diario', INITIAL_CONTROLE_EQUIPAMENTOS_DIARIO),
    periodosArquivados: readTable('renea_periodos_arquivados', [] as PeriodoArquivado[]),
    vinculosOperadorEquipamento: readTable('renea_vinculos_operador_equipamento', [] as VinculoOperadorEquipamento[]),
    masterDataReviewQueue: readTable('renea_master_data_review_queue', [] as MasterWorkbookReviewRow[]),
    notifications: readTable('renea_notifications', getInitialNotifications()),
    historyLogs: readTable('renea_history_logs', [] as HistoryLog[]),
    exclusoes: readTable(STORAGE_KEYS.exclusoes, [] as ExclusaoRegistro[]),
  });

  // Envio para a nuvem pelo gateway de migração.
  const handleUploadToSupabase = async (
    overrides: Partial<CloudData> = {},
  ): Promise<{ success: boolean; message: string }> => {
    // Enviar a semente de um navegador novo por cima da nuvem trocava os
    // links das equipes e zerava a presença de todo mundo.
    if (localStorage.getItem(AGUARDANDO_PRIMEIRO_DOWNLOAD)) {
      return { success: false, message: 'Este navegador ainda está baixando os dados da nuvem; nada foi enviado.' };
    }
    uploadsInFlightRef.current += 1;
    try {
      const stored = readLocalCloudTables();
      const controleEstacasSalvo = readTable('renea_controle_estacas', controleEstacas);
      // Rede de proteção: nada com exclusão ativa sai deste aparelho, mesmo
      // que uma tela antiga tenha deixado o registro no armazenamento local.
      const data = aplicarExclusoes({
        ...stored,
        estacaLotes: controleEstacasSalvo.lotes,
        estacaCravacoes: controleEstacasSalvo.cravacoes,
        ...overrides,
      });

      // Recarrega as claims antes de qualquer gravação. Usuários que receberam
      // o perfil staff/admin depois do login podem estar com um token antigo,
      // embora a conta já esteja corretamente autorizada no Supabase Auth.
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true);
      }
      // A versão que este aparelho comprovadamente já baixou. É o que permite
      // ao envio saber se está publicando em cima de algo conhecido ou se
      // precisa mesclar antes para não apagar o trabalho de outro usuário.
      const knownCloudVersion = localStorage.getItem('renea_last_cloud_sync_iso') || '';
      const uploadResult = await uploadCloudBackup(
        db,
        data,
        knownCloudVersion,
        cloudBaselineRef.current,
      );
      // O envio pode ter mesclado dados de outro usuário antes de publicar:
      // a base válida daqui para frente é o que foi realmente publicado.
      cloudBaselineRef.current = uploadResult.publishedBaseline;
      
      const nowStr = new Date(uploadResult.updatedAt).toLocaleString('pt-BR');
      setLastCloudSync(nowStr);
      // A nuvem ficou com registros que este aparelho não tem (a trava contra
      // apagar em massa os manteve). Sem marcar esta versão como conhecida,
      // o próximo download traz esses registros de volta para cá.
      const protegidas = uploadResult.tabelasProtegidas ?? [];
      // Outro aparelho publicou no meio do envio só do que mudou: esta versão
      // tem o que este aparelho ainda não viu, então também não fica conhecida.
      const faltaBaixar = protegidas.length > 0 || Boolean(uploadResult.nuvemTinhaNovidades);
      try {
        commitStorageBatch(localStorage, [
          { key: 'renea_last_cloud_sync', value: nowStr },
          ...(faltaBaixar ? [] : [{ key: 'renea_last_cloud_sync_iso', value: uploadResult.updatedAt }]),
          { key: STORAGE_KEYS.cloudBaseline, value: JSON.stringify(uploadResult.publishedBaseline) },
        ]);
      } catch (storageError) {
        // O envio remoto já foi confirmado. Uma falha apenas no indicador local
        // não pode ser reportada como se o backup na nuvem tivesse falhado.
        console.warn('A nuvem foi atualizada, mas o horário local não pôde ser salvo:', storageError);
      }
      setIsCloudConnected(true);
      if (faltaBaixar) pendingRemoteVersionRef.current = uploadResult.updatedAt;
      if (protegidas.length) {
        const devolvidos = protegidas.reduce((total, item) => total + item.devolvidos, 0);
        return {
          success: true,
          message: `${uploadResult.totalRecords.toLocaleString('pt-BR')} registros atualizados. ${devolvidos.toLocaleString('pt-BR')} registros que faltavam neste aparelho foram mantidos na nuvem e voltam para cá.`,
        };
      }
      return {
        success: true,
        message: `${uploadResult.totalRecords.toLocaleString('pt-BR')} registros atualizados com segurança.`,
      };
    } catch (error: unknown) {
      setIsCloudConnected(false);
      console.error('Falha ao sincronizar o backup na nuvem:', error);
      if (!navigator.onLine) {
        void enqueueOfflineCommand('supabase-backup', { requestedAt: new Date().toISOString() });
      }
      return { success: false, message: formatCloudSyncError(error) };
    } finally {
      uploadsInFlightRef.current = Math.max(0, uploadsInFlightRef.current - 1);
      if (uploadsInFlightRef.current === 0 && pendingRemoteVersionRef.current) {
        queueMicrotask(() => requestAutomaticRemoteSyncRef.current(pendingRemoteVersionRef.current));
      }
    }
  };

  // Download da nuvem pelo provedor autoritativo da fase atual.
  const handleDownloadFromSupabase = async (): Promise<{ success: boolean; data?: string; message: string }> => {
    try {
      // Lidas antes do download, que troca as assinaturas pela versão nova (A13).
      const assinaturasConhecidas = await readKnownCloudSignatures(localStorage.getItem('renea_last_cloud_sync_iso') || '').catch(() => null);
      const backup = await downloadCloudBackup(db);
      if (backup.data) {
        const downloadedData = backup.data;
        const validation = validateSystemBackup(downloadedData, false);
        if (!validation.valid) throw new Error(describeInvalidBackup(validation));
        // O que vem da nuvem é aceito como está. Rotacionar aqui trocava o
        // endereço a cada download: bastava um aparelho publicar um grupo com
        // token herdado para este trocar e republicar, e o link mudava sozinho
        // em looping. Token fraco é tratado uma vez, na carga local.
        const data: CloudData = { ...downloadedData };
        const remotePresence = Array.isArray(data.presencasLink) ? data.presencasLink : [];
        const localPresence = parseStoredJson<PresencaApontamento[]>(
          localStorage.getItem('renea_presencas_link'),
          'renea_presencas_link',
          [],
        );
        // Presença lançada ou recuperada aqui que ainda não subiu continua;
        // a que saiu da nuvem depois da última sincronização sai daqui também.
        data.presencasLink = juntarPresencaBaixada(remotePresence, localPresence, cloudBaselineRef.current?.presencasLink);
        // As exclusões nunca são trocadas pelo que veio da nuvem, só somadas:
        // uma exclusão feita aqui que ainda não subiu não pode se perder, senão
        // o registro volta. Depois disso, a marca vale para todas as tabelas.
        const localExclusoes = parseStoredJson<ExclusaoRegistro[]>(
          localStorage.getItem(STORAGE_KEYS.exclusoes),
          STORAGE_KEYS.exclusoes,
          [],
        );
        const remoteExclusoes = Array.isArray(data.exclusoes) ? data.exclusoes : [];
        data.exclusoes = mergeCloudTable(remoteExclusoes, localExclusoes);
        Object.assign(data, aplicarExclusoes(data));
        const downloadedBaseline = captureCloudBaseline(data);
        // O que este aparelho criou e ainda não subiu fica, e sobe logo depois (C5).
        const { retrato: comNovidades, mantidas: novidadesLocais } = manterNovidadesLocais(data, readStoredCloudTables(), cloudBaselineRef.current);
        Object.assign(data, comNovidades);
        // O que foi editado aqui e ainda não subiu fica com a versão daqui (A13).
        const { retrato: comEdicoes, editadas: edicoesLocais } = manterEdicoesLocais(data, readStoredCloudTables(), assinaturasConhecidas);
        Object.assign(data, comEdicoes);
        // A nuvem veio vazia ou muito menor numa tabela que este aparelho tem
        // cheia, sem marca de exclusão: foi outro navegador que perdeu a cópia
        // e publicou por cima. Este aparelho guarda o que tem e devolve à
        // nuvem logo depois do download, em vez de apagar a própria cópia.
        const { retrato: dadosProtegidos, protegidas: devolverParaNuvem } = protegerContraEncolhimento(readLocalCloudTables(), data);
        Object.assign(data, dadosProtegidos);
        const syncIso = backup.updatedAt || new Date().toISOString();
        const syncDate = new Date(syncIso);
        const nowStr = Number.isNaN(syncDate.getTime())
          ? new Date().toLocaleString('pt-BR')
          : syncDate.toLocaleString('pt-BR');
        
        // Grava primeiro como um único conjunto recuperável. Se o navegador
        // estiver sem espaço, nenhuma tabela é deixada pela metade.
        try {
          commitStorageBatch(localStorage, [
            ...CLOUD_STORAGE_KEYS.flatMap(([dataKey, storageKey]) => (
              Array.isArray(data[dataKey])
                ? [{ key: storageKey, value: JSON.stringify(data[dataKey]) }]
                : []
            )),
            ...(Array.isArray(data.estacaLotes) || Array.isArray(data.estacaCravacoes)
              ? [{
                  key: 'renea_controle_estacas',
                  value: JSON.stringify({
                    lotes: Array.isArray(data.estacaLotes) ? data.estacaLotes : [],
                    cravacoes: Array.isArray(data.estacaCravacoes) ? data.estacaCravacoes : [],
                  }),
                }]
              : []),
            { key: 'renea_last_cloud_sync', value: nowStr },
            { key: 'renea_last_cloud_sync_iso', value: syncIso },
            { key: STORAGE_KEYS.cloudBaseline, value: JSON.stringify(downloadedBaseline) },
          ]);
        } catch (error) {
          if (!isStorageQuotaExceededError(error)) throw error;
          console.warn('A cache local está cheia. Os dados remotos continuarão disponíveis nesta sessão.');
        }
        localStorage.removeItem(AGUARDANDO_PRIMEIRO_DOWNLOAD);

        // Só atualiza o React depois de toda a persistência local concluir.
        if (Object.hasOwn(data, 'empresas')) {
          setEmpresas(normalizeRuntimeCollection<Empresa>(data.empresas));
        }
        if (Object.hasOwn(data, 'obras')) {
          setObras(normalizeRuntimeCollection<ObraLocal>(data.obras));
        }
        if (Object.hasOwn(data, 'equipamentos')) {
          setEquipamentos(normalizeRuntimeCollection<Equipamento>(data.equipamentos));
        }
        if (Object.hasOwn(data, 'funcionarios')) {
          setFuncionarios(normalizeRuntimeCollection<Funcionario>(data.funcionarios));
        }
        if (Object.hasOwn(data, 'motoristasOperacionais')) {
          setMotoristasOperacionais(normalizeRuntimeCollection<Funcionario>(data.motoristasOperacionais));
        }
        if (Object.hasOwn(data, 'comboios')) {
          setComboios(normalizeRuntimeCollection<Comboio>(data.comboios));
        }
        if (Object.hasOwn(data, 'canteiros')) {
          setCanteiros(normalizeRuntimeCollection<Canteiro>(data.canteiros));
        }
        if (Object.hasOwn(data, 'combustiveis')) {
          setCombustiveis(normalizeRuntimeCollection<TipoCombustivel>(data.combustiveis));
        }
        if (Object.hasOwn(data, 'lubrificantes')) {
          setLubrificantes(normalizeRuntimeCollection<ProdutoLubrificacao>(data.lubrificantes));
        }
        if (Object.hasOwn(data, 'etapas')) {
          setEtapas(normalizeRuntimeCollection<EtapaServico>(data.etapas));
        }
        if (Object.hasOwn(data, 'abastecimentos')) {
          setAbastecimentos(normalizeRuntimeCollection<Abastecimento>(data.abastecimentos));
        }
        if (Object.hasOwn(data, 'lubrificacoes')) {
          setLubrificacoes(normalizeRuntimeCollection<Lubrificacao>(data.lubrificacoes));
        }
        if (Object.hasOwn(data, 'ticketsJazida')) {
          setTicketsJazida(normalizeRuntimeCollection<TicketJazida>(data.ticketsJazida));
        }
        if (Object.hasOwn(data, 'listasPresenca')) {
          setListasPresenca(normalizePresenceLists(data.listasPresenca));
        }
        if (Object.hasOwn(data, 'ordensServico')) {
          setOrdensServico(normalizeRuntimeCollection<OrdemServico>(data.ordensServico));
        }
        if (Object.hasOwn(data, 'checklists')) {
          setChecklists(normalizeRuntimeCollection<ChecklistEquipamento>(data.checklists));
        }
        if (Object.hasOwn(data, 'apontamentosOperacionais')) {
          setApontamentosOperacionais(normalizeRuntimeCollection<ApontamentoOperacional>(data.apontamentosOperacionais));
        }
        if (Object.hasOwn(data, 'registrosDds')) {
          setRegistrosDds(normalizeRuntimeCollection<RegistroDDS>(data.registrosDds));
        }
        if (Object.hasOwn(data, 'treinamentos')) {
          setTreinamentos(normalizeRuntimeCollection<Treinamento>(data.treinamentos));
        }
        if (Object.hasOwn(data, 'materiaisCadastro')) {
          setMateriaisCadastro(normalizeRuntimeCollection<Material>(data.materiaisCadastro));
        }
        if (Object.hasOwn(data, 'materiaisMovimentos')) {
          setMateriaisMovimentos(normalizeRuntimeCollection<MovimentoMaterial>(data.materiaisMovimentos));
        }
        if (Object.hasOwn(data, 'materiaisPrevistos')) {
          setMateriaisPrevistos(normalizeRuntimeCollection<PrevistoMaterial>(data.materiaisPrevistos));
        }
        if (Object.hasOwn(data, 'rotinasDiarias')) {
          setRotinasDiarias(normalizeRuntimeCollection<RotinaDiaria>(data.rotinasDiarias));
        }
        if (Object.hasOwn(data, 'pendenciasRotina')) {
          setPendenciasRotina(normalizeRuntimeCollection<PendenciaRotina>(data.pendenciasRotina));
        }
        if (Object.hasOwn(data, 'modelosRotina')) {
          setModelosRotina(normalizeRuntimeCollection<ModeloRotina>(data.modelosRotina));
        }
        if (Object.hasOwn(data, 'frentesServico')) {
          setFrentesServico(normalizeRuntimeCollection<FrenteServico>(data.frentesServico));
        }
        if (Object.hasOwn(data, 'diariosObra')) {
          setDiariosObra(normalizeRuntimeCollection<DiarioObra>(data.diariosObra));
        }
        if (Object.hasOwn(data, 'servicosObra')) {
          setServicosObra(normalizeRuntimeCollection<ServicoObra>(data.servicosObra));
        }
        if (Object.hasOwn(data, 'producaoRegistros')) {
          setProducaoRegistros(normalizeRuntimeCollection<RegistroProducao>(data.producaoRegistros));
        }
        if (Object.hasOwn(data, 'planejamentoItens')) {
          setPlanejamentoItens(normalizeRuntimeCollection<PlanejamentoItem>(data.planejamentoItens));
        }
        if (Object.hasOwn(data, 'modelosFvs')) {
          setModelosFvs(normalizeRuntimeCollection<ModeloFvs>(data.modelosFvs));
        }
        if (Object.hasOwn(data, 'fichasFvs')) {
          setFichasFvs(normalizeRuntimeCollection<FichaVerificacaoServico>(data.fichasFvs));
        }
        if (Object.hasOwn(data, 'inspecoes')) {
          setInspecoes(normalizeRuntimeCollection<Inspecao>(data.inspecoes));
        }
        if (Object.hasOwn(data, 'naoConformidades')) {
          setNaoConformidades(normalizeRuntimeCollection<NaoConformidade>(data.naoConformidades));
        }
        if (Object.hasOwn(data, 'medicoes')) {
          setMedicoes(normalizeRuntimeCollection<Medicao>(data.medicoes));
        }
        if (Object.hasOwn(data, 'documentos')) {
          setDocumentos(normalizeRuntimeCollection<DocumentoArquivo>(data.documentos));
        }
        if (Object.hasOwn(data, 'ocorrencias')) {
          setOcorrencias(normalizeRuntimeCollection<Ocorrencia>(data.ocorrencias));
        }
        if (Object.hasOwn(data, 'lancamentosCusto')) {
          setLancamentosCusto(normalizeRuntimeCollection<LancamentoCusto>(data.lancamentosCusto));
        }
        if (Object.hasOwn(data, 'orcamentoItens')) {
          setOrcamentoItens(normalizeRuntimeCollection<OrcamentoItem>(data.orcamentoItens));
        }
        if (Object.hasOwn(data, 'modelosChecklist')) {
          const modelosNuvem = normalizeRuntimeCollection<ModeloChecklist>(data.modelosChecklist);
          if (modelosNuvem[0]) setModeloChecklist(modelosNuvem[0]);
        }
        if (Object.hasOwn(data, 'gruposEquipe')) {
          setGruposEquipe(normalizeTeamGroups(data.gruposEquipe));
        }
        if (Object.hasOwn(data, 'presencasLink')) {
          setPresencasLink(normalizeRuntimeCollection<PresencaApontamento>(data.presencasLink));
        }
        if (Object.hasOwn(data, 'historicoPresencas')) {
          setHistoricoPresencas(normalizeRuntimeCollection<HistoricoPresenca>(data.historicoPresencas));
        }
        if (Object.hasOwn(data, 'controleEquipamentosDiario')) {
          setControleEquipamentosDiario(normalizeRuntimeCollection<ControleEquipamentoDiario>(data.controleEquipamentosDiario));
        }
        if (Object.hasOwn(data, 'periodosArquivados')) {
          setPeriodosArquivados(normalizeRuntimeCollection<PeriodoArquivado>(data.periodosArquivados));
        }
        if (Array.isArray(data.estacaLotes) || Array.isArray(data.estacaCravacoes)) {
          setControleEstacas({
            lotes: Array.isArray(data.estacaLotes) ? data.estacaLotes : [],
            cravacoes: Array.isArray(data.estacaCravacoes) ? data.estacaCravacoes : [],
          });
        }
        if (Object.hasOwn(data, 'notifications')) {
          setNotifications(normalizeRuntimeCollection<AppNotification>(data.notifications));
        }
      if (Object.hasOwn(data, 'historyLogs')) {
        const restoredHistory = normalizeRuntimeCollection<HistoryLog>(data.historyLogs);
        setHistoryLogs(restoredHistory);
        writeStorageValue(localStorage, 'renea_history_logs', JSON.stringify(restoredHistory));
      }
      if (Array.isArray(data.exclusoes)) {
        setExclusoes(data.exclusoes as ExclusaoRegistro[]);
      }
      if (Array.isArray(data.vinculosOperadorEquipamento)) {
        setVinculosOperadorEquipamento(data.vinculosOperadorEquipamento);
        writeStorageValue(localStorage, 'renea_vinculos_operador_equipamento', JSON.stringify(data.vinculosOperadorEquipamento));
      }
        
        setLastCloudSync(nowStr);
        setIsCloudConnected(true);
        // Acabou de igualar com a nuvem: este é o retrato que serve de base
        // para diferenciar exclusões locais de novidades dos colegas depois.
        cloudBaselineRef.current = downloadedBaseline;
        if (edicoesLocais.length && !devolverParaNuvem.length && !novidadesLocais.length) {
          queueMicrotask(() => { void handleUploadToSupabase(); });
          const editados = edicoesLocais.reduce((total, item) => total + item.editados, 0);
          return {
            success: true,
            message: `Dados atualizados. ${editados.toLocaleString('pt-BR')} alterações feitas neste aparelho foram mantidas e estão subindo para a nuvem.`,
          };
        }
        if (devolverParaNuvem.length || novidadesLocais.length) {
          console.warn('A nuvem chegou sem registros que este aparelho tem; eles serão devolvidos:', [...devolverParaNuvem, ...novidadesLocais]);
          queueMicrotask(() => { void handleUploadToSupabase(); });
          const devolvidos = devolverParaNuvem.reduce((total, item) => total + item.devolvidos, 0)
            + novidadesLocais.reduce((total, item) => total + item.mantidos, 0);
          return {
            success: true,
            message: `Dados atualizados. ${devolvidos.toLocaleString('pt-BR')} registros que faltavam na nuvem foram mantidos neste aparelho e estão sendo devolvidos.`,
          };
        }
        return {
          success: true,
          message: `Dados atualizados com sucesso (${backup.totalRecords.toLocaleString('pt-BR')} registros).`,
        };
      } else {
        return { success: false, message: 'Nenhuma cópia de dados foi encontrada.' };
      }
    } catch (error: unknown) {
      setIsCloudConnected(false);
      console.error('Falha ao restaurar o backup da nuvem:', error);
      return { success: false, message: formatCloudSyncError(error) };
    }
  };

  // Serializa a reconciliacao automatica. Se um snapshot chegar durante um
  // upload ou outro download, a versao fica pendente e e processada assim que
  // a operacao atual terminar, em vez de ser descartada para sempre.
  const requestAutomaticRemoteSync = async (updatedAt: string) => {
    if (!updatedAt || !isAutoSyncEnabled || externalPresenceToken || externalTicketLink) return;
    pendingRemoteVersionRef.current = updatedAt;
    if (uploadsInFlightRef.current > 0 || automaticDownloadInFlightRef.current) return;

    automaticDownloadInFlightRef.current = true;
    let retryPendingImmediately = true;
    try {
      while (pendingRemoteVersionRef.current && uploadsInFlightRef.current === 0) {
        const requestedVersion = pendingRemoteVersionRef.current;
        pendingRemoteVersionRef.current = '';
        const localCloudVersion = localStorage.getItem('renea_last_cloud_sync_iso') || '';

        // Um snapshot antigo pode ter sido enfileirado enquanto uma
        // recuperação/publicação estava em andamento. Nunca baixe uma versão
        // igual ou anterior à que este aparelho acabou de publicar.
        if (
          localCloudVersion
          && requestedVersion
          && Date.parse(requestedVersion) <= Date.parse(localCloudVersion)
        ) {
          if (!cloudBaselineRef.current) {
            cloudBaselineRef.current = captureBaselineFromLocalStorage();
            persistCloudBaseline(cloudBaselineRef.current);
          }
          continue;
        }

        // No primeiro acesso ainda nao existe uma base para distinguir dados
        // locais antigos dos dados da nuvem. Perfis de escrita fazem uma
        // mesclagem conservadora antes de baixar o retrato publicado; assim
        // nenhum lancamento que so existe neste aparelho e perdido.
        if (!localCloudVersion && currentUserRoleRef.current !== 'leitura' && !localStorage.getItem(AGUARDANDO_PRIMEIRO_DOWNLOAD)) {
          const uploadResult = await handleUploadToSupabase();
          if (!uploadResult.success) {
            pendingRemoteVersionRef.current = requestedVersion;
            retryPendingImmediately = false;
            addNotification(
              'Sincronizacao inicial pendente',
              `Os dados locais foram preservados, mas ainda nao foi possivel conciliar com a nuvem. Motivo: ${uploadResult.message}`,
              'error',
              'Sistema Local',
            );
            break;
          }
        }

        const downloadResult = await handleDownloadFromSupabase();
        if (!downloadResult.success) {
          pendingRemoteVersionRef.current = requestedVersion;
          retryPendingImmediately = false;
          addNotification(
            'Nao foi possivel atualizar os dados',
            `Este aparelho nao conseguiu buscar a versao mais recente da nuvem. Motivo: ${downloadResult.message}`,
            'error',
            'Sistema Local',
          );
          break;
        }
      }
    } finally {
      automaticDownloadInFlightRef.current = false;
      if (retryPendingImmediately && pendingRemoteVersionRef.current && uploadsInFlightRef.current === 0) {
        queueMicrotask(() => requestAutomaticRemoteSyncRef.current(pendingRemoteVersionRef.current));
      }
    }
  };
  requestAutomaticRemoteSyncRef.current = updatedAt => { void requestAutomaticRemoteSync(updatedAt); };

  // Confere a nuvem e baixa quando outro dispositivo publicou uma versão
  // mais recente. Não é só um pulso periódico: também é chamada direto ao
  // trocar de tela (navigateTo), para que abrir uma tela específica sempre
  // confira a versão mais nova antes de confiar no que já estava carregado
  // localmente — em vez de esperar o próximo pulso automático.
  const pullRemoteChanges = async () => {
    if (!isAutoSyncEnabled || externalPresenceToken || externalTicketLink) return;
    if (isCheckingSyncRef.current) return;
    // Cada checagem é uma leitura remota. Passar por cinco telas
    // seguidas não precisa de cinco leituras: o ouvinte em tempo real já
    // avisa de qualquer publicação nova nesse intervalo.
    if (Date.now() - lastSyncCheckAtRef.current < SYNC_CHECK_MIN_INTERVAL_MS) return;
    isCheckingSyncRef.current = true;
    lastSyncCheckAtRef.current = Date.now();
    try {
      const status = await getCloudConnectionStatus(db);
      setIsCloudConnected(status.connected);

      if (!status.updatedAt) return;
      await requestAutomaticRemoteSync(status.updatedAt);
    } catch (error) {
      setIsCloudConnected(false);
      console.warn('Verificação automática da nuvem falhou:', error);
    } finally {
      isCheckingSyncRef.current = false;
    }
  };

  // Com a sincronizacao automatica ativa, verifica periodicamente se outro
  // dispositivo publicou uma versao mais recente e atualiza este navegador.
  useEffect(() => {
    // Sem aguardar o login: este efeito rodava 3s após o app abrir, mesmo com
    // a tela de login ainda na tela. Se a checagem caísse antes do token de
    // autenticação estar pronto, o Firestore recusava a leitura por permissão
    // — e o navegador nunca chegava a baixar os dados reais da nuvem.
    if (!isLoggedIn || !isAutoSyncEnabled || externalPresenceToken || externalTicketLink) return;

    // O que não coube na memória do navegador e voltou da cópia de
    // recuperação num F5 sobe antes de qualquer checagem: sem isso a
    // importação só chegava à nuvem no próximo salvamento, se chegasse.
    const initialCheck = window.setTimeout(() => {
      const pendentes = retirarPendentesDaReserva();
      if (pendentes.length === 0) {
        void pullRemoteChanges();
        return;
      }
      void handleUploadToSupabase().then(resultado => {
        if (!resultado.success) {
          addNotification(
            'Envio pendente para a nuvem',
            `O que foi salvo antes de recarregar a página está neste aparelho, mas ainda não chegou à nuvem. Motivo: ${resultado.message}`,
            'error',
            'Sistema Local',
          );
        }
        return pullRemoteChanges();
      });
    }, 3_000);
    // O manifesto dispara a atualização imediatamente quando outro cliente
    // publica uma nova geração. O intervalo permanece apenas como fallback
    // para reconectar quando o listener fica offline.
    let unsubscribeManifest: (() => void) | undefined = () => undefined;
    // O Supabase usa o intervalo e os eventos de foco/reconexão para atualizar
    // o retrato, sem listener do provedor legado.
    const interval = window.setInterval(pullRemoteChanges, SYNC_FALLBACK_INTERVAL_MS);
    // O canal em tempo real do Firestore pode cair sem avisar quando o
    // celular bloqueia a tela ou a aba fica em segundo plano por um tempo —
    // é um comportamento conhecido do navegador, não um erro para capturar.
    // Sem isto, só um F5 completo forçava uma checagem nova; agora voltar
    // para a aba ou recuperar a internet já faz o mesmo.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pullRemoteChanges();
    };
    const onReconnect = () => void pullRemoteChanges();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onReconnect);
    window.addEventListener('focus', onReconnect);
    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(interval);
      unsubscribeManifest();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onReconnect);
      window.removeEventListener('focus', onReconnect);
    };
  }, [isLoggedIn, isAutoSyncEnabled, externalPresenceToken, externalTicketLink]);

  const reloadExternalPresence = async (data = '') => {
    if (!externalPresenceToken) return;
    setIsExternalPresenceLoading(true);
    setExternalPresenceLoadError('');
    try {
      const config = await loadPublicPresenceConfig(externalPresenceToken, data);
      setGruposEquipe(normalizeTeamGroups(config.gruposEquipe));
      setFuncionarios(normalizeRuntimeCollection<Funcionario>(config.funcionarios));
      setEmpresas(normalizeRuntimeCollection<Empresa>(config.empresas));
      setObras(normalizeRuntimeCollection<ObraLocal>(config.obras));
      setExternalFuncionariosDisponiveis(config.funcionariosDisponiveis || []);
      setExternalMeuGrupo(config.meuGrupo || null);
      setExternalMeusRegistros(config.meusRegistros || []);
      setExternalDatasDisponiveis(config.datasDisponiveis || []);
      setExternalDataSelecionada(config.dataSelecionada || '');
      setExternalDataAtual(config.dataAtual || '');
      setExternalObservacaoDia(config.observacaoDia || '');
      setExternalPresenceHistory(config.historicoPorData || { [config.dataSelecionada || '']: config.meusRegistros || [] });
      setExternalPresenceDayNotes(config.observacoesPorData || { [config.dataSelecionada || '']: config.observacaoDia || '' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível carregar as equipes.';
      setExternalPresenceLoadError(message);
      console.error('Falha ao carregar link público de presença:', error);
    } finally {
      setIsExternalPresenceLoading(false);
    }
  };

  useEffect(() => {
    if (!externalPresenceToken) return;
    void reloadExternalPresence();
  }, [externalPresenceToken]);

  useEffect(() => {
    if (!externalTicketLink) return;
    setExternalPublicTickets([]);
    setExternalTicketLoadError('');
    setIsExternalTicketLoading(true);
    validatePublicTicketAccess(externalTicketAccessToken)
      .catch(error => {
        setExternalTicketLoadError(
          error instanceof Error
            ? error.message
            : 'Este link de tickets é inválido, expirou ou foi substituído.',
        );
      })
      .finally(() => setIsExternalTicketLoading(false));
  }, [externalTicketAccessToken, externalTicketLink]);

  // Tickets públicos chegam por listener, não por varredura periódica: reler a
  // coleção inteira a cada 30 segundos custava centenas de milhares de leituras
  // por dia sem nada ter mudado. O listener cobra a leitura inicial e depois só
  // o documento que muda de fato.
  useEffect(() => {
    if (!isLoggedIn || externalTicketLink) return;
    const unsubscribe = subscribePublicTickets(db, publicTickets => {
      const incomingIds = new Set(publicTickets.map(item => item.id));
      setTicketsJazida(current => {
        const withoutRemovedPublicTickets = current.filter(item => (
          !publicTicketIdsRef.current.has(item.id) || incomingIds.has(item.id)
        ));
        const merged = mergeTicketCollections(withoutRemovedPublicTickets, publicTickets);
        writeStorageValue(localStorage, 'renea_tickets_jazida', JSON.stringify(merged));
        return merged;
      });
      publicTicketIdsRef.current = incomingIds;
    }, error => console.warn('Listener de tickets públicos indisponível:', error));
    return () => unsubscribe();
  }, [isLoggedIn, externalTicketLink]);

  // Não altera nem migra tickets automaticamente ao abrir o sistema.
  // Qualquer mudança nos tickets ocorre somente por ação manual do usuário.

  // Helper to save data and append to changes history
  const saveAndLog = (
    tableName: string,
    action: HistoryLog['acao'],
    description: string,
    newHistoryList: HistoryLog[],
    stateUpdateFn: () => void,
    audit?: Pick<HistoryLog, 'registroId' | 'valorAnterior' | 'valorNovo' | 'tipoOperacao'>,
    onError?: (error: Error) => void,
  ) => {
    stateUpdateFn();
    const changeLog: HistoryLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleString('pt-BR'),
      usuario: activeUserName,
      acao: action,
      tela: tableName,
      descricao: description,
      ...audit,
    };
    const updatedHistory = [changeLog, ...newHistoryList].slice(0, 2_000);
    setHistoryLogs(updatedHistory);
    writeStorageValue(localStorage, 'renea_history_logs', JSON.stringify(updatedHistory));

    // Só avisa o que a pessoa não acabou de ver acontecer. Criar e editar já
    // têm retorno imediato na própria tela e ficam registrados no Histórico:
    // repetir isso no sino só enchia a caixa de avisos redundantes. Exclusão
    // continua avisando por ser destrutiva e difícil de perceber depois.
    if (action === 'Excluiu') {
      addNotification(`${tableName} — ${action}`, description, 'warning', 'Sistema Local');
    }

    // A sincronização é obrigatória e silenciosa para manter todos os usuários alinhados.
    // Dispara na hora (sem atraso): handleUploadToSupabase marca
    // uploadsInFlightRef antes de qualquer await, e esse é o sinal que impede
    // uma sincronização automática concorrente de baixar a versão antiga da
    // nuvem e sobrescrever, na tela, o que acabou de ser salvo aqui. Um
    // atraso artificial antes desta chamada deixava essa proteção sem efeito
    // durante a janela de espera.
    handleUploadToSupabase().then(res => {
      if (res.success) return;
      console.warn('Sincronização automática pendente:', res.message);
      // A falha precisa ser visível: antes disso o salvamento parecia ter
    // dado certo e a base podia ficar dias sem chegar ao Supabase.
      const now = Date.now();
      const isRepeat = lastSyncFailureRef.current.message === res.message
        && now - lastSyncFailureRef.current.at < 60_000;
      lastSyncFailureRef.current = { message: res.message, at: now };
      if (isRepeat) return;
      addNotification(
        'Sincronização com a nuvem falhou',
        `${tableName} foi salvo neste aparelho, mas não chegou à nuvem. Motivo: ${res.message}`,
        'error',
        'Sistema Local',
      );
      // Invoke error callback to notify parent component
      if (onError) {
        onError(new Error(res.message));
      }
    });
  };

  // Auth Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginNotice('');
    setIsAuthenticating(true);
    try {
      await signInWithCorporateEmail(auth, username, password);
      setLoginError('');
    } catch (error: unknown) {
      setLoginError(getLoginErrorMessage(error));
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handlePasswordRecovery = async () => {
    const email = normalizeLoginEmail(username);
    setLoginError('');
    setLoginNotice('');
    if (!email) {
      setLoginError('Informe seu e-mail para receber a recuperação de senha.');
      return;
    }
    try {
      await sendPasswordRecoveryEmail(auth, email);
    } catch {
      // A mesma resposta evita confirmar se um e-mail possui conta no sistema.
    }
    setLoginNotice('Se a conta estiver autorizada, o e-mail de recuperação foi enviado.');
  };

  const handleLogout = async () => {
    await signOutCurrentUser(auth);
    setIsLoggedIn(false);
    setCurrentUser(null);
    setUsername('');
    setPassword('');
  };

  // CRUD State Handlers
  const handleSaveEmpresa = (item: Empresa, isNew: boolean, onError?: (error: Error) => void) => {
    const now = new Date().toISOString();
    const previous = empresas.find(x => x.id === item.id);
    const normalizedItem = normalizeEmpresa(item, previous, now);
    const errors = validateCentralRecord({ empresas, equipamentos, funcionarios, obras, record: normalizedItem });
    if (errors.length > 0) {
      addNotification('Cadastro não salvo', errors.join(' '), 'warning', 'Sistema Local');
      return;
    }
    const updated = saveRegistryItem(empresas, normalizedItem, isNew);
    saveAndLog(
      'Empresas',
      isNew ? 'Criou' : 'Editou',
      `${isNew ? 'Cadastrou' : 'Editou'} a empresa/fornecedor "${normalizedItem.nome}"${normalizedItem.cnpj ? ` com CNPJ ${normalizedItem.cnpj}` : ''}.`,
      historyLogs,
      () => {
        setEmpresas(updated);
        writeStorageValue(localStorage, 'renea_empresas', JSON.stringify(updated));
      },
      { registroId: normalizedItem.id, valorAnterior: previous, valorNovo: normalizedItem, tipoOperacao: isNew ? 'CREATE' : 'UPDATE' },
      onError,
    );
  };

  const handleDeleteEmpresa = (id: string) => {
    const item = empresas.find(x => x.id === id);
    if (!item) return;
    const next = inactivateEmpresa(item, new Date().toISOString());
    const updated = saveRegistryItem(empresas, next, false);
    saveAndLog(
      'Empresas',
      'Inativou',
      `Inativou a empresa/fornecedor "${item.nome}".`,
      historyLogs,
      () => {
        setEmpresas(updated);
        writeStorageValue(localStorage, 'renea_empresas', JSON.stringify(updated));
      },
      { registroId: id, valorAnterior: item, valorNovo: next, tipoOperacao: 'UPDATE' },
    );
  };

  const handleSaveObra = (recebido: ObraLocal, isNew: boolean) => {
    const item: ObraLocal = { ...recebido, atualizadoEm: new Date().toISOString() };
    const previous = obras.find(x => x.id === item.id);
    const errors = validateCentralRecord({ empresas, equipamentos, funcionarios, obras, record: item });
    if (errors.length > 0) {
      addNotification('Cadastro não salvo', errors.join(' '), 'warning', 'Sistema Local');
      return;
    }
    const updated = saveRegistryItem(obras, item, isNew);
    saveAndLog(
      'Obras/Locais',
      isNew ? 'Criou' : 'Editou',
      `${isNew ? 'Cadastrou' : 'Editou'} a obra "${item.nome}" em ${item.endereco}.`,
      historyLogs,
      () => {
        setObras(updated);
        writeStorageValue(localStorage, 'renea_obras', JSON.stringify(updated));
      },
      { registroId: item.id, valorAnterior: previous, valorNovo: item, tipoOperacao: isNew ? 'CREATE' : 'UPDATE' },
    );
  };

  /**
   * Exclusão real de um cadastro: tira da lista e grava a marca em
   * `exclusoes` no mesmo lote do armazenamento local, antes do envio. A marca
   * é o que faz a exclusão chegar ao Supabase e aos outros aparelhos sem
   * voltar (ver src/cloud/exclusoes.ts).
   */
  const excluirCadastros = <T extends { id: string; nome?: string }>({
    tabela,
    storageKey,
    tela,
    itens,
    lista,
    setLista,
    ajustarLista,
  }: {
    tabela: string;
    storageKey: string;
    tela: string;
    itens: Array<{ item: T; rotulo: string }>;
    lista: T[];
    setLista: (next: T[]) => void;
    /** Recalcula campos derivados da lista que fica (ex.: avisos do diesel). */
    ajustarLista?: (next: T[]) => T[];
  }) => {
    // Vários de uma vez gravam num lote só: chamadas seguidas enxergariam a
    // mesma lista antiga e só a última exclusão ficaria.
    const agora = new Date().toISOString();
    const novas = itens.map(({ item, rotulo }) => criarExclusao({
      tabela,
      registro: item as unknown as { id: string } & Record<string, unknown>,
      rotulo,
      usuario: activeUserName,
      agora,
    }));
    const ids = new Set(itens.map(({ item }) => item.id));
    const restantes = lista.filter(x => !ids.has(x.id));
    const updated = ajustarLista ? ajustarLista(restantes) : restantes;
    const nextExclusoes = [...novas, ...exclusoes];
    const nomes = itens.map(({ rotulo }) => `"${rotulo}"`).join(', ');
    saveAndLog(
      tela,
      'Excluiu',
      itens.length === 1 ? `Excluiu ${nomes}.` : `Excluiu ${itens.length} cadastros: ${nomes}.`,
      historyLogs,
      () => {
        commitStorageBatch(localStorage, [
          { key: storageKey, value: JSON.stringify(updated) },
          { key: STORAGE_KEYS.exclusoes, value: JSON.stringify(nextExclusoes) },
        ]);
        setLista(updated);
        setExclusoes(nextExclusoes);
      },
      {
        registroId: itens.map(({ item }) => item.id).join(','),
        valorAnterior: itens.length === 1 ? itens[0].item : itens.map(({ item }) => item),
        tipoOperacao: 'DELETE',
      },
    );
    return novas.map(exclusao => exclusao.id);
  };

  /** Tabelas que a aba Cadastros edita, com onde cada uma é guardada. */
  const tabelasCadastro = (): Record<string, { lista: Array<{ id: string; nome?: string }>; setLista: (next: never[]) => void; storageKey: string; tela: string }> => ({
    empresas: { lista: empresas, setLista: setEmpresas as (next: never[]) => void, storageKey: 'renea_empresas', tela: 'Empresas' },
    funcionarios: { lista: funcionarios, setLista: setFuncionarios as (next: never[]) => void, storageKey: 'renea_funcionarios', tela: 'Funcionários' },
    equipamentos: { lista: equipamentos, setLista: setEquipamentos as (next: never[]) => void, storageKey: 'renea_equipamentos', tela: 'Equipamentos' },
    obras: { lista: obras, setLista: setObras as (next: never[]) => void, storageKey: 'renea_obras', tela: 'Obras/Locais' },
    comboios: { lista: comboios, setLista: setComboios as (next: never[]) => void, storageKey: 'renea_comboios', tela: 'Comboios' },
    canteiros: { lista: canteiros, setLista: setCanteiros as (next: never[]) => void, storageKey: 'renea_canteiros', tela: 'Canteiros' },
    combustiveis: { lista: combustiveis, setLista: setCombustiveis as (next: never[]) => void, storageKey: 'renea_combustiveis', tela: 'Combustíveis' },
    lubrificantes: { lista: lubrificantes, setLista: setLubrificantes as (next: never[]) => void, storageKey: 'renea_lubrificantes', tela: 'Produtos Lubrificação' },
    etapas: { lista: etapas, setLista: setEtapas as (next: never[]) => void, storageKey: 'renea_etapas', tela: 'Etapas de Serviço' },
    frentesServico: { lista: frentesServico, setLista: setFrentesServico as (next: never[]) => void, storageKey: STORAGE_KEYS.frentesServico, tela: 'Frentes de Serviço' },
    servicosObra: { lista: servicosObra, setLista: setServicosObra as (next: never[]) => void, storageKey: STORAGE_KEYS.servicosObra, tela: 'Serviços da obra' },
    // Tickets repetidos vão para a Lixeira sozinhos; daqui eles voltam se restaurados.
    ticketsJazida: { lista: ticketsJazida as never[], setLista: setTicketsJazida as (next: never[]) => void, storageKey: 'renea_tickets_jazida', tela: 'Tickets Jazida' },
    gruposEquipe: { lista: gruposEquipe as never[], setLista: setGruposEquipe as (next: never[]) => void, storageKey: 'renea_grupos_equipes', tela: 'Grupos / Equipes' },
    // Abastecimento excluído vai para a Lixeira (A17): o Desfazer e a Lixeira devolvem por aqui.
    abastecimentos: { lista: abastecimentos as never[], setLista: setAbastecimentos as (next: never[]) => void, storageKey: 'renea_abastecimentos', tela: 'Abastecimentos' },
    // Lançamentos excluídos também deixam marca e voltam pela Lixeira (A12).
    lubrificacoes: { lista: lubrificacoes as never[], setLista: setLubrificacoes as (next: never[]) => void, storageKey: 'renea_lubrificacoes', tela: 'Lubrificações' },
    ordensServico: { lista: ordensServico as never[], setLista: setOrdensServico as (next: never[]) => void, storageKey: 'renea_ordens_servico', tela: 'Manutenção' },
    controleEquipamentosDiario: { lista: controleEquipamentosDiario as never[], setLista: setControleEquipamentosDiario as (next: never[]) => void, storageKey: 'renea_controle_equipamentos_diario', tela: 'Controle Diário de Equipamentos' },
    motoristasOperacionais: { lista: motoristasOperacionais as never[], setLista: setMotoristasOperacionais as (next: never[]) => void, storageKey: STORAGE_KEYS.motoristasOperacionais, tela: 'Motoristas operacionais' },
  });

  const usosDoCadastroAtual = (tabela: string, id: string) => usosDoCadastro(tabela, id, {
    empresas,
    funcionarios,
    equipamentos,
    abastecimentos,
    lubrificacoes,
    apontamentos: apontamentosOperacionais,
    ordensServico,
    listasPresenca,
    presencasLink,
    gruposEquipe,
    controleEquipamentosDiario: controleEquipamentosDiario as ReadonlyArray<ControleEquipamentoDiario & { local?: string }>,
    canteiros,
    materiaisMovimentos,
    frentesServico,
    producao: producaoRegistros,
    planejamento: planejamentoItens,
    colecoesDaObra: {
      Presenças: listasPresenca,
      Equipes: gruposEquipe,
      Frentes: frentesServico,
      Diários: diariosObra,
      Serviços: servicosObra,
      Produção: producaoRegistros,
      Planejamento: planejamentoItens,
      FVS: fichasFvs,
      Inspeções: inspecoes,
      'Não conformidades': naoConformidades,
      Medições: medicoes,
      Documentos: documentos,
      Ocorrências: ocorrencias,
      Custos: lancamentosCusto,
      Orçamentos: orcamentoItens,
    },
  });

  /**
   * Exclusão real pedida pela aba Cadastros. Só admin, e só de cadastro que
   * não aparece em nenhum lançamento: com uso, devolve onde ele aparece e a
   * tela oferece inativar.
   */
  type UsoRegistro = { collection: string; count: number };

  /**
   * Exclui vários cadastros da mesma tabela. O que está em uso fica de fora e
   * volta na lista de travados, com onde aparece; o resto sai num lote só.
   */
  const handleExcluirCadastros = (tabela: string, alvos: Array<{ id: string; rotulo: string }>): {
    excluidos: Array<{ id: string; rotulo: string; exclusaoId: string }>;
    travados: Array<{ id: string; rotulo: string; usos: UsoRegistro[] }>;
    mensagem?: string;
  } => {
    if (!pode(currentUserRole, 'cadastros', 'excluir')) {
      return { excluidos: [], travados: [], mensagem: 'Só o administrador pode excluir cadastros.' };
    }
    const alvo = tabelasCadastro()[tabela];
    if (!alvo) return { excluidos: [], travados: [], mensagem: 'Este tipo de cadastro não pode ser excluído por aqui.' };
    const porId = new Map(alvo.lista.map(item => [item.id, item]));
    const livres: Array<{ item: (typeof alvo.lista)[number]; rotulo: string }> = [];
    const travados: Array<{ id: string; rotulo: string; usos: UsoRegistro[] }> = [];
    alvos.forEach(({ id, rotulo }) => {
      const item = porId.get(id);
      if (!item) return;
      const usos = usosDoCadastroAtual(tabela, id);
      if (usos.length > 0) travados.push({ id, rotulo, usos });
      else livres.push({ item, rotulo });
    });
    if (livres.length === 0) return { excluidos: [], travados };
    const ids = excluirCadastros({ tabela, storageKey: alvo.storageKey, tela: alvo.tela, itens: livres, lista: alvo.lista, setLista: alvo.setLista as (next: typeof alvo.lista) => void });
    return { excluidos: livres.map(({ item, rotulo }, indice) => ({ id: item.id, rotulo, exclusaoId: ids[indice] })), travados };
  };

  const handleExcluirCadastro = (tabela: string, id: string, rotulo: string): { ok: true; exclusaoId: string } | { ok: false; usos: UsoRegistro[]; mensagem?: string } => {
    const alvo = tabelasCadastro()[tabela];
    if (pode(currentUserRole, 'cadastros', 'excluir') && !alvo?.lista.some(x => x.id === id)) {
      return { ok: false, usos: [], mensagem: 'Este cadastro não existe mais neste aparelho.' };
    }
    const resultado = handleExcluirCadastros(tabela, [{ id, rotulo }]);
    if (resultado.excluidos.length > 0) return { ok: true, exclusaoId: resultado.excluidos[0].exclusaoId };
    return { ok: false, usos: resultado.travados[0]?.usos || [], mensagem: resultado.mensagem };
  };

  /**
   * Devolve os cadastros guardados nas exclusões e marca as exclusões como
   * desfeitas, tudo num lote só (o Desfazer de uma exclusão em lote passa aqui).
   */
  const handleRestaurarCadastros = (exclusaoIds: string[]): { ok: boolean; mensagem: string } => {
    const pedidos = new Set(exclusaoIds);
    const pendentes = exclusoes.filter(item => pedidos.has(item.id) && !item.restauradoEm && !item.apagadoEm);
    if (pendentes.length === 0) return { ok: false, mensagem: exclusaoIds.length === 1 ? 'Este cadastro já foi restaurado ou excluído de vez.' : 'Estes cadastros já foram restaurados ou excluídos de vez.' };
    const tabelas = tabelasCadastro();
    const agora = new Date().toISOString();
    const listas = new Map<string, Array<{ id: string }>>();
    const restaurados: typeof pendentes = [];
    const erros: string[] = [];
    pendentes.forEach(exclusao => {
      const alvo = tabelas[exclusao.tabela];
      if (!alvo) {
        erros.push(`${exclusao.rotulo}: este tipo não pode ser restaurado por aqui.`);
        return;
      }
      const lista = listas.get(exclusao.tabela) || alvo.lista;
      if (lista.some(item => item.id === exclusao.registroId)) {
        restaurados.push(exclusao);
        return;
      }
      const registro = { ...exclusao.registro, id: exclusao.registroId } as { id: string };
      if (['empresas', 'funcionarios', 'equipamentos', 'obras'].includes(exclusao.tabela)) {
        const problemas = validateCentralRecord({ empresas, equipamentos, funcionarios, obras, record: registro as Empresa });
        if (problemas.length > 0) {
          erros.push(`${exclusao.rotulo}: ${problemas.join(' ')}`);
          return;
        }
      }
      const restaurado = ['empresas', 'funcionarios'].includes(exclusao.tabela) ? { ...registro, atualizadoEm: agora } : registro;
      listas.set(exclusao.tabela, [...lista, restaurado]);
      restaurados.push(exclusao);
    });
    if (restaurados.length === 0) return { ok: false, mensagem: `Não deu para restaurar: ${erros.join(' ')}` };
    const feitos = new Set(restaurados.map(item => item.id));
    const nextExclusoes = exclusoes.map(item => (feitos.has(item.id) ? restaurarExclusao(item, activeUserName, agora) : item));
    const nomes = restaurados.map(item => `"${item.rotulo}"`).join(', ');
    saveAndLog(
      tabelas[restaurados[0].tabela]?.tela || 'Cadastros',
      'Restaurou',
      restaurados.length === 1 ? `Restaurou ${nomes} da Lixeira.` : `Restaurou ${restaurados.length} cadastros da Lixeira: ${nomes}.`,
      historyLogs,
      () => {
        commitStorageBatch(localStorage, [
          ...Array.from(listas, ([tabela, lista]) => ({ key: tabelas[tabela].storageKey, value: JSON.stringify(lista) })),
          { key: STORAGE_KEYS.exclusoes, value: JSON.stringify(nextExclusoes) },
        ]);
        listas.forEach((lista, tabela) => tabelas[tabela].setLista(lista as never[]));
        setExclusoes(nextExclusoes);
      },
      { registroId: restaurados.map(item => item.registroId).join(','), valorNovo: restaurados.map(item => item.registro), tipoOperacao: 'RESTORE' },
    );
    const texto = restaurados.length === 1 ? `${restaurados[0].rotulo} voltou para a lista.` : `${restaurados.length} cadastros voltaram para a lista.`;
    return { ok: erros.length === 0, mensagem: erros.length === 0 ? texto : `${texto} Não voltaram: ${erros.join(' ')}` };
  };

  const handleRestaurarCadastro = (exclusaoId: string) => handleRestaurarCadastros([exclusaoId]);

  // Locais na Lixeira: a lista SGE de Materiais não oferece de novo o que foi apagado.
  const locaisApagados = useMemo(() => new Set(exclusoes.filter(item => item.tabela === 'etapas' && !item.restauradoEm).map(item => item.registroId)), [exclusoes]);

  /**
   * Tira da Lixeira e joga fora a cópia guardada. A marca de exclusão fica,
   * para nenhum aparelho publicar o cadastro de volta. Não tem desfazer.
   */
  const handleApagarDeVez = (exclusaoIds: string[]): { ok: boolean; mensagem: string } => {
    if (!pode(currentUserRole, 'cadastros', 'excluir')) {
      return { ok: false, mensagem: 'Só o administrador pode excluir de vez.' };
    }
    const pedidos = new Set(exclusaoIds);
    const alvos = exclusoes.filter(item => pedidos.has(item.id) && !item.restauradoEm && !item.apagadoEm);
    if (alvos.length === 0) return { ok: false, mensagem: 'Nada para excluir de vez: a Lixeira já mudou.' };
    const agora = new Date().toISOString();
    const feitos = new Set(alvos.map(item => item.id));
    const nextExclusoes = exclusoes.map(item => (feitos.has(item.id) ? apagarDeVez(item, activeUserName, agora) : item));
    const nomes = alvos.map(item => `"${item.rotulo}"`).join(', ');
    saveAndLog(
      tabelasCadastro()[alvos[0].tabela]?.tela || 'Cadastros',
      'Excluiu',
      alvos.length === 1 ? `Excluiu de vez ${nomes} da Lixeira.` : `Excluiu de vez ${alvos.length} cadastros da Lixeira: ${nomes}.`,
      historyLogs,
      () => {
        commitStorageBatch(localStorage, [{ key: STORAGE_KEYS.exclusoes, value: JSON.stringify(nextExclusoes) }]);
        setExclusoes(nextExclusoes);
      },
      { registroId: alvos.map(item => item.registroId).join(','), tipoOperacao: 'DELETE' },
    );
    return { ok: true, mensagem: alvos.length === 1 ? `${alvos[0].rotulo} foi excluído de vez.` : `${alvos.length} cadastros foram excluídos de vez.` };
  };

  const handleSaveEquipamento = (item: Equipamento, isNew: boolean) => {
    const previous = equipamentos.find(x => x.id === item.id);
    const errors = validateCentralRecord({ empresas, equipamentos, funcionarios, obras, record: item });
    if (errors.length > 0) {
      addNotification('Cadastro não salvo', errors.join(' '), 'warning', 'Sistema Local');
      return;
    }
    const updated = saveRegistryItem(equipamentos, item, isNew);
    saveAndLog(
      'Equipamentos', 
      isNew ? 'Criou' : 'Editou', 
      `${isNew ? 'Cadastrou' : 'Editou'} o equipamento "${item.prefixo} - ${item.nome}" com status "${item.status}".`,
      historyLogs,
      () => {
        setEquipamentos(updated);
        writeStorageValue(localStorage, 'renea_equipamentos', JSON.stringify(updated));
      },
      { registroId: item.id, valorAnterior: previous, valorNovo: item, tipoOperacao: isNew ? 'CREATE' : 'UPDATE' },
    );
  };

  const handleAplicarCadastroSge = (previa: PreviaCadastroSge) => {
    if (!previa.alteracoes.length) return;
    const now = new Date().toISOString();
    const nextEquipment = aplicarCadastroSge(equipamentos, previa, funcionarios);
    const trocas = previa.alteracoes.filter(item => item.motorista);
    const equipamentosTrocados = new Set(trocas.map(item => item.equipamentoId));
    const motoristasNovos = new Set(trocas.map(item => item.motorista?.funcionarioId).filter(Boolean));
    const closedLinks = vinculosOperadorEquipamento.map(link =>
      link.status === 'ATIVO' && (equipamentosTrocados.has(link.equipamentoId) || motoristasNovos.has(link.funcionarioId))
        ? { ...link, status: 'ENCERRADO' as const, fimEm: now, atualizadoEm: now }
        : link,
    );
    const newLinks: VinculoOperadorEquipamento[] = trocas.flatMap(item => {
      const funcionario = funcionarios.find(person => person.id === item.motorista?.funcionarioId);
      if (!funcionario) return [];
      return [{
        id: `vinculo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        funcionarioId: funcionario.id,
        funcionarioNome: funcionario.nome,
        equipamentoId: item.equipamentoId,
        equipamentoPrefixo: item.prefixo,
        inicioEm: now,
        status: 'ATIVO' as const,
        responsavelAlteracao: activeUserName,
        observacao: 'Último operador no apontamento do SGE.',
        criadoEm: now,
        atualizadoEm: now,
      }];
    });
    const nextLinks = [...newLinks, ...closedLinks];
    saveAndLog(
      'Equipamentos',
      'Editou',
      `Atualizou pelo apontamento do SGE: ${previa.equipamentosNovos} equipamento(s) cadastrado(s), ${previa.equipamentosReativados} de volta ao quadro, ${previa.motoristasVinculados} motorista(s) vinculado(s), ${previa.motoristasRetirados} retirado(s) e ${previa.horimetrosAtualizados} horímetro(s).`,
      historyLogs,
      () => {
        setEquipamentos(nextEquipment);
        setVinculosOperadorEquipamento(nextLinks);
        writeStorageValue(localStorage, 'renea_equipamentos', JSON.stringify(nextEquipment));
        writeStorageValue(localStorage, 'renea_vinculos_operador_equipamento', JSON.stringify(nextLinks));
      },
      { registroId: 'sge-cadastro', valorAnterior: previa.alteracoes.map(item => ({ prefixo: item.prefixo, motorista: item.motorista?.antes, horimetro: item.horimetro?.antes })), valorNovo: previa.alteracoes.map(item => ({ prefixo: item.prefixo, motorista: item.motorista?.depois, horimetro: item.horimetro?.depois })), tipoOperacao: 'UPDATE' },
    );
  };

  const handleDeleteEquipamento = (id: string) => {
    const item = equipamentos.find(x => x.id === id);
    if (!item) return;
    const next = inactivateEquipamento(item);
    const updated = saveRegistryItem(equipamentos, next, false);
    saveAndLog(
      'Equipamentos', 
      'Desmobilizou',
      `Desmobilizou o equipamento/veículo "${item.prefixo} - ${item.nome}".`,
      historyLogs,
      () => {
        setEquipamentos(updated);
        writeStorageValue(localStorage, 'renea_equipamentos', JSON.stringify(updated));
      },
      { registroId: id, valorAnterior: item, valorNovo: next, tipoOperacao: 'UPDATE' },
    );
  };

  const handleSaveFuncionario = (item: Funcionario, isNew: boolean) => {
    const now = new Date().toISOString();
    const previous = funcionarios.find(x => x.id === item.id);
    const normalizedItem = normalizeFuncionario(item, previous, now);
    const errors = validateCentralRecord({ empresas, equipamentos, funcionarios, obras, record: normalizedItem });
    if (errors.length > 0) {
      addNotification('Cadastro não salvo', errors.join(' '), 'warning', 'Sistema Local');
      return;
    }
    const updated = saveRegistryItem(funcionarios, normalizedItem, isNew);
    saveAndLog(
      'Funcionários', 
      isNew ? 'Criou' : 'Editou', 
      `${isNew ? 'Cadastrou' : 'Editou'} o colaborador "${normalizedItem.nome}" (${normalizedItem.cargo}).`,
      historyLogs,
      () => {
        setFuncionarios(updated);
        writeStorageValue(localStorage, 'renea_funcionarios', JSON.stringify(updated));
      },
      { registroId: normalizedItem.id, valorAnterior: previous, valorNovo: normalizedItem, tipoOperacao: isNew ? 'CREATE' : 'UPDATE' },
    );
  };

  const handleSaveOperationalDriver = (item: Funcionario, isNew: boolean) => {
    const matricula = String(item.matricula || '').trim();
    const duplicate = motoristasOperacionais.some(driver => driver.id !== item.id && String(driver.matricula || '').trim() === matricula);
    if (!matricula || !item.nome.trim() || duplicate) {
      addNotification(
        'Motorista não salvo',
        duplicate ? 'Já existe motorista operacional com esta matrícula.' : 'Informe matrícula e nome.',
        'warning',
        'Sistema Local',
      );
      return;
    }
    const next = isNew ? [...motoristasOperacionais, item] : motoristasOperacionais.map(driver => driver.id === item.id ? item : driver);
    saveAndLog('Motoristas operacionais', isNew ? 'Criou' : 'Editou', `${isNew ? 'Cadastrou' : 'Editou'} o motorista "${item.nome}" (${matricula}).`, historyLogs, () => {
      setMotoristasOperacionais(next);
      writeStorageValue(localStorage, STORAGE_KEYS.motoristasOperacionais, JSON.stringify(next));
    }, { registroId: item.id, valorNovo: item, tipoOperacao: isNew ? 'CREATE' : 'UPDATE' });
  };

  const handleAddOperationalDrivers = (items: Funcionario[]) => {
    const matriculas = new Set(motoristasOperacionais.map(driver => String(driver.matricula || '').trim()));
    const novos = items.filter(item => {
      const matricula = String(item.matricula || '').trim();
      if (!matricula || !item.nome.trim() || matriculas.has(matricula)) return false;
      matriculas.add(matricula);
      return true;
    });
    if (!novos.length) return;
    const next = [...motoristasOperacionais, ...novos];
    saveAndLog('Motoristas operacionais', 'Criou', `Incluiu ${novos.length} motorista(s) pela lista de operadores do Controle de Frotas.`, historyLogs, () => {
      setMotoristasOperacionais(next);
      writeStorageValue(localStorage, STORAGE_KEYS.motoristasOperacionais, JSON.stringify(next));
    }, { tipoOperacao: 'CREATE' });
  };

  const handleDeleteOperationalDriver = (id: string) => {
    if (exclusaoRecusada(podeExcluirCadastro)) return;
    const motorista = motoristasOperacionais.find(driver => driver.id === id);
    if (!motorista) return;
    excluirCadastros({
      tabela: 'motoristasOperacionais',
      storageKey: STORAGE_KEYS.motoristasOperacionais,
      tela: 'Motoristas operacionais',
      itens: [{ item: motorista, rotulo: motorista.nome || id }],
      lista: motoristasOperacionais,
      setLista: setMotoristasOperacionais,
    });
  };

  const handleDeleteFuncionario = (id: string) => {
    const item = funcionarios.find(x => x.id === id);
    if (!item) return;
    const next = inactivateFuncionario(item, new Date().toISOString());
    const updated = saveRegistryItem(funcionarios, next, false);
    saveAndLog(
      'Funcionários', 
      'Desmobilizou',
      `Desmobilizou o colaborador "${item.nome}".`,
      historyLogs,
      () => {
        setFuncionarios(updated);
        writeStorageValue(localStorage, 'renea_funcionarios', JSON.stringify(updated));
      },
      { registroId: id, valorAnterior: item, valorNovo: next, tipoOperacao: 'UPDATE' },
    );
  };

  const handleSaveComboio = (recebido: Comboio, isNew: boolean) => {
    const item: Comboio = { ...recebido, atualizadoEm: new Date().toISOString() };
    let updated;
    if (isNew) {
      updated = [...comboios, item];
    } else {
      updated = comboios.map(x => x.id === item.id ? item : x);
    }
    saveAndLog(
      'Comboios', 
      isNew ? 'Criou' : 'Editou', 
      `${isNew ? 'Cadastrou' : 'Editou'} o comboio "${item.nome}" com placa ${item.placa}.`,
      historyLogs,
      () => {
        setComboios(updated);
        writeStorageValue(localStorage, 'renea_comboios', JSON.stringify(updated));
      }
    );
  };



  const renomearCanteiroNosLancamentos = (nomeAntigo: string, nomeNovo: string) => {
    const registros = controleEquipamentosDiario as Array<ControleEquipamentoDiario & { local?: string }>;
    const { afetados, atualizados } = registrosComCanteiroRenomeado(registros, nomeAntigo, nomeNovo);
    if (!afetados.length) return;
    const updated = atualizados as ControleEquipamentoDiario[];
    saveAndLog(
      'Controle Diário de Equipamentos',
      'Editou',
      `Canteiro "${nomeAntigo}" renomeado para "${nomeNovo}": atualizou ${afetados.length} lançamento(s) antigo(s).`,
      historyLogs,
      () => {
        setControleEquipamentosDiario(updated);
        writeStorageValue(localStorage, 'renea_controle_equipamentos_diario', JSON.stringify(updated));
      },
    );
  };

  const handleSaveCanteiro = (recebido: Canteiro, isNew: boolean) => {
    const item: Canteiro = { ...recebido, atualizadoEm: new Date().toISOString() };
    const anterior = isNew ? undefined : canteiros.find(x => x.id === item.id);
    const updated = isNew ? [...canteiros, item] : canteiros.map(x => (x.id === item.id ? item : x));
    saveAndLog(
      'Canteiros',
      isNew ? 'Criou' : 'Editou',
      `${isNew ? 'Cadastrou' : 'Editou'} o canteiro "${item.nome}".`,
      historyLogs,
      () => {
        setCanteiros(updated);
        writeStorageValue(localStorage, 'renea_canteiros', JSON.stringify(updated));
      }
    );
    if (anterior && anterior.nome.trim() !== item.nome.trim()) {
      renomearCanteiroNosLancamentos(anterior.nome, item.nome);
    }
  };

  const handleSaveTipoCombustivel = (item: TipoCombustivel, isNew: boolean) => {
    let updated;
    if (isNew) {
      updated = [...combustiveis, item];
    } else {
      updated = combustiveis.map(x => x.id === item.id ? item : x);
    }
    saveAndLog(
      'Combustíveis', 
      isNew ? 'Criou' : 'Editou', 
      `${isNew ? 'Cadastrou' : 'Editou'} o tipo de combustível "${item.nome}".`,
      historyLogs,
      () => {
        setCombustiveis(updated);
        writeStorageValue(localStorage, 'renea_combustiveis', JSON.stringify(updated));
      }
    );
  };

  const handleSaveProdutoLubrificacao = (item: ProdutoLubrificacao, isNew: boolean) => {
    let updated;
    if (isNew) {
      updated = [...lubrificantes, item];
    } else {
      updated = lubrificantes.map(x => x.id === item.id ? item : x);
    }
    saveAndLog(
      'Produtos Lubrificação', 
      isNew ? 'Criou' : 'Editou', 
      `${isNew ? 'Cadastrou' : 'Editou'} o lubrificante "${item.nome}".`,
      historyLogs,
      () => {
        setLubrificantes(updated);
        writeStorageValue(localStorage, 'renea_lubrificantes', JSON.stringify(updated));
      }
    );
  };

  const handleSaveEtapaServico = (item: EtapaServico, isNew: boolean) => {
    let updated;
    if (isNew) {
      updated = [...etapas, item];
    } else {
      updated = etapas.map(x => x.id === item.id ? item : x);
    }
    saveAndLog(
      'Etapas de Serviço', 
      isNew ? 'Criou' : 'Editou', 
      `${isNew ? 'Cadastrou' : 'Editou'} a etapa/ramo "${item.nome}".`,
      historyLogs,
      () => {
        setEtapas(updated);
        writeStorageValue(localStorage, 'renea_etapas', JSON.stringify(updated));
      }
    );
  };

  // Materiais grava ramos em lote (lista SGE, apelidos da planilha): um só
  // registro no histórico e uma só gravação, sem apagar nenhum ramo.
  const handleSaveEtapasServico = (itens: EtapaServico[], descricao: string) => {
    if (!itens.length) return;
    const porId = new Map(itens.map(item => [item.id, item]));
    const existentes = new Set(etapas.map(item => item.id));
    const updated = [...etapas.map(item => porId.get(item.id) ?? item), ...itens.filter(item => !existentes.has(item.id))];
    saveAndLog('Etapas de Serviço', itens.some(item => !existentes.has(item.id)) ? 'Criou' : 'Editou', descricao, historyLogs, () => {
      setEtapas(updated);
      writeStorageValue(localStorage, 'renea_etapas', JSON.stringify(updated));
    });
  };

  // Previsto de material por ramo e mês: grava em lote (copiar do mês anterior)
  // com um registro só no histórico. Tirar um previsto só desliga, não apaga.
  const handleSaveMateriaisPrevistos = (itens: PrevistoMaterial[], descricao: string) => {
    if (!itens.length) return;
    const porId = new Map(itens.map(item => [item.id, item]));
    const existentes = new Set(materiaisPrevistos.map(item => item.id));
    const updated = [...materiaisPrevistos.map(item => porId.get(item.id) ?? item), ...itens.filter(item => !existentes.has(item.id))];
    const acao = itens.some(item => !existentes.has(item.id)) ? 'Criou' : itens.every(item => item.ativo === false) ? 'Excluiu' : 'Editou';
    saveAndLog('Materiais', acao, descricao, historyLogs, () => {
      setMateriaisPrevistos(updated);
      writeStorageValue(localStorage, STORAGE_KEYS.materiaisPrevistos, JSON.stringify(updated));
    });
  };

  // Rotina do assistente (Meu dia): o dia de cada pessoa e as pendências que
  // passam de um dia para o outro. Marcar o checklist não entra no histórico
  // para não encher a auditoria com um registro por clique.
  const handleSaveRotinaDiaria = (rotina: RotinaDiaria) => {
    const updated = rotinasDiarias.some(item => item.id === rotina.id)
      ? rotinasDiarias.map(item => (item.id === rotina.id ? rotina : item))
      : [...rotinasDiarias, rotina];
    setRotinasDiarias(updated);
    writeStorageValue(localStorage, STORAGE_KEYS.rotinasDiarias, JSON.stringify(updated));
  };

  // Excluir uma pendência marca excluidaEm (a nuvem não traz de volta) e só
  // acontece quando a própria pessoa confirma na tela.
  const handleSavePendenciaRotina = (pendencia: PendenciaRotina, descricao: string, acao: HistoryLog['acao']) => {
    const updated = pendenciasRotina.some(item => item.id === pendencia.id)
      ? pendenciasRotina.map(item => (item.id === pendencia.id ? pendencia : item))
      : [...pendenciasRotina, pendencia];
    saveAndLog('Meu dia', acao, descricao, historyLogs, () => {
      setPendenciasRotina(updated);
      writeStorageValue(localStorage, STORAGE_KEYS.pendenciasRotina, JSON.stringify(updated));
    });
  };

  // O checklist do jeito de cada pessoa (um modelo por pessoa).
  const handleSaveModeloRotina = (modelo: ModeloRotina, descricao: string) => {
    const updated = [...modelosRotina.filter(item => item.id !== modelo.id), modelo];
    saveAndLog('Meu dia', 'Editou', descricao, historyLogs, () => {
      setModelosRotina(updated);
      writeStorageValue(localStorage, STORAGE_KEYS.modelosRotina, JSON.stringify(updated));
    });
  };

  const handleImportCadastros = (target: CadastroImportTarget, rows: CadastroImportRow[]) => {
    const validRows = rows.filter(row => Object.values(row).some(value => String(value || '').trim()));
    if (validRows.length === 0) {
      return { success: false, message: 'Nenhuma linha válida foi encontrada na planilha.' };
    }

    const now = Date.now();
    const findEmpresaId = (value: string) => {
      const normalized = normalizeImportText(value);
      if (!normalized) return empresas[0]?.id || '';
      return empresas.find(empresa =>
        empresa.id === value ||
        normalizeImportText(empresa.nome).includes(normalized) ||
        normalized.includes(normalizeImportText(empresa.nome)) ||
        normalizeImportText(empresa.cnpj) === normalized
      )?.id || empresas[0]?.id || '';
    };
    const findObraId = (value: string) => {
      const normalized = normalizeImportText(value);
      if (!normalized) return obras[0]?.id || '';
      return obras.find(obra =>
        obra.id === value ||
        normalizeImportText(obra.nome).includes(normalized) ||
        normalized.includes(normalizeImportText(obra.nome))
      )?.id || obras[0]?.id || '';
    };
    const statusObra = (value: string): ObraLocal['status'] => {
      const normalized = normalizeImportText(value);
      if (normalized.includes('conclu')) return 'Concluída';
      if (normalized.includes('planej')) return 'Planejada';
      return 'Ativa';
    };
    const statusEquipamento = (value: string): Equipamento['status'] => {
      const normalized = normalizeImportText(value);
      if (normalized.includes('manut')) return 'Manutenção';
      if (normalized.includes('desmobil')) return 'Desmobilizado';
      if (normalized.includes('mobil')) return 'Mobilizado';
      if (normalized.includes('motorista')) return 'Esperando motorista';
      if (normalized.includes('parad')) return 'Parado';
      return 'Ativo';
    };
    const persistImport = <T,>(
      tableName: string,
      storageKey: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      next: T[],
      importedCount: number,
      created: number,
      updated: number
    ) => {
      const message = `Importou ${importedCount} registro(s) por planilha em ${tableName}: ${created} novo(s), ${updated} atualizado(s).`;
      saveAndLog(tableName, 'Criou', message, historyLogs, () => {
        setter(next);
        writeStorageValue(localStorage, storageKey, JSON.stringify(next));
      });
      return { success: true, message };
    };

    // Toda aba de empresa (inclusive Terceiras e as subáreas de fornecedor)
    // importa como empresa com as classes do tipo escolhido. Antes, importar
    // em Terceiras caía no fim desta função e gravava as linhas como Ramos.
    if (isCategoriaEmpresa(target)) {
      const incoming = validRows.map((row, index): Empresa | null => {
        const cnpj = getImportValue(row, ['cnpj', 'documento']);
        const nome = getImportValue(row, ['nome', 'empresa', 'nome fantasia', 'razao social', 'razão social']) || cnpj || `Empresa ${index + 1}`;
        return {
          id: `emp-import-${now}-${index}`,
          nome,
          cnpj,
          telefone: getImportValue(row, ['telefone', 'contato', 'celular']),
          responsavel: getImportValue(row, ['responsavel', 'responsável', 'gestor']),
          tipos: [...TIPOS_POR_CATEGORIA_EMPRESA[target]],
          status: normalizeImportText(getImportValue(row, ['status', 'situacao', 'situação'])).includes('inativo') ? 'INATIVO' : 'ATIVO',
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
        };
      }).filter(Boolean) as Empresa[];
      if (incoming.length === 0) return { success: false, message: 'Nenhuma empresa foi encontrada na planilha.' };
      const statusProvided = new Set(incoming.filter((_, index) => getImportValue(validRows[index], ['status', 'situacao', 'situação'])).map(item => item.id));
      const result = mergeImportedRecords(
        empresas, incoming, item => normalizeImportText(item.cnpj || item.nome),
        (saved, sheet) => mergeEmpresaImport(saved, sheet, statusProvided.has(sheet.id)),
      );
      return persistImport(categoriaCadastro(target).label, 'renea_empresas', setEmpresas, result.next, incoming.length, result.created, result.updated);
    }

    if (target === 'obras') {
      const incoming = validRows.map((row, index): ObraLocal | null => {
        const endereco = getImportValue(row, ['endereco', 'endereço', 'cidade', 'localizacao', 'localização']);
        const nome = getImportValue(row, ['nome', 'obra', 'local', 'canteiro']) || endereco || `Obra ${index + 1}`;
        return {
          id: `obr-import-${now}-${index}`,
          nome,
          endereco,
          responsavel: getImportValue(row, ['responsavel', 'responsável', 'engenheiro', 'gestor']),
          status: statusObra(getImportValue(row, ['status', 'situacao', 'situação']))
        };
      }).filter(Boolean) as ObraLocal[];
      if (incoming.length === 0) return { success: false, message: 'Nenhuma obra/local foi encontrada na planilha.' };
      const result = mergeImportedRecords(obras, incoming, item => normalizeImportText(item.nome));
      return persistImport('Obras/Locais', 'renea_obras', setObras, result.next, incoming.length, result.created, result.updated);
    }

    if (target === 'equipamentos' || target === 'veiculos') {
      const incoming = validRows.map((row, index): Equipamento | null => {
        const seriePlaca = getImportValue(row, ['serie', 'série', 'numero serie', 'número série', 'numero de serie', 'número de série', 'serie placa', 'série placa']).toUpperCase();
        const placa = getImportValue(row, ['placa', 'placa veiculo', 'placa veículo']).toUpperCase();
        const prefixo = (getImportValue(row, ['prefixo', 'frota', 'codigo', 'código', 'id frota']) || placa || seriePlaca || `EQ-${index + 1}`).toUpperCase();
        const tipo = getImportValue(row, ['tipo', 'tipo equipamento', 'categoria']) || 'Outro';
        const nome = getImportValue(row, ['nome', 'equipamento', 'descricao', 'descrição', 'maquina', 'máquina']) || tipo || prefixo;
        const familia = getImportValue(row, ['familia', 'família']);
        const categoryText = normalizeImportText(getImportValue(row, ['categoria frota', 'categoria da frota', 'classe frota']));
        const categoriaFrota: NonNullable<Equipamento['categoriaFrota']> = target === 'veiculos'
          ? 'Veículo'
          : categoryText.includes('implement')
          ? 'Implemento'
          : categoryText.includes('veicul')
            ? 'Veículo'
            : inferFleetCategory(nome, familia, placa, 'equipment');
        const operatorName = getImportValue(row, ['operador', 'responsavel', 'responsável', 'operador responsavel', 'operador responsável']);
        const operator = funcionarios.find(item => normalizeImportText(item.nome) === normalizeImportText(operatorName));
        const fuelName = getImportValue(row, ['combustivel', 'combustível', 'tipo combustivel', 'tipo combustível']);
        const fuel = combustiveis.find(item => normalizeImportText(item.nome) === normalizeImportText(fuelName));
        const mobilizedText = normalizeImportText(getImportValue(row, ['mobilizado', 'mobilizacao', 'mobilização']));
        const targetAvailability = normalizeAvailabilityTarget(getImportValue(row, ['meta disponibilidade', 'metadispmec', 'disponibilidade meta']));
        return {
          id: `eq-import-${now}-${index}`,
          prefixo,
          nome,
          tipo,
          marca: getImportValue(row, ['marca']),
          modelo: getImportValue(row, ['modelo']),
          seriePlaca,
          placa: placa || undefined,
          empresaId: findEmpresaId(getImportValue(row, ['empresa', 'proprietario', 'proprietário', 'empresa proprietaria', 'empresa proprietária'])),
          status: statusEquipamento(getImportValue(row, ['status', 'situacao', 'situação'])),
          localAtualId: findObraId(getImportValue(row, ['obra', 'local', 'canteiro', 'local atual', 'obra atual'])),
          observacao: getImportValue(row, ['observacao', 'observação', 'obs']),
          horasDisponiveis: numberFromImport(getImportValue(row, ['horas disponiveis', 'horas disponíveis', 'horas disp'])),
          horasIndisponiveis: numberFromImport(getImportValue(row, ['horas indisponiveis', 'horas indisponíveis', 'horas manutencao', 'horas manutenção'])),
          categoriaFrota,
          codigoSge: getImportValue(row, ['codigo sge', 'código sge', 'dpara', 'sge']) || undefined,
          familia: familia || undefined,
          mobilizado: ['sim', 'true', '1', 'mobilizado'].includes(mobilizedText),
          metaDisponibilidade: targetAvailability ?? undefined,
          dataMobilizacao: getImportValue(row, ['data mobilizacao', 'data mobilização', 'datamob']) || undefined,
          dataDesmobilizacao: getImportValue(row, ['data desmobilizacao', 'data desmobilização', 'datadesmob']) || undefined,
          operadorResponsavelId: operator?.id,
          operadorResponsavelNome: operator?.nome || operatorName || undefined,
          combustivelId: fuel?.id,
          capacidadeTanqueLitros: numberFromImport(getImportValue(row, ['capacidade tanque', 'capacidade tanque l', 'capacidade'])) || undefined,
        };
      }).filter(Boolean) as Equipamento[];
      if (incoming.length === 0) return { success: false, message: 'Nenhum equipamento foi encontrado na planilha.' };
      const statusProvided = new Set(incoming.filter((_, index) => getImportValue(validRows[index], ['status', 'situacao', 'situação'])).map(item => item.id));
      const mobilizationProvided = new Set(incoming.filter((_, index) => getImportValue(validRows[index], ['mobilizado', 'mobilizacao', 'mobilização'])).map(item => item.id));
      const result = mergeImportedRecords(
        equipamentos, incoming, item => normalizeImportText(item.prefixo),
        (saved, sheet) => mergeEquipamentoImport(saved, sheet, statusProvided.has(sheet.id), mobilizationProvided.has(sheet.id)),
      );
      return persistImport(target === 'veiculos' ? 'Veículos' : 'Equipamentos', 'renea_equipamentos', setEquipamentos, result.next, incoming.length, result.created, result.updated);
    }

    if (target === 'funcionarios') {
      const incoming = validRows.map((row, index): Funcionario | null => {
        const matricula = getImportValue(row, ['matricula', 'matrícula']);
        const nome = getImportValue(row, ['nome', 'funcionario', 'funcionário', 'colaborador']) || matricula || `Colaborador ${index + 1}`;
        const ativoValue = normalizeImportText(getImportValue(row, ['ativo', 'status', 'situacao', 'situação']));
        return {
          id: matricula || `fun-import-${now}-${index}`,
          matricula: matricula || undefined,
          nome,
          cargo: getImportValue(row, ['cargo', 'funcao', 'função']) || 'A definir',
          telefone: getImportValue(row, ['telefone', 'contato', 'celular']),
          empresaId: findEmpresaId(getImportValue(row, ['empresa', 'vinculo', 'vínculo'])),
          ativo: !ativoValue.includes('inativo') && !ativoValue.includes('desmobil'),
          status: ativoValue.includes('desmobil') ? 'DESMOBILIZADO'
            : ativoValue.includes('inativo') ? 'INATIVO'
              : ativoValue.includes('ferias') ? 'FÉRIAS'
                : ativoValue.includes('afast') ? 'AFASTADO' : 'ATIVO',
          liderMatricula: getImportValue(row, ['matricula lider', 'matrícula líder']) || undefined,
          liderNome: getImportValue(row, ['lider', 'líder', 'encarregado']) || undefined,
          area: getImportValue(row, ['area', 'área']) || undefined,
          responsavelArea: getImportValue(row, ['responsavel area', 'responsável área']) || undefined,
          divisao: getImportValue(row, ['divisao', 'divisão']) || undefined,
          secao: getImportValue(row, ['secao', 'seção']) || undefined,
          dataMobilizacao: getImportValue(row, ['data mobilizacao', 'data mobilização']) || undefined,
          dataDesmobilizacao: getImportValue(row, ['data desmobilizacao', 'data desmobilização']) || undefined,
          situacaoRh: getImportValue(row, ['situacao rh', 'situação rh']) || undefined,
          observacao: getImportValue(row, ['observacao', 'observação']) || undefined,
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
        };
      }).filter(Boolean) as Funcionario[];
      if (incoming.length === 0) return { success: false, message: 'Nenhum funcionário foi encontrado na planilha.' };
      const statusProvided = new Set(incoming.filter((_, index) => getImportValue(validRows[index], ['ativo', 'status', 'situacao', 'situação'])).map(item => item.id));
      const result = mergeImportedRecords(
        funcionarios, incoming, item => normalizeImportText(item.matricula || item.nome),
        (saved, sheet) => mergeFuncionarioImport(saved, sheet, statusProvided.has(sheet.id)),
      );
      return persistImport('Funcionários', 'renea_funcionarios', setFuncionarios, result.next, incoming.length, result.created, result.updated);
    }

    if (target === 'comboios') {
      const incoming = validRows.map((row, index): Comboio | null => {
        const placa = getImportValue(row, ['placa']).toUpperCase();
        const nome = getImportValue(row, ['nome', 'comboio', 'identificacao', 'identificação']) || placa || `Comboio ${index + 1}`;
        return {
          id: `com-import-${now}-${index}`,
          nome,
          placa,
          capacidadeLitros: numberFromImport(getImportValue(row, ['capacidade', 'capacidade litros', 'litros'])) || 3000,
          responsavel: getImportValue(row, ['responsavel', 'responsável', 'motorista'])
        };
      }).filter(Boolean) as Comboio[];
      if (incoming.length === 0) return { success: false, message: 'Nenhum comboio foi encontrado na planilha.' };
      const result = mergeImportedRecords(comboios, incoming, item => normalizeImportText(item.placa || item.nome));
      return persistImport('Comboios', 'renea_comboios', setComboios, result.next, incoming.length, result.created, result.updated);
    }

    const simpleAliases = target === 'combustiveis'
      ? ['nome', 'combustivel', 'combustível', 'tipo']
      : target === 'lubrificantes'
      ? ['nome', 'lubrificante', 'produto']
      : ['nome', 'etapa', 'servico', 'serviço', 'ramo'];
    const incomingSimple = validRows.map((row, index) => {
      const nome = getImportValue(row, simpleAliases);
      return nome ? { id: `${target.slice(0, 3)}-import-${now}-${index}`, nome } : null;
    }).filter(Boolean) as Array<TipoCombustivel | ProdutoLubrificacao | EtapaServico>;
    if (incomingSimple.length === 0) return { success: false, message: 'Nenhum item com nome foi encontrado na planilha.' };

    if (target === 'combustiveis') {
      const incoming = incomingSimple as TipoCombustivel[];
      const result = mergeImportedRecords(combustiveis, incoming, item => normalizeImportText(item.nome));
      return persistImport('Combustíveis', 'renea_combustiveis', setCombustiveis, result.next, incoming.length, result.created, result.updated);
    }
    if (target === 'lubrificantes') {
      const incoming = incomingSimple as ProdutoLubrificacao[];
      const result = mergeImportedRecords(lubrificantes, incoming, item => normalizeImportText(item.nome));
      return persistImport('Produtos Lubrificação', 'renea_lubrificantes', setLubrificantes, result.next, incoming.length, result.created, result.updated);
    }
    const incoming = incomingSimple as EtapaServico[];
    const result = mergeImportedRecords(etapas, incoming, item => normalizeImportText(item.nome));
    return persistImport('Etapas de Serviço', 'renea_etapas', setEtapas, result.next, incoming.length, result.created, result.updated);
  };

  // Mantém exatamente o que foi digitado/importado e acrescenta somente campos
  // derivados da v2.4. Alertas continuam não bloqueando nenhum lançamento.
  const auditarBaseCombustivel = (lista: Abastecimento[]): Abastecimento[] =>
    enrichFuelDataset(lista, equipamentos);

  // Transaction Handlers
  const handleSaveAbastecimento = (item: Abastecimento, isNew: boolean) => {
    let updated;
    if (isNew) {
      updated = [...abastecimentos, item];
    } else {
      updated = abastecimentos.map(x => x.id === item.id ? item : x);
    }
    updated = auditarBaseCombustivel(updated);
    const eq = equipamentos.find(e => e.id === item.equipamentoId);
    const prefixoLog = eq?.prefixo || item.prefixoInformado || 'Frota sem cadastro';
    saveAndLog(
      'Abastecimentos', 
      isNew ? 'Criou' : 'Editou', 
      `${isNew ? 'Lançou' : 'Editou'} abastecimento de ${item.quantidadeLitros}L para ${prefixoLog}.`,
      historyLogs,
      () => {
        setAbastecimentos(updated);
        writeStorageValue(localStorage, 'renea_abastecimentos', JSON.stringify(updated));
      }
    );
  };

  /**
   * Excluir lançamento é do administrador (A7). A tela já esconde o botão de
   * quem não pode; a recusa aqui vale para qualquer outro caminho até a ação.
   */
  const podeExcluirLancamento = pode(currentUserRole, 'lancamentos', 'excluir');
  const podeExcluirCadastro = pode(currentUserRole, 'cadastros', 'excluir');
  const exclusaoRecusada = (permitido: boolean) => {
    if (permitido) return false;
    addNotification('Exclusão não permitida', 'Só o administrador pode excluir. Peça a ele.', 'warning', 'Sistema Local');
    return true;
  };

  /**
   * Excluir abastecimento manda para a Lixeira (A17), com a marca que impede
   * a volta pela sincronização. Devolve as exclusões para o Desfazer da tela.
   */
  const handleDeleteAbastecimentos = (ids: string[]): string[] => {
    if (exclusaoRecusada(podeExcluirLancamento)) return [];
    const selected = new Set(ids);
    const itens = abastecimentos
      .filter(item => selected.has(item.id))
      .map(item => ({ item, rotulo: rotuloAbastecimento(item, equipamentos) }));
    if (itens.length === 0) return [];
    return excluirCadastros({
      tabela: 'abastecimentos',
      storageKey: 'renea_abastecimentos',
      tela: 'Abastecimentos',
      itens,
      lista: abastecimentos,
      setLista: setAbastecimentos,
      ajustarLista: auditarBaseCombustivel,
    });
  };

  const handleDeleteAbastecimento = (id: string) => handleDeleteAbastecimentos([id]);

  // Importação de planilha — Prioridade 3: grava em lote (um único registro de histórico)
  const handleImportAbastecimentos = (
    novosItens: Abastecimento[],
    combustiveisImportados: TipoCombustivel[] = [],
    cadastrosImportados: Partial<FuelImportedMasterData> = {},
  ) => {
    const existingWithCanonicalPrefix = abastecimentos.map(item => ({
      ...item,
      prefixoInformado: item.prefixoInformado || equipamentos.find(equipment => equipment.id === item.equipamentoId)?.prefixo || item.equipamentoId,
    }));
    const { accepted: itensIneditos, rejected: itensRejeitados } = filterNovelFuelImports(existingWithCanonicalPrefix, novosItens || []);
    const tiposUtilizados = new Set(itensIneditos.map(item => item.tipoCombustivelId));
    const combustiveisValidos = combustiveisImportados.filter(item => tiposUtilizados.has(item.id));
    if (itensIneditos.length === 0 && combustiveisValidos.length === 0) {
      return {
        requested: novosItens.length,
        accepted: 0,
        rejected: itensRejeitados.length,
        totalAfter: abastecimentos.length,
        companiesCreated: 0,
        equipmentsCreated: 0,
        convoysCreated: 0,
        fuelTypesCreated: 0,
      };
    }
    const fuelMerge = combustiveisValidos.length
      ? mergeImportedRecords(combustiveis, combustiveisValidos, item => normalizeImportText(item.nome))
      : null;
    let updated = mergeRecordsById(abastecimentos, itensIneditos);
    updated = auditarBaseCombustivel(updated);
    const origens = new Set(itensIneditos.map(item => item.origem || 'Planilha'));
    const origemDescricao = origens.size === 1 ? [...origens][0] : 'fontes combinadas';
    const fuelMessage = fuelMerge && fuelMerge.created > 0
      ? ` Também cadastrou ${fuelMerge.created} tipo(s) de combustível novo(s).`
      : '';
    saveAndLog(
      'Abastecimentos',
      'Criou',
      `Importou ${itensIneditos.length} registro(s) inédito(s) de combustível via ${origemDescricao}; ${itensRejeitados.length} inválido(s) ou duplicado(s) foram bloqueados.${fuelMessage}`,
      historyLogs,
      () => {
        if (fuelMerge) {
          setCombustiveis(fuelMerge.next);
          writeStorageValue(localStorage, 'renea_combustiveis', JSON.stringify(fuelMerge.next));
        }
        setAbastecimentos(updated);
        writeStorageValue(localStorage, 'renea_abastecimentos', JSON.stringify(updated));
      }
    );
    return {
      requested: novosItens.length,
      accepted: itensIneditos.length,
      rejected: itensRejeitados.length,
      totalAfter: updated.length,
      companiesCreated: cadastrosImportados.empresas?.length || 0,
      equipmentsCreated: cadastrosImportados.equipamentos?.length || 0,
      convoysCreated: cadastrosImportados.comboios?.length || 0,
      fuelTypesCreated: fuelMerge?.created || 0,
    };
  };

  const handleSaveLubrificacao = (item: Lubrificacao, isNew: boolean) => {
    let updated;
    if (isNew) {
      updated = [...lubrificacoes, item];
    } else {
      updated = lubrificacoes.map(x => x.id === item.id ? item : x);
    }
    const eq = equipamentos.find(e => e.id === item.equipamentoId);
    saveAndLog(
      'Lubrificações', 
      isNew ? 'Criou' : 'Editou', 
      `${isNew ? 'Lançou' : 'Editou'} lubrificação no compartimento "${item.compartimento}" para ${eq ? eq.prefixo : 'Frota'}.`,
      historyLogs,
      () => {
        setLubrificacoes(updated);
        writeStorageValue(localStorage, 'renea_lubrificacoes', JSON.stringify(updated));
      }
    );
  };

  const handleDeleteLubrificacao = (id: string) => {
    if (exclusaoRecusada(podeExcluirLancamento)) return;
    const item = lubrificacoes.find(x => x.id === id);
    if (!item) return;
    // Com marca de exclusão (A12): vai para a Lixeira e não volta de outro aparelho.
    const prefixo = equipamentos.find(equipamento => equipamento.id === item.equipamentoId)?.prefixo;
    excluirCadastros({
      tabela: 'lubrificacoes',
      storageKey: 'renea_lubrificacoes',
      tela: 'Lubrificações',
      itens: [{ item, rotulo: `Lubrificação ${[prefixo, item.data].filter(Boolean).join(' em ')}` }],
      lista: lubrificacoes,
      setLista: setLubrificacoes,
    });
  };

  // Tickets Jazida / Liberação de Material — Prioridade 6
  const handleSaveTicketJazida = (item: TicketJazida, isNew: boolean) => {
    let updated;
    if (isNew) {
      updated = [...ticketsJazida, item];
    } else {
      updated = ticketsJazida.map(x => x.id === item.id ? item : x);
    }
    saveAndLog(
      'Tickets Jazida',
      isNew ? 'Criou' : 'Editou',
      `${isNew ? 'Registrou' : 'Editou'} ticket de ${item.tipoTicket || 'Liberação'} Nº ${item.ticketNumero} (${item.quantidadeM3} m³ de ${item.tipoMaterial}).`,
      historyLogs,
      () => {
        setTicketsJazida(updated);
        writeStorageValue(localStorage, 'renea_tickets_jazida', JSON.stringify(updated));
      }
    );
    void savePublicTicket(
      db,
      { ...item, origemRegistro: item.origemRegistro || 'Admin' },
      { allowOverwriteSent: true },
    )
      .catch(error => console.warn('Falha ao espelhar ticket no link público:', error));
  };

  // Com marca de exclusão (A12, M20): vai para a Lixeira e não volta de outro aparelho.
  const excluirTickets = (itens: TicketJazida[]) => {
    excluirCadastros({
      tabela: 'ticketsJazida',
      storageKey: 'renea_tickets_jazida',
      tela: 'Tickets Jazida',
      itens: itens.map(item => ({ item, rotulo: `Ticket ${item.ticketNumero || item.id}${item.data ? ` de ${item.data}` : ''}` })),
      lista: ticketsJazida,
      setLista: setTicketsJazida,
    });
    itens.forEach(item => {
      void deletePublicTicket(db, item.id).catch(error => console.warn('Falha ao excluir ticket público:', error));
    });
  };

  const handleDeleteTicketJazida = (id: string) => {
    if (exclusaoRecusada(podeExcluirLancamento)) return;
    const item = ticketsJazida.find(x => x.id === id);
    if (!item) return;
    excluirTickets([item]);
  };

  const handleDeleteTicketsJazida = (ids: string[]) => {
    if (exclusaoRecusada(podeExcluirLancamento)) return;
    const selected = new Set(ids);
    const itens = ticketsJazida.filter(item => selected.has(item.id));
    if (itens.length === 0) return;
    excluirTickets(itens);
  };

  const handleImportTicketsJazida = (novosItens: TicketJazida[]) => {
    if (!novosItens || novosItens.length === 0) return;
    const existingIds = new Set(ticketsJazida.map(item => item.id));
    const createdCount = novosItens.filter(item => !existingIds.has(item.id)).length;
    const updatedCount = novosItens.length - createdCount;
    const updated = mergeTicketCollections(ticketsJazida, novosItens);
    saveAndLog(
      'Tickets Jazida',
      createdCount ? 'Criou' : 'Editou',
      `${createdCount ? `Criou ${createdCount}` : ''}${createdCount && updatedCount ? ' e ' : ''}${updatedCount ? `atualizou ${updatedCount}` : ''} via(s) de ticket em uma única operação.`,
      historyLogs,
      () => {
        setTicketsJazida(updated);
        writeStorageValue(localStorage, 'renea_tickets_jazida', JSON.stringify(updated));
      }
    );
  };

  const handleReserveTicketNumber = () => reservePublicTicketNumber(db, ticketsJazida);
  const handleReserveTicketNumbers = (count: number) => reservePublicTicketNumbers(db, ticketsJazida, count);

  const handleSaveTicketLink = async (
    item: TicketJazida,
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const result = await savePublicTicketViaApi(item, externalTicketAccessToken);
      setExternalPublicTickets(current => mergeTicketCollections(current, [result.ticket]));
      return {
        success: true,
        message: result.message,
      };
    } catch (error) {
      console.error('Falha técnica ao salvar ticket público:', error);
      const detail = error instanceof Error ? error.message : '';
      return {
        success: false,
        message: detail.includes('já foi enviado por outra pessoa')
          ? detail
          : 'Não foi possível salvar agora. Verifique a internet e tente novamente.',
      };
    }
  };

  // Notifications helpers
  const addNotification = (
    title: string, 
    message: string, 
    type: NotificationType = 'info',
    source: NotificationSource = 'RENEA API'
  ) => {
    const newNotif = createNotification(title, message, type, source);

    setNotifications(prev => {
      const updated = prependNotifications(prev, [newNotif]);
      persistNotifications(localStorage, updated);
      return updated;
    });

    // Exibe no máximo um aviso discreto por vez para não bloquear a navegação.
    // Alterações em Tickets Jazida continuam registradas no sino/histórico, sem popup.
    if (title.indexOf('Tickets Jazida') === -1) {
      setActiveToasts([newNotif]);
      setTimeout(() => {
        setActiveToasts(prev => prev.filter(t => t.id !== newNotif.id));
      }, 2500);
    }
  };

  const persistPresenceNotifications = (newItems: AppNotification[]) => {
    const updated = prependNotifications(notifications, newItems);
    setNotifications(updated);
    persistNotifications(localStorage, updated);
    // Mostra somente o alerta mais recente, evitando uma pilha cobrindo a tela.
    const latestItem = newItems[0];
    if (latestItem) {
      setActiveToasts([latestItem]);
      setTimeout(() => {
        setActiveToasts(prev => prev.filter(t => t.id !== latestItem.id));
      }, 2500);
    }
    return updated;
  };

  const createPresenceNotification = (
    title: string,
    message: string,
    type: NotificationType = 'info'
  ): AppNotification => createNotification(title, message, type, 'RENEA API', 'notif-pres');

  const uploadLocalSnapshotToSupabase = (overrides: {
    funcionarios?: Funcionario[];
    gruposEquipe?: GrupoEquipe[];
  } = {}) => handleUploadToSupabase({
    ...overrides,
  });

  // P0-06: contagem reativa da fila offline + retry manual pelo topbar.
  // A drenagem automatica no 'online' (efeito abaixo) continua existindo;
  // o retry manual reutiliza o mesmo caminho de envio.
  const pendingCount = useOfflineQueueCount();
  const [isRetryingPending, setIsRetryingPending] = useState(false);
  const handleRetryPending = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (isRetryingPending) return;
    setIsRetryingPending(true);
    try {
      const result = await flushOfflineCommands({
        'supabase-backup': async () => {
          const uploadResult = await uploadLocalSnapshotToSupabase();
          if (!uploadResult.success) throw new Error(uploadResult.message);
        },
      });
      if (result.processed > 0) {
        addNotification('Fila offline', `${result.processed} pendência(s) enviada(s).`, 'success', 'Sistema Local');
      } else if (result.failed > 0) {
        addNotification('Fila offline', `${result.failed} pendência(s) falharam; tente de novo.`, 'warning', 'Sistema Local');
      }
    } finally {
      setIsRetryingPending(false);
    }
  }, [isRetryingPending, uploadLocalSnapshotToSupabase, addNotification]);

  // Reconstrói o histórico de presença a partir da fila pública original
  // (sistemarenea_public_submissions), que nunca é apagada nem sobrescrita
  // pelo navegador. Existe porque um retrato consolidado corrompido em algum
  // aparelho pode ter sido publicado por cima da nuvem, perdendo dias
  // inteiros do histórico consolidado — mas os envios originais continuam
  // intactos e servem de fonte para trazer de volta o que sumiu, sem apagar
  // nada que já esteja presente.
  const handleRestorePresenceHistory = async (): Promise<{ success: boolean; message: string }> => {
    const releasePresenceSync = await acquirePresenceSync();
    try {
      const submissions = await fetchAllPresenceSubmissions(db);
      const recoveredRecords = submissions.flatMap(item => item.payload.records || []);
      if (recoveredRecords.length === 0) {
        return { success: true, message: 'Nenhum envio de presença encontrado na fila pública para recuperar.' };
      }
      const storedPresence = parseStoredJson<PresencaApontamento[]>(
        localStorage.getItem('renea_presencas_link'), 'renea_presencas_link', [],
      );
      const arquivados = parseStoredJson<PeriodoArquivado[]>(
        localStorage.getItem('renea_periodos_arquivados'), 'renea_periodos_arquivados', [],
      );
      const faltantes = presencasFaltantes(storedPresence, recoveredRecords, arquivados);
      const addedCount = faltantes.length;
      if (addedCount === 0) {
        return { success: true, message: 'O histórico local já tinha todos os registros da fila pública.' };
      }
      const origem = resumoRecuperadas(faltantes);
      const merged = [...storedPresence, ...faltantes];
      writeStorageValue(localStorage, 'renea_presencas_link', JSON.stringify(merged));
      setPresencasLink(merged);
      if (currentUserRoleRef.current === 'leitura') {
        return {
          success: true,
          message: `${addedCount} registro(s) de presença recuperado(s) neste aparelho: ${origem}.`,
        };
      }
      const uploadResult = await uploadLocalSnapshotToSupabase();
      if (!uploadResult.success) {
        return {
          success: false,
          message: `${addedCount} registro(s) recuperado(s) neste aparelho (${origem}), mas não foi possível publicar na nuvem ainda. Motivo: ${uploadResult.message}`,
        };
      }
      return {
        success: true,
        message: `${addedCount} registro(s) de presença recuperado(s) e publicado(s) na nuvem: ${origem}.`,
      };
    } catch (error) {
      return { success: false, message: formatCloudSyncError(error) };
    } finally {
      releasePresenceSync();
    }
  };

  useEffect(() => {
    if (!publicLinksRotationPending || !isLoggedIn || externalTicketLink || externalPresenceToken) return;
    let cancelled = false;
    let running = false;
    const publishRotation = async () => {
      if (cancelled || running || !navigator.onLine) return;
      running = true;
      const result = await uploadLocalSnapshotToSupabase();
      running = false;
      if (cancelled || !result.success) return;
      localStorage.removeItem(STORAGE_KEYS.publicLinksRotationPendingV31);
      setPublicLinksRotationPending(false);
      addNotification(
        'Links públicos protegidos',
        'Links antigos previsíveis foram substituídos. Compartilhe os novos endereços de presença e apontamento.',
        'warning',
        'Sistema Local',
      );
    };
    const timer = window.setTimeout(() => void publishRotation(), 1_000);
    window.addEventListener('online', publishRotation);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('online', publishRotation);
    };
  }, [
    publicLinksRotationPending,
    isLoggedIn,
    externalTicketLink,
    externalPresenceToken,
  ]);

  useEffect(() => {
    if (!isLoggedIn || externalTicketLink || externalPresenceToken) return;
    const flush = () => {
      if (!navigator.onLine) return;
      void flushOfflineCommands({
        'supabase-backup': async () => {
          const result = await uploadLocalSnapshotToSupabase();
          if (!result.success) throw new Error(result.message);
        },
      });
    };
    window.addEventListener('online', flush);
    flush();
    return () => window.removeEventListener('online', flush);
  }, [isLoggedIn, externalTicketLink, externalPresenceToken]);

  useEffect(() => {
    if (!isLoggedIn || !currentUser || externalTicketLink || externalPresenceToken) return;
    let cancelled = false;
    let running = false;
    let queuedSubmissions: PublicSubmission[] | null = null;

    const ingestPublicSubmissions = async (submissions: PublicSubmission[]) => {
      if (cancelled || submissions.length === 0) return;
      if (running) {
        queuedSubmissions = submissions;
        return;
      }
      running = true;
      const releasePresenceSync = await acquirePresenceSync();
      try {
        const incomingPresence = submissions.flatMap(item => item.kind === 'presence' ? (item.payload.records || []) : []);
        const presenceResets = submissions.filter(item => item.kind === 'presence-reset' && item.payload.grupoId && item.payload.data);
        const storedPresenceBeforeReset = parseStoredJson<PresencaApontamento[]>(localStorage.getItem('renea_presencas_link'), 'renea_presencas_link', []);
        const storedPresence = presenceResets.reduce((records, reset) => records.filter(record => !(
          record.grupoId === reset.payload.grupoId && record.data === reset.payload.data
        )), storedPresenceBeforeReset);
        const nextPresence = mergePresenceRecords(storedPresence, incomingPresence);

        // Colaboradores incluídos pelo apontador no link entram no cadastro da
        // equipe. A leitura vem do armazenamento local, e não do estado, para
        // que uma fila processada em sequência não sobrescreva a anterior.
        const incomingMembers = submissions.flatMap(item => item.kind === 'equipe' && item.payload.grupoId && item.payload.funcionarioId
          ? [{ grupoId: item.payload.grupoId, funcionarioId: item.payload.funcionarioId, operacao: item.payload.operacao || 'adicionar' as const }]
          : []);
        const storedGroups = parseStoredJson<GrupoEquipe[]>(localStorage.getItem('renea_grupos_equipes'), 'renea_grupos_equipes', []);
        const nextGroups = incomingMembers.reduce((groups, member) => groups.map(group => {
          if (group.id !== member.grupoId) return group;
          const currentIds = group.funcionarioIds || [];
          const funcionarioIds = member.operacao === 'remover'
            ? currentIds.filter(id => id !== member.funcionarioId)
            : [...new Set([...currentIds, member.funcionarioId])];
          return { ...group, funcionarioIds, updatedAt: new Date().toISOString() };
        }), storedGroups);

        const storedHistory = parseStoredJson<HistoryLog[]>(localStorage.getItem('renea_history_logs'), 'renea_history_logs', []);
        const nextHistory = mergeRecordsById(storedHistory, submissions.map(item => ({
          id: `log-public-${item.id}`,
          timestamp: new Date(item.createdAtIso || Date.now()).toLocaleString('pt-BR'),
          usuario: item.payload.grupoNome || 'Link de presença',
          acao: item.kind === 'presence-reset' ? 'Excluiu' as const : 'Criou' as const,
          tela: 'Controle de Presença',
          descricao: item.kind === 'presence-reset'
            ? `Resetou a presença da equipe ${item.payload.grupoNome || item.payload.grupoId} em ${item.payload.data} para refazer o apontamento.`
            : item.kind === 'equipe'
            ? `${item.payload.operacao === 'remover' ? 'Removeu' : 'Incluiu'} ${item.payload.funcionarioNome || item.payload.funcionarioId} ${item.payload.operacao === 'remover' ? 'da' : 'na'} equipe ${item.payload.grupoNome || item.payload.grupoId} pelo link de presença.`
            : `Recebeu presença pública do grupo ${item.payload.grupoNome || item.payload.grupoId} em ${item.payload.data}.`,
        })));

        const storedNotifications = parseStoredJson<AppNotification[]>(localStorage.getItem('renea_notifications'), 'renea_notifications', []);
        const nextNotifications = mergeRecordsById(storedNotifications, submissions.map(item => ({
          id: `notification-public-${item.id}`,
          type: 'success' as const,
          title: item.kind === 'presence-reset' ? 'Presença liberada para refazer'
            : item.kind === 'equipe' ? `Colaborador ${item.payload.operacao === 'remover' ? 'removido da' : 'incluído na'} equipe` : 'Presença recebida',
          message: item.kind === 'presence-reset'
            ? `${item.payload.grupoNome || 'Equipe'} resetou a presença de ${item.payload.data} para refazer.`
            : item.kind === 'equipe'
              ? `${item.payload.funcionarioNome || 'Colaborador'} ${item.payload.operacao === 'remover' ? 'saiu da' : 'entrou na'} equipe ${item.payload.grupoNome || 'sem nome'} pelo link de presença.`
              : `${item.payload.grupoNome || 'Equipe'} enviou ${item.payload.records?.length || 0} registro(s) de presença.`,
          timestamp: new Date(item.createdAtIso || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          read: false,
          source: 'Sistema Local' as const,
        })));

        writeStorageValue(localStorage, 'renea_presencas_link', JSON.stringify(nextPresence));
        writeStorageValue(localStorage, 'renea_history_logs', JSON.stringify(nextHistory));
        persistNotifications(localStorage, nextNotifications);
        setPresencasLink(nextPresence);
        setHistoryLogs(nextHistory);
        setNotifications(nextNotifications);
        if (incomingMembers.length > 0) {
          writeStorageValue(localStorage, 'renea_grupos_equipes', JSON.stringify(nextGroups));
          setGruposEquipe(nextGroups);
        }

        let syncResult = await uploadLocalSnapshotToSupabase();
        if (!syncResult.success && /conflito|outro computador|vers[aã]o mais recente/i.test(syncResult.message)) {
          // A fila pública é idempotente por ID. Em caso de concorrência,
          // baixa o retrato vencedor, reaplica somente os envios pendentes e
          // tenta novamente sem apagar nem duplicar registros operacionais.
          const downloadResult = await handleDownloadFromSupabase();
          if (!downloadResult.success) throw new Error(downloadResult.message);
          const refreshedPresence = mergePresenceRecords(
            parseStoredJson<PresencaApontamento[]>(localStorage.getItem('renea_presencas_link'), 'renea_presencas_link', []),
            incomingPresence,
          );
          const refreshedNotifications = mergeRecordsById(
            parseStoredJson<AppNotification[]>(localStorage.getItem('renea_notifications'), 'renea_notifications', []),
            nextNotifications,
          );
          const refreshedHistory = mergeRecordsById(
            parseStoredJson<HistoryLog[]>(localStorage.getItem('renea_history_logs'), 'renea_history_logs', []),
            nextHistory,
          );
          writeStorageValue(localStorage, 'renea_presencas_link', JSON.stringify(refreshedPresence));
          writeStorageValue(localStorage, 'renea_history_logs', JSON.stringify(refreshedHistory));
          persistNotifications(localStorage, refreshedNotifications);
          setPresencasLink(refreshedPresence);
          setHistoryLogs(refreshedHistory);
          setNotifications(refreshedNotifications);
          if (incomingMembers.length > 0) {
            // O retrato vencedor pode já ter a equipe mudada por outro
            // computador. A inclusão é reaplicada sobre ele, nunca por cima.
            const refreshedGroups = parseStoredJson<GrupoEquipe[]>(localStorage.getItem('renea_grupos_equipes'), 'renea_grupos_equipes', [])
              .map(group => {
                const additions = incomingMembers
                  .filter(member => member.grupoId === group.id)
                  .map(member => member.funcionarioId)
                  .filter(id => !(group.funcionarioIds || []).includes(id));
                if (additions.length === 0) return group;
                return { ...group, funcionarioIds: [...(group.funcionarioIds || []), ...additions], updatedAt: new Date().toISOString() };
              });
            writeStorageValue(localStorage, 'renea_grupos_equipes', JSON.stringify(refreshedGroups));
            setGruposEquipe(refreshedGroups);
          }
          syncResult = await uploadLocalSnapshotToSupabase();
        }
        if (!syncResult.success) throw new Error(syncResult.message);
        await markPublicSubmissionsProcessed(db, submissions.map(item => item.id), currentUser.uid);
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn('Falha ao incorporar a fila pública; os itens permanecerão pendentes:', error);
          // O envio já está salvo no Supabase (fila pública); só a incorporação
          // a este retrato falhou. Sem aviso aqui, essa presença ficava presa
          // sem nenhum sinal na tela — só sumindo silenciosamente.
          const now = Date.now();
          const isRepeat = presenceIngestFailureRef.current.message === message
            && now - presenceIngestFailureRef.current.at < 60_000;
          presenceIngestFailureRef.current = { message, at: now };
          if (!isRepeat) {
            addNotification(
              'Presenças recebidas não foram incorporadas',
              `Envios do link público chegaram, mas não foi possível gravá-los neste painel. Motivo: ${message}`,
              'error',
              'Sistema Local',
            );
          }
        }
      } finally {
        releasePresenceSync();
        running = false;
        if (!cancelled && queuedSubmissions) {
          const nextQueue = queuedSubmissions;
          queuedSubmissions = null;
          void ingestPublicSubmissions(nextQueue);
        }
      }
    };

    const unsubscribe = subscribePendingPublicSubmissions(
      db,
      submissions => {
        if (cancelled) return;
        // A query já filtra status == pending: esta contagem reflete o que
        // ainda não foi incorporado a este retrato local, em tempo real.
        setPendingPublicSubmissionsCount(submissions.length);
        void ingestPublicSubmissions(submissions);
      },
      error => {
        if (cancelled) return;
        console.warn('Falha ao acompanhar os envios públicos em tempo real:', error);
        addNotification(
          'Presenças do link público podem não estar chegando',
          `O acompanhamento em tempo real dos envios públicos falhou. Motivo: ${formatCloudSyncError(error)}`,
          'error',
          'Sistema Local',
        );
      },
    );
    return () => {
      cancelled = true;
      queuedSubmissions = null;
      unsubscribe();
    };
  }, [isLoggedIn, currentUser, externalTicketLink, externalPresenceToken]);

  // Uso de material apontado pelo link do apontador. Cada envio vira saídas de
  // consumo com ID derivado do envio, então dois computadores abertos ou uma
  // queda no meio nunca contam o mesmo uso duas vezes. Só marca o envio como
  // processado depois que o retrato com as saídas subiu para a nuvem.
  useEffect(() => {
    if (!isLoggedIn || !currentUser || externalTicketLink || externalPresenceToken) return;
    let cancelled = false;
    let running = false;
    let queued: MaterialUseSubmission[] | null = null;

    const readStoredMovements = () => parseStoredJson<MovimentoMaterial[]>(
      localStorage.getItem(STORAGE_KEYS.materiaisMovimentos), STORAGE_KEYS.materiaisMovimentos, [],
    );
    const applyIncoming = (incoming: MovimentoMaterial[]) => {
      const merged = mergeMaterialUseMovements(readStoredMovements(), incoming);
      writeStorageValue(localStorage, STORAGE_KEYS.materiaisMovimentos, JSON.stringify(merged.movements));
      setMateriaisMovimentos(merged.movements);
      return merged.added;
    };

    const ingest = async (submissions: MaterialUseSubmission[]) => {
      if (cancelled || submissions.length === 0) return;
      if (running) {
        queued = submissions;
        return;
      }
      running = true;
      const release = await acquirePresenceSync();
      try {
        const incoming = submissions.flatMap(movementsFromMaterialUse);
        const added = applyIncoming(incoming);
        if (added > 0) {
          const storedHistory = parseStoredJson<HistoryLog[]>(localStorage.getItem('renea_history_logs'), 'renea_history_logs', []);
          const nextHistory = mergeRecordsById(storedHistory, submissions.map(item => ({
            id: `log-public-${item.id}`,
            timestamp: new Date(item.createdAtIso || Date.now()).toLocaleString('pt-BR'),
            usuario: item.payload.apontador || 'Link do apontador',
            acao: 'Criou' as const,
            tela: 'Materiais',
            descricao: `Apontou uso no ${item.payload.etapaServicoNome}: ${item.payload.itens.map(uso => `${uso.quantidade} ${uso.unidade} de ${uso.materialDescricao}`).join('; ')}.`,
          })));
          writeStorageValue(localStorage, 'renea_history_logs', JSON.stringify(nextHistory));
          setHistoryLogs(nextHistory);
        }
        let syncResult = await uploadLocalSnapshotToSupabase();
        if (!syncResult.success && /conflito|outro computador|vers[aã]o mais recente/i.test(syncResult.message)) {
          // Outro computador salvou antes: baixa o retrato vencedor e reaplica
          // só as saídas deste envio por cima, sem apagar nada do que chegou.
          const downloadResult = await handleDownloadFromSupabase();
          if (!downloadResult.success) throw new Error(downloadResult.message);
          applyIncoming(incoming);
          syncResult = await uploadLocalSnapshotToSupabase();
        }
        if (!syncResult.success) throw new Error(syncResult.message);
        await markPublicSubmissionsProcessed(db, submissions.map(item => item.id), currentUser.uid);
      } catch (error) {
        if (!cancelled) {
          console.warn('Falha ao incorporar o uso de materiais do link; os envios continuam na fila:', error);
          addNotification(
            'Uso de material do link ainda não entrou',
            `Os apontamentos chegaram e estão guardados na fila, mas não foi possível gravá-los neste painel. Motivo: ${error instanceof Error ? error.message : String(error)}`,
            'error',
            'Sistema Local',
          );
        }
      } finally {
        release();
        running = false;
        if (!cancelled && queued) {
          const next = queued;
          queued = null;
          void ingest(next);
        }
      }
    };

    const unsubscribe = subscribePendingMaterialUses(
      db,
      submissions => { if (!cancelled) void ingest(submissions); },
      error => {
        if (cancelled) return;
        console.warn('Falha ao acompanhar o uso de materiais do link:', error);
      },
    );
    return () => {
      cancelled = true;
      queued = null;
      unsubscribe();
    };
  }, [isLoggedIn, currentUser, externalTicketLink, externalPresenceToken]);

  const handleSaveGrupoEquipe = (grupo: GrupoEquipe, isNew: boolean) => {
    const updated = isNew
      ? [...gruposEquipe, grupo]
      : gruposEquipe.map(item => item.id === grupo.id ? grupo : item);

    saveAndLog(
      'Grupos / Equipes',
      isNew ? 'Criou' : 'Editou',
      `${isNew ? 'Criou' : 'Editou'} o grupo "${grupo.nome}" com ${grupo.funcionarioIds.length} funcionário(s) vinculado(s).`,
      historyLogs,
      () => {
        setGruposEquipe(updated);
        writeStorageValue(localStorage, 'renea_grupos_equipes', JSON.stringify(updated));
      }
    );
  };

  // Sem a marca em `exclusoes`, a próxima sincronização juntava a lista do
  // aparelho com a da nuvem e a equipe excluída voltava (16/10/2026).
  const handleDeleteGrupoEquipe = (id: string) => {
    if (exclusaoRecusada(podeExcluirCadastro)) return;
    const grupo = gruposEquipe.find(item => item.id === id);
    if (!grupo) return;
    excluirCadastros({
      tabela: 'gruposEquipe',
      storageKey: 'renea_grupos_equipes',
      tela: 'Grupos / Equipes',
      itens: [{ item: grupo, rotulo: grupo.nome }],
      lista: gruposEquipe,
      setLista: setGruposEquipe,
    });
  };

  // Sincronização das equipes com a planilha do efetivo. Chega já conferida
  // pelo administrativo: aqui só grava, registra e sincroniza.
  // Zera o dia de uma equipe no serviço e limpa o retrato local. A reserva do
  // dia sai junto, senão o link continuaria recusando um novo envio.
  const handleResetPresencaDia = async (grupoId: string, data: string) => {
    try {
      const resposta = await resetPresenceDay(grupoId, data);
      const restantes = presencasLink.filter(item => !(item.grupoId === grupoId && item.data === data));
      const grupo = gruposEquipe.find(item => item.id === grupoId);
      saveAndLog(
        'Controle de Presença',
        'Excluiu',
        `Zerou o apontamento de ${data} da equipe "${grupo?.nome || grupoId}"; a equipe pode enviar de novo pelo link.`,
        historyLogs,
        () => {
          setPresencasLink(restantes);
          writeStorageValue(localStorage, 'renea_presencas_link', JSON.stringify(restantes));
        },
      );
      void uploadLocalSnapshotToSupabase();
      return resposta;
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Não foi possível zerar o dia.' };
    }
  };

  const handleSyncEquipesPlanilha = async (
    proximosFuncionarios: Funcionario[],
    proximasEquipes: GrupoEquipe[],
    resumo: { criar: number; atualizar: number; desativar: number; colaboradoresNovos: number },
  ) => {
    saveAndLog(
      'Grupos / Equipes',
      'Editou',
      `Sincronizou as equipes pela planilha do efetivo: ${resumo.criar} criada(s), ${resumo.atualizar} atualizada(s), ${resumo.desativar} desativada(s) e ${resumo.colaboradoresNovos} colaborador(es) incluído(s) no cadastro.`,
      historyLogs,
      () => {
        setGruposEquipe(proximasEquipes);
        setFuncionarios(proximosFuncionarios);
        commitStorageBatch(localStorage, [
          { key: 'renea_grupos_equipes', value: JSON.stringify(proximasEquipes) },
          { key: 'renea_funcionarios', value: JSON.stringify(proximosFuncionarios) },
        ]);
      },
    );
    // O retrato remoto precisa refletir a mudança para que os links públicos,
    // que leem da nuvem, enxerguem as equipes novas.
    const result = await uploadLocalSnapshotToSupabase({
      funcionarios: proximosFuncionarios,
      gruposEquipe: proximasEquipes,
    });
    if (!result.success) console.warn('Equipes sincronizadas localmente; o envio à nuvem falhou:', result.message);
    return result;
  };

  const selectExternalPresenceDate = (data: string) => {
    if (Object.prototype.hasOwnProperty.call(externalPresenceHistory, data)) {
      setExternalDataSelecionada(data);
      setExternalMeusRegistros(externalPresenceHistory[data] || []);
      setExternalObservacaoDia(externalPresenceDayNotes[data] || '');
      return;
    }
    void reloadExternalPresence(data);
  };

  /**
   * "Desligado" no apontamento não é só um status do dia: é o colaborador
   * saindo da obra. Aplicar a mesma transição de situação que a tela de
   * Colaboradores usa (aplicarSituacao → DESMOBILIZADO) tira a pessoa do
   * efetivo em todo o sistema, não só naquele registro de presença — e some
   * da equipe na hora, sem esperar alguém remover manualmente depois.
   */
  const processarDesligamentosDaPresenca = (
    items: Array<{ funcionarioId: string; status: PresencaStatus }>,
    grupoId: string,
    data: string,
  ) => {
    const mudancasPorId = new Map<string, { funcionario: Funcionario; mudanca: MudancaDeSituacao }>();
    items.forEach(({ funcionarioId, status }) => {
      if (status !== 'Desligado' || mudancasPorId.has(funcionarioId)) return;
      const atual = funcionarios.find(item => item.id === funcionarioId);
      if (!atual || atual.status === 'DESMOBILIZADO') return;
      mudancasPorId.set(funcionarioId, {
        funcionario: atual,
        mudanca: {
          situacao: 'DESMOBILIZADO',
          data,
          motivo: 'Desligamento registrado pelo apontamento de presença',
          por: activeUserName,
        },
      });
    });
    if (mudancasPorId.size === 0) return;

    const funcionariosAtualizados = funcionarios.map(item => {
      const entrada = mudancasPorId.get(item.id);
      return entrada ? aplicarSituacao(entrada.funcionario, entrada.mudanca) : item;
    });
    saveAndLog(
      'Funcionários',
      'Editou',
      `Desligou ${mudancasPorId.size} colaborador(es) pelo apontamento de presença: `
      + `${[...mudancasPorId.values()].map(({ funcionario }) => funcionario.nome).join(', ')}.`,
      historyLogs,
      () => {
        setFuncionarios(funcionariosAtualizados);
        writeStorageValue(localStorage, 'renea_funcionarios', JSON.stringify(funcionariosAtualizados));
      },
    );
    mudancasPorId.forEach(({ funcionario, mudanca }) => {
      addNotification('Colaborador desligado', descreverMudanca(funcionario, mudanca), 'warning', 'Sistema Local');
    });

    const idsDesligados = new Set(mudancasPorId.keys());
    setGruposEquipe(current => current.map(group => group.id === grupoId
      ? { ...group, funcionarioIds: (group.funcionarioIds || []).filter(id => !idsDesligados.has(id)) }
      : group));
    setExternalMeuGrupo(current => current?.id === grupoId
      ? { ...current, funcionarioIds: (current.funcionarioIds || []).filter(id => !idsDesligados.has(id)) }
      : current);
  };

  const handleSubmitPresencaLink = async (
    grupo: GrupoEquipe,
    data: string,
    items: Array<{ funcionarioId: string; status: PresencaStatus; observacao: string }>,
    observacaoDia = '',
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const resposta = await submitPublicPresence(externalPresenceToken, grupo.id, data, items, observacaoDia);
      if (resposta.success) processarDesligamentosDaPresenca(items, grupo.id, data);
      return resposta;
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Não foi possível enviar a presença.' };
    }
  };

  const handleSaveExternalDayNote = async (grupoId: string, observacao: string) => {
    try {
      const resposta = await updatePublicPresenceDayNote(externalPresenceToken, grupoId, observacao);
      setExternalObservacaoDia(resposta.observacaoDia);
      return resposta;
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Não foi possível salvar a observação.' };
    }
  };

  const handleAddExternalPresencaMember = async (grupoId: string, funcionarioId: string) => {
    try {
      return await addPublicPresenceMember(externalPresenceToken, grupoId, funcionarioId);
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Não foi possível incluir este colaborador.' };
    }
  };

  const handleRemoveExternalPresencaMember = async (grupoId: string, funcionarioId: string) => {
    try {
      const response = await removePublicPresenceMember(externalPresenceToken, grupoId, funcionarioId);
      if (response.success) {
        setGruposEquipe(current => current.map(group => group.id === grupoId
          ? { ...group, funcionarioIds: (group.funcionarioIds || []).filter(id => id !== funcionarioId) }
          : group));
        setExternalMeuGrupo(current => current?.id === grupoId
          ? { ...current, funcionarioIds: (current.funcionarioIds || []).filter(id => id !== funcionarioId) }
          : current);
      }
      return response;
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Não foi possível remover este colaborador.' };
    }
  };

  const handleUpdateExternalPresencaRecord = async (
    grupoId: string,
    funcionarioId: string,
    status: PresencaStatus,
    observacao: string
  ) => {
    try {
      const resposta = await updatePublicPresenceRecord(externalPresenceToken, grupoId, funcionarioId, status, observacao);
      if (resposta.success) {
        processarDesligamentosDaPresenca([{ funcionarioId, status }], grupoId, externalDataSelecionada);
      }
      return resposta;
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Não foi possível salvar a alteração.' };
    }
  };

  const handleUpdatePresencaLink = (id: string, status: PresencaStatus, observacao: string, motivo: string) => {
    const item = presencasLink.find(row => row.id === id);
    if (!item) return;

    const updatedItem: PresencaApontamento = {
      ...item,
      status,
      observacao,
      updatedAt: new Date().toISOString(),
      atualizadoPor: activeUserName,
      motivoAlteracao: motivo
    };
    const updatedPresencas = presencasLink.map(row => row.id === id ? updatedItem : row);
    const historico: HistoricoPresenca = {
      id: `hist-pres-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      presencaId: id,
      grupoId: item.grupoId,
      funcionarioId: item.funcionarioId,
      data: item.data,
      editadoPor: activeUserName,
      editadoEm: new Date().toLocaleString('pt-BR'),
      motivo,
      valorAnterior: `${item.status}${item.observacao ? ` - ${item.observacao}` : ''}`,
      valorNovo: `${status}${observacao ? ` - ${observacao}` : ''}`
    };
    const updatedHistorico = [historico, ...historicoPresencas];
    const updatedNotifications = persistPresenceNotifications([
      createPresenceNotification(
        'Presença atualizada',
        `Admin atualizou ${item.funcionarioNome} no grupo ${item.grupoNome}.`,
        'info'
      )
    ]);

    setPresencasLink(updatedPresencas);
    setHistoricoPresencas(updatedHistorico);
    writeStorageValue(localStorage, 'renea_presencas_link', JSON.stringify(updatedPresencas));
    writeStorageValue(localStorage, 'renea_historico_presencas', JSON.stringify(updatedHistorico));
    processarDesligamentosDaPresenca([{ funcionarioId: item.funcionarioId, status }], item.grupoId, item.data);

    // presencasLink e historicoPresencas ja foram gravados acima; as
    // notificacoes tambem. O envio le tudo do armazenamento local.
    void handleUploadToSupabase();
  };

  /**
   * Lançamento manual pelo painel: a equipe que não usou o link não pode ficar
   * sem apontamento. O registro nasce marcado como manual, com quem lançou, e
   * relançar o mesmo dia corrige em vez de duplicar.
   */
  const handleLancarPresencaManual = (
    grupo: GrupoEquipe,
    data: string,
    situacoes: SituacaoLancada[],
    observacaoDia: string,
  ) => {
    const novos = montarPresencaManual({
      grupo,
      funcionarios,
      data,
      situacoes,
      responsavel: activeUserName,
      observacaoDia,
    });
    if (novos.length === 0) return;
    const atualizados = aplicarPresencaManual(presencasLink, novos);
    setPresencasLink(atualizados);
    writeStorageValue(localStorage, 'renea_presencas_link', JSON.stringify(atualizados));
    addNotification(
      'Presença lançada pelo painel',
      `${novos.length} situação(ões) de ${grupo.nome} em ${data.split('-').reverse().join('/')}.`,
      'success',
      'Sistema Local',
    );
    processarDesligamentosDaPresenca(situacoes, grupo.id, data);
    void handleUploadToSupabase();
  };

  /**
   * "Inativar presença" inativa de verdade (C8): o registro sai das telas e dos
   * relatórios, fica guardado e volta com Reativar. Nada é apagado aqui nem na
   * origem do link; apagar o dia inteiro fica só no "Zerar o dia".
   */
  const alterarAtividadePresenca = (ids: string[], ativar: boolean) => {
    const alvos = new Set(ids);
    const afetados = presencasLink.filter(item => alvos.has(item.id) && estaAtivo(item) !== ativar);
    if (afetados.length === 0) return;
    const agora = new Date().toISOString();
    const trocados = ativar ? reativar(presencasLink, ids) : inativar(presencasLink, ids, activeUserName, agora);
    // updatedAt carimbado: na mesclagem com a nuvem vale a versão mais recente.
    const updated = trocados.map(item => (afetados.some(alvo => alvo.id === item.id) ? { ...item, updatedAt: agora, atualizadoPor: activeUserName } : item));
    const nomes = afetados.slice(0, 5).map(item => `${item.funcionarioNome} (${item.data.split('-').reverse().join('/')})`).join(', ');
    saveAndLog(
      'Controle de Presença',
      'Editou',
      `${ativar ? 'Reativou' : 'Inativou'} ${afetados.length} registro(s) de presença: ${nomes}${afetados.length > 5 ? '…' : ''}.`,
      historyLogs,
      () => {
        setPresencasLink(updated);
        writeStorageValue(localStorage, 'renea_presencas_link', JSON.stringify(updated));
      },
    );
  };
  const handleInativarPresencaLink = (ids: string[]) => alterarAtividadePresenca(ids, false);
  const handleReativarPresencaLink = (ids: string[]) => alterarAtividadePresenca(ids, true);

  const handleChangeControleEstacas = (next: ControleEstacas, description: string) => {
    saveAndLog(
      'Controle de Estacas',
      'Editou',
      description,
      historyLogs,
      () => {
        setControleEstacas(next);
        writeStorageValue(localStorage, 'renea_controle_estacas', JSON.stringify(next));
      }
    );
  };

  // Alertas do sino: derivados dos mesmos registros das pendências, filtrando só
  // gravidade alta. Não são salvos, então nunca sobra alerta de algo resolvido.
  const alertasSistema = useMemo(() => alertasDoSistema({
    hoje: isoDay(new Date()),
    inicio: isoDay(new Date(Date.now() - 30 * 86_400_000)),
    fim: isoDay(new Date()),
    equipamentos,
    controlesEquipamentos: controleEquipamentosDiario,
    gruposEquipe,
    presencasLink,
    listasPresenca,
    obras,
    ordensServico,
    ticketsJazida,
    fichasFvs,
    inspecoes,
    naoConformidades,
    documentos,
    treinamentos,
    planejamento: planejamentoItens,
    producao: producaoRegistros,
    medicoes,
    materiais: materiaisCadastro,
    movimentosMaterial: materiaisMovimentosVigentes,
    ocorrencias,
  }), [equipamentos, controleEquipamentosDiario, gruposEquipe, presencasLink, listasPresenca, obras, ordensServico, ticketsJazida, fichasFvs, inspecoes, naoConformidades, documentos, treinamentos, planejamentoItens, producaoRegistros, medicoes, materiaisCadastro, materiaisMovimentosVigentes, ocorrencias]);

  // Alerta sem tela para resolver (FVS, documentos e outras que saíram do
  // app) ou de tela que o perfil não abre fica fora do sino (M6, M7).
  const alertasDoSino = useMemo(
    () => alertasVisiveis(alertasSistema, preferenciasNotificacao)
      .filter(alerta => destinoDaAba(alerta.tab, ROLE_ACCESS[currentUserRole]) !== null),
    [alertasSistema, preferenciasNotificacao, currentUserRole],
  );

  const handleSavePlanejamento = (plano: PlanejamentoItem, isNew: boolean) => {
    const updated = isNew ? [plano, ...planejamentoItens] : planejamentoItens.map(item => item.id === plano.id ? plano : item);
    saveAndLog('Planejamento', isNew ? 'Criou' : 'Editou', `${isNew ? 'Planejou' : 'Editou'} ${plano.quantidadePlanejada} ${plano.unidade} de ${plano.servicoDescricao} entre ${plano.dataInicio} e ${plano.dataFim}.`, historyLogs, () => {
      setPlanejamentoItens(updated);
      writeStorageValue(localStorage, STORAGE_KEYS.planejamentoItens, JSON.stringify(updated));
    });
  };

  const handleSaveFrente = (frente: FrenteServico, isNew: boolean) => {
    const updated = isNew ? [frente, ...frentesServico] : frentesServico.map(item => item.id === frente.id ? frente : item);
    saveAndLog('Frentes de Serviço', isNew ? 'Criou' : 'Editou', `${isNew ? 'Cadastrou' : 'Editou'} a frente ${frente.nome} (${frente.situacao}).`, historyLogs, () => {
      setFrentesServico(updated);
      writeStorageValue(localStorage, STORAGE_KEYS.frentesServico, JSON.stringify(updated));
    });
  };

  const handleSaveServicoObra = (servico: ServicoObra, isNew: boolean) => {
    const updated = isNew ? [servico, ...servicosObra] : servicosObra.map(item => item.id === servico.id ? servico : item);
    saveAndLog('Produção', isNew ? 'Criou' : 'Editou', `${isNew ? 'Cadastrou' : 'Editou'} o serviço ${servico.descricao}.`, historyLogs, () => {
      setServicosObra(updated);
      writeStorageValue(localStorage, STORAGE_KEYS.servicosObra, JSON.stringify(updated));
    });
  };

  const handleSaveProducao = (registro: RegistroProducao, isNew: boolean) => {
    const updated = isNew ? [registro, ...producaoRegistros] : producaoRegistros.map(item => item.id === registro.id ? registro : item);
    saveAndLog('Produção', isNew ? 'Criou' : 'Editou', `${isNew ? 'Lançou' : 'Editou'} ${registro.quantidade} ${registro.unidade} de ${registro.servicoDescricao} em ${registro.data}.`, historyLogs, () => {
      setProducaoRegistros(updated);
      writeStorageValue(localStorage, STORAGE_KEYS.producaoRegistros, JSON.stringify(updated));
    });
  };

  const handleSaveDiarioObra = (diario: DiarioObra, isNew: boolean) => {
    const updated = isNew ? [diario, ...diariosObra] : diariosObra.map(item => item.id === diario.id ? diario : item);
    saveAndLog('Diário de Obra', isNew ? 'Criou' : 'Editou', `${isNew ? 'Registrou' : 'Editou'} o diário de ${diario.data}.`, historyLogs, () => {
      setDiariosObra(updated);
      writeStorageValue(localStorage, STORAGE_KEYS.diariosObra, JSON.stringify(updated));
    });
  };

  const handleSaveMaterial = (material: Material, isNew: boolean) => {
    const updated = saveMaterial(materiaisCadastro, material, isNew);
    saveAndLog('Materiais', isNew ? 'Criou' : 'Editou', `${isNew ? 'Cadastrou' : 'Editou'} o material ${material.descricao}.`, historyLogs, () => {
      setMateriaisCadastro(updated);
      writeStorageValue(localStorage, STORAGE_KEYS.materiaisCadastro, JSON.stringify(updated));
    });
  };

  const handleSaveMovimentoMaterial = (movimento: MovimentoMaterial) => {
    const updated = appendMovement(materiaisMovimentos, movimento);
    saveAndLog('Materiais', 'Criou', `${movimento.tipo} de ${movimento.quantidade} ${movimento.unidade} de ${movimento.materialDescricao}.`, historyLogs, () => {
      setMateriaisMovimentos(updated);
      writeStorageValue(localStorage, STORAGE_KEYS.materiaisMovimentos, JSON.stringify(updated));
    });
  };

  // Vários itens de uma vez (apontamento do dia no ERP): um único saveAndLog,
  // para o segundo item não sobrescrever o primeiro com um estado antigo.
  const podeEditarMateriais = pode(currentUserRole, 'materiais', 'editar');
  // Viagem da jazida com ticket repetido (mesmo número e tipo) vai sozinha para a
  // Lixeira: fica o primeiro registrado, e o resto pode ser restaurado.
  useEffect(() => {
    if (!isLoggedIn || !podeEditarMateriais || ticketsJazida.length === 0) return;
    const repetidos = ticketsRepetidosParaExcluir(ticketsJazida);
    if (!repetidos.length) return;
    excluirCadastros({
      tabela: 'ticketsJazida',
      storageKey: 'renea_tickets_jazida',
      tela: 'Tickets Jazida',
      itens: repetidos.map(item => ({ item: item as TicketJazida & { nome?: string }, rotulo: `Ticket ${item.tipoTicket || 'Liberação'} Nº ${item.ticketNumero} (repetido)` })),
      lista: ticketsJazida as Array<TicketJazida & { nome?: string }>,
      setLista: next => setTicketsJazida(next),
    });
    repetidos.forEach(item => {
      void deletePublicTicket(db, item.id).catch(error => console.warn('Falha ao excluir ticket público repetido:', error));
    });
    addNotification('Tickets repetidos excluídos', `${repetidos.length} viagem(ns) da jazida com ticket já lançado foram para a Lixeira. Dá para restaurar de lá.`, 'info', 'Sistema Local');
  }, [ticketsJazida, isLoggedIn, podeEditarMateriais]);

  // Nota ou ticket repetido no mesmo material é desfeito sozinho, venha de onde
  // vier (lançamento, link do apontador, importação, nuvem). Fica no histórico.
  useEffect(() => {
    if (!isLoggedIn || !podeEditarMateriais || materiaisMovimentos.length === 0) return;
    const { movimentos, desfeitos } = desfazerNotasRepetidas(materiaisMovimentos, new Date().toISOString());
    if (!desfeitos.length) return;
    saveAndLog('Materiais', 'Excluiu', `Desfez automaticamente ${desfeitos.length} lançamento(s) com nota ou ticket repetido.`, historyLogs, () => {
      setMateriaisMovimentos(movimentos);
      writeStorageValue(localStorage, STORAGE_KEYS.materiaisMovimentos, JSON.stringify(movimentos));
    });
    addNotification('Lançamentos repetidos desfeitos', `${desfeitos.length} lançamento(s) de material com nota ou ticket já lançado saíram do saldo. Continuam no histórico.`, 'info', 'Sistema Local');
  // saveAndLog e historyLogs mudam a cada render; a regra só depende dos movimentos.
  }, [materiaisMovimentos, isLoggedIn, podeEditarMateriais]);

  const handleSaveMovimentosMaterial = (movimentos: MovimentoMaterial[], descricao: string) => {
    if (movimentos.length === 0) return;
    const updated = mergeMaterialUseMovements(materiaisMovimentos, movimentos).movements;
    saveAndLog('Materiais', 'Criou', descricao, historyLogs, () => {
      setMateriaisMovimentos(updated);
      writeStorageValue(localStorage, STORAGE_KEYS.materiaisMovimentos, JSON.stringify(updated));
    });
  };

  // Vincular entradas a um ramo e desfazer um uso trocam o registro pelo mesmo
  // ID, sem apagar nenhum movimento.
  const handleUpdateMovimentosMaterial = (alterados: MovimentoMaterial[], descricao: string, acao: 'Editou' | 'Excluiu' = 'Editou') => {
    if (alterados.length === 0) return;
    const porId = new Map(alterados.map(item => [item.id, item]));
    const updated = materiaisMovimentos.map(item => porId.get(item.id) || item);
    saveAndLog('Materiais', acao, descricao, historyLogs, () => {
      setMateriaisMovimentos(updated);
      writeStorageValue(localStorage, STORAGE_KEYS.materiaisMovimentos, JSON.stringify(updated));
    });
  };

  const handleApplyMaterialImport = (newMaterials: Material[], newMovements: MovimentoMaterial[]) => {
    if (newMaterials.length === 0 && newMovements.length === 0) return;
    const { materials: updatedMaterials, movements: updatedMovements, addedMaterials, addedMovements } = applyMaterialImport(
      materiaisCadastro, materiaisMovimentos, newMaterials, newMovements,
    );
    if (addedMaterials === 0 && addedMovements === 0) return;
    // Mesmo caminho de todo outro lançamento em lote (Controle de Estacas,
    // Tickets Jazida, Planilha Mestre): saveAndLog grava o histórico de
    // auditoria e sincroniza com a nuvem, em vez de só atualizar o estado
    // local sem deixar rastro de quem/quando aplicou a importação.
    saveAndLog(
      'Materiais',
      'Criou',
      `Importou ${addedMaterials} material(is) novo(s) e ${addedMovements} movimento(s) por planilha.`,
      historyLogs,
      () => {
        setMateriaisCadastro(updatedMaterials);
        setMateriaisMovimentos(updatedMovements);
        writeStorageValue(localStorage, STORAGE_KEYS.materiaisCadastro, JSON.stringify(updatedMaterials));
        writeStorageValue(localStorage, STORAGE_KEYS.materiaisMovimentos, JSON.stringify(updatedMovements));
      },
    );
  };

  const handleSaveOrdemServico = (recebida: OrdemServico, isNew: boolean) => {
    // A data decide entre esta edição e a de outro aparelho (A13).
    const ordem: OrdemServico = { ...recebida, atualizadoEm: new Date().toISOString() };
    const updated = isNew ? [ordem, ...ordensServico] : ordensServico.map(item => item.id === ordem.id ? ordem : item);
    const equipamento = equipamentos.find(item => item.id === ordem.equipamentoId);
    const liberacao = liberarMaquinasDaOrdemConcluida(ordem, controleEquipamentosDiario, activeUserName);
    saveAndLog(
      'Manutenção',
      isNew ? 'Criou' : 'Editou',
      `${isNew ? 'Abriu' : 'Atualizou'} a ${ordem.numero} de ${equipamento?.prefixo || 'frota não localizada'} — ${ordem.status}.${liberacao.liberados ? ` Liberou ${liberacao.liberados} lançamento(s) da frota.` : ''}`,
      historyLogs,
      () => {
        setOrdensServico(updated);
        writeStorageValue(localStorage, 'renea_ordens_servico', JSON.stringify(updated));
        if (liberacao.liberados) {
          setControleEquipamentosDiario(liberacao.registros);
          writeStorageValue(localStorage, 'renea_controle_equipamentos_diario', JSON.stringify(liberacao.registros));
        }
      },
    );
  };

  const handleDeleteOrdemServico = (id: string) => {
    if (exclusaoRecusada(podeExcluirLancamento)) return;
    const ordem = ordensServico.find(item => item.id === id);
    if (!ordem) return;
    excluirCadastros({
      tabela: 'ordensServico',
      storageKey: 'renea_ordens_servico',
      tela: 'Manutenção',
      itens: [{ item: ordem, rotulo: `Ordem de serviço ${ordem.numero || id}` }],
      lista: ordensServico,
      setLista: setOrdensServico,
    });
  };

  const handleSaveControleEquipamentoDiario = (registroRecebido: ControleEquipamentoDiario, isNewRecebido: boolean) => {
    // Equipamento que já tem lançamento no dia não ganha outro: o novo atualiza o existente.
    const { registro, novo: isNew } = isNewRecebido
      ? juntarComLancamentoDoDia(controleEquipamentosDiario, registroRecebido)
      : { registro: registroRecebido, novo: false };
    const maintenance = garantirOrdemAutomaticaDaFrota(registro, ordensServico, activeUserName);
    const registroVinculado = maintenance.registro;
    const updated = isNew
      ? [registroVinculado, ...controleEquipamentosDiario]
      : controleEquipamentosDiario.map(item => item.id === registroVinculado.id ? registroVinculado : item);
    saveAndLog(
      'Controle Diário de Equipamentos',
      isNew ? 'Criou' : 'Editou',
      `${isNew ? 'Criou' : 'Editou'} o controle de ${registroVinculado.prefixo} em ${registroVinculado.data}.${maintenance.criada ? ` Abriu automaticamente a ${maintenance.ordens[0].numero}.` : ''}`,
      historyLogs,
      () => {
        setControleEquipamentosDiario(updated);
        writeStorageValue(localStorage, 'renea_controle_equipamentos_diario', JSON.stringify(updated));
        if (maintenance.ordens !== ordensServico) {
          setOrdensServico(maintenance.ordens);
          writeStorageValue(localStorage, 'renea_ordens_servico', JSON.stringify(maintenance.ordens));
        }
      },
    );
  };

  // Vários lançamentos de uma vez (aba Lançar do Quadro da Frota): uma gravação só,
  // para um não sobrescrever o outro, com a OS automática de cada manutenção.
  const handleSaveControleEquipamentosEmLote = (itens: Array<{ registro: ControleEquipamentoDiario; novo: boolean }>) => {
    if (!itens.length) return;
    let ordens = ordensServico;
    let abertas = 0;
    const porId = new Map(controleEquipamentosDiario.map(item => [item.id, item]));
    const novos: ControleEquipamentoDiario[] = [];
    itens.forEach(item => {
      const { registro, novo } = item.novo
        ? juntarComLancamentoDoDia([...novos, ...porId.values()], item.registro)
        : item;
      const maintenance = garantirOrdemAutomaticaDaFrota(registro, ordens, activeUserName);
      ordens = maintenance.ordens;
      if (maintenance.criada) abertas += 1;
      const naFila = novos.findIndex(atual => atual.id === maintenance.registro.id);
      if (naFila >= 0) novos[naFila] = maintenance.registro;
      else if (novo && !porId.has(maintenance.registro.id)) novos.push(maintenance.registro);
      else porId.set(maintenance.registro.id, maintenance.registro);
    });
    const updated = [...novos, ...controleEquipamentosDiario.map(item => porId.get(item.id) || item)];
    saveAndLog(
      'Controle Diário de Equipamentos',
      'Editou',
      `Lançou ${itens.length} equipamento(s) pelo Quadro da Frota.${abertas ? ` Abriu ${abertas} OS automática(s).` : ''}`,
      historyLogs,
      () => {
        setControleEquipamentosDiario(updated);
        writeStorageValue(localStorage, 'renea_controle_equipamentos_diario', JSON.stringify(updated));
        if (ordens !== ordensServico) {
          setOrdensServico(ordens);
          writeStorageValue(localStorage, 'renea_ordens_servico', JSON.stringify(ordens));
        }
      },
    );
  };

  // Reconcilia lançamentos antigos de manutenção com a oficina ao carregar a base.
  // Assim, registros históricos não dependem de serem editados novamente para gerar OS.
  const maintenanceBackfillKey = useRef('');
  useEffect(() => {
    if (!controleEquipamentosDiario.length || maintenanceBackfillKey.current === `${controleEquipamentosDiario.length}:${ordensServico.length}`) return;
    maintenanceBackfillKey.current = `${controleEquipamentosDiario.length}:${ordensServico.length}`;
    const result = reconciliarHistoricoManutencaoDaFrota(controleEquipamentosDiario, ordensServico, activeUserName);
    if (result.ordens !== ordensServico) {
      setOrdensServico(result.ordens);
      writeStorageValue(localStorage, 'renea_ordens_servico', JSON.stringify(result.ordens));
    }
    if (result.registros !== controleEquipamentosDiario) {
      setControleEquipamentosDiario(result.registros);
      writeStorageValue(localStorage, 'renea_controle_equipamentos_diario', JSON.stringify(result.registros));
    }
  }, [controleEquipamentosDiario, ordensServico, activeUserName]);

  const handleApproveControleEquipamentoDiario = (id: string, status: 'APROVADO' | 'REJEITADO') => {
    if (!['admin', 'gestor'].includes(currentUserRole)) return;
    const current = controleEquipamentosDiario.find(item => item.id === id);
    if (!current) return;
    const now = new Date().toISOString();
    handleSaveControleEquipamentoDiario({
      ...current,
      aprovacao: {
        ...(current.aprovacao || { status: 'PENDENTE', solicitadoEm: current.criadoEm, solicitadoPor: 'Operação' }),
        status,
        decididoEm: now,
        decididoPor: activeUserName,
      },
      atualizadoEm: now,
    }, false);
  };

  const handleImportControleEquipamentosDiario = (registros: ControleEquipamentoDiario[]) => {
    if (!registros.length) return;
    let currentOrdens = [...ordensServico];
    const registrosProcessados = registros.map(reg => {
      if (['Em manutenção', 'Aguardando manutenção'].includes(reg.status)) {
        const maintenance = garantirOrdemAutomaticaDaFrota(reg, currentOrdens, activeUserName);
        currentOrdens = maintenance.ordens;
        return maintenance.registro;
      }
      return reg;
    });

    const result = mergeImportedRecords(controleEquipamentosDiario, registrosProcessados, item => normalizeImportText(item.chave || `${item.data}|${item.codigoFuncionario}`));
    saveAndLog(
      'Controle Diário de Equipamentos',
      'Criou',
      `Importação concluída: ${result.created} novo(s), ${result.updated} atualizado(s), ${result.unchanged} já existente(s), ${result.duplicated} duplicado(s) no arquivo.`,
      historyLogs,
      () => {
        setControleEquipamentosDiario(result.next);
        writeStorageValue(localStorage, 'renea_controle_equipamentos_diario', JSON.stringify(result.next));
        if (currentOrdens !== ordensServico) {
          setOrdensServico(currentOrdens);
          writeStorageValue(localStorage, 'renea_ordens_servico', JSON.stringify(currentOrdens));
        }
      },
    );
  };

  const handleDeleteControleEquipamentosDiario = (ids: string[], jaConfirmado = false) => {
    if (exclusaoRecusada(podeExcluirLancamento)) return;
    const uniqueIds = Array.from(new Set(ids));
    if (!uniqueIds.length || (!jaConfirmado && !confirm(`Você está prestes a excluir ${uniqueIds.length} registro(s) do controle de basculantes. Continuar?`))) return;
    const selecionados = new Set(uniqueIds);
    excluirCadastros({
      tabela: 'controleEquipamentosDiario',
      storageKey: 'renea_controle_equipamentos_diario',
      tela: 'Controle Diário de Equipamentos',
      itens: controleEquipamentosDiario
        .filter(item => selecionados.has(item.id))
        .map(item => ({ item, rotulo: `${item.prefixo || 'Lançamento da frota'} em ${item.data}` })),
      lista: controleEquipamentosDiario,
      setLista: setControleEquipamentosDiario,
    });
  };

  /**
   * "Remover do quadro" desmobiliza (não apaga) e some com o lançamento de
   * hoje, se tiver: mesma ação de excluir em Cadastros > Equipamentos, só que
   * disparada direto do Quadro da Frota, pra sumir da tela na hora.
   */
  const handleRemoverEquipamentosDoQuadro = (itens: Array<{ equipamentoId: string; registroId?: string }>) => {
    const { alvos, equipamentosAtualizados: updatedEquipamentos, registrosAtualizados: updatedControle } = removerEquipamentosDoQuadro(equipamentos, controleEquipamentosDiario, itens);
    if (!alvos.length) return;
    const mudouControle = updatedControle.length !== controleEquipamentosDiario.length;
    // O lançamento do dia que sai deixa marca (A12): vai para a Lixeira e não volta de outro aparelho.
    const ficam = new Set(updatedControle.map(item => item.id));
    const agora = new Date().toISOString();
    const novasExclusoes = controleEquipamentosDiario
      .filter(item => !ficam.has(item.id))
      .map(item => criarExclusao({
        tabela: 'controleEquipamentosDiario',
        registro: item as unknown as { id: string } & Record<string, unknown>,
        rotulo: `${item.prefixo || 'Lançamento da frota'} em ${item.data}`,
        usuario: activeUserName,
        agora,
      }));
    const nextExclusoes = [...novasExclusoes, ...exclusoes];
    saveAndLog(
      'Quadro da Frota',
      'Desmobilizou',
      `Removeu ${alvos.length} equipamento(s) do Quadro da Frota: ${alvos.map(item => item.prefixo).join(', ')}.`,
      historyLogs,
      () => {
        commitStorageBatch(localStorage, [
          { key: 'renea_equipamentos', value: JSON.stringify(updatedEquipamentos) },
          ...(mudouControle ? [
            { key: 'renea_controle_equipamentos_diario', value: JSON.stringify(updatedControle) },
            { key: STORAGE_KEYS.exclusoes, value: JSON.stringify(nextExclusoes) },
          ] : []),
        ]);
        setEquipamentos(updatedEquipamentos);
        if (mudouControle) {
          setControleEquipamentosDiario(updatedControle);
          setExclusoes(nextExclusoes);
        }
      },
    );
  };

  if (externalTicketLink) {
    return (
      <Suspense fallback={<ScreenLoadingFallback label="Abrindo tickets..." />}>
        <TicketLinkExterno
          tickets={externalPublicTickets}
          isLoadingCloud={isExternalTicketLoading}
          loadError={externalTicketLoadError}
          onReserveNumber={() => reservePublicTicketNumberViaApi(externalTicketAccessToken)}
          onSaveTicket={handleSaveTicketLink}
          onSearchPendingReceipts={query => searchPendingPublicTickets(query, externalTicketAccessToken)}
        />
      </Suspense>
    );
  }

  if (externalPresenceToken) {
    return (
      <Suspense fallback={<ScreenLoadingFallback label="Abrindo presença..." />}>
        <PresencaTempoRealPublica
          token={externalPresenceToken}
          gruposEquipe={gruposEquipe}
          funcionarios={funcionarios}
          funcionariosDisponiveis={externalFuncionariosDisponiveis}
          empresas={empresas}
          obras={obras}
          meuGrupo={externalMeuGrupo}
          meusRegistros={externalMeusRegistros}
          datasDisponiveis={externalDatasDisponiveis}
          dataSelecionada={externalDataSelecionada}
          dataAtual={externalDataAtual}
          observacaoDia={externalObservacaoDia}
          onSelectDate={selectExternalPresenceDate}
          isLoadingCloud={isExternalPresenceLoading}
          loadError={externalPresenceLoadError}
          onRetry={() => void reloadExternalPresence()}
          onSubmitPresenca={handleSubmitPresencaLink}
          onUpdateRecord={handleUpdateExternalPresencaRecord}
          onAddMember={handleAddExternalPresencaMember}
          onRemoveMember={handleRemoveExternalPresencaMember}
          onSaveDayNote={handleSaveExternalDayNote}
        />
      </Suspense>
    );
  }

  // Login Screen Render
  if (isAuthenticating && !isLoggedIn) {
    return <AuthLoadingScreen />;
  }

  if (!isLoggedIn) {
    return (
      <LoginScreen
        logoSrc={reneaLogo}
        username={username}
        password={password}
        showPassword={showPassword}
        isAuthenticating={isAuthenticating}
        loginError={loginError}
        loginNotice={loginNotice}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onTogglePasswordVisibility={() => setShowPassword(value => !value)}
        onSubmit={handleLogin}
        onPasswordRecovery={() => void handlePasswordRecovery()}
      />
    );
  }
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllAsRead = () => {
    const updated = markAllNotificationsAsRead(notifications);
    setNotifications(updated);
    persistNotifications(localStorage, updated);
  };

  const handleClearNotifications = () => {
    setNotifications([]);
    persistNotifications(localStorage, []);
  };

  const handleMarkNotificationAsRead = (id: string) => {
    setNotifications(prev => {
      const updated = markNotificationAsRead(prev, id);
      persistNotifications(localStorage, updated);
      return updated;
    });
  };

  const normalizedMenuSearch = menuSearch.trim().toLocaleLowerCase('pt-BR');
  const allowedTabs = ROLE_ACCESS[currentUserRole];
  const filteredNavigationGroups = SIDEBAR_NAVIGATION_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(item => allowedTabs.includes(item.id)
        && (!normalizedMenuSearch || item.label.toLocaleLowerCase('pt-BR').includes(normalizedMenuSearch))),
    }))
    .filter(group => group.items.length > 0);

  // Função comum: um hook aqui, depois dos retornos antecipados, derrubava o app ao entrar.
  const podeAbrir = (tab: string) => destinoDaAba(tab, ROLE_ACCESS[currentUserRole]) !== null;

  const navigateTo = (tab: string, closeMobile = false) => {
    setRelatorioPedido('');
    // A busca do menu não fica filtrada depois de escolher a tela (B6).
    setMenuSearch('');
    if (tab === 'tickets-jazida') setMateriaisPedido(atual => ({ secao: 'viagens', vez: atual.vez + 1 }));
    else if (tab === 'materiais') setMateriaisPedido(atual => (atual.secao ? { secao: undefined, vez: atual.vez } : atual));
    // Endereço antigo abre a tela onde aquele dado mora hoje.
    setActiveTab(destinoDaAba(tab, allowedTabs) || 'dashboard');
    if (closeMobile) setIsMobileMenuOpen(false);
    window.requestAnimationFrame(() => {
      document.getElementById('main-workspace')?.scrollTo({ top: 0, behavior: 'auto' });
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
    // Abrir uma tela específica confere a nuvem na hora, em vez de confiar
    // só no retrato que já estava carregado desde o pulso automático
    // anterior — quem entrou em Controle de Presença agora quer o dado de
    // agora, não o de até 60 segundos atrás.
    void pullRemoteChanges();
  };

  const abrirRelatorio = (aba: DestinoRelatorio) => {
    navigateTo(aba);
    if (aba === 'materiais') setMateriaisPedido(atual => ({ secao: 'relatorios', vez: atual.vez + 1 }));
    else setRelatorioPedido(aba);
  };

  const renderNavigation = (mobile = false) => (
    <NavigationMenu
      activeTab={activeTab}
      groups={filteredNavigationGroups}
      menuSearch={menuSearch}
      onMenuSearchChange={setMenuSearch}
      onNavigate={navigateTo}
      mobile={mobile}
    />
  );
  // Logged-in Core App Layout (Responsive Green Theme)
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased font-sans" id="app-root">
      
      {/* Mobile navigation header */}
      <header className="lg:hidden flex items-center justify-between h-[4.25rem] bg-white border-b border-slate-200 px-4 text-slate-900 print:hidden shrink-0" id="mobile-header">
        <img
          src={reneaLogo}
          alt="RENEA Infraestrutura"
          className="h-6 w-auto object-contain"
          referrerPolicy="no-referrer"
        />

        <div
          className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold ${isCloudConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}
          title={lastCloudSync ? `Última sincronização com a nuvem: ${lastCloudSync}` : 'Ainda sem sincronização com a nuvem nesta sessão'}
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${isCloudConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <span>{isCloudConnected ? 'Nuvem OK' : 'Sem nuvem'}</span>
        </div>
        {pendingCount > 0 && (
          <span
            className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700"
            title={`${pendingCount} pendência(s) offline aguardando envio`}
            aria-live="polite"
          >
            Pendente: {pendingCount}
          </span>
        )}

        <div className="flex items-center gap-1">
          {/* No celular não há atalho de teclado: a lupa abre a mesma pesquisa (M8). */}
          <button
            type="button"
            onClick={() => setPesquisaAberta(true)}
            title="Pesquisar em todo o sistema"
            aria-label="Pesquisar em todo o sistema"
            className="cursor-pointer rounded-xl p-2.5 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"
          >
            <Search className="w-5 h-5" />
          </button>

          {allowedTabs.includes('cadastros') && (
            <button
              type="button"
              onClick={() => navigateTo('cadastros', true)}
              title="Abrir cadastros auxiliares"
              aria-label="Abrir cadastros auxiliares"
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${activeTab === 'cadastros' ? 'bg-emerald-700 border-emerald-700 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200'}`}
            >
              <FolderPlus className="w-5 h-5" />
            </button>
          )}

          {/* Notification Bell Mobile: antes só alternava um estado que só o
              painel do cabeçalho desktop (oculto em telas menores que 1024px)
              usava para se mostrar — o toque no sino não abria nada visível
              neste tamanho de tela. Agora usa o mesmo painel do desktop. */}
          <NotificationCenter
            isOpen={isNotifDropdownOpen}
            notifications={notifications}
            unreadCount={unreadCount}
            onToggle={() => setIsNotifDropdownOpen(value => !value)}
            onClose={() => setIsNotifDropdownOpen(false)}
            onMarkAllAsRead={handleMarkAllAsRead}
            onClear={handleClearNotifications}
            onMarkOneAsRead={handleMarkNotificationAsRead}
            alertas={alertasDoSino}
            onAlertaClick={tab => { setIsNotifDropdownOpen(false); navigateTo(tab); }}
          />

          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
            className="cursor-pointer rounded-xl p-2.5 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-950/85 flex justify-end print:hidden" id="mobile-drawer">
          <div className="mobile-sidebar-panel w-[18.5rem] max-w-[82vw] border-l border-slate-800 p-4 flex flex-col space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <img src={reneaLogoWhite} alt="RENEA Infraestrutura" className="h-7 w-auto object-contain" />
              <button onClick={() => setIsMobileMenuOpen(false)} className="cursor-pointer rounded-lg p-2 text-emerald-100 hover:bg-white/10 hover:text-white" aria-label="Fechar navegação">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto">
              {renderNavigation(true)}
              <div className="pt-5 mt-5 border-t border-slate-800">
                <button type="button" onClick={() => { void handleLogout(); setIsMobileMenuOpen(false); }} className="w-full py-3 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl font-semibold text-xs flex items-center justify-center gap-2">
                  <LogOut className="w-4 h-4" /> Sair da conta
                </button>
                <p className="mt-3 text-center text-[10px] text-slate-500">{APP_VERSION_LABEL}</p>
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* Desktop ERP shell: the sidebar is the single source of navigation. */}
      <div className="erp-shell">
        {!combustivelListaSomente && <DesktopSidebar
          activeTab={activeTab}
          groups={filteredNavigationGroups}
          onNavigate={tab => navigateTo(tab)}
        />}
        <main className="erp-workspace" id="main-workspace">
        {!combustivelListaSomente && <DesktopTopBar
          activeTab={activeTab}
          groups={filteredNavigationGroups}
          menuSearch={menuSearch}
          onMenuSearchChange={setMenuSearch}
          currentUser={currentUser}
          isNotificationOpen={isNotifDropdownOpen}
          notifications={notifications}
          unreadCount={unreadCount}
          alertas={alertasDoSino}
          isCloudConnected={isCloudConnected}
          lastCloudSync={lastCloudSync}
          pendingCount={pendingCount}
          isRetryingPending={isRetryingPending}
          onRetryPending={() => void handleRetryPending()}
          onNavigate={tab => navigateTo(tab)}
          onToggleNotifications={() => setIsNotifDropdownOpen(value => !value)}
          onCloseNotifications={() => setIsNotifDropdownOpen(false)}
          onMarkAllNotificationsAsRead={handleMarkAllAsRead}
          onClearNotifications={handleClearNotifications}
          onMarkNotificationAsRead={handleMarkNotificationAsRead}
          onLogout={() => void handleLogout()}
        />}
        {/* Dynamic Inner Tab Viewport */}
        <div id="main-tab-viewport" className={`flex-1 overflow-x-clip w-full max-w-none print:p-0 print:m-0 ${activeTab === 'dashboard' ? 'dashboard-viewport' : combustivelListaSomente ? 'p-1 sm:p-2' : 'p-3 sm:p-4 lg:p-5'}`}>
          <Suspense fallback={<ScreenLoadingFallback />}>
            <RouteMotion key={activeTab}>
            {activeTab === 'dashboard' && (
              <Dashboard
                empresas={empresas}
                obras={obras}
                equipamentos={equipamentos}
                funcionarios={funcionarios}
                comboios={comboios}
                combustiveis={combustiveis}
                lubrificantes={lubrificantes}
                abastecimentos={abastecimentosAtivos}
                lubrificacoes={lubrificacoes}
                historyLogs={historyLogs}
                listasPresenca={listasPresenca}
                ordensServico={ordensServico}
                ticketsJazida={ticketsJazidaAtivos}
                estacas={controleEstacas}
                presencasLink={presencasLinkAtivas}
                controlesEquipamentos={controleEquipamentosDiario}
                gruposEquipe={gruposEquipe}
                planejamento={planejamentoItens}
                producao={producaoRegistros}
                medicoes={medicoes}
                materiais={materiaisCadastro}
                movimentosMaterial={materiaisMovimentosVigentes}
                fichasFvs={fichasFvs}
                inspecoes={inspecoes}
                naoConformidades={naoConformidades}
                lancamentosCusto={lancamentosCusto}
                orcamento={orcamentoItens}
                frentes={frentesServico}
                onNavigate={navigateTo}
              />
            )}

            {activeTab === 'cadastros' && allowedTabs.includes('cadastros') && (
              <CadastrosTab
                empresas={empresas}
                obras={obras}
                equipamentos={equipamentos}
                funcionarios={funcionarios}
                comboios={comboios}
                combustiveis={combustiveis}
                lubrificantes={lubrificantes}
                canteiros={canteiros}
                etapas={etapas}
                historyLogs={historyLogs}
                exclusoes={exclusoes}
                podeEditar={pode(currentUserRole, 'cadastros', 'editar')}
                podeExcluir={pode(currentUserRole, 'cadastros', 'excluir')}
                onSaveEmpresa={handleSaveEmpresa}
                onSaveObra={handleSaveObra}
                onSaveEquipamento={handleSaveEquipamento}
                onSaveFuncionario={handleSaveFuncionario}
                onSaveComboio={handleSaveComboio}
                onSaveTipoCombustivel={handleSaveTipoCombustivel}
                onSaveCanteiro={handleSaveCanteiro}
                onSaveProdutoLubrificacao={handleSaveProdutoLubrificacao}
                onSaveEtapaServico={handleSaveEtapaServico}
                frentesServico={frentesServico}
                servicosObra={servicosObra}
                onSaveFrente={handleSaveFrente}
                onSaveServico={handleSaveServicoObra}
                onInativar={(tabela, id) => {
                  if (tabela === 'empresas') handleDeleteEmpresa(id);
                  else if (tabela === 'funcionarios') handleDeleteFuncionario(id);
                  else if (tabela === 'equipamentos') handleDeleteEquipamento(id);
                }}
                usosDoCadastro={usosDoCadastroAtual}
                onExcluir={handleExcluirCadastro}
                onRestaurar={handleRestaurarCadastro}
                onExcluirVarios={handleExcluirCadastros}
                onRestaurarVarios={handleRestaurarCadastros}
                onApagarDeVez={handleApagarDeVez}
                onImportCadastros={handleImportCadastros}
              />
            )}

            {activeTab === 'lancamentos' && (
              <LancamentosTab
                empresas={empresas}
                equipamentos={equipamentos}
                comboios={comboios}
                combustiveis={combustiveis}
                canteiros={canteirosNomes}
                lubrificantes={lubrificantes}
                abastecimentos={abastecimentosAtivos}
                lubrificacoes={lubrificacoes}
                onSaveAbastecimento={handleSaveAbastecimento}
                onDeleteAbastecimento={podeExcluirLancamento ? handleDeleteAbastecimento : undefined}
                onDeleteAbastecimentos={podeExcluirLancamento ? handleDeleteAbastecimentos : undefined}
                onRestaurarAbastecimentos={handleRestaurarCadastros}
                onImportAbastecimentos={handleImportAbastecimentos}
                onSaveLubrificacao={handleSaveLubrificacao}
                onDeleteLubrificacao={podeExcluirLancamento ? handleDeleteLubrificacao : undefined}
                onOpenCadastros={allowedTabs.includes('cadastros') ? () => navigateTo('cadastros') : undefined}
                registrosFrota={controleEquipamentosDiario}
                gruposEquipe={gruposEquipe}
                usuario={activeUserName}
                onOpenControle={allowedTabs.includes('controle-equipamentos') ? () => navigateTo('controle-equipamentos') : undefined}
                combustivelInicial={combustivelViewInicial}
                combustivelListaSomente={combustivelListaSomente}
                combustivelPorMaquina={relatorioPedido === 'lancamentos'}
              />
            )}

            {activeTab === 'administracao' && (
              <AdministracaoTab
                ultimaSincronizacao={lastCloudSync}
                nuvemConectada={isCloudConnected}
                gruposEquipe={gruposEquipe}
                onSaveGrupoEquipe={handleSaveGrupoEquipe}
                logs={historyLogs}
              />
            )}

            {activeTab === 'relatorios' && (
              <RelatoriosTab
                abastecimentos={abastecimentosAtivos}
                controlesEquipamentos={controleEquipamentosDiario}
                presencas={presencasLinkAtivas}
                movimentosMaterial={materiaisMovimentosVigentes}
                cravacoes={controleEstacas.cravacoes}
                podeAbrir={aba => allowedTabs.includes(aba)}
                onAbrir={abrirRelatorio}
              />
            )}

            {activeTab === 'planejamento' && (
              <PlanejamentoTab
                planos={planejamentoItens}
                servicos={servicosObra}
                producao={producaoRegistros}
                obras={obras}
                frentes={frentesServico}
                gruposEquipe={gruposEquipe}
                responsavel={activeUserName}
                podeEditar={pode(currentUserRole, 'planejamento', 'editar')}
                onSave={handleSavePlanejamento}
                onSaveProducao={pode(currentUserRole, 'producao', 'editar') ? handleSaveProducao : undefined}
              />
            )}

            {activeTab === 'diario-obra' && (
              <DiarioObraTab
                diarios={diariosObra}
                obras={obras}
                gruposEquipe={gruposEquipe}
                presencasLink={presencasLinkAtivas}
                controlesEquipamentos={controleEquipamentosDiario}
                apontamentos={apontamentosOperacionais}
                movimentosMaterial={materiaisMovimentosVigentes}
                ticketsJazida={ticketsJazidaAtivos}
                responsavel={activeUserName}
                podeEditar={pode(currentUserRole, 'diario-obra', 'editar')}
                onSave={handleSaveDiarioObra}
              />
            )}

            {activeTab === 'meu-dia' && (
              <MeuDiaTab
                responsavel={activeUserName}
                rotinas={rotinasDiarias}
                pendencias={pendenciasRotina}
                modelos={modelosRotina}
                onSaveRotina={handleSaveRotinaDiaria}
                onSavePendencia={handleSavePendenciaRotina}
                onSaveModelo={handleSaveModeloRotina}
                materiais={materiaisCadastro}
                movimentosMaterial={materiaisMovimentos}
                abastecimentos={abastecimentosAtivos}
                controlesFrota={controleEquipamentosDiario}
                equipamentos={equipamentos}
                onIrPara={aba => { if (allowedTabs.includes(aba)) navigateTo(aba); }}
              />
            )}

            {activeTab === 'materiais' && (
              <MateriaisTab
                key={materiaisPedido.vez}
                secaoInicial={materiaisPedido.secao}
                viagensJazida={(
                  <TicketsJazidaTab
                    tickets={ticketsJazida}
                    equipamentos={equipamentos}
                    controlesEquipamentos={controleEquipamentosDiario}
                    obras={obras}
                    responsavel={activeUserName}
                    onSaveTicket={handleSaveTicketJazida}
                    onDeleteTicket={podeExcluirLancamento ? handleDeleteTicketJazida : undefined}
                    onDeleteTickets={podeExcluirLancamento ? handleDeleteTicketsJazida : undefined}
                    onImportTickets={handleImportTicketsJazida}
                    onReserveTicketNumber={handleReserveTicketNumber}
                    onReserveTicketNumbers={handleReserveTicketNumbers}
                  />
                )}
                totalViagensJazida={ticketsJazida.length}
                materiais={materiaisCadastro}
                movimentos={materiaisMovimentos}
                empresas={empresas}
                etapas={etapas}
                responsavel={activeUserName}
                podeEditar={pode(currentUserRole, 'materiais', 'editar')}
                onSaveMaterial={handleSaveMaterial}
                onSaveMovimento={handleSaveMovimentoMaterial}
                onSaveMovimentos={handleSaveMovimentosMaterial}
                onUpdateMovimentos={handleUpdateMovimentosMaterial}
                onApplyImport={handleApplyMaterialImport}
                onSaveEtapas={handleSaveEtapasServico}
                onExcluirLocal={pode(currentUserRole, 'cadastros', 'excluir') ? (id, rotulo) => handleExcluirCadastro('etapas', id, rotulo) : undefined}
                onRestaurarLocal={handleRestaurarCadastro}
                locaisApagados={locaisApagados}
                previstos={materiaisPrevistos}
                onSavePrevistos={handleSaveMateriaisPrevistos}
              />
            )}

            {activeTab === 'colaboradores' && (
              <ColaboradoresTab
                funcionarios={funcionarios}
                empresas={empresas}
                gruposEquipe={gruposEquipe}
                presencasLink={presencasLinkAtivas}
                controlesEquipamentos={controleEquipamentosDiario}
                ticketsJazida={ticketsJazidaAtivos}
                checklists={checklists}
                onNavigate={navigateTo}
                podeAbrir={podeAbrir}
                responsavel={activeUserName}
                onAlterarSituacao={(proximo, descricao) => {
                  handleSaveFuncionario(proximo, false);
                  addNotification('Situação atualizada', descricao, 'info', 'Sistema Local');
                }}
              />
            )}

            {activeTab === 'manutencao' && (
              <ManutencaoTab
                ordensServico={ordensServico}
                equipamentos={equipamentos}
                controlesEquipamentos={controleEquipamentosDiario}
                responsavel={activeUserName}
                podeEditar={pode(currentUserRole, 'manutencao', 'editar')}
                historyLogs={historyLogs}
                onSave={handleSaveOrdemServico}
                onDelete={podeExcluirLancamento ? handleDeleteOrdemServico : undefined}
              />
            )}


            {activeTab === 'controle-equipamentos' && (
              <ControleEquipamentosDiarioTab
                registros={controleEquipamentosDiario}
                equipamentos={equipamentos}
                empresas={empresas}
                funcionarios={funcionarios}
                operationalDrivers={motoristasOperacionais}
                gruposEquipe={gruposEquipe}
                ordensServico={ordensServico}
                onSave={handleSaveControleEquipamentoDiario}
                onImport={handleImportControleEquipamentosDiario}
                onApplyCadastroSge={handleAplicarCadastroSge}
                onDeleteMany={podeExcluirLancamento ? ids => handleDeleteControleEquipamentosDiario(ids, true) : undefined}
                onOpenMaintenance={podeAbrir('manutencao') ? () => navigateTo('manutencao') : undefined}
                onOpenEquipmentRegistration={podeAbrir('cadastros') ? () => navigateTo('cadastros') : undefined}
                onSaveOperationalDriver={handleSaveOperationalDriver}
                onAddOperationalDrivers={handleAddOperationalDrivers}
                onDeleteOperationalDriver={podeExcluirCadastro ? handleDeleteOperationalDriver : undefined}
                canApproveFleet={['admin', 'gestor'].includes(currentUserRole)}
                registeredBy={activeUserName}
                onApproveFleetRecord={handleApproveControleEquipamentoDiario}
                quadro={(dia, verSituacao) => (
                  <QuadroFrota
                    equipamentos={equipamentos}
                    registros={controleEquipamentosDiario}
                    gruposEquipe={gruposEquipe}
                    abastecimentos={abastecimentosAtivos}
                    canteiros={canteirosNomes}
                    frentes={frentesServico}
                    funcionarios={funcionarios}
                    operationalDrivers={motoristasOperacionais}
                    podeEditar={pode(currentUserRole, 'controle-equipamentos', 'editar')}
                    usuario={activeUserName}
                    onSave={handleSaveControleEquipamentoDiario}
                    onSaveMany={handleSaveControleEquipamentosEmLote}
                    onDeleteMany={podeExcluirLancamento ? ids => handleDeleteControleEquipamentosDiario(ids, true) : undefined}
                    podeRemover={pode(currentUserRole, 'cadastros', 'excluir')}
                    onRemoverEquipamentos={handleRemoverEquipamentosDoQuadro}
                    onNavigate={navigateTo}
                    podeAbrir={podeAbrir}
                    dia={dia}
                    onAbrirSituacao={verSituacao}
                  />
                )}
              />
            )}

            {activeTab === 'presenca' && (
              <ControlePresencaTab
                funcionarios={funcionarios}
                empresas={empresas}
                obras={obras}
                canteiros={canteirosNomes}
                gruposEquipe={gruposEquipe}
                presencasLink={presencasLinkAtivas}
                historicoPresencas={historicoPresencas}
                pendingPublicSubmissionsCount={pendingPublicSubmissionsCount}
                onRestorePresenceHistory={handleRestorePresenceHistory}
                onSaveGrupoEquipe={handleSaveGrupoEquipe}
                onDeleteGrupoEquipe={podeExcluirCadastro ? handleDeleteGrupoEquipe : undefined}
                onUpdatePresencaLink={handleUpdatePresencaLink}
                onLancarPresencaManual={handleLancarPresencaManual}
                presencasInativas={presencasLinkInativas}
                onInativarPresencaLink={handleInativarPresencaLink}
                onReativarPresencaLink={handleReativarPresencaLink}
                onResetPresencaDia={handleResetPresencaDia}
                onSyncEquipesPlanilha={handleSyncEquipesPlanilha}
                viewInicial={relatorioPedido === 'presenca' ? 'relatorios' : undefined}
              />
            )}

            {activeTab === 'estacas' && (
              <EstacasTab
                controle={controleEstacas}
                obras={obras}
                onChange={handleChangeControleEstacas}
                responsavel={activeUserName}
                secaoInicial={relatorioPedido === 'estacas' ? 'relatorios' : undefined}
              />
            )}

            </RouteMotion>
          </Suspense>
        </div>
        </main>
      </div>

      <OfflineStatusV29 />
      <PesquisaGlobal
        fontes={{
          equipamentos,
          funcionarios,
          obras,
          frentes: frentesServico,
          servicos: servicosObra,
          materiais: materiaisCadastro,
          ordensServico,
          ticketsJazida,
          fichasFvs,
          inspecoes,
          naoConformidades,
          medicoes,
          documentos,
          ocorrencias,
        }}
        aberto={pesquisaAberta}
        onAbertoChange={setPesquisaAberta}
        podeAbrir={podeAbrir}
        onNavigate={navigateTo}
      />
      <ToastViewport toasts={activeToasts} />

    </div>
  );
}
