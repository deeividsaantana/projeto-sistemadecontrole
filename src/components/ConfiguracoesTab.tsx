/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { HistoryLog } from '../types';
import { 
  Settings, 
  Clock, 
  Trash2, 
  RotateCcw, 
  Download, 
  Upload, 
  BookOpen, 
  Key, 
  Check, 
  AlertTriangle,
  Cloud,
  CloudOff,
  RefreshCw,
  Wifi,
  WifiOff
} from 'lucide-react';

interface ConfiguracoesTabProps {
  historyLogs: HistoryLog[];
  onResetToDefault: () => void;
  onClearAllData: () => void;
  onImportFullData: (importedJson: string) => boolean;
  onImportFilteredByDate: (importedJson: string, dataInicio: string, dataFim: string) => { success: boolean; message: string };
  onExportFullData: () => string;
  isFirebaseConnected: boolean;
  isAutoSyncEnabled: boolean;
  lastCloudSync: string;
  onToggleAutoSync: (val: boolean) => void;
  onUploadToFirebase: () => Promise<{ success: boolean; message: string }>;
  onDownloadFromFirebase: () => Promise<{ success: boolean; message: string }>;
}

export default function ConfiguracoesTab({
  historyLogs,
  onResetToDefault,
  onClearAllData,
  onImportFullData,
  onImportFilteredByDate,
  onExportFullData,
  isFirebaseConnected,
  isAutoSyncEnabled,
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
  
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Firebase Cloud Sync states
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMsg, setSyncMsg] = useState('');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

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
        const success = onImportFullData(text);
        if (success) {
          setImportStatus('success');
          setImportMsg('Backup importado com sucesso! Os dados foram atualizados.');
        } else {
          setImportStatus('error');
          setImportMsg('O arquivo fornecido não possui a estrutura válida do sistema Renea.');
        }
      } catch (err) {
        setImportStatus('error');
        setImportMsg('Falha de sintaxe ao ler o arquivo JSON de backup.');
      }
    };
    reader.readAsText(file);
    // Reset file input value
    if (fileInputRef.current) fileInputRef.current.value = '';
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Credentials, Manuals and Backup actions */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Default Credentials Notice */}
          <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-3 relative overflow-hidden">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">Usuário e Senha Padrão (Administrador)</h2>
              <p className="text-xxs text-slate-400 mt-1 leading-relaxed">
                O sistema é protegido localmente com credenciais corporativas padrão para os comboistas e supervisores de engenharia.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-mono font-bold block">Usuário de Acesso</span>
                <span className="text-xs font-black text-emerald-400 font-mono block mt-0.5">admin</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-mono font-bold block">Senha de Acesso</span>
                <span className="text-xs font-black text-white font-mono block mt-0.5">renea123</span>
              </div>
            </div>
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
                Escolha um arquivo de backup e selecione a data inicial e final desejada. Apenas os abastecimentos, lubrificações, RDOs e listas de presença daquele intervalo serão trazidos — nada do que já está salvo é apagado.
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
              Integração ativa com o banco de dados em nuvem Google Firebase. Salve suas frotas, RDOs e relatórios de forma segura para acesso compartilhado e restauração instantânea.
            </p>

            {/* Sync Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-mono font-bold block">Status da Conexão</span>
                <span className={`text-xs font-black font-mono block mt-0.5 ${isFirebaseConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isFirebaseConnected ? '✓ Firebase Inicializado' : '⚠️ Modo Local / Configurando'}
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
                onClick={() => onToggleAutoSync(!isAutoSyncEnabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isAutoSyncEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${isAutoSyncEnabled ? 'translate-x-4' : 'translate-x-0'}`}
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

        {/* Right Column: Database resets and Complete Change audit logs */}
        <div className="space-y-6">
          
          {/* Hard reset Utilities */}
          <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-4">
            <h2 className="text-xs uppercase tracking-widest font-black text-rose-400 font-mono flex items-center gap-2">
              <AlertTriangle className="w-4.5 h-4.5" />
              Opções Destrutivas de Banco
            </h2>
            <p className="text-xxs text-slate-400 leading-relaxed">
              As ações abaixo reinicializam a memória do navegador. Tenha certeza absoluta antes de clicar.
            </p>

            <div className="space-y-2">
              {/* Reset Default */}
              {!showResetConfirm ? (
                <button
                  onClick={() => { setShowResetConfirm(true); setShowClearConfirm(false); }}
                  className="w-full py-2.5 bg-slate-950 hover:bg-slate-850 text-slate-300 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-800"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restaurar Padrões de Fábrica
                </button>
              ) : (
                <div className="bg-slate-950 border border-amber-500/20 p-3.5 rounded-xl text-center space-y-2">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block font-mono">Confirmar restauração de fábrica?</span>
                  <p className="text-xxs text-slate-500 leading-relaxed">Isso recolocará as 5 empresas fictícias e logs de junho de 2026.</p>
                  <div className="flex gap-2">
                    <button onClick={() => { onResetToDefault(); setShowResetConfirm(false); }} className="flex-1 py-1.5 bg-amber-600 text-white font-bold text-xxs rounded-lg hover:bg-amber-500">Confirmar</button>
                    <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-1.5 bg-slate-800 text-slate-300 font-bold text-xxs rounded-lg">Cancelar</button>
                  </div>
                </div>
              )}

              {/* Clear All */}
              {!showClearConfirm ? (
                <button
                  onClick={() => { setShowClearConfirm(true); setShowResetConfirm(false); }}
                  className="w-full py-2.5 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/30 text-rose-400 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4.5 h-4.5" />
                  Limpar Toda a Memória (Zerar)
                </button>
              ) : (
                <div className="bg-rose-950/10 border border-rose-500/20 p-3.5 rounded-xl text-center space-y-2">
                  <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block font-mono">⚠️ APAGAR TODO O BANCO?</span>
                  <p className="text-xxs text-slate-500">Essa ação esvaziará todas as tabelas (Equipamentos, RDOs, Abastecimentos).</p>
                  <div className="flex gap-2">
                    <button onClick={() => { onClearAllData(); setShowClearConfirm(false); }} className="flex-1 py-1.5 bg-rose-600 text-white font-bold text-xxs rounded-lg hover:bg-rose-500">Sim, Zerar</button>
                    <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-1.5 bg-slate-800 text-slate-300 font-bold text-xxs rounded-lg">Voltar</button>
                  </div>
                </div>
              )}
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

            <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1">
              {historyLogs.length === 0 ? (
                <span className="text-xxs text-slate-500 italic block py-4 text-center">Nenhum evento registrado ainda.</span>
              ) : (
                historyLogs.map(log => {
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
