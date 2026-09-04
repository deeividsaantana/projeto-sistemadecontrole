import React from 'react';
import { createRoot } from 'react-dom/client';
import './preview.css';
import UsuariosTab from '../src/components/UsuariosTab';
import PresencaTempoRealPublica from '../src/components/PresencaTempoRealPublica';
import Dashboard from '../src/components/Dashboard';
import LancamentosTab from '../src/components/LancamentosTab';
import PeriodoTab from '../src/components/PeriodoTab';
import ControlePresencaTab from '../src/components/ControlePresencaTab';
import ControleEquipamentosDiarioTab from '../src/components/ControleEquipamentosDiarioTab';
import { DesktopSidebar } from '../src/app/shell/DesktopSidebar';
import { DesktopTopBar } from '../src/app/shell/DesktopTopBar';
import { NAVIGATION_GROUPS } from '../src/app/navigation/navigation';
import * as fx from './fixtures';

const noop = () => {};
const previewGroups = NAVIGATION_GROUPS.map(g => ({ label: g.label, items: [...g.items] }));
const previewNotifications = [
  { id: '1', type: 'success' as const, title: 'Sincronizacao concluida', message: 'Dados do periodo enviados para a nuvem.', timestamp: '08:12', read: false, source: 'Firebase Cloud' as const },
  { id: '2', type: 'warning' as const, title: 'Estoque baixo', message: 'Produto de lubrificacao abaixo do minimo.', timestamp: '07:40', read: true, source: 'Sistema Local' as const },
];
const screens: Record<string, React.ReactNode> = {
  sidebar: (
    <div className="erp-shell" style={{ height: '100dvh' }}>
      <DesktopSidebar
        activeTab="presenca"
        groups={previewGroups}
        onNavigate={noop}
      />
      <main style={{ flex: 1, background: '#fff' }} />
    </div>
  ),
  topbar: (
    <div className="erp-shell" style={{ height: '100dvh' }}>
      <DesktopSidebar activeTab="dashboard" groups={previewGroups} onNavigate={noop} />
      <main className="erp-workspace">
        <DesktopTopBar
          groups={previewGroups}
          menuSearch=""
          currentUser={{ displayName: 'Deivid Santana', email: 'deivid@renea.com.br' } as never}
          isNotificationOpen={false}
          notifications={previewNotifications}
          unreadCount={1}
          isFirebaseConnected
          lastCloudSync="04/09/2026 21:40"
          onMenuSearchChange={noop}
          onNavigate={noop}
          onToggleNotifications={noop}
          onCloseNotifications={noop}
          onMarkAllNotificationsAsRead={noop}
          onClearNotifications={noop}
          onMarkNotificationAsRead={noop}
          onLogout={noop}
        />
      </main>
    </div>
  ),
  usuarios: <UsuariosTab />,
  frotas: (
    <ControleEquipamentosDiarioTab
      registros={fx.controlesEquipamentos}
      equipamentos={fx.equipamentos}
      empresas={fx.empresas}
      funcionarios={fx.funcionarios}
      gruposEquipe={[fx.grupo]}
      ordensServico={fx.ordensServico}
      onSave={noop}
      onImport={noop}
      onDeleteMany={noop}
      onOpenEmployeeRegistration={noop}
      onOpenEquipmentRegistration={noop}
    />
  ),
  periodo: (
    <PeriodoTab
      presencas={fx.registrosEnviados}
      controlesEquipamentos={fx.controlesEquipamentos}
      abastecimentos={fx.abastecimentos}
      ticketsJazida={fx.ticketsJazida}
      equipamentos={fx.equipamentos}
    />
  ),
  combustivel: (
    <LancamentosTab
      empresas={fx.empresas}
      equipamentos={fx.equipamentos}
      comboios={fx.comboios}
      combustiveis={fx.combustiveis}
      lubrificantes={fx.lubrificantes}
      abastecimentos={fx.abastecimentos}
      lubrificacoes={[]}
      onSaveAbastecimento={noop}
      onDeleteAbastecimento={noop}
      onDeleteAbastecimentos={noop}
      onImportAbastecimentos={noop}
      onSaveLubrificacao={noop}
      onDeleteLubrificacao={noop}
    />
  ),
  painel: (
    <Dashboard
      empresas={fx.empresas}
      obras={fx.obras}
      equipamentos={fx.equipamentos}
      funcionarios={fx.equipeFuncionarios}
      comboios={fx.comboios}
      combustiveis={fx.combustiveis}
      lubrificantes={fx.lubrificantes}
      abastecimentos={fx.abastecimentos}
      lubrificacoes={[]}
      historyLogs={[]}
      ordensServico={fx.ordensServico}
      ticketsJazida={fx.ticketsJazida}
      presencasLink={fx.registrosEnviados}
      onNavigate={noop}
    />
  ),
  'presenca-admin': (
    <ControlePresencaTab
      empresas={fx.empresas}
      funcionarios={fx.equipeFuncionarios}
      obras={fx.obras}
      gruposEquipe={[fx.grupo]}
      presencasLink={fx.presencasHistorico}
      historicoPresencas={[]}
      onSaveGrupoEquipe={noop}
      onDeleteGrupoEquipe={noop}
      onUpdatePresencaLink={noop}
    />
  ),
  presenca: (
    <PresencaTempoRealPublica
      token="presenca-exemplo"
      gruposEquipe={[fx.grupo]}
      funcionarios={fx.equipeFuncionarios}
      empresas={fx.empresas}
      obras={fx.obras}
      meuGrupo={fx.grupo}
      meusRegistros={[]}
      dataSelecionada="2026-09-03"
      dataAtual="2026-09-03"
      isLoadingCloud={false}
      loadError=""
      onRetry={noop}
      onSubmitPresenca={async () => ({ success: true, message: 'Enviado.' })}
      onUpdateRecord={async () => ({ success: true, message: 'Atualizado.' })}
    />
  ),
  'presenca-enviada': (
    <PresencaTempoRealPublica
      token="presenca-exemplo"
      gruposEquipe={[fx.grupo]}
      funcionarios={fx.equipeFuncionarios}
      empresas={fx.empresas}
      obras={fx.obras}
      meuGrupo={fx.grupo}
      meusRegistros={fx.registrosEnviados}
      dataSelecionada="2026-09-03"
      dataAtual="2026-09-03"
      isLoadingCloud={false}
      loadError=""
      onRetry={noop}
      onSubmitPresenca={async () => ({ success: true, message: 'Enviado.' })}
      onUpdateRecord={async () => ({ success: true, message: 'Atualizado.' })}
    />
  ),
};

const key = new URLSearchParams(location.search).get('screen') || 'usuarios';

createRoot(document.getElementById('app-root')!).render(
  <div id="main-tab-viewport" style={{ padding: 28, background: '#fff', minHeight: '100vh' }}>
    {screens[key] ?? <p>Tela desconhecida: {key}</p>}
  </div>,
);
