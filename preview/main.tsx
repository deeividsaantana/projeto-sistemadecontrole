import React from 'react';
import { createRoot } from 'react-dom/client';
import './preview.css';
import UsuariosTab from '../src/components/UsuariosTab';
import PresencaTempoRealPublica from '../src/components/PresencaTempoRealPublica';
import Dashboard from '../src/components/Dashboard';
import LancamentosTab from '../src/components/LancamentosTab';
import PeriodoTab from '../src/components/PeriodoTab';
import ControlePresencaTab from '../src/components/ControlePresencaTab';
import * as fx from './fixtures';

const noop = () => {};
const screens: Record<string, React.ReactNode> = {
  usuarios: <UsuariosTab />,
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
