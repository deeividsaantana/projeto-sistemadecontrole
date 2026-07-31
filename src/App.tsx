/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useEffect } from 'react';
import { 
  Empresa, 
  ObraLocal, 
  Equipamento, 
  Funcionario, 
  Comboio, 
  TipoCombustivel, 
  ProdutoLubrificacao, 
  EtapaServico, 
  Abastecimento, 
  Lubrificacao, 
  RdoDiario,
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
  INITIAL_RDOS,
  INITIAL_HISTORY_LOGS,
  INITIAL_PRESENCAS,
  INITIAL_ORDENS_SERVICO,
  INITIAL_GRUPOS_EQUIPES,
  INITIAL_PRESENCAS_LINK,
  INITIAL_HISTORICO_PRESENCAS,
  INITIAL_APONTAMENTO_RAMOS,
  INITIAL_APONTAMENTO_RAMO_REGISTROS,
  INITIAL_TICKETS_JAZIDA,
  loadInitialMateriaisData,
  INITIAL_PARTES_DIARIAS_EQUIPAMENTOS
} from './utils/initialData';
import { INITIAL_CONTROLE_ESTACAS } from './utils/initialEstacasData';
import { calculateSnapshotChecksum, isSnapshotIntact } from './utils/snapshotIntegrity';
import { enqueueOfflineCommand, flushOfflineCommands } from './utils/offlineQueue';
import {
  inferFleetCategory,
  normalizeAvailabilityTarget,
} from './utils/equipmentOperations';

// Subcomponents Imports
const Dashboard = lazy(() => import('./components/Dashboard'));
const CadastrosTab = lazy(() => import('./components/CadastrosTab'));
const LancamentosTab = lazy(() => import('./components/LancamentosTab'));
const RelatoriosTab = lazy(() => import('./components/RelatoriosTab'));
const ConfiguracoesTab = lazy(() => import('./components/ConfiguracoesTab'));
const PresencaTab = lazy(() => import('./components/PresencaTab'));
const ManutencaoEquipamentosTab = lazy(() => import('./components/ManutencaoEquipamentosTab'));
const ControlePresencaTab = lazy(() => import('./components/ControlePresencaTab'));
const TicketsJazidaTab = lazy(() => import('./components/TicketsJazidaTab'));
const PresencaLinkExterno = lazy(() => import('./components/PresencaLinkExterno'));
const ApontamentoRamosTab = lazy(() => import('./components/ApontamentoRamosTab'));
const ApontamentoRamoLinkExterno = lazy(() => import('./components/ApontamentoRamoLinkExterno'));
const MateriaisTab = lazy(() => import('./components/MateriaisTab'));
const TicketLinkExterno = lazy(() => import('./components/TicketLinkExterno'));
const ParteDiariaEquipamentosTab = lazy(() => import('./components/ParteDiariaEquipamentosTab'));
const EstacasTab = lazy(() => import('./components/EstacasTab'));
const DocumentIntelligenceTab = lazy(() => import('./components/DocumentIntelligenceTab'));
import OfflineStatusV29 from './components/OfflineStatusV29';

// A base histórica de materiais fica em um chunk separado para não pesar no
// login e nas demais telas. Ela é carregada antes da hidratação dos dados.
let INITIAL_MATERIAIS_CADASTRO: MaterialCadastro[] = [];
let INITIAL_MATERIAIS_REGISTROS: MaterialRegistro[] = [];
// Motion and Logo Import
import { motion, AnimatePresence } from 'motion/react';
import reneaLogo from './assets/images/logo-renea-branco.svg';

// Firebase Imports
import { auth, db } from './firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import {
  downloadFirebaseBackup,
  formatFirebaseSyncError,
  getFirebaseConnectionStatus,
  uploadFirebaseBackup,
} from './firebaseCloudSync';
import {
  deletePublicTicket,
  loadPublicTickets,
  reservePublicTicketNumber,
  reservePublicTicketNumbers,
  savePublicTicket,
} from './firebaseTickets';
import {
  loadPendingPublicSubmissions,
  markPublicSubmissionsProcessed,
} from './firebasePublicSubmissions';
import {
  loadPublicApontamentoConfig,
  loadPublicPresenceConfig,
  reservePublicTicketNumberViaApi,
  savePublicTicketViaApi,
  searchPendingPublicTickets,
  submitPublicApontamento,
  submitPublicPresence,
  type PublicApontamentoPayload,
} from './publicApi';
import { loadOneDriveFuelPayload, type OneDriveFuelSyncStatus } from './oneDriveFuelSync';
import { materializeOneDriveFuelRows } from './utils/oneDriveFuelImport';
import { enrichFuelDataset } from './utils/fuelOperations';
import { commitStorageBatch, isReneaStoredValueValid, parseReneaStoredJson } from './utils/resilientStorage';
import { describeInvalidBackup, validateSystemBackup } from './utils/systemBackup';
import { recordTabUsage } from './usageTelemetry';
import {
  ALL_NAVIGATION_ITEMS,
  NAVIGATION_GROUPS,
  ROLE_ACCESS,
  normalizeUserRole,
  type UserRole,
} from './app/navigation/navigation';
import {
  getApontamentoTokenFromUrl,
  getPresenceTokenFromUrl,
  isTicketLinkUrl,
} from './app/routing/publicRoutes';
import { ScreenLoadingFallback } from './shared/components/feedback/ScreenLoadingFallback';

// Icons Import
import {
  Database,
  Menu,
  X,
  LogIn,
  LogOut,
  Eye,
  EyeOff,
  Search,
  ChevronRight,
  FolderPlus,
  ShieldCheck,
  Bell,
  BellRing,
  Wifi,
  CheckCheck,
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

import { AppNotification } from './types';

// Notificações reais começam vazias. Elas são preenchidas apenas por ações
// genuínas do usuário (cadastros, edições, sincronizações com o Firebase etc.)
const getInitialNotifications = (): AppNotification[] => [];

type CadastroImportTarget = 'empresas' | 'obras' | 'equipamentos' | 'funcionarios' | 'comboios' | 'combustiveis' | 'lubrificantes' | 'etapas';
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

const mergeImportedRecords = <T extends { id: string },>(
  current: T[],
  incoming: T[],
  getKey: (item: T) => string
) => {
  let created = 0;
  let updated = 0;
  const next = [...current];
  incoming.forEach(item => {
    const key = getKey(item);
    const index = key ? next.findIndex(existing => getKey(existing) === key) : -1;
    if (index >= 0) {
      next[index] = { ...item, id: next[index].id } as T;
      updated += 1;
    } else {
      next.push(item);
      created += 1;
    }
  });
  return { next, created, updated };
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

const parseStoredJson = <T,>(rawValue: string | null, storageKey: string, fallback: T): T => {
  if (!rawValue) return fallback;
  if (!isReneaStoredValueValid(storageKey, rawValue)) {
    console.error(`O dado local ${storageKey} está corrompido e foi preservado para recuperação.`);
    return fallback;
  }
  const parsed = parseReneaStoredJson<T | null>(rawValue, null);
  if (parsed !== null) return parsed;
  // A recuperação do IndexedDB já foi tentada antes da montagem do React. Se
  // não havia cópia íntegra, a tela continua disponível sem destruir o original.
  console.error(`O dado local ${storageKey} está corrompido e foi preservado para recuperação.`);
  return fallback;
};

const mergeRecordsById = <T extends { id: string }>(current: T[], incoming: T[]): T[] => {
  const indexed = new Map(current.map(item => [item.id, item]));
  incoming.forEach(item => indexed.set(item.id, item));
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
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState<boolean>(false);
  const [lastCloudSync, setLastCloudSync] = useState<string>('');
  const [oneDriveFuelSyncStatus, setOneDriveFuelSyncStatus] = useState<OneDriveFuelSyncStatus | null>(null);

  // Database States
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [obras, setObras] = useState<ObraLocal[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [comboios, setComboios] = useState<Comboio[]>([]);
  const [combustiveis, setCombustiveis] = useState<TipoCombustivel[]>([]);
  const [lubrificantes, setLubrificantes] = useState<ProdutoLubrificacao[]>([]);
  const [etapas, setEtapas] = useState<EtapaServico[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [lubrificacoes, setLubrificacoes] = useState<Lubrificacao[]>([]);
  const [ticketsJazida, setTicketsJazida] = useState<TicketJazida[]>([]);
  const [externalPublicTickets, setExternalPublicTickets] = useState<TicketJazida[]>([]);
  const [rdos, setRdos] = useState<RdoDiario[]>([]);
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
  const [controleEstacas, setControleEstacas] = useState<ControleEstacas>(INITIAL_CONTROLE_ESTACAS);
  const [periodosArquivados, setPeriodosArquivados] = useState<PeriodoArquivado[]>([]);
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);
  const [isExternalPresenceLoading, setIsExternalPresenceLoading] = useState<boolean>(Boolean(getPresenceTokenFromUrl()));
  const [isExternalApontamentoLoading, setIsExternalApontamentoLoading] = useState<boolean>(Boolean(getApontamentoTokenFromUrl()));
  const [isExternalTicketLoading, setIsExternalTicketLoading] = useState<boolean>(isTicketLinkUrl());
  const [externalTicketLoadError, setExternalTicketLoadError] = useState('');
  const externalPresenceToken = getPresenceTokenFromUrl();
  const externalApontamentoToken = getApontamentoTokenFromUrl();
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
        const materialData = await loadInitialMateriaisData();
        if (cancelled) return;
        INITIAL_MATERIAIS_CADASTRO = materialData.cadastro;
        INITIAL_MATERIAIS_REGISTROS = materialData.registros;
      } catch (error) {
        console.error('Falha ao carregar a base histórica de materiais:', error);
      }

    const isDataLoadedV2 = localStorage.getItem('renea_data_loaded_v2') === 'true';

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
        { key: 'renea_rdos', value: JSON.stringify(INITIAL_RDOS) },
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
        { key: 'renea_controle_estacas', value: JSON.stringify(INITIAL_CONTROLE_ESTACAS) },
        { key: 'renea_periodos_arquivados', value: '[]' },
        { key: 'renea_history_logs', value: JSON.stringify(INITIAL_HISTORY_LOGS) },
        { key: 'renea_notifications', value: '[]' },
      ].filter(entry => localStorage.getItem(entry.key) === null);
      commitStorageBatch(localStorage, [
        ...initialStorageEntries,
        { key: 'renea_data_loaded_v2', value: 'true' },
        { key: 'renea_colaboradores_planilha_v1', value: 'true' },
        { key: 'renea_planilhas_operacionais_v1', value: 'true' },
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
      setRdos(INITIAL_RDOS);
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
      setControleEstacas(INITIAL_CONTROLE_ESTACAS);
      setPeriodosArquivados([]);
      setHistoryLogs(INITIAL_HISTORY_LOGS);
      setNotifications(getInitialNotifications());
    }
    {
      const savedEmpresas = localStorage.getItem('renea_empresas');
      const savedObras = localStorage.getItem('renea_obras');
      const savedEquipamentos = localStorage.getItem('renea_equipamentos');
      const savedFuncionarios = localStorage.getItem('renea_funcionarios');
      const savedComboios = localStorage.getItem('renea_comboios');
      const savedCombustiveis = localStorage.getItem('renea_combustiveis');
      const savedLubrificantes = localStorage.getItem('renea_lubrificantes');
      const savedEtapas = localStorage.getItem('renea_etapas');
      const savedAbastecimentos = localStorage.getItem('renea_abastecimentos');
      const savedLubrificacoes = localStorage.getItem('renea_lubrificacoes');
      const savedTicketsJazida = localStorage.getItem('renea_tickets_jazida');
      const savedRdos = localStorage.getItem('renea_rdos');
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
      const savedControleEstacas = localStorage.getItem('renea_controle_estacas');
      const savedPeriodosArquivados = localStorage.getItem('renea_periodos_arquivados');
      const savedHistory = localStorage.getItem('renea_history_logs');
      const savedNotifications = localStorage.getItem('renea_notifications');
      const shouldMigratePresencePeople = localStorage.getItem('renea_colaboradores_planilha_v1') !== 'true';
      const shouldMigrateSpreadsheetSeed = localStorage.getItem('renea_planilhas_operacionais_v1') !== 'true';
      const shouldMigrateMateriaisSeed = localStorage.getItem('renea_materiais_planilha_v1') !== 'true';
      const parsedEquipamentos = parseStoredJson(savedEquipamentos, 'renea_equipamentos', INITIAL_EQUIPAMENTOS);
      const parsedAbastecimentos = parseStoredJson(savedAbastecimentos, 'renea_abastecimentos', INITIAL_ABASTECIMENTOS);
      const parsedTicketsJazida = parseStoredJson(savedTicketsJazida, 'renea_tickets_jazida', INITIAL_TICKETS_JAZIDA);
      const parsedMateriaisCadastro = parseStoredJson(savedMateriaisCadastro, 'renea_materiais_cadastro', INITIAL_MATERIAIS_CADASTRO);
      const parsedMateriaisRegistros = parseStoredJson(savedMateriaisRegistros, 'renea_materiais_registros', INITIAL_MATERIAIS_REGISTROS);
      const loadedEquipamentos = shouldMigrateSpreadsheetSeed
        ? mergeSeedRecords(parsedEquipamentos, INITIAL_EQUIPAMENTOS, item => item.prefixo.trim().toLowerCase())
        : parsedEquipamentos;
      const loadedAbastecimentos = shouldMigrateSpreadsheetSeed
        ? mergeSeedRecords(parsedAbastecimentos, INITIAL_ABASTECIMENTOS, item => `${item.data}|${item.equipamentoId}|${item.hora}|${item.quantidadeLitros}|${item.bombaInicial}`)
        : parsedAbastecimentos;
      const loadedTicketsJazida = shouldMigrateSpreadsheetSeed
        ? mergeSeedRecords(parsedTicketsJazida, INITIAL_TICKETS_JAZIDA, item => `${item.tipoTicket || 'Liberação'}|${item.data}|${item.ticketNumero}|${item.prefixo}`)
        : parsedTicketsJazida;
      const loadedMateriaisCadastro = shouldMigrateMateriaisSeed
        ? mergeSeedRecords(parsedMateriaisCadastro, INITIAL_MATERIAIS_CADASTRO, materialCadastroKey)
        : parsedMateriaisCadastro;
      const loadedMateriaisRegistros = shouldMigrateMateriaisSeed
        ? mergeSeedRecords(parsedMateriaisRegistros, INITIAL_MATERIAIS_REGISTROS, materialRegistroKey)
        : parsedMateriaisRegistros;

      setEmpresas(parseStoredJson(savedEmpresas, 'renea_empresas', INITIAL_EMPRESAS));
      setObras(parseStoredJson(savedObras, 'renea_obras', INITIAL_OBRAS));
      setEquipamentos(loadedEquipamentos);
      setFuncionarios(shouldMigratePresencePeople ? INITIAL_FUNCIONARIOS : parseStoredJson(savedFuncionarios, 'renea_funcionarios', INITIAL_FUNCIONARIOS));
      setComboios(parseStoredJson(savedComboios, 'renea_comboios', INITIAL_COMBOIOS));
      setCombustiveis(parseStoredJson(savedCombustiveis, 'renea_combustiveis', INITIAL_TIPOS_COMBUSTIVEL));
      setLubrificantes(parseStoredJson(savedLubrificantes, 'renea_lubrificantes', INITIAL_PRODUTOS_LUBRIFICACAO));
      setEtapas(parseStoredJson(savedEtapas, 'renea_etapas', INITIAL_ETAPAS_SERVICO));
      setAbastecimentos(loadedAbastecimentos);
      setLubrificacoes(parseStoredJson(savedLubrificacoes, 'renea_lubrificacoes', INITIAL_LUBRIFICACOES));
      setTicketsJazida(loadedTicketsJazida);
      setRdos(parseStoredJson(savedRdos, 'renea_rdos', INITIAL_RDOS));
      setListasPresenca(shouldMigratePresencePeople ? INITIAL_PRESENCAS : parseStoredJson(savedListasPresenca, 'renea_listas_presenca', INITIAL_PRESENCAS));
      setOrdensServico(parseStoredJson(savedOrdensServico, 'renea_ordens_servico', INITIAL_ORDENS_SERVICO));
      setGruposEquipe(shouldMigratePresencePeople ? INITIAL_GRUPOS_EQUIPES : parseStoredJson(savedGruposEquipe, 'renea_grupos_equipes', INITIAL_GRUPOS_EQUIPES));
      setPresencasLink(parseStoredJson(savedPresencasLink, 'renea_presencas_link', INITIAL_PRESENCAS_LINK));
      setHistoricoPresencas(parseStoredJson(savedHistoricoPresencas, 'renea_historico_presencas', INITIAL_HISTORICO_PRESENCAS));
      const parsedApontamentoRamos = parseStoredJson(savedApontamentoRamos, 'renea_apontamento_ramos', INITIAL_APONTAMENTO_RAMOS);
      const shouldResetApontamentoRamos =
        !savedApontamentoRamos ||
        parsedApontamentoRamos.some(ramo => ramo.token !== INITIAL_APONTAMENTO_RAMOS[0]?.token) ||
        !INITIAL_APONTAMENTO_RAMOS.every(initial =>
          parsedApontamentoRamos.some(ramo => ramo.ramoNome === initial.ramoNome && ramo.canteiroNome === initial.canteiroNome)
        );
      const loadedApontamentoRamos = shouldResetApontamentoRamos ? INITIAL_APONTAMENTO_RAMOS : parsedApontamentoRamos;
      setApontamentoRamos(loadedApontamentoRamos);
      setApontamentoRamoRegistros(parseStoredJson(savedApontamentoRamoRegistros, 'renea_apontamento_ramo_registros', INITIAL_APONTAMENTO_RAMO_REGISTROS));
      setMateriaisCadastro(loadedMateriaisCadastro);
      setMateriaisRegistros(loadedMateriaisRegistros);
      setPartesDiariasEquipamentos(parseStoredJson(savedPartesDiariasEquipamentos, 'renea_partes_diarias_equipamentos', INITIAL_PARTES_DIARIAS_EQUIPAMENTOS));
      setControleEstacas(parseStoredJson(savedControleEstacas, 'renea_controle_estacas', INITIAL_CONTROLE_ESTACAS));
      setPeriodosArquivados(parseStoredJson(savedPeriodosArquivados, 'renea_periodos_arquivados', [] as PeriodoArquivado[]));
      setHistoryLogs(parseStoredJson(savedHistory, 'renea_history_logs', INITIAL_HISTORY_LOGS));
      setNotifications(parseStoredJson(savedNotifications, 'renea_notifications', getInitialNotifications()));

      if (shouldMigratePresencePeople) {
        localStorage.setItem('renea_funcionarios', JSON.stringify(INITIAL_FUNCIONARIOS));
        localStorage.setItem('renea_listas_presenca', JSON.stringify(INITIAL_PRESENCAS));
        localStorage.setItem('renea_grupos_equipes', JSON.stringify(INITIAL_GRUPOS_EQUIPES));
        localStorage.setItem('renea_presencas_link', JSON.stringify(INITIAL_PRESENCAS_LINK));
        localStorage.setItem('renea_historico_presencas', JSON.stringify(INITIAL_HISTORICO_PRESENCAS));
        localStorage.setItem('renea_colaboradores_planilha_v1', 'true');
      }
      if (shouldResetApontamentoRamos) {
        localStorage.setItem('renea_apontamento_ramos', JSON.stringify(loadedApontamentoRamos));
      }
      if (!savedApontamentoRamoRegistros) {
        localStorage.setItem('renea_apontamento_ramo_registros', JSON.stringify(INITIAL_APONTAMENTO_RAMO_REGISTROS));
      }
      if (!savedPartesDiariasEquipamentos) {
        localStorage.setItem('renea_partes_diarias_equipamentos', JSON.stringify(INITIAL_PARTES_DIARIAS_EQUIPAMENTOS));
      }
      if (!savedControleEstacas) {
        localStorage.setItem('renea_controle_estacas', JSON.stringify(INITIAL_CONTROLE_ESTACAS));
      }
      if (!savedPeriodosArquivados) {
        localStorage.setItem('renea_periodos_arquivados', JSON.stringify([]));
      }
      if (shouldMigrateSpreadsheetSeed) {
        localStorage.setItem('renea_equipamentos', JSON.stringify(loadedEquipamentos));
        localStorage.setItem('renea_abastecimentos', JSON.stringify(loadedAbastecimentos));
        localStorage.setItem('renea_tickets_jazida', JSON.stringify(loadedTicketsJazida));
        localStorage.setItem('renea_planilhas_operacionais_v1', 'true');
      }
      if (shouldMigrateMateriaisSeed) {
        localStorage.setItem('renea_materiais_cadastro', JSON.stringify(loadedMateriaisCadastro));
        localStorage.setItem('renea_materiais_registros', JSON.stringify(loadedMateriaisRegistros));
        localStorage.setItem('renea_materiais_planilha_v1', 'true');
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
        await signOut(auth);
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


  // Check the real Firestore connection and load sync preferences on mount.
  useEffect(() => {
    const autoSyncSaved = localStorage.getItem('renea_auto_sync') === 'true';
    setIsAutoSyncEnabled(autoSyncSaved);
    
    const savedLastSync = localStorage.getItem('renea_last_cloud_sync') || '';
    setLastCloudSync(savedLastSync);

    const checkConnection = async () => {
      try {
        const status = await getFirebaseConnectionStatus(db);
        setIsFirebaseConnected(status.connected);

        if (status.updatedAt) {
          const cloudDate = new Date(status.updatedAt);
          if (!Number.isNaN(cloudDate.getTime())) {
            const cloudDateLabel = cloudDate.toLocaleString('pt-BR');
            setLastCloudSync(cloudDateLabel);
            localStorage.setItem('renea_last_cloud_sync', cloudDateLabel);
          }

          // Primeira execucao da versao nova: registra a nuvem atual como base sem
          // sobrescrever silenciosamente os dados locais que ainda nao foram enviados.
          if (!localStorage.getItem('renea_last_cloud_sync_iso')) {
            localStorage.setItem('renea_last_cloud_sync_iso', status.updatedAt);
          }
        }
      } catch (error) {
        console.warn('Falha ao validar a conexao real com o Firestore:', error);
        setIsFirebaseConnected(false);
      }
    };
    checkConnection();
  }, []);

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
    customRdos = rdos,
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
        comboios: customComboios,
        combustiveis: customCombustiveis,
        lubrificantes: customLubrificantes,
        etapas: customEtapas,
        abastecimentos: customAbastecimentos,
        lubrificacoes: customLubrificacoes,
        ticketsJazida: customTicketsJazida,
        rdos: customRdos,
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
        periodosArquivados: customPeriodosArquivados,
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
        message: `Firebase sincronizado: ${uploadResult.totalRecords.toLocaleString('pt-BR')} registros protegidos em blocos seguros.`,
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
        const data = backup.data;
        const validation = validateSystemBackup(data, false);
        if (!validation.valid) throw new Error(describeInvalidBackup(validation));
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
          ['comboios', 'renea_comboios'],
          ['combustiveis', 'renea_combustiveis'],
          ['lubrificantes', 'renea_lubrificantes'],
          ['etapas', 'renea_etapas'],
          ['abastecimentos', 'renea_abastecimentos'],
          ['lubrificacoes', 'renea_lubrificacoes'],
          ['ticketsJazida', 'renea_tickets_jazida'],
          ['rdos', 'renea_rdos'],
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
          ['periodosArquivados', 'renea_periodos_arquivados'],
          ['notifications', 'renea_notifications'],
          ['historyLogs', 'renea_history_logs'],
        ];
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

        // Só atualiza o React depois de toda a persistência local concluir.
        if (data.empresas) {
          setEmpresas(data.empresas);
        }
        if (data.obras) {
          setObras(data.obras);
        }
        if (data.equipamentos) {
          setEquipamentos(data.equipamentos);
        }
        if (data.funcionarios) {
          setFuncionarios(data.funcionarios);
        }
        if (data.comboios) {
          setComboios(data.comboios);
        }
        if (data.combustiveis) {
          setCombustiveis(data.combustiveis);
        }
        if (data.lubrificantes) {
          setLubrificantes(data.lubrificantes);
        }
        if (data.etapas) {
          setEtapas(data.etapas);
        }
        if (data.abastecimentos) {
          setAbastecimentos(data.abastecimentos);
        }
        if (data.lubrificacoes) {
          setLubrificacoes(data.lubrificacoes);
        }
        if (data.ticketsJazida) {
          setTicketsJazida(data.ticketsJazida);
        }
        if (data.rdos) {
          setRdos(data.rdos);
        }
        if (data.listasPresenca) {
          setListasPresenca(data.listasPresenca);
        }
        if (data.ordensServico) {
          setOrdensServico(data.ordensServico);
        }
        if (data.gruposEquipe) {
          setGruposEquipe(data.gruposEquipe);
        }
        if (data.presencasLink) {
          setPresencasLink(data.presencasLink);
        }
        if (data.historicoPresencas) {
          setHistoricoPresencas(data.historicoPresencas);
        }
        if (data.apontamentoRamos) {
          setApontamentoRamos(data.apontamentoRamos);
        }
        if (data.apontamentoRamoRegistros) {
          setApontamentoRamoRegistros(data.apontamentoRamoRegistros);
        }
        if (data.materiaisCadastro) {
          setMateriaisCadastro(data.materiaisCadastro);
        }
        if (data.materiaisRegistros) {
          setMateriaisRegistros(data.materiaisRegistros);
        }
        if (data.partesDiariasEquipamentos) {
          setPartesDiariasEquipamentos(data.partesDiariasEquipamentos);
        }
        if (data.periodosArquivados) {
          setPeriodosArquivados(data.periodosArquivados);
        }
        if (Array.isArray(data.estacaLotes) || Array.isArray(data.estacaCravacoes)) {
          setControleEstacas({
            lotes: Array.isArray(data.estacaLotes) ? data.estacaLotes : [],
            cravacoes: Array.isArray(data.estacaCravacoes) ? data.estacaCravacoes : [],
          });
        }
        if (data.notifications) {
          setNotifications(data.notifications);
        }
        if (data.historyLogs) {
          setHistoryLogs(data.historyLogs);
        }
        
        setLastCloudSync(nowStr);
        setIsFirebaseConnected(true);
        return {
          success: true,
          message: `Dados restaurados do Firebase com sucesso (${backup.totalRecords.toLocaleString('pt-BR')} registros).`,
        };
      } else {
        return { success: false, message: 'Nenhum backup encontrado no Firestore.' };
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
          localStorage.setItem('renea_last_cloud_sync_iso', status.updatedAt);
          return;
        }

        if (localCloudVersion !== status.updatedAt) {
          await handleDownloadFromFirebase();
        }
      } catch (error) {
        if (!cancelled) {
          setIsFirebaseConnected(false);
          console.warn('Verificacao automatica do Firebase falhou:', error);
        }
      } finally {
        isChecking = false;
      }
    };

    const initialCheck = window.setTimeout(pullRemoteChanges, 3_000);
    const interval = window.setInterval(pullRemoteChanges, 30_000);
    return () => {
      cancelled = true;
      window.clearTimeout(initialCheck);
      window.clearInterval(interval);
    };
  }, [isAutoSyncEnabled, externalPresenceToken, externalApontamentoToken, externalTicketLink]);

  useEffect(() => {
    if (!externalPresenceToken) return;
    setIsExternalPresenceLoading(true);
    loadPublicPresenceConfig(externalPresenceToken)
      .then(config => {
        setGruposEquipe(config.gruposEquipe);
        setFuncionarios(config.funcionarios);
        setObras(config.obras);
      })
      .catch(error => console.error('Falha ao carregar link público de presença:', error))
      .finally(() => setIsExternalPresenceLoading(false));
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
      localStorage.setItem('renea_tickets_jazida', JSON.stringify(merged));
      return merged;
    });
  };

  useEffect(() => {
    if (!externalTicketLink) return;
    // O link consulta liberações sob demanda pela API e mantém rascunhos e
    // comprovantes do próprio aparelho no armazenamento local.
    setExternalPublicTickets([]);
    setIsExternalTicketLoading(false);
    setExternalTicketLoadError('');
  }, [externalTicketLink]);

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
    action: 'Criou' | 'Editou' | 'Excluiu',
    description: string,
    newHistoryList: HistoryLog[],
    stateUpdateFn: () => void
  ) => {
    stateUpdateFn();
    const newLog: HistoryLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleString('pt-BR'),
      usuario: activeUserName,
      acao: action,
      tela: tableName,
      descricao: description
    };
    const updatedHistory = [newLog, ...newHistoryList];
    setHistoryLogs(updatedHistory);
    localStorage.setItem('renea_history_logs', JSON.stringify(updatedHistory));

    // Notificação real (não simulada) refletindo a ação que de fato aconteceu
    addNotification(
      `${tableName} — ${action}`,
      description,
      action === 'Excluiu' ? 'warning' : 'success',
      'Sistema Local'
    );

    // Handle background cloud sync if Auto Sync is active
    if (localStorage.getItem('renea_auto_sync') === 'true') {
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
          getLS('renea_rdos', INITIAL_RDOS),
          updatedHistory,
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
          if (res.success) {
            console.log("Auto-sync completed successfully.");
          } else {
            addNotification(
              'Sincronização pendente',
              res.message,
              'warning',
              'Firebase Cloud',
            );
          }
        });
      }, 100);
    }
  };

  // Auth Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsAuthenticating(true);
    try {
      await signInWithEmailAndPassword(auth, username.trim().toLowerCase(), password);
      setLoginError('');
    } catch (error: any) {
      const code = String(error?.code || '');
      setLoginError(code.includes('invalid-credential') || code.includes('user-not-found')
        ? 'E-mail ou senha incorretos.'
        : code.includes('too-many-requests')
          ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
          : 'Não foi possível entrar. Verifique sua conexão e tente novamente.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsLoggedIn(false);
    setCurrentUser(null);
    setUsername('');
    setPassword('');
  };

  // CRUD State Handlers
  const handleSaveEmpresa = (item: Empresa, isNew: boolean) => {
    let updated;
    if (isNew) {
      updated = [...empresas, item];
    } else {
      updated = empresas.map(x => x.id === item.id ? item : x);
    }
    saveAndLog(
      'Empresas', 
      isNew ? 'Criou' : 'Editou', 
      `${isNew ? 'Cadastrou' : 'Editou'} a empresa "${item.nome}" com CNPJ ${item.cnpj}.`,
      historyLogs,
      () => {
        setEmpresas(updated);
        localStorage.setItem('renea_empresas', JSON.stringify(updated));
      }
    );
  };

  const handleDeleteEmpresa = (id: string) => {
    const item = empresas.find(x => x.id === id);
    if (!item) return;
    const updated = empresas.filter(x => x.id !== id);
    saveAndLog(
      'Empresas', 
      'Excluiu', 
      `Excluiu a empresa "${item.nome}".`,
      historyLogs,
      () => {
        setEmpresas(updated);
        localStorage.setItem('renea_empresas', JSON.stringify(updated));
      }
    );
  };

  const handleSaveObra = (item: ObraLocal, isNew: boolean) => {
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
        localStorage.setItem('renea_obras', JSON.stringify(updated));
      }
    );
  };

  const handleDeleteObra = (id: string) => {
    const item = obras.find(x => x.id === id);
    if (!item) return;
    const updated = obras.filter(x => x.id !== id);
    saveAndLog(
      'Obras/Locais', 
      'Excluiu', 
      `Excluiu a obra/local "${item.nome}".`,
      historyLogs,
      () => {
        setObras(updated);
        localStorage.setItem('renea_obras', JSON.stringify(updated));
      }
    );
  };

  const handleSaveEquipamento = (item: Equipamento, isNew: boolean) => {
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
        localStorage.setItem('renea_equipamentos', JSON.stringify(updated));
      }
    );
  };

  const handleDeleteEquipamento = (id: string) => {
    const item = equipamentos.find(x => x.id === id);
    if (!item) return;
    const updated = equipamentos.filter(x => x.id !== id);
    saveAndLog(
      'Equipamentos', 
      'Excluiu', 
      `Excluiu o equipamento "${item.prefixo} - ${item.nome}".`,
      historyLogs,
      () => {
        setEquipamentos(updated);
        localStorage.setItem('renea_equipamentos', JSON.stringify(updated));
      }
    );
  };

  const handleSaveFuncionario = (item: Funcionario, isNew: boolean) => {
    let updated;
    if (isNew) {
      updated = [...funcionarios, item];
    } else {
      updated = funcionarios.map(x => x.id === item.id ? item : x);
    }
    saveAndLog(
      'Funcionários', 
      isNew ? 'Criou' : 'Editou', 
      `${isNew ? 'Cadastrou' : 'Editou'} o funcionário "${item.nome}" (${item.cargo}).`,
      historyLogs,
      () => {
        setFuncionarios(updated);
        localStorage.setItem('renea_funcionarios', JSON.stringify(updated));
      }
    );
  };

  const handleDeleteFuncionario = (id: string) => {
    const item = funcionarios.find(x => x.id === id);
    if (!item) return;
    const updated = funcionarios.filter(x => x.id !== id);
    saveAndLog(
      'Funcionários', 
      'Excluiu', 
      `Excluiu o funcionário "${item.nome}".`,
      historyLogs,
      () => {
        setFuncionarios(updated);
        localStorage.setItem('renea_funcionarios', JSON.stringify(updated));
      }
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
        localStorage.setItem('renea_comboios', JSON.stringify(updated));
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
        localStorage.setItem('renea_comboios', JSON.stringify(updated));
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
        localStorage.setItem('renea_combustiveis', JSON.stringify(updated));
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
        localStorage.setItem('renea_combustiveis', JSON.stringify(updated));
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
        localStorage.setItem('renea_lubrificantes', JSON.stringify(updated));
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
        localStorage.setItem('renea_lubrificantes', JSON.stringify(updated));
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
        localStorage.setItem('renea_etapas', JSON.stringify(updated));
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
        localStorage.setItem('renea_etapas', JSON.stringify(updated));
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
        localStorage.setItem(storageKey, JSON.stringify(next));
      });
      return { success: true, message };
    };

    if (target === 'empresas') {
      const incoming = validRows.map((row, index): Empresa | null => {
        const cnpj = getImportValue(row, ['cnpj', 'documento']);
        const nome = getImportValue(row, ['nome', 'empresa', 'nome fantasia', 'razao social', 'razão social']) || cnpj || `Empresa ${index + 1}`;
        return {
          id: `emp-import-${now}-${index}`,
          nome,
          cnpj,
          telefone: getImportValue(row, ['telefone', 'contato', 'celular']),
          responsavel: getImportValue(row, ['responsavel', 'responsável', 'gestor'])
        };
      }).filter(Boolean) as Empresa[];
      if (incoming.length === 0) return { success: false, message: 'Nenhuma empresa foi encontrada na planilha.' };
      const result = mergeImportedRecords(empresas, incoming, item => normalizeImportText(item.cnpj || item.nome));
      return persistImport('Empresas', 'renea_empresas', setEmpresas, result.next, incoming.length, result.created, result.updated);
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

    if (target === 'equipamentos') {
      const incoming = validRows.map((row, index): Equipamento | null => {
        const seriePlaca = getImportValue(row, ['serie', 'série', 'numero serie', 'número série', 'numero de serie', 'número de série', 'serie placa', 'série placa']).toUpperCase();
        const placa = getImportValue(row, ['placa', 'placa veiculo', 'placa veículo']).toUpperCase();
        const prefixo = (getImportValue(row, ['prefixo', 'frota', 'codigo', 'código', 'id frota']) || placa || seriePlaca || `EQ-${index + 1}`).toUpperCase();
        const tipo = getImportValue(row, ['tipo', 'tipo equipamento', 'categoria']) || 'Outro';
        const nome = getImportValue(row, ['nome', 'equipamento', 'descricao', 'descrição', 'maquina', 'máquina']) || tipo || prefixo;
        const familia = getImportValue(row, ['familia', 'família']);
        const categoryText = normalizeImportText(getImportValue(row, ['categoria frota', 'categoria da frota', 'classe frota']));
        const categoriaFrota: NonNullable<Equipamento['categoriaFrota']> = categoryText.includes('implement')
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
      return persistImport('Equipamentos', 'renea_equipamentos', setEquipamentos, result.next, incoming.length, result.created, result.updated);
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
          liderMatricula: getImportValue(row, ['matricula lider', 'matrícula líder']) || undefined,
          liderNome: getImportValue(row, ['lider', 'líder', 'encarregado']) || undefined,
          area: getImportValue(row, ['area', 'área']) || undefined,
          responsavelArea: getImportValue(row, ['responsavel area', 'responsável área']) || undefined
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
        localStorage.setItem('renea_abastecimentos', JSON.stringify(updated));
      }
    );
  };

  const handleDeleteAbastecimento = (id: string) => {
    const item = abastecimentos.find(x => x.id === id);
    if (!item) return;
    let updated = abastecimentos.filter(x => x.id !== id);
    updated = auditarBaseCombustivel(updated);
    saveAndLog(
      'Abastecimentos', 
      'Excluiu', 
      `Excluiu lançamento de abastecimento ID ${id.substring(0, 8)}.`,
      historyLogs,
      () => {
        setAbastecimentos(updated);
        localStorage.setItem('renea_abastecimentos', JSON.stringify(updated));
      }
    );
  };

  // Importação de planilha — Prioridade 3: grava em lote (um único registro de histórico)
  const handleImportAbastecimentos = (novosItens: Abastecimento[], combustiveisImportados: TipoCombustivel[] = []) => {
    if ((!novosItens || novosItens.length === 0) && combustiveisImportados.length === 0) return;
    const fuelMerge = combustiveisImportados.length
      ? mergeImportedRecords(combustiveis, combustiveisImportados, item => normalizeImportText(item.nome))
      : null;
    let updated = mergeRecordsById(abastecimentos, novosItens);
    updated = auditarBaseCombustivel(updated);
    const origens = new Set(novosItens.map(item => item.origem || 'Planilha'));
    const origemDescricao = origens.size === 1 ? [...origens][0] : 'fontes combinadas';
    const fuelMessage = fuelMerge && fuelMerge.created > 0
      ? ` Também cadastrou ${fuelMerge.created} tipo(s) de combustível novo(s).`
      : '';
    saveAndLog(
      'Abastecimentos',
      'Criou',
      `Importou ${novosItens.length} registro(s) de combustível via ${origemDescricao}.${fuelMessage}`,
      historyLogs,
      () => {
        if (fuelMerge) {
          setCombustiveis(fuelMerge.next);
          localStorage.setItem('renea_combustiveis', JSON.stringify(fuelMerge.next));
        }
        setAbastecimentos(updated);
        localStorage.setItem('renea_abastecimentos', JSON.stringify(updated));
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
        localStorage.setItem('renea_lubrificacoes', JSON.stringify(updated));
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
        localStorage.setItem('renea_lubrificacoes', JSON.stringify(updated));
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
        localStorage.setItem('renea_tickets_jazida', JSON.stringify(updated));
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
        localStorage.setItem('renea_tickets_jazida', JSON.stringify(updated));
      }
    );
    void deletePublicTicket(db, id)
      .catch(error => console.warn('Falha ao excluir ticket público:', error));
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
        localStorage.setItem('renea_tickets_jazida', JSON.stringify(updated));
      }
    );
  };

  const handleReserveTicketNumber = () => reservePublicTicketNumber(db, ticketsJazida);
  const handleReserveTicketNumbers = (count: number) => reservePublicTicketNumbers(db, ticketsJazida, count);

  const handleSaveTicketLink = async (
    item: TicketJazida,
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const result = await savePublicTicketViaApi(item);
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

  const handleSaveRdo = (item: RdoDiario, isNew: boolean) => {
    let updated;
    if (isNew) {
      updated = [...rdos, item];
    } else {
      updated = rdos.map(x => x.id === item.id ? item : x);
    }
    const ob = obras.find(o => o.id === item.obraLocalId);
    saveAndLog(
      'RDO Diário', 
      isNew ? 'Criou' : 'Editou', 
      `${isNew ? 'Registrou' : 'Editou'} RDO Diário para obra "${ob ? ob.nome : 'Geral'}" no dia ${item.data}.`,
      historyLogs,
      () => {
        setRdos(updated);
        localStorage.setItem('renea_rdos', JSON.stringify(updated));
      }
    );
  };

  const handleDeleteRdo = (id: string) => {
    const item = rdos.find(x => x.id === id);
    if (!item) return;
    const updated = rdos.filter(x => x.id !== id);
    saveAndLog(
      'RDO Diário', 
      'Excluiu', 
      `Excluiu RDO Diário do dia ${item.data}.`,
      historyLogs,
      () => {
        setRdos(updated);
        localStorage.setItem('renea_rdos', JSON.stringify(updated));
      }
    );
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
        localStorage.setItem('renea_listas_presenca', JSON.stringify(updated));
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
        localStorage.setItem('renea_listas_presenca', JSON.stringify(updated));
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
        localStorage.setItem('renea_ordens_servico', JSON.stringify(updated));
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
        localStorage.setItem('renea_ordens_servico', JSON.stringify(updated));
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
    localStorage.setItem('renea_equipamentos', JSON.stringify(updated));
  };

  // Notifications helpers
  const addNotification = (
    title: string, 
    message: string, 
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    source: 'Netlify App' | 'Sistema Local' | 'Firebase Cloud' = 'Netlify App'
  ) => {
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title,
      message,
      type,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      read: false,
      source
    };

    setNotifications(prev => {
      const updated = [newNotif, ...prev].slice(0, 50);
      localStorage.setItem('renea_notifications', JSON.stringify(updated));
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
    const updated = [...newItems, ...notifications].slice(0, 50);
    setNotifications(updated);
    localStorage.setItem('renea_notifications', JSON.stringify(updated));
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
    type: 'info' | 'success' | 'warning' | 'error' = 'info'
  ): AppNotification => ({
    id: `notif-pres-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title,
    message,
    type,
    timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    read: false,
    source: 'Netlify App'
  });

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
      getLS('renea_rdos', INITIAL_RDOS),
      getLS('renea_history_logs', INITIAL_HISTORY_LOGS),
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
          { key: 'renea_history_logs', value: JSON.stringify(nextHistory) },
        ]);
        setCombustiveis(nextFuelTypes);
        setAbastecimentos(nextFuelRecords);
        setHistoryLogs(nextHistory);

        const syncResult = await uploadLocalSnapshotToFirebase();
        if (!syncResult.success) throw new Error(syncResult.message);
        localStorage.setItem('renea_onedrive_fuel_batch', batchId);
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

    const ingestPublicSubmissions = async () => {
      if (cancelled || running) return;
      running = true;
      try {
        const submissions = await loadPendingPublicSubmissions(db);
        if (cancelled || submissions.length === 0) return;

        const incomingPresence = submissions.flatMap(item => item.kind === 'presence' ? (item.payload.records || []) : []);
        const incomingPointing = submissions.flatMap(item => item.kind === 'apontamento' && item.payload.record ? [item.payload.record] : []);
        const storedPresence = parseStoredJson<PresencaApontamento[]>(localStorage.getItem('renea_presencas_link'), 'renea_presencas_link', []);
        const storedPointing = parseStoredJson<ApontamentoRamoRegistro[]>(localStorage.getItem('renea_apontamento_ramo_registros'), 'renea_apontamento_ramo_registros', []);
        const nextPresence = mergeRecordsById(storedPresence, incomingPresence);
        const nextPointing = mergeRecordsById(storedPointing, incomingPointing);

        const storedHistory = parseStoredJson<HistoryLog[]>(localStorage.getItem('renea_history_logs'), 'renea_history_logs', []);
        const nextHistory = mergeRecordsById(storedHistory, submissions.map(item => ({
          id: `log-public-${item.id}`,
          timestamp: new Date(item.createdAtIso || Date.now()).toLocaleString('pt-BR'),
          usuario: item.kind === 'presence' ? (item.payload.grupoNome || 'Link de presença') : (item.payload.record?.responsavel || 'Link de apontamento'),
          acao: 'Criou' as const,
          tela: item.kind === 'presence' ? 'Controle de Presença' : 'Apontamentos',
          descricao: item.kind === 'presence'
            ? `Recebeu presença pública do grupo ${item.payload.grupoNome || item.payload.grupoId} em ${item.payload.data}.`
            : `Recebeu apontamento público de ${item.payload.record?.ramoNome || item.payload.ramoId} em ${item.payload.data}.`,
        })));

        const storedNotifications = parseStoredJson<AppNotification[]>(localStorage.getItem('renea_notifications'), 'renea_notifications', []);
        const nextNotifications = mergeRecordsById(storedNotifications, submissions.map(item => ({
          id: `notification-public-${item.id}`,
          type: 'success' as const,
          title: item.kind === 'presence' ? 'Presença recebida' : 'Apontamento recebido',
          message: item.kind === 'presence'
            ? `${item.payload.grupoNome || 'Equipe'} enviou ${item.payload.records?.length || 0} registro(s) de presença.`
            : `${item.payload.record?.ramoNome || 'Ramo'} enviou um apontamento de campo.`,
          timestamp: new Date(item.createdAtIso || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          read: false,
          source: 'Firebase Cloud' as const,
        })));

        localStorage.setItem('renea_presencas_link', JSON.stringify(nextPresence));
        localStorage.setItem('renea_apontamento_ramo_registros', JSON.stringify(nextPointing));
        localStorage.setItem('renea_history_logs', JSON.stringify(nextHistory));
        localStorage.setItem('renea_notifications', JSON.stringify(nextNotifications));
        setPresencasLink(nextPresence);
        setApontamentoRamoRegistros(nextPointing);
        setHistoryLogs(nextHistory);
        setNotifications(nextNotifications);

        const syncResult = await uploadLocalSnapshotToFirebase();
        if (!syncResult.success) throw new Error(syncResult.message);
        await markPublicSubmissionsProcessed(db, submissions.map(item => item.id), currentUser.uid);
      } catch (error) {
        if (!cancelled) console.warn('Falha ao incorporar a fila pública; os itens permanecerão pendentes:', error);
      } finally {
        running = false;
      }
    };

    const initial = window.setTimeout(ingestPublicSubmissions, 2_000);
    const interval = window.setInterval(ingestPublicSubmissions, 30_000);
    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(interval);
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
        localStorage.setItem('renea_grupos_equipes', JSON.stringify(updated));
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
        localStorage.setItem('renea_grupos_equipes', JSON.stringify(updated));
      }
    );
  };

  const handleSubmitPresencaLink = async (
    grupo: GrupoEquipe,
    data: string,
    items: Array<{ funcionarioId: string; status: PresencaStatus; observacao: string }>
  ): Promise<{ success: boolean; message: string }> => {
    try {
      return await submitPublicPresence(externalPresenceToken, grupo.id, data, items);
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Não foi possível enviar a presença.' };
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
    localStorage.setItem('renea_presencas_link', JSON.stringify(updatedPresencas));
    localStorage.setItem('renea_historico_presencas', JSON.stringify(updatedHistorico));

    handleUploadToFirebase(
      empresas, obras, equipamentos, funcionarios, comboios, combustiveis, lubrificantes, etapas,
      abastecimentos, lubrificacoes, ticketsJazida, rdos, historyLogs, listasPresenca, ordensServico,
      gruposEquipe, updatedPresencas, updatedHistorico, updatedNotifications
    );
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
        localStorage.setItem('renea_apontamento_ramos', JSON.stringify(updated));
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
        localStorage.setItem('renea_apontamento_ramos', JSON.stringify(updated));
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
        localStorage.setItem('renea_apontamento_ramo_registros', JSON.stringify(updated));
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
        localStorage.setItem('renea_apontamento_ramo_registros', JSON.stringify(updated));
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
        localStorage.setItem('renea_materiais_cadastro', JSON.stringify(updated));
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
        localStorage.setItem('renea_materiais_cadastro', JSON.stringify(updated));
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
        localStorage.setItem('renea_materiais_registros', JSON.stringify(updated));
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
        localStorage.setItem('renea_materiais_registros', JSON.stringify(updated));
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
        localStorage.setItem('renea_materiais_cadastro', JSON.stringify(materialMerge.next));
        localStorage.setItem('renea_materiais_registros', JSON.stringify(registroMerge.next));
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
        localStorage.setItem('renea_controle_estacas', JSON.stringify(next));
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
        localStorage.setItem('renea_partes_diarias_equipamentos', JSON.stringify(updated));
      }
    );
  };

  const handleImportPartesDiariasEquipamentos = (registros: ParteDiariaEquipamento[]) => {
    if (!registros.length) return;
    const key = (item: ParteDiariaEquipamento) =>
      item.numero
        ? normalizeImportText(`numero-${item.numero}`)
        : normalizeImportText(`${item.data}-${item.equipamentoId || item.prefixo}-${item.operadorNome}`);
    const result = mergeImportedRecords(partesDiariasEquipamentos, registros, key);
    if (!result.created && !result.updated) return;
    saveAndLog(
      'Parte Diária de Equipamentos',
      'Criou',
      `Importou partes diárias: ${result.created} nova(s), ${result.updated} atualizada(s).`,
      historyLogs,
      () => {
        setPartesDiariasEquipamentos(result.next);
        localStorage.setItem('renea_partes_diarias_equipamentos', JSON.stringify(result.next));
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
        localStorage.setItem('renea_partes_diarias_equipamentos', JSON.stringify(updated));
      }
    );
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
    comboios?: Comboio[];
    combustiveis?: TipoCombustivel[];
    lubrificantes?: ProdutoLubrificacao[];
    etapas?: EtapaServico[];
    abastecimentos?: Abastecimento[];
    lubrificacoes?: Lubrificacao[];
    ticketsJazida?: TicketJazida[];
    rdos: RdoDiario[];
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
    controleEstacas?: ControleEstacas;
    periodosArquivados?: PeriodoArquivado[];
    notifications?: AppNotification[];
    historyLogs?: HistoryLog[];
  }) => {
    // Backups de versões anteriores não possuem todas as tabelas atuais. Uma
    // tabela ausente preserva o conteúdo deste navegador em vez de apagá-lo.
    const nextEmpresas = imported.empresas ?? empresas;
    const nextObras = imported.obras ?? obras;
    const nextEquipamentos = imported.equipamentos ?? equipamentos;
    const nextFuncionarios = imported.funcionarios ?? funcionarios;
    const nextComboios = imported.comboios ?? comboios;
    const nextCombustiveis = imported.combustiveis ?? combustiveis;
    const nextLubrificantes = imported.lubrificantes ?? lubrificantes;
    const nextEtapas = imported.etapas ?? etapas;
    const nextAbastecimentos = imported.abastecimentos ?? abastecimentos;
    const nextLubrificacoes = imported.lubrificacoes ?? lubrificacoes;
    const nextTicketsJazida = imported.ticketsJazida ?? ticketsJazida;
    const nextRdos = imported.rdos ?? rdos;
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
    const nextControleEstacas = imported.controleEstacas ?? controleEstacas;
    const nextPeriodosArquivados = imported.periodosArquivados ?? periodosArquivados;
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
      { key: 'renea_comboios', value: JSON.stringify(nextComboios) },
      { key: 'renea_combustiveis', value: JSON.stringify(nextCombustiveis) },
      { key: 'renea_lubrificantes', value: JSON.stringify(nextLubrificantes) },
      { key: 'renea_etapas', value: JSON.stringify(nextEtapas) },
      { key: 'renea_abastecimentos', value: JSON.stringify(nextAbastecimentos) },
      { key: 'renea_lubrificacoes', value: JSON.stringify(nextLubrificacoes) },
      { key: 'renea_tickets_jazida', value: JSON.stringify(nextTicketsJazida) },
      { key: 'renea_rdos', value: JSON.stringify(nextRdos) },
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
      { key: 'renea_controle_estacas', value: JSON.stringify(nextControleEstacas) },
      { key: 'renea_periodos_arquivados', value: JSON.stringify(nextPeriodosArquivados) },
      { key: 'renea_notifications', value: JSON.stringify(nextNotifications) },
      { key: 'renea_history_logs', value: JSON.stringify(logs) },
    ]);

    setEmpresas(nextEmpresas);
    setObras(nextObras);
    setEquipamentos(nextEquipamentos);
    setFuncionarios(nextFuncionarios);
    setComboios(nextComboios);
    setCombustiveis(nextCombustiveis);
    setLubrificantes(nextLubrificantes);
    setEtapas(nextEtapas);
    setAbastecimentos(nextAbastecimentos);
    setLubrificacoes(nextLubrificacoes);
    setTicketsJazida(nextTicketsJazida);
    setRdos(nextRdos);
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
    setControleEstacas(nextControleEstacas);
    setPeriodosArquivados(nextPeriodosArquivados);
    setNotifications(nextNotifications);
    setHistoryLogs(logs);
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
      { key: 'renea_rdos', value: JSON.stringify(INITIAL_RDOS) },
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
      { key: 'renea_controle_estacas', value: JSON.stringify(INITIAL_CONTROLE_ESTACAS) },
      { key: 'renea_periodos_arquivados', value: '[]' },
      { key: 'renea_notifications', value: '[]' },
      { key: 'renea_history_logs', value: JSON.stringify(INITIAL_HISTORY_LOGS) },
      { key: 'renea_colaboradores_planilha_v1', value: 'true' },
      { key: 'renea_planilhas_operacionais_v1', value: 'true' },
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
    setRdos(INITIAL_RDOS);
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
    setControleEstacas(INITIAL_CONTROLE_ESTACAS);
    setPeriodosArquivados([]);
    setNotifications([]);
    setHistoryLogs(INITIAL_HISTORY_LOGS);
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
      'renea_empresas', 'renea_obras', 'renea_equipamentos', 'renea_funcionarios',
      'renea_comboios', 'renea_combustiveis', 'renea_lubrificantes', 'renea_etapas',
      'renea_abastecimentos', 'renea_lubrificacoes', 'renea_tickets_jazida', 'renea_rdos',
      'renea_listas_presenca', 'renea_ordens_servico', 'renea_grupos_equipes',
      'renea_presencas_link', 'renea_historico_presencas', 'renea_apontamento_ramos',
      'renea_apontamento_ramo_registros', 'renea_materiais_cadastro', 'renea_materiais_registros',
      'renea_partes_diarias_equipamentos', 'renea_periodos_arquivados', 'renea_notifications',
    ];
    commitStorageBatch(localStorage, [
      ...clearedArrayKeys.map(key => ({ key, value: '[]' })),
      { key: 'renea_controle_estacas', value: JSON.stringify(INITIAL_CONTROLE_ESTACAS) },
      { key: 'renea_history_logs', value: JSON.stringify([clearLog]) },
      { key: 'renea_colaboradores_planilha_v1', value: 'true' },
      { key: 'renea_planilhas_operacionais_v1', value: 'true' },
      { key: 'renea_materiais_planilha_v1', value: 'true' },
    ]);

    setEmpresas([]);
    setObras([]);
    setEquipamentos([]);
    setFuncionarios([]);
    setComboios([]);
    setCombustiveis([]);
    setLubrificantes([]);
    setEtapas([]);
    setAbastecimentos([]);
    setLubrificacoes([]);
    setTicketsJazida([]);
    setRdos([]);
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
    setControleEstacas(INITIAL_CONTROLE_ESTACAS);
    setPeriodosArquivados([]);
    setNotifications([]);
    setHistoryLogs([clearLog]);
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
      comboios: 'Comboios',
      combustiveis: 'Tipos de combustível',
      lubrificantes: 'Lubrificantes/Etapas',
      abastecimentos: 'Abastecimentos',
      lubrificacoes: 'Lubrificações',
      rdos: 'RDOs',
      presenca: 'Presença',
      apontamentoRamos: 'Apontamento Ramos',
      ticketsJazida: 'Tickets Jazida',
      materiais: 'Materiais',
      estacas: 'Estacas',
      partesDiarias: 'Partes Diárias',
      manutencao: 'Manutenção',
      periodosArquivados: 'Arquivos de períodos',
    };

    const nextValue = <T,>(defaultValue: T[]): T[] => (mode === 'default' ? defaultValue : []);
    const persist = <T,>(key: string, value: T[], setter: (items: T[]) => void) => {
      setter(value);
      localStorage.setItem(key, JSON.stringify(value));
    };

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
              break;
            case 'funcionarios':
              persist('renea_funcionarios', nextValue(INITIAL_FUNCIONARIOS), setFuncionarios);
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
            case 'abastecimentos':
              persist('renea_abastecimentos', nextValue(INITIAL_ABASTECIMENTOS), setAbastecimentos);
              break;
            case 'lubrificacoes':
              persist('renea_lubrificacoes', nextValue(INITIAL_LUBRIFICACOES), setLubrificacoes);
              break;
            case 'rdos':
              persist('renea_rdos', nextValue(INITIAL_RDOS), setRdos);
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
              localStorage.setItem('renea_controle_estacas', JSON.stringify(next));
              break;
            }
            case 'partesDiarias':
              persist('renea_partes_diarias_equipamentos', nextValue(INITIAL_PARTES_DIARIAS_EQUIPAMENTOS), setPartesDiariasEquipamentos);
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
        localStorage.setItem('renea_colaboradores_planilha_v1', 'true');
        localStorage.setItem('renea_planilhas_operacionais_v1', 'true');
        localStorage.setItem('renea_materiais_planilha_v1', 'true');
      }
    );

    return {
      success: true,
      message: `${mode === 'clear' ? 'Dados zerados' : 'Padrões restaurados'} para: ${uniqueScopes.map(key => labels[key] || key).join(', ')}.`,
    };
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
    const nextRdos = mergeByIdKeepingLatest(rdos, data.rdos);
    const nextListasPresenca = mergeByIdKeepingLatest(listasPresenca, data.listasPresenca);
    const nextOrdensServico = mergeByIdKeepingLatest(ordensServico, data.ordensServico);
    const nextPresencasLink = mergeByIdKeepingLatest(presencasLink, data.presencasLink);
    const nextHistoricoPresencas = mergeByIdKeepingLatest(historicoPresencas, data.historicoPresencas);
    const nextApontamentoRamoRegistros = mergeByIdKeepingLatest(apontamentoRamoRegistros, data.apontamentoRamoRegistros);
    const nextMateriaisRegistros = mergeByIdKeepingLatest(materiaisRegistros, data.materiaisRegistros);
    const nextPartesDiariasEquipamentos = mergeByIdKeepingLatest(partesDiariasEquipamentos, data.partesDiariasEquipamentos);
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
      { key: 'renea_rdos', value: JSON.stringify(nextRdos) },
      { key: 'renea_listas_presenca', value: JSON.stringify(nextListasPresenca) },
      { key: 'renea_ordens_servico', value: JSON.stringify(nextOrdensServico) },
      { key: 'renea_presencas_link', value: JSON.stringify(nextPresencasLink) },
      { key: 'renea_historico_presencas', value: JSON.stringify(nextHistoricoPresencas) },
      { key: 'renea_apontamento_ramo_registros', value: JSON.stringify(nextApontamentoRamoRegistros) },
      { key: 'renea_materiais_registros', value: JSON.stringify(nextMateriaisRegistros) },
      { key: 'renea_partes_diarias_equipamentos', value: JSON.stringify(nextPartesDiariasEquipamentos) },
      { key: 'renea_controle_estacas', value: JSON.stringify(nextControleEstacas) },
    ]);

    setAbastecimentos(nextAbastecimentos);
    setLubrificacoes(nextLubrificacoes);
    setTicketsJazida(nextTicketsJazida);
    setRdos(nextRdos);
    setListasPresenca(nextListasPresenca);
    setOrdensServico(nextOrdensServico);
    setPresencasLink(nextPresencasLink);
    setHistoricoPresencas(nextHistoricoPresencas);
    setApontamentoRamoRegistros(nextApontamentoRamoRegistros);
    setMateriaisRegistros(nextMateriaisRegistros);
    setPartesDiariasEquipamentos(nextPartesDiariasEquipamentos);
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
    const splitRdos = splitByArchivePeriod<RdoDiario>(rdos, item => item.data, dataInicio, dataFim);
    const splitListasPresenca = splitByArchivePeriod<ListaPresenca>(listasPresenca, item => item.data, dataInicio, dataFim);
    const splitOrdensServico = splitByArchivePeriod<OrdemServico>(ordensServico, item => item.dataAbertura, dataInicio, dataFim);
    const splitPresencasLink = splitByArchivePeriod<PresencaApontamento>(presencasLink, item => item.data, dataInicio, dataFim);
    const splitHistoricoPresencas = splitByArchivePeriod<HistoricoPresenca>(historicoPresencas, item => item.data, dataInicio, dataFim);
    const splitApontamentoRamoRegistros = splitByArchivePeriod<ApontamentoRamoRegistro>(apontamentoRamoRegistros, item => item.data, dataInicio, dataFim);
    const splitMateriaisRegistros = splitByArchivePeriod<MaterialRegistro>(materiaisRegistros, item => item.data, dataInicio, dataFim);
    const splitPartesDiariasEquipamentos = splitByArchivePeriod<ParteDiariaEquipamento>(partesDiariasEquipamentos, item => item.data, dataInicio, dataFim);
    const splitEstacasLotes = splitByArchivePeriod<ControleEstacas['lotes'][number]>(controleEstacas.lotes, item => item.data, dataInicio, dataFim);
    const splitEstacasCravacoes = splitByArchivePeriod<ControleEstacas['cravacoes'][number]>(controleEstacas.cravacoes, item => item.data, dataInicio, dataFim);

    const dados: PeriodoArquivado['dados'] = {
      abastecimentos: splitAbastecimentos.selected,
      lubrificacoes: splitLubrificacoes.selected,
      ticketsJazida: splitTicketsJazida.selected,
      rdos: splitRdos.selected,
      listasPresenca: splitListasPresenca.selected,
      ordensServico: splitOrdensServico.selected,
      presencasLink: splitPresencasLink.selected,
      historicoPresencas: splitHistoricoPresencas.selected,
      apontamentoRamoRegistros: splitApontamentoRamoRegistros.selected,
      materiaisRegistros: splitMateriaisRegistros.selected,
      partesDiariasEquipamentos: splitPartesDiariasEquipamentos.selected,
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
          { key: 'renea_rdos', value: JSON.stringify(splitRdos.remaining) },
          { key: 'renea_listas_presenca', value: JSON.stringify(splitListasPresenca.remaining) },
          { key: 'renea_ordens_servico', value: JSON.stringify(splitOrdensServico.remaining) },
          { key: 'renea_presencas_link', value: JSON.stringify(splitPresencasLink.remaining) },
          { key: 'renea_historico_presencas', value: JSON.stringify(splitHistoricoPresencas.remaining) },
          { key: 'renea_apontamento_ramo_registros', value: JSON.stringify(splitApontamentoRamoRegistros.remaining) },
          { key: 'renea_materiais_registros', value: JSON.stringify(splitMateriaisRegistros.remaining) },
          { key: 'renea_partes_diarias_equipamentos', value: JSON.stringify(splitPartesDiariasEquipamentos.remaining) },
          { key: 'renea_controle_estacas', value: JSON.stringify({ lotes: splitEstacasLotes.remaining, cravacoes: splitEstacasCravacoes.remaining }) },
          { key: 'renea_periodos_arquivados', value: JSON.stringify(nextArchives) },
        ]);
        setAbastecimentos(splitAbastecimentos.remaining);
        setLubrificacoes(splitLubrificacoes.remaining);
        setTicketsJazida(splitTicketsJazida.remaining);
        setRdos(splitRdos.remaining);
        setListasPresenca(splitListasPresenca.remaining);
        setOrdensServico(splitOrdensServico.remaining);
        setPresencasLink(splitPresencasLink.remaining);
        setHistoricoPresencas(splitHistoricoPresencas.remaining);
        setApontamentoRamoRegistros(splitApontamentoRamoRegistros.remaining);
        setMateriaisRegistros(splitMateriaisRegistros.remaining);
        setPartesDiariasEquipamentos(splitPartesDiariasEquipamentos.remaining);
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
        localStorage.setItem('renea_periodos_arquivados', JSON.stringify(nextArchives));
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
      comboios,
      combustiveis,
      lubrificantes,
      etapas,
      abastecimentos,
      lubrificacoes,
      ticketsJazida,
      rdos,
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
      controleEstacas,
      periodosArquivados,
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

  // Importação seletiva: o usuário escolhe exatamente o período (data início/fim)
  // que deseja importar do arquivo de backup. Registros com data (abastecimentos,
  // lubrificações, RDOs e listas de presença) fora do intervalo são ignorados.
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

      // Registros datados: só entram os que caem dentro do período escolhido
      const incomingAbastecimentos = (parsed.abastecimentos || []).filter((x: Abastecimento) => inRange(x.data));
      const incomingLubrificacoes = (parsed.lubrificacoes || []).filter((x: Lubrificacao) => inRange(x.data));
      const incomingRdos = (parsed.rdos || []).filter((x: RdoDiario) => inRange(x.data));
      const incomingPresencas = (parsed.listasPresenca || []).filter((x: ListaPresenca) => inRange(x.data));
      const incomingOrdensServico = (parsed.ordensServico || []).filter((x: OrdemServico) => inRange(x.dataAbertura));
      const incomingPresencasLink = (parsed.presencasLink || []).filter((x: PresencaApontamento) => inRange(x.data));
      const incomingApontamentoRamoRegistros = (parsed.apontamentoRamoRegistros || []).filter((x: ApontamentoRamoRegistro) => inRange(x.data));
      const incomingTicketsJazida = (parsed.ticketsJazida || []).filter((x: TicketJazida) => inRange(x.data));
      const incomingMateriaisRegistros = (parsed.materiaisRegistros || []).filter((x: MaterialRegistro) => inRange(x.data));
      const incomingPartesDiariasEquipamentos = (parsed.partesDiariasEquipamentos || []).filter((x: ParteDiariaEquipamento) => inRange(x.data));
      const incomingEstacasLotes = (parsed.controleEstacas?.lotes || []).filter((x: ControleEstacas['lotes'][number]) => inRange(x.data));
      const incomingEstacasCravacoes = (parsed.controleEstacas?.cravacoes || []).filter((x: ControleEstacas['cravacoes'][number]) => inRange(x.data));

      const newAbastecimentos = mergeById(abastecimentos, incomingAbastecimentos);
      const newLubrificacoes = mergeById(lubrificacoes, incomingLubrificacoes);
      const newRdos = mergeById(rdos, incomingRdos);
      const newListasPresenca = mergeById(listasPresenca, incomingPresencas);
      const newOrdensServico = mergeById(ordensServico, incomingOrdensServico);
      const newPresencasLink = mergeById(presencasLink, incomingPresencasLink);
      const newApontamentoRamoRegistros = mergeById(apontamentoRamoRegistros, incomingApontamentoRamoRegistros);
      const newTicketsJazida = mergeById(ticketsJazida, incomingTicketsJazida);
      const newMateriaisRegistros = mergeById(materiaisRegistros, incomingMateriaisRegistros);
      const newPartesDiariasEquipamentos = mergeById(partesDiariasEquipamentos, incomingPartesDiariasEquipamentos);
      const newControleEstacas: ControleEstacas = {
        lotes: mergeById(controleEstacas.lotes, incomingEstacasLotes),
        cravacoes: mergeById(controleEstacas.cravacoes, incomingEstacasCravacoes),
      };

      const totalImportados = incomingAbastecimentos.length + incomingLubrificacoes.length + incomingRdos.length + incomingPresencas.length + incomingOrdensServico.length + incomingPresencasLink.length + incomingApontamentoRamoRegistros.length + incomingTicketsJazida.length + incomingMateriaisRegistros.length + incomingPartesDiariasEquipamentos.length + incomingEstacasLotes.length + incomingEstacasCravacoes.length;
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
        { key: 'renea_rdos', value: JSON.stringify(newRdos) },
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
        { key: 'renea_controle_estacas', value: JSON.stringify(newControleEstacas) },
        { key: 'renea_history_logs', value: JSON.stringify(updatedHistory) },
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
      setRdos(newRdos);
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
      setControleEstacas(newControleEstacas);
      setHistoryLogs(updatedHistory);

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
          onReserveNumber={reservePublicTicketNumberViaApi}
          onSaveTicket={handleSaveTicketLink}
          onSearchPendingReceipts={searchPendingPublicTickets}
        />
      </Suspense>
    );
  }

  if (externalPresenceToken) {
    return (
      <Suspense fallback={<ScreenLoadingFallback label="Abrindo presença..." />}>
        <PresencaLinkExterno
          token={externalPresenceToken}
          gruposEquipe={gruposEquipe}
          funcionarios={funcionarios}
          obras={obras}
          presencasLink={presencasLink}
          isLoadingCloud={isExternalPresenceLoading}
          onSubmitPresenca={handleSubmitPresencaLink}
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
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span className="w-5 h-5 border-2 border-slate-700 border-t-emerald-500 rounded-full animate-spin" />
          Validando acesso seguro...
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100 antialiased font-sans" id="login-viewport">
        <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-lg p-7 shadow-2xl relative overflow-hidden">
          {/* Branded Logo and Header */}
          <div className="text-center mb-8 relative">
            <div className="mx-auto w-48 h-auto flex items-center justify-center mb-4">
              <img 
                src={reneaLogo} 
                alt="RENEA Infraestrutura" 
                className="w-full h-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">Sistema Integrado de Gestão Operacional</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 relative">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-xs font-bold text-slate-300 uppercase">E-mail corporativo</label>
              <input 
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="nome@empresa.com.br"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-xs font-bold text-slate-300 uppercase">Senha de acesso</label>
              <div className="relative">
                <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Senha corporativa" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-3 pr-12 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500" required />
                <button type="button" onClick={() => setShowPassword(value => !value)} title={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
                <div role="alert" className="text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-md px-3.5 py-2">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 text-white font-extrabold text-sm uppercase rounded-md shadow-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Entrar no sistema
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Acesso somente para contas autorizadas pela administração
          </div>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllAsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    localStorage.setItem('renea_notifications', JSON.stringify(updated));
  };

  const handleClearNotifications = () => {
    setNotifications([]);
    localStorage.setItem('renea_notifications', JSON.stringify([]));
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
  };

  const renderNavigation = (mobile = false) => (
    <>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          type="search"
          value={menuSearch}
          onChange={event => setMenuSearch(event.target.value)}
          placeholder="Buscar módulo"
          aria-label="Buscar módulo no menu"
          className="w-full h-9 pl-9 pr-3 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-600"
        />
      </div>
      <div className="space-y-5">
        {filteredNavigationGroups.map(group => (
          <section key={group.label} aria-label={group.label}>
            <p className="px-3 mb-1.5 text-[9px] font-black uppercase text-slate-600">{group.label}</p>
            <div className="space-y-1">
              {group.items.map(item => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTo(item.id, mobile)}
                    aria-current={active ? 'page' : undefined}
                    title={item.label}
                    className={`group w-full min-h-10 flex items-center gap-3 px-3 py-2 rounded-md text-xs font-bold transition-colors ${active ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-500 group-hover:text-emerald-400'}`} />
                    <span className="flex-1 text-left leading-tight">{item.label}</span>
                    <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'}`} />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {filteredNavigationGroups.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-slate-500">Nenhum módulo encontrado.</p>
        )}
      </div>
    </>
  );

  // Logged-in Core App Layout (Responsive Green Theme)
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row text-slate-100 antialiased font-sans" id="app-root">
      
      {/* 1. SIDEBAR NAVIGATION - DESKTOP */}
      <aside className="hidden md:flex flex-col w-72 bg-slate-900 border-r border-slate-800 shrink-0 select-none print:hidden" id="desktop-sidebar">
        {/* Branded Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950/20">
          <img 
            src={reneaLogo} 
            alt="RENEA Infraestrutura" 
            className="h-7 w-auto object-contain" 
            referrerPolicy="no-referrer" 
          />
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {renderNavigation(false)}
        </nav>

        {/* Database Status Info */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-2 text-[10px] text-slate-500 font-mono">
          <div className="flex items-center justify-between gap-1.5 font-bold mb-1">
            <div className="flex items-center gap-1.5 text-emerald-500">
              <Database className="w-3.5 h-3.5" />
              <span>Banco de Dados Local</span>
            </div>
            <div className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isFirebaseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className={isFirebaseConnected ? 'text-emerald-400' : 'text-rose-500'}>Firebase</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-y-1 text-slate-400">
            <span>Frota: {equipamentos.length}</span>
            <span>Empresas: {empresas.length}</span>
            <span>Materiais: {materiaisRegistros.length}</span>
          </div>
          <button 
            onClick={() => void handleLogout()}
            className="w-full mt-2 py-1.5 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 border border-slate-700/60 hover:border-rose-900/60 text-slate-400 rounded-lg font-bold text-[9px] flex items-center justify-center gap-1 transition-all cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            Sair da conta
          </button>
        </div>
      </aside>

      {/* 2. MOBILE NAVIGATION HEADER */}
      <header className="md:hidden flex items-center justify-between h-16 bg-slate-900 border-b border-slate-800 px-4 text-white print:hidden shrink-0" id="mobile-header">
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
            className={`p-2 rounded-md border transition-colors cursor-pointer ${activeTab === 'cadastros' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'}`}
          >
            <FolderPlus className="w-5 h-5" />
          </button>

          {/* Notification Bell Mobile */}
          <div className="relative">
            <button 
              onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)}
              className="p-2 text-slate-400 hover:text-white relative cursor-pointer"
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
            className="p-2 text-slate-400 hover:text-white cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-950/85 flex justify-end print:hidden" id="mobile-drawer">
          <div className="w-80 max-w-[88vw] bg-slate-900 border-l border-slate-800 p-5 flex flex-col space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-slate-400 tracking-wider">NAVEGAÇÃO</span>
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto">
              {renderNavigation(true)}
              <div className="pt-5 mt-5 border-t border-slate-800">
                <button type="button" onClick={() => { void handleLogout(); setIsMobileMenuOpen(false); }} className="w-full py-2.5 bg-rose-950/30 text-rose-400 hover:bg-rose-950/60 rounded-md font-bold text-xs flex items-center justify-center gap-2">
                  <LogOut className="w-4 h-4" /> Sair da conta
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* 3. MAIN WORKSPACE CONTAINER */}
      <main className="flex-1 flex flex-col overflow-y-auto" id="main-workspace">
        {/* Subtle upper banner only visible on desktop (hidden when printing) */}
        <div className="hidden md:flex items-center justify-between h-16 bg-slate-950 border-b border-slate-900 px-8 shrink-0 print:hidden select-none">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
              Renea Operacional • Canteiro de Obras Ativo
            </h2>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg">
              <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Netlify Sync</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigateTo('cadastros')}
              title="Abrir cadastros auxiliares"
              className={`h-10 px-3 rounded-md border text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${activeTab === 'cadastros' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-700'}`}
            >
              <FolderPlus className="w-4 h-4" />
              <span>Cadastros</span>
            </button>

            {/* Notification Bell Dropdown Button */}
            <div className="relative">
              <button 
                onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)}
                className={`p-2 bg-slate-900 hover:bg-slate-800 border ${isNotifDropdownOpen ? 'border-emerald-500 text-white bg-slate-800' : 'border-slate-800 text-slate-400'} hover:border-slate-700 hover:text-white rounded-xl transition-all relative cursor-pointer flex items-center justify-center`}
                title="Notificações Netlify"
              >
                {unreadCount > 0 ? (
                  <>
                    <BellRing className="w-4 h-4 text-emerald-400 animate-bounce" />
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white font-extrabold text-[8px] rounded-full flex items-center justify-center shadow-lg">
                      {unreadCount}
                    </span>
                  </>
                ) : (
                  <Bell className="w-4 h-4" />
                )}
              </button>

              {isNotifDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotifDropdownOpen(false)} />
                  <div className="absolute right-0 mt-3 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-200">Alertas Campo (Netlify)</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold">
                        {unreadCount > 0 && (
                          <button 
                            onClick={handleMarkAllAsRead}
                            className="text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            Lidas
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <>
                            <span className="text-slate-800">|</span>
                            <button 
                              onClick={handleClearNotifications}
                              className="text-slate-500 hover:text-slate-300 cursor-pointer"
                            >
                              Limpar
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {notifications.length === 0 ? (
                        <div className="py-10 text-center flex flex-col items-center justify-center text-slate-500">
                          <Bell className="w-7 h-7 text-slate-700 mb-1.5" />
                          <p className="text-[11px] italic">Sem alertas recentes</p>
                          <p className="text-[9px] text-slate-600 mt-1 max-w-[200px]">Alertas de cadastros, edições e sincronizações aparecerão aqui.</p>
                        </div>
                      ) : (
                        notifications.map(n => {
                          const borderClass = n.read ? 'border-slate-800/40 opacity-60 bg-slate-950/20' : 'border-emerald-500/20 bg-emerald-500/5';
                          const dotClass = n.type === 'success' 
                            ? 'bg-emerald-500' 
                            : n.type === 'warning' 
                            ? 'bg-amber-500' 
                            : n.type === 'error' 
                            ? 'bg-rose-500' 
                            : 'bg-blue-500';

                          return (
                            <div 
                              key={n.id} 
                              onClick={() => {
                                setNotifications(prev => {
                                  const updated = prev.map(item => item.id === n.id ? { ...item, read: true } : item);
                                  localStorage.setItem('renea_notifications', JSON.stringify(updated));
                                  return updated;
                                });
                              }}
                              className={`p-2.5 border rounded-xl space-y-1 text-left transition-all hover:bg-slate-800/40 cursor-pointer ${borderClass}`}
                            >
                              <div className="flex items-start gap-1.5 justify-between">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
                                  <span className="text-[9px] font-black uppercase tracking-wider truncate text-slate-200">{n.title}</span>
                                </div>
                                <span className="text-[9px] text-slate-500 font-mono shrink-0">{n.timestamp}</span>
                              </div>
                              <p className="text-[10px] text-slate-400 leading-normal">{n.message}</p>
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-[8px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded font-mono uppercase font-black">{n.source}</span>
                                {!n.read && <span className="text-[8px] text-emerald-400 font-bold font-mono">NOVO</span>}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest font-mono">Data do Sistema</p>
              <p className="text-xs font-semibold text-slate-300">
                {new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="h-10 px-3 rounded-md bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs font-bold text-slate-200 max-w-56">
              <div className="w-6 h-6 bg-emerald-600 rounded-md flex items-center justify-center font-bold text-white text-[10px] shrink-0">{(currentUser?.displayName || currentUser?.email || 'U').slice(0, 2).toUpperCase()}</div>
              <div className="min-w-0 text-left">
                <span className="block truncate">{currentUser?.displayName || 'Usuário RENEA'}</span>
                <span className="block truncate text-[9px] font-normal text-slate-500">{currentUser?.email}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Inner Tab Viewport */}
        <div className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto print:p-0 print:m-0">
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
                rdos={rdos}
                presencasLink={presencasLink}
                apontamentoRamos={apontamentoRamos}
                apontamentoRamoRegistros={apontamentoRamoRegistros}
                materiaisRegistros={materiaisRegistros}
                partesDiariasEquipamentos={partesDiariasEquipamentos}
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
                onImportAbastecimentos={handleImportAbastecimentos}
                oneDriveFuelSyncStatus={oneDriveFuelSyncStatus}
                onSaveLubrificacao={handleSaveLubrificacao}
                onDeleteLubrificacao={handleDeleteLubrificacao}
                onOpenCadastros={allowedTabs.includes('cadastros') ? () => navigateTo('cadastros') : undefined}
              />
            )}

            {activeTab === 'partes-diarias' && (
              <ParteDiariaEquipamentosTab
                registros={partesDiariasEquipamentos}
                equipamentos={equipamentos}
                funcionarios={funcionarios}
                obras={obras}
                onSave={handleSaveParteDiariaEquipamento}
                onDelete={handleDeleteParteDiariaEquipamento}
                onImport={handleImportPartesDiariasEquipamentos}
              />
            )}

            {activeTab === 'presenca' && (
              <PresencaTab 
                funcionarios={funcionarios}
                obras={obras}
                listasPresenca={listasPresenca}
                onSaveListaPresenca={handleSaveListaPresenca}
                onDeleteListaPresenca={handleDeleteListaPresenca}
              />
            )}

            {activeTab === 'controle-presenca' && (
              <ControlePresencaTab
                funcionarios={funcionarios}
                obras={obras}
                gruposEquipe={gruposEquipe}
                presencasLink={presencasLink}
                historicoPresencas={historicoPresencas}
                onSaveGrupoEquipe={handleSaveGrupoEquipe}
                onDeleteGrupoEquipe={handleDeleteGrupoEquipe}
                onUpdatePresencaLink={handleUpdatePresencaLink}
                onRefreshFromFirebase={handleDownloadFromFirebase}
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

            {activeTab === 'manutencao' && (
              <ManutencaoEquipamentosTab 
                equipamentos={equipamentos}
                ordensServico={ordensServico}
                onSaveOrdemServico={handleSaveOrdemServico}
                onDeleteOrdemServico={handleDeleteOrdemServico}
                onUpdateEquipamentoStatus={handleUpdateEquipamentoStatus}
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

            {activeTab === 'inteligencia' && (
              <DocumentIntelligenceTab />
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
                rdos={rdos}
                partesDiariasEquipamentos={partesDiariasEquipamentos}
              />
            )}

            {activeTab === 'configuracoes' && allowedTabs.includes('configuracoes') && (
              <ConfiguracoesTab 
                historyLogs={historyLogs}
                onResetToDefault={handleResetData}
                onClearAllData={handleClearData}
                onApplySelectiveReset={handleApplySelectiveReset}
                onImportFullData={handleImportFullData}
                onImportFilteredByDate={handleImportFilteredByDate}
                onExportFullData={handleExportFullData}
                periodosArquivados={periodosArquivados}
                onArchivePeriod={handleArchivePeriod}
                onRestoreArchivedPeriod={handleRestoreArchivedPeriod}
                onDeleteArchivedPeriod={handleDeleteArchivedPeriod}
                isFirebaseConnected={isFirebaseConnected}
                isAutoSyncEnabled={isAutoSyncEnabled}
                lastCloudSync={lastCloudSync}
                onToggleAutoSync={(val) => {
                  setIsAutoSyncEnabled(val);
                  localStorage.setItem('renea_auto_sync', val ? 'true' : 'false');
                  if (val) {
                    handleUploadToFirebase().then(result => {
                      addNotification(
                        result.success ? 'Firebase sincronizado' : 'Falha no Firebase',
                        result.message,
                        result.success ? 'success' : 'error',
                        'Firebase Cloud',
                      );
                    });
                  }
                }}
                onUploadToFirebase={handleUploadToFirebase}
                onDownloadFromFirebase={handleDownloadFromFirebase}
              />
            )}
            </motion.div>
          </Suspense>
        </div>
      </main>

      {/* Toast notifications container in the top right corner */}
      <OfflineStatusV29 />
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 w-full max-w-sm pointer-events-none select-none">
        <AnimatePresence>
          {activeToasts.map(toast => {
            const colorClass = toast.type === 'success' 
              ? 'border-emerald-500/20 bg-slate-900/95 text-emerald-400'
              : toast.type === 'warning'
              ? 'border-amber-500/20 bg-slate-900/95 text-amber-400'
              : toast.type === 'error'
              ? 'border-rose-500/20 bg-slate-900/95 text-rose-400'
              : 'border-blue-500/20 bg-slate-900/95 text-blue-400';

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 50, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, scale: 0.95 }}
                className={`pointer-events-auto border p-4 rounded-2xl shadow-2xl flex gap-3 items-start backdrop-blur-md ${colorClass}`}
              >
                <div className="mt-0.5 shrink-0">
                  {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                  {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                  {toast.type === 'error' && <XCircle className="w-5 h-5 text-rose-400" />}
                  {toast.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider block truncate text-slate-100">{toast.title}</span>
                    <span className="text-[9px] font-mono opacity-50 shrink-0 text-slate-400">{toast.timestamp}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed mt-1">{toast.message}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[8px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md font-mono uppercase font-black">{toast.source}</span>
                    <span className="text-[9px] text-slate-500">Tempo Real</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

    </div>
  );
}
