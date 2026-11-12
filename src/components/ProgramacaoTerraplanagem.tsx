import { useMemo, useState } from 'react';
import { CalendarDays, Check, Plus, Save } from 'lucide-react';
import type { PlanejamentoItem, RegistroProducao, ServicoObra } from '../types';
import { CAMPO, CARTAO, BOTAO_PRIMARIO, BOTAO_SECUNDARIO } from './cadastros/estilos';
import { TabelaPadrao, type ColunaTabela } from '../shared/ui/TabelaPadrao';
import { PageHeader } from '../shared/ui/PageHeader';
import { TelaCheia } from '../shared/ui/TelaCheia';

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
  const [form, setForm] = useState({ servicoId: servicos[0]?.id || '', inicio: hoje(), fim: hoje(), quantidade: '', frente: '' });
  const [producaoForm, setProducaoForm] = useState({ itemId: '', quantidade: '', frente: '' });
  const ativos = useMemo(() => planejamento.filter(item => item.ativo !== false && (status === 'todos' || item.situacao === status) && `${item.servicoDescricao} ${item.frente || ''}`.toLocaleLowerCase().includes(busca.toLocaleLowerCase())), [planejamento, status, busca]);
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
  return <TelaCheia id="programacao-tab" rotulo="Programação" longa rotuloDados="Programação e produção de terraplanagem" cabecalho={<PageHeader eyebrow="Operação" title="Programação" description="Planeje e lance a produção da obra em uma única linha de operação." />}>
  <section className="min-w-0 space-y-3" aria-label="Programação de terraplanagem">
    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
      <input className={`${CAMPO} min-w-64 flex-1`} value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar serviço ou frente" aria-label="Buscar programação" />
      <select className={`${CAMPO} w-40 shrink-0`} value={status} onChange={event => setStatus(event.target.value)} aria-label="Filtrar situação"><option value="todos">Todas as situações</option><option>Planejado</option><option>Em execução</option><option>Concluído</option><option>Cancelado</option></select>
      {podeEditar && <button type="button" className={`${BOTAO_PRIMARIO} shrink-0`} onClick={salvarPlano}><Plus className="size-4" aria-hidden="true" /> Novo plano</button>}
    </div>
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className={`${CARTAO} min-w-0`}><TabelaPadrao titulo="Programação de terraplanagem" linhas={linhas} colunas={colunas} idDaLinha={item => item.id} nomeDoItem={{ um: 'programação', varios: 'programações' }} vazio="Nenhuma programação encontrada." densa semPaginacao exportar={false} /></div>
      <aside className={`${CARTAO} space-y-3 p-3`}><h2 className="flex items-center gap-2 text-base font-black"><CalendarDays className="size-4 text-emerald-700" /> Lançamento rápido</h2><select className={CAMPO} value={producaoForm.itemId} onChange={event => setProducaoForm(atual => ({ ...atual, itemId: event.target.value }))} aria-label="Serviço da produção"><option value="">Selecione o serviço</option>{planejamento.map(item => <option key={item.id} value={item.id}>{item.servicoDescricao} · {item.frente || 'sem frente'}</option>)}</select><input className={CAMPO} inputMode="decimal" value={producaoForm.quantidade} onChange={event => setProducaoForm(atual => ({ ...atual, quantidade: event.target.value }))} placeholder="Quantidade executada" aria-label="Quantidade executada" /><input className={CAMPO} value={producaoForm.frente} onChange={event => setProducaoForm(atual => ({ ...atual, frente: event.target.value }))} placeholder="Frente (opcional)" aria-label="Frente" /><button type="button" className={`${BOTAO_PRIMARIO} w-full`} onClick={salvarProducao} disabled={!podeEditar}><Save className="size-4" aria-hidden="true" /> Salvar produção</button></aside>
    </div>
    {podeEditar && <div className={`${CARTAO} grid gap-2 p-3 sm:grid-cols-5`}><select className={`${CAMPO} sm:col-span-2`} value={form.servicoId} onChange={event => atualizar('servicoId', event.target.value)} aria-label="Serviço do plano"><option value="">Serviço</option>{servicos.filter(item => item.ativo !== false).map(item => <option key={item.id} value={item.id}>{item.descricao}</option>)}</select><input className={CAMPO} type="date" value={form.inicio} onChange={event => atualizar('inicio', event.target.value)} aria-label="Início" /><input className={CAMPO} type="date" value={form.fim} onChange={event => atualizar('fim', event.target.value)} aria-label="Fim" /><input className={CAMPO} inputMode="decimal" value={form.quantidade} onChange={event => atualizar('quantidade', event.target.value)} placeholder="Quantidade" aria-label="Quantidade planejada" /><input className={CAMPO} value={form.frente} onChange={event => atualizar('frente', event.target.value)} placeholder="Frente" aria-label="Frente do plano" /><button type="button" className={`${BOTAO_SECUNDARIO} sm:col-span-5`} onClick={salvarPlano}><Check className="size-4" aria-hidden="true" /> Adicionar à programação</button></div>}
  </section>
  </TelaCheia>;
}
