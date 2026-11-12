import type { EtapaServico, HistoryLog, FrenteServico, ModeloRotina, PendenciaRotina, RegistroProducao, RotinaDiaria, ServicoObra } from '../src/types';
import MeuDiaTab from '../src/components/MeuDiaTab';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './preview.css';
import UsuariosTab from '../src/components/UsuariosTab';
import PresencaTempoRealPublica from '../src/components/PresencaTempoRealPublica';
import Dashboard from '../src/components/Dashboard';
import LancamentosTab from '../src/components/LancamentosTab';
import EstacasTab from '../src/components/EstacasTab';
import CadastrosTab from '../src/components/CadastrosTab';
import ControlePresencaTab from '../src/components/ControlePresencaTab';
import { inativar, reativar, somenteAtivos } from '../src/utils/inativacao';
import ControleEquipamentosDiarioTab from '../src/components/ControleEquipamentosDiarioTab';
import QuadroFrota from '../src/components/quadroFrota/QuadroFrota';
import ManutencaoTab from '../src/components/ManutencaoTab';
import ColaboradoresTab from '../src/components/ColaboradoresTab';
import DiarioObraTab from '../src/components/DiarioObraTab';
import { SolicitacoesPreview } from './solicitacoesPreview';
import { DesktopSidebar } from '../src/app/shell/DesktopSidebar';
import { DesktopTopBar } from '../src/app/shell/DesktopTopBar';
import { PRIMARY_MODULE_IDS, ROLE_ACCESS, SIDEBAR_NAVIGATION_GROUPS, destinoDaAba } from '../src/app/navigation/navigation';
import { PesquisaGlobal } from '../src/app/shell/PesquisaGlobal';
import * as fx from './fixtures';
import { RouteMotion } from '../src/shared/ui/RouteMotion';
import { TelaCheia } from '../src/shared/ui/TelaCheia';
import { AbasDaTela, idDaAba, type ItemDasAbas } from '../src/shared/ui/AbasDaTela';
import { PageHeader } from '../src/shared/ui/PageHeader';
import { PularParaConteudo } from '../src/shared/ui/PularParaConteudo';
import { instalarGuardaDeMovimento } from '../src/shared/motion/guardaDeMovimento';
import { LoginScreen } from '../src/auth/LoginScreen';
import { apagarDeVez, criarExclusao, restaurarExclusao, type ExclusaoRegistro } from '../src/cloud/exclusoes';

const noop = () => {};
const noopImportAbastecimentos = (items: unknown[] = []) => ({
  requested: items.length,
  accepted: 0,
  rejected: items.length,
  totalAfter: 0,
});

/** Manutenção com estado: liberar, entrar e conferir voltam para a tela, como no app. */
function ManutencaoPreview() {
  const [registros, setRegistros] = React.useState(fx.controlesManutencao);
  const [ordens, setOrdens] = React.useState(fx.ordensManutencao);
  const [logs, setLogs] = React.useState<HistoryLog[]>([]);
  const salvar = (registro: (typeof registros)[number], descricao = `Editou o controle de ${registro.prefixo}.`) => {
    setRegistros(atual => atual.some(item => item.id === registro.id) ? atual.map(item => item.id === registro.id ? registro : item) : [registro, ...atual]);
    setLogs(atual => [{ id: `log-${Date.now()}`, timestamp: new Date().toLocaleString('pt-BR'), usuario: 'Deivid Santana', acao: 'Editou', tela: 'Manutenção', descricao }, ...atual]);
  };
  return (
    <ManutencaoTab
      buscaInicial={buscaDaUrl}
      onVerNoQuadro={prefixo => location.assign(`/?screen=frotas&shell=1&busca=${encodeURIComponent(prefixo)}`)}
      ordensServico={ordens}
      equipamentos={fx.equipamentosManutencao}
      controlesEquipamentos={registros}
      responsavel="Deivid Santana"
      podeEditar
      podeReabrirConferencia
      historyLogs={logs}
      onSave={(ordem, novo) => setOrdens(atual => novo ? [ordem, ...atual] : atual.map(item => item.id === ordem.id ? ordem : item))}
      onSaveControle={registro => salvar(registro)}
      onSalvarConferencia={salvar}
      onDelete={noop}
    />
  );
}

/** Quadro com estado: o que se salva no painel volta para o quadro, como no app. */
/** Prefixo vindo da outra tela (Quadro <-> Manutenção), como no app. */
const buscaDaUrl = new URLSearchParams(location.search).get('busca') || '';

function QuadroFrotaPreview({ dia, onAbrirSituacao, busca }: { dia: string; onAbrirSituacao: () => void; busca: string }) {
  const [registros, setRegistros] = React.useState(fx.controlesQuadro);
  const [equipamentos, setEquipamentos] = React.useState(fx.equipamentosQuadro);
  return (
    <QuadroFrota
      buscaInicial={busca}
      onVerOrdens={prefixo => location.assign(`/?screen=manutencao&shell=1&busca=${encodeURIComponent(prefixo)}`)}
      equipamentos={equipamentos}
      registros={registros}
      gruposEquipe={[fx.grupo]}
      abastecimentos={fx.abastecimentosQuadro as never}
      frentes={[{ id: 'fr-av', nome: 'AV. BRASIL', situacao: 'Em execução', ativo: true, criadoEm: '', atualizadoEm: '' }]}
      funcionarios={fx.funcionarios}
      podeEditar
      usuario="Deivid"
      onSave={(registro, novo) => setRegistros(atual => (novo ? [registro, ...atual] : atual.map(item => (item.id === registro.id ? registro : item))))}
      onSaveMany={itens => setRegistros(atual => {
        const trocados = new Map(itens.filter(item => !item.novo).map(item => [item.registro.id, item.registro]));
        return [...itens.filter(item => item.novo).map(item => item.registro), ...atual.map(item => trocados.get(item.id) ?? item)];
      })}
      onDeleteMany={ids => setRegistros(atual => atual.filter(item => !ids.includes(item.id)))}
      podeRemover
      onRemoverEquipamentos={itens => {
        const ids = new Set(itens.map(item => item.equipamentoId));
        setEquipamentos(atual => atual.map(item => (ids.has(item.id) ? { ...item, status: 'Desmobilizado' } : item)));
        const registroIds = new Set(itens.map(item => item.registroId).filter(Boolean));
        setRegistros(atual => atual.filter(item => !registroIds.has(item.id)));
      }}
      onNavigate={noop}
      dia={dia}
      onAbrirSituacao={onAbrirSituacao}
    />
  );
}
const blockRegistryDeletion = new URLSearchParams(location.search).get('blockedRegistry') === '1';
// O menu real de produção mostra só os módulos principais (SIDEBAR_NAVIGATION_GROUPS
// filtrado por papel), não os 35 itens de NAVIGATION_GROUPS: usar a lista completa aqui
// fazia o preview do menu parecer bem maior do que ele é de verdade.
const previewGroups = SIDEBAR_NAVIGATION_GROUPS
  .map(g => ({ label: g.label, items: g.items.filter(item => (PRIMARY_MODULE_IDS as readonly string[]).includes(item.id)) }))
  .filter(g => g.items.length > 0);
const previewNotifications = [
  { id: '1', type: 'success' as const, title: 'Sincronizacao concluida', message: 'Dados do periodo enviados para a nuvem.', timestamp: '08:12', read: false, source: 'Supabase Cloud' as const },
  { id: '2', type: 'warning' as const, title: 'Estoque baixo', message: 'Produto de lubrificacao abaixo do minimo.', timestamp: '07:40', read: true, source: 'Sistema Local' as const },
];

// Cadastros com estado de verdade: excluir tira da lista e põe na Lixeira,
// restaurar devolve. Com ?blockedRegistry=1 todo cadastro aparece como usado
// em lançamentos, para conferir a janela que trava a exclusão; com
// ?emUso=alguns só um em cada três fica travado, para conferir o lote misto.
const algunsEmUso = new URLSearchParams(location.search).get('emUso') === 'alguns';
// Com ?vazio=1 abre sem nenhuma estaca, para conferir o primeiro uso.
function EstacasPreview() {
  const [controle, setControle] = React.useState(() => (new URLSearchParams(window.location.search).get('vazio') ? { lotes: [], cravacoes: [] } : fx.controleEstacas));
  return <EstacasTab controle={controle} obras={fx.obras} onChange={setControle} responsavel="Deivid" />;
}

function CadastrosPreview({ pedidoNovoColaborador = 0 }: { pedidoNovoColaborador?: number } = {}) {
  const [listas, setListas] = React.useState<Record<string, Array<{ id: string } & Record<string, unknown>>>>(() => ({
    empresas: [...fx.empresas],
    funcionarios: [...fx.funcionarios, ...fx.efetivoPresenca],
    equipamentos: [...fx.equipamentos],
    obras: [...fx.obras],
    comboios: [...fx.comboios],
    combustiveis: [...fx.combustiveis],
    lubrificantes: [...fx.lubrificantes],
    etapas: [...fx.etapasRamos],
    frentesServico: [
      { id: 'FRE-1', nome: 'Aterro Ramo 900', ramoLocal: 'Ramo 900', servico: 'Aterro compactado', responsavel: 'Encarregado Paulo', situacao: 'Em execução', ativo: true, criadoEm: '', atualizadoEm: '' },
      { id: 'FRE-2', nome: 'Corte Ramo 1400', ramoLocal: 'Ramo 1400', servico: 'Escavação e carga', situacao: 'Paralisada', ativo: true, criadoEm: '', atualizadoEm: '' },
    ],
    servicosObra: [
      { id: 'SER-1', codigo: '3.1', descricao: 'Aterro compactado', unidade: 'm³', quantidadePrevista: 48000, situacao: 'Ativo', ativo: true, criadoEm: '', atualizadoEm: '' },
      { id: 'SER-2', codigo: '2.4', descricao: 'Escavação e carga', unidade: 'm³', quantidadePrevista: 62500, situacao: 'Ativo', ativo: true, criadoEm: '', atualizadoEm: '' },
    ],
    canteiros: [
      { id: 'CAN-1', nome: 'Fábrica' },
      { id: 'CAN-2', nome: 'Pátio Aracaré' },
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
      ehAdmin
      pedidoNovoColaborador={pedidoNovoColaborador}
      gruposEquipe={[fx.grupo]}
      onSaveGrupoEquipe={noop}
      empresas={listas.empresas as never}
      obras={listas.obras as never}
      equipamentos={listas.equipamentos as never}
      funcionarios={listas.funcionarios as never}
      comboios={listas.comboios as never}
      combustiveis={listas.combustiveis as never}
      lubrificantes={listas.lubrificantes as never}
      canteiros={listas.canteiros as never}
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
      onSaveCanteiro={salvar('canteiros')}
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
      proximoSabado="2026-09-05"
      onSaveSaturdayScale={async () => ({ success: true, message: 'Escala salva.' })}
    />
  );
}

// Molde da TelaCheia com 18 subtelas agrupadas (Materiais, Estacas e
// Cadastros na fase 2): prova que as abas cabem a 1366 px sem rolagem lateral
// e que a área de dados ocupa o resto da tela e rola por dentro.
const SUBTELAS_MOLDE: ReadonlyArray<ItemDasAbas> = [
  { id: 'lancar', rotulo: 'Lançar' },
  { grupo: 'painel', rotulo: 'Painel', abas: [{ id: 'resumo', rotulo: 'Visão geral' }, { id: 'graficos', rotulo: 'Gráficos' }, { id: 'relatorios', rotulo: 'Relatórios' }] },
  { grupo: 'obra', rotulo: 'Na obra', abas: [{ id: 'previsto', rotulo: 'Previsto do mês' }, { id: 'utilizacao', rotulo: 'Uso por ramo' }, { id: 'apontadores', rotulo: 'Apontadores', contador: 3, contadorRotulo: 'envios novos' }, { id: 'botafora', rotulo: 'Bota-fora' }, { id: 'viagens', rotulo: 'Viagens da jazida' }] },
  { grupo: 'controle', rotulo: 'Controle', abas: [{ id: 'estoque', rotulo: 'Estoque' }, { id: 'movimentos', rotulo: 'Movimentos' }, { id: 'recebimentos', rotulo: 'Recebimentos' }, { id: 'transferencias', rotulo: 'Transferências' }] },
  { grupo: 'cadastrar', rotulo: 'Cadastrar', abas: [{ id: 'cadastro', rotulo: 'Materiais' }, { id: 'locais', rotulo: 'Ramos e locais' }, { id: 'fornecedores', rotulo: 'Fornecedores' }, { id: 'importacoes', rotulo: 'Importar planilha' }, { id: 'lixeira', rotulo: 'Lixeira' }] },
];

function MoldePreview() {
  const [aba, setAba] = React.useState(new URLSearchParams(location.search).get('aba') || 'apontadores');
  const linhas = Array.from({ length: 60 }, (_, indice) => indice + 1);
  return (
    <TelaCheia id="molde-tab" rotulo="Molde" idAbaAtiva={idDaAba('molde', aba)} idDados="molde-dados" chaveRolagem={aba}
      cabecalho={<PageHeader eyebrow="Suprimentos" title="Materiais"
        abas={<AbasDaTela id="molde" rotulo="Subtelas de materiais" abas={SUBTELAS_MOLDE} ativa={aba} onTrocar={setAba} idPainel="molde-dados" testId="molde-aba" />}
        actions={<button type="button" className="inline-flex min-h-10 items-center rounded-xl bg-[#176b4d] px-4 text-sm font-bold text-white">Novo lançamento</button>} />}
      faixa={<div className="rounded-2xl border border-slate-200 bg-white p-2"><input type="search" aria-label="Buscar" placeholder="Buscar material, ramo ou nota" className="w-full rounded-xl border border-slate-200 px-3" /></div>}
      rodape={<p className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600">60 linhas · Total 1.234 t</p>}>
      <div className="h-full min-h-0 overflow-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Linhas de exemplo</caption>
          <thead className="sticky top-0 bg-white"><tr><th className="px-3 py-2">Linha</th><th className="px-3 py-2">Material</th><th className="px-3 py-2 text-right">Quantidade</th></tr></thead>
          <tbody>{linhas.map(linha => <tr key={linha} className="border-t border-slate-100"><td className="px-3 py-2">{linha}</td><td className="px-3 py-2">Material de exemplo {linha}</td><td className="px-3 py-2 text-right tabular-nums">{(linha * 12.5).toLocaleString('pt-BR')} t</td></tr>)}</tbody>
        </table>
      </div>
    </TelaCheia>
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
      abastecimentos={fx.abastecimentos.map(item => ({ ...item, data: hoje }))}
      controlesFrota={[...fx.controlesEquipamentos.map(item => ({ ...item, data: hoje })), { ...fx.controlesEquipamentos[0], id: 'sem-motivo', prefixo: 'RE-03', status: 'Aguardando motorista' as const, motivoManutencao: undefined, observacao: '', data: hoje }]}
      equipamentos={fx.equipamentos}
      onIrPara={() => undefined}
    />
  );
}

// Mais de cinco equipes, para o preview mostrar o "Mostrar mais equipes" do painel.
// fx.grupo já está em equipesPresenca (g-1); repetir dava chave React duplicada.
const equipesPainel = [...fx.equipesPresenca,
  ...['Terraplenagem Norte', 'Drenagem', 'Pavimentação', 'Topografia', 'Obras de arte'].map((nome, i) => ({
    ...fx.grupo, id: `painel-extra-${i}`, nome: `Equipe ${nome}`, frenteServico: `Ramo ${(i + 3) * 100}`, token: `painel-extra-${i}`,
  }))];

// Correções já feitas, para a subtela Histórico mostrar a tabela no preview.
const historicoPresencasPreview = fx.presencasHistorico.slice(0, 4).map((registro, indice) => ({
  id: `hist-${indice}`,
  presencaId: registro.id,
  grupoId: registro.grupoId,
  funcionarioId: registro.funcionarioId,
  data: registro.data,
  editadoPor: indice % 2 ? 'Deivid Santana' : 'Ana Paula (RH)',
  editadoEm: `${registro.data}T1${indice}:2${indice}:00-03:00`,
  motivo: ['Atestado entregue no escritório', 'Chegou depois do envio', 'Engano no toque', 'Férias aprovadas'][indice],
  valorAnterior: 'Ausente',
  valorNovo: ['Atestado', 'Atraso', 'Presente', 'Férias'][indice],
}));

// Presença do painel com estado, para inativar, desfazer e reativar no preview.
function PresencaAdminViva() {
  const [lista, setLista] = React.useState(() => [...fx.presencasHistorico]);
  const [equipes, setEquipes] = React.useState(() => [...fx.equipesPresenca]);
  const trocar = (ids: string[], ativar: boolean) => setLista(atual => (ativar ? reativar(atual, ids) : inativar(atual, ids, 'Deivid')));
  return (
    <ControlePresencaTab
      empresas={fx.empresas}
      funcionarios={fx.efetivoPresenca}
      obras={fx.obras}
      gruposEquipe={equipes}
      presencasLink={somenteAtivos(lista)}
      presencasInativas={lista.filter(item => item.inativoEm)}
      historicoPresencas={historicoPresencasPreview}
      onSaveGrupoEquipe={noop}
      onDeleteGrupoEquipe={id => setEquipes(atual => atual.filter(item => item.id !== id))}
      onUpdatePresencaLink={noop}
      onLancarPresencaManual={noop}
      onInativarPresencaLink={ids => trocar(ids, false)}
      onReativarPresencaLink={ids => trocar(ids, true)}
    />
  );
}

// Combustível com estado de verdade, para lançar, corrigir e excluir no preview.
function CombustivelVivo() {
  const [lista, setLista] = React.useState(() => [...fx.abastecimentos, ...fx.abastecimentosConsumo] as never[]);
  // Lixeira de mentira: guarda o que saiu para o Desfazer devolver.
  const lixeira = React.useRef(new Map<string, never[]>());
  type Item = { id: string };
  return (
    <LancamentosTab
      empresas={fx.empresas}
      comboios={fx.comboios}
      combustiveis={fx.combustiveis}
      lubrificantes={fx.lubrificantes}
      abastecimentos={lista}
      lubrificacoes={fx.lubrificacoes}
      equipamentos={[...fx.equipamentos, ...fx.equipamentosQuadro]}
      registrosFrota={fx.controlesQuadro}
      usuario="Deivid"
      onOpenControle={noop}
      onSaveAbastecimento={(item, novo) => setLista(atual => (novo ? [...atual, item as never] : atual.map(x => ((x as Item).id === item.id ? item as never : x))))}
      onSaveAbastecimentos={itens => setLista(atual => atual.map(x => (itens.find(item => item.id === (x as Item).id) as never) ?? x))}
      onDeleteAbastecimento={id => setLista(atual => atual.filter(x => (x as Item).id !== id))}
      onDeleteAbastecimentos={ids => {
        const chave = `exc-${Date.now()}`;
        lixeira.current.set(chave, lista.filter(x => ids.includes((x as Item).id)));
        setLista(atual => atual.filter(x => !ids.includes((x as Item).id)));
        return [chave];
      }}
      onRestaurarAbastecimentos={chaves => {
        const devolvidos = chaves.flatMap(chave => lixeira.current.get(chave) ?? ([] as never[]));
        setLista(atual => [...atual, ...devolvidos]);
        return { ok: devolvidos.length > 0, mensagem: devolvidos.length ? '' : 'Nada para devolver.' };
      }}
      onImportAbastecimentos={noopImportAbastecimentos}
      onSaveLubrificacao={noop}
      onDeleteLubrificacao={noop}
    />
  );
}

const screens: Record<string, React.ReactNode> = {
  molde: <MoldePreview />,
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
          currentUser={{ displayName: 'Deivid Santana', email: 'deivid@renea.com.br' } as never}
          isNotificationOpen={false}
          notifications={previewNotifications}
          unreadCount={1}
          isCloudConnected
          lastCloudSync="04/09/2026 21:40"
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
  // Pesquisa aberta como o operador vê: o colaborador aparece, Cadastros não.
  pesquisa: (
    <PesquisaGlobal
      fontes={{ equipamentos: fx.equipamentos, funcionarios: fx.funcionarios, ordensServico: fx.ordensServico }}
      aberto
      onAbertoChange={noop}
      podeAbrir={tab => destinoDaAba(tab, ROLE_ACCESS.operador) !== null}
      onNavigate={noop}
    />
  ),
  cadastros: <CadastrosPreview />,
  'cadastro-novo-colaborador': <CadastrosPreview pedidoNovoColaborador={1} />,
  estacas: <EstacasPreview />,
  frotas: (
    <ControleEquipamentosDiarioTab
      registros={[...fx.controlesEquipamentos, ...fx.controlesQuadro, ...fx.controlesBasculantes]}
      equipamentos={[...fx.equipamentos, ...fx.equipamentosQuadro]}
      empresas={fx.empresas}
      funcionarios={fx.funcionarios}
      gruposEquipe={[fx.grupo]}
      ordensServico={fx.ordensServico}
      registeredBy="Deivid Santana"
      onSave={noop}
      onImport={noop}
      onApplyCadastroSge={noop}
      onDeleteMany={noop}
      onOpenEquipmentRegistration={noop}
      onAddOperationalDrivers={noop}
      canApproveFleet
      abrirNoQuadro={Boolean(buscaDaUrl)}
      quadroBusca={buscaDaUrl}
      quadro={(dia, verSituacao, busca) => <QuadroFrotaPreview dia={dia} onAbrirSituacao={verSituacao} busca={busca} />}
    />
  ),
  combustivel: <CombustivelVivo />,
  // Operador: o App não manda os de excluir, então a tela não mostra Excluir (A7).
  'combustivel-operador': (
    <LancamentosTab
      empresas={fx.empresas}
      comboios={fx.comboios}
      combustiveis={fx.combustiveis}
      lubrificantes={fx.lubrificantes}
      abastecimentos={[...fx.abastecimentos, ...fx.abastecimentosConsumo] as never[]}
      lubrificacoes={fx.lubrificacoes}
      equipamentos={[...fx.equipamentos, ...fx.equipamentosQuadro]}
      registrosFrota={fx.controlesQuadro}
      usuario="José"
      combustivelInicial="historico"
      onOpenControle={noop}
      onSaveAbastecimento={noop}
      onImportAbastecimentos={noopImportAbastecimentos}
      onSaveLubrificacao={noop}
    />
  ),
  'combustivel-consumo': (
    <LancamentosTab
      empresas={fx.empresas}
      comboios={fx.comboios}
      combustiveis={fx.combustiveis}
      lubrificantes={fx.lubrificantes}
      abastecimentos={fx.abastecimentosConsumo}
      lubrificacoes={fx.lubrificacoes}
      equipamentos={fx.equipamentosQuadro}
      registrosFrota={fx.controlesQuadro}
      usuario="Deivid"
      combustivelInicial="historico"
      onOpenControle={noop}
      onSaveAbastecimento={noop}
      onDeleteAbastecimento={noop}
      onDeleteAbastecimentos={() => []}
      onImportAbastecimentos={noopImportAbastecimentos}
      onSaveLubrificacao={noop}
      onDeleteLubrificacao={noop}
    />
  ),
  solicitacoes: <SolicitacoesPreview />,
  'diario-obra': (
    <DiarioObraTab
      diarios={fx.diariosChuva}
      obras={fx.obras}
      gruposEquipe={[fx.grupo]}
      presencasLink={fx.presencasHistorico}
      controlesEquipamentos={fx.controlesEquipamentos}
      apontamentos={[]}
      responsavel="Deivid Santana"
      podeEditar
      onSave={noop}
    />
  ),
  colaboradores: (
    <ColaboradoresTab
      funcionarios={fx.equipeFuncionarios}
      empresas={fx.empresas}
      gruposEquipe={[fx.grupo]}
      presencasLink={fx.presencasHistorico}
      controlesEquipamentos={fx.controlesEquipamentos}
      onNavigate={noop}
      responsavel="Preview"
      onAlterarSituacao={noop}
    />
  ),
  // Efetivo grande para ver a lista em lotes de 50.
  'colaboradores-lote': (
    <ColaboradoresTab
      funcionarios={Array.from({ length: 130 }, (_, indice) => ({
        ...fx.equipeFuncionarios[indice % fx.equipeFuncionarios.length],
        id: `lote-${indice}`,
        nome: `${fx.equipeFuncionarios[indice % fx.equipeFuncionarios.length].nome} ${String(indice + 1).padStart(3, '0')}`,
      }))}
      empresas={fx.empresas}
      gruposEquipe={[fx.grupo]}
      presencasLink={[]}
      controlesEquipamentos={[]}
      onNavigate={noop}
    />
  ),
  manutencao: <ManutencaoPreview />,
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
      presencasLink={fx.registrosEnviados}
      controlesEquipamentos={fx.controlesEquipamentos}
      gruposEquipe={equipesPainel}
      onNavigate={noop}
    />
  ),
  'presenca-admin': <PresencaAdminViva />,
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
  login: (
    <LoginScreen
      username="" password="" showPassword={false} isAuthenticating={false} loginError="" loginNotice=""
      onUsernameChange={noop} onPasswordChange={noop} onTogglePasswordVisibility={noop} onSubmit={event => event.preventDefault()} onPasswordRecovery={noop}
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

// Mesma guarda global de movimento reduzido do app (src/main.tsx).
instalarGuardaDeMovimento();

const key = new URLSearchParams(location.search).get('screen') || 'usuarios';
// Com ?shell=1 a tela abre dentro do menu lateral e da barra do topo, com as
// mesmas medidas do App.tsx, para conferir a página inteira em cada largura.
const comShell = new URLSearchParams(location.search).get('shell') === '1';
const ABA_DO_PREVIEW: Record<string, string> = {
  painel: 'dashboard', combustivel: 'lancamentos', 'combustivel-operador': 'lancamentos', 'combustivel-consumo': 'lancamentos',
  frotas: 'controle-equipamentos', 'presenca-admin': 'presenca', 'colaboradores-lote': 'colaboradores',
};
const abaAtiva = ABA_DO_PREVIEW[key] || key;
const previewQueryClient = new QueryClient();

// Os links públicos rodam fora do ERP (PublicLinksApp), sem o
// #main-tab-viewport e os estilos de formulário dele. A pesquisa também fica
// fora dele no App.
// O link de presença também: no app ele tem a página só para ele, com uma
// <main> só (auditoria de 21/10/2026, M2).
const isPublicScreen = ['login', 'pesquisa', 'presenca', 'presenca-fluxo', 'presenca-enviada'].includes(key);

createRoot(document.getElementById('app-root')!).render(
  <QueryClientProvider client={previewQueryClient}>
    {isPublicScreen ? (screens[key] ?? null) : comShell ? (
      <div className="erp-shell">
        <PularParaConteudo />
        <DesktopSidebar activeTab={abaAtiva} groups={previewGroups} onNavigate={noop} />
        <main className="erp-workspace" id="main-workspace">
          <DesktopTopBar
            activeTab={abaAtiva}
            currentUser={{ displayName: 'Deivid Santana', email: 'deivid@renea.com.br' } as never}
            isNotificationOpen={false}
            notifications={previewNotifications}
            unreadCount={1}
            isCloudConnected
            lastCloudSync="04/09/2026 21:40"
            onNavigate={noop}
            onToggleNotifications={noop}
            onCloseNotifications={noop}
            onMarkAllNotificationsAsRead={noop}
            onClearNotifications={noop}
            onMarkNotificationAsRead={noop}
            onLogout={noop}
          />
          <div id="main-tab-viewport" tabIndex={-1} className="flex-1 overflow-x-clip w-full max-w-none p-[var(--renea-respiro)]">
            <RouteMotion>{screens[key] ?? <p>Tela desconhecida: {key}</p>}</RouteMotion>
          </div>
        </main>
      </div>
    ) : <div
      id="main-tab-viewport"
      /* Sem a casca, a tela roda dentro do padding responsivo. Com um
         `padding: 28` fixo o preview inventava estouro e escondia o recuo
         real das telas — a verificação de largura não valia nada. */
      className="mx-auto w-full max-w-[1440px] p-3.5 sm:p-4 md:p-7 2xl:p-10"
      style={{ background: '#fff', minHeight: '100vh' }}
    >
      {screens[key] ?? <p>Tela desconhecida: {key}</p>}
    </div>}
  </QueryClientProvider>,
);
