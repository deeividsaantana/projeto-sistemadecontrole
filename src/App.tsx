/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  MaterialRegistro
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
  INITIAL_MATERIAIS_CADASTRO,
  INITIAL_MATERIAIS_REGISTROS
} from './utils/initialData';

// Subcomponents Imports
import Dashboard from './components/Dashboard';
import CadastrosTab from './components/CadastrosTab';
import LancamentosTab from './components/LancamentosTab';
import RelatoriosTab from './components/RelatoriosTab';
import ConfiguracoesTab from './components/ConfiguracoesTab';
import PresencaTab from './components/PresencaTab';
import ManutencaoEquipamentosTab from './components/ManutencaoEquipamentosTab';
import ControlePresencaTab from './components/ControlePresencaTab';
import TicketsJazidaTab from './components/TicketsJazidaTab';
import PresencaLinkExterno from './components/PresencaLinkExterno';
import ApontamentoRamosTab from './components/ApontamentoRamosTab';
import ApontamentoRamoLinkExterno from './components/ApontamentoRamoLinkExterno';
import MateriaisTab from './components/MateriaisTab';

// Motion and Logo Import
import { motion, AnimatePresence } from 'motion/react';
import reneaLogo from './assets/images/logo-renea-branco.svg';

// Firebase Imports
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

// Icons Import
import { 
  LayoutDashboard, 
  ClipboardList, 
  FileText, 
  Settings, 
  HardHat, 
  Database, 
  Menu, 
  X,
  LogIn,
  LogOut,
  FolderPlus,
  ShieldCheck,
  Calendar,
  Users,
  Bell,
  BellRing,
  Wifi,
  CheckCheck,
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Wrench,
  Truck,
  BarChart3,
  Package
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

const getPresenceTokenFromUrl = () => {
  if (typeof window === 'undefined') return '';
  const byQuery = new URLSearchParams(window.location.search).get('presenca');
  if (byQuery) return decodeURIComponent(byQuery);
  const match = window.location.pathname.match(/\/presenca-link\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

const getApontamentoTokenFromUrl = () => {
  if (typeof window === 'undefined') return '';
  const byQuery = new URLSearchParams(window.location.search).get('apontamento');
  if (byQuery) return decodeURIComponent(byQuery);
  const match = window.location.pathname.match(/\/apontamento-link\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

export default function App() {
  // Login State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  // Notification and Toast States
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeToasts, setActiveToasts] = useState<AppNotification[]>([]);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState<boolean>(false);

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Firebase Sync States
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(false);
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState<boolean>(false);
  // Debounce ref for background auto-sync uploads: avoids firing one full-database
  // write per action when several actions happen in quick succession, which was
  // exhausting Firestore's queued-write limit and quota.
  const autoSyncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastCloudSync, setLastCloudSync] = useState<string>('');

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
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);
  const [isExternalPresenceLoading, setIsExternalPresenceLoading] = useState<boolean>(Boolean(getPresenceTokenFromUrl()));
  const [isExternalApontamentoLoading, setIsExternalApontamentoLoading] = useState<boolean>(Boolean(getApontamentoTokenFromUrl()));
  const externalPresenceToken = getPresenceTokenFromUrl();
  const externalApontamentoToken = getApontamentoTokenFromUrl();

  // Hydrate states from localstorage on mount
  useEffect(() => {
    // Auth persistency check
    const authSaved = localStorage.getItem('renea_is_logged_in');
    if (authSaved === 'true') {
      setIsLoggedIn(true);
    }

    const isDataLoadedV2 = localStorage.getItem('renea_data_loaded_v2') === 'true';

    if (!isDataLoadedV2) {
      localStorage.setItem('renea_empresas', JSON.stringify(INITIAL_EMPRESAS));
      localStorage.setItem('renea_obras', JSON.stringify(INITIAL_OBRAS));
      localStorage.setItem('renea_equipamentos', JSON.stringify(INITIAL_EQUIPAMENTOS));
      localStorage.setItem('renea_funcionarios', JSON.stringify(INITIAL_FUNCIONARIOS));
      localStorage.setItem('renea_comboios', JSON.stringify(INITIAL_COMBOIOS));
      localStorage.setItem('renea_combustiveis', JSON.stringify(INITIAL_TIPOS_COMBUSTIVEL));
      localStorage.setItem('renea_lubrificantes', JSON.stringify(INITIAL_PRODUTOS_LUBRIFICACAO));
      localStorage.setItem('renea_etapas', JSON.stringify(INITIAL_ETAPAS_SERVICO));
      localStorage.setItem('renea_abastecimentos', JSON.stringify(INITIAL_ABASTECIMENTOS));
      localStorage.setItem('renea_lubrificacoes', JSON.stringify(INITIAL_LUBRIFICACOES));
      localStorage.setItem('renea_tickets_jazida', JSON.stringify(INITIAL_TICKETS_JAZIDA));
      localStorage.setItem('renea_rdos', JSON.stringify(INITIAL_RDOS));
      localStorage.setItem('renea_listas_presenca', JSON.stringify(INITIAL_PRESENCAS));
      localStorage.setItem('renea_ordens_servico', JSON.stringify(INITIAL_ORDENS_SERVICO));
      localStorage.setItem('renea_grupos_equipes', JSON.stringify(INITIAL_GRUPOS_EQUIPES));
      localStorage.setItem('renea_presencas_link', JSON.stringify(INITIAL_PRESENCAS_LINK));
      localStorage.setItem('renea_historico_presencas', JSON.stringify(INITIAL_HISTORICO_PRESENCAS));
      localStorage.setItem('renea_apontamento_ramos', JSON.stringify(INITIAL_APONTAMENTO_RAMOS));
      localStorage.setItem('renea_apontamento_ramo_registros', JSON.stringify(INITIAL_APONTAMENTO_RAMO_REGISTROS));
      localStorage.setItem('renea_materiais_cadastro', JSON.stringify(INITIAL_MATERIAIS_CADASTRO));
      localStorage.setItem('renea_materiais_registros', JSON.stringify(INITIAL_MATERIAIS_REGISTROS));
      localStorage.setItem('renea_history_logs', JSON.stringify(INITIAL_HISTORY_LOGS));
      localStorage.setItem('renea_notifications', JSON.stringify(getInitialNotifications()));
      localStorage.setItem('renea_data_loaded_v2', 'true');
      localStorage.setItem('renea_colaboradores_planilha_v1', 'true');
      localStorage.setItem('renea_planilhas_operacionais_v1', 'true');
      localStorage.setItem('renea_materiais_planilha_v1', 'true');

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
      setHistoryLogs(INITIAL_HISTORY_LOGS);
      setNotifications(getInitialNotifications());
    } else {
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
      const savedHistory = localStorage.getItem('renea_history_logs');
      const savedNotifications = localStorage.getItem('renea_notifications');
      const shouldMigratePresencePeople = localStorage.getItem('renea_colaboradores_planilha_v1') !== 'true';
      const shouldMigrateSpreadsheetSeed = localStorage.getItem('renea_planilhas_operacionais_v1') !== 'true';
      const shouldMigrateMateriaisSeed = localStorage.getItem('renea_materiais_planilha_v1') !== 'true';
      const parsedEquipamentos = savedEquipamentos ? JSON.parse(savedEquipamentos) as Equipamento[] : INITIAL_EQUIPAMENTOS;
      const parsedAbastecimentos = savedAbastecimentos ? JSON.parse(savedAbastecimentos) as Abastecimento[] : INITIAL_ABASTECIMENTOS;
      const parsedTicketsJazida = savedTicketsJazida ? JSON.parse(savedTicketsJazida) as TicketJazida[] : INITIAL_TICKETS_JAZIDA;
      const parsedMateriaisCadastro = savedMateriaisCadastro ? JSON.parse(savedMateriaisCadastro) as MaterialCadastro[] : INITIAL_MATERIAIS_CADASTRO;
      const parsedMateriaisRegistros = savedMateriaisRegistros ? JSON.parse(savedMateriaisRegistros) as MaterialRegistro[] : INITIAL_MATERIAIS_REGISTROS;
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

      setEmpresas(savedEmpresas ? JSON.parse(savedEmpresas) : INITIAL_EMPRESAS);
      setObras(savedObras ? JSON.parse(savedObras) : INITIAL_OBRAS);
      setEquipamentos(loadedEquipamentos);
      setFuncionarios(shouldMigratePresencePeople ? INITIAL_FUNCIONARIOS : (savedFuncionarios ? JSON.parse(savedFuncionarios) : INITIAL_FUNCIONARIOS));
      setComboios(savedComboios ? JSON.parse(savedComboios) : INITIAL_COMBOIOS);
      setCombustiveis(savedCombustiveis ? JSON.parse(savedCombustiveis) : INITIAL_TIPOS_COMBUSTIVEL);
      setLubrificantes(savedLubrificantes ? JSON.parse(savedLubrificantes) : INITIAL_PRODUTOS_LUBRIFICACAO);
      setEtapas(savedEtapas ? JSON.parse(savedEtapas) : INITIAL_ETAPAS_SERVICO);
      setAbastecimentos(loadedAbastecimentos);
      setLubrificacoes(savedLubrificacoes ? JSON.parse(savedLubrificacoes) : INITIAL_LUBRIFICACOES);
      setTicketsJazida(loadedTicketsJazida);
      setRdos(savedRdos ? JSON.parse(savedRdos) : INITIAL_RDOS);
      setListasPresenca(shouldMigratePresencePeople ? INITIAL_PRESENCAS : (savedListasPresenca ? JSON.parse(savedListasPresenca) : INITIAL_PRESENCAS));
      setOrdensServico(savedOrdensServico ? JSON.parse(savedOrdensServico) : INITIAL_ORDENS_SERVICO);
      setGruposEquipe(shouldMigratePresencePeople ? INITIAL_GRUPOS_EQUIPES : (savedGruposEquipe ? JSON.parse(savedGruposEquipe) : INITIAL_GRUPOS_EQUIPES));
      setPresencasLink(savedPresencasLink ? JSON.parse(savedPresencasLink) : INITIAL_PRESENCAS_LINK);
      setHistoricoPresencas(savedHistoricoPresencas ? JSON.parse(savedHistoricoPresencas) : INITIAL_HISTORICO_PRESENCAS);
      const parsedApontamentoRamos = savedApontamentoRamos ? JSON.parse(savedApontamentoRamos) as ApontamentoRamo[] : INITIAL_APONTAMENTO_RAMOS;
      const shouldResetApontamentoRamos =
        !savedApontamentoRamos ||
        parsedApontamentoRamos.some(ramo => ramo.token !== INITIAL_APONTAMENTO_RAMOS[0]?.token) ||
        !INITIAL_APONTAMENTO_RAMOS.every(initial =>
          parsedApontamentoRamos.some(ramo => ramo.ramoNome === initial.ramoNome && ramo.canteiroNome === initial.canteiroNome)
        );
      const loadedApontamentoRamos = shouldResetApontamentoRamos ? INITIAL_APONTAMENTO_RAMOS : parsedApontamentoRamos;
      setApontamentoRamos(loadedApontamentoRamos);
      setApontamentoRamoRegistros(savedApontamentoRamoRegistros ? JSON.parse(savedApontamentoRamoRegistros) : INITIAL_APONTAMENTO_RAMO_REGISTROS);
      setMateriaisCadastro(loadedMateriaisCadastro);
      setMateriaisRegistros(loadedMateriaisRegistros);
      setHistoryLogs(savedHistory ? JSON.parse(savedHistory) : INITIAL_HISTORY_LOGS);
      setNotifications(savedNotifications ? JSON.parse(savedNotifications) : getInitialNotifications());

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
  }, []);


  // Check Firebase connection and load sync preferences on mount
  useEffect(() => {
    const autoSyncSaved = localStorage.getItem('renea_auto_sync') === 'true';
    setIsAutoSyncEnabled(autoSyncSaved);
    
    const savedLastSync = localStorage.getItem('renea_last_cloud_sync') || '';
    setLastCloudSync(savedLastSync);

    const checkConnection = async () => {
      try {
        const docRef = doc(db, 'sistemarenea_cloud', 'connection_test');
        await getDoc(docRef);
        setIsFirebaseConnected(true);
      } catch (error) {
        console.warn("Firebase check completed (offline or waiting configuration):", error);
        // If it was just a warning or standard check, try to resolve status
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
    customMateriaisRegistros = materiaisRegistros
  ): Promise<{ success: boolean; message: string }> => {
    // NOTE: Each data type is stored in its OWN Firestore document (instead of
    // one giant "main_data" document with everything inside). Firestore has a
    // hard 1,048,576 byte (1MB) limit per document. With all fields combined
    // into a single document, the app was hitting that limit (real error seen:
    // "size (2,524,365 bytes) exceeds the maximum allowed size of 1,048,576
    // bytes") and every sync failed. Splitting by data type keeps each document
    // far smaller and independent, so growth in one area (e.g. RDOs or
    // equipment photos) doesn't break syncing of everything else.
    const path = 'sistemarenea_cloud/*';
    const nowIso = new Date().toISOString();
    const fieldsToSync: Record<string, any> = {
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
      notifications: customNotifications,
      historyLogs: customHistory
    };
    try {
      const oversized: string[] = [];
      await Promise.all(
        Object.entries(fieldsToSync).map(async ([key, value]) => {
          const payload = { value, updatedAt: nowIso };
          // Rough size guard (Firestore's real limit accounts for encoding
          // overhead too, so we warn well before the hard 1MB ceiling).
          const approxBytes = new Blob([JSON.stringify(payload)]).size;
          if (approxBytes > 900000) {
            oversized.push(`${key} (~${(approxBytes / 1024 / 1024).toFixed(2)}MB)`);
          }
          await setDoc(doc(db, 'sistemarenea_cloud', key), payload);
        })
      );
      await setDoc(doc(db, 'sistemarenea_cloud', 'meta'), { updatedAt: nowIso });

      const nowStr = new Date().toLocaleString('pt-BR');
      setLastCloudSync(nowStr);
      localStorage.setItem('renea_last_cloud_sync', nowStr);
      setIsFirebaseConnected(true);
      if (oversized.length > 0) {
        return {
          success: true,
          message: `Sincronizado, mas atenção: os seguintes dados estão próximos do limite de tamanho do Firestore e podem falhar em breve: ${oversized.join(', ')}. Considere reduzir fotos/anexos.`
        };
      }
      return { success: true, message: 'Os dados foram sincronizados na nuvem Firebase com sucesso!' };
    } catch (error: any) {
      if (error?.message?.includes('permission') || error?.message?.includes('Permission')) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
      return { success: false, message: `Falha ao sincronizar com Firebase: ${error.message || error}` };
    }
  };

  // Firebase Download Cloud Sync
  const handleDownloadFromFirebase = async (): Promise<{ success: boolean; data?: string; message: string }> => {
    const path = 'sistemarenea_cloud/*';
    try {
      // New format: one document per data type inside the 'sistemarenea_cloud' collection.
      const snapshot = await getDocs(collection(db, 'sistemarenea_cloud'));
      const data: Record<string, any> = {};
      let foundNewFormat = false;
      snapshot.forEach(docSnap => {
        if (docSnap.id === 'meta') return;
        const docData = docSnap.data();
        if (docData && Object.prototype.hasOwnProperty.call(docData, 'value')) {
          data[docSnap.id] = docData.value;
          foundNewFormat = true;
        }
      });

      // Backward compatibility: older backups were saved as a single
      // 'main_data' document with all fields at the top level.
      if (!foundNewFormat) {
        const legacyDoc = await getDoc(doc(db, 'sistemarenea_cloud', 'main_data'));
        if (legacyDoc.exists()) {
          Object.assign(data, legacyDoc.data());
        }
      }

      if (Object.keys(data).length === 0) {
        return { success: false, message: 'Nenhum backup encontrado no Firestore.' };
      }

        // Update all local states and persist to localStorage
        if (data.empresas) {
          setEmpresas(data.empresas);
          localStorage.setItem('renea_empresas', JSON.stringify(data.empresas));
        }
        if (data.obras) {
          setObras(data.obras);
          localStorage.setItem('renea_obras', JSON.stringify(data.obras));
        }
        if (data.equipamentos) {
          setEquipamentos(data.equipamentos);
          localStorage.setItem('renea_equipamentos', JSON.stringify(data.equipamentos));
        }
        if (data.funcionarios) {
          setFuncionarios(data.funcionarios);
          localStorage.setItem('renea_funcionarios', JSON.stringify(data.funcionarios));
        }
        if (data.comboios) {
          setComboios(data.comboios);
          localStorage.setItem('renea_comboios', JSON.stringify(data.comboios));
        }
        if (data.combustiveis) {
          setCombustiveis(data.combustiveis);
          localStorage.setItem('renea_combustiveis', JSON.stringify(data.combustiveis));
        }
        if (data.lubrificantes) {
          setLubrificantes(data.lubrificantes);
          localStorage.setItem('renea_lubrificantes', JSON.stringify(data.lubrificantes));
        }
        if (data.etapas) {
          setEtapas(data.etapas);
          localStorage.setItem('renea_etapas', JSON.stringify(data.etapas));
        }
        if (data.abastecimentos) {
          setAbastecimentos(data.abastecimentos);
          localStorage.setItem('renea_abastecimentos', JSON.stringify(data.abastecimentos));
        }
        if (data.lubrificacoes) {
          setLubrificacoes(data.lubrificacoes);
          localStorage.setItem('renea_lubrificacoes', JSON.stringify(data.lubrificacoes));
        }
        if (data.ticketsJazida) {
          setTicketsJazida(data.ticketsJazida);
          localStorage.setItem('renea_tickets_jazida', JSON.stringify(data.ticketsJazida));
        }
        if (data.rdos) {
          setRdos(data.rdos);
          localStorage.setItem('renea_rdos', JSON.stringify(data.rdos));
        }
        if (data.listasPresenca) {
          setListasPresenca(data.listasPresenca);
          localStorage.setItem('renea_listas_presenca', JSON.stringify(data.listasPresenca));
        }
        if (data.ordensServico) {
          setOrdensServico(data.ordensServico);
          localStorage.setItem('renea_ordens_servico', JSON.stringify(data.ordensServico));
        }
        if (data.gruposEquipe) {
          setGruposEquipe(data.gruposEquipe);
          localStorage.setItem('renea_grupos_equipes', JSON.stringify(data.gruposEquipe));
        }
        if (data.presencasLink) {
          setPresencasLink(data.presencasLink);
          localStorage.setItem('renea_presencas_link', JSON.stringify(data.presencasLink));
        }
        if (data.historicoPresencas) {
          setHistoricoPresencas(data.historicoPresencas);
          localStorage.setItem('renea_historico_presencas', JSON.stringify(data.historicoPresencas));
        }
        if (data.apontamentoRamos) {
          setApontamentoRamos(data.apontamentoRamos);
          localStorage.setItem('renea_apontamento_ramos', JSON.stringify(data.apontamentoRamos));
        }
        if (data.apontamentoRamoRegistros) {
          setApontamentoRamoRegistros(data.apontamentoRamoRegistros);
          localStorage.setItem('renea_apontamento_ramo_registros', JSON.stringify(data.apontamentoRamoRegistros));
        }
        if (data.materiaisCadastro) {
          setMateriaisCadastro(data.materiaisCadastro);
          localStorage.setItem('renea_materiais_cadastro', JSON.stringify(data.materiaisCadastro));
        }
        if (data.materiaisRegistros) {
          setMateriaisRegistros(data.materiaisRegistros);
          localStorage.setItem('renea_materiais_registros', JSON.stringify(data.materiaisRegistros));
        }
        if (data.notifications) {
          setNotifications(data.notifications);
          localStorage.setItem('renea_notifications', JSON.stringify(data.notifications));
        }
        if (data.historyLogs) {
          setHistoryLogs(data.historyLogs);
          localStorage.setItem('renea_history_logs', JSON.stringify(data.historyLogs));
        }
        
        const nowStr = new Date().toLocaleString('pt-BR');
        setLastCloudSync(nowStr);
        localStorage.setItem('renea_last_cloud_sync', nowStr);
        setIsFirebaseConnected(true);
        return { success: true, message: 'Dados restaurados do Firebase com sucesso!' };
    } catch (error: any) {
      if (error?.message?.includes('permission') || error?.message?.includes('Permission')) {
        handleFirestoreError(error, OperationType.GET, path);
      }
      return { success: false, message: `Falha ao importar do Firebase: ${error.message || error}` };
    }
  };

  useEffect(() => {
    if (!externalPresenceToken) return;
    setIsExternalPresenceLoading(true);
    handleDownloadFromFirebase().finally(() => setIsExternalPresenceLoading(false));
  }, [externalPresenceToken]);

  useEffect(() => {
    if (!externalApontamentoToken) return;
    setIsExternalApontamentoLoading(true);
    handleDownloadFromFirebase().finally(() => setIsExternalApontamentoLoading(false));
  }, [externalApontamentoToken]);

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
      usuario: 'admin',
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

    // Handle background cloud sync if Auto Sync is active.
    // Debounced: if several actions happen in quick succession, only the last
    // one (after 2.5s of inactivity) actually triggers a Firebase write. This
    // prevents piling up multiple full-database writes at once, which used to
    // exhaust Firestore's queued-write limit and daily quota.
    if (localStorage.getItem('renea_auto_sync') === 'true') {
      if (autoSyncDebounceRef.current) {
        clearTimeout(autoSyncDebounceRef.current);
      }
      autoSyncDebounceRef.current = setTimeout(() => {
        autoSyncDebounceRef.current = null;
        const getLS = (key: string, def: any) => {
          const val = localStorage.getItem(key);
          return val ? JSON.parse(val) : def;
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
          getLS('renea_materiais_registros', INITIAL_MATERIAIS_REGISTROS)
        ).then(res => {
          if (res.success) {
            console.log("Auto-sync completed successfully.");
          } else {
            console.warn("Auto-sync failed:", res.message);
          }
        }).catch(err => {
          console.warn("Auto-sync error:", err);
        });
      }, 2500);
    }
  };

  // Auth Handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() === 'admin' && password === 'renea123') {
      setIsLoggedIn(true);
      setLoginError('');
      localStorage.setItem('renea_is_logged_in', 'true');
    } else {
      setLoginError('Usuário ou senha incorretos! Use admin / renea123.');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
    localStorage.removeItem('renea_is_logged_in');
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
        const nome = getImportValue(row, ['nome', 'empresa', 'nome fantasia', 'razao social', 'razão social']);
        if (!nome) return null;
        return {
          id: `emp-import-${now}-${index}`,
          nome,
          cnpj: getImportValue(row, ['cnpj', 'documento']),
          telefone: getImportValue(row, ['telefone', 'contato', 'celular']),
          responsavel: getImportValue(row, ['responsavel', 'responsável', 'gestor'])
        };
      }).filter(Boolean) as Empresa[];
      if (incoming.length === 0) return { success: false, message: 'Nenhuma empresa com nome foi encontrada na planilha.' };
      const result = mergeImportedRecords(empresas, incoming, item => normalizeImportText(item.cnpj || item.nome));
      return persistImport('Empresas', 'renea_empresas', setEmpresas, result.next, incoming.length, result.created, result.updated);
    }

    if (target === 'obras') {
      const incoming = validRows.map((row, index): ObraLocal | null => {
        const nome = getImportValue(row, ['nome', 'obra', 'local', 'canteiro']);
        if (!nome) return null;
        return {
          id: `obr-import-${now}-${index}`,
          nome,
          endereco: getImportValue(row, ['endereco', 'endereço', 'cidade', 'localizacao', 'localização']),
          responsavel: getImportValue(row, ['responsavel', 'responsável', 'engenheiro', 'gestor']),
          status: statusObra(getImportValue(row, ['status', 'situacao', 'situação']))
        };
      }).filter(Boolean) as ObraLocal[];
      if (incoming.length === 0) return { success: false, message: 'Nenhuma obra/local com nome foi encontrada na planilha.' };
      const result = mergeImportedRecords(obras, incoming, item => normalizeImportText(item.nome));
      return persistImport('Obras/Locais', 'renea_obras', setObras, result.next, incoming.length, result.created, result.updated);
    }

    if (target === 'equipamentos') {
      const incoming = validRows.map((row, index): Equipamento | null => {
        const prefixo = getImportValue(row, ['prefixo', 'frota', 'codigo', 'código', 'id frota']).toUpperCase();
        const nome = getImportValue(row, ['nome', 'equipamento', 'descricao', 'descrição', 'maquina', 'máquina']);
        if (!prefixo || !nome) return null;
        return {
          id: `eq-import-${now}-${index}`,
          prefixo,
          nome,
          tipo: getImportValue(row, ['tipo', 'tipo equipamento', 'categoria']) || 'Outro',
          marca: getImportValue(row, ['marca']),
          modelo: getImportValue(row, ['modelo']),
          seriePlaca: getImportValue(row, ['serie', 'série', 'numero serie', 'número série', 'numero de serie', 'número de série', 'serie placa', 'série placa']).toUpperCase(),
          placa: getImportValue(row, ['placa', 'placa veiculo', 'placa veículo']).toUpperCase() || undefined,
          empresaId: findEmpresaId(getImportValue(row, ['empresa', 'proprietario', 'proprietário', 'empresa proprietaria', 'empresa proprietária'])),
          status: statusEquipamento(getImportValue(row, ['status', 'situacao', 'situação'])),
          localAtualId: findObraId(getImportValue(row, ['obra', 'local', 'canteiro', 'local atual', 'obra atual'])),
          observacao: getImportValue(row, ['observacao', 'observação', 'obs']),
          horasDisponiveis: numberFromImport(getImportValue(row, ['horas disponiveis', 'horas disponíveis', 'horas disp'])),
          horasIndisponiveis: numberFromImport(getImportValue(row, ['horas indisponiveis', 'horas indisponíveis', 'horas manutencao', 'horas manutenção']))
        };
      }).filter(Boolean) as Equipamento[];
      if (incoming.length === 0) return { success: false, message: 'Nenhum equipamento com prefixo e nome foi encontrado na planilha.' };
      const result = mergeImportedRecords(equipamentos, incoming, item => normalizeImportText(item.prefixo));
      return persistImport('Equipamentos', 'renea_equipamentos', setEquipamentos, result.next, incoming.length, result.created, result.updated);
    }

    if (target === 'funcionarios') {
      const incoming = validRows.map((row, index): Funcionario | null => {
        const nome = getImportValue(row, ['nome', 'funcionario', 'funcionário', 'colaborador']);
        if (!nome) return null;
        const ativoValue = normalizeImportText(getImportValue(row, ['ativo', 'status', 'situacao', 'situação']));
        return {
          id: getImportValue(row, ['matricula', 'matrícula']) || `fun-import-${now}-${index}`,
          matricula: getImportValue(row, ['matricula', 'matrícula']) || undefined,
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
      if (incoming.length === 0) return { success: false, message: 'Nenhum funcionário com nome foi encontrado na planilha.' };
      const result = mergeImportedRecords(funcionarios, incoming, item => normalizeImportText(item.matricula || item.nome));
      return persistImport('Funcionários', 'renea_funcionarios', setFuncionarios, result.next, incoming.length, result.created, result.updated);
    }

    if (target === 'comboios') {
      const incoming = validRows.map((row, index): Comboio | null => {
        const nome = getImportValue(row, ['nome', 'comboio', 'identificacao', 'identificação']);
        if (!nome) return null;
        return {
          id: `com-import-${now}-${index}`,
          nome,
          placa: getImportValue(row, ['placa']).toUpperCase(),
          capacidadeLitros: numberFromImport(getImportValue(row, ['capacidade', 'capacidade litros', 'litros'])) || 3000,
          responsavel: getImportValue(row, ['responsavel', 'responsável', 'motorista'])
        };
      }).filter(Boolean) as Comboio[];
      if (incoming.length === 0) return { success: false, message: 'Nenhum comboio com identificação foi encontrado na planilha.' };
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

  // Recalcula a "cadeia da bomba" de cada comboio: ordena os abastecimentos de um
  // mesmo comboio cronologicamente (data + hora) e faz com que a Bomba Final de
  // cada lançamento vire automaticamente a Bomba Inicial do lançamento seguinte,
  // propagando o ajuste adiante sempre que algo é criado, editado ou excluído.
  const recalcularCadeiaBombas = (lista: Abastecimento[]): Abastecimento[] => {
    const porComboio = new Map<string, Abastecimento[]>();
    lista.forEach(item => {
      const arr = porComboio.get(item.comboioId) || [];
      arr.push(item);
      porComboio.set(item.comboioId, arr);
    });

    const recalculados = new Map<string, Abastecimento>();
    porComboio.forEach(registros => {
      const ordenados = [...registros].sort((a, b) => {
        const chaveA = `${a.data} ${a.hora}`;
        const chaveB = `${b.data} ${b.hora}`;
        return chaveA.localeCompare(chaveB);
      });
      let bombaAnterior: number | null = null;
      ordenados.forEach(item => {
        const bombaInicial = bombaAnterior === null ? item.bombaInicial : bombaAnterior;
        const bombaFinal = bombaInicial + item.quantidadeLitros;
        recalculados.set(item.id, { ...item, bombaInicial, bombaFinal });
        bombaAnterior = bombaFinal;
      });
    });

    return lista.map(item => recalculados.get(item.id) || item);
  };

  // Transaction Handlers
  const handleSaveAbastecimento = (item: Abastecimento, isNew: boolean) => {
    let updated;
    if (isNew) {
      updated = [...abastecimentos, item];
    } else {
      updated = abastecimentos.map(x => x.id === item.id ? item : x);
    }
    updated = recalcularCadeiaBombas(updated);
    const eq = equipamentos.find(e => e.id === item.equipamentoId);
    saveAndLog(
      'Abastecimentos', 
      isNew ? 'Criou' : 'Editou', 
      `${isNew ? 'Lançou' : 'Editou'} abastecimento de ${item.quantidadeLitros}L para ${eq ? eq.prefixo : 'Frota'}.`,
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
    updated = recalcularCadeiaBombas(updated);
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
  const handleImportAbastecimentos = (novosItens: Abastecimento[]) => {
    if (!novosItens || novosItens.length === 0) return;
    let updated = [...abastecimentos, ...novosItens];
    updated = recalcularCadeiaBombas(updated);
    saveAndLog(
      'Abastecimentos',
      'Criou',
      `Importou ${novosItens.length} registro(s) de combustível via planilha Excel.`,
      historyLogs,
      () => {
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
  };

  const handleImportTicketsJazida = (novosItens: TicketJazida[]) => {
    if (!novosItens || novosItens.length === 0) return;
    const updated = mergeSeedRecords(
      ticketsJazida,
      novosItens,
      item => `${item.tipoTicket || 'Liberação'}|${item.data}|${item.ticketNumero}|${item.prefixo}`.toLowerCase()
    );
    saveAndLog(
      'Tickets Jazida',
      'Criou',
      `Importou ${updated.length - ticketsJazida.length} ticket(s) de liberação/recebimento via planilha.`,
      historyLogs,
      () => {
        setTicketsJazida(updated);
        localStorage.setItem('renea_tickets_jazida', JSON.stringify(updated));
      }
    );
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

    // Add to active toasts
    setActiveToasts(prev => [...prev, newNotif]);
    setTimeout(() => {
      setActiveToasts(prev => prev.filter(t => t.id !== newNotif.id));
    }, 6000);
  };

  const persistPresenceNotifications = (newItems: AppNotification[]) => {
    const updated = [...newItems, ...notifications].slice(0, 50);
    setNotifications(updated);
    localStorage.setItem('renea_notifications', JSON.stringify(updated));
    setActiveToasts(prev => [...prev, ...newItems]);
    newItems.forEach(item => {
      setTimeout(() => {
        setActiveToasts(prev => prev.filter(t => t.id !== item.id));
      }, 6000);
    });
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
      return val ? JSON.parse(val) : def;
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
      getLS('renea_materiais_registros', INITIAL_MATERIAIS_REGISTROS)
    );
  };

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
    setTimeout(() => uploadLocalSnapshotToFirebase(), 120);
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
    setTimeout(() => uploadLocalSnapshotToFirebase(), 120);
  };

  const handleSubmitPresencaLink = async (
    grupo: GrupoEquipe,
    data: string,
    items: Array<{ funcionarioId: string; status: PresencaStatus; observacao: string }>
  ): Promise<{ success: boolean; message: string }> => {
    const alreadySent = presencasLink.some(item => item.grupoId === grupo.id && item.data === data);
    if (alreadySent) {
      const updatedNotifications = persistPresenceNotifications([
        createPresenceNotification(
          'Reenvio bloqueado',
          `Alguém tentou reenviar a presença do grupo ${grupo.nome} para ${data}.`,
          'warning'
        )
      ]);
      await handleUploadToFirebase(
        empresas, obras, equipamentos, funcionarios, comboios, combustiveis, lubrificantes, etapas,
        abastecimentos, lubrificacoes, ticketsJazida, rdos, historyLogs, listasPresenca, ordensServico,
        gruposEquipe, presencasLink, historicoPresencas, updatedNotifications
      );
      return { success: false, message: 'A presença deste grupo já foi enviada para esta data.' };
    }

    const now = new Date();
    const horaEnvio = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const createdAt = now.toISOString();
    const newRecords: PresencaApontamento[] = items.map(item => {
      const funcionario = funcionarios.find(func => func.id === item.funcionarioId);
      return {
        id: `plink-${grupo.id}-${item.funcionarioId}-${data}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        data,
        horaEnvio,
        grupoId: grupo.id,
        grupoNome: grupo.nome,
        responsavel: grupo.responsavel,
        frenteServico: grupo.frenteServico,
        funcionarioId: item.funcionarioId,
        funcionarioNome: funcionario?.nome || item.funcionarioId,
        funcao: funcionario?.cargo || '',
        status: item.status,
        observacao: item.observacao,
        tokenUsado: grupo.token,
        createdAt
      };
    });

    const updatedPresencas = [...presencasLink, ...newRecords];
    setPresencasLink(updatedPresencas);
    localStorage.setItem('renea_presencas_link', JSON.stringify(updatedPresencas));

    const logMessage = `O grupo ${grupo.nome} enviou a presença do dia ${data} às ${horaEnvio}.`;
    const newLog: HistoryLog = {
      id: `log-pres-${Date.now()}`,
      timestamp: new Date().toLocaleString('pt-BR'),
      usuario: grupo.responsavel,
      acao: 'Criou',
      tela: 'Controle de Presença',
      descricao: logMessage
    };
    const updatedHistory = [newLog, ...historyLogs];
    setHistoryLogs(updatedHistory);
    localStorage.setItem('renea_history_logs', JSON.stringify(updatedHistory));

    const absentCount = newRecords.filter(item => item.status === 'Ausente').length;
    const notificationsToAdd: AppNotification[] = [
      createPresenceNotification('Presença enviada', logMessage, 'success')
    ];
    if (absentCount > 0) {
      notificationsToAdd.push(createPresenceNotification(
        'Funcionário ausente',
        `${absentCount} funcionário(s) foram marcados como ausentes no grupo ${grupo.nome}.`,
        'warning'
      ));
    }
    if (absentCount >= 3 || (newRecords.length > 0 && absentCount / newRecords.length >= 0.3)) {
      notificationsToAdd.push(createPresenceNotification(
        'Muitas ausências',
        `O grupo ${grupo.nome} registrou volume elevado de ausências.`,
        'warning'
      ));
    }
    if (horaEnvio < '06:00' || horaEnvio > '09:00') {
      notificationsToAdd.push(createPresenceNotification(
        'Envio fora do horário',
        `O grupo ${grupo.nome} enviou presença às ${horaEnvio}.`,
        'warning'
      ));
    }

    const updatedNotifications = persistPresenceNotifications(notificationsToAdd);
    const syncResult = await handleUploadToFirebase(
      empresas, obras, equipamentos, funcionarios, comboios, combustiveis, lubrificantes, etapas,
      abastecimentos, lubrificacoes, ticketsJazida, rdos, updatedHistory, listasPresenca, ordensServico,
      gruposEquipe, updatedPresencas, historicoPresencas, updatedNotifications
    );

    return {
      success: true,
      message: syncResult.success
        ? 'Presença enviada e sincronizada com sucesso.'
        : 'Presença salva neste dispositivo. A sincronização Firebase não respondeu agora.'
    };
  };

  const handleUpdatePresencaLink = (id: string, status: PresencaStatus, observacao: string, motivo: string) => {
    const item = presencasLink.find(row => row.id === id);
    if (!item) return;

    const updatedItem: PresencaApontamento = {
      ...item,
      status,
      observacao,
      updatedAt: new Date().toISOString(),
      atualizadoPor: 'admin',
      motivoAlteracao: motivo
    };
    const updatedPresencas = presencasLink.map(row => row.id === id ? updatedItem : row);
    const historico: HistoricoPresenca = {
      id: `hist-pres-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      presencaId: id,
      grupoId: item.grupoId,
      funcionarioId: item.funcionarioId,
      data: item.data,
      editadoPor: 'admin',
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
    setTimeout(() => uploadLocalSnapshotToFirebase(), 120);
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
    setTimeout(() => uploadLocalSnapshotToFirebase(), 120);
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
    setTimeout(() => uploadLocalSnapshotToFirebase(), 120);
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
    setTimeout(() => uploadLocalSnapshotToFirebase(), 120);
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
    setTimeout(() => uploadLocalSnapshotToFirebase(), 120);
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
    setTimeout(() => uploadLocalSnapshotToFirebase(), 120);
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
    setTimeout(() => uploadLocalSnapshotToFirebase(), 120);
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
    setTimeout(() => uploadLocalSnapshotToFirebase(), 120);
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
    setTimeout(() => uploadLocalSnapshotToFirebase(), 120);
    return { success: true, message: logMsg };
  };

  const handleSubmitApontamentoRamoLink = async (
    ramo: ApontamentoRamo,
    payload: {
      data: string;
      empresa: string;
      responsavel: string;
      funcaoApontador: string;
      funcoes: ApontamentoQuantidadeItem[];
      equipamentos: ApontamentoQuantidadeItem[];
      clima: Record<TurnoApontamento, ClimaApontamento>;
      condicao: Record<TurnoApontamento, CondicaoApontamento>;
      descricaoAtividade: string;
      observacao: string;
    }
  ): Promise<{ success: boolean; message: string }> => {
    const responsavelApontador = payload.responsavel.trim();
    if (!responsavelApontador) {
      return { success: false, message: 'Informe o nome do apontador antes de enviar.' };
    }

    const alreadySent = apontamentoRamoRegistros.some(item => item.ramoId === ramo.id && item.data === payload.data);
    if (alreadySent) {
      const updatedNotifications = persistPresenceNotifications([
        createPresenceNotification(
          'Reenvio bloqueado',
          `Alguém tentou reenviar o apontamento do ramo ${ramo.ramoNome} para ${payload.data}.`,
          'warning'
        )
      ]);
      await handleUploadToFirebase(
        empresas, obras, equipamentos, funcionarios, comboios, combustiveis, lubrificantes, etapas,
        abastecimentos, lubrificacoes, ticketsJazida, rdos, historyLogs, listasPresenca, ordensServico,
        gruposEquipe, presencasLink, historicoPresencas, updatedNotifications,
        apontamentoRamos, apontamentoRamoRegistros
      );
      return { success: false, message: 'Este ramo já recebeu apontamento para esta data.' };
    }

    const now = new Date();
    const horaEnvio = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const cleanQuantidade = (items: ApontamentoQuantidadeItem[]) =>
      items.map(item => ({ ...item, quantidade: Math.max(0, Number(item.quantidade) || 0) }));

    const newRegistro: ApontamentoRamoRegistro = {
      id: `apramo-${ramo.id}-${payload.data}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      data: payload.data,
      horaEnvio,
      ramoId: ramo.id,
      canteiroNome: ramo.canteiroNome,
      ramoNome: ramo.ramoNome,
      empresa: payload.empresa,
      responsavel: responsavelApontador,
      funcaoApontador: payload.funcaoApontador || 'Apontador',
      funcoes: cleanQuantidade(payload.funcoes),
      equipamentos: cleanQuantidade(payload.equipamentos),
      clima: payload.clima,
      condicao: payload.condicao,
      descricaoAtividade: payload.descricaoAtividade,
      observacao: payload.observacao,
      tokenUsado: ramo.token,
      createdAt: now.toISOString()
    };

    const updatedRegistros = [newRegistro, ...apontamentoRamoRegistros];
    setApontamentoRamoRegistros(updatedRegistros);
    localStorage.setItem('renea_apontamento_ramo_registros', JSON.stringify(updatedRegistros));

    const logMessage = `O ramo ${ramo.ramoNome} (${ramo.canteiroNome}) enviou apontamento do dia ${payload.data} às ${horaEnvio}.`;
    const newLog: HistoryLog = {
      id: `log-apramo-${Date.now()}`,
      timestamp: new Date().toLocaleString('pt-BR'),
      usuario: responsavelApontador,
      acao: 'Criou',
      tela: 'Apontamentos',
      descricao: logMessage
    };
    const updatedHistory = [newLog, ...historyLogs];
    setHistoryLogs(updatedHistory);
    localStorage.setItem('renea_history_logs', JSON.stringify(updatedHistory));

    const totalFuncoes = newRegistro.funcoes.reduce((sum, item) => sum + item.quantidade, 0);
    const totalEquipamentos = newRegistro.equipamentos.reduce((sum, item) => sum + item.quantidade, 0);
    const notificationsToAdd: AppNotification[] = [
      createPresenceNotification('Apontamento enviado', logMessage, 'success')
    ];
    if (Object.values(newRegistro.condicao).includes('Impraticável')) {
      notificationsToAdd.push(createPresenceNotification(
        'Condição impraticável',
        `O ramo ${ramo.ramoNome} registrou condição impraticável em pelo menos um turno.`,
        'warning'
      ));
    }
    if (totalFuncoes === 0 && totalEquipamentos === 0) {
      notificationsToAdd.push(createPresenceNotification(
        'Apontamento sem quantidade',
        `O ramo ${ramo.ramoNome} enviou apontamento sem mão de obra ou equipamento informado.`,
        'warning'
      ));
    }

    const updatedNotifications = persistPresenceNotifications(notificationsToAdd);
    const syncResult = await handleUploadToFirebase(
      empresas, obras, equipamentos, funcionarios, comboios, combustiveis, lubrificantes, etapas,
      abastecimentos, lubrificacoes, ticketsJazida, rdos, updatedHistory, listasPresenca, ordensServico,
      gruposEquipe, presencasLink, historicoPresencas, updatedNotifications,
      apontamentoRamos, updatedRegistros
    );

    return {
      success: true,
      message: syncResult.success
        ? 'Apontamento enviado e sincronizado com sucesso.'
        : 'Apontamento salvo neste dispositivo. A sincronização Firebase não respondeu agora.'
    };
  };


  // Administration helpers
  const handleImportData = (imported: {
    empresas: Empresa[];
    obras: ObraLocal[];
    equipamentos: Equipamento[];
    funcionarios: Funcionario[];
    comboios: Comboio[];
    combustiveis: TipoCombustivel[];
    lubrificantes: ProdutoLubrificacao[];
    etapas: EtapaServico[];
    abastecimentos: Abastecimento[];
    lubrificacoes: Lubrificacao[];
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
    notifications?: AppNotification[];
    historyLogs?: HistoryLog[];
  }) => {
    setEmpresas(imported.empresas || []);
    setObras(imported.obras || []);
    setEquipamentos(imported.equipamentos || []);
    setFuncionarios(imported.funcionarios || []);
    setComboios(imported.comboios || []);
    setCombustiveis(imported.combustiveis || []);
    setLubrificantes(imported.lubrificantes || []);
    setEtapas(imported.etapas || []);
    setAbastecimentos(imported.abastecimentos || []);
    setLubrificacoes(imported.lubrificacoes || []);
    setTicketsJazida(imported.ticketsJazida || []);
    setRdos(imported.rdos || []);
    setListasPresenca(imported.listasPresenca || []);
    setOrdensServico(imported.ordensServico || []);
    setGruposEquipe(imported.gruposEquipe || []);
    setPresencasLink(imported.presencasLink || []);
    setHistoricoPresencas(imported.historicoPresencas || []);
    setApontamentoRamos(imported.apontamentoRamos || []);
    setApontamentoRamoRegistros(imported.apontamentoRamoRegistros || []);
    setMateriaisCadastro(imported.materiaisCadastro || []);
    setMateriaisRegistros(imported.materiaisRegistros || []);
    setNotifications(imported.notifications || []);
    
    const logs = imported.historyLogs || [{
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleString('pt-BR'),
      usuario: 'admin',
      acao: 'Editou',
      tela: 'Banco de Dados',
      descricao: 'Restaurou backup completo do sistema com sucesso.'
    }];
    setHistoryLogs(logs);

    localStorage.setItem('renea_empresas', JSON.stringify(imported.empresas || []));
    localStorage.setItem('renea_obras', JSON.stringify(imported.obras || []));
    localStorage.setItem('renea_equipamentos', JSON.stringify(imported.equipamentos || []));
    localStorage.setItem('renea_funcionarios', JSON.stringify(imported.funcionarios || []));
    localStorage.setItem('renea_comboios', JSON.stringify(imported.comboios || []));
    localStorage.setItem('renea_combustiveis', JSON.stringify(imported.combustiveis || []));
    localStorage.setItem('renea_lubrificantes', JSON.stringify(imported.lubrificantes || []));
    localStorage.setItem('renea_etapas', JSON.stringify(imported.etapas || []));
    localStorage.setItem('renea_abastecimentos', JSON.stringify(imported.abastecimentos || []));
    localStorage.setItem('renea_lubrificacoes', JSON.stringify(imported.lubrificacoes || []));
    localStorage.setItem('renea_tickets_jazida', JSON.stringify(imported.ticketsJazida || []));
    localStorage.setItem('renea_rdos', JSON.stringify(imported.rdos || []));
    localStorage.setItem('renea_listas_presenca', JSON.stringify(imported.listasPresenca || []));
    localStorage.setItem('renea_ordens_servico', JSON.stringify(imported.ordensServico || []));
    localStorage.setItem('renea_grupos_equipes', JSON.stringify(imported.gruposEquipe || []));
    localStorage.setItem('renea_presencas_link', JSON.stringify(imported.presencasLink || []));
    localStorage.setItem('renea_historico_presencas', JSON.stringify(imported.historicoPresencas || []));
    localStorage.setItem('renea_apontamento_ramos', JSON.stringify(imported.apontamentoRamos || []));
    localStorage.setItem('renea_apontamento_ramo_registros', JSON.stringify(imported.apontamentoRamoRegistros || []));
    localStorage.setItem('renea_materiais_cadastro', JSON.stringify(imported.materiaisCadastro || []));
    localStorage.setItem('renea_materiais_registros', JSON.stringify(imported.materiaisRegistros || []));
    localStorage.setItem('renea_notifications', JSON.stringify(imported.notifications || []));
    localStorage.setItem('renea_history_logs', JSON.stringify(logs));
  };

  const handleResetData = () => {
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
    setHistoryLogs(INITIAL_HISTORY_LOGS);

    localStorage.setItem('renea_empresas', JSON.stringify(INITIAL_EMPRESAS));
    localStorage.setItem('renea_obras', JSON.stringify(INITIAL_OBRAS));
    localStorage.setItem('renea_equipamentos', JSON.stringify(INITIAL_EQUIPAMENTOS));
    localStorage.setItem('renea_funcionarios', JSON.stringify(INITIAL_FUNCIONARIOS));
    localStorage.setItem('renea_comboios', JSON.stringify(INITIAL_COMBOIOS));
    localStorage.setItem('renea_combustiveis', JSON.stringify(INITIAL_TIPOS_COMBUSTIVEL));
    localStorage.setItem('renea_lubrificantes', JSON.stringify(INITIAL_PRODUTOS_LUBRIFICACAO));
    localStorage.setItem('renea_etapas', JSON.stringify(INITIAL_ETAPAS_SERVICO));
    localStorage.setItem('renea_abastecimentos', JSON.stringify(INITIAL_ABASTECIMENTOS));
    localStorage.setItem('renea_lubrificacoes', JSON.stringify(INITIAL_LUBRIFICACOES));
    localStorage.setItem('renea_rdos', JSON.stringify(INITIAL_RDOS));
    localStorage.setItem('renea_listas_presenca', JSON.stringify(INITIAL_PRESENCAS));
    localStorage.setItem('renea_ordens_servico', JSON.stringify(INITIAL_ORDENS_SERVICO));
    localStorage.setItem('renea_grupos_equipes', JSON.stringify(INITIAL_GRUPOS_EQUIPES));
    localStorage.setItem('renea_presencas_link', JSON.stringify(INITIAL_PRESENCAS_LINK));
    localStorage.setItem('renea_historico_presencas', JSON.stringify(INITIAL_HISTORICO_PRESENCAS));
    localStorage.setItem('renea_apontamento_ramos', JSON.stringify(INITIAL_APONTAMENTO_RAMOS));
    localStorage.setItem('renea_apontamento_ramo_registros', JSON.stringify(INITIAL_APONTAMENTO_RAMO_REGISTROS));
    localStorage.setItem('renea_materiais_cadastro', JSON.stringify(INITIAL_MATERIAIS_CADASTRO));
    localStorage.setItem('renea_materiais_registros', JSON.stringify(INITIAL_MATERIAIS_REGISTROS));
    localStorage.setItem('renea_history_logs', JSON.stringify(INITIAL_HISTORY_LOGS));
    localStorage.setItem('renea_colaboradores_planilha_v1', 'true');
    localStorage.setItem('renea_materiais_planilha_v1', 'true');
  };

  const handleClearData = () => {
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
    setHistoryLogs([{
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleString('pt-BR'),
      usuario: 'admin',
      acao: 'Excluiu',
      tela: 'Banco de Dados',
      descricao: 'Limpou completamente todas as tabelas de dados do sistema.'
    }]);

    localStorage.setItem('renea_empresas', JSON.stringify([]));
    localStorage.setItem('renea_obras', JSON.stringify([]));
    localStorage.setItem('renea_equipamentos', JSON.stringify([]));
    localStorage.setItem('renea_funcionarios', JSON.stringify([]));
    localStorage.setItem('renea_comboios', JSON.stringify([]));
    localStorage.setItem('renea_combustiveis', JSON.stringify([]));
    localStorage.setItem('renea_lubrificantes', JSON.stringify([]));
    localStorage.setItem('renea_etapas', JSON.stringify([]));
    localStorage.setItem('renea_abastecimentos', JSON.stringify([]));
    localStorage.setItem('renea_lubrificacoes', JSON.stringify([]));
    localStorage.setItem('renea_tickets_jazida', JSON.stringify([]));
    localStorage.setItem('renea_rdos', JSON.stringify([]));
    localStorage.setItem('renea_listas_presenca', JSON.stringify([]));
    localStorage.setItem('renea_ordens_servico', JSON.stringify([]));
    localStorage.setItem('renea_grupos_equipes', JSON.stringify([]));
    localStorage.setItem('renea_presencas_link', JSON.stringify([]));
    localStorage.setItem('renea_historico_presencas', JSON.stringify([]));
    localStorage.setItem('renea_apontamento_ramos', JSON.stringify([]));
    localStorage.setItem('renea_apontamento_ramo_registros', JSON.stringify([]));
    localStorage.setItem('renea_materiais_cadastro', JSON.stringify([]));
    localStorage.setItem('renea_materiais_registros', JSON.stringify([]));
    localStorage.setItem('renea_history_logs', JSON.stringify([]));
  };

  const handleExportFullData = (): string => {
    return JSON.stringify({
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
      notifications,
      historyLogs
    }, null, 2);
  };


  const handleImportFullData = (importedJson: string): boolean => {
    try {
      const parsed = JSON.parse(importedJson);
      // Basic sanity checks
      if (!parsed || typeof parsed !== 'object') return false;
      if (!Array.isArray(parsed.empresas) || !Array.isArray(parsed.equipamentos) || !Array.isArray(parsed.abastecimentos)) {
        return false;
      }
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
      if (!parsed || typeof parsed !== 'object') {
        return { success: false, message: 'Arquivo de backup inválido.' };
      }

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

      const newAbastecimentos = mergeById(abastecimentos, incomingAbastecimentos);
      const newLubrificacoes = mergeById(lubrificacoes, incomingLubrificacoes);
      const newRdos = mergeById(rdos, incomingRdos);
      const newListasPresenca = mergeById(listasPresenca, incomingPresencas);
      const newOrdensServico = mergeById(ordensServico, incomingOrdensServico);
      const newPresencasLink = mergeById(presencasLink, incomingPresencasLink);
      const newApontamentoRamoRegistros = mergeById(apontamentoRamoRegistros, incomingApontamentoRamoRegistros);
      const newTicketsJazida = mergeById(ticketsJazida, incomingTicketsJazida);
      const newMateriaisRegistros = mergeById(materiaisRegistros, incomingMateriaisRegistros);

      setEmpresas(newEmpresas); localStorage.setItem('renea_empresas', JSON.stringify(newEmpresas));
      setObras(newObras); localStorage.setItem('renea_obras', JSON.stringify(newObras));
      setEquipamentos(newEquipamentos); localStorage.setItem('renea_equipamentos', JSON.stringify(newEquipamentos));
      setFuncionarios(newFuncionarios); localStorage.setItem('renea_funcionarios', JSON.stringify(newFuncionarios));
      setComboios(newComboios); localStorage.setItem('renea_comboios', JSON.stringify(newComboios));
      setCombustiveis(newCombustiveis); localStorage.setItem('renea_combustiveis', JSON.stringify(newCombustiveis));
      setLubrificantes(newLubrificantes); localStorage.setItem('renea_lubrificantes', JSON.stringify(newLubrificantes));
      setEtapas(newEtapas); localStorage.setItem('renea_etapas', JSON.stringify(newEtapas));
      setAbastecimentos(newAbastecimentos); localStorage.setItem('renea_abastecimentos', JSON.stringify(newAbastecimentos));
      setLubrificacoes(newLubrificacoes); localStorage.setItem('renea_lubrificacoes', JSON.stringify(newLubrificacoes));
      setTicketsJazida(newTicketsJazida); localStorage.setItem('renea_tickets_jazida', JSON.stringify(newTicketsJazida));
      setRdos(newRdos); localStorage.setItem('renea_rdos', JSON.stringify(newRdos));
      setListasPresenca(newListasPresenca); localStorage.setItem('renea_listas_presenca', JSON.stringify(newListasPresenca));
      setOrdensServico(newOrdensServico); localStorage.setItem('renea_ordens_servico', JSON.stringify(newOrdensServico));
      setGruposEquipe(newGruposEquipe); localStorage.setItem('renea_grupos_equipes', JSON.stringify(newGruposEquipe));
      setPresencasLink(newPresencasLink); localStorage.setItem('renea_presencas_link', JSON.stringify(newPresencasLink));
      setHistoricoPresencas(newHistoricoPresencas); localStorage.setItem('renea_historico_presencas', JSON.stringify(newHistoricoPresencas));
      setApontamentoRamos(newApontamentoRamos); localStorage.setItem('renea_apontamento_ramos', JSON.stringify(newApontamentoRamos));
      setApontamentoRamoRegistros(newApontamentoRamoRegistros); localStorage.setItem('renea_apontamento_ramo_registros', JSON.stringify(newApontamentoRamoRegistros));
      setMateriaisCadastro(newMateriaisCadastro); localStorage.setItem('renea_materiais_cadastro', JSON.stringify(newMateriaisCadastro));
      setMateriaisRegistros(newMateriaisRegistros); localStorage.setItem('renea_materiais_registros', JSON.stringify(newMateriaisRegistros));

      const totalImportados = incomingAbastecimentos.length + incomingLubrificacoes.length + incomingRdos.length + incomingPresencas.length + incomingOrdensServico.length + incomingPresencasLink.length + incomingApontamentoRamoRegistros.length + incomingTicketsJazida.length + incomingMateriaisRegistros.length;
      const logMsg = `Importou seletivamente ${totalImportados} registro(s) datado(s) entre ${dataInicio || 'início'} e ${dataFim || 'fim'}, além dos cadastros base.`;
      const newLog: HistoryLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleString('pt-BR'),
        usuario: 'admin',
        acao: 'Criou',
        tela: 'Banco de Dados',
        descricao: logMsg
      };
      const updatedHistory = [newLog, ...historyLogs];
      setHistoryLogs(updatedHistory);
      localStorage.setItem('renea_history_logs', JSON.stringify(updatedHistory));

      addNotification('Importação por Período Concluída', logMsg, 'success', 'Sistema Local');

      return { success: true, message: `Importação concluída! ${totalImportados} registro(s) do período selecionado foram adicionados/atualizados.` };
    } catch (e) {
      return { success: false, message: 'Falha ao ler ou processar o arquivo de backup.' };
    }
  };

  if (externalPresenceToken) {
    return (
      <PresencaLinkExterno
        token={externalPresenceToken}
        gruposEquipe={gruposEquipe}
        funcionarios={funcionarios}
        obras={obras}
        presencasLink={presencasLink}
        isLoadingCloud={isExternalPresenceLoading}
        onSubmitPresenca={handleSubmitPresencaLink}
      />
    );
  }

  if (externalApontamentoToken) {
    return (
      <ApontamentoRamoLinkExterno
        token={externalApontamentoToken}
        ramos={apontamentoRamos}
        registros={apontamentoRamoRegistros}
        isLoadingCloud={isExternalApontamentoLoading}
        onSubmitApontamento={handleSubmitApontamentoRamoLink}
      />
    );
  }

  // Login Screen Render
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100 antialiased font-sans" id="login-viewport">
        <div className="w-full max-w-md bg-slate-900 border border-emerald-500/35 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          {/* Decorative glowing green background circles */}
          <div className="absolute -top-16 -left-16 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl"></div>

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

          <form onSubmit={handleLogin} className="space-y-5 relative">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Usuário Padrão</label>
              <input 
                type="text"
                placeholder="ex: admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Senha de Acesso</label>
              <input 
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                required
              />
            </div>

            {loginError && (
              <div className="text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3.5 py-2">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-extrabold text-sm uppercase tracking-wider rounded-xl shadow-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Entrar no Sistema
            </button>
          </form>

          {/* Floating Instructions box for testing */}
          <div className="mt-8 pt-4 border-t border-slate-800/80 text-center">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-950/55 px-3 py-1.5 rounded-full border border-slate-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Dica de Teste: <strong>admin</strong> / <strong>renea123</strong></span>
            </div>
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

  // Logged-in Core App Layout (Responsive Green Theme)
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row text-slate-100 antialiased font-sans" id="app-root">
      
      {/* 1. SIDEBAR NAVIGATION - DESKTOP */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 shrink-0 select-none print:hidden" id="desktop-sidebar">
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
        <nav className="flex-1 px-3 py-6 space-y-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'dashboard' ? 'bg-emerald-600/15 text-emerald-400 border-l-4 border-emerald-500 pl-3' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            Painel de Controle
          </button>

          <button 
            onClick={() => setActiveTab('cadastros')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'cadastros' ? 'bg-emerald-600/15 text-emerald-400 border-l-4 border-emerald-500 pl-3' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}`}
          >
            <FolderPlus className="w-4 h-4 shrink-0" />
            Cadastros Auxiliares
          </button>

          <button 
            onClick={() => setActiveTab('lancamentos')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'lancamentos' ? 'bg-emerald-600/15 text-emerald-400 border-l-4 border-emerald-500 pl-3' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}`}
          >
            <ClipboardList className="w-4 h-4 shrink-0" />
            Lançamentos Diários
          </button>

          <button 
            onClick={() => setActiveTab('presenca')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'presenca' ? 'bg-emerald-600/15 text-emerald-400 border-l-4 border-emerald-500 pl-3' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}`}
          >
            <Users className="w-4 h-4 shrink-0" />
            Presença
          </button>

          <button
            onClick={() => setActiveTab('controle-presenca')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'controle-presenca' ? 'bg-emerald-600/15 text-emerald-400 border-l-4 border-emerald-500 pl-3' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            Controle de Presença
          </button>

          <button
            onClick={() => setActiveTab('apontamentos')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'apontamentos' ? 'bg-emerald-600/15 text-emerald-400 border-l-4 border-emerald-500 pl-3' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}`}
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            Apontamentos
          </button>

          <button 
            onClick={() => setActiveTab('manutencao')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'manutencao' ? 'bg-emerald-600/15 text-emerald-400 border-l-4 border-emerald-500 pl-3' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}`}
          >
            <Wrench className="w-4 h-4 shrink-0" />
            Manutenção
          </button>

          <button 
            onClick={() => setActiveTab('tickets-jazida')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'tickets-jazida' ? 'bg-emerald-600/15 text-emerald-400 border-l-4 border-emerald-500 pl-3' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}`}
          >
            <Truck className="w-4 h-4 shrink-0" />
            Tickets Jazida
          </button>

          <button
            onClick={() => setActiveTab('materiais')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'materiais' ? 'bg-emerald-600/15 text-emerald-400 border-l-4 border-emerald-500 pl-3' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}`}
          >
            <Package className="w-4 h-4 shrink-0" />
            Materiais
          </button>

          <button 
            onClick={() => setActiveTab('reports')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'reports' ? 'bg-emerald-600/15 text-emerald-400 border-l-4 border-emerald-500 pl-3' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            Relatórios Gerais
          </button>

          <button 
            onClick={() => setActiveTab('configuracoes')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'configuracoes' ? 'bg-emerald-600/15 text-emerald-400 border-l-4 border-emerald-500 pl-3' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            Apoio & Configuração
          </button>
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
            <span>RDOs: {rdos.length}</span>
            <span>Empresas: {empresas.length}</span>
            <span>Materiais: {materiaisRegistros.length}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full mt-2 py-1.5 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 border border-slate-700/60 hover:border-rose-900/60 text-slate-400 rounded-lg font-bold text-[9px] flex items-center justify-center gap-1 transition-all cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            Desconectar Admin
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
          <div className="w-64 bg-slate-900 border-l border-slate-800 p-5 flex flex-col space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-slate-400 tracking-wider">NAVEGAÇÃO</span>
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 flex flex-col gap-1">
              <button 
                onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'dashboard' ? 'bg-emerald-600/15 text-emerald-400' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                <LayoutDashboard className="w-4.5 h-4.5" /> Painel Geral
              </button>

              <button 
                onClick={() => { setActiveTab('cadastros'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'cadastros' ? 'bg-emerald-600/15 text-emerald-400' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                <FolderPlus className="w-4.5 h-4.5" /> Cadastros Auxiliares
              </button>

              <button 
                onClick={() => { setActiveTab('lancamentos'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'lancamentos' ? 'bg-emerald-600/15 text-emerald-400' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                <ClipboardList className="w-4.5 h-4.5" /> Lançamentos Diários
              </button>

              <button 
                onClick={() => { setActiveTab('presenca'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'presenca' ? 'bg-emerald-600/15 text-emerald-400' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                <Users className="w-4.5 h-4.5" /> Presença
              </button>

              <button
                onClick={() => { setActiveTab('controle-presenca'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'controle-presenca' ? 'bg-emerald-600/15 text-emerald-400' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                <ShieldCheck className="w-4.5 h-4.5" /> Controle de Presença
              </button>

              <button
                onClick={() => { setActiveTab('apontamentos'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'apontamentos' ? 'bg-emerald-600/15 text-emerald-400' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                <BarChart3 className="w-4.5 h-4.5" /> Apontamentos
              </button>

              <button 
                onClick={() => { setActiveTab('manutencao'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'manutencao' ? 'bg-emerald-600/15 text-emerald-400' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                <Wrench className="w-4.5 h-4.5" /> Manutenção
              </button>

              <button 
                onClick={() => { setActiveTab('tickets-jazida'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'tickets-jazida' ? 'bg-emerald-600/15 text-emerald-400' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                <Truck className="w-4.5 h-4.5" /> Tickets Jazida
              </button>

              <button
                onClick={() => { setActiveTab('materiais'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'materiais' ? 'bg-emerald-600/15 text-emerald-400' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                <Package className="w-4.5 h-4.5" /> Materiais
              </button>

              <button 
                onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'reports' ? 'bg-emerald-600/15 text-emerald-400' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                <FileText className="w-4.5 h-4.5" /> Relatórios Gerais
              </button>

              <button 
                onClick={() => { setActiveTab('configuracoes'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'configuracoes' ? 'bg-emerald-600/15 text-emerald-400' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                <Settings className="w-4.5 h-4.5" /> Apoio & Configurações
              </button>

              <div className="pt-6 mt-4 border-t border-slate-800 flex flex-col gap-2">
                <button
                  onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                  className="w-full py-2 bg-rose-650/10 text-rose-400 hover:bg-rose-650/20 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" /> Desconectar Admin
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
          
          <div className="flex items-center gap-6">
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
            <div className="h-9 px-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs font-bold text-slate-200">
              <div className="w-5 h-5 bg-emerald-600 rounded-md flex items-center justify-center font-bold text-white text-[10px]">AD</div>
              <span>Administrador</span>
            </div>
          </div>
        </div>

        {/* Dynamic Inner Tab Viewport */}
        <div className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto print:p-0 print:m-0">
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
                etapas={etapas}
                abastecimentos={abastecimentos}
                lubrificacoes={lubrificacoes}
                rdos={rdos}
                historyLogs={historyLogs}
                listasPresenca={listasPresenca}
                ordensServico={ordensServico}
                onNavigate={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'cadastros' && (
              <CadastrosTab 
                empresas={empresas}
                obras={obras}
                equipamentos={equipamentos}
                funcionarios={funcionarios}
                comboios={comboios}
                combustiveis={combustiveis}
                lubrificantes={lubrificantes}
                etapas={etapas}
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
                obras={obras}
                equipamentos={equipamentos}
                funcionarios={funcionarios}
                comboios={comboios}
                combustiveis={combustiveis}
                lubrificantes={lubrificantes}
                etapas={etapas}
                abastecimentos={abastecimentos}
                lubrificacoes={lubrificacoes}
                rdos={rdos}
                onSaveAbastecimento={handleSaveAbastecimento}
                onDeleteAbastecimento={handleDeleteAbastecimento}
                onImportAbastecimentos={handleImportAbastecimentos}
                onSaveLubrificacao={handleSaveLubrificacao}
                onDeleteLubrificacao={handleDeleteLubrificacao}
                onSaveRdo={handleSaveRdo}
                onDeleteRdo={handleDeleteRdo}
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
                onSaveTicket={handleSaveTicketJazida}
                onDeleteTicket={handleDeleteTicketJazida}
                onImportTickets={handleImportTicketsJazida}
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

            {activeTab === 'reports' && (
              <RelatoriosTab 
                empresas={empresas}
                obras={obras}
                equipamentos={equipamentos}
                funcionarios={funcionarios}
                comboios={comboios}
                combustiveis={combustiveis}
                lubrificantes={lubrificantes}
                etapas={etapas}
                abastecimentos={abastecimentos}
                lubrificacoes={lubrificacoes}
                rdos={rdos}
                listasPresenca={listasPresenca}
                apontamentoRamoRegistros={apontamentoRamoRegistros}
              />
            )}

            {activeTab === 'configuracoes' && (
              <ConfiguracoesTab 
                historyLogs={historyLogs}
                onResetToDefault={handleResetData}
                onClearAllData={handleClearData}
                onImportFullData={handleImportFullData}
                onImportFilteredByDate={handleImportFilteredByDate}
                onExportFullData={handleExportFullData}
                isFirebaseConnected={isFirebaseConnected}
                isAutoSyncEnabled={isAutoSyncEnabled}
                lastCloudSync={lastCloudSync}
                onToggleAutoSync={(val) => {
                  setIsAutoSyncEnabled(val);
                  localStorage.setItem('renea_auto_sync', val ? 'true' : 'false');
                  if (val) {
                    handleUploadToFirebase();
                  }
                }}
                onUploadToFirebase={handleUploadToFirebase}
                onDownloadFromFirebase={handleDownloadFromFirebase}
              />
            )}
          </motion.div>
        </div>
      </main>

      {/* Toast notifications container in the top right corner */}
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
