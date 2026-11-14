import { useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { CalendarDays, ClipboardList, Download, FileSpreadsheet, FileText, GanttChartSquare, List, MessageCircle, Plus, Search, X } from 'lucide-react';
import type { PlanejamentoItem, RegistroProducao, ServicoObra } from '../types';
import { PageHeader } from '../shared/ui/PageHeader';
import { TelaCheia } from '../shared/ui/TelaCheia';
import { AbasDaTela, idDaAba } from '../shared/ui/AbasDaTela';
import { TabelaPadrao, type ColunaTabela } from '../shared/ui/TabelaPadrao';
import { Modal } from '../shared/ui/Modal';
import { Campo } from '../shared/ui/Lancamento';
import { BOTAO_PERIGO_LEVE, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO } from './cadastros/estilos';
import { formatarData } from '../utils/formato';
import {
  SITUACOES,
  avancoGeral,
  diaLocal,
  inicioDaSemana,
  producaoDaAtividade,
  resumirAtividade,
  textoDoDia,
  type ResumoAtividade,
  type SituacaoAtividade,
} from '../utils/programacao';
import { AtividadeForm } from './programacao/AtividadeForm';
import { CartoesDoDia } from './programacao/CartoesDoDia';
import { QuadroProgramacao } from './programacao/QuadroProgramacao';
import { BarraAvanco, COR_SITUACAO, SeloSituacao, diaMes, numeroObra } from './programacao/visual';

interface Props {
  planejamento: PlanejamentoItem[];
  producao: RegistroProducao[];
  servicos: ServicoObra[];
  responsavel: string;
  podeEditar: boolean;
  onSavePlanejamento: (item: PlanejamentoItem, isNew: boolean) => void;
  onSaveProducao: (item: RegistroProducao, isNew: boolean) => void;
}

type Aba = 'hoje' | 'quadro' | 'lista' | 'producao';
const DIAS_NO_QUADRO = 14;
const ordenarTexto = (lista: Iterable<string>) => [...new Set(lista)].filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
const abaInicial = (): Aba => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'hoje' : 'quadro');

export default function ProgramacaoTab({ planejamento, producao, servicos, responsavel, podeEditar, onSavePlanejamento, onSaveProducao }: Props) {
  const escopo = useRef<HTMLElement>(null);
  const hoje = diaLocal();
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [busca, setBusca] = useState('');
  const [frente, setFrente] = useState('');
  const [encarregado, setEncarregado] = useState('');
  const [situacao, setSituacao] = useState<SituacaoAtividade | ''>('');
  const [dia, setDia] = useState(hoje);
  const [inicioQuadro, setInicioQuadro] = useState(() => inicioDaSemana(hoje));
  const [aberta, setAberta] = useState<{ id: string | null } | null>(null);
  const [lancamentoAberto, setLancamentoAberto] = useState<RegistroProducao | null>(null);
  const [aviso, setAviso] = useState('');
  const [menuExportar, setMenuExportar] = useState(false);
  const [exportando, setExportando] = useState(false);

  useGSAP(() => {
    if (!escopo.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(escopo.current.querySelectorAll('[data-linha-lista]'), { opacity: 0, y: 10 }, {
      opacity: 1, y: 0, duration: 0.35, stagger: 0.03, ease: 'power3.out', clearProps: 'transform,opacity',
    });
  }, { scope: escopo, dependencies: [aba, dia] });

  const resumos = useMemo(
    () => planejamento.map(item => resumirAtividade(item, producao, hoje)),
    [planejamento, producao, hoje],
  );

  const frentes = useMemo(() => ordenarTexto(planejamento.map(item => item.frente || '')), [planejamento]);
  const encarregados = useMemo(() => ordenarTexto(planejamento.map(item => item.responsavel || item.equipeNome || '')), [planejamento]);

  // Frente, encarregado e busca valem para todas as subtelas; a situação, para as atividades.
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  const casaBusca = (texto: string) => !termo || texto.toLocaleLowerCase('pt-BR').includes(termo);
  const semSituacao = resumos.filter(({ item }) =>
    (!frente || item.frente === frente)
    && (!encarregado || (item.responsavel || item.equipeNome) === encarregado)
    && casaBusca(`${item.servicoDescricao} ${item.frente || ''} ${item.responsavel || ''} ${item.equipamentos || ''} ${item.estacaInicial || ''}`));
  const contagem = SITUACOES.map(opcao => ({ ...opcao, total: semSituacao.filter(resumo => resumo.situacao === opcao.id).length }));
  const filtrados = semSituacao
    .filter(resumo => (situacao ? resumo.situacao === situacao : resumo.situacao !== 'cancelada'))
    .sort((a, b) => (a.item.frente || '').localeCompare(b.item.frente || '', 'pt-BR', { numeric: true }) || a.item.dataInicio.localeCompare(b.item.dataInicio));
  const avanco = avancoGeral(semSituacao);

  const idsFiltrados = new Set(semSituacao.map(resumo => resumo.item.id));
  const producaoFiltrada = producao.filter(registro => registro.ativo !== false
    && (!frente || registro.frente === frente)
    && (!encarregado || !registro.planejamentoId || idsFiltrados.has(registro.planejamentoId))
    && casaBusca(`${registro.servicoDescricao} ${registro.frente || ''} ${registro.responsavel} ${registro.observacao || ''}`));

  const filtrosAtivos = [
    frente && `Frente: ${frente}`,
    encarregado && `Encarregado: ${encarregado}`,
    situacao && `Situação: ${SITUACOES.find(opcao => opcao.id === situacao)?.rotulo}`,
    termo && `Busca: ${busca.trim()}`,
  ].filter(Boolean) as string[];

  const limpar = () => { setBusca(''); setFrente(''); setEncarregado(''); setSituacao(''); };
  const mostrarAviso = (texto: string) => { setAviso(texto); window.setTimeout(() => setAviso(atual => (atual === texto ? '' : atual)), 5000); };

  const resumoAberto = aberta?.id ? resumos.find(resumo => resumo.item.id === aberta.id) ?? null : null;

  const lancar = (item: PlanejamentoItem, quantidade: number, data: string, observacao = '') => {
    const agora = new Date().toISOString();
    onSaveProducao({
      id: `producao-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      data,
      servicoId: item.servicoId,
      servicoDescricao: item.servicoDescricao,
      unidade: item.unidade,
      quantidade,
      planejamentoId: item.id,
      frente: item.frente,
      equipeNome: item.responsavel || item.equipeNome,
      responsavel,
      observacao: observacao || undefined,
      ativo: true,
      criadoEm: agora,
      atualizadoEm: agora,
    }, true);
    mostrarAviso(`Lançado ${numeroObra(quantidade)} ${item.unidade} em ${item.frente || ''} · ${item.servicoDescricao}. Salvo na nuvem.`);
  };

  const salvarAtividade = (item: PlanejamentoItem, nova: boolean) => {
    onSavePlanejamento(item, nova);
    setAberta(null);
    const acao = item.situacao === 'Cancelado' ? 'cancelada' : item.situacao === 'Concluído' ? 'concluída' : nova ? 'criada' : 'salva';
    mostrarAviso(`Atividade ${item.frente} · ${item.servicoDescricao} ${acao}.`);
  };

  const copiarDia = async () => {
    const texto = textoDoDia(filtrados, dia);
    try {
      if (typeof navigator.share === 'function' && window.innerWidth < 768) {
        await navigator.share({ text: texto });
        return;
      }
      await navigator.clipboard.writeText(texto);
      mostrarAviso(`Programação de ${diaMes(dia)} copiada. Agora é só colar no WhatsApp.`);
    } catch {
      mostrarAviso('Não deu para copiar neste aparelho. Tente pelo computador.');
    }
  };

  const exportar = async (tipo: 'excel' | 'pdf') => {
    setMenuExportar(false);
    setExportando(true);
    try {
      const modulo = await import('./programacao/exportarProgramacao');
      if (tipo === 'excel') await modulo.baixarExcelProgramacao(filtrados, producaoFiltrada, filtrosAtivos, hoje);
      else {
        await modulo.baixarPdfProgramacao(filtrados, filtrosAtivos, [
          { label: 'Atividades', value: filtrados.length },
          { label: 'Atrasadas', value: filtrados.filter(resumo => resumo.situacao === 'atrasada').length },
          { label: 'Em dia', value: filtrados.filter(resumo => resumo.situacao === 'em-dia').length },
          { label: 'Avanço geral', value: `${Math.round(avanco)}%` },
        ], responsavel, hoje);
      }
      mostrarAviso(tipo === 'excel' ? 'Planilha baixada.' : 'PDF baixado.');
    } catch {
      mostrarAviso('Não foi possível gerar o arquivo. Tente de novo.');
    } finally {
      setExportando(false);
    }
  };

  const colunasLista: ColunaTabela<ResumoAtividade>[] = [
    { chave: 'frente', titulo: 'Frente', render: r => <span className="font-bold">{r.item.frente || '—'}</span>, valorOrdenacao: r => r.item.frente || '', larguraMinima: 110 },
    { chave: 'servico', titulo: 'Serviço', render: r => <span className="font-bold text-slate-900">{r.item.servicoDescricao}</span>, valorOrdenacao: r => r.item.servicoDescricao, larguraMinima: 140 },
    { chave: 'responsavel', titulo: 'Encarregado', render: r => r.item.responsavel || r.item.equipeNome || '—', valorOrdenacao: r => r.item.responsavel || '' },
    { chave: 'periodo', titulo: 'Período', render: r => <span className="whitespace-nowrap tabular-nums">{diaMes(r.item.dataInicio)} a {diaMes(r.item.dataFim)}</span>, valorOrdenacao: r => r.item.dataInicio, valorExportacao: r => `${formatarData(r.item.dataInicio)} a ${formatarData(r.item.dataFim)}` },
    { chave: 'quantidade', titulo: 'Total', alinhamento: 'direita', render: r => `${numeroObra(r.item.quantidadePlanejada)} ${r.item.unidade}`, valorOrdenacao: r => r.item.quantidadePlanejada },
    { chave: 'meta', titulo: 'Meta/dia', alinhamento: 'direita', render: r => <span className="font-bold text-[#176b4d]">{numeroObra(r.meta)} {r.item.unidade}</span>, valorOrdenacao: r => r.meta },
    { chave: 'realizado', titulo: 'Feito', alinhamento: 'direita', render: r => `${numeroObra(r.realizado)} ${r.item.unidade}`, valorOrdenacao: r => r.realizado },
    { chave: 'avanco', titulo: 'Avanço', render: r => <BarraAvanco percentual={r.percentual} situacao={r.situacao} />, valorOrdenacao: r => r.percentual, valorExportacao: r => `${Math.round(r.percentual)}%`, larguraMinima: 140 },
    { chave: 'situacao', titulo: 'Situação', render: r => <SeloSituacao situacao={r.situacao} />, valorOrdenacao: r => SITUACOES.findIndex(opcao => opcao.id === r.situacao), valorExportacao: r => SITUACOES.find(opcao => opcao.id === r.situacao)?.rotulo },
  ];

  const colunasProducao: ColunaTabela<RegistroProducao>[] = [
    { chave: 'data', titulo: 'Dia', render: r => <span className="tabular-nums">{formatarData(r.data)}</span>, valorOrdenacao: r => r.data },
    { chave: 'frente', titulo: 'Frente', render: r => r.frente || '—', valorOrdenacao: r => r.frente || '' },
    { chave: 'servico', titulo: 'Serviço', render: r => <span className="font-bold text-slate-900">{r.servicoDescricao}</span>, valorOrdenacao: r => r.servicoDescricao },
    { chave: 'quantidade', titulo: 'Quantidade', alinhamento: 'direita', render: r => <span className="font-bold">{numeroObra(r.quantidade)} {r.unidade}</span>, valorOrdenacao: r => r.quantidade },
    { chave: 'responsavel', titulo: 'Lançado por', render: r => r.responsavel, valorOrdenacao: r => r.responsavel },
    { chave: 'obs', titulo: 'Observação', render: r => r.observacao || '—', dica: r => r.observacao, noCartao: false },
  ];

  const faixa = (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2" data-testid="programacao-filtros">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 basis-full sm:min-w-48 sm:flex-1 sm:basis-auto">
          <span className="sr-only">Buscar na programação</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5b6870]" aria-hidden="true" />
          <input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar serviço, frente, encarregado ou equipamento" className={`${CAMPO} pl-9`} />
        </label>
        <label className="min-w-0 flex-1 sm:flex-none">
          <span className="sr-only">Frente</span>
          <select value={frente} onChange={event => setFrente(event.target.value)} className={`${CAMPO} sm:w-44`}>
            <option value="">Todas as frentes</option>
            {frentes.map(valor => <option key={valor}>{valor}</option>)}
          </select>
        </label>
        <label className="min-w-0 flex-1 sm:flex-none">
          <span className="sr-only">Encarregado</span>
          <select value={encarregado} onChange={event => setEncarregado(event.target.value)} className={`${CAMPO} sm:w-48`}>
            <option value="">Todos os encarregados</option>
            {encarregados.map(valor => <option key={valor}>{valor}</option>)}
          </select>
        </label>
        {filtrosAtivos.length > 0 && (
          <button type="button" onClick={limpar} className={BOTAO_SECUNDARIO}>
            <X className="size-4" aria-hidden="true" />
            Limpar
          </button>
        )}
      </div>
      {aba !== 'producao' && (
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label="Filtrar pela situação">
            <button type="button" aria-pressed={situacao === ''} onClick={() => setSituacao('')} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-bold ${situacao === '' ? 'border-[#176b4d] bg-[#176b4d] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-400'}`}>
              Todas <span className="tabular-nums opacity-80">{semSituacao.length - (contagem.find(opcao => opcao.id === 'cancelada')?.total ?? 0)}</span>
            </button>
            {contagem.filter(opcao => opcao.total > 0 || opcao.id !== 'cancelada').map(opcao => (
              <button
                key={opcao.id}
                type="button"
                aria-pressed={situacao === opcao.id}
                onClick={() => setSituacao(atual => (atual === opcao.id ? '' : opcao.id))}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold ${situacao === opcao.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}
              >
                <span className={`size-2.5 rounded-full ${COR_SITUACAO[opcao.id].ponto}`} aria-hidden="true" />
                {opcao.rotulo} <span className="tabular-nums opacity-80">{opcao.total}</span>
              </button>
            ))}
          </div>
          <p className="hidden shrink-0 text-sm font-semibold text-[#5b6870] md:block">
            Avanço geral <strong className="text-base font-black tabular-nums text-slate-900">{Math.round(avanco)}%</strong>
          </p>
        </div>
      )}
      <p role="status" aria-live="polite" className={aviso ? 'rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-[#176b4d] ring-1 ring-inset ring-emerald-200' : 'sr-only'}>{aviso}</p>
    </div>
  );

  const atrasadas = contagem.find(opcao => opcao.id === 'atrasada')?.total ?? 0;

  return (
    <TelaCheia
      ref={escopo}
      id="programacao-tab"
      rotulo="Programação"
      longa={aba === 'hoje' && !aberta}
      idAbaAtiva={idDaAba('programacao', aba)}
      idDados="programacao-dados"
      chaveRolagem={aba}
      cabecalho={(
        <PageHeader
          eyebrow="Operação"
          title="Programação"
          abas={(
            <AbasDaTela
              id="programacao"
              rotulo="Subtelas da programação"
              ativa={aba}
              onTrocar={id => setAba(id as Aba)}
              idPainel="programacao-dados"
              testId="programacao-aba"
              abas={[
                { id: 'hoje', rotulo: 'Dia a dia', curto: 'Dia', icone: CalendarDays },
                { id: 'quadro', rotulo: 'Quadro', icone: GanttChartSquare, contador: atrasadas, contadorRotulo: 'atrasadas' },
                { id: 'lista', rotulo: 'Lista', icone: List },
                { id: 'producao', rotulo: 'Produção', icone: ClipboardList },
              ]}
            />
          )}
          actions={aberta ? undefined : (
            <>
              <div className="relative">
                <button type="button" onClick={() => setMenuExportar(atual => !atual)} aria-expanded={menuExportar} aria-haspopup="menu" disabled={exportando} className={BOTAO_SECUNDARIO} data-testid="programacao-exportar">
                  <Download className="size-4" aria-hidden="true" />
                  {exportando ? 'Gerando…' : 'Exportar'}
                </button>
                {menuExportar && (
                  <div role="menu" className="absolute right-0 top-12 z-30 grid min-w-56 gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                    <button type="button" role="menuitem" onClick={() => void exportar('excel')} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50">
                      <FileSpreadsheet className="size-4 text-[#176b4d]" aria-hidden="true" /> Planilha Excel
                    </button>
                    <button type="button" role="menuitem" onClick={() => void exportar('pdf')} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50">
                      <FileText className="size-4 text-rose-700" aria-hidden="true" /> PDF para imprimir
                    </button>
                    <button type="button" role="menuitem" onClick={() => { setMenuExportar(false); void copiarDia(); }} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50">
                      <MessageCircle className="size-4 text-[#176b4d]" aria-hidden="true" /> Texto do dia para WhatsApp
                    </button>
                  </div>
                )}
              </div>
              {podeEditar && (
                <button type="button" onClick={() => setAberta({ id: null })} className={`${BOTAO_PRIMARIO} max-sm:order-first px-5`} data-testid="programacao-nova">
                  <Plus className="size-5" aria-hidden="true" />
                  Nova atividade
                </button>
              )}
            </>
          )}
        />
      )}
      faixa={aberta ? undefined : faixa}
    >
      {!aberta && aba === 'hoje' && (
        <CartoesDoDia
          resumos={filtrados}
          dia={dia}
          hoje={hoje}
          podeEditar={podeEditar}
          onTrocarDia={setDia}
          onAbrir={resumo => setAberta({ id: resumo.item.id })}
          onLancar={(resumo, quantidade) => lancar(resumo.item, quantidade, dia)}
          onCopiarDia={() => void copiarDia()}
        />
      )}

      {!aberta && aba === 'quadro' && (
        <QuadroProgramacao
          resumos={filtrados}
          inicio={inicioQuadro}
          dias={DIAS_NO_QUADRO}
          hoje={hoje}
          onTrocarInicio={valor => setInicioQuadro(valor || inicioDaSemana(hoje))}
          onAbrir={resumo => setAberta({ id: resumo.item.id })}
        />
      )}

      {!aberta && aba === 'lista' && (
        <TabelaPadrao
          titulo="Atividades programadas"
          linhas={filtrados}
          colunas={colunasLista}
          idDaLinha={r => r.item.id}
          nomeDoItem={{ um: 'atividade', varios: 'atividades' }}
          onAbrirLinha={r => setAberta({ id: r.item.id })}
          exportar={false}
          testIdLinha="programacao-linha"
          vazio={planejamento.length ? 'Nenhuma atividade com esses filtros.' : 'Nenhuma atividade programada ainda. Toque em "Nova atividade".'}
          resumo={` · avanço geral ${Math.round(avanco)}%`}
        />
      )}

      {!aberta && aba === 'producao' && (
        <TabelaPadrao
          titulo="Produção lançada"
          linhas={producaoFiltrada}
          colunas={colunasProducao}
          idDaLinha={r => r.id}
          nomeDoItem={{ um: 'lançamento', varios: 'lançamentos' }}
          ordenacaoInicial={{ chave: 'data', direcao: 'desc' }}
          onAbrirLinha={podeEditar ? registro => setLancamentoAberto(registro) : undefined}
          exportar={false}
          vazio="Nenhuma produção lançada com esses filtros. Lance pelo Dia a dia ou abrindo a atividade."
        />
      )}

      <AtividadeForm
        aberto={Boolean(aberta)}
        resumo={resumoAberto}
        producao={resumoAberto ? producaoDaAtividade(resumoAberto.item, producao) : []}
        hoje={hoje}
        podeEditar={podeEditar}
        sugestoes={{ frentes, servicos: ordenarTexto([...servicos.map(item => item.descricao), ...planejamento.map(item => item.servicoDescricao)]), responsaveis: encarregados }}
        onFechar={() => setAberta(null)}
        onSalvar={salvarAtividade}
        onLancar={lancar}
      />

      <EditarLancamento
        registro={lancamentoAberto}
        hoje={hoje}
        onFechar={() => setLancamentoAberto(null)}
        onSalvar={(registro, texto) => { onSaveProducao(registro, false); setLancamentoAberto(null); mostrarAviso(texto); }}
      />
    </TelaCheia>
  );
}

/** Corrigir ou tirar um lançamento de produção (sai da conta, mas fica no histórico). */
function EditarLancamento({ registro, hoje, onFechar, onSalvar }: {
  registro: RegistroProducao | null;
  hoje: string;
  onFechar: () => void;
  onSalvar: (registro: RegistroProducao, aviso: string) => void;
}) {
  const [quantidade, setQuantidade] = useState('');
  const [data, setData] = useState('');
  const [observacao, setObservacao] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  if (registro && aberto !== registro.id) {
    setAberto(registro.id);
    setQuantidade(String(registro.quantidade).replace('.', ','));
    setData(registro.data);
    setObservacao(registro.observacao || '');
  }
  const valor = Number(quantidade.includes(',') ? quantidade.replace(/\./g, '').replace(',', '.') : quantidade);
  const salvar = () => {
    if (!registro || !(valor > 0) || !data) return;
    onSalvar({ ...registro, quantidade: valor, data, observacao: observacao.trim() || undefined, atualizadoEm: new Date().toISOString() }, 'Lançamento corrigido.');
  };
  return (
    <Modal
      open={Boolean(registro)}
      title={registro ? `${registro.frente || ''} · ${registro.servicoDescricao}` : ''}
      description="Corrija a quantidade, o dia ou a observação."
      size="sm"
      onClose={() => { setAberto(null); onFechar(); }}
      onSubmit={salvar}
      footer={(
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className={`${BOTAO_PERIGO_LEVE} sm:mr-auto`}
            onClick={() => registro && onSalvar({ ...registro, ativo: false, atualizadoEm: new Date().toISOString() }, 'Lançamento retirado da conta.')}
          >
            Retirar lançamento
          </button>
          <button type="button" onClick={() => { setAberto(null); onFechar(); }} className={BOTAO_SECUNDARIO}>Fechar</button>
          <button type="button" onClick={salvar} disabled={!(valor > 0) || !data} className={BOTAO_PRIMARIO}>Salvar</button>
        </div>
      )}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo={`Quantidade (${registro?.unidade || ''})`} para="prod-editar-qtd" erro={quantidade && !(valor > 0) ? 'Informe um número maior que zero.' : null}>
          <input id="prod-editar-qtd" inputMode="decimal" value={quantidade} onChange={event => setQuantidade(event.target.value)} className={`${CAMPO} font-bold tabular-nums`} />
        </Campo>
        <Campo rotulo="Dia" para="prod-editar-dia">
          <input id="prod-editar-dia" type="date" max={hoje} value={data} onChange={event => setData(event.target.value)} className={CAMPO} />
        </Campo>
        <Campo rotulo="Observação" para="prod-editar-obs" className="sm:col-span-2">
          <input id="prod-editar-obs" value={observacao} onChange={event => setObservacao(event.target.value)} className={CAMPO} />
        </Campo>
      </div>
    </Modal>
  );
}
