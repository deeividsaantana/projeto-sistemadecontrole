import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './preview.css';
import UsuariosTab from '../src/components/UsuariosTab';
import PresencaTempoRealPublica from '../src/components/PresencaTempoRealPublica';
import Dashboard from '../src/components/Dashboard';
import LancamentosTab from '../src/components/LancamentosTab';
import PeriodoTab from '../src/components/PeriodoTab';
import ConsultaGeralTab from '../src/components/ConsultaGeralTab';
import ConfiguracoesTab from '../src/components/ConfiguracoesTab';
import EstacasTab from '../src/components/EstacasTab';
import CadastrosTab from '../src/components/CadastrosTab';
import ControlePresencaTab from '../src/components/ControlePresencaTab';
import ControleEquipamentosDiarioTab from '../src/components/ControleEquipamentosDiarioTab';
import CentralOperacionalTab from '../src/components/CentralOperacionalTab';
import FrotaTab from '../src/components/FrotaTab';
import ManutencaoTab from '../src/components/ManutencaoTab';
import HorasParadasTab from '../src/components/HorasParadasTab';
import ChecklistTab from '../src/components/ChecklistTab';
import ColaboradoresTab from '../src/components/ColaboradoresTab';
import EquipesTab from '../src/components/EquipesTab';
import ApontamentosTab from '../src/components/ApontamentosTab';
import DdsTreinamentosTab from '../src/components/DdsTreinamentosTab';
import MateriaisTab from '../src/components/MateriaisTab';
import FrentesTab from '../src/components/FrentesTab';
import DiarioObraTab from '../src/components/DiarioObraTab';
import ProducaoTab from '../src/components/ProducaoTab';
import PlanejamentoTab from '../src/components/PlanejamentoTab';
import FvsTab from '../src/components/FvsTab';
import InspecoesTab from '../src/components/InspecoesTab';
import NaoConformidadesTab from '../src/components/NaoConformidadesTab';
import MedicoesTab from '../src/components/MedicoesTab';
import DocumentosTab from '../src/components/DocumentosTab';
import OcorrenciasTab from '../src/components/OcorrenciasTab';
import PendenciasTab from '../src/components/PendenciasTab';
import IndicadoresTab from '../src/components/IndicadoresTab';
import CustosTab from '../src/components/CustosTab';
import OrcamentoTab from '../src/components/OrcamentoTab';
import CronogramaTab from '../src/components/CronogramaTab';
import RelatoriosTab from '../src/components/RelatoriosTab';
import TimelineTab from '../src/components/TimelineTab';
import AuditoriaTab from '../src/components/AuditoriaTab';
import PermissoesTab from '../src/components/PermissoesTab';
import AdministracaoTab from '../src/components/AdministracaoTab';
import NotificacoesTab from '../src/components/NotificacoesTab';
import AssistenteTab from '../src/components/AssistenteTab';
import ModoCampoTab from '../src/components/ModoCampoTab';
import { MODELO_CHECKLIST_PADRAO } from '../src/utils/checklist';
import TicketsJazidaTab from '../src/components/TicketsJazidaTab';
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

// Espelha o link público depois da mudança de desempenho: a resposta traz só o
// dia aberto, e escolher outro dia na régua vai buscar aquele dia. O e2e cobre
// o caminho inteiro — marcar, enviar, e voltar a um dia anterior.
const HOJE_PRESENCA = '2026-09-03';
const ONTEM_PRESENCA = '2026-09-02';

function PresencaFluxoCompleto() {
  const [dataSelecionada, setDataSelecionada] = React.useState(HOJE_PRESENCA);
  const [registros, setRegistros] = React.useState<typeof fx.registrosEnviados>([]);
  const [buscando, setBuscando] = React.useState(false);

  const selecionarDia = (dia: string) => {
    if (dia === dataSelecionada) return;
    setBuscando(true);
    window.setTimeout(() => {
      setDataSelecionada(dia);
      setRegistros(dia === HOJE_PRESENCA ? fx.registrosEnviados : fx.registrosDiaAnterior);
      setBuscando(false);
    }, 60);
  };

  return (
    <PresencaTempoRealPublica
      token="presenca-exemplo"
      gruposEquipe={[fx.grupo]}
      funcionarios={fx.equipeFuncionarios}
      empresas={fx.empresas}
      obras={fx.obras}
      meuGrupo={fx.grupo}
      meusRegistros={registros}
      datasDisponiveis={[HOJE_PRESENCA, ONTEM_PRESENCA]}
      dataSelecionada={dataSelecionada}
      dataAtual={HOJE_PRESENCA}
      onSelectDate={selecionarDia}
      isLoadingCloud={buscando}
      loadError=""
      onRetry={noop}
      onSubmitPresenca={async () => {
        setRegistros(fx.registrosEnviados);
        return { success: true, message: 'Enviado.', submissionId: 'env-e2e-001' };
      }}
      onUpdateRecord={async () => ({ success: true, message: 'Atualizado.' })}
    />
  );
}

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
          activeTab="dashboard"
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
  cadastros: (
    <CadastrosTab
      empresas={fx.empresas}
      obras={fx.obras}
      equipamentos={fx.equipamentos}
      funcionarios={fx.funcionarios}
      comboios={fx.comboios}
      combustiveis={fx.combustiveis}
      lubrificantes={fx.lubrificantes}
      etapas={[]}
      ordensServico={fx.ordensServico}
      onSaveEmpresa={noop}
      onDeleteEmpresa={noop}
      onSaveObra={noop}
      onDeleteObra={noop}
      onSaveEquipamento={noop}
      onDeleteEquipamento={noop}
      onSaveFuncionario={noop}
      onDeleteFuncionario={noop}
      onSaveComboio={noop}
      onDeleteComboio={noop}
      onSaveTipoCombustivel={noop}
      onDeleteTipoCombustivel={noop}
      onSaveProdutoLubrificacao={noop}
      onDeleteProdutoLubrificacao={noop}
      onSaveEtapaServico={noop}
      onDeleteEtapaServico={noop}
      onImportCadastros={() => ({ success: true, message: 'ok' })}
      onApplyMasterWorkbook={async () => ({ success: true, message: 'ok' })}
    />
  ),
  estacas: (
    <EstacasTab
      controle={{ lotes: [], cravacoes: [] }}
      obras={fx.obras}
      onChange={noop}
    />
  ),
  configuracoes: (
    <ConfiguracoesTab
      historyLogs={[]}
      onImportFullData={() => true}
      onImportFilteredByDate={() => ({ success: true, message: 'ok' })}
      onExportFullData={() => '{}'}
      periodosArquivados={[]}
      onArchivePeriod={() => ({ success: true, message: 'ok' })}
      onRestoreArchivedPeriod={() => ({ success: true, message: 'ok' })}
      onDeleteTabData={() => ({ success: true, message: 'ok' })}
    />
  ),
  jazida: (
    <TicketsJazidaTab
      tickets={fx.ticketsJazida}
      equipamentos={fx.equipamentos}
      controlesEquipamentos={fx.controlesEquipamentos}
      obras={fx.obras}
      onSaveTicket={noop}
      onDeleteTicket={noop}
      onDeleteTickets={noop}
      onImportTickets={noop}
      onReserveTicketNumber={async () => '2400'}
      onReserveTicketNumbers={async count => Array.from({ length: count }, (_, i) => String(2400 + i))}
    />
  ),
  frotas: (
    <ControleEquipamentosDiarioTab
      registros={fx.controlesEquipamentos}
      equipamentos={fx.equipamentos}
      empresas={fx.empresas}
      funcionarios={fx.funcionarios}
      gruposEquipe={[fx.grupo]}
      ordensServico={fx.ordensServico}
      registeredBy="Deivid Santana"
      onSave={noop}
      onImport={noop}
      onDeleteMany={noop}
      onOpenEmployeeRegistration={noop}
      onOpenEquipmentRegistration={noop}
    />
  ),
  consulta: (
    <ConsultaGeralTab
      empresas={fx.empresas}
      obras={fx.obras}
      equipamentos={fx.equipamentos}
      funcionarios={fx.funcionarios}
      abastecimentos={fx.abastecimentos}
      tickets={fx.ticketsJazida}
      ordensServico={fx.ordensServico}
      controlesEquipamentos={fx.controlesEquipamentos}
      gruposEquipe={[fx.grupo]}
      presencas={fx.presencasHistorico}
      vinculos={[]}
      onLink={noop}
      onUnlink={noop}
      onNavigate={noop}
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
      lubrificacoes={fx.lubrificacoes}
      onSaveAbastecimento={noop}
      onDeleteAbastecimento={noop}
      onDeleteAbastecimentos={noop}
      onImportAbastecimentos={noop}
      onSaveLubrificacao={noop}
      onDeleteLubrificacao={noop}
    />
  ),
  'modo-campo': (
    <ModoCampoTab
      presencasLink={fx.presencasHistorico}
      controlesEquipamentos={fx.controlesEquipamentos}
      producao={[]}
      ocorrencias={[]}
      nuvemConectada
      onNavigate={noop}
    />
  ),
  assistente: (
    <AssistenteTab dados={{ equipamentos: fx.equipamentos, obras: fx.obras }} onNavigate={noop} />
  ),
  notificacoes: (
    <NotificacoesTab
      notificacoes={[]}
      alertas={[]}
      preferencias={{ categoriasSilenciadas: [], mostrarSistema: true }}
      onPreferenciasChange={noop}
      onMarcarTodasLidas={noop}
      onNavigate={noop}
    />
  ),
  administracao: (
    <AdministracaoTab ultimaSincronizacao="" nuvemConectada={false} onNavigate={noop} />
  ),
  permissoes: (
    <PermissoesTab />
  ),
  auditoria: (
    <AuditoriaTab logs={[]} />
  ),
  timeline: (
    <TimelineTab
      fontes={{ abastecimentos: fx.abastecimentos, ordensServico: fx.ordensServico, controlesEquipamentos: fx.controlesEquipamentos }}
      equipamentos={fx.equipamentos}
      onNavigate={noop}
    />
  ),
  relatorios: (
    <RelatoriosTab dados={{ equipamentos: fx.equipamentos, obras: fx.obras, abastecimentos: fx.abastecimentos, ordensServico: fx.ordensServico }} />
  ),
  cronograma: (
    <CronogramaTab planos={[]} producao={[]} frentes={[]} />
  ),
  orcamento: (
    <OrcamentoTab
      orcamentos={[]}
      lancamentos={[]}
      abastecimentos={fx.abastecimentos}
      ordensServico={fx.ordensServico}
      obras={fx.obras}
      responsavel="Deivid Santana"
      podeEditar
      onSave={noop}
    />
  ),
  custos: (
    <CustosTab
      lancamentos={[]}
      abastecimentos={fx.abastecimentos}
      ordensServico={fx.ordensServico}
      obras={fx.obras}
      frentes={[]}
      equipamentos={fx.equipamentos}
      empresas={fx.empresas}
      responsavel="Deivid Santana"
      podeEditar
      onSave={noop}
    />
  ),
  indicadores: (
    <IndicadoresTab
      dados={{ equipamentos: fx.equipamentos, obras: fx.obras, controlesEquipamentos: fx.controlesEquipamentos }}
    />
  ),
  pendencias: (
    <PendenciasTab
      dados={{ equipamentos: fx.equipamentos, obras: fx.obras, gruposEquipe: [fx.grupo] }}
      onNavigate={noop}
    />
  ),
  ocorrencias: (
    <OcorrenciasTab
      ocorrencias={[]}
      obras={fx.obras}
      frentes={[]}
      equipamentos={fx.equipamentos}
      funcionarios={fx.funcionarios}
      responsavel="Deivid Santana"
      podeEditar
      onSave={noop}
    />
  ),
  documentos: (
    <DocumentosTab
      documentos={[]}
      funcionarios={fx.funcionarios}
      equipamentos={fx.equipamentos}
      obras={fx.obras}
      fichasFvs={[]}
      responsavel="Deivid Santana"
      podeEditar
      onSave={noop}
    />
  ),
  medicoes: (
    <MedicoesTab
      medicoes={[]}
      servicos={[]}
      producao={[]}
      obras={fx.obras}
      responsavel="Deivid Santana"
      podeEditar
      podeAprovar
      onSave={noop}
    />
  ),
  'nao-conformidades': (
    <NaoConformidadesTab
      registros={[]}
      fichasFvs={[]}
      inspecoes={[]}
      obras={fx.obras}
      frentes={[]}
      responsavel="Deivid Santana"
      podeEditar
      onSave={noop}
    />
  ),
  inspecoes: (
    <InspecoesTab
      inspecoes={[]}
      obras={fx.obras}
      frentes={[]}
      equipamentos={fx.equipamentos}
      responsavel="Deivid Santana"
      podeEditar
      onSave={noop}
    />
  ),
  fvs: (
    <FvsTab
      fichas={[]}
      modelos={[]}
      servicos={[]}
      obras={fx.obras}
      frentes={[]}
      responsavel="Deivid Santana"
      podeEditar
      podeAprovar
      onSaveFicha={noop}
      onSaveModelo={noop}
    />
  ),
  planejamento: (
    <PlanejamentoTab
      planos={[]}
      servicos={[]}
      producao={[]}
      obras={fx.obras}
      frentes={[]}
      gruposEquipe={[fx.grupo]}
      responsavel="Deivid Santana"
      podeEditar
      onSave={noop}
    />
  ),
  producao: (
    <ProducaoTab
      servicos={[]}
      registros={[]}
      obras={fx.obras}
      frentes={[]}
      gruposEquipe={[fx.grupo]}
      responsavel="Deivid Santana"
      podeEditar
      onSaveServico={noop}
      onSaveRegistro={noop}
    />
  ),
  'diario-obra': (
    <DiarioObraTab
      diarios={fx.diariosChuva}
      obras={fx.obras}
      gruposEquipe={[fx.grupo]}
      presencasLink={fx.presencasHistorico}
      controlesEquipamentos={fx.controlesEquipamentos}
      apontamentos={[]}
      movimentosMaterial={[]}
      ticketsJazida={fx.ticketsJazida}
      responsavel="Deivid Santana"
      podeEditar
      onSave={noop}
    />
  ),
  frentes: (
    <FrentesTab
      frentes={[]}
      obras={fx.obras}
      gruposEquipe={[fx.grupo]}
      presencasLink={fx.presencasHistorico}
      controlesEquipamentos={fx.controlesEquipamentos}
      apontamentos={[]}
      movimentosMaterial={[]}
      ticketsJazida={fx.ticketsJazida}
      podeEditar
      onSave={noop}
    />
  ),
  materiais: (
    <MateriaisTab
      materiais={fx.materiaisObra}
      movimentos={fx.movimentosMateriaisObra}
      empresas={fx.empresas}
      responsavel="Deivid Santana"
      podeEditar
      onSaveMaterial={noop}
      onSaveMovimento={noop}
    />
  ),
  'dds-treinamentos': (
    <DdsTreinamentosTab
      registrosDds={[]}
      treinamentos={[]}
      funcionarios={fx.equipeFuncionarios}
      responsavel="Deivid Santana"
      podeEditar
      onSaveDds={noop}
      onSaveTreinamento={noop}
    />
  ),
  apontamentos: (
    <ApontamentosTab
      apontamentos={[]}
      funcionarios={fx.equipeFuncionarios}
      gruposEquipe={[fx.grupo]}
      etapas={[]}
      responsavel="Deivid Santana"
      podeEditar
      onSave={noop}
      onDelete={noop}
    />
  ),
  equipes: (
    <EquipesTab
      gruposEquipe={[fx.grupo]}
      funcionarios={fx.equipeFuncionarios}
      obras={fx.obras}
      presencasLink={fx.presencasHistorico}
      controlesEquipamentos={fx.controlesEquipamentos}
      podeRealocar
      onSaveGrupoEquipe={noop}
      onNavigate={noop}
    />
  ),
  colaboradores: (
    <ColaboradoresTab
      funcionarios={fx.equipeFuncionarios}
      empresas={fx.empresas}
      gruposEquipe={[fx.grupo]}
      presencasLink={fx.presencasHistorico}
      controlesEquipamentos={fx.controlesEquipamentos}
      ticketsJazida={fx.ticketsJazida}
      onNavigate={noop}
      responsavel="Preview"
      onAlterarSituacao={noop}
    />
  ),
  checklist: (
    <ChecklistTab
      checklists={[]}
      modelo={MODELO_CHECKLIST_PADRAO}
      equipamentos={fx.equipamentos}
      responsavel="Deivid Santana"
      podeEditar
      onSave={noop}
      onSaveModelo={noop}
    />
  ),
  'horas-paradas': (
    <HorasParadasTab
      controlesEquipamentos={fx.controlesEquipamentos}
      ordensServico={fx.ordensServico}
      equipamentos={fx.equipamentos}
    />
  ),
  manutencao: (
    <ManutencaoTab
      ordensServico={fx.ordensServico}
      equipamentos={fx.equipamentos}
      responsavel="Deivid Santana"
      podeEditar
      onSave={noop}
      onDelete={noop}
    />
  ),
  frota: (
    <FrotaTab
      equipamentos={fx.equipamentos}
      empresas={fx.empresas}
      obras={fx.obras}
      funcionarios={fx.funcionarios}
      gruposEquipe={[fx.grupo]}
      controlesEquipamentos={fx.controlesEquipamentos}
      ordensServico={fx.ordensServico}
      abastecimentos={fx.abastecimentos}
      ticketsJazida={fx.ticketsJazida}
      onNavigate={noop}
    />
  ),
  'central-operacional': (
    <CentralOperacionalTab
      equipamentos={fx.equipamentos}
      controlesEquipamentos={fx.controlesEquipamentos}
      gruposEquipe={[fx.grupo]}
      presencasLink={fx.registrosEnviados}
      ordensServico={fx.ordensServico}
      ticketsJazida={fx.ticketsJazida}
      obras={fx.obras}
      podeAtualizar
      responsavel="Deivid Santana"
      onSaveControleEquipamento={noop}
      onNavigate={noop}
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
      controlesEquipamentos={fx.controlesEquipamentos}
      gruposEquipe={[fx.grupo]}
      onNavigate={noop}
    />
  ),
  'presenca-admin': (
    <ControlePresencaTab
      empresas={fx.empresas}
      funcionarios={fx.efetivoPresenca}
      obras={fx.obras}
      gruposEquipe={fx.equipesPresenca}
      presencasLink={fx.presencasHistorico}
      historicoPresencas={[]}
      onSaveGrupoEquipe={noop}
      onDeleteGrupoEquipe={noop}
      onUpdatePresencaLink={noop}
      onLancarPresencaManual={noop}
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
  'presenca-fluxo': <PresencaFluxoCompleto />,
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
const previewQueryClient = new QueryClient();

createRoot(document.getElementById('app-root')!).render(
  <QueryClientProvider client={previewQueryClient}>
    <div
      id="main-tab-viewport"
      /* Mesmas medidas do App.tsx: o painel roda sem recuo (dashboard-viewport)
         e as demais telas dentro do padding responsivo. Com um `padding: 28`
         fixo o preview inventava 5 px de estouro no painel e escondia o recuo
         real das outras telas — a verificação de largura não valia nada. */
      className={key === 'painel'
        ? 'dashboard-viewport mx-auto w-full'
        : 'mx-auto w-full max-w-[1440px] p-3.5 sm:p-4 md:p-7 2xl:p-10'}
      style={{ background: '#fff', minHeight: '100vh' }}
    >
      {screens[key] ?? <p>Tela desconhecida: {key}</p>}
    </div>
  </QueryClientProvider>,
);
