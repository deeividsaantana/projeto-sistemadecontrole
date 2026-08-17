/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HistoryLog, PeriodoArquivado } from '../types';
import { isSnapshotIntact } from '../utils/snapshotIntegrity';
import { loadUsageSummary, type UsageSummary } from '../usageTelemetry';
import { loadMasterDataGatewayStatus, type MasterDataGatewayStatus } from '../services/masterDataApi';
import { 
  Settings, 
  Clock, 
  Download, 
  Upload, 
  BookOpen, 
  Check, 
  AlertTriangle,
  Cloud,
  CloudOff,
  RefreshCw,
  Wifi,
  WifiOff,
  Archive,
  FolderOpen,
  CalendarDays,
  BarChart3,
  ShieldCheck,
  Database
} from 'lucide-react';

interface ConfiguracoesTabProps {
  historyLogs: HistoryLog[];
  onImportFullData: (importedJson: string) => boolean;
  onImportFilteredByDate: (importedJson: string, dataInicio: string, dataFim: string) => { success: boolean; message: string };
  onExportFullData: () => string;
  periodosArquivados: PeriodoArquivado[];
  onArchivePeriod: (dataInicio: string, dataFim: string, nome?: string) => { success: boolean; message: string };
  onRestoreArchivedPeriod: (id: string) => { success: boolean; message: string };
  isFirebaseConnected: boolean;
  lastCloudSync: string;
  onToggleAutoSync: (val: boolean) => void;
  onUploadToFirebase: () => Promise<{ success: boolean; message: string }>;
  onDownloadFromFirebase: () => Promise<{ success: boolean; message: string }>;
}

export default function ConfiguracoesTab({
  historyLogs,
  onImportFullData,
  onImportFilteredByDate,
  onExportFullData,
  periodosArquivados,
  onArchivePeriod,
  onRestoreArchivedPeriod,
  isFirebaseConnected,
  lastCloudSync,
  onToggleAutoSync,
  onUploadToFirebase,
  onDownloadFromFirebase
}: ConfiguracoesTabProps) {

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importMsg, setImportMsg] = useState('');

  // Importação seletiva por período
  const filteredFileInputRef = useRef<HTMLInputElement>(null);
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [pendingFileText, setPendingFileText] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState('');
  const [pendingFullImportText, setPendingFullImportText] = useState<string | null>(null);
  const [pendingFullImportName, setPendingFullImportName] = useState('');
  
  const [archiveDataInicio, setArchiveDataInicio] = useState('');
  const [archiveDataFim, setArchiveDataFim] = useState('');
  const [archiveNome, setArchiveNome] = useState('');
  const [archiveStatus, setArchiveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [archiveMsg, setArchiveMsg] = useState('');
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [pendingRestoreArchiveId, setPendingRestoreArchiveId] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [historyTela, setHistoryTela] = useState('');
  const [historyAcao, setHistoryAcao] = useState('');
  const [historyStart, setHistoryStart] = useState('');
  const [historyEnd, setHistoryEnd] = useState('');

  // Firebase Cloud Sync states
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMsg, setSyncMsg] = useState('');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState('');
  const [masterDataStatus, setMasterDataStatus] = useState<MasterDataGatewayStatus | null>(null);
  const [masterDataLoading, setMasterDataLoading] = useState(true);
  const [masterDataError, setMasterDataError] = useState('');

  const refreshUsageSummary = async () => {
    setUsageLoading(true);
    setUsageError('');
    try {
      setUsageSummary(await loadUsageSummary(30));
    } catch (error) {
      setUsageError(error instanceof Error ? error.message : 'Não foi possível carregar o uso real.');
    } finally {
      setUsageLoading(false);
    }
  };

  const refreshMasterDataStatus = async () => {
    setMasterDataLoading(true);
    setMasterDataError('');
    try {
      setMasterDataStatus(await loadMasterDataGatewayStatus());
    } catch (error) {
      setMasterDataStatus(null);
      setMasterDataError(error instanceof Error ? error.message : 'Não foi possível consultar a persistência protegida.');
    } finally {
      setMasterDataLoading(false);
    }
  };

  useEffect(() => {
    void refreshUsageSummary();
    void refreshMasterDataStatus();
  }, []);

  const historyDateToIso = (timestamp: string) => {
    const match = String(timestamp || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
  };

  const historyTelaOptions = useMemo(
    () => Array.from(new Set(historyLogs.map(log => log.tela).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [historyLogs],
  );

  const filteredHistoryLogs = useMemo(() => {
    const term = historySearch.trim().toLowerCase();
    return historyLogs.filter(log => {
      const iso = historyDateToIso(log.timestamp);
      if (historyTela && log.tela !== historyTela) return false;
      if (historyAcao && log.acao !== historyAcao) return false;
      if (historyStart && iso && iso < historyStart) return false;
      if (historyEnd && iso && iso > historyEnd) return false;
      if (!term) return true;
      return [log.acao, log.tela, log.usuario, log.descricao, log.timestamp]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [historyLogs, historySearch, historyTela, historyAcao, historyStart, historyEnd]);

  const toLocalIsoDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatIsoDate = (date: string) => date ? date.split('-').reverse().join('/') : '-';

  const fillCurrentCycle21To20 = () => {
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), 20);
    if (today.getDate() > 20) end.setMonth(end.getMonth() + 1);
    const start = new Date(end.getFullYear(), end.getMonth() - 1, 21);
    const startIso = toLocalIsoDate(start);
    const endIso = toLocalIsoDate(end);
    setArchiveDataInicio(startIso);
    setArchiveDataFim(endIso);
    setArchiveNome(`Fechamento ${formatIsoDate(startIso)} a ${formatIsoDate(endIso)}`);
    setArchiveStatus('idle');
    setArchiveMsg('');
    setShowArchiveConfirm(false);
  };

  const archiveTotal = (archive: PeriodoArquivado) =>
    Object.values(archive.resumo || {}).reduce((sum, value) => sum + Number(value || 0), 0);

  const applyArchivePeriod = () => {
    const result = onArchivePeriod(archiveDataInicio, archiveDataFim, archiveNome);
    setArchiveStatus(result.success ? 'success' : 'error');
    setArchiveMsg(result.message);
    if (result.success) {
      setShowArchiveConfirm(false);
      setArchiveNome('');
    }
  };

  const restoreArchive = (id: string) => {
    const result = onRestoreArchivedPeriod(id);
    setArchiveStatus(result.success ? 'success' : 'error');
    setArchiveMsg(result.message);
    if (result.success) setPendingRestoreArchiveId(null);
  };

  // Trigger export download
  const handleExport = () => {
    try {
      const dataStr = onExportFullData();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Backup_Renea_Infraestrutura_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Erro ao exportar backup.');
    }
  };

  // Trigger import file parse
  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        setPendingFullImportText(text);
        setPendingFullImportName(file.name);
        setImportStatus('idle');
        setImportMsg('');
      } catch (err) {
        setImportStatus('error');
        setImportMsg('Falha de sintaxe ao ler o arquivo JSON de backup.');
      }
    };
    reader.readAsText(file);
    // Reset file input value
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmFullImport = () => {
    if (!pendingFullImportText) return;
    const success = onImportFullData(pendingFullImportText);
    if (success) {
      setImportStatus('success');
      setImportMsg('Backup importado com sucesso. Revise os dados restaurados e a trilha de auditoria.');
      setPendingFullImportText(null);
      setPendingFullImportName('');
    } else {
      setImportStatus('error');
      setImportMsg('O arquivo fornecido não possui a estrutura válida do sistema Renea.');
    }
  };

  // Seleciona o arquivo para importação seletiva por período (não importa ainda,
  // espera o usuário escolher as datas e confirmar)
  const handleFilteredFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setPendingFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setPendingFileText(event.target?.result as string);
      setImportStatus('idle');
      setImportMsg('');
    };
    reader.readAsText(file);
    if (filteredFileInputRef.current) filteredFileInputRef.current.value = '';
  };

  const handleConfirmFilteredImport = () => {
    if (!pendingFileText) return;
    const result = onImportFilteredByDate(pendingFileText, filtroDataInicio, filtroDataFim);
    setImportStatus(result.success ? 'success' : 'error');
    setImportMsg(result.message);
    if (result.success) {
      setPendingFileText(null);
      setPendingFileName('');
    }
  };

  return (
    <div className="space-y-6" id="configuracoes-tab">
      
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-500" />
            Configurações & Painel Administrativo
          </h1>
          <p className="text-xs text-slate-400 mt-1">Gerencie a segurança local, importe ou exporte backups, faça auditorias e acesse o manual.</p>
        </div>
      </div>

      {pendingFullImportText && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
          <div>
            <strong className="block text-xs uppercase tracking-wider text-amber-300">Confirmar restauração de backup</strong>
            <p className="mt-1 text-xxs leading-relaxed text-slate-300">
              O arquivo {pendingFullImportName || 'selecionado'} foi carregado, mas ainda não alterou os registros. A restauração pode atualizar dados operacionais; confirme somente após validar a origem e a data do backup.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleConfirmFullImport} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xxs font-bold text-white hover:bg-amber-500">Confirmar restauração</button>
            <button type="button" onClick={() => { setPendingFullImportText(null); setPendingFullImportName(''); }} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xxs font-bold text-slate-300">Cancelar</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Credentials, Manuals and Backup actions */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Secure access status */}
          <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-3 relative overflow-hidden">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">Acesso corporativo protegido</h2>
              <p className="text-xxs text-slate-400 mt-1 leading-relaxed">
                O acesso usa contas individuais do Firebase e autorização de equipe. Senhas nunca são exibidas ou armazenadas nesta tela.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-bold text-emerald-300">
              <Check className="h-4 w-4" /> Sessão autenticada e protegida por credencial individual
            </div>
          </div>

          {/* Real usage telemetry */}
          <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-cyan-500/10 text-cyan-300 rounded-xl"><BarChart3 className="w-5 h-5" /></div>
                <div>
                  <h2 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">Uso real das abas</h2>
                  <p className="text-xxs text-slate-400 mt-1">Contagem dos últimos 30 dias para decidir o que manter, simplificar ou retirar.</p>
                </div>
              </div>
              <button type="button" onClick={() => void refreshUsageSummary()} disabled={usageLoading} className="h-9 px-3 rounded-lg border border-slate-700 text-xs font-bold text-slate-300 hover:text-white disabled:opacity-50 flex items-center gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${usageLoading ? 'animate-spin' : ''}`} /> Atualizar
              </button>
            </div>
            {usageError ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{usageError}</div>
            ) : usageLoading ? (
              <div className="h-20 grid place-items-center text-xs text-slate-500">Carregando medição...</div>
            ) : usageSummary && usageSummary.tabs.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><span className="block text-[9px] uppercase font-bold text-slate-500">Aberturas de abas</span><strong className="text-xl text-white">{usageSummary.totalViews.toLocaleString('pt-BR')}</strong></div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><span className="block text-[9px] uppercase font-bold text-slate-500">Usuários ativos</span><strong className="text-xl text-white">{usageSummary.activeUsers.toLocaleString('pt-BR')}</strong></div>
                </div>
                <div className="space-y-2">
                  {usageSummary.tabs.map(item => {
                    const percentage = usageSummary.totalViews ? Math.max(4, Math.round((item.count / usageSummary.totalViews) * 100)) : 0;
                    return (
                      <div key={item.id} className="grid grid-cols-[minmax(130px,1fr)_2fr_52px] items-center gap-3 text-xs">
                        <span className="truncate text-slate-300">{item.label}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${percentage}%` }} /></div>
                        <strong className="text-right font-mono text-white">{item.count}</strong>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-5 text-xs text-slate-400">A medição começou agora. Os dados aparecerão conforme as abas forem abertas.</div>
            )}
          </div>

          {/* Persistência protegida gradual */}
          <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-emerald-500/10 text-emerald-300 rounded-xl"><Database className="w-5 h-5" /></div>
                <div>
                  <h2 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">Persistência Firebase / Netlify</h2>
                  <p className="text-xxs text-slate-400 mt-1 leading-relaxed">
                    Camada opcional para cadastros mestres, auditoria e importações. O Firebase continua ativo e nenhum fluxo atual é substituído.
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => void refreshMasterDataStatus()} disabled={masterDataLoading} className="h-9 px-3 rounded-lg border border-slate-700 text-xs font-bold text-slate-300 hover:text-white disabled:opacity-50 flex items-center gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${masterDataLoading ? 'animate-spin' : ''}`} /> Verificar
              </button>
            </div>
            {masterDataLoading ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-5 text-xs text-slate-500">Verificando configuração segura...</div>
            ) : masterDataStatus ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                <div><span className="block text-[9px] uppercase font-bold text-slate-500">Status</span><strong className="text-xs text-emerald-300">✓ Gateway protegido</strong></div>
                <div><span className="block text-[9px] uppercase font-bold text-slate-500">Organização</span><strong className="text-xs text-white">{masterDataStatus.organization.name}</strong></div>
                <div><span className="block text-[9px] uppercase font-bold text-slate-500">Cadastros prontos</span><strong className="text-xs text-white">{masterDataStatus.supportedEntities.length}</strong></div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
                <strong className="block text-xs text-amber-300">Modo opcional ainda não ativado</strong>
                <span className="mt-1 block text-[10px] leading-relaxed text-slate-400">{masterDataError || 'Configure a conta de serviço Firebase no Netlify para concluir a persistência protegida.'}</span>
              </div>
            )}
          </div>

          {/* User Operating Manual (Perfect answers for user requests) */}
          <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-4">
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              Manual Operacional de Auxiliares
            </h2>
            
            <div className="space-y-3.5 text-xxs text-slate-300 leading-relaxed">
              
              <div className="space-y-1">
                <p className="font-bold text-white text-xs">1. Como Editar os Cadastros Auxiliares?</p>
                <p className="text-slate-400">
                  Navegue até a aba de <strong>Cadastros</strong> no menu principal. Clique na sub-aba do catálogo desejado (ex: Equipamentos, Empresas). Na tabela de listagem, clique no botão <strong>Editar (ícone de lápis)</strong> à direita do item correspondente. O formulário se expandirá imediatamente com as informações salvas. Altere os campos e clique em <strong>Salvar Alterações</strong> para atualizar o registro local.
                </p>
              </div>

              <div className="space-y-1">
                <p className="font-bold text-white text-xs">2. Como Lançar e Gerar Relatórios no Tema Verde?</p>
                <p className="text-slate-400">
                  Acesse <strong>Lançamentos</strong> para registrar abastecimentos de óleo diesel ou lubrificações de campo. A litragem total e frotas ativas alimentarão o <strong>Dashboard</strong> e o módulo de <strong>Relatórios</strong>. Em Relatórios, escolha o tipo de documento, ajuste o período de datas, aplique os filtros desejados e clique em <strong>Exportar Excel (CSV)</strong> ou <strong>Imprimir PDF</strong> para enviar à matriz.
                </p>
              </div>

              <div className="space-y-1">
                <p className="font-bold text-white text-xs">3. Garantia de Integridade e Evitar Duplicidade</p>
                <p className="text-slate-400">
                  O sistema possui chaves lógicas baseadas em IDs automáticos criptográficos e impede prefixos duplicados. Toda exclusão é protegida por caixa de confirmação dupla.
                </p>
              </div>

            </div>
          </div>

          {/* Backup Database Utilities */}
          <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-4">
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">Backup de Segurança (Importar / Exportar)</h2>
            <p className="text-xxs text-slate-400 leading-relaxed">
              Salve todas as 12 tabelas locais em um arquivo seguro JSON para guardar relatórios históricos ou migrar para outro navegador.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleExport}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Exportar Backup JSON
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Restaurar Backup JSON
              </button>

              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleImportFileChange}
                accept=".json"
                className="hidden"
              />
            </div>

            {/* Import Feedback message */}
            {importStatus !== 'idle' && (
              <div className={`p-4 rounded-xl border text-xs font-semibold ${importStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                {importStatus === 'success' ? '✓' : '⚠️'} {importMsg}
              </div>
            )}

            {/* Importação Seletiva por Período */}
            <div className="border-t border-slate-850 pt-4 space-y-3">
              <h3 className="text-xs font-extrabold text-white uppercase tracking-wider font-mono">Importar Apenas um Período Específico</h3>
              <p className="text-xxs text-slate-400 leading-relaxed">
                Escolha um arquivo de backup e selecione a data inicial e final desejada. Apenas os abastecimentos, lubrificações e listas de presença daquele intervalo serão trazidos — nada do que já está salvo é apagado.
              </p>

              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Data Início</label>
                  <input
                    type="date"
                    value={filtroDataInicio}
                    onChange={e => setFiltroDataInicio(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Data Fim</label>
                  <input
                    type="date"
                    value={filtroDataFim}
                    onChange={e => setFiltroDataFim(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  onClick={() => filteredFileInputRef.current?.click()}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  {pendingFileName ? 'Trocar Arquivo' : 'Selecionar Arquivo'}
                </button>
                <input
                  type="file"
                  ref={filteredFileInputRef}
                  onChange={handleFilteredFileChange}
                  accept=".json"
                  className="hidden"
                />

                {pendingFileText && (
                  <button
                    onClick={handleConfirmFilteredImport}
                    disabled={!filtroDataInicio && !filtroDataFim}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    Importar Período Selecionado
                  </button>
                )}
              </div>

              {pendingFileName && (
                <p className="text-[10px] text-slate-500 font-mono">Arquivo pronto: {pendingFileName}{(!filtroDataInicio && !filtroDataFim) ? ' — escolha ao menos uma data para liberar a importação.' : ''}</p>
              )}
            </div>

            {/* Arquivo de períodos fora do dashboard */}
            <div className="border-t border-slate-850 pt-4 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xs font-extrabold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                    <Archive className="w-4 h-4 text-emerald-400" />
                    Arquivo de Períodos
                  </h3>
                  <p className="text-xxs text-slate-400 leading-relaxed mt-1">
                    Guarde um fechamento e limpe esses lançamentos da operação ativa. O dashboard passa a calcular só o que ficar fora do arquivo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fillCurrentCycle21To20}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 text-[10px] font-bold text-slate-300 hover:border-emerald-500 hover:text-white"
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  Ciclo 21→20
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1 sm:col-span-3">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Nome do arquivo</label>
                  <input
                    value={archiveNome}
                    onChange={e => { setArchiveNome(e.target.value); setShowArchiveConfirm(false); }}
                    placeholder="Ex: Fechamento Junho/Julho"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Data Início</label>
                  <input
                    type="date"
                    value={archiveDataInicio}
                    onChange={e => { setArchiveDataInicio(e.target.value); setShowArchiveConfirm(false); }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Data Fim</label>
                  <input
                    type="date"
                    value={archiveDataFim}
                    onChange={e => { setArchiveDataFim(e.target.value); setShowArchiveConfirm(false); }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setShowArchiveConfirm(true)}
                    disabled={!archiveDataInicio || !archiveDataFim}
                    className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Archive className="w-4 h-4" />
                    Arquivar e limpar
                  </button>
                </div>
              </div>

              {showArchiveConfirm && (
                <div className="rounded-xl border border-amber-500/20 bg-slate-950 p-3.5 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono">Confirmar fechamento?</p>
                  <p className="text-xxs text-slate-400 leading-relaxed">
                    Os registros datados de {formatIsoDate(archiveDataInicio)} até {formatIsoDate(archiveDataFim)} serão salvos no arquivo e retirados do dashboard.
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={applyArchivePeriod} className="flex-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xxs font-bold text-white hover:bg-amber-500">Confirmar</button>
                    <button type="button" onClick={() => setShowArchiveConfirm(false)} className="flex-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xxs font-bold text-slate-300">Cancelar</button>
                  </div>
                </div>
              )}

              {archiveStatus !== 'idle' && (
                <div className={`p-3 rounded-xl border text-xs font-semibold ${archiveStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                  {archiveStatus === 'success' ? '✓' : '⚠️'} {archiveMsg}
                </div>
              )}

              <div className="space-y-2">
                {periodosArquivados.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-4 text-center text-xxs text-slate-500">
                    Nenhum período arquivado ainda.
                  </div>
                ) : (
                  periodosArquivados.map(archive => (
                    <div key={archive.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <strong className="block text-xs text-white">{archive.nome}</strong>
                          <span className="text-[10px] text-slate-500">
                            {formatIsoDate(archive.dataInicio)} até {formatIsoDate(archive.dataFim)} • {archiveTotal(archive)} registro(s)
                          </span>
                          <span className={`mt-1 block text-[9px] font-black uppercase tracking-wider ${isSnapshotIntact(archive) ? 'text-emerald-500' : 'text-rose-400'}`}>
                            {isSnapshotIntact(archive) ? `Integridade confirmada${archive.checksum ? ` · ${archive.checksum}` : ''}` : 'Snapshot alterado após o fechamento'}
                          </span>
                        </div>
                        <span className="rounded bg-slate-900 px-2 py-1 text-[10px] font-bold text-slate-400">{formatIsoDate(archive.criadoEm.slice(0, 10))}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {pendingRestoreArchiveId === archive.id ? (
                          <>
                            <button type="button" onClick={() => restoreArchive(archive.id)} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xxs font-bold text-white hover:bg-amber-500">Confirmar restauração</button>
                            <button type="button" onClick={() => setPendingRestoreArchiveId(null)} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xxs font-bold text-slate-300">Cancelar</button>
                          </>
                        ) : (
                          <button type="button" onClick={() => setPendingRestoreArchiveId(archive.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xxs font-bold text-white hover:bg-emerald-500">
                            <FolderOpen className="w-3.5 h-3.5" />
                            Restaurar para operação
                          </button>
                        )}
                        <span className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xxs font-bold text-slate-400">
                          Arquivo preservado
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sincronização em Nuvem (Firebase) */}
          <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Cloud className="w-5 h-5 text-emerald-400" />
                Sincronização em Nuvem (Firebase)
              </h2>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-950 border border-slate-800">
                {isFirebaseConnected ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] font-bold text-emerald-400 font-mono">ONLINE</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[10px] font-bold text-amber-500 font-mono">LOCAL</span>
                  </>
                )}
              </div>
            </div>

            <p className="text-xxs text-slate-400 leading-relaxed">
              Integração ativa com o banco de dados em nuvem Google Firebase. Salve suas frotas e relatórios de forma segura para acesso compartilhado e restauração instantânea.
            </p>

            {/* Sync Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-mono font-bold block">Status da Conexão</span>
                <span className={`text-xs font-black font-mono block mt-0.5 ${isFirebaseConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isFirebaseConnected ? '✓ Firestore Conectado' : '⚠️ Firebase Indisponível'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-mono font-bold block">Último Backup Nuvem</span>
                <span className="text-xs font-black text-white font-mono block mt-0.5">
                  {lastCloudSync || 'Nunca sincronizado'}
                </span>
              </div>
            </div>

            {/* Auto Sync Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950/40 border border-slate-850 rounded-xl">
              <div>
                <span className="text-xxs font-extrabold text-white block">Sincronização Automática</span>
                <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                  Envia todas as modificações (Criar, Editar, Excluir) imediatamente para o Firebase Firestore
                </span>
              </div>
              <button
                type="button"
                onClick={() => onToggleAutoSync(true)}
                aria-pressed="true"
                title="Sincronizacao obrigatoria para todos os usuarios"
                className="relative inline-flex h-5 w-9 shrink-0 cursor-not-allowed rounded-full border-2 border-transparent bg-emerald-500 transition-colors duration-200 ease-in-out focus:outline-none"
              >
                <span
                  className="pointer-events-none inline-block h-4 w-4 translate-x-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out"
                />
              </button>
            </div>

            {/* Sync Action Buttons */}
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={async () => {
                  setIsSyncing(true);
                  setSyncStatus('idle');
                  setSyncMsg('');
                  try {
                    const res = await onUploadToFirebase();
                    if (res.success) {
                      setSyncStatus('success');
                      setSyncMsg(res.message);
                    } else {
                      setSyncStatus('error');
                      setSyncMsg(res.message);
                    }
                  } catch (err: any) {
                    setSyncStatus('error');
                    setSyncMsg(err.message || 'Erro inesperado ao sincronizar.');
                  } finally {
                    setIsSyncing(false);
                  }
                }}
                disabled={isSyncing || isRestoring}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Sincronizando...' : 'Enviar Dados para a Nuvem'}
              </button>

              {!showRestoreConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowRestoreConfirm(true)}
                  disabled={isSyncing || isRestoring}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 disabled:bg-slate-900 disabled:border-slate-850 disabled:text-slate-655 text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Baixar Dados da Nuvem
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-2 bg-slate-950 p-3 rounded-xl border border-amber-500/20 w-full">
                  <div className="flex-1 text-center sm:text-left">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block font-mono">⚠️ RESTAURAR DA NUVEM?</span>
                    <span className="text-[9px] text-slate-400 leading-tight">Essa ação substituirá todos os seus dados locais por aqueles salvos no Firebase.</span>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={async () => {
                        setIsRestoring(true);
                        setSyncStatus('idle');
                        setSyncMsg('');
                        setShowRestoreConfirm(false);
                        try {
                          const res = await onDownloadFromFirebase();
                          if (res.success) {
                            setSyncStatus('success');
                            setSyncMsg(res.message);
                          } else {
                            setSyncStatus('error');
                            setSyncMsg(res.message);
                          }
                        } catch (err: any) {
                          setSyncStatus('error');
                          setSyncMsg(err.message || 'Erro inesperado ao restaurar.');
                        } finally {
                          setIsRestoring(false);
                        }
                      }}
                      className="flex-1 sm:flex-none px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xxs rounded-lg transition-all cursor-pointer"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRestoreConfirm(false)}
                      className="flex-1 sm:flex-none px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xxs rounded-lg transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sync Feedback message */}
            {syncStatus !== 'idle' && (
              <div className={`p-4 rounded-xl border text-xs font-semibold ${syncStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                {syncStatus === 'success' ? '✓' : '⚠️'} {syncMsg}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Data protection and complete change audit logs */}
        <div className="space-y-6">
          
          {/* Operational data protection */}
          <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-4">
            <h2 className="text-xs uppercase tracking-widest font-black text-emerald-400 font-mono flex items-center gap-2">
              <ShieldCheck className="w-4.5 h-4.5" />
              Proteção de dados operacionais
            </h2>
            <p className="text-xxs text-slate-400 leading-relaxed">
              A exclusão total, a restauração para dados fictícios e o reset seletivo foram desativados para preservar o histórico operacional. Use exportação, importação assistida e arquivamento de períodos para manter rastreabilidade.
            </p>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xxs leading-relaxed text-slate-300">
              Registros existentes só podem ser consultados, arquivados ou restaurados por rotinas com confirmação e trilha de auditoria. Não há mais comandos de zerar dados neste ambiente.
            </div>
          </div>

          {/* Detailed Audit history logger view */}
          <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-4">
            <h2 className="text-xs uppercase tracking-widest font-black text-slate-400 font-mono flex items-center gap-2">
              <Clock className="w-4.5 h-4.5 text-emerald-400" />
              Histórico Operacional Completo
            </h2>
            <p className="text-xxs text-slate-400 leading-relaxed">
              Trilha de auditoria local de todas as alterações feitas na sessão.
            </p>

            <div className="grid grid-cols-1 gap-2">
              <input
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Buscar no histórico"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={historyTela}
                  onChange={e => setHistoryTela(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-[10px] text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Todas as abas</option>
                  {historyTelaOptions.map(tela => <option key={tela} value={tela}>{tela}</option>)}
                </select>
                <select
                  value={historyAcao}
                  onChange={e => setHistoryAcao(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-[10px] text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Todas as ações</option>
                  <option value="Criou">Criou</option>
                  <option value="Editou">Editou</option>
                  <option value="Excluiu">Excluiu</option>
                </select>
                <input
                  type="date"
                  value={historyStart}
                  onChange={e => setHistoryStart(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-[10px] text-white focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="date"
                  value={historyEnd}
                  onChange={e => setHistoryEnd(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-[10px] text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>{filteredHistoryLogs.length} de {historyLogs.length} evento(s)</span>
                {(historySearch || historyTela || historyAcao || historyStart || historyEnd) && (
                  <button
                    type="button"
                    onClick={() => { setHistorySearch(''); setHistoryTela(''); setHistoryAcao(''); setHistoryStart(''); setHistoryEnd(''); }}
                    className="font-bold text-emerald-400 hover:underline"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1">
              {filteredHistoryLogs.length === 0 ? (
                <span className="text-xxs text-slate-500 italic block py-4 text-center">Nenhum evento registrado ainda.</span>
              ) : (
                filteredHistoryLogs.map(log => {
                  const acColor = log.acao === 'Criou' 
                    ? 'text-emerald-400' 
                    : log.acao === 'Editou' 
                    ? 'text-amber-400' 
                    : 'text-rose-400';

                  return (
                    <div key={log.id} className="text-xxs border-b border-slate-850 pb-2.5 last:border-0 last:pb-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`font-black uppercase tracking-wider ${acColor}`}>{log.acao}</span>
                        <span className="text-[9px] text-slate-500 font-mono">{log.timestamp}</span>
                      </div>
                      <p className="text-slate-300 font-semibold">{log.descricao}</p>
                      <span className="text-[10px] text-slate-500 block font-mono uppercase">Tela: {log.tela} • Operador: {log.usuario}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
