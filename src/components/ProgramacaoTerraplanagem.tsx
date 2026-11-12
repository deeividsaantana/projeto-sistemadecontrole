import { useMemo, useState } from 'react';
import { BarChart3, CalendarDays, Check, ClipboardList, Filter, Layers, LayoutDashboard, Plus, Save } from 'lucide-react';
import type { PlanejamentoItem, RegistroProducao, ServicoObra } from '../types';
import { CAMPO, CARTAO, BOTAO_PRIMARIO, BOTAO_SECUNDARIO } from './cadastros/estilos';
import { TabelaPadrao, type ColunaTabela } from '../shared/ui/TabelaPadrao';
import { PageHeader } from '../shared/ui/PageHeader';
import { TelaCheia } from '../shared/ui/TelaCheia';
import { AbasDaTela } from '../shared/ui/AbasDaTela';

interface Props {
  planejamento: PlanejamentoItem[];
  producao: RegistroProducao[];
  servicos: ServicoObra[];
  responsavel: string;
  podeEditar: boolean;
  onSavePlanejamento: (item: PlanejamentoItem, isNew: boolean) => void;
  onSaveProducao: (item: RegistroProducao, isNew: boolean) => void;
}

const hoje = () => new Date().toISOString().slice(0, 10);

export default function ProgramacaoTerraplanagemTab({ planejamento, producao, servicos, responsavel, podeEditar, onSavePlanejamento, onSaveProducao }: Props) {
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('todos');
  const [visao, setVisao] = useState<'painel' | 'programacao' | 'producao' | 'analise'>('programacao');
  const [frente, setFrente] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [form, setForm] = useState({ servicoId: servicos[0]?.id || '', inicio: hoje(), fim: hoje(), quantidade: '', frente: '' });
  const [producaoForm, setProducaoForm] = useState({ itemId: '', quantidade: '', frente: '' });
  const frentes = useMemo(() => [...new Set(planejamento.map(item => item.frente).filter((item): item is string => Boolean(item)))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [planejamento]);
  const ativos = useMemo(() => planejamento.filter(item => item.ativo !== false && (status === 'todos' || item.situacao === status) && (!frente || item.frente === frente) && (!dataInicio || item.dataFim >= dataInicio) && (!dataFim || item.dataInicio <= dataFim) && `${item.servicoDescricao} ${item.frente || ''}`.toLocaleLowerCase().includes(busca.toLocaleLowerCase())), [planejamento, status, busca, frente, dataInicio, dataFim]);
  const atualizar = (campo: keyof typeof form, valor: string) => setForm(atual => ({ ...atual, [campo]: valor }));
  const salvarPlano = () => {
    const servico = servicos.find(item => item.id === form.servicoId);
    const qtd = Number(form.quantidade);
    if (!servico || !form.inicio || !form.fim || !(qtd > 0)) return;
    const agora = new Date().toISOString();
    onSavePlanejamento({ id: `plano-${Date.now()}`, dataInicio: form.inicio, dataFim: form.fim, servicoId: servico.id, servicoDescricao: servico.descricao, unidade: servico.unidade, quantidadePlanejada: qtd, frente: form.frente.trim() || undefined, responsavel, situacao: 'Planejado', ativo: true, criadoEm: agora, atualizadoEm: agora }, true);
    setForm(atual => ({ ...atual, quantidade: '', frente: '' }));
  };
  const salvarProducao = () => {
    const plano = planejamento.find(item => item.id === producaoForm.itemId);
    const qtd = Number(producaoForm.quantidade);
    if (!plano || !(qtd > 0)) return;
    const agora = new Date().toISOString();
    onSaveProducao({ id: `producao-${Date.now()}`, data: hoje(), servicoId: plano.servicoId, servicoDescricao: plano.servicoDescricao, unidade: plano.unidade, quantidade: qtd, frente: producaoForm.frente.trim() || plano.frente, responsavel, ativo: true, criadoEm: agora, atualizadoEm: agora }, true);
    setProducaoForm({ itemId: '', quantidade: '', frente: '' });
  };
  const colunas: ColunaTabela<PlanejamentoItem & { realizado: number }>[] = [
    { chave: 'servico', titulo: 'Serviço', render: item => <span className="font-bold">{item.servicoDescricao}</span>, valorOrdenacao: item => item.servicoDescricao },
    { chave: 'frente', titulo: 'Frente', render: item => item.frente || '—', valorOrdenacao: item => item.frente || '' },
    { chave: 'periodo', titulo: 'Período', render: item => <span className="whitespace-nowrap">{item.dataInicio} → {item.dataFim}</span>, valorOrdenacao: item => item.dataInicio },
    { chave: 'planejado', titulo: 'Planejado', alinhamento: 'direita', render: item => `${item.quantidadePlanejada} ${item.unidade}`, valorOrdenacao: item => item.quantidadePlanejada },
    { chave: 'realizado', titulo: 'Realizado', alinhamento: 'direita', render: item => <span className="font-bold text-emerald-700">{item.realizado} {item.unidade}</span>, valorOrdenacao: item => item.realizado },
    { chave: 'situacao', titulo: 'Situação', render: item => item.situacao, valorOrdenacao: item => item.situacao },
  ];
  const linhas = ativos.map(item => ({ ...item, realizado: producao.filter(reg => reg.servicoId === item.servicoId && reg.data >= item.dataInicio && reg.data <= item.dataFim && reg.ativo !== false).reduce((total, reg) => total + reg.quantidade, 0) }));
  const linhasProducao = producao.filter(item => item.ativo !== false && (!frente || item.frente === frente) && (!dataInicio || item.data >= dataInicio) && (!dataFim || item.data <= dataFim) && `${item.servicoDescricao} ${item.frente || ''}`.toLocaleLowerCase().includes(busca.toLocaleLowerCase()));
  const totalPlanejado = linhas.reduce((total, item) => total + item.quantidadePlanejada, 0);
  const totalRealizado = linhas.reduce((total, item) => total + item.realizado, 0);
  const percentual = totalPlanejado > 0 ? Math.min(100, Math.round((totalRealizado / totalPlanejado) * 100)) : 0;
  const limparFiltros = () => { setBusca(''); setStatus('todos'); setFrente(''); setDataInicio(''); setDataFim(''); };
  const colunasProducao: ColunaTabela<RegistroProducao>[] = [
    { chave: 'data', titulo: 'Data', render: item => item.data, valorOrdenacao: item => item.data },
    { chave: 'servico', titulo: 'Serviço', render: item => <span className="font-bold">{item.servicoDescricao}</span>, valorOrdenacao: item => item.servicoDescricao },
    { chave: 'frente', titulo: 'Frente', render: item => item.frente || '—', valorOrdenacao: item => item.frente || '' },
    { chave: 'quantidade', titulo: 'Quantidade', alinhamento: 'direita', render: item => `${item.quantidade} ${item.unidade}`, valorOrdenacao: item => item.quantidade },
    { chave: 'responsavel', titulo: 'Responsável', render: item => item.responsavel, valorOrdenacao: item => item.responsavel },
  ];
  return <TelaCheia id="programacao-tab" rotulo="Programação" longa rotuloDados="Programação e produção de terraplanagem" cabecalho={<PageHeader eyebrow="Operação" title="Programação" description="Planeje e lance a produção da obra em uma única linha de operação." abas={<AbasDaTela id="programacao-modos" rotulo="Modos da programação" ativa={visao} onTrocar={id => setVisao(id as typeof visao)} idPainel="programacao-conteudo" abas={[{ id: 'painel', rotulo: 'Painel', icone: LayoutDashboard }, { id: 'programacao', rotulo: 'Programação', icone: CalendarDays }, { id: 'producao', rotulo: 'Produção', icone: ClipboardList }, { id: 'analise', rotulo: 'Análise', icone: BarChart3 }]} />} />}>
  <section className="min-w-0 space-y-3" aria-label="Programação de terraplanagem">
    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
      <input className={`${CAMPO} min-w-64 flex-1`} value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar serviço ou frente" aria-label="Buscar programação" />
      <select className={`${CAMPO} w-44 shrink-0`} value={frente} onChange={event => setFrente(event.target.value)} aria-label="Filtrar frente"><option value="">Todas as frentes</option>{frentes.map(item => <option key={item}>{item}</option>)}</select>
      <select className={`${CAMPO} w-40 shrink-0`} value={status} onChange={event => setStatus(event.target.value)} aria-label="Filtrar situação"><option value="todos">Todas as situações</option><option>Planejado</option><option>Em execução</option><option>Concluído</option><option>Cancelado</option></select>
      <input className={`${CAMPO} w-36 shrink-0`} type="date" value={dataInicio} onChange={event => setDataInicio(event.target.value)} aria-label="Data inicial" />
      <input className={`${CAMPO} w-36 shrink-0`} type="date" value={dataFim} onChange={event => setDataFim(event.target.value)} aria-label="Data final" />
      {(busca || frente || dataInicio || dataFim || status !== 'todos') && <button type="button" className={`${BOTAO_SECUNDARIO} shrink-0`} onClick={limparFiltros}><Filter className="size-4" aria-hidden="true" /> Limpar</button>}
      {podeEditar && <button type="button" className={`${BOTAO_PRIMARIO} shrink-0`} onClick={salvarPlano}><Plus className="size-4" aria-hidden="true" /> Novo plano</button>}
    </div>
    <div id="programacao-conteudo" role="tabpanel" className="space-y-3">
    {visao === 'painel' && <div className="grid gap-3 sm:grid-cols-3">
      {[['Serviços ativos', linhas.length, 'itens no recorte'], ['Planejado', `${totalPlanejado}`, 'quantidade prevista'], ['Realizado', `${totalRealizado} · ${percentual}%`, 'produção acumulada']].map(([titulo, valor, detalhe]) => <article key={titulo} className={`${CARTAO} p-3`}><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</p><strong className="mt-1 block text-2xl font-black text-slate-900">{valor}</strong><span className="text-xs text-slate-500">{detalhe}</span></article>)}
    </div>}
    {visao === 'painel' && <div className="grid gap-3 lg:grid-cols-2">{[...new Set(linhas.map(item => item.frente || 'Sem frente'))].map(grupo => { const grupoLinhas = linhas.filter(item => (item.frente || 'Sem frente') === grupo); const previsto = grupoLinhas.reduce((total, item) => total + item.quantidadePlanejada, 0); const feito = grupoLinhas.reduce((total, item) => total + item.realizado, 0); const percentualGrupo = previsto > 0 ? Math.min(100, Math.round((feito / previsto) * 100)) : 0; return <article key={grupo} className={`${CARTAO} p-3`}><div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-black"><Layers className="size-4 text-emerald-700" /> {grupo}</h2><span className="text-xs font-bold text-slate-500">{grupoLinhas.length} serviços</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-700" style={{ width: `${percentualGrupo}%` }} /></div><div className="mt-2 flex justify-between text-xs text-slate-600"><span>{feito} realizado</span><strong>{percentualGrupo}%</strong><span>{previsto} previsto</span></div></article>; })}</div>}
    {visao === 'producao' && <div className={`${CARTAO} min-w-0`}><TabelaPadrao titulo="Lançamentos de produção" linhas={linhasProducao} colunas={colunasProducao} idDaLinha={item => item.id} nomeDoItem={{ um: 'lançamento', varios: 'lançamentos' }} vazio="Nenhum lançamento no recorte." densa semPaginacao exportar /></div>}
    {visao === 'analise' && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Programações', linhas.length], ['Lançamentos', linhasProducao.length], ['Planejado', totalPlanejado], ['Realizado', `${totalRealizado} (${percentual}%)`]].map(([titulo, valor]) => <article key={titulo} className={`${CARTAO} p-4`}><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</p><strong className="mt-2 block text-2xl font-black text-slate-900">{valor}</strong></article>)}</div>}
    {visao === 'programacao' && <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className={`${CARTAO} min-w-0`}><TabelaPadrao titulo="Programação de terraplanagem" linhas={linhas} colunas={colunas} idDaLinha={item => item.id} nomeDoItem={{ um: 'programação', varios: 'programações' }} vazio="Nenhuma programação encontrada." densa semPaginacao exportar={false} /></div>
      <aside className={`${CARTAO} space-y-3 p-3`}><h2 className="flex items-center gap-2 text-base font-black"><CalendarDays className="size-4 text-emerald-700" /> Lançamento rápido</h2><select className={CAMPO} value={producaoForm.itemId} onChange={event => setProducaoForm(atual => ({ ...atual, itemId: event.target.value }))} aria-label="Serviço da produção"><option value="">Selecione o serviço</option>{planejamento.map(item => <option key={item.id} value={item.id}>{item.servicoDescricao} · {item.frente || 'sem frente'}</option>)}</select><input className={CAMPO} inputMode="decimal" value={producaoForm.quantidade} onChange={event => setProducaoForm(atual => ({ ...atual, quantidade: event.target.value }))} placeholder="Quantidade executada" aria-label="Quantidade executada" /><input className={CAMPO} value={producaoForm.frente} onChange={event => setProducaoForm(atual => ({ ...atual, frente: event.target.value }))} placeholder="Frente (opcional)" aria-label="Frente" /><button type="button" className={`${BOTAO_PRIMARIO} w-full`} onClick={salvarProducao} disabled={!podeEditar}><Save className="size-4" aria-hidden="true" /> Salvar produção</button></aside>
    </div>}
    </div>
    {podeEditar && <div className={`${CARTAO} grid gap-2 p-3 sm:grid-cols-5`}><select className={`${CAMPO} sm:col-span-2`} value={form.servicoId} onChange={event => atualizar('servicoId', event.target.value)} aria-label="Serviço do plano"><option value="">Serviço</option>{servicos.filter(item => item.ativo !== false).map(item => <option key={item.id} value={item.id}>{item.descricao}</option>)}</select><input className={CAMPO} type="date" value={form.inicio} onChange={event => atualizar('inicio', event.target.value)} aria-label="Início" /><input className={CAMPO} type="date" value={form.fim} onChange={event => atualizar('fim', event.target.value)} aria-label="Fim" /><input className={CAMPO} inputMode="decimal" value={form.quantidade} onChange={event => atualizar('quantidade', event.target.value)} placeholder="Quantidade" aria-label="Quantidade planejada" /><input className={CAMPO} value={form.frente} onChange={event => atualizar('frente', event.target.value)} placeholder="Frente" aria-label="Frente do plano" /><button type="button" className={`${BOTAO_SECUNDARIO} sm:col-span-5`} onClick={salvarPlano}><Check className="size-4" aria-hidden="true" /> Adicionar à programação</button></div>}
  </section>
  </TelaCheia>;
}
