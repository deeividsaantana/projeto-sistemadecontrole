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
import MateriaisUtilizacaoPanel from '../src/components/MateriaisUtilizacaoPanel';
import MaterialLinkApontador from '../src/components/MaterialLinkApontador';
import { buildFieldView } from '../api/_shared/material-usage.js';
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
import { criarExclusao, restaurarExclusao, type ExclusaoRegistro } from '../src/cloud/exclusoes';

const noop = () => {};
const blockRegistryDeletion = new URLSearchParams(location.search).get('blockedRegistry') === '1';
const previewGroups = NAVIGATION_GROUPS.map(g => ({ label: g.label, items: [...g.items] }));
const previewNotifications = [
  { id: '1', type: 'success' as const, title: 'Sincronizacao concluida', message: 'Dados do periodo enviados para a nuvem.', timestamp: '08:12', read: false, source: 'Firebase Cloud' as const },
  { id: '2', type: 'warning' as const, title: 'Estoque baixo', message: 'Produto de lubrificacao abaixo do minimo.', timestamp: '07:40', read: true, source: 'Sistema Local' as const },
];

// Cadastros com estado de verdade: excluir tira da lista e põe na Lixeira,
// restaurar devolve. Com ?blockedRegistry=1 todo cadastro aparece como usado
// em lançamentos, para conferir a janela que trava a exclusão; com
// ?emUso=alguns só um em cada três fica travado, para conferir o lote misto.
const algunsEmUso = new URLSearchParams(location.search).get('emUso') === 'alguns';
function CadastrosPreview() {
  const [listas, setListas] = React.useState<Record<string, Array<{ id: string } & Record<string, unknown>>>>(() => ({
    empresas: [...fx.empresas],
    funcionarios: [...fx.funcionarios, ...fx.efetivoPresenca],
    equipamentos: [...fx.equipamentos],
    obras: [...fx.obras],
    comboios: [...fx.comboios],
    combustiveis: [...fx.combustiveis],
    lubrificantes: [...fx.lubrificantes],
    etapas: [...fx.etapasRamos],
  } as never));
  const [exclusoes, setExclusoes] = React.useState<ExclusaoRegistro[]>([]);
  const salvar = (tabela: string) => (item: { id: string }) => setListas(atual => ({
    ...atual,
    [tabela]: atual[tabela].some(registro => registro.id === item.id)
      ? atual[tabela].map(registro => (registro.id === item.id ? item as never : registro))
      : [...atual[tabela], item as never],
  }));
  const usos = (_tabela?: string, id = ''): Array<{ collection: string; count: number }> => (
    blockRegistryDeletion || (algunsEmUso && Number(id.replace(/\D/g, '')) % 3 === 0)
      ? [{ collection: 'Abastecimentos', count: 12 }, { collection: 'Presenças', count: 3 }]
      : []
  );
  const excluirVarios = (tabela: string, alvos: Array<{ id: string; rotulo: string }>) => {
    const agora = new Date().toISOString();
    const travados = alvos.filter(alvo => usos(tabela, alvo.id).length > 0).map(alvo => ({ ...alvo, usos: usos(tabela, alvo.id) }));
    const livres = alvos.filter(alvo => usos(tabela, alvo.id).length === 0 && listas[tabela].some(item => item.id === alvo.id));
    const novas = livres.map(alvo => criarExclusao({ tabela, registro: listas[tabela].find(item => item.id === alvo.id)!, rotulo: alvo.rotulo, usuario: 'Deivid Santana', agora }));
    const ids = new Set(livres.map(alvo => alvo.id));
    setListas(atual => ({ ...atual, [tabela]: atual[tabela].filter(item => !ids.has(item.id)) }));
    setExclusoes(atual => [...novas, ...atual]);
    return { excluidos: livres.map((alvo, indice) => ({ ...alvo, exclusaoId: novas[indice].id })), travados };
  };
  const restaurarVarios = (exclusaoIds: string[]) => {
    const pedidos = exclusoes.filter(item => exclusaoIds.includes(item.id) && !item.restauradoEm);
    if (pedidos.length === 0) return { ok: false, mensagem: 'Não achei esses itens na Lixeira.' };
    const agora = new Date().toISOString();
    setListas(atual => {
      const proximo = { ...atual };
      pedidos.forEach(exclusao => { proximo[exclusao.tabela] = [...proximo[exclusao.tabela], exclusao.registro as never]; });
      return proximo;
    });
    setExclusoes(atual => atual.map(item => (exclusaoIds.includes(item.id) ? restaurarExclusao(item, 'Deivid Santana', agora) : item)));
    return { ok: true, mensagem: pedidos.length === 1 ? `${pedidos[0].rotulo} voltou para a lista.` : `${pedidos.length} cadastros voltaram para a lista.` };
  };
  return (
    <CadastrosTab
      empresas={listas.empresas as never}
      obras={listas.obras as never}
      equipamentos={listas.equipamentos as never}
      funcionarios={listas.funcionarios as never}
      comboios={listas.comboios as never}
      combustiveis={listas.combustiveis as never}
      lubrificantes={listas.lubrificantes as never}
      etapas={listas.etapas as never}
      historyLogs={[]}
      exclusoes={exclusoes}
      podeEditar
      podeExcluir
      onSaveEmpresa={salvar('empresas')}
      onSaveObra={salvar('obras')}
      onSaveEquipamento={salvar('equipamentos')}
      onSaveFuncionario={salvar('funcionarios')}
      onSaveComboio={salvar('comboios')}
      onSaveTipoCombustivel={salvar('combustiveis')}
      onSaveProdutoLubrificacao={salvar('lubrificantes')}
      onSaveEtapaServico={salvar('etapas')}
      onInativar={(tabela, id) => setListas(atual => ({
        ...atual,
        [tabela]: atual[tabela].map(registro => (registro.id === id ? { ...registro, ativo: false, status: tabela === 'equipamentos' ? 'Desmobilizado' : 'INATIVO' } : registro)),
      }))}
      usosDoCadastro={usos}
      onExcluir={(tabela, id, rotulo) => {
        const resultado = excluirVarios(tabela, [{ id, rotulo }]);
        if (resultado.excluidos.length > 0) return { ok: true, exclusaoId: resultado.excluidos[0].exclusaoId };
        return { ok: false, usos: resultado.travados[0]?.usos || [], mensagem: resultado.travados.length ? undefined : 'Cadastro não encontrado.' };
      }}
      onRestaurar={exclusaoId => restaurarVarios([exclusaoId])}
      onExcluirVarios={excluirVarios}
      onRestaurarVarios={restaurarVarios}
      onImportCadastros={() => ({ success: true, message: 'ok' })}
      onApplyMasterWorkbook={async () => ({ success: true, message: 'ok' })}
    />
  );
}

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

// O link do apontador lê o mesmo cálculo do servidor, sobre os dados da prévia.
const materialLinkView = buildFieldView({
  etapas: fx.etapasRamos,
  materiais: fx.materiaisUtilizacao,
  movimentos: fx.movimentosUtilizacao,
  pendentes: [],
  today: '2026-09-24',
});

// Fotos de mentira para a prévia do Painel: no app elas vêm do Storage.
const fotoPrevia = (fundo: string, terra: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90"><rect width="90" height="90" fill="${fundo}"/><path d="M0 60 Q30 45 90 58 V90 H0Z" fill="${terra}"/><circle cx="46" cy="64" r="11" fill="#9aa39e" stroke="#6f7873" stroke-width="3"/></svg>`)}`;
const fotosPorEnvio: Record<string, string[]> = {
  u3: [fotoPrevia('#b9d3e6', '#8a6a4a'), fotoPrevia('#c9dbe8', '#7a5c3e')],
  u4: [fotoPrevia('#d6e2ea', '#94704f')],
  u7: [fotoPrevia('#bcd0dd', '#80603f'), fotoPrevia('#cfdde6', '#8f6b48'), fotoPrevia('#c4d6e2', '#7d5a3b')],
};
const movimentosComFotos = fx.movimentosUtilizacao.map(item => ({ ...item, fotos: fotosPorEnvio[item.id] }));

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
          isCloudConnected
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
  cadastros: <CadastrosPreview />,
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
      etapas={[]}
      responsavel="Deivid Santana"
      podeEditar
      onSaveMaterial={noop}
      onSaveMovimento={noop}
      onSaveMovimentos={noop}
      onUpdateMovimentos={noop}
      onApplyImport={noop}
    />
  ),
  'materiais-utilizacao': (
    <MateriaisUtilizacaoPanel
      materiais={fx.materiaisUtilizacao}
      movimentos={fx.movimentosUtilizacao}
      etapas={fx.etapasRamos}
      responsavel="Deivid Santana"
      podeEditar
      onSaveMovimentos={noop}
      onUpdateMovimentos={noop}
    />
  ),
  'material-link': (
    <MaterialLinkApontador
      loadView={async () => materialLinkView}
      submitUse={async () => ({ message: 'Uso salvo.' })}
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
      controlesEquipamentos={fx.controlesEquipamentos}
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
      movimentosMaterial={movimentosComFotos}
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

// Os links públicos rodam fora do ERP (PublicLinksApp), sem o
// #main-tab-viewport e os estilos de formulário dele.
const isPublicScreen = key === 'material-link';

createRoot(document.getElementById('app-root')!).render(
  <QueryClientProvider client={previewQueryClient}>
    {isPublicScreen ? (screens[key] ?? null) : <div
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
    </div>}
  </QueryClientProvider>,
);
