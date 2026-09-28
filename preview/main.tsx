import type { EtapaServico, FrenteServico, ModeloRotina, PendenciaRotina, PlanejamentoItem, PrevistoMaterial, RegistroProducao, RotinaDiaria, ServicoObra } from '../src/types';
import MeuDiaTab from '../src/components/MeuDiaTab';
import { planoCargaSge } from '../src/modules/materials/locaisSge';
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
import QuadroFrotaTab from '../src/components/QuadroFrotaTab';
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
import DiarioObraTab from '../src/components/DiarioObraTab';
import PlanejamentoTab from '../src/components/PlanejamentoTab';
import PendenciasTab from '../src/components/PendenciasTab';
import IndicadoresTab from '../src/components/IndicadoresTab';
import CustosTab from '../src/components/CustosTab';
import OrcamentoTab from '../src/components/OrcamentoTab';
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
import { apagarDeVez, criarExclusao, restaurarExclusao, type ExclusaoRegistro } from '../src/cloud/exclusoes';

const noop = () => {};

/** Quadro com estado: o que se salva no painel volta para o quadro, como no app. */
function QuadroFrotaPreview() {
  const [registros, setRegistros] = React.useState(fx.controlesQuadro);
  return (
    <QuadroFrotaTab
      equipamentos={fx.equipamentosQuadro}
      registros={registros}
      gruposEquipe={[fx.grupo]}
      abastecimentos={fx.abastecimentosQuadro as never}
      frentes={[{ id: 'fr-av', nome: 'AV. BRASIL', situacao: 'Em execução', ativo: true, criadoEm: '', atualizadoEm: '' }]}
      funcionarios={fx.funcionarios}
      podeEditar
      usuario="Deivid"
      onSave={(registro, novo) => setRegistros(atual => (novo ? [registro, ...atual] : atual.map(item => (item.id === registro.id ? registro : item))))}
      onNavigate={noop}
    />
  );
}
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
const comListaSge = new URLSearchParams(location.search).get('sge') === '1';
// Com ?vazio=1 abre sem nenhuma estaca, para conferir o primeiro uso.
function EstacasPreview() {
  const [controle, setControle] = React.useState(() => (new URLSearchParams(window.location.search).get('vazio') ? { lotes: [], cravacoes: [] } : fx.controleEstacas));
  return <EstacasTab controle={controle} obras={fx.obras} onChange={setControle} responsavel="Deivid" />;
}

function CadastrosPreview() {
  const [listas, setListas] = React.useState<Record<string, Array<{ id: string } & Record<string, unknown>>>>(() => ({
    empresas: [...fx.empresas],
    funcionarios: [...fx.funcionarios, ...fx.efetivoPresenca],
    equipamentos: [...fx.equipamentos],
    obras: [...fx.obras],
    comboios: [...fx.comboios],
    combustiveis: [...fx.combustiveis],
    lubrificantes: [...fx.lubrificantes],
    // Com ?sge=1 os ramos vêm com a lista SGE carregada, para conferir classes e códigos.
    etapas: comListaSge ? [...fx.etapasRamos, ...planoCargaSge(fx.etapasRamos).novas] : [...fx.etapasRamos],
    frentesServico: [
      { id: 'FRE-1', nome: 'Aterro Ramo 900', ramoLocal: 'Ramo 900', servico: 'Aterro compactado', responsavel: 'Encarregado Paulo', situacao: 'Em execução', ativo: true, criadoEm: '', atualizadoEm: '' },
      { id: 'FRE-2', nome: 'Corte Ramo 1400', ramoLocal: 'Ramo 1400', servico: 'Escavação e carga', situacao: 'Paralisada', ativo: true, criadoEm: '', atualizadoEm: '' },
    ],
    servicosObra: [
      { id: 'SER-1', codigo: '3.1', descricao: 'Aterro compactado', unidade: 'm³', quantidadePrevista: 48000, situacao: 'Ativo', ativo: true, criadoEm: '', atualizadoEm: '' },
      { id: 'SER-2', codigo: '2.4', descricao: 'Escavação e carga', unidade: 'm³', quantidadePrevista: 62500, situacao: 'Ativo', ativo: true, criadoEm: '', atualizadoEm: '' },
    ],
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
  const apagarVarios = (exclusaoIds: string[]) => {
    const agora = new Date().toISOString();
    setExclusoes(atual => atual.map(item => (exclusaoIds.includes(item.id) ? apagarDeVez(item, 'Deivid Santana', agora) : item)));
    return { ok: true, mensagem: exclusaoIds.length === 1 ? 'Excluído de vez.' : `${exclusaoIds.length} cadastros foram excluídos de vez.` };
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
      frentesServico={listas.frentesServico as never}
      servicosObra={listas.servicosObra as never}
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
      onSaveFrente={salvar('frentesServico')}
      onSaveServico={salvar('servicosObra')}
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
      onApagarDeVez={apagarVarios}
      onImportCadastros={() => ({ success: true, message: 'ok' })}
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

// Materiais com estado: importar, lançar e ligar local mudam a tela como no
// app. Os ramos começam vazios para conferir a carga da lista SGE.
function MateriaisPreview() {
  const [materiais, setMateriais] = React.useState(() => [...fx.materiaisObra]);
  // Os usos do link entram junto para a parte Apontadores ter envios e fotos.
  const [movimentos, setMovimentos] = React.useState(() => [
    ...fx.movimentosMateriaisObra,
    ...movimentosComFotos.filter(item => item.origemApontamentoId),
    // Nomes que nenhum local conhece, para a parte Ramos e locais ter o que criar.
    ...['BOTA-FORA ESTRADA VELHA', 'ATERRO RAMO 1300', 'PÁTIO CENTRAL'].map((destino, posicao) => ({ ...fx.movimentosMateriaisObra[0], id: `sem-local-${posicao}`, destino, etapaServicoId: undefined, etapaServicoNome: undefined })),
  ]);
  const [etapas, setEtapas] = React.useState<EtapaServico[]>([]);
  const [previstos, setPrevistos] = React.useState<PrevistoMaterial[]>([]);
  const lixeira = React.useRef(new Map<string, EtapaServico>());
  const [apagados, setApagados] = React.useState<Set<string>>(new Set());
  const juntar = <T extends { id: string }>(atuais: T[], novos: T[]) => {
    const porId = new Map(novos.map(item => [item.id, item]));
    const ids = new Set(atuais.map(item => item.id));
    return [...atuais.map(item => porId.get(item.id) ?? item), ...novos.filter(item => !ids.has(item.id))];
  };
  return (
    <MateriaisTab
      materiais={materiais}
      movimentos={movimentos}
      empresas={fx.empresas}
      etapas={etapas}
      responsavel="Deivid Santana"
      podeEditar
      onSaveMaterial={material => setMateriais(atual => juntar(atual, [material]))}
      onSaveMovimento={movimento => setMovimentos(atual => [movimento, ...atual])}
      onSaveMovimentos={novos => setMovimentos(atual => [...novos, ...atual])}
      onUpdateMovimentos={alterados => setMovimentos(atual => juntar(atual, alterados))}
      onApplyImport={(novosMateriais, novosMovimentos) => { setMateriais(atual => juntar(atual, novosMateriais)); setMovimentos(atual => juntar(atual, novosMovimentos)); }}
      onSaveEtapas={itens => setEtapas(atual => juntar(atual, itens))}
      onExcluirLocal={id => {
        const alvo = etapas.find(item => item.id === id);
        if (alvo) lixeira.current.set(`lixo-${id}`, alvo);
        setApagados(atual => new Set([...atual, id]));
        setEtapas(atual => atual.filter(item => item.id !== id));
        return { ok: true, exclusaoId: `lixo-${id}` };
      }}
      locaisApagados={apagados}
      onRestaurarLocal={exclusaoId => {
        const volta = lixeira.current.get(exclusaoId);
        if (volta) { setEtapas(atual => [...atual, volta]); setApagados(atual => new Set([...atual].filter(id => id !== volta.id))); }
        return { ok: Boolean(volta), mensagem: volta ? `${volta.nome} voltou para a lista.` : 'Já foi restaurado.' };
      }}
      previstos={previstos}
      onSavePrevistos={itens => setPrevistos(atual => juntar(atual, itens))}
    />
  );
}

function MeuDiaPreview() {
  const hoje = new Date().toISOString().slice(0, 10);
  const ontem = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const [rotinas, setRotinas] = React.useState<RotinaDiaria[]>(() => [
    { id: `${ontem}:Deivid Santana`, dia: ontem, responsavel: 'Deivid Santana', feitos: [], levantar: '', duvida: '', aprendi: '', amanha: ['Cobrar a nota da brita da Pedra Forte', 'Conferir o aterro do Ramo 900 com a topografia', 'Fechar o diesel da semana'], criadoEm: ontem, atualizadoEm: ontem },
    { id: `${hoje}:Deivid Santana`, dia: hoje, responsavel: 'Deivid Santana', feitos: ['inicio-1', 'inicio-2', 'inicio-5', 'projeto-1'], levantar: '', duvida: '', aprendi: '', amanha: ['', '', ''], criadoEm: hoje, atualizadoEm: hoje },
  ]);
  const base = { responsavel: 'Deivid Santana', criadoEm: `${ontem}T10:00:00Z`, atualizadoEm: `${ontem}T10:00:00Z` };
  const [pendencias, setPendencias] = React.useState<PendenciaRotina[]>(() => [
    { ...base, id: 'p1', titulo: 'Escavadeira EH-12 parada sem justificativa no Ramo 700', prioridade: 'critico', tipo: 'campo', frente: 'Ramo 700', dia: ontem },
    { ...base, id: 'p2', titulo: 'Cobrar a nota fiscal da brita do dia 25', prioridade: 'importante', tipo: 'cobrar', dependeDe: 'Pedra Forte', prazo: ontem, dia: ontem },
    { ...base, id: 'p3', titulo: 'Atualizar a planilha de medição do Ramo 900', prioridade: 'importante', tipo: 'medicao', frente: 'Ramo 900', dia: hoje },
    { ...base, id: 'p4', titulo: 'Conferir o consumo de diesel dos caminhões', prioridade: 'acompanhar', tipo: 'planilha', dia: hoje },
    { ...base, id: 'p5', titulo: 'Organizar as fotos da semana por ramo', prioridade: 'rotina', tipo: 'outro', dia: hoje },
  ]);
  const [modelos, setModelos] = React.useState<ModeloRotina[]>([]);
  const carimbo = { criadoEm: `${ontem}T10:00:00Z`, atualizadoEm: `${ontem}T10:00:00Z`, ativo: true };
  const inicioMes = `${hoje.slice(0, 8)}01`;
  const fimMes = new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const frentes: FrenteServico[] = [
    { ...carimbo, id: 'f900', nome: 'Ramo 900', servico: 'Aterro e espinha', responsavel: 'Carlos', situacao: 'Em execução' },
    { ...carimbo, id: 'f700', nome: 'Ramo 700', servico: 'Corte', responsavel: 'Marcos', situacao: 'Em execução' },
    { ...carimbo, id: 'f1400', nome: 'Ramo 1400', servico: 'Base de reforço', situacao: 'Em execução' },
  ];
  const servicos: ServicoObra[] = [
    { ...carimbo, id: 'aterro', descricao: 'Aterro compactado', unidade: 'm³', situacao: 'Ativo' },
    { ...carimbo, id: 'corte', descricao: 'Corte e carga', unidade: 'm³', situacao: 'Ativo' },
    { ...carimbo, id: 'brita', descricao: 'Coluna de brita', unidade: 'm', situacao: 'Ativo' },
  ];
  const [producao, setProducao] = React.useState<RegistroProducao[]>(() => [
    { ...carimbo, id: 'r1', data: inicioMes, servicoId: 'aterro', servicoDescricao: 'Aterro compactado', unidade: 'm³', quantidade: 3200, frente: 'Ramo 900', responsavel: 'Deivid Santana' },
    { ...carimbo, id: 'r2', data: hoje, servicoId: 'aterro', servicoDescricao: 'Aterro compactado', unidade: 'm³', quantidade: 480, frente: 'Ramo 900', responsavel: 'Deivid Santana' },
    { ...carimbo, id: 'r3', data: hoje, servicoId: 'brita', servicoDescricao: 'Coluna de brita', unidade: 'm', quantidade: 96, frente: 'Ramo 900', responsavel: 'Deivid Santana' },
    { ...carimbo, id: 'r4', data: ontem, servicoId: 'corte', servicoDescricao: 'Corte e carga', unidade: 'm³', quantidade: 1500, frente: 'Ramo 700', responsavel: 'Deivid Santana' },
  ]);
  const [planos, setPlanos] = React.useState<PlanejamentoItem[]>(() => [
    { ...carimbo, id: 'p1', dataInicio: inicioMes, dataFim: fimMes, servicoId: 'aterro', servicoDescricao: 'Aterro compactado', unidade: 'm³', quantidadePlanejada: 12000, frente: 'Ramo 900', responsavel: 'Deivid Santana', situacao: 'Em execução' },
    { ...carimbo, id: 'p2', dataInicio: inicioMes, dataFim: fimMes, servicoId: 'corte', servicoDescricao: 'Corte e carga', unidade: 'm³', quantidadePlanejada: 6000, frente: 'Ramo 700', responsavel: 'Deivid Santana', situacao: 'Em execução' },
  ]);
  const trocar = <T extends { id: string }>(lista: T[], item: T) => (lista.some(atual => atual.id === item.id) ? lista.map(atual => (atual.id === item.id ? item : atual)) : [...lista, item]);
  return (
    <MeuDiaTab
      responsavel="Deivid Santana"
      rotinas={rotinas}
      pendencias={pendencias}
      modelos={modelos}
      onSaveRotina={rotina => setRotinas(atual => trocar(atual, rotina))}
      onSavePendencia={pendencia => setPendencias(atual => trocar(atual, pendencia))}
      onSaveModelo={modelo => setModelos(atual => trocar(atual, modelo))}
      frentes={frentes}
      servicos={servicos}
      producao={producao}
      planos={planos}
      onSaveProducao={registro => setProducao(atual => [registro, ...atual])}
      onSavePlano={plano => setPlanos(atual => [plano, ...atual])}
      materiais={fx.materiaisObra}
      movimentosMaterial={[
        ...fx.movimentosMateriaisObra.map((item, posicao) => (posicao < 6 ? { ...item, data: hoje } : item)),
        ...movimentosComFotos.filter(item => item.origemApontamentoId).map(item => ({ ...item, data: hoje })),
        { ...fx.movimentosMateriaisObra[0], id: 'envio-ontem', data: ontem, origemApontamentoId: 'envio-ontem', apontadoPor: 'Ricardo', tipo: 'Saída' as const },
      ]}
      abastecimentos={fx.abastecimentos.map(item => ({ ...item, data: hoje }))}
      controlesFrota={[...fx.controlesEquipamentos.map(item => ({ ...item, data: hoje })), { ...fx.controlesEquipamentos[0], id: 'sem-motivo', prefixo: 'RE-03', status: 'Aguardando motorista' as const, motivoManutencao: undefined, observacao: '', data: hoje }]}
      equipamentos={fx.equipamentos}
      onIrPara={() => undefined}
    />
  );
}

// Mais de cinco equipes, para o preview mostrar o "Mostrar mais equipes" do painel.
const equipesPainel = [fx.grupo, ...fx.equipesPresenca,
  ...['Terraplenagem Norte', 'Drenagem', 'Pavimentação', 'Topografia', 'Obras de arte'].map((nome, i) => ({
    ...fx.grupo, id: `painel-extra-${i}`, nome: `Equipe ${nome}`, frenteServico: `Ramo ${(i + 3) * 100}`, token: `painel-extra-${i}`,
  }))];

const screens: Record<string, React.ReactNode> = {
  'meu-dia': <MeuDiaPreview />,
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
  estacas: <EstacasPreview />,
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
  'quadro-frota': <QuadroFrotaPreview />,
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
  materiais: <MateriaisPreview />,
  'materiais-utilizacao': (
    <MateriaisUtilizacaoPanel
      materiais={fx.materiaisUtilizacao}
      movimentos={fx.movimentosUtilizacao}
      etapas={fx.etapasRamos}
      responsavel="Deivid Santana"
      podeEditar
      classe=""
      onClasse={noop}
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
      gruposEquipe={equipesPainel}
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
