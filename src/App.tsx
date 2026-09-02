/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useEffect } from 'react';
import { 
  Empresa, 
  ObraLocal, 
  Equipamento, 
  VinculoOperadorEquipamento,
  Funcionario, 
  FuncionarioDisponivel,
  Comboio, 
  TipoCombustivel, 
  ProdutoLubrificacao, 
  EtapaServico, 
  Abastecimento, 
  Lubrificacao, 
  HistoryLog,
  ListaPresenca,
  OrdemServico,
  GrupoEquipe,
  PresencaApontamento,
  PresencaStatus,
  HistoricoPresenca,
  ApontamentoRamo,
  ApontamentoRamoRegistro,
  ApontamentoQuantidadeItem,
  TurnoApontamento,
  ClimaApontamento,
  CondicaoApontamento,
  TicketJazida,
  MaterialCadastro,
  MaterialRegistro,
  ParteDiariaEquipamento,
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
  INITIAL_TIPOS_COMBUSTIVEL, 
  INITIAL_PRODUTOS_LUBRIFICACAO, 
  INITIAL_ETAPAS_SERVICO, 
  INITIAL_ABASTECIMENTOS, 
  INITIAL_LUBRIFICACOES, 
  INITIAL_HISTORY_LOGS,
  INITIAL_PRESENCAS,
  INITIAL_ORDENS_SERVICO,
  INITIAL_GRUPOS_EQUIPES,
  INITIAL_PRESENCAS_LINK,
  INITIAL_HISTORICO_PRESENCAS,
  INITIAL_APONTAMENTO_RAMOS,
  INITIAL_APONTAMENTO_RAMO_REGISTROS,
  INITIAL_TICKETS_JAZIDA,
  hydrateInitialOperationalSeedData,
  loadInitialMateriaisData,
  INITIAL_PARTES_DIARIAS_EQUIPAMENTOS
} from './utils/initialData';
import { INITIAL_CONTROLE_ESTACAS } from './utils/initialEstacasData';
import { INITIAL_CONTROLE_EQUIPAMENTOS_DIARIO } from './utils/initialControleEquipamentosDiario';
import { OPERATIONAL_DRIVERS } from './fleet/operationalDrivers';
import { calculateSnapshotChecksum, isSnapshotIntact } from './utils/snapshotIntegrity';
import { enqueueOfflineCommand, flushOfflineCommands } from './utils/offlineQueue';
import {
  inferFleetCategory,
  normalizeAvailabilityTarget,
} from './utils/equipmentOperations';
import { filterNovelFuelImports } from './utils/fuelImportIdentity';
import { mergeImportedRecords } from './utils/importMerge';

// Subcomponents Imports
const Dashboard = lazy(() => import('./components/Dashboard'));
const ConsultaGeralTab = lazy(() => import('./components/ConsultaGeralTab'));
const UsuariosTab = lazy(() => import('./components/UsuariosTab'));
const CadastrosTab = lazy(() => import('./components/CadastrosTab'));
const LancamentosTab = lazy(() => import('./components/LancamentosTab'));
const RelatoriosTab = lazy(() => import('./components/RelatoriosGeraisTab'));
const ConfiguracoesTab = lazy(() => import('./components/ConfiguracoesTab'));
const ControlePresencaTab = lazy(() => import('./components/ControlePresencaTab'));
const TicketsJazidaTab = lazy(() => import('./components/TicketsJazidaTab'));
const PresencaTempoRealPublica = lazy(() => import('./components/PresencaTempoRealPublica'));
const ApontamentoRamosTab = lazy(() => import('./components/ApontamentoRamosTab'));
const ApontamentoRamoLinkExterno = lazy(() => import('./components/ApontamentoRamoLinkExterno'));
const MateriaisTab = lazy(() => import('./components/MateriaisTab'));
const TicketLinkExterno = lazy(() => import('./components/TicketLinkExterno'));
const ControleEquipamentosDiarioTab = lazy(() => import('./components/ControleEquipamentosDiarioTab'));
const EstacasTab = lazy(() => import('./components/EstacasTab'));
import OfflineStatusV29 from './components/OfflineStatusV29';

// A base histórica de materiais fica em um chunk separado para não pesar no
// login e nas demais telas. Ela é carregada antes da hidratação dos dados.
let INITIAL_MATERIAIS_CADASTRO: MaterialCadastro[] = [];
let INITIAL_MATERIAIS_REGISTROS: MaterialRegistro[] = [];
// Motion and Logo Import
import { motion } from 'motion/react';
import reneaLogo from './assets/images/logo-renea-transparent.png';

// Firebase Imports
import { auth, db } from './firebase';
import {
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  downloadFirebaseBackup,
  formatFirebaseSyncError,
  getFirebaseConnectionStatus,
  uploadFirebaseBackup,
  type FirebaseCloudData,
} from './firebaseCloudSync';
import {
  deletePublicTicket,
  loadPublicTickets,
  reservePublicTicketNumber,
  reservePublicTicketNumbers,
  savePublicTicket,
} from './firebaseTickets';
import {
  markPublicSubmissionsProcessed,
  subscribePendingPublicSubmissions,
  type PublicSubmission,
} from './firebasePublicSubmissions';
import {
  addPublicPresenceMember,
  updatePublicPresenceDayNote,
  loadPublicApontamentoConfig,
  loadPublicPresenceConfig,
  reservePublicTicketNumberViaApi,
  savePublicTicketViaApi,
  searchPendingPublicTickets,
  submitPublicApontamento,
  submitPublicPresence,
  updatePublicPresenceRecord,
  validatePublicTicketAccess,
  type PublicApontamentoPayload,
} from './publicApi';
import { loadOneDriveFuelPayload, type OneDriveFuelSyncStatus } from './oneDriveFuelSync';
import { materializeOneDriveFuelRows } from './utils/oneDriveFuelImport';
import { enrichFuelDataset } from './utils/fuelOperations';
import { rotateWeakPublicLinkTokens } from './utils/publicLinkSecurity';
import {
  normalizePresenceLists,
  normalizeRuntimeCollection,
  normalizeStakeControl,
  normalizeTeamGroups,
} from './utils/runtimeDataSafety';
import { commitStorageBatch, isStorageQuotaExceededError } from './utils/resilientStorage';
import { parseStoredJson, readStoredFlag, writeStorageValue, writeStoredFlag } from './data/localStore';
import { STORAGE_KEYS } from './data/storageKeys';
import { describeInvalidBackup, validateSystemBackup } from './utils/systemBackup';
import { promoteMasterWorkbook } from './masterData/materializeMasterData';
import type { MasterWorkbookAnalysis, MasterWorkbookReviewRow } from './masterData/masterWorkbook';
import { validateCentralRecord } from './masterData/centralRegistry';
import { recordTabUsage } from './usageTelemetry';
import {
  ALL_NAVIGATION_ITEMS,
  NAVIGATION_GROUPS,
  ROLE_ACCESS,
  normalizeUserRole,
  type UserRole,
} from './app/navigation/navigation';
import { NavigationMenu } from './app/shell/NavigationMenu';
import { DesktopTopBar } from './app/shell/DesktopTopBar';
import { DesktopSidebar } from './app/shell/DesktopSidebar';
import {
  getApontamentoTokenFromUrl,
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
  Bell,
  BellRing,
} from 'lucide-react';

import { AppNotification } from './types';

type CadastroImportTarget = 'empresas' | 'fornecedores' | 'obras' | 'equipamentos' | 'veiculos' | 'funcionarios' | 'comboios' | 'combustiveis' | 'lubrificantes' | 'etapas';
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
  const next = current.map(item => seedByKey.get(getKey(item)) ?? item);
  const currentKeys = new Set(current.map(getKey));
  seed.forEach(item => {
    if (!currentKeys.has(getKey(item))) next.push(item);
  });
  return next;
};

const materialRegistroKey = (item: MaterialRegistro) =>
  [
    item.data,
    item.aba,
    item.material,
    item.unidade,
    item.quantidade,
    item.nota || '',
    item.placa || '',
    item.prefixo || '',
    item.origem || '',
    item.destino || ''
  ].join('|').trim().toLowerCase();

const materialCadastroKey = (item: MaterialCadastro) => item.nome.trim().toLowerCase();

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

const presenceBusinessKey = (item: Pick<PresencaApontamento, 'grupoId' | 'data' | 'funcionarioId'>) => (
  `${item.grupoId}|${item.data}|${item.funcionarioId}`
);

const mergePresenceRecords = (current: PresencaApontamento[], incoming: PresencaApontamento[]) => {
  const indexed = new Map(current.map(item => [presenceBusinessKey(item), item]));
  incoming.forEach(item => indexed.set(presenceBusinessKey(item), item));
  return Array.from(indexed.values());
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
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [menuSearch, setMenuSearch] = useState<string>('');

  // Firebase Sync States
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(false);
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState<boolean>(true);
  const [lastCloudSync, setLastCloudSync] = useState<string>('');
  const [cloudRecoveryPending, setCloudRecoveryPending] = useState(false);
  const [oneDriveFuelSyncStatus, setOneDriveFuelSyncStatus] = useState<OneDriveFuelSyncStatus | null>(null);

  // Database States
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [obras, setObras] = useState<ObraLocal[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [motoristasOperacionais, setMotoristasOperacionais] = useState<Funcionario[]>([...OPERATIONAL_DRIVERS]);
  const [comboios, setComboios] = useState<Comboio[]>([]);
  const [combustiveis, setCombustiveis] = useState<TipoCombustivel[]>([]);
  const [lubrificantes, setLubrificantes] = useState<ProdutoLubrificacao[]>([]);
  const [etapas, setEtapas] = useState<EtapaServico[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [lubrificacoes, setLubrificacoes] = useState<Lubrificacao[]>([]);
  const [ticketsJazida, setTicketsJazida] = useState<TicketJazida[]>([]);
  const [externalPublicTickets, setExternalPublicTickets] = useState<TicketJazida[]>([]);
  const [listasPresenca, setListasPresenca] = useState<ListaPresenca[]>([]);
  const [ordensServico, setOrdensServico] = useState<OrdemServico[]>([]);
  const [gruposEquipe, setGruposEquipe] = useState<GrupoEquipe[]>([]);
  const [presencasLink, setPresencasLink] = useState<PresencaApontamento[]>([]);
  const [historicoPresencas, setHistoricoPresencas] = useState<HistoricoPresenca[]>([]);
  const [apontamentoRamos, setApontamentoRamos] = useState<ApontamentoRamo[]>([]);
  const [apontamentoRamoRegistros, setApontamentoRamoRegistros] = useState<ApontamentoRamoRegistro[]>([]);
  const [materiaisCadastro, setMateriaisCadastro] = useState<MaterialCadastro[]>([]);
  const [materiaisRegistros, setMateriaisRegistros] = useState<MaterialRegistro[]>([]);
  const [partesDiariasEquipamentos, setPartesDiariasEquipamentos] = useState<ParteDiariaEquipamento[]>([]);
  const [controleEquipamentosDiario, setControleEquipamentosDiario] = useState<ControleEquipamentoDiario[]>([]);
  const [controleEstacas, setControleEstacas] = useState<ControleEstacas>(INITIAL_CONTROLE_ESTACAS);
  const [periodosArquivados, setPeriodosArquivados] = useState<PeriodoArquivado[]>([]);
  const [vinculosOperadorEquipamento, setVinculosOperadorEquipamento] = useState<VinculoOperadorEquipamento[]>([]);
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);
  const [isExternalPresenceLoading, setIsExternalPresenceLoading] = useState<boolean>(Boolean(getPresenceTokenFromUrl()));
  const [externalPresenceLoadError, setExternalPresenceLoadError] = useState('');
  const [externalMeuGrupo, setExternalMeuGrupo] = useState<GrupoEquipe | null>(null);
  const [externalFuncionariosDisponiveis, setExternalFuncionariosDisponiveis] = useState<FuncionarioDisponivel[]>([]);
  const [externalMeusRegistros, setExternalMeusRegistros] = useState<PresencaApontamento[]>([]);
  const [externalDatasDisponiveis, setExternalDatasDisponiveis] = useState<string[]>([]);
  const [externalDataSelecionada, setExternalDataSelecionada] = useState('');
  const [externalDataAtual, setExternalDataAtual] = useState('');
  const [externalObservacaoDia, setExternalObservacaoDia] = useState('');
  const [isExternalApontamentoLoading, setIsExternalApontamentoLoading] = useState<boolean>(Boolean(getApontamentoTokenFromUrl()));
  const [isExternalTicketLoading, setIsExternalTicketLoading] = useState<boolean>(isTicketLinkUrl());
  const [externalTicketLoadError, setExternalTicketLoadError] = useState('');
  const [publicLinksRotationPending, setPublicLinksRotationPending] = useState(
    () => readStoredFlag(localStorage, STORAGE_KEYS.publicLinksRotationPendingV31),
  );
  const externalPresenceToken = getPresenceTokenFromUrl();
  const externalApontamentoToken = getApontamentoTokenFromUrl();
  const externalTicketAccessToken = getTicketAccessTokenFromUrl();
  const externalTicketLink = isTicketLinkUrl();

  useEffect(() => {
    if (!isLoggedIn || !currentUser || externalTicketLink || externalPresenceToken || externalApontamentoToken) return;
    const navigationItem = ALL_NAVIGATION_ITEMS.find(item => item.id === activeTab);
    if (!navigationItem) return;
    const timer = window.setTimeout(() => {
      void recordTabUsage(navigationItem.id, navigationItem.label);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [activeTab, isLoggedIn, currentUser, externalTicketLink, externalPresenceToken, externalApontamentoToken]);

  useEffect(() => {
    if (isLoggedIn && !ROLE_ACCESS[currentUserRole].includes(activeTab)) setActiveTab('dashboard');
  }, [activeTab, currentUserRole, isLoggedIn]);

  // Hydrate states from localstorage on mount
  useEffect(() => {
    let cancelled = false;
    const hydrateLocalData = async () => {
      // Links públicos usam projeções mínimas e não precisam baixar a base
      // histórica administrativa de materiais.
      if (externalTicketLink || externalPresenceToken || externalApontamentoToken) return;
      try {
        await Promise.all([
          hydrateInitialOperationalSeedData(),
          loadInitialMateriaisData(),
        ]);
        if (cancelled) return;
        // Materiais começam vazios nesta versão; a base histórica não é reidratada.
        INITIAL_MATERIAIS_CADASTRO = [];
        INITIAL_MATERIAIS_REGISTROS = [];
        if (!readStoredFlag(localStorage, STORAGE_KEYS.materiaisResetV1)) {
          localStorage.removeItem(STORAGE_KEYS.materiaisCadastro);
          localStorage.removeItem(STORAGE_KEYS.materiaisRegistros);
          writeStoredFlag(localStorage, STORAGE_KEYS.materiaisResetV1, true);
        }
      } catch (error) {
        console.error('Falha ao carregar a base historica inicial:', error);
      }

    const isDataLoadedV2 = readStoredFlag(localStorage, STORAGE_KEYS.dataLoadedV2);

    if (!isDataLoadedV2) {
      const initialStorageEntries = [
        { key: 'renea_empresas', value: JSON.stringify(INITIAL_EMPRESAS) },
        { key: 'renea_obras', value: JSON.stringify(INITIAL_OBRAS) },
        { key: 'renea_equipamentos', value: JSON.stringify(INITIAL_EQUIPAMENTOS) },
        { key: 'renea_funcionarios', value: JSON.stringify(INITIAL_FUNCIONARIOS) },
        { key: 'renea_comboios', value: JSON.stringify(INITIAL_COMBOIOS) },
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
        { key: 'renea_apontamento_ramos', value: JSON.stringify(INITIAL_APONTAMENTO_RAMOS) },
        { key: 'renea_apontamento_ramo_registros', value: JSON.stringify(INITIAL_APONTAMENTO_RAMO_REGISTROS) },
        { key: 'renea_materiais_cadastro', value: JSON.stringify(INITIAL_MATERIAIS_CADASTRO) },
        { key: 'renea_materiais_registros', value: JSON.stringify(INITIAL_MATERIAIS_REGISTROS) },
        { key: 'renea_partes_diarias_equipamentos', value: JSON.stringify(INITIAL_PARTES_DIARIAS_EQUIPAMENTOS) },
        { key: 'renea_controle_equipamentos_diario', value: JSON.stringify(INITIAL_CONTROLE_EQUIPAMENTOS_DIARIO) },
        { key: 'renea_controle_estacas', value: JSON.stringify(INITIAL_CONTROLE_ESTACAS) },
        { key: 'renea_periodos_arquivados', value: '[]' },
        { key: 'renea_master_data_review_queue', value: '[]' },
        { key: 'renea_history_logs', value: JSON.stringify([]) },
        { key: 'renea_notifications', value: '[]' },
      ].filter(entry => localStorage.getItem(entry.key) === null);
      commitStorageBatch(localStorage, [
        ...initialStorageEntries,
        { key: 'renea_data_loaded_v2', value: 'true' },
        { key: 'renea_colaboradores_planilha_v1', value: 'true' },
        { key: 'renea_planilhas_operacionais_v2', value: 'true' },
        { key: 'renea_materiais_planilha_v1', value: 'true' },
      ]);

      setEmpresas(INITIAL_EMPRESAS);
      setObras(INITIAL_OBRAS);
      setEquipamentos(INITIAL_EQUIPAMENTOS);
      setFuncionarios(INITIAL_FUNCIONARIOS);
      setMotoristasOperacionais([...OPERATIONAL_DRIVERS]);
      setComboios(INITIAL_COMBOIOS);
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
      setApontamentoRamos(INITIAL_APONTAMENTO_RAMOS);
      setApontamentoRamoRegistros(INITIAL_APONTAMENTO_RAMO_REGISTROS);
      setMateriaisCadastro(INITIAL_MATERIAIS_CADASTRO);
      setMateriaisRegistros(INITIAL_MATERIAIS_REGISTROS);
      setPartesDiariasEquipamentos(INITIAL_PARTES_DIARIAS_EQUIPAMENTOS);
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
      const savedCombustiveis = localStorage.getItem('renea_combustiveis');
      const savedLubrificantes = localStorage.getItem('renea_lubrificantes');
      const savedEtapas = localStorage.getItem('renea_etapas');
      const savedAbastecimentos = localStorage.getItem('renea_abastecimentos');
      const savedLubrificacoes = localStorage.getItem('renea_lubrificacoes');
      const savedTicketsJazida = localStorage.getItem('renea_tickets_jazida');
      const savedListasPresenca = localStorage.getItem('renea_listas_presenca');
      const savedOrdensServico = localStorage.getItem('renea_ordens_servico');
      const savedGruposEquipe = localStorage.getItem('renea_grupos_equipes');
      const savedPresencasLink = localStorage.getItem('renea_presencas_link');
      const savedHistoricoPresencas = localStorage.getItem('renea_historico_presencas');
      const savedApontamentoRamos = localStorage.getItem('renea_apontamento_ramos');
      const savedApontamentoRamoRegistros = localStorage.getItem('renea_apontamento_ramo_registros');
      const savedMateriaisCadastro = localStorage.getItem('renea_materiais_cadastro');
      const savedMateriaisRegistros = localStorage.getItem('renea_materiais_registros');
      const savedPartesDiariasEquipamentos = localStorage.getItem('renea_partes_diarias_equipamentos');
      const savedControleEquipamentosDiario = localStorage.getItem('renea_controle_equipamentos_diario');
      const savedControleEstacas = localStorage.getItem('renea_controle_estacas');
      const savedPeriodosArquivados = localStorage.getItem('renea_periodos_arquivados');
      const savedVinculosOperadorEquipamento = localStorage.getItem('renea_vinculos_operador_equipamento');
      const savedHistory = localStorage.getItem('renea_history_logs');
      const savedNotifications = localStorage.getItem('renea_notifications');
      const shouldMigratePresencePeople = !readStoredFlag(localStorage, STORAGE_KEYS.colaboradoresPlanilhaV1);
      const shouldMigrateSpreadsheetSeed = !readStoredFlag(localStorage, STORAGE_KEYS.planilhasOperacionaisV2);
      const materiaisReset = readStoredFlag(localStorage, STORAGE_KEYS.materiaisResetV1);
      const shouldMigrateMateriaisSeed = !materiaisReset && !readStoredFlag(localStorage, STORAGE_KEYS.materiaisPlanilhaV1);
      const parsedEquipamentos = parseStoredJson(savedEquipamentos, 'renea_equipamentos', INITIAL_EQUIPAMENTOS);
      const parsedEmpresas = parseStoredJson(savedEmpresas, 'renea_empresas', INITIAL_EMPRESAS);
      const parsedComboios = parseStoredJson(savedComboios, 'renea_comboios', INITIAL_COMBOIOS);
      const parsedAbastecimentos = parseStoredJson(savedAbastecimentos, 'renea_abastecimentos', INITIAL_ABASTECIMENTOS);
      const parsedTicketsJazida = parseStoredJson(savedTicketsJazida, 'renea_tickets_jazida', INITIAL_TICKETS_JAZIDA);
      const parsedControleEstacas = normalizeStakeControl(
        parseStoredJson(savedControleEstacas, 'renea_controle_estacas', INITIAL_CONTROLE_ESTACAS),
      );
      const parsedMateriaisCadastro = materiaisReset ? [] : parseStoredJson(savedMateriaisCadastro, 'renea_materiais_cadastro', INITIAL_MATERIAIS_CADASTRO);
      const parsedMateriaisRegistros = materiaisReset ? [] : parseStoredJson(savedMateriaisRegistros, 'renea_materiais_registros', INITIAL_MATERIAIS_REGISTROS);
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
      const parsedApontamentoRamos = parseStoredJson(savedApontamentoRamos, 'renea_apontamento_ramos', INITIAL_APONTAMENTO_RAMOS);
      const mergedApontamentoRamos = mergeSeedRecords(
        parsedApontamentoRamos,
        INITIAL_APONTAMENTO_RAMOS,
        ramo => `${ramo.canteiroNome.trim().toLowerCase()}|${ramo.ramoNome.trim().toLowerCase()}`,
      );
      const securedPublicLinks = rotateWeakPublicLinkTokens(parsedGruposEquipe, mergedApontamentoRamos);
      const loadedEquipamentos = shouldMigrateSpreadsheetSeed
        ? mergeSeedRecordsPreferSeed(parsedEquipamentos, INITIAL_EQUIPAMENTOS, item => item.prefixo.trim().toLowerCase())
        : parsedEquipamentos;
      const loadedEmpresas = shouldMigrateSpreadsheetSeed
        ? mergeSeedRecords(parsedEmpresas, INITIAL_EMPRESAS, item => item.id)
        : parsedEmpresas;
      const loadedComboios = shouldMigrateSpreadsheetSeed
        ? mergeSeedRecords(parsedComboios, INITIAL_COMBOIOS, item => item.placa.trim().toLowerCase())
        : parsedComboios;
      const loadedAbastecimentos = shouldMigrateSpreadsheetSeed
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
      const loadedMateriaisCadastro = shouldMigrateMateriaisSeed
        ? mergeSeedRecords(parsedMateriaisCadastro, INITIAL_MATERIAIS_CADASTRO, materialCadastroKey)
        : parsedMateriaisCadastro;
      const loadedMateriaisRegistros = shouldMigrateMateriaisSeed
        ? mergeSeedRecords(parsedMateriaisRegistros, INITIAL_MATERIAIS_REGISTROS, materialRegistroKey)
        : parsedMateriaisRegistros;

      setEmpresas(loadedEmpresas);
      setObras(parseStoredJson(savedObras, 'renea_obras', INITIAL_OBRAS));
      setEquipamentos(loadedEquipamentos);
      setFuncionarios(shouldMigratePresencePeople ? INITIAL_FUNCIONARIOS : parseStoredJson(savedFuncionarios, 'renea_funcionarios', INITIAL_FUNCIONARIOS));
      setMotoristasOperacionais(parseStoredJson(savedMotoristasOperacionais, STORAGE_KEYS.motoristasOperacionais, [...OPERATIONAL_DRIVERS]));
      setComboios(loadedComboios);
      setCombustiveis(parseStoredJson(savedCombustiveis, 'renea_combustiveis', INITIAL_TIPOS_COMBUSTIVEL));
      setLubrificantes(parseStoredJson(savedLubrificantes, 'renea_lubrificantes', INITIAL_PRODUTOS_LUBRIFICACAO));
      setEtapas(parseStoredJson(savedEtapas, 'renea_etapas', INITIAL_ETAPAS_SERVICO));
      setAbastecimentos(loadedAbastecimentos);
      setLubrificacoes(parseStoredJson(savedLubrificacoes, 'renea_lubrificacoes', INITIAL_LUBRIFICACOES));
      setTicketsJazida(loadedTicketsJazida);
      setListasPresenca(parsedListasPresenca);
      setOrdensServico(parseStoredJson(savedOrdensServico, 'renea_ordens_servico', INITIAL_ORDENS_SERVICO));
      setGruposEquipe(securedPublicLinks.gruposEquipe);
      setPresencasLink(parseStoredJson(savedPresencasLink, 'renea_presencas_link', INITIAL_PRESENCAS_LINK));
      setHistoricoPresencas(parseStoredJson(savedHistoricoPresencas, 'renea_historico_presencas', INITIAL_HISTORICO_PRESENCAS));
      setApontamentoRamos(securedPublicLinks.apontamentoRamos);
      setApontamentoRamoRegistros(parseStoredJson(savedApontamentoRamoRegistros, 'renea_apontamento_ramo_registros', INITIAL_APONTAMENTO_RAMO_REGISTROS));
      setMateriaisCadastro(loadedMateriaisCadastro);
      setMateriaisRegistros(loadedMateriaisRegistros);
      setPartesDiariasEquipamentos(parseStoredJson(savedPartesDiariasEquipamentos, 'renea_partes_diarias_equipamentos', INITIAL_PARTES_DIARIAS_EQUIPAMENTOS));
      setControleEquipamentosDiario(parseStoredJson(savedControleEquipamentosDiario, 'renea_controle_equipamentos_diario', INITIAL_CONTROLE_EQUIPAMENTOS_DIARIO));
      setControleEstacas(loadedControleEstacas);
      setPeriodosArquivados(parseStoredJson(savedPeriodosArquivados, 'renea_periodos_arquivados', [] as PeriodoArquivado[]));
      setVinculosOperadorEquipamento(parseStoredJson(savedVinculosOperadorEquipamento, 'renea_vinculos_operador_equipamento', [] as VinculoOperadorEquipamento[]));
      setHistoryLogs(parseStoredJson(savedHistory, 'renea_history_logs', [] as HistoryLog[]));
      setNotifications(parseStoredJson(savedNotifications, 'renea_notifications', getInitialNotifications()));

      if (shouldMigratePresencePeople) {
        writeStorageValue(localStorage, 'renea_funcionarios', JSON.stringify(INITIAL_FUNCIONARIOS));
        writeStorageValue(localStorage, 'renea_listas_presenca', JSON.stringify(INITIAL_PRESENCAS));
        writeStorageValue(localStorage, 'renea_grupos_equipes', JSON.stringify(securedPublicLinks.gruposEquipe));
        writeStorageValue(localStorage, 'renea_presencas_link', JSON.stringify(INITIAL_PRESENCAS_LINK));
        writeStorageValue(localStorage, 'renea_historico_presencas', JSON.stringify(INITIAL_HISTORICO_PRESENCAS));
        writeStorageValue(localStorage, 'renea_colaboradores_planilha_v1', 'true');
      }
      if (!savedApontamentoRamos || securedPublicLinks.changed || mergedApontamentoRamos.length !== parsedApontamentoRamos.length) {
        writeStorageValue(localStorage, 'renea_apontamento_ramos', JSON.stringify(securedPublicLinks.apontamentoRamos));
      }
      if (securedPublicLinks.changed) {
        writeStorageValue(localStorage, 'renea_grupos_equipes', JSON.stringify(securedPublicLinks.gruposEquipe));
        writeStoredFlag(localStorage, STORAGE_KEYS.publicLinksRotationPendingV31, true);
        setPublicLinksRotationPending(true);
      }
      if (!savedApontamentoRamoRegistros) {
        writeStorageValue(localStorage, 'renea_apontamento_ramo_registros', JSON.stringify(INITIAL_APONTAMENTO_RAMO_REGISTROS));
      }
      if (!savedPartesDiariasEquipamentos) {
        writeStorageValue(localStorage, 'renea_partes_diarias_equipamentos', JSON.stringify(INITIAL_PARTES_DIARIAS_EQUIPAMENTOS));
      }
      if (!savedControleEstacas) {
        writeStorageValue(localStorage, 'renea_controle_estacas', JSON.stringify(INITIAL_CONTROLE_ESTACAS));
      }
      if (!savedPeriodosArquivados) {
        writeStorageValue(localStorage, 'renea_periodos_arquivados', JSON.stringify([]));
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
      if (shouldMigrateMateriaisSeed) {
        writeStorageValue(localStorage, 'renea_materiais_cadastro', JSON.stringify(loadedMateriaisCadastro));
        writeStorageValue(localStorage, 'renea_materiais_registros', JSON.stringify(loadedMateriaisRegistros));
        writeStorageValue(localStorage, 'renea_materiais_planilha_v1', 'true');
      }
    }
    };
    void hydrateLocalData();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => onAuthStateChanged(auth, async user => {
    if (!user) {
      setCurrentUser(null);
      setIsLoggedIn(false);
      setIsAuthenticating(false);
      return;
    }
    try {
      const token = await user.getIdTokenResult(true);
      if (token.claims.staff !== true) {
        await signOutCurrentUser(auth);
        setCurrentUser(null);
        setIsLoggedIn(false);
        setLoginError('Sua conta existe, mas ainda não foi autorizada para acessar o sistema.');
        return;
      }
      setCurrentUserRole(normalizeUserRole(token.claims.role));
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

    if (!isLoggedIn || externalTicketLink || externalPresenceToken || externalApontamentoToken) {
      setIsFirebaseConnected(false);
      return;
    }

    const checkConnection = async () => {
      try {
        const status = await getFirebaseConnectionStatus(db);
        setIsFirebaseConnected(status.connected);

        if (status.updatedAt) {
          const cloudDate = new Date(status.updatedAt);
          if (!Number.isNaN(cloudDate.getTime())) {
            const cloudDateLabel = cloudDate.toLocaleString('pt-BR');
            setLastCloudSync(cloudDateLabel);
            writeStorageValue(localStorage, 'renea_last_cloud_sync', cloudDateLabel);
          }

          // Primeira execucao da versao nova: registra a nuvem atual como base sem
          // sobrescrever silenciosamente os dados locais que ainda nao foram enviados.
          if (!localStorage.getItem('renea_last_cloud_sync_iso')) {
            writeStorageValue(localStorage, 'renea_last_cloud_sync_iso', status.updatedAt);
          }
        }
      } catch (error) {
        console.warn('Falha ao validar a conexao real com o Firestore:', error);
        setIsFirebaseConnected(false);
      }
    };
    void checkConnection();
  }, [isLoggedIn, externalTicketLink, externalPresenceToken, externalApontamentoToken]);

  // Firebase Upload Cloud Sync
  const handleUploadToFirebase = async (
    customEmpresas = empresas,
    customObras = obras,
    customEquipamentos = equipamentos,
    customFuncionarios = funcionarios,
    customComboios = comboios,
    customCombustiveis = combustiveis,
    customLubrificantes = lubrificantes,
    customEtapas = etapas,
    customAbastecimentos = abastecimentos,
    customLubrificacoes = lubrificacoes,
    customTicketsJazida = ticketsJazida,
    customHistory = historyLogs,
    customListasPresenca = listasPresenca,
    customOrdensServico = ordensServico,
    customGruposEquipe = gruposEquipe,
    customPresencasLink = presencasLink,
    customHistoricoPresencas = historicoPresencas,
    customNotifications = notifications,
    customApontamentoRamos = apontamentoRamos,
    customApontamentoRamoRegistros = apontamentoRamoRegistros,
    customMateriaisCadastro = materiaisCadastro,
    customMateriaisRegistros = materiaisRegistros,
    customPartesDiariasEquipamentos = partesDiariasEquipamentos,
    customPeriodosArquivados = periodosArquivados,
    customControleEstacas = controleEstacas
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const data = {
        empresas: customEmpresas,
        obras: customObras,
        equipamentos: customEquipamentos,
        funcionarios: customFuncionarios,
        motoristasOperacionais: parseStoredJson<Funcionario[]>(localStorage.getItem(STORAGE_KEYS.motoristasOperacionais), STORAGE_KEYS.motoristasOperacionais, motoristasOperacionais),
        comboios: customComboios,
        combustiveis: customCombustiveis,
        lubrificantes: customLubrificantes,
        etapas: customEtapas,
        abastecimentos: customAbastecimentos,
        lubrificacoes: customLubrificacoes,
        ticketsJazida: customTicketsJazida,
        listasPresenca: customListasPresenca,
        ordensServico: customOrdensServico,
        gruposEquipe: customGruposEquipe,
        presencasLink: customPresencasLink,
        historicoPresencas: customHistoricoPresencas,
        apontamentoRamos: customApontamentoRamos,
        apontamentoRamoRegistros: customApontamentoRamoRegistros,
        materiaisCadastro: customMateriaisCadastro,
        materiaisRegistros: customMateriaisRegistros,
        partesDiariasEquipamentos: customPartesDiariasEquipamentos,
        controleEquipamentosDiario: parseStoredJson<ControleEquipamentoDiario[]>(localStorage.getItem('renea_controle_equipamentos_diario'), 'renea_controle_equipamentos_diario', INITIAL_CONTROLE_EQUIPAMENTOS_DIARIO),
        periodosArquivados: customPeriodosArquivados,
        vinculosOperadorEquipamento: parseStoredJson<VinculoOperadorEquipamento[]>(localStorage.getItem('renea_vinculos_operador_equipamento'), 'renea_vinculos_operador_equipamento', []),
        masterDataReviewQueue: parseStoredJson<MasterWorkbookReviewRow[]>(
          localStorage.getItem('renea_master_data_review_queue'),
          'renea_master_data_review_queue',
          [],
        ),
        estacaLotes: customControleEstacas.lotes,
        estacaCravacoes: customControleEstacas.cravacoes,
        notifications: customNotifications,
        historyLogs: customHistory,
      };
      const uploadResult = await uploadFirebaseBackup(db, data);
      
      const nowStr = new Date(uploadResult.updatedAt).toLocaleString('pt-BR');
      setLastCloudSync(nowStr);
      try {
        commitStorageBatch(localStorage, [
          { key: 'renea_last_cloud_sync', value: nowStr },
          { key: 'renea_last_cloud_sync_iso', value: uploadResult.updatedAt },
        ]);
      } catch (storageError) {
        // O envio remoto já foi confirmado. Uma falha apenas no indicador local
        // não pode ser reportada como se o backup na nuvem tivesse falhado.
        console.warn('O Firebase foi atualizado, mas o horário local não pôde ser salvo:', storageError);
      }
      setIsFirebaseConnected(true);
      return {
        success: true,
        message: `${uploadResult.totalRecords.toLocaleString('pt-BR')} registros atualizados com segurança.`,
      };
    } catch (error: unknown) {
      setIsFirebaseConnected(false);
      console.error('Falha ao sincronizar o backup no Firebase:', error);
      if (!navigator.onLine) {
        void enqueueOfflineCommand('firebase-backup', { requestedAt: new Date().toISOString() });
      }
      return { success: false, message: formatFirebaseSyncError(error) };
    }
  };

  // Firebase Download Cloud Sync
  const handleDownloadFromFirebase = async (): Promise<{ success: boolean; data?: string; message: string }> => {
    try {
      const backup = await downloadFirebaseBackup(db);
      if (backup.data) {
        const downloadedData = backup.data;
        const validation = validateSystemBackup(downloadedData, false);
        if (!validation.valid) throw new Error(describeInvalidBackup(validation));
        const securedPublicLinks = rotateWeakPublicLinkTokens(
          Array.isArray(downloadedData.gruposEquipe) ? downloadedData.gruposEquipe : [],
          Array.isArray(downloadedData.apontamentoRamos) ? downloadedData.apontamentoRamos : [],
        );
        const data: FirebaseCloudData = {
          ...downloadedData,
          gruposEquipe: securedPublicLinks.gruposEquipe,
          apontamentoRamos: securedPublicLinks.apontamentoRamos,
        };
        if (securedPublicLinks.changed) {
          writeStoredFlag(localStorage, STORAGE_KEYS.publicLinksRotationPendingV31, true);
          setPublicLinksRotationPending(true);
        }
        const syncIso = backup.updatedAt || new Date().toISOString();
        const syncDate = new Date(syncIso);
        const nowStr = Number.isNaN(syncDate.getTime())
          ? new Date().toLocaleString('pt-BR')
          : syncDate.toLocaleString('pt-BR');
        
        // Grava primeiro como um único conjunto recuperável. Se o navegador
        // estiver sem espaço, nenhuma tabela é deixada pela metade.
        const cloudStorageKeys: Array<[string, string]> = [
          ['empresas', 'renea_empresas'],
          ['obras', 'renea_obras'],
          ['equipamentos', 'renea_equipamentos'],
          ['funcionarios', 'renea_funcionarios'],
          ['motoristasOperacionais', STORAGE_KEYS.motoristasOperacionais],
          ['comboios', 'renea_comboios'],
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
          ['apontamentoRamos', 'renea_apontamento_ramos'],
          ['apontamentoRamoRegistros', 'renea_apontamento_ramo_registros'],
          ['materiaisCadastro', 'renea_materiais_cadastro'],
          ['materiaisRegistros', 'renea_materiais_registros'],
          ['partesDiariasEquipamentos', 'renea_partes_diarias_equipamentos'],
          ['controleEquipamentosDiario', 'renea_controle_equipamentos_diario'],
          ['periodosArquivados', 'renea_periodos_arquivados'],
          ['masterDataReviewQueue', 'renea_master_data_review_queue'],
          ['notifications', 'renea_notifications'],
          ['historyLogs', 'renea_history_logs'],
        ];
        try {
          commitStorageBatch(localStorage, [
            ...cloudStorageKeys.flatMap(([dataKey, storageKey]) => (
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
          ]);
        } catch (error) {
          if (!isStorageQuotaExceededError(error)) throw error;
          console.warn('A cache local está cheia. Os dados remotos continuarão disponíveis nesta sessão.');
        }

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
        if (Object.hasOwn(data, 'gruposEquipe')) {
          setGruposEquipe(normalizeTeamGroups(data.gruposEquipe));
        }
        if (Object.hasOwn(data, 'presencasLink')) {
          setPresencasLink(normalizeRuntimeCollection<PresencaApontamento>(data.presencasLink));
        }
        if (Object.hasOwn(data, 'historicoPresencas')) {
          setHistoricoPresencas(normalizeRuntimeCollection<HistoricoPresenca>(data.historicoPresencas));
        }
        if (Object.hasOwn(data, 'apontamentoRamos')) {
          setApontamentoRamos(normalizeRuntimeCollection<ApontamentoRamo>(data.apontamentoRamos));
        }
        if (Object.hasOwn(data, 'apontamentoRamoRegistros')) {
          setApontamentoRamoRegistros(normalizeRuntimeCollection<ApontamentoRamoRegistro>(data.apontamentoRamoRegistros));
        }
        if (Object.hasOwn(data, 'materiaisCadastro') && !readStoredFlag(localStorage, STORAGE_KEYS.materiaisResetV1)) {
          setMateriaisCadastro(normalizeRuntimeCollection<MaterialCadastro>(data.materiaisCadastro));
        }
        if (Object.hasOwn(data, 'materiaisRegistros') && !readStoredFlag(localStorage, STORAGE_KEYS.materiaisResetV1)) {
          setMateriaisRegistros(normalizeRuntimeCollection<MaterialRegistro>(data.materiaisRegistros));
        }
        if (Object.hasOwn(data, 'partesDiariasEquipamentos')) {
          setPartesDiariasEquipamentos(normalizeRuntimeCollection<ParteDiariaEquipamento>(data.partesDiariasEquipamentos));
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
      if (Array.isArray(data.vinculosOperadorEquipamento)) {
        setVinculosOperadorEquipamento(data.vinculosOperadorEquipamento);
        writeStorageValue(localStorage, 'renea_vinculos_operador_equipamento', JSON.stringify(data.vinculosOperadorEquipamento));
      }
        
        setLastCloudSync(nowStr);
        setIsFirebaseConnected(true);
        return {
          success: true,
          message: `Dados atualizados com sucesso (${backup.totalRecords.toLocaleString('pt-BR')} registros).`,
        };
      } else {
        return { success: false, message: 'Nenhuma cópia de dados foi encontrada.' };
      }
    } catch (error: unknown) {
      setIsFirebaseConnected(false);
      console.error('Falha ao restaurar o backup do Firebase:', error);
      return { success: false, message: formatFirebaseSyncError(error) };
    }
  };

  // Com a sincronizacao automatica ativa, verifica periodicamente se outro
  // dispositivo publicou uma versao mais recente e atualiza este navegador.
  useEffect(() => {
    if (!isAutoSyncEnabled || externalPresenceToken || externalApontamentoToken || externalTicketLink) return;

    let cancelled = false;
    let isChecking = false;

    const pullRemoteChanges = async () => {
      if (cancelled || isChecking) return;
      isChecking = true;
      try {
        const status = await getFirebaseConnectionStatus(db);
        if (cancelled) return;
        setIsFirebaseConnected(status.connected);

        if (!status.updatedAt) return;
        const localCloudVersion = localStorage.getItem('renea_last_cloud_sync_iso');
        if (!localCloudVersion) {
          writeStorageValue(localStorage, 'renea_last_cloud_sync_iso', status.updatedAt);
          return;
        }

        if (localCloudVersion !== status.updatedAt) {
          await handleDownloadFromFirebase();
        }
      } catch (error) {
        if (!cancelled) {
          setIsFirebaseConnected(false);
          setCloudRecoveryPending(true);
          console.warn('Verificacao automatica do Firebase falhou:', error);
        }
      } finally {
        isChecking = false;
      }
    };

    const initialCheck = window.setTimeout(pullRemoteChanges, 3_000);
    // O manifesto dispara a atualização imediatamente quando outro cliente
    // publica uma nova geração. O intervalo permanece apenas como fallback
    // para reconectar quando o listener fica offline.
    const unsubscribeManifest = onSnapshot(doc(db, 'sistemarenea_cloud', 'main_data_v2'), snapshot => {
      const updatedAt = String(snapshot.data()?.updatedAt || '');
      const localCloudVersion = localStorage.getItem('renea_last_cloud_sync_iso');
      if (updatedAt && localCloudVersion && updatedAt !== localCloudVersion) void handleDownloadFromFirebase();
    }, error => {
      console.warn('Listener realtime do manifesto indisponível; usando fallback:', error);
    });
    const interval = window.setInterval(pullRemoteChanges, 60_000);
    return () => {
      cancelled = true;
      window.clearTimeout(initialCheck);
      window.clearInterval(interval);
      unsubscribeManifest();
    };
  }, [isAutoSyncEnabled, externalPresenceToken, externalApontamentoToken, externalTicketLink]);

  // Se a nuvem estiver com um manifesto antigo/inconsistente, regrava o
  // retrato local já carregado uma única vez. Isso recupera os links sem
  // apagar dados locais nem entrar em loop de tentativas.
  useEffect(() => {
    if (!cloudRecoveryPending || !isLoggedIn || externalPresenceToken || externalApontamentoToken || externalTicketLink) return;
    setCloudRecoveryPending(false);
    void uploadLocalSnapshotToFirebase().then(result => {
      if (!result.success) console.warn('Recuperação do retrato remoto pendente:', result.message);
    });
  }, [cloudRecoveryPending, externalApontamentoToken, externalPresenceToken, externalTicketLink, isLoggedIn]);

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
    if (!externalApontamentoToken) return;
    setIsExternalApontamentoLoading(true);
    loadPublicApontamentoConfig(externalApontamentoToken)
      .then(config => setApontamentoRamos(config.ramos))
      .catch(error => console.error('Falha ao carregar link público de apontamento:', error))
      .finally(() => setIsExternalApontamentoLoading(false));
  }, [externalApontamentoToken]);

  const refreshPublicTickets = async () => {
    const publicTickets = await loadPublicTickets(db);
    if (publicTickets.length === 0) return;
    setTicketsJazida(current => {
      const merged = mergeTicketCollections(current, publicTickets);
      writeStorageValue(localStorage, 'renea_tickets_jazida', JSON.stringify(merged));
      return merged;
    });
  };

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

  useEffect(() => {
    if (!isLoggedIn || externalTicketLink) return;
    refreshPublicTickets().catch(error => console.warn('Falha ao atualizar tickets públicos:', error));
    const interval = window.setInterval(() => {
      refreshPublicTickets().catch(error => console.warn('Falha ao atualizar tickets públicos:', error));
    }, 30_000);
    return () => window.clearInterval(interval);
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

    // Notificação real (não simulada) refletindo a ação que de fato aconteceu
    addNotification(
      `${tableName} — ${action}`,
      description,
      action === 'Excluiu' ? 'warning' : 'success',
      'Sistema Local'
    );

    // A sincronização é obrigatória e silenciosa para manter todos os usuários alinhados.
    setTimeout(() => {
        const getLS = (key: string, def: any) => {
          const val = localStorage.getItem(key);
          return parseStoredJson(val, key, def);
        };
        handleUploadToFirebase(
          getLS('renea_empresas', INITIAL_EMPRESAS),
          getLS('renea_obras', INITIAL_OBRAS),
          getLS('renea_equipamentos', INITIAL_EQUIPAMENTOS),
          getLS('renea_funcionarios', INITIAL_FUNCIONARIOS),
          getLS('renea_comboios', INITIAL_COMBOIOS),
          getLS('renea_combustiveis', INITIAL_TIPOS_COMBUSTIVEL),
          getLS('renea_lubrificantes', INITIAL_PRODUTOS_LUBRIFICACAO),
          getLS('renea_etapas', INITIAL_ETAPAS_SERVICO),
          getLS('renea_abastecimentos', INITIAL_ABASTECIMENTOS),
          getLS('renea_lubrificacoes', INITIAL_LUBRIFICACOES),
          getLS('renea_tickets_jazida', []),
          getLS('renea_history_logs', []),
          getLS('renea_listas_presenca', INITIAL_PRESENCAS),
          getLS('renea_ordens_servico', INITIAL_ORDENS_SERVICO),
          getLS('renea_grupos_equipes', INITIAL_GRUPOS_EQUIPES),
          getLS('renea_presencas_link', INITIAL_PRESENCAS_LINK),
          getLS('renea_historico_presencas', INITIAL_HISTORICO_PRESENCAS),
          getLS('renea_notifications', getInitialNotifications()),
          getLS('renea_apontamento_ramos', INITIAL_APONTAMENTO_RAMOS),
          getLS('renea_apontamento_ramo_registros', INITIAL_APONTAMENTO_RAMO_REGISTROS),
          getLS('renea_materiais_cadastro', INITIAL_MATERIAIS_CADASTRO),
          getLS('renea_materiais_registros', INITIAL_MATERIAIS_REGISTROS),
          getLS('renea_partes_diarias_equipamentos', INITIAL_PARTES_DIARIAS_EQUIPAMENTOS),
          getLS('renea_periodos_arquivados', []),
          getLS('renea_controle_estacas', INITIAL_CONTROLE_ESTACAS)
        ).then(res => {
          if (!res.success) console.warn('Sincronização automática pendente:', res.message);
        });
    }, 100);
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
  const handleSaveEmpresa = (item: Empresa, isNew: boolean) => {
    const now = new Date().toISOString();
    const previous = empresas.find(x => x.id === item.id);
    const normalizedItem: Empresa = {
      ...item,
      tipos: item.tipos?.length ? item.tipos : previous?.tipos || ['EMPRESA'],
      status: item.status || previous?.status || 'ATIVO',
      criadoEm: previous?.criadoEm || item.criadoEm || now,
      atualizadoEm: now,
    };
    const errors = validateCentralRecord({ empresas, equipamentos, funcionarios, obras, record: normalizedItem });
    if (errors.length > 0) {
      window.alert(errors.join('\n'));
      return;
    }
    let updated;
    if (isNew) {
      updated = [...empresas, normalizedItem];
    } else {
      updated = empresas.map(x => x.id === item.id ? normalizedItem : x);
    }
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
    );
  };

  const handleDeleteEmpresa = (id: string) => {
    const item = empresas.find(x => x.id === id);
    if (!item) return;
    const inactive: Empresa = { ...item, status: 'INATIVO', atualizadoEm: new Date().toISOString() };
    const updated = empresas.map(x => x.id === id ? inactive : x);
    saveAndLog(
      'Empresas', 
      'Inativou',
      `Inativou a empresa/fornecedor "${item.nome}" preservando o histórico.`,
      historyLogs,
      () => {
        setEmpresas(updated);
        writeStorageValue(localStorage, 'renea_empresas', JSON.stringify(updated));
      },
      { registroId: id, valorAnterior: item, valorNovo: inactive, tipoOperacao: 'INACTIVATE' },
    );
  };

  const handleSaveObra = (item: ObraLocal, isNew: boolean) => {
    const previous = obras.find(x => x.id === item.id);
    const errors = validateCentralRecord({ empresas, equipamentos, funcionarios, obras, record: item });
    if (errors.length > 0) {
      window.alert(errors.join('\n'));
      return;
    }
    let updated;
    if (isNew) {
      updated = [...obras, item];
    } else {
      updated = obras.map(x => x.id === item.id ? item : x);
    }
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

  const handleDeleteObra = (id: string) => {
    const item = obras.find(x => x.id === id);
    if (!item) return;
    const inactive: ObraLocal = { ...item, status: 'Concluída' };
    const updated = obras.map(x => x.id === id ? inactive : x);
    saveAndLog(
      'Obras/Locais', 
      'Inativou',
      `Inativou a obra/local "${item.nome}" preservando vínculos existentes.`,
      historyLogs,
      () => {
        setObras(updated);
        writeStorageValue(localStorage, 'renea_obras', JSON.stringify(updated));
      },
      { registroId: id, valorAnterior: item, valorNovo: inactive, tipoOperacao: 'INACTIVATE' },
    );
  };

  const handleSaveEquipamento = (item: Equipamento, isNew: boolean) => {
    const previous = equipamentos.find(x => x.id === item.id);
    const errors = validateCentralRecord({ empresas, equipamentos, funcionarios, obras, record: item });
    if (errors.length > 0) {
      window.alert(errors.join('\n'));
      return;
    }
    let updated;
    if (isNew) {
      updated = [...equipamentos, item];
    } else {
      updated = equipamentos.map(x => x.id === item.id ? item : x);
    }
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

  const handleVincularOperadorEquipamento = (funcionarioId: string, equipamentoId: string, observacao = '') => {
    const funcionario = funcionarios.find(item => item.id === funcionarioId);
    const equipamento = equipamentos.find(item => item.id === equipamentoId);
    if (!funcionario || !equipamento) return;
    const now = new Date().toISOString();
    const closedLinks = vinculosOperadorEquipamento.map(link =>
      link.status === 'ATIVO' && (link.funcionarioId === funcionarioId || link.equipamentoId === equipamentoId)
        ? { ...link, status: 'ENCERRADO' as const, fimEm: now, atualizadoEm: now }
        : link,
    );
    const link: VinculoOperadorEquipamento = {
      id: `vinculo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      funcionarioId,
      funcionarioNome: funcionario.nome,
      equipamentoId,
      equipamentoPrefixo: equipamento.prefixo,
      inicioEm: now,
      status: 'ATIVO',
      responsavelAlteracao: activeUserName,
      observacao,
      criadoEm: now,
      atualizadoEm: now,
    };
    const nextLinks = [link, ...closedLinks];
    const nextEquipment = equipamentos.map(item => {
      if (item.id === equipamentoId) return { ...item, operadorResponsavelId: funcionarioId, operadorResponsavelNome: funcionario.nome };
      if (item.operadorResponsavelId === funcionarioId) return { ...item, operadorResponsavelId: undefined, operadorResponsavelNome: undefined };
      return item;
    });
    setVinculosOperadorEquipamento(nextLinks);
    setEquipamentos(nextEquipment);
    writeStorageValue(localStorage, 'renea_vinculos_operador_equipamento', JSON.stringify(nextLinks));
    writeStorageValue(localStorage, 'renea_equipamentos', JSON.stringify(nextEquipment));
    addNotification('Vínculo operacional atualizado', `${funcionario.nome} vinculado ao equipamento ${equipamento.prefixo}.`, 'success', 'Sistema Local');
  };

  const handleEncerrarVinculoOperadorEquipamento = (vinculoId: string) => {
    const current = vinculosOperadorEquipamento.find(link => link.id === vinculoId && link.status === 'ATIVO');
    if (!current) return;
    const now = new Date().toISOString();
    const nextLinks = vinculosOperadorEquipamento.map(link => link.id === vinculoId ? { ...link, status: 'ENCERRADO' as const, fimEm: now, atualizadoEm: now } : link);
    const nextEquipment = equipamentos.map(item => item.id === current.equipamentoId ? { ...item, operadorResponsavelId: undefined, operadorResponsavelNome: undefined } : item);
    setVinculosOperadorEquipamento(nextLinks);
    setEquipamentos(nextEquipment);
    writeStorageValue(localStorage, 'renea_vinculos_operador_equipamento', JSON.stringify(nextLinks));
    writeStorageValue(localStorage, 'renea_equipamentos', JSON.stringify(nextEquipment));
  };

  const handleDeleteEquipamento = (id: string) => {
    const item = equipamentos.find(x => x.id === id);
    if (!item) return;
    const inactive: Equipamento = { ...item, status: 'Desmobilizado', mobilizado: false, dataDesmobilizacao: new Date().toISOString().slice(0, 10) };
    const updated = equipamentos.map(x => x.id === id ? inactive : x);
    saveAndLog(
      'Equipamentos', 
      'Desmobilizou',
      `Desmobilizou o equipamento/veículo "${item.prefixo} - ${item.nome}" preservando lançamentos vinculados.`,
      historyLogs,
      () => {
        setEquipamentos(updated);
        writeStorageValue(localStorage, 'renea_equipamentos', JSON.stringify(updated));
      },
      { registroId: id, valorAnterior: item, valorNovo: inactive, tipoOperacao: 'DEMOBILIZE' },
    );
  };

  const handleSaveFuncionario = (item: Funcionario, isNew: boolean) => {
    const now = new Date().toISOString();
    const previous = funcionarios.find(x => x.id === item.id);
    const normalizedItem: Funcionario = {
      ...item,
      ativo: !['INATIVO', 'DESMOBILIZADO'].includes(item.status || (item.ativo ? 'ATIVO' : 'INATIVO')),
      status: item.status || (item.ativo ? 'ATIVO' : 'INATIVO'),
      criadoEm: previous?.criadoEm || item.criadoEm || now,
      atualizadoEm: now,
    };
    const errors = validateCentralRecord({ empresas, equipamentos, funcionarios, obras, record: normalizedItem });
    if (errors.length > 0) {
      window.alert(errors.join('\n'));
      return;
    }
    let updated;
    if (isNew) {
      updated = [...funcionarios, normalizedItem];
    } else {
      updated = funcionarios.map(x => x.id === item.id ? normalizedItem : x);
    }
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
      window.alert(duplicate ? 'Já existe motorista operacional com esta matrícula.' : 'Informe matrícula e nome.');
      return;
    }
    const next = isNew ? [...motoristasOperacionais, item] : motoristasOperacionais.map(driver => driver.id === item.id ? item : driver);
    saveAndLog('Motoristas operacionais', isNew ? 'Criou' : 'Editou', `${isNew ? 'Cadastrou' : 'Editou'} o motorista "${item.nome}" (${matricula}).`, historyLogs, () => {
      setMotoristasOperacionais(next);
      writeStorageValue(localStorage, STORAGE_KEYS.motoristasOperacionais, JSON.stringify(next));
      if (isAutoSyncEnabled) void handleUploadToFirebase();
    }, { registroId: item.id, valorNovo: item, tipoOperacao: isNew ? 'CREATE' : 'UPDATE' });
  };

  const handleDeleteOperationalDriver = (id: string) => {
    const next = motoristasOperacionais.filter(driver => driver.id !== id);
    saveAndLog('Motoristas operacionais', 'Excluiu', `Excluiu o motorista operacional "${id}".`, historyLogs, () => {
      setMotoristasOperacionais(next);
      writeStorageValue(localStorage, STORAGE_KEYS.motoristasOperacionais, JSON.stringify(next));
      if (isAutoSyncEnabled) void handleUploadToFirebase();
    }, { registroId: id, tipoOperacao: 'DELETE' });
  };

  const handleDeleteFuncionario = (id: string) => {
    const item = funcionarios.find(x => x.id === id);
    if (!item) return;
    const inactive: Funcionario = { ...item, ativo: false, status: 'INATIVO', atualizadoEm: new Date().toISOString() };
    const updated = funcionarios.map(x => x.id === id ? inactive : x);
    saveAndLog(
      'Funcionários', 
      'Inativou',
      `Inativou o colaborador "${item.nome}" preservando efetivo, viagens e histórico.`,
      historyLogs,
      () => {
        setFuncionarios(updated);
        writeStorageValue(localStorage, 'renea_funcionarios', JSON.stringify(updated));
      },
      { registroId: id, valorAnterior: item, valorNovo: inactive, tipoOperacao: 'INACTIVATE' },
    );
  };

  const handleSaveComboio = (item: Comboio, isNew: boolean) => {
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

  const handleDeleteComboio = (id: string) => {
    const item = comboios.find(x => x.id === id);
    if (!item) return;
    const updated = comboios.filter(x => x.id !== id);
    saveAndLog(
      'Comboios', 
      'Excluiu', 
      `Excluiu o comboio "${item.nome}".`,
      historyLogs,
      () => {
        setComboios(updated);
        writeStorageValue(localStorage, 'renea_comboios', JSON.stringify(updated));
      }
    );
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

  const handleDeleteTipoCombustivel = (id: string) => {
    const item = combustiveis.find(x => x.id === id);
    if (!item) return;
    const updated = combustiveis.filter(x => x.id !== id);
    saveAndLog(
      'Combustíveis', 
      'Excluiu', 
      `Excluiu o tipo de combustível "${item.nome}".`,
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

  const handleDeleteProdutoLubrificacao = (id: string) => {
    const item = lubrificantes.find(x => x.id === id);
    if (!item) return;
    const updated = lubrificantes.filter(x => x.id !== id);
    saveAndLog(
      'Produtos Lubrificação', 
      'Excluiu', 
      `Excluiu o lubrificante "${item.nome}".`,
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

  const handleDeleteEtapaServico = (id: string) => {
    const item = etapas.find(x => x.id === id);
    if (!item) return;
    const updated = etapas.filter(x => x.id !== id);
    saveAndLog(
      'Etapas de Serviço', 
      'Excluiu', 
      `Excluiu a etapa/ramo "${item.nome}".`,
      historyLogs,
      () => {
        setEtapas(updated);
        writeStorageValue(localStorage, 'renea_etapas', JSON.stringify(updated));
      }
    );
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

    if (target === 'empresas' || target === 'fornecedores') {
      const incoming = validRows.map((row, index): Empresa | null => {
        const cnpj = getImportValue(row, ['cnpj', 'documento']);
        const nome = getImportValue(row, ['nome', 'empresa', 'nome fantasia', 'razao social', 'razão social']) || cnpj || `Empresa ${index + 1}`;
        return {
          id: `emp-import-${now}-${index}`,
          nome,
          cnpj,
          telefone: getImportValue(row, ['telefone', 'contato', 'celular']),
          responsavel: getImportValue(row, ['responsavel', 'responsável', 'gestor']),
          tipos: [target === 'fornecedores' ? 'FORNECEDOR' : 'EMPRESA'],
          status: normalizeImportText(getImportValue(row, ['status', 'situacao', 'situação'])).includes('inativo') ? 'INATIVO' : 'ATIVO',
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
        };
      }).filter(Boolean) as Empresa[];
      if (incoming.length === 0) return { success: false, message: 'Nenhuma empresa foi encontrada na planilha.' };
      const result = mergeImportedRecords(empresas, incoming, item => normalizeImportText(item.cnpj || item.nome));
      return persistImport(target === 'fornecedores' ? 'Fornecedores' : 'Empresas', 'renea_empresas', setEmpresas, result.next, incoming.length, result.created, result.updated);
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
      const result = mergeImportedRecords(equipamentos, incoming, item => normalizeImportText(item.prefixo));
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
          ativo: !ativoValue || !ativoValue.includes('inativo'),
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
      const result = mergeImportedRecords(funcionarios, incoming, item => normalizeImportText(item.matricula || item.nome));
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

  const handleApplyMasterWorkbook = async (
    analysis: MasterWorkbookAnalysis,
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const promoted = promoteMasterWorkbook(analysis, {
        empresas,
        obras,
        funcionarios,
        materiais: materiaisCadastro,
        ramos: apontamentoRamos,
        equipamentos,
      });
      const previousReviewRows = parseStoredJson<MasterWorkbookReviewRow[]>(
        localStorage.getItem('renea_master_data_review_queue'),
        'renea_master_data_review_queue',
        [],
      );
      const reviewIndex = new Map(previousReviewRows.map(row => [
        `${row.entity}|${row.sheetName}|${row.rowNumber}|${row.canonicalKey}`,
        row,
      ]));
      promoted.reviewRows.forEach(row => {
        reviewIndex.set(`${row.entity}|${row.sheetName}|${row.rowNumber}|${row.canonicalKey}`, row);
      });
      const nextReviewRows = Array.from(reviewIndex.values());
      const created = Object.values(promoted.counts).reduce((total, count) => total + count.created, 0);
      const updated = Object.values(promoted.counts).reduce((total, count) => total + count.updated, 0);
      const preserved = promoted.reviewRows.length;
      const message = `Planilha Mestre aplicada: ${created} cadastro(s) criado(s), ${updated} atualizado(s) e ${preserved} linha(s) preservada(s) para revisão.`;
      const nextHistory: HistoryLog[] = [{
        id: `log-master-${Date.now()}`,
        timestamp: new Date().toLocaleString('pt-BR'),
        usuario: activeUserName,
        acao: 'Criou',
        tela: 'Cadastros Mestres',
        descricao: `${message} Origem: ${analysis.sourceName}.`,
      }, ...historyLogs];

      commitStorageBatch(localStorage, [
        { key: 'renea_empresas', value: JSON.stringify(promoted.empresas) },
        { key: 'renea_obras', value: JSON.stringify(promoted.obras) },
        { key: 'renea_funcionarios', value: JSON.stringify(promoted.funcionarios) },
        { key: 'renea_materiais_cadastro', value: JSON.stringify(promoted.materiais) },
        { key: 'renea_apontamento_ramos', value: JSON.stringify(promoted.ramos) },
        { key: 'renea_equipamentos', value: JSON.stringify(promoted.equipamentos) },
        { key: 'renea_master_data_review_queue', value: JSON.stringify(nextReviewRows) },
        { key: 'renea_history_logs', value: JSON.stringify([]) },
      ]);

      setEmpresas(promoted.empresas);
      setObras(promoted.obras);
      setFuncionarios(promoted.funcionarios);
      setMateriaisCadastro(promoted.materiais);
      setApontamentoRamos(promoted.ramos);
      setEquipamentos(promoted.equipamentos);
      setHistoryLogs([]);
      addNotification('Planilha Mestre atualizada', message, preserved > 0 ? 'warning' : 'success', 'Sistema Local');

      if (isAutoSyncEnabled) {
        window.setTimeout(() => void uploadLocalSnapshotToFirebase(), 150);
      }
      return { success: true, message };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Falha ao aplicar a Planilha Mestre.',
      };
    }
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

  const handleDeleteAbastecimento = (id: string) => {
    const item = abastecimentos.find(x => x.id === id);
    if (!item) return;
    const cancelledAt = new Date().toISOString();
    let updated = abastecimentos.map(x => x.id === id ? {
      ...x,
      status: 'Cancelado' as const,
      atualizadoEm: cancelledAt,
      revisaoStatus: 'Reaberto' as const,
      revisaoObservacao: [x.revisaoObservacao, `Registro cancelado em ${new Date(cancelledAt).toLocaleString('pt-BR')}.`].filter(Boolean).join(' '),
    } : x);
    updated = auditarBaseCombustivel(updated);
    saveAndLog(
      'Abastecimentos', 
      'Editou', 
      `Cancelou lançamento de abastecimento ID ${id.substring(0, 8)} sem apagar o histórico operacional.`,
      historyLogs,
      () => {
        setAbastecimentos(updated);
        writeStorageValue(localStorage, 'renea_abastecimentos', JSON.stringify(updated));
      }
    );
  };

  // Importação de planilha — Prioridade 3: grava em lote (um único registro de histórico)
  const handleImportAbastecimentos = (novosItens: Abastecimento[], combustiveisImportados: TipoCombustivel[] = []) => {
    const existingWithCanonicalPrefix = abastecimentos.map(item => ({
      ...item,
      prefixoInformado: item.prefixoInformado || equipamentos.find(equipment => equipment.id === item.equipamentoId)?.prefixo || item.equipamentoId,
    }));
    const { accepted: itensIneditos, rejected: itensRejeitados } = filterNovelFuelImports(existingWithCanonicalPrefix, novosItens || []);
    const tiposUtilizados = new Set(itensIneditos.map(item => item.tipoCombustivelId));
    const combustiveisValidos = combustiveisImportados.filter(item => tiposUtilizados.has(item.id));
    if (itensIneditos.length === 0 && combustiveisValidos.length === 0) return;
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
    const item = lubrificacoes.find(x => x.id === id);
    if (!item) return;
    const updated = lubrificacoes.filter(x => x.id !== id);
    saveAndLog(
      'Lubrificações', 
      'Excluiu', 
      `Excluiu lançamento de lubrificação ID ${id.substring(0, 8)}.`,
      historyLogs,
      () => {
        setLubrificacoes(updated);
        writeStorageValue(localStorage, 'renea_lubrificacoes', JSON.stringify(updated));
      }
    );
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

  const handleDeleteTicketJazida = (id: string) => {
    const item = ticketsJazida.find(x => x.id === id);
    if (!item) return;
    const updated = ticketsJazida.filter(x => x.id !== id);
    saveAndLog(
      'Tickets Jazida',
      'Excluiu',
      `Excluiu ticket de ${item.tipoTicket || 'Liberação'} Nº ${item.ticketNumero}.`,
      historyLogs,
      () => {
        setTicketsJazida(updated);
        writeStorageValue(localStorage, 'renea_tickets_jazida', JSON.stringify(updated));
      }
    );
    void deletePublicTicket(db, id)
      .catch(error => console.warn('Falha ao excluir ticket público:', error));
  };

  const handleDeleteAbastecimentos = (ids: string[]) => {
    const selected = new Set(ids);
    if (selected.size === 0) return;
    const updated = auditarBaseCombustivel(abastecimentos.filter(item => !selected.has(item.id)));
    saveAndLog(
      'Abastecimentos',
      'Excluiu',
      `Excluiu permanentemente ${selected.size} abastecimento(s) selecionado(s).`,
      historyLogs,
      () => {
        setAbastecimentos(updated);
        writeStorageValue(localStorage, 'renea_abastecimentos', JSON.stringify(updated));
      }
    );
  };

  const handleDeleteTicketsJazida = (ids: string[]) => {
    const selected = new Set(ids);
    if (selected.size === 0) return;
    const updated = ticketsJazida.filter(item => !selected.has(item.id));
    saveAndLog(
      'Tickets Jazida',
      'Excluiu',
      `Excluiu permanentemente ${selected.size} ticket(s) selecionado(s).`,
      historyLogs,
      () => {
        setTicketsJazida(updated);
        writeStorageValue(localStorage, 'renea_tickets_jazida', JSON.stringify(updated));
      }
    );
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

  const handleSaveListaPresenca = (item: ListaPresenca, isNew: boolean) => {
    let updated;
    if (isNew) {
      updated = [...listasPresenca, item];
    } else {
      updated = listasPresenca.map(x => x.id === item.id ? item : x);
    }
    const ob = obras.find(o => o.id === item.obraId);
    saveAndLog(
      'Presença', 
      isNew ? 'Criou' : 'Editou', 
      `${isNew ? 'Registrou' : 'Editou'} Lista de Presença para obra "${ob ? ob.nome : 'Geral'}" no dia ${item.data}.`,
      historyLogs,
      () => {
        setListasPresenca(updated);
        writeStorageValue(localStorage, 'renea_listas_presenca', JSON.stringify(updated));
      }
    );
  };

  const handleDeleteListaPresenca = (id: string) => {
    const item = listasPresenca.find(x => x.id === id);
    const updated = listasPresenca.filter(x => x.id !== id);
    saveAndLog(
      'Presença', 
      'Excluiu', 
      `Excluiu Lista de Presença do dia ${item ? item.data : ''}.`,
      historyLogs,
      () => {
        setListasPresenca(updated);
        writeStorageValue(localStorage, 'renea_listas_presenca', JSON.stringify(updated));
      }
    );
  };

  const handleSaveOrdemServico = (item: OrdemServico, isNew: boolean) => {
    let updated;
    if (isNew) {
      updated = [...ordensServico, item];
    } else {
      updated = ordensServico.map(x => x.id === item.id ? item : x);
    }
    const eq = equipamentos.find(e => e.id === item.equipamentoId);
    saveAndLog(
      'Manutenção',
      isNew ? 'Criou' : 'Editou',
      `${isNew ? 'Abriu' : 'Atualizou'} a ${item.numero} (${item.tipo}) para o equipamento "${eq ? eq.prefixo : 'desconhecido'}" — status: ${item.status}.`,
      historyLogs,
      () => {
        setOrdensServico(updated);
        writeStorageValue(localStorage, 'renea_ordens_servico', JSON.stringify(updated));
      }
    );
  };

  const handleDeleteOrdemServico = (id: string) => {
    const item = ordensServico.find(x => x.id === id);
    const updated = ordensServico.filter(x => x.id !== id);
    saveAndLog(
      'Manutenção',
      'Excluiu',
      `Excluiu a ordem de serviço ${item ? item.numero : ''}.`,
      historyLogs,
      () => {
        setOrdensServico(updated);
        writeStorageValue(localStorage, 'renea_ordens_servico', JSON.stringify(updated));
      }
    );
  };

  // Atualiza apenas o status de um equipamento (usado pela tela de Manutenção
  // para refletir automaticamente o status da OS no cadastro de frota).
  const handleUpdateEquipamentoStatus = (equipamentoId: string, status: Equipamento['status']) => {
    const item = equipamentos.find(x => x.id === equipamentoId);
    if (!item || item.status === status) return;
    const updatedItem = { ...item, status };
    const updated = equipamentos.map(x => x.id === equipamentoId ? updatedItem : x);
    setEquipamentos(updated);
    writeStorageValue(localStorage, 'renea_equipamentos', JSON.stringify(updated));
  };

  // Notifications helpers
  const addNotification = (
    title: string, 
    message: string, 
    type: NotificationType = 'info',
    source: NotificationSource = 'Netlify App'
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
  ): AppNotification => createNotification(title, message, type, 'Netlify App', 'notif-pres');

  const uploadLocalSnapshotToFirebase = () => {
    const getLS = (key: string, def: any) => {
      const val = localStorage.getItem(key);
      return parseStoredJson(val, key, def);
    };
    return handleUploadToFirebase(
      getLS('renea_empresas', INITIAL_EMPRESAS),
      getLS('renea_obras', INITIAL_OBRAS),
      getLS('renea_equipamentos', INITIAL_EQUIPAMENTOS),
      getLS('renea_funcionarios', INITIAL_FUNCIONARIOS),
      getLS('renea_comboios', INITIAL_COMBOIOS),
      getLS('renea_combustiveis', INITIAL_TIPOS_COMBUSTIVEL),
      getLS('renea_lubrificantes', INITIAL_PRODUTOS_LUBRIFICACAO),
      getLS('renea_etapas', INITIAL_ETAPAS_SERVICO),
      getLS('renea_abastecimentos', INITIAL_ABASTECIMENTOS),
      getLS('renea_lubrificacoes', INITIAL_LUBRIFICACOES),
      getLS('renea_tickets_jazida', []),
      [],
      getLS('renea_listas_presenca', INITIAL_PRESENCAS),
      getLS('renea_ordens_servico', INITIAL_ORDENS_SERVICO),
      getLS('renea_grupos_equipes', INITIAL_GRUPOS_EQUIPES),
      getLS('renea_presencas_link', INITIAL_PRESENCAS_LINK),
      getLS('renea_historico_presencas', INITIAL_HISTORICO_PRESENCAS),
      getLS('renea_notifications', getInitialNotifications()),
      getLS('renea_apontamento_ramos', INITIAL_APONTAMENTO_RAMOS),
      getLS('renea_apontamento_ramo_registros', INITIAL_APONTAMENTO_RAMO_REGISTROS),
      getLS('renea_materiais_cadastro', INITIAL_MATERIAIS_CADASTRO),
      getLS('renea_materiais_registros', INITIAL_MATERIAIS_REGISTROS),
      getLS('renea_partes_diarias_equipamentos', INITIAL_PARTES_DIARIAS_EQUIPAMENTOS),
      getLS('renea_periodos_arquivados', []),
      getLS('renea_controle_estacas', INITIAL_CONTROLE_ESTACAS)
    );
  };

  useEffect(() => {
    if (!publicLinksRotationPending || !isLoggedIn || externalTicketLink || externalPresenceToken || externalApontamentoToken) return;
    let cancelled = false;
    let running = false;
    const publishRotation = async () => {
      if (cancelled || running || !navigator.onLine) return;
      running = true;
      const result = await uploadLocalSnapshotToFirebase();
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
    externalApontamentoToken,
  ]);

  useEffect(() => {
    if (!isLoggedIn || externalTicketLink || externalPresenceToken || externalApontamentoToken) return;
    const flush = () => {
      if (!navigator.onLine) return;
      void flushOfflineCommands({
        'firebase-backup': async () => {
          const result = await uploadLocalSnapshotToFirebase();
          if (!result.success) throw new Error(result.message);
        },
      });
    };
    window.addEventListener('online', flush);
    flush();
    return () => window.removeEventListener('online', flush);
  }, [isLoggedIn, externalTicketLink, externalPresenceToken, externalApontamentoToken]);

  useEffect(() => {
    if (!isLoggedIn || !currentUser || externalTicketLink || externalPresenceToken || externalApontamentoToken) return;
    let cancelled = false;
    let running = false;

    const ingestOneDriveFuel = async () => {
      if (cancelled || running) return;
      running = true;
      try {
        const payload = await loadOneDriveFuelPayload();
        if (cancelled) return;
        setOneDriveFuelSyncStatus(payload.status);
        const batchId = payload.status.batchId || '';
        if (!batchId || payload.rows.length === 0 || localStorage.getItem('renea_onedrive_fuel_batch') === batchId) return;

        // Quando a sincronização automática está ativa, parte sempre da versão mais
        // recente do banco para não sobrescrever alterações feitas em outro navegador.
        if (isAutoSyncEnabled) {
          const remoteResult = await handleDownloadFromFirebase();
          if (!remoteResult.success && !remoteResult.message.includes('Nenhum backup')) {
            throw new Error(remoteResult.message);
          }
        }

        const storedEquipment = parseStoredJson<Equipamento[]>(localStorage.getItem('renea_equipamentos'), 'renea_equipamentos', INITIAL_EQUIPAMENTOS);
        const storedConvoys = parseStoredJson<Comboio[]>(localStorage.getItem('renea_comboios'), 'renea_comboios', INITIAL_COMBOIOS);
        const storedFuelTypes = parseStoredJson<TipoCombustivel[]>(localStorage.getItem('renea_combustiveis'), 'renea_combustiveis', INITIAL_TIPOS_COMBUSTIVEL);
        const storedFuelRecords = parseStoredJson<Abastecimento[]>(localStorage.getItem('renea_abastecimentos'), 'renea_abastecimentos', INITIAL_ABASTECIMENTOS);
        const materialized = materializeOneDriveFuelRows(
          payload.rows,
          storedEquipment,
          storedConvoys,
          storedFuelTypes,
          storedFuelRecords,
          payload.status.fileName || '',
        );
        const nextFuelTypes = mergeRecordsById(storedFuelTypes, materialized.fuelTypes);
        // O agente envia um retrato completo da pasta. Substituir somente os
        // registros de origem OneDrive evita manter linhas removidas da planilha,
        // sem tocar nos lançamentos manuais e nas demais importações.
        const nextFuelRecords = mergeRecordsById(
          storedFuelRecords.filter(record => record.origem !== 'OneDrive'),
          materialized.records,
        );
        const storedHistory = parseStoredJson<HistoryLog[]>(localStorage.getItem('renea_history_logs'), 'renea_history_logs', []);
        const nextHistory = mergeRecordsById(storedHistory, [{
          id: `log-onedrive-${batchId}`,
          timestamp: new Date(payload.status.syncedAt || Date.now()).toLocaleString('pt-BR'),
          usuario: 'Agente OneDrive',
          acao: 'Criou' as const,
          tela: 'Abastecimentos',
          descricao: `Sincronizou ${materialized.records.length} linha(s) de ${payload.status.fileName || 'planilha do OneDrive'}; ${payload.status.warningCount || 0} linha(s) para conferência.`,
        }]);

        commitStorageBatch(localStorage, [
          { key: 'renea_combustiveis', value: JSON.stringify(nextFuelTypes) },
          { key: 'renea_abastecimentos', value: JSON.stringify(nextFuelRecords) },
      { key: 'renea_history_logs', value: JSON.stringify([]) },
        ]);
        setCombustiveis(nextFuelTypes);
        setAbastecimentos(nextFuelRecords);
    setHistoryLogs([]);

        const syncResult = await uploadLocalSnapshotToFirebase();
        if (!syncResult.success) throw new Error(syncResult.message);
        writeStorageValue(localStorage, 'renea_onedrive_fuel_batch', batchId);
      } catch (error) {
        if (!cancelled) {
          console.warn('Falha ao incorporar a planilha do OneDrive:', error);
          setOneDriveFuelSyncStatus(current => ({
            state: 'error',
            intervalMinutes: 10,
            ...current,
            message: error instanceof Error ? error.message : 'Falha ao consultar o OneDrive.',
          }));
        }
      } finally {
        running = false;
      }
    };

    const initial = window.setTimeout(ingestOneDriveFuel, 3_000);
    // A origem é atualizada pelo agente a cada 10 minutos; consultar o mesmo
    // payload a cada minuto apenas gerava tráfego e processamento repetido.
    const interval = window.setInterval(ingestOneDriveFuel, 10 * 60_000);
    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [isLoggedIn, currentUser, isAutoSyncEnabled, externalTicketLink, externalPresenceToken, externalApontamentoToken]);

  useEffect(() => {
    if (!isLoggedIn || !currentUser || externalTicketLink || externalPresenceToken || externalApontamentoToken) return;
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
      try {
        const incomingPresence = submissions.flatMap(item => item.kind === 'presence' ? (item.payload.records || []) : []);
        const incomingPointing = submissions.flatMap(item => item.kind === 'apontamento' && item.payload.record ? [item.payload.record] : []);
        const storedPresence = parseStoredJson<PresencaApontamento[]>(localStorage.getItem('renea_presencas_link'), 'renea_presencas_link', []);
        const storedPointing = parseStoredJson<ApontamentoRamoRegistro[]>(localStorage.getItem('renea_apontamento_ramo_registros'), 'renea_apontamento_ramo_registros', []);
        const nextPresence = mergePresenceRecords(storedPresence, incomingPresence);
        const nextPointing = mergeRecordsById(storedPointing, incomingPointing);

        // Colaboradores incluídos pelo apontador no link entram no cadastro da
        // equipe. A leitura vem do armazenamento local, e não do estado, para
        // que uma fila processada em sequência não sobrescreva a anterior.
        const incomingMembers = submissions.flatMap(item => item.kind === 'equipe' && item.payload.grupoId && item.payload.funcionarioId
          ? [{ grupoId: item.payload.grupoId, funcionarioId: item.payload.funcionarioId }]
          : []);
        const storedGroups = parseStoredJson<GrupoEquipe[]>(localStorage.getItem('renea_grupos_equipes'), 'renea_grupos_equipes', []);
        const nextGroups = incomingMembers.length === 0 ? storedGroups : storedGroups.map(group => {
          const additions = incomingMembers
            .filter(member => member.grupoId === group.id)
            .map(member => member.funcionarioId)
            .filter(id => !(group.funcionarioIds || []).includes(id));
          if (additions.length === 0) return group;
          return {
            ...group,
            funcionarioIds: [...(group.funcionarioIds || []), ...additions],
            updatedAt: new Date().toISOString(),
          };
        });

        const storedHistory = parseStoredJson<HistoryLog[]>(localStorage.getItem('renea_history_logs'), 'renea_history_logs', []);
        const nextHistory = mergeRecordsById(storedHistory, submissions.map(item => ({
          id: `log-public-${item.id}`,
          timestamp: new Date(item.createdAtIso || Date.now()).toLocaleString('pt-BR'),
          usuario: item.kind === 'apontamento'
            ? (item.payload.record?.responsavel || 'Link de apontamento')
            : (item.payload.grupoNome || 'Link de presença'),
          acao: 'Criou' as const,
          tela: item.kind === 'apontamento' ? 'Apontamentos' : 'Controle de Presença',
          descricao: item.kind === 'apontamento'
            ? `Recebeu apontamento público de ${item.payload.record?.ramoNome || item.payload.ramoId} em ${item.payload.data}.`
            : item.kind === 'equipe'
              ? `Incluiu ${item.payload.funcionarioNome || item.payload.funcionarioId} na equipe ${item.payload.grupoNome || item.payload.grupoId} pelo link de presença.`
              : `Recebeu presença pública do grupo ${item.payload.grupoNome || item.payload.grupoId} em ${item.payload.data}.`,
        })));

        const storedNotifications = parseStoredJson<AppNotification[]>(localStorage.getItem('renea_notifications'), 'renea_notifications', []);
        const nextNotifications = mergeRecordsById(storedNotifications, submissions.map(item => ({
          id: `notification-public-${item.id}`,
          type: 'success' as const,
          title: item.kind === 'apontamento'
            ? 'Apontamento recebido'
            : item.kind === 'equipe' ? 'Colaborador incluído na equipe' : 'Presença recebida',
          message: item.kind === 'apontamento'
            ? `${item.payload.record?.ramoNome || 'Ramo'} enviou um apontamento de campo.`
            : item.kind === 'equipe'
              ? `${item.payload.funcionarioNome || 'Colaborador'} entrou na equipe ${item.payload.grupoNome || 'sem nome'} pelo link de presença.`
              : `${item.payload.grupoNome || 'Equipe'} enviou ${item.payload.records?.length || 0} registro(s) de presença.`,
          timestamp: new Date(item.createdAtIso || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          read: false,
          source: 'Sistema Local' as const,
        })));

        writeStorageValue(localStorage, 'renea_presencas_link', JSON.stringify(nextPresence));
        writeStorageValue(localStorage, 'renea_apontamento_ramo_registros', JSON.stringify(nextPointing));
        writeStorageValue(localStorage, 'renea_history_logs', JSON.stringify(nextHistory));
        persistNotifications(localStorage, nextNotifications);
        setPresencasLink(nextPresence);
        setApontamentoRamoRegistros(nextPointing);
        setHistoryLogs(nextHistory);
        setNotifications(nextNotifications);
        if (incomingMembers.length > 0) {
          writeStorageValue(localStorage, 'renea_grupos_equipes', JSON.stringify(nextGroups));
          setGruposEquipe(nextGroups);
        }

        let syncResult = await uploadLocalSnapshotToFirebase();
        if (!syncResult.success && /conflito|outro computador|vers[aã]o mais recente/i.test(syncResult.message)) {
          // A fila pública é idempotente por ID. Em caso de concorrência,
          // baixa o retrato vencedor, reaplica somente os envios pendentes e
          // tenta novamente sem apagar nem duplicar registros operacionais.
          const downloadResult = await handleDownloadFromFirebase();
          if (!downloadResult.success) throw new Error(downloadResult.message);
          const refreshedPresence = mergePresenceRecords(
            parseStoredJson<PresencaApontamento[]>(localStorage.getItem('renea_presencas_link'), 'renea_presencas_link', []),
            incomingPresence,
          );
          const refreshedPointing = mergeRecordsById(
            parseStoredJson<ApontamentoRamoRegistro[]>(localStorage.getItem('renea_apontamento_ramo_registros'), 'renea_apontamento_ramo_registros', []),
            incomingPointing,
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
          writeStorageValue(localStorage, 'renea_apontamento_ramo_registros', JSON.stringify(refreshedPointing));
          writeStorageValue(localStorage, 'renea_history_logs', JSON.stringify(refreshedHistory));
          persistNotifications(localStorage, refreshedNotifications);
          setPresencasLink(refreshedPresence);
          setApontamentoRamoRegistros(refreshedPointing);
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
          syncResult = await uploadLocalSnapshotToFirebase();
        }
        if (!syncResult.success) throw new Error(syncResult.message);
        await markPublicSubmissionsProcessed(db, submissions.map(item => item.id), currentUser.uid);
      } catch (error) {
        if (!cancelled) console.warn('Falha ao incorporar a fila pública; os itens permanecerão pendentes:', error);
      } finally {
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
      submissions => void ingestPublicSubmissions(submissions),
      error => {
        if (!cancelled) console.warn('Falha ao acompanhar os envios públicos em tempo real:', error);
      },
    );
    return () => {
      cancelled = true;
      queuedSubmissions = null;
      unsubscribe();
    };
  }, [isLoggedIn, currentUser, externalTicketLink, externalPresenceToken, externalApontamentoToken]);

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

  const handleDeleteGrupoEquipe = (id: string) => {
    const grupo = gruposEquipe.find(item => item.id === id);
    if (!grupo) return;
    const updated = gruposEquipe.filter(item => item.id !== id);

    saveAndLog(
      'Grupos / Equipes',
      'Excluiu',
      `Excluiu o grupo "${grupo.nome}" e desativou seu link de presença.`,
      historyLogs,
      () => {
        setGruposEquipe(updated);
        writeStorageValue(localStorage, 'renea_grupos_equipes', JSON.stringify(updated));
      }
    );
  };

  // Sincronização das equipes com a planilha do efetivo. Chega já conferida
  // pelo administrativo: aqui só grava, registra e sincroniza.
  const handleSyncEquipesPlanilha = (
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
    void uploadLocalSnapshotToFirebase().then(result => {
      if (!result.success) console.warn('Equipes sincronizadas localmente; o envio à nuvem falhou:', result.message);
    });
  };

  const handleSubmitPresencaLink = async (
    grupo: GrupoEquipe,
    data: string,
    items: Array<{ funcionarioId: string; status: PresencaStatus; observacao: string }>,
    observacaoDia = '',
  ): Promise<{ success: boolean; message: string }> => {
    try {
      return await submitPublicPresence(externalPresenceToken, grupo.id, data, items, observacaoDia);
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

  const handleUpdateExternalPresencaRecord = async (
    grupoId: string,
    funcionarioId: string,
    status: PresencaStatus,
    observacao: string
  ) => {
    try {
      return await updatePublicPresenceRecord(externalPresenceToken, grupoId, funcionarioId, status, observacao);
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

    handleUploadToFirebase(
      empresas, obras, equipamentos, funcionarios, comboios, combustiveis, lubrificantes, etapas,
      abastecimentos, lubrificacoes, ticketsJazida, historyLogs, listasPresenca, ordensServico,
      gruposEquipe, updatedPresencas, updatedHistorico, updatedNotifications
    );
  };

  const handleDeletePresencaLink = (ids: string[]) => {
    const selected = new Set(ids);
    const submissionDocIds = Array.from(new Set(
      presencasLink
        .filter(item => selected.has(item.id))
        .map(item => {
          if (item.submissionDocId) return item.submissionDocId;
          const legacyMatch = /^plink-(.+)-\d+$/.exec(item.id);
          return legacyMatch ? `presence_${legacyMatch[1]}` : '';
        })
        .filter(Boolean),
    ));
    const updatedPresencas = presencasLink.filter(item => !selected.has(item.id));
    setPresencasLink(updatedPresencas);
    writeStorageValue(localStorage, 'renea_presencas_link', JSON.stringify(updatedPresencas));
    addNotification('Presenças excluídas', `${ids.length} registro(s) removido(s) manualmente.`, 'warning', 'Sistema Local');
    void markPublicSubmissionsProcessed(db, submissionDocIds, currentUser?.uid || activeUserName)
      .catch(error => console.warn('Não foi possível encerrar a submissão pública excluída:', error))
      .finally(() => { void uploadLocalSnapshotToFirebase(); });
  };

  const handleSaveApontamentoRamo = (ramo: ApontamentoRamo, isNew: boolean) => {
    const updated = isNew
      ? [...apontamentoRamos, ramo]
      : apontamentoRamos.map(item => item.id === ramo.id ? ramo : item);

    saveAndLog(
      'Apontamentos',
      isNew ? 'Criou' : 'Editou',
      `${isNew ? 'Criou' : 'Editou'} o ramo "${ramo.ramoNome}" no canteiro "${ramo.canteiroNome}".`,
      historyLogs,
      () => {
        setApontamentoRamos(updated);
        writeStorageValue(localStorage, 'renea_apontamento_ramos', JSON.stringify(updated));
      }
    );
  };

  const handleDeleteApontamentoRamo = (id: string) => {
    const ramo = apontamentoRamos.find(item => item.id === id);
    if (!ramo) return;
    if (!confirm('Excluir este ramo? Os apontamentos já enviados continuarão no histórico.')) return;

    const updated = apontamentoRamos.filter(item => item.id !== id);
    saveAndLog(
      'Apontamentos',
      'Excluiu',
      `Excluiu o ramo "${ramo.ramoNome}" do canteiro "${ramo.canteiroNome}".`,
      historyLogs,
      () => {
        setApontamentoRamos(updated);
        writeStorageValue(localStorage, 'renea_apontamento_ramos', JSON.stringify(updated));
      }
    );
  };

  const handleSaveApontamentoRamoRegistro = (registro: ApontamentoRamoRegistro) => {
    const updated = apontamentoRamoRegistros.map(item => item.id === registro.id ? registro : item);
    saveAndLog(
      'Apontamentos',
      'Editou',
      `Editou o apontamento de ${registro.responsavel || 'apontador'} no ramo "${registro.ramoNome}" (${registro.data}).`,
      historyLogs,
      () => {
        setApontamentoRamoRegistros(updated);
        writeStorageValue(localStorage, 'renea_apontamento_ramo_registros', JSON.stringify(updated));
      }
    );
  };

  const handleDeleteApontamentoRamoRegistro = (id: string) => {
    const registro = apontamentoRamoRegistros.find(item => item.id === id);
    if (!registro) return;
    if (!confirm('Excluir este registro de apontamento?')) return;

    const updated = apontamentoRamoRegistros.filter(item => item.id !== id);
    saveAndLog(
      'Apontamentos',
      'Excluiu',
      `Excluiu o apontamento de ${registro.responsavel || 'apontador'} no ramo "${registro.ramoNome}" (${registro.data}).`,
      historyLogs,
      () => {
        setApontamentoRamoRegistros(updated);
        writeStorageValue(localStorage, 'renea_apontamento_ramo_registros', JSON.stringify(updated));
      }
    );
  };

  const handleSaveMaterialCadastro = (material: MaterialCadastro, isNew: boolean) => {
    const updated = isNew
      ? [...materiaisCadastro, material]
      : materiaisCadastro.map(item => item.id === material.id ? material : item);

    saveAndLog(
      'Materiais',
      isNew ? 'Criou' : 'Editou',
      `${isNew ? 'Criou' : 'Editou'} o material "${material.nome}".`,
      historyLogs,
      () => {
        setMateriaisCadastro(updated);
        writeStorageValue(localStorage, 'renea_materiais_cadastro', JSON.stringify(updated));
      }
    );
  };

  const handleDeleteMaterialCadastro = (id: string) => {
    const material = materiaisCadastro.find(item => item.id === id);
    if (!material) return;
    const hasRegistros = materiaisRegistros.some(item => item.material === material.nome);
    const message = hasRegistros
      ? `Excluir o cadastro "${material.nome}"? Os lançamentos já importados continuam no histórico.`
      : `Excluir o cadastro "${material.nome}"?`;
    if (!confirm(message)) return;

    const updated = materiaisCadastro.filter(item => item.id !== id);
    saveAndLog(
      'Materiais',
      'Excluiu',
      `Excluiu o cadastro do material "${material.nome}".`,
      historyLogs,
      () => {
        setMateriaisCadastro(updated);
        writeStorageValue(localStorage, 'renea_materiais_cadastro', JSON.stringify(updated));
      }
    );
  };

  const handleSaveMaterialRegistro = (registro: MaterialRegistro, isNew: boolean) => {
    const updated = isNew
      ? [registro, ...materiaisRegistros]
      : materiaisRegistros.map(item => item.id === registro.id ? registro : item);

    saveAndLog(
      'Materiais',
      isNew ? 'Criou' : 'Editou',
      `${isNew ? 'Criou' : 'Editou'} lançamento de ${registro.material} em ${registro.destino || registro.origem || 'local não informado'}.`,
      historyLogs,
      () => {
        setMateriaisRegistros(updated);
        writeStorageValue(localStorage, 'renea_materiais_registros', JSON.stringify(updated));
      }
    );
  };

  const handleDeleteMaterialRegistro = (id: string) => {
    const registro = materiaisRegistros.find(item => item.id === id);
    if (!registro) return;
    if (!confirm(`Excluir o lançamento de ${registro.material} do dia ${registro.data}?`)) return;

    const updated = materiaisRegistros.filter(item => item.id !== id);
    saveAndLog(
      'Materiais',
      'Excluiu',
      `Excluiu lançamento de ${registro.material} do dia ${registro.data}.`,
      historyLogs,
      () => {
        setMateriaisRegistros(updated);
        writeStorageValue(localStorage, 'renea_materiais_registros', JSON.stringify(updated));
      }
    );
  };

  const handleImportMateriais = (
    registrosImportados: MaterialRegistro[],
    materiaisImportados: MaterialCadastro[]
  ): { success: boolean; message: string } => {
    if (registrosImportados.length === 0) {
      return { success: false, message: 'Nenhum lançamento válido foi encontrado na planilha.' };
    }

    const materialMerge = mergeImportedRecords(materiaisCadastro, materiaisImportados, materialCadastroKey);
    const registroMerge = mergeImportedRecords(materiaisRegistros, registrosImportados, materialRegistroKey);
    const logMsg = `Importou planilha de materiais: ${registroMerge.created} novo(s), ${registroMerge.updated} atualizado(s), ${materialMerge.created} material(is) novo(s).`;

    saveAndLog(
      'Materiais',
      'Criou',
      logMsg,
      historyLogs,
      () => {
        setMateriaisCadastro(materialMerge.next);
        setMateriaisRegistros(registroMerge.next);
        writeStorageValue(localStorage, 'renea_materiais_cadastro', JSON.stringify(materialMerge.next));
        writeStorageValue(localStorage, 'renea_materiais_registros', JSON.stringify(registroMerge.next));
      }
    );
    return { success: true, message: logMsg };
  };

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

  const handleSaveParteDiariaEquipamento = (registro: ParteDiariaEquipamento, isNew: boolean) => {
    const updated = isNew
      ? [registro, ...partesDiariasEquipamentos]
      : partesDiariasEquipamentos.map(item => item.id === registro.id ? registro : item);

    saveAndLog(
      'Parte Diária de Equipamentos',
      isNew ? 'Criou' : 'Editou',
      `${isNew ? 'Criou' : 'Editou'} a parte nº ${registro.numero} do equipamento ${registro.prefixo} em ${registro.data}.`,
      historyLogs,
      () => {
        setPartesDiariasEquipamentos(updated);
        writeStorageValue(localStorage, 'renea_partes_diarias_equipamentos', JSON.stringify(updated));
      }
    );
  };

  const handleImportPartesDiariasEquipamentos = (registros: ParteDiariaEquipamento[]) => {
    if (!registros.length) return;
    const key = (item: ParteDiariaEquipamento) => normalizeImportText(
      `${item.data}|${item.equipamentoId || item.prefixo}|${item.operadorId || item.matricula || item.operadorNome}`,
    );
    const result = mergeImportedRecords(partesDiariasEquipamentos, registros, key);
    if (!result.created && !result.updated) return;
    saveAndLog(
      'Parte Diária de Equipamentos',
      'Criou',
      `Importou partes diárias: ${result.created} nova(s), ${result.updated} atualizada(s).`,
      historyLogs,
      () => {
        setPartesDiariasEquipamentos(result.next);
        writeStorageValue(localStorage, 'renea_partes_diarias_equipamentos', JSON.stringify(result.next));
      }
    );
  };

  const handleDeleteParteDiariaEquipamento = (id: string) => {
    const registro = partesDiariasEquipamentos.find(item => item.id === id);
    if (!registro) return;
    if (!confirm(`Excluir a parte diária nº ${registro.numero} do equipamento ${registro.prefixo}?`)) return;

    const updated = partesDiariasEquipamentos.filter(item => item.id !== id);
    saveAndLog(
      'Parte Diária de Equipamentos',
      'Excluiu',
      `Excluiu a parte nº ${registro.numero} do equipamento ${registro.prefixo}, datada de ${registro.data}.`,
      historyLogs,
      () => {
        setPartesDiariasEquipamentos(updated);
        writeStorageValue(localStorage, 'renea_partes_diarias_equipamentos', JSON.stringify(updated));
      }
    );
  };

  const handleDeletePartesDiariasEquipamentos = (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids));
    if (!uniqueIds.length || !confirm(`Excluir ${uniqueIds.length} parte(s) diária(s) selecionada(s)?`)) return;
    const updated = partesDiariasEquipamentos.filter(item => !uniqueIds.includes(item.id));
    saveAndLog('Parte Diária de Equipamentos', 'Excluiu', `Excluiu ${uniqueIds.length} parte(s) diária(s) em lote.`, historyLogs, () => {
      setPartesDiariasEquipamentos(updated);
      writeStorageValue(localStorage, 'renea_partes_diarias_equipamentos', JSON.stringify(updated));
    });
  };

  const handleSaveControleEquipamentoDiario = (registro: ControleEquipamentoDiario, isNew: boolean) => {
    const updated = isNew
      ? [registro, ...controleEquipamentosDiario]
      : controleEquipamentosDiario.map(item => item.id === registro.id ? registro : item);
    saveAndLog(
      'Controle Diário de Equipamentos',
      isNew ? 'Criou' : 'Editou',
      `${isNew ? 'Criou' : 'Editou'} o controle de ${registro.prefixo} em ${registro.data}.`,
      historyLogs,
      () => {
        setControleEquipamentosDiario(updated);
        writeStorageValue(localStorage, 'renea_controle_equipamentos_diario', JSON.stringify(updated));
      },
    );
  };

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
    const result = mergeImportedRecords(controleEquipamentosDiario, registros, item => normalizeImportText(item.chave || `${item.data}|${item.codigoFuncionario}`));
    saveAndLog(
      'Controle Diário de Equipamentos',
      'Criou',
      `Importação concluída: ${result.created} novo(s), ${result.updated} atualizado(s), ${result.unchanged} já existente(s), ${result.duplicated} duplicado(s) no arquivo.`,
      historyLogs,
      () => {
        setControleEquipamentosDiario(result.next);
        writeStorageValue(localStorage, 'renea_controle_equipamentos_diario', JSON.stringify(result.next));
      },
    );
  };

  const handleDeleteControleEquipamentosDiario = (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids));
    if (!uniqueIds.length || !confirm(`Você está prestes a excluir ${uniqueIds.length} registro(s) do controle de basculantes. Continuar?`)) return;
    const updated = controleEquipamentosDiario.filter(item => !uniqueIds.includes(item.id));
    saveAndLog('Controle Diário de Equipamentos', 'Excluiu', `Excluiu ${uniqueIds.length} registro(s) em uma única operação.`, historyLogs, () => {
      setControleEquipamentosDiario(updated);
      writeStorageValue(localStorage, 'renea_controle_equipamentos_diario', JSON.stringify(updated));
    });
  };

  const handleSubmitApontamentoRamoLink = async (
    ramo: ApontamentoRamo,
    payload: PublicApontamentoPayload
  ): Promise<{ success: boolean; message: string }> => {
    try {
      return await submitPublicApontamento(externalApontamentoToken, ramo.id, payload);
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Não foi possível enviar o apontamento.' };
    }
  };


  // Administration helpers
  const handleImportData = (imported: {
    empresas?: Empresa[];
    obras?: ObraLocal[];
    equipamentos?: Equipamento[];
    funcionarios?: Funcionario[];
    motoristasOperacionais?: Funcionario[];
    comboios?: Comboio[];
    combustiveis?: TipoCombustivel[];
    lubrificantes?: ProdutoLubrificacao[];
    etapas?: EtapaServico[];
    abastecimentos?: Abastecimento[];
    lubrificacoes?: Lubrificacao[];
    ticketsJazida?: TicketJazida[];
    listasPresenca?: ListaPresenca[];
    ordensServico?: OrdemServico[];
    gruposEquipe?: GrupoEquipe[];
    presencasLink?: PresencaApontamento[];
    historicoPresencas?: HistoricoPresenca[];
    apontamentoRamos?: ApontamentoRamo[];
    apontamentoRamoRegistros?: ApontamentoRamoRegistro[];
    materiaisCadastro?: MaterialCadastro[];
    materiaisRegistros?: MaterialRegistro[];
    partesDiariasEquipamentos?: ParteDiariaEquipamento[];
    controleEquipamentosDiario?: ControleEquipamentoDiario[];
    controleEstacas?: ControleEstacas;
    periodosArquivados?: PeriodoArquivado[];
    masterDataReviewQueue?: MasterWorkbookReviewRow[];
    notifications?: AppNotification[];
    historyLogs?: HistoryLog[];
  }) => {
    // Backups de versões anteriores não possuem todas as tabelas atuais. Uma
    // tabela ausente preserva o conteúdo deste navegador em vez de apagá-lo.
    const nextEmpresas = imported.empresas ?? empresas;
    const nextObras = imported.obras ?? obras;
    const nextEquipamentos = imported.equipamentos ?? equipamentos;
    const nextFuncionarios = imported.funcionarios ?? funcionarios;
    const nextMotoristasOperacionais = imported.motoristasOperacionais ?? motoristasOperacionais;
    const nextComboios = imported.comboios ?? comboios;
    const nextCombustiveis = imported.combustiveis ?? combustiveis;
    const nextLubrificantes = imported.lubrificantes ?? lubrificantes;
    const nextEtapas = imported.etapas ?? etapas;
    const nextAbastecimentos = imported.abastecimentos ?? abastecimentos;
    const nextLubrificacoes = imported.lubrificacoes ?? lubrificacoes;
    const nextTicketsJazida = imported.ticketsJazida ?? ticketsJazida;
    const nextListasPresenca = imported.listasPresenca ?? listasPresenca;
    const nextOrdensServico = imported.ordensServico ?? ordensServico;
    const nextGruposEquipe = imported.gruposEquipe ?? gruposEquipe;
    const nextPresencasLink = imported.presencasLink ?? presencasLink;
    const nextHistoricoPresencas = imported.historicoPresencas ?? historicoPresencas;
    const nextApontamentoRamos = imported.apontamentoRamos ?? apontamentoRamos;
    const nextApontamentoRamoRegistros = imported.apontamentoRamoRegistros ?? apontamentoRamoRegistros;
    const nextMateriaisCadastro = imported.materiaisCadastro ?? materiaisCadastro;
    const nextMateriaisRegistros = imported.materiaisRegistros ?? materiaisRegistros;
    const nextPartesDiariasEquipamentos = imported.partesDiariasEquipamentos ?? partesDiariasEquipamentos;
    const nextControleEquipamentosDiario = imported.controleEquipamentosDiario ?? controleEquipamentosDiario;
    const nextControleEstacas = imported.controleEstacas ?? controleEstacas;
    const nextPeriodosArquivados = imported.periodosArquivados ?? periodosArquivados;
    const nextMasterDataReviewQueue = imported.masterDataReviewQueue ?? parseStoredJson<MasterWorkbookReviewRow[]>(
      localStorage.getItem('renea_master_data_review_queue'),
      'renea_master_data_review_queue',
      [],
    );
    const nextNotifications = imported.notifications ?? notifications;
    const restoreLog: HistoryLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleString('pt-BR'),
      usuario: activeUserName,
      acao: 'Editou',
      tela: 'Banco de Dados',
      descricao: 'Restaurou backup completo do sistema com sucesso.'
    };
    const logs = [restoreLog, ...(imported.historyLogs ?? historyLogs)];

    commitStorageBatch(localStorage, [
      { key: 'renea_empresas', value: JSON.stringify(nextEmpresas) },
      { key: 'renea_obras', value: JSON.stringify(nextObras) },
      { key: 'renea_equipamentos', value: JSON.stringify(nextEquipamentos) },
      { key: 'renea_funcionarios', value: JSON.stringify(nextFuncionarios) },
      { key: STORAGE_KEYS.motoristasOperacionais, value: JSON.stringify(nextMotoristasOperacionais) },
      { key: 'renea_comboios', value: JSON.stringify(nextComboios) },
      { key: 'renea_combustiveis', value: JSON.stringify(nextCombustiveis) },
      { key: 'renea_lubrificantes', value: JSON.stringify(nextLubrificantes) },
      { key: 'renea_etapas', value: JSON.stringify(nextEtapas) },
      { key: 'renea_abastecimentos', value: JSON.stringify(nextAbastecimentos) },
      { key: 'renea_lubrificacoes', value: JSON.stringify(nextLubrificacoes) },
      { key: 'renea_tickets_jazida', value: JSON.stringify(nextTicketsJazida) },
      { key: 'renea_listas_presenca', value: JSON.stringify(nextListasPresenca) },
      { key: 'renea_ordens_servico', value: JSON.stringify(nextOrdensServico) },
      { key: 'renea_grupos_equipes', value: JSON.stringify(nextGruposEquipe) },
      { key: 'renea_presencas_link', value: JSON.stringify(nextPresencasLink) },
      { key: 'renea_historico_presencas', value: JSON.stringify(nextHistoricoPresencas) },
      { key: 'renea_apontamento_ramos', value: JSON.stringify(nextApontamentoRamos) },
      { key: 'renea_apontamento_ramo_registros', value: JSON.stringify(nextApontamentoRamoRegistros) },
      { key: 'renea_materiais_cadastro', value: JSON.stringify(nextMateriaisCadastro) },
      { key: 'renea_materiais_registros', value: JSON.stringify(nextMateriaisRegistros) },
      { key: 'renea_partes_diarias_equipamentos', value: JSON.stringify(nextPartesDiariasEquipamentos) },
      { key: 'renea_controle_equipamentos_diario', value: JSON.stringify(nextControleEquipamentosDiario) },
      { key: 'renea_controle_estacas', value: JSON.stringify(nextControleEstacas) },
      { key: 'renea_periodos_arquivados', value: JSON.stringify(nextPeriodosArquivados) },
      { key: 'renea_master_data_review_queue', value: JSON.stringify(nextMasterDataReviewQueue) },
      { key: 'renea_notifications', value: JSON.stringify(nextNotifications) },
      { key: 'renea_history_logs', value: JSON.stringify([]) },
    ]);

    setEmpresas(nextEmpresas);
    setObras(nextObras);
    setEquipamentos(nextEquipamentos);
    setFuncionarios(nextFuncionarios);
    setMotoristasOperacionais(nextMotoristasOperacionais);
    setComboios(nextComboios);
    setCombustiveis(nextCombustiveis);
    setLubrificantes(nextLubrificantes);
    setEtapas(nextEtapas);
    setAbastecimentos(nextAbastecimentos);
    setLubrificacoes(nextLubrificacoes);
    setTicketsJazida(nextTicketsJazida);
    setListasPresenca(nextListasPresenca);
    setOrdensServico(nextOrdensServico);
    setGruposEquipe(nextGruposEquipe);
    setPresencasLink(nextPresencasLink);
    setHistoricoPresencas(nextHistoricoPresencas);
    setApontamentoRamos(nextApontamentoRamos);
    setApontamentoRamoRegistros(nextApontamentoRamoRegistros);
    setMateriaisCadastro(nextMateriaisCadastro);
    setMateriaisRegistros(nextMateriaisRegistros);
    setPartesDiariasEquipamentos(nextPartesDiariasEquipamentos);
    setControleEquipamentosDiario(nextControleEquipamentosDiario);
    setControleEstacas(nextControleEstacas);
    setPeriodosArquivados(nextPeriodosArquivados);
    setNotifications(nextNotifications);
    setHistoryLogs([]);
  };

  const handleResetData = () => {
    commitStorageBatch(localStorage, [
      { key: 'renea_empresas', value: JSON.stringify(INITIAL_EMPRESAS) },
      { key: 'renea_obras', value: JSON.stringify(INITIAL_OBRAS) },
      { key: 'renea_equipamentos', value: JSON.stringify(INITIAL_EQUIPAMENTOS) },
      { key: 'renea_funcionarios', value: JSON.stringify(INITIAL_FUNCIONARIOS) },
      { key: 'renea_comboios', value: JSON.stringify(INITIAL_COMBOIOS) },
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
      { key: 'renea_apontamento_ramos', value: JSON.stringify(INITIAL_APONTAMENTO_RAMOS) },
      { key: 'renea_apontamento_ramo_registros', value: JSON.stringify(INITIAL_APONTAMENTO_RAMO_REGISTROS) },
      { key: 'renea_materiais_cadastro', value: JSON.stringify(INITIAL_MATERIAIS_CADASTRO) },
      { key: 'renea_materiais_registros', value: JSON.stringify(INITIAL_MATERIAIS_REGISTROS) },
      { key: 'renea_partes_diarias_equipamentos', value: JSON.stringify(INITIAL_PARTES_DIARIAS_EQUIPAMENTOS) },
      { key: 'renea_controle_equipamentos_diario', value: JSON.stringify(INITIAL_CONTROLE_EQUIPAMENTOS_DIARIO) },
      { key: 'renea_controle_estacas', value: JSON.stringify({ lotes: [], cravacoes: [] }) },
      { key: 'renea_periodos_arquivados', value: '[]' },
      { key: 'renea_master_data_review_queue', value: '[]' },
      { key: 'renea_notifications', value: '[]' },
      { key: 'renea_history_logs', value: JSON.stringify([]) },
      { key: 'renea_colaboradores_planilha_v1', value: 'true' },
      { key: 'renea_planilhas_operacionais_v2', value: 'true' },
      { key: 'renea_materiais_planilha_v1', value: 'true' },
    ]);

    setEmpresas(INITIAL_EMPRESAS);
    setObras(INITIAL_OBRAS);
    setEquipamentos(INITIAL_EQUIPAMENTOS);
    setFuncionarios(INITIAL_FUNCIONARIOS);
    setComboios(INITIAL_COMBOIOS);
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
    setApontamentoRamos(INITIAL_APONTAMENTO_RAMOS);
    setApontamentoRamoRegistros(INITIAL_APONTAMENTO_RAMO_REGISTROS);
    setMateriaisCadastro(INITIAL_MATERIAIS_CADASTRO);
    setMateriaisRegistros(INITIAL_MATERIAIS_REGISTROS);
    setPartesDiariasEquipamentos(INITIAL_PARTES_DIARIAS_EQUIPAMENTOS);
    setControleEquipamentosDiario(INITIAL_CONTROLE_EQUIPAMENTOS_DIARIO);
    setControleEstacas(INITIAL_CONTROLE_ESTACAS);
    setPeriodosArquivados([]);
    setNotifications([]);
    setHistoryLogs([]);
  };

  const handleClearData = () => {
    const clearLog: HistoryLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleString('pt-BR'),
      usuario: activeUserName,
      acao: 'Excluiu',
      tela: 'Banco de Dados',
      descricao: 'Limpou completamente todas as tabelas de dados do sistema.'
    };
    const clearedArrayKeys = [
      'renea_empresas', 'renea_obras', 'renea_equipamentos', 'renea_funcionarios', 'renea_motoristas_operacionais',
      'renea_comboios', 'renea_combustiveis', 'renea_lubrificantes', 'renea_etapas',
      'renea_abastecimentos', 'renea_lubrificacoes', 'renea_tickets_jazida',
      'renea_listas_presenca', 'renea_ordens_servico', 'renea_grupos_equipes',
      'renea_presencas_link', 'renea_historico_presencas', 'renea_apontamento_ramos',
      'renea_apontamento_ramo_registros', 'renea_materiais_cadastro', 'renea_materiais_registros',
      'renea_partes_diarias_equipamentos', 'renea_periodos_arquivados', 'renea_notifications',
      'renea_controle_equipamentos_diario',
      'renea_master_data_review_queue',
    ];
    commitStorageBatch(localStorage, [
      ...clearedArrayKeys.map(key => ({ key, value: '[]' })),
      { key: 'renea_controle_estacas', value: JSON.stringify({ lotes: [], cravacoes: [] }) },
      { key: 'renea_history_logs', value: JSON.stringify([]) },
      { key: 'renea_colaboradores_planilha_v1', value: 'true' },
      { key: 'renea_planilhas_operacionais_v2', value: 'true' },
      { key: 'renea_materiais_planilha_v1', value: 'true' },
    ]);

    setEmpresas([]);
    setObras([]);
    setEquipamentos([]);
    setFuncionarios([]);
    setMotoristasOperacionais([]);
    setComboios([]);
    setCombustiveis([]);
    setLubrificantes([]);
    setEtapas([]);
    setAbastecimentos([]);
    setLubrificacoes([]);
    setTicketsJazida([]);
    setListasPresenca([]);
    setOrdensServico([]);
    setGruposEquipe([]);
    setPresencasLink([]);
    setHistoricoPresencas([]);
    setApontamentoRamos([]);
    setApontamentoRamoRegistros([]);
    setMateriaisCadastro([]);
    setMateriaisRegistros([]);
    setPartesDiariasEquipamentos([]);
    setControleEquipamentosDiario([]);
    setControleEstacas({ lotes: [], cravacoes: [] });
    setPeriodosArquivados([]);
    setNotifications([]);
    setHistoryLogs([]);
  };

  const handleApplySelectiveReset = (
    scopeKeys: string[],
    mode: 'clear' | 'default'
  ): { success: boolean; message: string } => {
    const uniqueScopes = Array.from(new Set(scopeKeys)).filter(Boolean);
    if (uniqueScopes.length === 0) {
      return { success: false, message: 'Selecione ao menos uma aba ou grupo de dados para excluir.' };
    }

    const labels: Record<string, string> = {
      empresas: 'Empresas',
      obras: 'Obras/Locais',
      equipamentos: 'Equipamentos',
      funcionarios: 'Funcionários',
      motoristasOperacionais: 'Motoristas operacionais',
      comboios: 'Comboios',
      combustiveis: 'Tipos de combustível',
      lubrificantes: 'Lubrificantes/Etapas',
      etapas: 'Etapas de serviço',
      abastecimentos: 'Abastecimentos',
      lubrificacoes: 'Lubrificações',
      presenca: 'Presença',
      apontamentoRamos: 'Apontamento Ramos',
      ticketsJazida: 'Tickets Jazida',
      materiais: 'Materiais',
      estacas: 'Estacas',
      partesDiarias: 'Partes Diárias',
      controleEquipamentos: 'Controle de basculantes',
      manutencao: 'Manutenção',
      periodosArquivados: 'Arquivos de períodos',
    };

    const nextValue = <T,>(defaultValue: T[]): T[] => (mode === 'default' ? defaultValue : []);
    const persist = <T,>(key: string, value: T[], setter: (items: T[]) => void) => {
      setter(value);
      writeStorageValue(localStorage, key, JSON.stringify(value));
    };

    try {
      writeStorageValue(localStorage, STORAGE_KEYS.lastDeletionRecovery, JSON.stringify({
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        scopes: uniqueScopes,
        labels: uniqueScopes.map(key => labels[key] || key),
        backup: JSON.parse(handleExportFullData()),
      }));
    } catch {
      return {
        success: false,
        message: 'A exclusão foi cancelada porque não foi possível criar o backup automático de recuperação.',
      };
    }

    saveAndLog(
      'Banco de Dados',
      mode === 'clear' ? 'Excluiu' : 'Editou',
      `${mode === 'clear' ? 'Zerou' : 'Restaurou para o padrão'} os dados selecionados: ${uniqueScopes.map(key => labels[key] || key).join(', ')}.`,
      historyLogs,
      () => {
        uniqueScopes.forEach(scope => {
          switch (scope) {
            case 'empresas':
              persist('renea_empresas', nextValue(INITIAL_EMPRESAS), setEmpresas);
              break;
            case 'obras':
              persist('renea_obras', nextValue(INITIAL_OBRAS), setObras);
              break;
            case 'equipamentos':
              persist('renea_equipamentos', nextValue(INITIAL_EQUIPAMENTOS), setEquipamentos);
              persist('renea_vinculos_operador_equipamento', [], setVinculosOperadorEquipamento);
              break;
            case 'funcionarios':
              persist('renea_funcionarios', nextValue(INITIAL_FUNCIONARIOS), setFuncionarios);
              break;
            case 'motoristasOperacionais':
              persist(STORAGE_KEYS.motoristasOperacionais, nextValue([...OPERATIONAL_DRIVERS]), setMotoristasOperacionais);
              break;
            case 'comboios':
              persist('renea_comboios', nextValue(INITIAL_COMBOIOS), setComboios);
              break;
            case 'combustiveis':
              persist('renea_combustiveis', nextValue(INITIAL_TIPOS_COMBUSTIVEL), setCombustiveis);
              break;
            case 'lubrificantes':
              persist('renea_lubrificantes', nextValue(INITIAL_PRODUTOS_LUBRIFICACAO), setLubrificantes);
              break;
            case 'etapas':
              persist('renea_etapas', nextValue(INITIAL_ETAPAS_SERVICO), setEtapas);
              break;
            case 'abastecimentos':
              persist('renea_abastecimentos', nextValue(INITIAL_ABASTECIMENTOS), setAbastecimentos);
              break;
            case 'lubrificacoes':
              persist('renea_lubrificacoes', nextValue(INITIAL_LUBRIFICACOES), setLubrificacoes);
              break;
            case 'presenca':
              persist('renea_listas_presenca', nextValue(INITIAL_PRESENCAS), setListasPresenca);
              persist('renea_grupos_equipes', nextValue(INITIAL_GRUPOS_EQUIPES), setGruposEquipe);
              persist('renea_presencas_link', nextValue(INITIAL_PRESENCAS_LINK), setPresencasLink);
              persist('renea_historico_presencas', nextValue(INITIAL_HISTORICO_PRESENCAS), setHistoricoPresencas);
              break;
            case 'apontamentoRamos':
              persist('renea_apontamento_ramos', nextValue(INITIAL_APONTAMENTO_RAMOS), setApontamentoRamos);
              persist('renea_apontamento_ramo_registros', nextValue(INITIAL_APONTAMENTO_RAMO_REGISTROS), setApontamentoRamoRegistros);
              break;
            case 'ticketsJazida':
              persist('renea_tickets_jazida', nextValue(INITIAL_TICKETS_JAZIDA), setTicketsJazida);
              break;
            case 'materiais':
              persist('renea_materiais_cadastro', nextValue(INITIAL_MATERIAIS_CADASTRO), setMateriaisCadastro);
              persist('renea_materiais_registros', nextValue(INITIAL_MATERIAIS_REGISTROS), setMateriaisRegistros);
              break;
            case 'estacas': {
              const next = mode === 'default' ? INITIAL_CONTROLE_ESTACAS : { lotes: [], cravacoes: [] };
              setControleEstacas(next);
              writeStorageValue(localStorage, 'renea_controle_estacas', JSON.stringify(next));
              break;
            }
            case 'partesDiarias':
              persist('renea_partes_diarias_equipamentos', nextValue(INITIAL_PARTES_DIARIAS_EQUIPAMENTOS), setPartesDiariasEquipamentos);
              break;
            case 'controleEquipamentos':
              persist('renea_controle_equipamentos_diario', nextValue(INITIAL_CONTROLE_EQUIPAMENTOS_DIARIO), setControleEquipamentosDiario);
              break;
            case 'manutencao':
              persist('renea_ordens_servico', nextValue(INITIAL_ORDENS_SERVICO), setOrdensServico);
              break;
            case 'periodosArquivados':
              persist('renea_periodos_arquivados', [], setPeriodosArquivados);
              break;
            default:
              break;
          }
        });
        writeStorageValue(localStorage, 'renea_colaboradores_planilha_v1', 'true');
        writeStorageValue(localStorage, 'renea_planilhas_operacionais_v2', 'true');
        writeStorageValue(localStorage, 'renea_materiais_planilha_v1', 'true');
      }
    );

    return {
      success: true,
      message: `${mode === 'clear' ? 'Dados zerados' : 'Padrões restaurados'} para: ${uniqueScopes.map(key => labels[key] || key).join(', ')}.`,
    };
  };

  const handleDeleteTabData = (tabId: string): { success: boolean; message: string } => {
    const scopesByTab: Record<string, string[]> = {
      cadastros: ['empresas', 'obras', 'equipamentos', 'funcionarios', 'motoristasOperacionais', 'comboios', 'combustiveis', 'lubrificantes', 'etapas'],
      lancamentos: ['abastecimentos', 'lubrificacoes'],
      'controle-equipamentos': ['controleEquipamentos'],
      'tickets-jazida': ['ticketsJazida'],
      estacas: ['estacas'],
      materiais: ['materiais'],
      manutencao: ['manutencao'],
      presenca: ['presenca'],
      apontamentos: ['apontamentoRamos'],
      'periodos-arquivados': ['periodosArquivados'],
    };
    const scopes = scopesByTab[tabId];
    if (!scopes) return { success: false, message: 'A aba selecionada não possui um conjunto de dados excluível.' };
    return handleApplySelectiveReset(scopes, 'clear');
  };

  const isDateInRange = (date: string | undefined, start: string, end: string) => (
    Boolean(date) && (!start || String(date) >= start) && (!end || String(date) <= end)
  );

  const splitByArchivePeriod = <T,>(
    items: T[],
    getDate: (item: T) => string | undefined,
    start: string,
    end: string
  ) => {
    const selected: T[] = [];
    const remaining: T[] = [];
    items.forEach(item => {
      if (isDateInRange(getDate(item), start, end)) selected.push(item);
      else remaining.push(item);
    });
    return { selected, remaining };
  };

  const mergeByIdKeepingLatest = <T extends { id: string }>(current: T[], incoming: T[]) => {
    const map = new Map(current.map(item => [item.id, item]));
    incoming.forEach(item => map.set(item.id, item));
    return Array.from(map.values());
  };

  const persistArchivedOperationData = (data: PeriodoArquivado['dados']) => {
    const nextAbastecimentos = mergeByIdKeepingLatest(abastecimentos, data.abastecimentos);
    const nextLubrificacoes = mergeByIdKeepingLatest(lubrificacoes, data.lubrificacoes);
    const nextTicketsJazida = mergeByIdKeepingLatest(ticketsJazida, data.ticketsJazida);
    const nextListasPresenca = mergeByIdKeepingLatest(listasPresenca, data.listasPresenca);
    const nextOrdensServico = mergeByIdKeepingLatest(ordensServico, data.ordensServico);
    const nextPresencasLink = mergeByIdKeepingLatest(presencasLink, data.presencasLink);
    const nextHistoricoPresencas = mergeByIdKeepingLatest(historicoPresencas, data.historicoPresencas);
    const nextApontamentoRamoRegistros = mergeByIdKeepingLatest(apontamentoRamoRegistros, data.apontamentoRamoRegistros);
    const nextMateriaisRegistros = mergeByIdKeepingLatest(materiaisRegistros, data.materiaisRegistros);
    const nextPartesDiariasEquipamentos = mergeByIdKeepingLatest(partesDiariasEquipamentos, data.partesDiariasEquipamentos);
    const nextControleEquipamentosDiario = mergeByIdKeepingLatest(controleEquipamentosDiario, data.controleEquipamentosDiario || []);
    const nextControleEstacas: ControleEstacas = data.estacas
      ? {
          lotes: mergeByIdKeepingLatest(controleEstacas.lotes, data.estacas.lotes),
          cravacoes: mergeByIdKeepingLatest(controleEstacas.cravacoes, data.estacas.cravacoes),
        }
      : controleEstacas;

    commitStorageBatch(localStorage, [
      { key: 'renea_abastecimentos', value: JSON.stringify(nextAbastecimentos) },
      { key: 'renea_lubrificacoes', value: JSON.stringify(nextLubrificacoes) },
      { key: 'renea_tickets_jazida', value: JSON.stringify(nextTicketsJazida) },
      { key: 'renea_listas_presenca', value: JSON.stringify(nextListasPresenca) },
      { key: 'renea_ordens_servico', value: JSON.stringify(nextOrdensServico) },
      { key: 'renea_presencas_link', value: JSON.stringify(nextPresencasLink) },
      { key: 'renea_historico_presencas', value: JSON.stringify(nextHistoricoPresencas) },
      { key: 'renea_apontamento_ramo_registros', value: JSON.stringify(nextApontamentoRamoRegistros) },
      { key: 'renea_materiais_registros', value: JSON.stringify(nextMateriaisRegistros) },
      { key: 'renea_partes_diarias_equipamentos', value: JSON.stringify(nextPartesDiariasEquipamentos) },
      { key: 'renea_controle_equipamentos_diario', value: JSON.stringify(nextControleEquipamentosDiario) },
      { key: 'renea_controle_estacas', value: JSON.stringify(nextControleEstacas) },
    ]);

    setAbastecimentos(nextAbastecimentos);
    setLubrificacoes(nextLubrificacoes);
    setTicketsJazida(nextTicketsJazida);
    setListasPresenca(nextListasPresenca);
    setOrdensServico(nextOrdensServico);
    setPresencasLink(nextPresencasLink);
    setHistoricoPresencas(nextHistoricoPresencas);
    setApontamentoRamoRegistros(nextApontamentoRamoRegistros);
    setMateriaisRegistros(nextMateriaisRegistros);
    setPartesDiariasEquipamentos(nextPartesDiariasEquipamentos);
    setControleEquipamentosDiario(nextControleEquipamentosDiario);
    setControleEstacas(nextControleEstacas);
  };

  const handleArchivePeriod = (
    dataInicio: string,
    dataFim: string,
    nome?: string
  ): { success: boolean; message: string } => {
    if (!dataInicio || !dataFim) {
      return { success: false, message: 'Informe data inicial e data final para arquivar o período.' };
    }
    if (dataInicio > dataFim) {
      return { success: false, message: 'A data inicial não pode ser maior que a data final.' };
    }

    const splitAbastecimentos = splitByArchivePeriod<Abastecimento>(abastecimentos, item => item.data, dataInicio, dataFim);
    const splitLubrificacoes = splitByArchivePeriod<Lubrificacao>(lubrificacoes, item => item.data, dataInicio, dataFim);
    const splitTicketsJazida = splitByArchivePeriod<TicketJazida>(ticketsJazida, item => item.data, dataInicio, dataFim);
    const splitListasPresenca = splitByArchivePeriod<ListaPresenca>(listasPresenca, item => item.data, dataInicio, dataFim);
    const splitOrdensServico = splitByArchivePeriod<OrdemServico>(ordensServico, item => item.dataAbertura, dataInicio, dataFim);
    const splitPresencasLink = splitByArchivePeriod<PresencaApontamento>(presencasLink, item => item.data, dataInicio, dataFim);
    const splitHistoricoPresencas = splitByArchivePeriod<HistoricoPresenca>(historicoPresencas, item => item.data, dataInicio, dataFim);
    const splitApontamentoRamoRegistros = splitByArchivePeriod<ApontamentoRamoRegistro>(apontamentoRamoRegistros, item => item.data, dataInicio, dataFim);
    const splitMateriaisRegistros = splitByArchivePeriod<MaterialRegistro>(materiaisRegistros, item => item.data, dataInicio, dataFim);
    const splitPartesDiariasEquipamentos = splitByArchivePeriod<ParteDiariaEquipamento>(partesDiariasEquipamentos, item => item.data, dataInicio, dataFim);
    const splitControleEquipamentosDiario = splitByArchivePeriod<ControleEquipamentoDiario>(controleEquipamentosDiario, item => item.data, dataInicio, dataFim);
    const splitEstacasLotes = splitByArchivePeriod<ControleEstacas['lotes'][number]>(controleEstacas.lotes, item => item.data, dataInicio, dataFim);
    const splitEstacasCravacoes = splitByArchivePeriod<ControleEstacas['cravacoes'][number]>(controleEstacas.cravacoes, item => item.data, dataInicio, dataFim);

    const dados: PeriodoArquivado['dados'] = {
      abastecimentos: splitAbastecimentos.selected,
      lubrificacoes: splitLubrificacoes.selected,
      ticketsJazida: splitTicketsJazida.selected,
      listasPresenca: splitListasPresenca.selected,
      ordensServico: splitOrdensServico.selected,
      presencasLink: splitPresencasLink.selected,
      historicoPresencas: splitHistoricoPresencas.selected,
      apontamentoRamoRegistros: splitApontamentoRamoRegistros.selected,
      materiaisRegistros: splitMateriaisRegistros.selected,
      partesDiariasEquipamentos: splitPartesDiariasEquipamentos.selected,
      controleEquipamentosDiario: splitControleEquipamentosDiario.selected,
      estacas: {
        lotes: splitEstacasLotes.selected,
        cravacoes: splitEstacasCravacoes.selected,
      },
    };

    const resumo: Record<string, number> = Object.fromEntries(
      Object.entries(dados).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.length : value.lotes.length + value.cravacoes.length,
      ])
    );
    const total = Object.values(resumo).reduce((sum, value) => sum + Number(value || 0), 0);
    if (total === 0) {
      return { success: false, message: 'Nenhum lançamento datado foi encontrado nesse período.' };
    }

    const archive: PeriodoArquivado = {
      id: `periodo-${Date.now()}`,
      nome: nome?.trim() || `Fechamento ${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')}`,
      dataInicio,
      dataFim,
      criadoEm: new Date().toISOString(),
      criadoPor: activeUserName,
      versao: '3.0',
      status: 'Fechado',
      checksum: calculateSnapshotChecksum(dados),
      resumo,
      dados,
    };
    const nextArchives = [archive, ...periodosArquivados];

    saveAndLog(
      'Arquivo de Períodos',
      'Criou',
      `Arquivou ${total} registro(s) de ${dataInicio} a ${dataFim}. Os dados saíram da operação ativa e não entram no dashboard até serem puxados de volta.`,
      historyLogs,
      () => {
        commitStorageBatch(localStorage, [
          { key: 'renea_abastecimentos', value: JSON.stringify(splitAbastecimentos.remaining) },
          { key: 'renea_lubrificacoes', value: JSON.stringify(splitLubrificacoes.remaining) },
          { key: 'renea_tickets_jazida', value: JSON.stringify(splitTicketsJazida.remaining) },
          { key: 'renea_listas_presenca', value: JSON.stringify(splitListasPresenca.remaining) },
          { key: 'renea_ordens_servico', value: JSON.stringify(splitOrdensServico.remaining) },
          { key: 'renea_presencas_link', value: JSON.stringify(splitPresencasLink.remaining) },
          { key: 'renea_historico_presencas', value: JSON.stringify(splitHistoricoPresencas.remaining) },
          { key: 'renea_apontamento_ramo_registros', value: JSON.stringify(splitApontamentoRamoRegistros.remaining) },
          { key: 'renea_materiais_registros', value: JSON.stringify(splitMateriaisRegistros.remaining) },
          { key: 'renea_partes_diarias_equipamentos', value: JSON.stringify(splitPartesDiariasEquipamentos.remaining) },
          { key: 'renea_controle_equipamentos_diario', value: JSON.stringify(splitControleEquipamentosDiario.remaining) },
          { key: 'renea_controle_estacas', value: JSON.stringify({ lotes: splitEstacasLotes.remaining, cravacoes: splitEstacasCravacoes.remaining }) },
          { key: 'renea_periodos_arquivados', value: JSON.stringify(nextArchives) },
        ]);
        setAbastecimentos(splitAbastecimentos.remaining);
        setLubrificacoes(splitLubrificacoes.remaining);
        setTicketsJazida(splitTicketsJazida.remaining);
        setListasPresenca(splitListasPresenca.remaining);
        setOrdensServico(splitOrdensServico.remaining);
        setPresencasLink(splitPresencasLink.remaining);
        setHistoricoPresencas(splitHistoricoPresencas.remaining);
        setApontamentoRamoRegistros(splitApontamentoRamoRegistros.remaining);
        setMateriaisRegistros(splitMateriaisRegistros.remaining);
        setPartesDiariasEquipamentos(splitPartesDiariasEquipamentos.remaining);
        setControleEquipamentosDiario(splitControleEquipamentosDiario.remaining);
        setControleEstacas({ lotes: splitEstacasLotes.remaining, cravacoes: splitEstacasCravacoes.remaining });
        setPeriodosArquivados(nextArchives);
      }
    );

    return { success: true, message: `Período arquivado com ${total} registro(s). O dashboard ficou limpo para o próximo lançamento.` };
  };

  const handleRestoreArchivedPeriod = (id: string): { success: boolean; message: string } => {
    const archive = periodosArquivados.find(item => item.id === id);
    if (!archive) return { success: false, message: 'Arquivo de período não encontrado.' };
    if (!isSnapshotIntact(archive)) {
      return { success: false, message: 'O snapshot foi alterado após o fechamento e precisa de revisão antes da restauração.' };
    }
    const total = (Object.values(archive.resumo || {}) as number[]).reduce((sum, value) => sum + Number(value || 0), 0);

    saveAndLog(
      'Arquivo de Períodos',
      'Criou',
      `Puxou ${total} registro(s) do arquivo "${archive.nome}" para a operação ativa. O arquivo continua guardado.`,
      historyLogs,
      () => persistArchivedOperationData(archive.dados)
    );

    return { success: true, message: `Período "${archive.nome}" puxado para a operação ativa. Ele continua salvo no arquivo.` };
  };

  const handleDeleteArchivedPeriod = (id: string): { success: boolean; message: string } => {
    const archive = periodosArquivados.find(item => item.id === id);
    if (!archive) return { success: false, message: 'Arquivo de período não encontrado.' };
    const nextArchives = periodosArquivados.filter(item => item.id !== id);

    saveAndLog(
      'Arquivo de Períodos',
      'Excluiu',
      `Excluiu permanentemente o arquivo de período "${archive.nome}".`,
      historyLogs,
      () => {
        setPeriodosArquivados(nextArchives);
        writeStorageValue(localStorage, 'renea_periodos_arquivados', JSON.stringify(nextArchives));
      }
    );

    return { success: true, message: `Arquivo "${archive.nome}" excluído.` };
  };

  const handleExportFullData = (): string => {
    return JSON.stringify({
      schemaVersion: 2,
      application: 'Sistema RENEA',
      exportedAt: new Date().toISOString(),
      empresas,
      obras,
      equipamentos,
      funcionarios,
      motoristasOperacionais,
      comboios,
      combustiveis,
      lubrificantes,
      etapas,
      abastecimentos,
      lubrificacoes,
      ticketsJazida,
      listasPresenca,
      ordensServico,
      gruposEquipe,
      presencasLink,
      historicoPresencas,
      apontamentoRamos,
      apontamentoRamoRegistros,
      materiaisCadastro,
      materiaisRegistros,
      partesDiariasEquipamentos,
      controleEquipamentosDiario,
      controleEstacas,
      periodosArquivados,
      masterDataReviewQueue: parseStoredJson<MasterWorkbookReviewRow[]>(
        localStorage.getItem('renea_master_data_review_queue'),
        'renea_master_data_review_queue',
        [],
      ),
      notifications,
      historyLogs
    }, null, 2);
  };


  const handleImportFullData = (importedJson: string): boolean => {
    try {
      const parsed = JSON.parse(importedJson);
      const validation = validateSystemBackup(parsed);
      if (!validation.valid) return false;
      handleImportData(parsed);
      return true;
    } catch (e) {
      return false;
    }
  };

  const handleRestoreLastDeletion = (): { success: boolean; message: string } => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.lastDeletionRecovery);
      if (!raw) return { success: false, message: 'Nenhum backup automático de exclusão foi encontrado neste dispositivo.' };
      const parsed = JSON.parse(raw) as { labels?: string[]; backup?: unknown };
      if (!parsed.backup || !handleImportFullData(JSON.stringify(parsed.backup))) {
        return { success: false, message: 'O último backup automático não passou na validação de integridade.' };
      }
      const label = Array.isArray(parsed.labels) && parsed.labels.length ? ` (${parsed.labels.join(', ')})` : '';
      return { success: true, message: `Dados anteriores à última exclusão restaurados com sucesso${label}.` };
    } catch {
      return { success: false, message: 'Não foi possível ler o último backup automático de exclusão.' };
    }
  };

  // Importação seletiva: o usuário escolhe exatamente o período (data início/fim)
  // que deseja importar do arquivo de backup. Registros com data (abastecimentos,
  // lubrificações e listas de presença fora do intervalo são ignoradas.
  // Cadastros sem data (empresas, equipamentos, funcionários, etc.) são mesclados
  // por ID, sem apagar o que já existe no sistema.
  const handleImportFilteredByDate = (
    importedJson: string,
    dataInicio: string,
    dataFim: string
  ): { success: boolean; message: string } => {
    try {
      const parsed = JSON.parse(importedJson);
      const validation = validateSystemBackup(parsed, false);
      if (!validation.valid) return { success: false, message: describeInvalidBackup(validation) };

      const inRange = (data: string) => (!dataInicio || data >= dataInicio) && (!dataFim || data <= dataFim);

      const mergeById = <T extends { id: string }>(current: T[], incoming: T[] | undefined): T[] => {
        if (!incoming || incoming.length === 0) return current;
        const map = new Map(current.map(item => [item.id, item]));
        incoming.forEach(item => map.set(item.id, item));
        return Array.from(map.values());
      };

      // Cadastros base mesclados por ID (não são datados, então são sempre importados)
      const newEmpresas = mergeById(empresas, parsed.empresas);
      const newObras = mergeById(obras, parsed.obras);
      const newEquipamentos = mergeById(equipamentos, parsed.equipamentos);
      const newFuncionarios = mergeById(funcionarios, parsed.funcionarios);
      const newComboios = mergeById(comboios, parsed.comboios);
      const newCombustiveis = mergeById(combustiveis, parsed.combustiveis);
      const newLubrificantes = mergeById(lubrificantes, parsed.lubrificantes);
      const newEtapas = mergeById(etapas, parsed.etapas);
      const newGruposEquipe = mergeById(gruposEquipe, parsed.gruposEquipe);
      const newHistoricoPresencas = mergeById(historicoPresencas, parsed.historicoPresencas);
      const newApontamentoRamos = mergeById(apontamentoRamos, parsed.apontamentoRamos);
      const newMateriaisCadastro = mergeById(materiaisCadastro, parsed.materiaisCadastro);
      const currentMasterReviewQueue = parseStoredJson<MasterWorkbookReviewRow[]>(
        localStorage.getItem('renea_master_data_review_queue'),
        'renea_master_data_review_queue',
        [],
      );
      const reviewQueueIndex = new Map(currentMasterReviewQueue.map(row => [
        `${row.entity}|${row.sheetName}|${row.rowNumber}|${row.canonicalKey}`,
        row,
      ]));
      (Array.isArray(parsed.masterDataReviewQueue) ? parsed.masterDataReviewQueue : []).forEach(
        (row: MasterWorkbookReviewRow) => {
          reviewQueueIndex.set(
            `${row.entity}|${row.sheetName}|${row.rowNumber}|${row.canonicalKey}`,
            row,
          );
        },
      );
      const newMasterDataReviewQueue = Array.from(reviewQueueIndex.values());

      // Registros datados: só entram os que caem dentro do período escolhido
      const incomingAbastecimentos = (parsed.abastecimentos || []).filter((x: Abastecimento) => inRange(x.data));
      const incomingLubrificacoes = (parsed.lubrificacoes || []).filter((x: Lubrificacao) => inRange(x.data));
      const incomingPresencas = (parsed.listasPresenca || []).filter((x: ListaPresenca) => inRange(x.data));
      const incomingOrdensServico = (parsed.ordensServico || []).filter((x: OrdemServico) => inRange(x.dataAbertura));
      const incomingPresencasLink = (parsed.presencasLink || []).filter((x: PresencaApontamento) => inRange(x.data));
      const incomingApontamentoRamoRegistros = (parsed.apontamentoRamoRegistros || []).filter((x: ApontamentoRamoRegistro) => inRange(x.data));
      const incomingTicketsJazida = (parsed.ticketsJazida || []).filter((x: TicketJazida) => inRange(x.data));
      const incomingMateriaisRegistros = (parsed.materiaisRegistros || []).filter((x: MaterialRegistro) => inRange(x.data));
      const incomingPartesDiariasEquipamentos = (parsed.partesDiariasEquipamentos || []).filter((x: ParteDiariaEquipamento) => inRange(x.data));
      const incomingControleEquipamentosDiario = (parsed.controleEquipamentosDiario || []).filter((x: ControleEquipamentoDiario) => inRange(x.data));
      const incomingEstacasLotes = (parsed.controleEstacas?.lotes || []).filter((x: ControleEstacas['lotes'][number]) => inRange(x.data));
      const incomingEstacasCravacoes = (parsed.controleEstacas?.cravacoes || []).filter((x: ControleEstacas['cravacoes'][number]) => inRange(x.data));

      const newAbastecimentos = mergeById(abastecimentos, incomingAbastecimentos);
      const newLubrificacoes = mergeById(lubrificacoes, incomingLubrificacoes);
      const newListasPresenca = mergeById(listasPresenca, incomingPresencas);
      const newOrdensServico = mergeById(ordensServico, incomingOrdensServico);
      const newPresencasLink = mergeById(presencasLink, incomingPresencasLink);
      const newApontamentoRamoRegistros = mergeById(apontamentoRamoRegistros, incomingApontamentoRamoRegistros);
      const newTicketsJazida = mergeById(ticketsJazida, incomingTicketsJazida);
      const newMateriaisRegistros = mergeById(materiaisRegistros, incomingMateriaisRegistros);
      const newPartesDiariasEquipamentos = mergeById(partesDiariasEquipamentos, incomingPartesDiariasEquipamentos);
      const newControleEquipamentosDiario = mergeById(controleEquipamentosDiario, incomingControleEquipamentosDiario);
      const newControleEstacas: ControleEstacas = {
        lotes: mergeById(controleEstacas.lotes, incomingEstacasLotes),
        cravacoes: mergeById(controleEstacas.cravacoes, incomingEstacasCravacoes),
      };

      const totalImportados = incomingAbastecimentos.length + incomingLubrificacoes.length + incomingPresencas.length + incomingOrdensServico.length + incomingPresencasLink.length + incomingApontamentoRamoRegistros.length + incomingTicketsJazida.length + incomingMateriaisRegistros.length + incomingPartesDiariasEquipamentos.length + incomingControleEquipamentosDiario.length + incomingEstacasLotes.length + incomingEstacasCravacoes.length;
      const logMsg = `Importou seletivamente ${totalImportados} registro(s) datado(s) entre ${dataInicio || 'início'} e ${dataFim || 'fim'}, além dos cadastros base.`;
      const newLog: HistoryLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleString('pt-BR'),
        usuario: activeUserName,
        acao: 'Criou',
        tela: 'Banco de Dados',
        descricao: logMsg
      };
      const updatedHistory = [newLog, ...historyLogs];

      commitStorageBatch(localStorage, [
        { key: 'renea_empresas', value: JSON.stringify(newEmpresas) },
        { key: 'renea_obras', value: JSON.stringify(newObras) },
        { key: 'renea_equipamentos', value: JSON.stringify(newEquipamentos) },
        { key: 'renea_funcionarios', value: JSON.stringify(newFuncionarios) },
        { key: 'renea_comboios', value: JSON.stringify(newComboios) },
        { key: 'renea_combustiveis', value: JSON.stringify(newCombustiveis) },
        { key: 'renea_lubrificantes', value: JSON.stringify(newLubrificantes) },
        { key: 'renea_etapas', value: JSON.stringify(newEtapas) },
        { key: 'renea_abastecimentos', value: JSON.stringify(newAbastecimentos) },
        { key: 'renea_lubrificacoes', value: JSON.stringify(newLubrificacoes) },
        { key: 'renea_tickets_jazida', value: JSON.stringify(newTicketsJazida) },
        { key: 'renea_listas_presenca', value: JSON.stringify(newListasPresenca) },
        { key: 'renea_ordens_servico', value: JSON.stringify(newOrdensServico) },
        { key: 'renea_grupos_equipes', value: JSON.stringify(newGruposEquipe) },
        { key: 'renea_presencas_link', value: JSON.stringify(newPresencasLink) },
        { key: 'renea_historico_presencas', value: JSON.stringify(newHistoricoPresencas) },
        { key: 'renea_apontamento_ramos', value: JSON.stringify(newApontamentoRamos) },
        { key: 'renea_apontamento_ramo_registros', value: JSON.stringify(newApontamentoRamoRegistros) },
        { key: 'renea_materiais_cadastro', value: JSON.stringify(newMateriaisCadastro) },
        { key: 'renea_materiais_registros', value: JSON.stringify(newMateriaisRegistros) },
        { key: 'renea_partes_diarias_equipamentos', value: JSON.stringify(newPartesDiariasEquipamentos) },
        { key: 'renea_controle_equipamentos_diario', value: JSON.stringify(newControleEquipamentosDiario) },
        { key: 'renea_controle_estacas', value: JSON.stringify(newControleEstacas) },
        { key: 'renea_master_data_review_queue', value: JSON.stringify(newMasterDataReviewQueue) },
      { key: 'renea_history_logs', value: JSON.stringify([]) },
      ]);

      setEmpresas(newEmpresas);
      setObras(newObras);
      setEquipamentos(newEquipamentos);
      setFuncionarios(newFuncionarios);
      setComboios(newComboios);
      setCombustiveis(newCombustiveis);
      setLubrificantes(newLubrificantes);
      setEtapas(newEtapas);
      setAbastecimentos(newAbastecimentos);
      setLubrificacoes(newLubrificacoes);
      setTicketsJazida(newTicketsJazida);
      setListasPresenca(newListasPresenca);
      setOrdensServico(newOrdensServico);
      setGruposEquipe(newGruposEquipe);
      setPresencasLink(newPresencasLink);
      setHistoricoPresencas(newHistoricoPresencas);
      setApontamentoRamos(newApontamentoRamos);
      setApontamentoRamoRegistros(newApontamentoRamoRegistros);
      setMateriaisCadastro(newMateriaisCadastro);
      setMateriaisRegistros(newMateriaisRegistros);
      setPartesDiariasEquipamentos(newPartesDiariasEquipamentos);
      setControleEquipamentosDiario(newControleEquipamentosDiario);
      setControleEstacas(newControleEstacas);
    setHistoryLogs([]);

      addNotification('Importação por Período Concluída', logMsg, 'success', 'Sistema Local');

      return { success: true, message: `Importação concluída! ${totalImportados} registro(s) do período selecionado foram adicionados/atualizados.` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Falha ao ler ou processar o arquivo de backup.',
      };
    }
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
          onSelectDate={data => void reloadExternalPresence(data)}
          isLoadingCloud={isExternalPresenceLoading}
          loadError={externalPresenceLoadError}
          onRetry={() => void reloadExternalPresence()}
          onSubmitPresenca={handleSubmitPresencaLink}
          onUpdateRecord={handleUpdateExternalPresencaRecord}
          onAddMember={handleAddExternalPresencaMember}
          onSaveDayNote={handleSaveExternalDayNote}
        />
      </Suspense>
    );
  }

  if (externalApontamentoToken) {
    return (
      <Suspense fallback={<ScreenLoadingFallback label="Abrindo apontamento..." />}>
        <ApontamentoRamoLinkExterno
          token={externalApontamentoToken}
          ramos={apontamentoRamos}
          registros={apontamentoRamoRegistros}
          isLoadingCloud={isExternalApontamentoLoading}
          onSubmitApontamento={handleSubmitApontamentoRamoLink}
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
  const filteredNavigationGroups = NAVIGATION_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(item => allowedTabs.includes(item.id)
        && (!normalizedMenuSearch || item.label.toLocaleLowerCase('pt-BR').includes(normalizedMenuSearch))),
    }))
    .filter(group => group.items.length > 0);

  const navigateTo = (tab: string, closeMobile = false) => {
    setActiveTab(allowedTabs.includes(tab) ? tab : 'dashboard');
    if (closeMobile) setIsMobileMenuOpen(false);
    window.requestAnimationFrame(() => {
      document.getElementById('main-workspace')?.scrollTo({ top: 0, behavior: 'auto' });
    });
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

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigateTo('cadastros', true)}
            title="Abrir cadastros auxiliares"
            aria-label="Abrir cadastros auxiliares"
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${activeTab === 'cadastros' ? 'bg-emerald-700 border-emerald-700 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200'}`}
          >
            <FolderPlus className="w-5 h-5" />
          </button>

          {/* Notification Bell Mobile */}
          <div className="relative">
            <button 
              onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)}
              className="relative cursor-pointer rounded-xl p-2.5 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"
            >
              {notifications.filter(n => !n.read).length > 0 ? (
                <>
                  <BellRing className="w-5 h-5 text-emerald-400 animate-bounce" />
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-emerald-500 text-white font-extrabold text-[8px] rounded-full flex items-center justify-center">
                    {notifications.filter(n => !n.read).length}
                  </span>
                </>
              ) : (
                <Bell className="w-5 h-5" />
              )}
            </button>
          </div>

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
          <div className="w-80 max-w-[88vw] bg-slate-900 border-l border-slate-800 p-5 flex flex-col space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-semibold text-slate-500 tracking-[0.14em]">NAVEGAÇÃO</span>
              <button onClick={() => setIsMobileMenuOpen(false)} className="cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto">
              {renderNavigation(true)}
              <div className="pt-5 mt-5 border-t border-slate-800">
                <button type="button" onClick={() => { void handleLogout(); setIsMobileMenuOpen(false); }} className="w-full py-3 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl font-semibold text-xs flex items-center justify-center gap-2">
                  <LogOut className="w-4 h-4" /> Sair da conta
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* Desktop ERP shell: the sidebar is the single source of navigation. */}
      <div className="erp-shell">
        <DesktopSidebar
          activeTab={activeTab}
          groups={filteredNavigationGroups}
          menuSearch={menuSearch}
          onMenuSearchChange={setMenuSearch}
          onNavigate={tab => navigateTo(tab)}
          onLogout={() => void handleLogout()}
        />
        <main className="erp-workspace" id="main-workspace">
        <DesktopTopBar
          activeTab={activeTab}
          currentUser={currentUser}
          isNotificationOpen={isNotifDropdownOpen}
          notifications={notifications}
          unreadCount={unreadCount}
          onNavigate={tab => navigateTo(tab)}
          onToggleNotifications={() => setIsNotifDropdownOpen(value => !value)}
          onCloseNotifications={() => setIsNotifDropdownOpen(false)}
          onMarkAllNotificationsAsRead={handleMarkAllAsRead}
          onClearNotifications={handleClearNotifications}
          onMarkNotificationAsRead={handleMarkNotificationAsRead}
        />
        {/* Dynamic Inner Tab Viewport */}
        <div id="main-tab-viewport" className={`flex-1 overflow-x-hidden w-full mx-auto print:p-0 print:m-0 ${activeTab === 'dashboard' ? 'dashboard-viewport' : 'p-3.5 sm:p-4 md:p-7 2xl:p-10 max-w-[1440px]'}`}>
          <Suspense fallback={<ScreenLoadingFallback />}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full h-full"
            >
            {activeTab === 'dashboard' && (
              <Dashboard 
                empresas={empresas}
                obras={obras}
                equipamentos={equipamentos}
                funcionarios={funcionarios}
                comboios={comboios}
                combustiveis={combustiveis}
                lubrificantes={lubrificantes}
                abastecimentos={abastecimentos}
                lubrificacoes={lubrificacoes}
                historyLogs={historyLogs}
                listasPresenca={listasPresenca}
                ordensServico={ordensServico}
                ticketsJazida={ticketsJazida}
                estacas={controleEstacas}
                presencasLink={presencasLink}
                apontamentoRamos={apontamentoRamos}
                apontamentoRamoRegistros={apontamentoRamoRegistros}
                materiaisRegistros={materiaisRegistros}
                partesDiariasEquipamentos={partesDiariasEquipamentos}
                onNavigate={navigateTo}
              />
            )}

            {activeTab === 'consulta-geral' && (
              <ConsultaGeralTab
                empresas={empresas}
                obras={obras}
                equipamentos={equipamentos}
                funcionarios={funcionarios}
                abastecimentos={abastecimentos}
                tickets={ticketsJazida}
                materiais={materiaisRegistros}
                ordensServico={ordensServico}
                partesDiarias={partesDiariasEquipamentos}
                controlesEquipamentos={controleEquipamentosDiario}
                gruposEquipe={gruposEquipe}
                presencas={presencasLink}
                apontamentos={apontamentoRamoRegistros}
                vinculos={vinculosOperadorEquipamento}
                onLink={handleVincularOperadorEquipamento}
                onUnlink={handleEncerrarVinculoOperadorEquipamento}
                onNavigate={navigateTo}
              />
            )}

            {activeTab === 'usuarios' && allowedTabs.includes('usuarios') && (
              <UsuariosTab />
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
                etapas={etapas}
                materiaisCadastro={materiaisCadastro}
                materiaisRegistros={materiaisRegistros}
                apontamentoRamos={apontamentoRamos}
                ordensServico={ordensServico}
                partesDiariasEquipamentos={partesDiariasEquipamentos}
                onSaveEmpresa={handleSaveEmpresa}
                onDeleteEmpresa={handleDeleteEmpresa}
                onSaveObra={handleSaveObra}
                onDeleteObra={handleDeleteObra}
                onSaveEquipamento={handleSaveEquipamento}
                onDeleteEquipamento={handleDeleteEquipamento}
                onSaveFuncionario={handleSaveFuncionario}
                onDeleteFuncionario={handleDeleteFuncionario}
                onSaveComboio={handleSaveComboio}
                onDeleteComboio={handleDeleteComboio}
                onSaveTipoCombustivel={handleSaveTipoCombustivel}
                onDeleteTipoCombustivel={handleDeleteTipoCombustivel}
                onSaveProdutoLubrificacao={handleSaveProdutoLubrificacao}
                onDeleteProdutoLubrificacao={handleDeleteProdutoLubrificacao}
                onSaveEtapaServico={handleSaveEtapaServico}
                onDeleteEtapaServico={handleDeleteEtapaServico}
                onImportCadastros={handleImportCadastros}
                onApplyMasterWorkbook={handleApplyMasterWorkbook}
                onSyncCentralRegistry={uploadLocalSnapshotToFirebase}
              />
            )}

            {activeTab === 'lancamentos' && (
              <LancamentosTab 
                empresas={empresas}
                equipamentos={equipamentos}
                comboios={comboios}
                combustiveis={combustiveis}
                lubrificantes={lubrificantes}
                abastecimentos={abastecimentos}
                lubrificacoes={lubrificacoes}
                onSaveAbastecimento={handleSaveAbastecimento}
                onDeleteAbastecimento={handleDeleteAbastecimento}
                onDeleteAbastecimentos={handleDeleteAbastecimentos}
                onImportAbastecimentos={handleImportAbastecimentos}
                onSaveLubrificacao={handleSaveLubrificacao}
                onDeleteLubrificacao={handleDeleteLubrificacao}
                onOpenCadastros={allowedTabs.includes('cadastros') ? () => navigateTo('cadastros') : undefined}
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
                onDeleteMany={handleDeleteControleEquipamentosDiario}
                onOpenEmployeeRegistration={() => navigateTo('cadastros')}
                onOpenEquipmentRegistration={() => navigateTo('cadastros')}
                onSaveOperationalDriver={handleSaveOperationalDriver}
                onDeleteOperationalDriver={handleDeleteOperationalDriver}
                canApproveFleet={['admin', 'gestor'].includes(currentUserRole)}
                onApproveFleetRecord={handleApproveControleEquipamentoDiario}
              />
            )}

            {activeTab === 'presenca' && (
              <ControlePresencaTab
                funcionarios={funcionarios}
                empresas={empresas}
                obras={obras}
                gruposEquipe={gruposEquipe}
                presencasLink={presencasLink}
                historicoPresencas={historicoPresencas}
                onSaveGrupoEquipe={handleSaveGrupoEquipe}
                onDeleteGrupoEquipe={handleDeleteGrupoEquipe}
                onUpdatePresencaLink={handleUpdatePresencaLink}
                onDeletePresencaLink={handleDeletePresencaLink}
                onSyncEquipesPlanilha={handleSyncEquipesPlanilha}
              />
            )}

            {activeTab === 'apontamentos' && (
              <ApontamentoRamosTab
                ramos={apontamentoRamos}
                registros={apontamentoRamoRegistros}
                onSaveRamo={handleSaveApontamentoRamo}
                onDeleteRamo={handleDeleteApontamentoRamo}
                onSaveRegistro={handleSaveApontamentoRamoRegistro}
                onDeleteRegistro={handleDeleteApontamentoRamoRegistro}
              />
            )}


            {activeTab === 'tickets-jazida' && (
              <TicketsJazidaTab 
                tickets={ticketsJazida}
                equipamentos={equipamentos}
                materiais={materiaisCadastro}
                obras={obras}
                ramos={apontamentoRamos}
                onSaveTicket={handleSaveTicketJazida}
                onDeleteTicket={handleDeleteTicketJazida}
                onDeleteTickets={handleDeleteTicketsJazida}
                onImportTickets={handleImportTicketsJazida}
                onReserveTicketNumber={handleReserveTicketNumber}
                onReserveTicketNumbers={handleReserveTicketNumbers}
              />
            )}

            {activeTab === 'materiais' && (
              <MateriaisTab
                materiais={materiaisCadastro}
                registros={materiaisRegistros}
                onSaveMaterial={handleSaveMaterialCadastro}
                onDeleteMaterial={handleDeleteMaterialCadastro}
                onSaveRegistro={handleSaveMaterialRegistro}
                onDeleteRegistro={handleDeleteMaterialRegistro}
                onImportRegistros={handleImportMateriais}
              />
            )}

            {activeTab === 'estacas' && (
              <EstacasTab
                controle={controleEstacas}
                obras={obras}
                ramos={apontamentoRamos}
                onChange={handleChangeControleEstacas}
              />
            )}

            {activeTab === 'reports' && (
              <RelatoriosTab 
                empresas={empresas}
                obras={obras}
                equipamentos={equipamentos}
                funcionarios={funcionarios}
                comboios={comboios}
                combustiveis={combustiveis}
                lubrificantes={lubrificantes}
                abastecimentos={abastecimentos}
                lubrificacoes={lubrificacoes}
                listasPresenca={listasPresenca}
                apontamentoRamoRegistros={apontamentoRamoRegistros}
                ticketsJazida={ticketsJazida}
                controleEstacas={controleEstacas}
                materiaisRegistros={materiaisRegistros}
                presencasLink={presencasLink}
                partesDiariasEquipamentos={partesDiariasEquipamentos}
              />
            )}

            {activeTab === 'configuracoes' && allowedTabs.includes('configuracoes') && (
              <ConfiguracoesTab 
                historyLogs={historyLogs}
                onImportFullData={handleImportFullData}
                onImportFilteredByDate={handleImportFilteredByDate}
                onExportFullData={handleExportFullData}
                periodosArquivados={periodosArquivados}
                onArchivePeriod={handleArchivePeriod}
                onRestoreArchivedPeriod={handleRestoreArchivedPeriod}
                onDeleteTabData={handleDeleteTabData}
                onRestoreLastDeletion={handleRestoreLastDeletion}
              />
            )}
            </motion.div>
          </Suspense>
        </div>
        </main>
      </div>

      <OfflineStatusV29 />
      <ToastViewport toasts={activeToasts} />

    </div>
  );
}
