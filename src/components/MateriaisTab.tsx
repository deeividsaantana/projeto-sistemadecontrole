/**
 * Materiais: cadastro, movimentação e estoque. O saldo é sempre a soma dos
 * movimentos — não existe contador guardado para divergir do histórico.
 */
import { useEffect, useMemo, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, BarChart3, Boxes, Construction, FileSpreadsheet, Layers3, Mountain, Package, PackageX, Plus, Search, Trash2, Truck, X } from 'lucide-react';
import type { Empresa, EtapaServico, Material, MovimentoMaterial, TipoMovimentoMaterial } from '../types';
import { pendenciasDeRecebimento, resumoDeRecebimento } from '../utils/recebimentoMaterial';
import { posicaoEstoque, saldoDoMaterial, validarMovimento, type PosicaoEstoque } from '../utils/estoque';
import { buildMaterialsOperationalSummary, getDefaultMaterialsPeriod } from '../utils/materialsAnalytics';
import { buildMaterialsFlow, summarizeMaterialsStock } from '../utils/materialsDashboard';
import { normalizeComparable } from '../utils/canonicalIdentity';
import { formatarData, moeda, numero } from '../utils/formato';
import MateriaisImportacoesPanel from './MateriaisImportacoesPanel';
import MateriaisUtilizacaoPanel from './MateriaisUtilizacaoPanel';
import {
  Badge,
  DataTable,
  EmptyState,
  FilterBar,
  Modal,
  PageHeader,
  TableBody,
  TableHead,
  TableShell,
  isoDay,
  type DataTableColumn,
} from '../shared/ui';
import { useEntradaDeLista } from '../shared/hooks/useEntradaDeLista';

interface MateriaisTabProps {
  materiais: Material[];
  movimentos: MovimentoMaterial[];
  empresas: Empresa[];
  etapas: EtapaServico[];
  responsavel: string;
  podeEditar: boolean;
  onSaveMaterial: (material: Material, isNew: boolean) => void;
  onSaveMovimento: (movimento: MovimentoMaterial) => void;
  onSaveMovimentos: (movimentos: MovimentoMaterial[], descricao: string) => void;
  onUpdateMovimentos: (movimentos: MovimentoMaterial[], descricao: string, acao?: 'Editou' | 'Excluiu') => void;
  onApplyImport: (materials: Material[], movements: MovimentoMaterial[]) => void;
}

const TIPOS: TipoMovimentoMaterial[] = ['Entrada', 'Saída', 'Transferência', 'Ajuste'];
const UNIDADES = ['m³', 't', 'kg', 'un', 'm', 'm²', 'L', 'sc'];

const PASSO_MOVIMENTOS = 100;

type MateriaisAba = 'resumo' | 'utilizacao' | 'estoque' | 'movimentos' | 'cadastro' | 'importacoes';

interface MaterialBatchRow {
  data: string;
  tipo: TipoMovimentoMaterial;
  materialId: string;
  quantidade: number;
  unidade?: string;
  fatorConversao: number;
  fornecedorId: string;
  placa: string;
  ticket: string;
  destino: string;
  valorUnitario: number;
  valorTotal: number;
  observacao: string;
}

const materialVisual = (descricao: string) => {
  const text = normalizeComparable(descricao);
  if (text.includes('lixo') || text.includes('bota fora')) return { Icon: Trash2, tone: 'bg-rose-50 text-rose-700 border-rose-100' };
  if (text.includes('solo')) return { Icon: Mountain, tone: 'bg-amber-50 text-amber-800 border-amber-100' };
  if (text.includes('rachao') || text.includes('macadame') || text.includes('bica')) return { Icon: Layers3, tone: 'bg-emerald-50 text-emerald-800 border-emerald-100' };
  if (text.includes('brita') || text.includes('pedra') || text.includes('saibro')) return { Icon: Construction, tone: 'bg-sky-50 text-sky-800 border-sky-100' };
  return { Icon: Package, tone: 'bg-slate-50 text-slate-700 border-slate-100' };
};


export default function MateriaisTab({
  materiais,
  movimentos,
  empresas,
  etapas,
  responsavel,
  podeEditar,
  onSaveMaterial,
  onSaveMovimento,
  onSaveMovimentos,
  onUpdateMovimentos,
  onApplyImport,
}: MateriaisTabProps) {
  const hoje = isoDay(new Date());
  const periodoInicial = getDefaultMaterialsPeriod(hoje);
  const [aba, setAba] = useState<MateriaisAba>('resumo');
  // Painel de KPIs e gráficos é contexto operacional (quanto tem, quanto
  // mexeu). Em Cadastro/Importações a tarefa é outra (mestre de dados), então
  // o painel só polui: some nessas abas, como numa tela de cadastro de ERP.
  const painelOperacionalVisivel = aba === 'resumo' || aba === 'estoque' || aba === 'movimentos';
  const [busca, setBusca] = useState('');
  // Com a planilha de agregados são mais de 11 mil movimentos: desenhar todos
  // de uma vez parava a tela por uns 7 segundos. A lista mostra um pedaço e
  // cresce quando a pessoa pede; a busca continua olhando todos.
  const [limiteMovimentos, setLimiteMovimentos] = useState(PASSO_MOVIMENTOS);
  useEffect(() => { setLimiteMovimentos(PASSO_MOVIMENTOS); }, [busca, aba]);
  const escopoMotion = useEntradaDeLista<HTMLDivElement>([busca]);
  const [erro, setErro] = useState('');
  const [periodo, setPeriodo] = useState(periodoInicial);
  const [filtrosResumo, setFiltrosResumo] = useState({ material: '', fornecedor: '', local: '', tipo: '' });
  const [formMaterial, setFormMaterial] = useState<Material | null>(null);
  const [materialAberto, setMaterialAberto] = useState(false);
  const [movimentoAberto, setMovimentoAberto] = useState(false);
  const [loteAberto, setLoteAberto] = useState(false);
  const [cadastro, setCadastro] = useState({ codigo: '', descricao: '', categoria: '', unidade: 'm³', estoqueMinimo: 0, fornecedorPadraoId: '', observacao: '', diametroMm: '', comprimentoM: '' });
  const [movimento, setMovimento] = useState({
    data: hoje,
    tipo: 'Entrada' as TipoMovimentoMaterial,
    materialId: '',
    quantidade: 0,
    fornecedorId: '',
    notaFiscal: '',
    placa: '',
    ticket: '',
    fatorConversao: 1,
    valorUnitario: 0,
    valorTotal: 0,
    solicitacaoCompra: '',
    quantidadeNota: 0,
    destino: '',
    origem: '',
    servico: '',
    etapaServicoId: '',
    finalidade: undefined as 'Consumo' | undefined,
    observacao: '',
  });
  const novaLinhaLote = (): MaterialBatchRow => ({
    data: hoje,
    tipo: 'Entrada',
    materialId: '',
    quantidade: 0,
    fatorConversao: 1,
    fornecedorId: '',
    placa: '',
    ticket: '',
    destino: '',
    valorUnitario: 0,
    valorTotal: 0,
    observacao: '',
  });
  const [linhasLote, setLinhasLote] = useState<MaterialBatchRow[]>([novaLinhaLote()]);

  const ativos = useMemo(() => materiais.filter(item => item.ativo !== false), [materiais]);
  // Uso desfeito fica na lista de movimentos, marcado; resumo e gráficos não somam ele.
  const movimentosVigentes = useMemo(() => movimentos.filter(item => !item.canceladoEm), [movimentos]);
  const posicoes = useMemo(() => posicaoEstoque(ativos, movimentos), [ativos, movimentos]);
  const abaixoDoMinimo = posicoes.filter(item => item.abaixoDoMinimo);
  // Carga que a nota prometeu e não chegou é dinheiro parado: fica em cima.
  const pendencias = useMemo(() => pendenciasDeRecebimento(movimentosVigentes), [movimentosVigentes]);
  const recebimento = useMemo(() => resumoDeRecebimento(movimentosVigentes), [movimentosVigentes]);
  const estoqueResumo = useMemo(() => summarizeMaterialsStock(posicoes), [posicoes]);
  const fluxoSemanal = useMemo(() => buildMaterialsFlow(movimentosVigentes, hoje), [movimentosVigentes, hoje]);
  const maiorFluxo = Math.max(1, ...fluxoSemanal.flatMap(item => [item.entradas, item.saidas, item.transferencias]));
  const resumoOperacional = useMemo(() => buildMaterialsOperationalSummary(movimentosVigentes, {
    from: periodo.from,
    to: periodo.to,
    material: filtrosResumo.material,
    fornecedor: filtrosResumo.fornecedor,
    local: filtrosResumo.local,
    tipo: filtrosResumo.tipo,
  }), [filtrosResumo, movimentosVigentes, periodo]);
  const materiaisResumo = useMemo(() => [...new Set(movimentos.map(item => item.materialDescricao).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR')), [movimentos]);
  const fornecedoresResumo = useMemo(() => [...new Set(movimentos.map(item => item.fornecedorNome).filter(Boolean) as string[])]
    .sort((a, b) => a.localeCompare(b, 'pt-BR')), [movimentos]);
  const locaisResumo = useMemo(() => [...new Set(movimentos.flatMap(item => [item.destino, item.origem]).filter(Boolean) as string[])]
    .sort((a, b) => a.localeCompare(b, 'pt-BR')), [movimentos]);

  const termo = normalizeComparable(busca).trim();
  const posicoesFiltradas = posicoes.filter(item => !termo
    || normalizeComparable(`${item.material.codigo} ${item.material.descricao} ${item.material.categoria}`).includes(termo));
  const movimentosFiltrados = useMemo(() => [...movimentos]
    .filter(item => !termo || normalizeComparable(`${item.materialDescricao} ${item.tipo} ${item.destino || ''} ${item.fornecedorNome || ''} ${item.notaFiscal || ''}`).includes(termo))
    .sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm)), [movimentos, termo]);

  const abrirCadastro = (material?: Material) => {
    setFormMaterial(material || null);
    setCadastro(material
      ? {
        codigo: material.codigo,
        descricao: material.descricao,
        categoria: material.categoria,
        unidade: material.unidade,
        estoqueMinimo: material.estoqueMinimo || 0,
        fornecedorPadraoId: material.fornecedorPadraoId || '',
        observacao: material.observacao || '',
        diametroMm: material.diametroMm ? String(material.diametroMm) : '',
        comprimentoM: material.comprimentoM ? String(material.comprimentoM) : '',
      }
      : { codigo: '', descricao: '', categoria: '', unidade: 'm³', estoqueMinimo: 0, fornecedorPadraoId: '', observacao: '', diametroMm: '', comprimentoM: '' });
    setErro('');
    setMaterialAberto(true);
  };

  const abrirMovimento = () => {
    setErro('');
    setMovimentoAberto(true);
  };

  useEffect(() => {
    if (!podeEditar || movimentoAberto || materialAberto || loteAberto) return undefined;
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches('input, textarea, select, [contenteditable="true"]');
      if (!isTyping && event.key.toLocaleLowerCase('pt-BR') === 'n' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        abrirMovimento();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [loteAberto, materialAberto, movimentoAberto, podeEditar]);

  const exportarResumoCsv = () => {
    const cabecalho = ['Data', 'Tipo', 'Material', 'Unidade', 'Quantidade', 'Fator', 'Fornecedor', 'Placa', 'Ticket', 'Local', 'Valor unitario', 'Valor total'];
    const linhas = resumoOperacional.filteredMovements.map(item => [
      item.data,
      item.tipo,
      item.materialDescricao,
      item.unidade,
      String(item.quantidade).replace('.', ','),
      item.fatorConversao ? String(item.fatorConversao).replace('.', ',') : '',
      item.fornecedorNome || '',
      item.placa || '',
      item.ticket || item.notaFiscal || '',
      item.destino || item.origem || '',
      item.valorUnitario ? String(item.valorUnitario).replace('.', ',') : '',
      item.valorTotal ? String(item.valorTotal).replace('.', ',') : '',
    ]);
    const csv = [cabecalho, ...linhas]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `materiais-${periodo.from}-a-${periodo.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const salvarMaterial = () => {
    if (!cadastro.descricao.trim()) {
      setErro('Informe a descrição do material.');
      return;
    }
    const agora = new Date().toISOString();
    onSaveMaterial({
      id: formMaterial?.id || `mat-${Date.now()}`,
      codigo: cadastro.codigo.trim(),
      descricao: cadastro.descricao.trim(),
      categoria: cadastro.categoria.trim(),
      unidade: cadastro.unidade,
      estoqueMinimo: Number(cadastro.estoqueMinimo) || undefined,
      fornecedorPadraoId: cadastro.fornecedorPadraoId || undefined,
      observacao: cadastro.observacao.trim() || undefined,
      diametroMm: Number(cadastro.diametroMm.replace(',', '.')) || undefined,
      comprimentoM: Number(cadastro.comprimentoM.replace(',', '.')) || undefined,
      ativo: formMaterial?.ativo ?? true,
      criadoEm: formMaterial?.criadoEm || agora,
      atualizadoEm: agora,
    }, !formMaterial);
    setMaterialAberto(false);
  };

  const excluirMaterial = (material: Material) => {
    const temMovimento = movimentos.some(item => item.materialId === material.id);
    const confirmar = window.confirm(
      temMovimento
        ? `Excluir "${material.descricao}" vai inativar o cadastro e preservar o histórico de movimentos. Confirmar?`
        : `Excluir "${material.descricao}" do cadastro?`,
    );
    if (!confirmar) return;
    onSaveMaterial({
      ...material,
      ativo: false,
      atualizadoEm: new Date().toISOString(),
    }, false);
  };

  const salvarMovimento = () => {
    const material = materiais.find(item => item.id === movimento.materialId);
    const candidato = {
      id: `mov-${Date.now()}`,
      tipo: movimento.tipo,
      materialId: movimento.materialId,
      quantidade: Number(movimento.quantidade),
    };
    const problema = validarMovimento(movimentos, candidato);
    if (problema || !material) {
      setErro(problema || 'Selecione o material.');
      return;
    }
    const fornecedor = empresas.find(item => item.id === movimento.fornecedorId);
    const etapa = etapas.find(item => item.id === movimento.etapaServicoId);
    onSaveMovimento({
      id: candidato.id,
      data: movimento.data,
      tipo: movimento.tipo,
      materialId: material.id,
      materialDescricao: material.descricao,
      quantidade: Number(movimento.quantidade),
      unidade: material.unidade,
      fornecedorId: fornecedor?.id,
      fornecedorNome: fornecedor?.nome,
      notaFiscal: movimento.notaFiscal.trim() || undefined,
      placa: movimento.placa.trim() || undefined,
      ticket: movimento.ticket.trim() || undefined,
      fatorConversao: Number(movimento.fatorConversao) > 0 ? Number(movimento.fatorConversao) : undefined,
      valorUnitario: Number(movimento.valorUnitario) > 0 ? Number(movimento.valorUnitario) : undefined,
      valorTotal: Number(movimento.valorTotal) > 0
        ? Number(movimento.valorTotal)
        : Number(movimento.valorUnitario) > 0
          ? Number(movimento.valorUnitario) * Number(movimento.quantidade)
          : undefined,
      solicitacaoCompra: movimento.solicitacaoCompra.trim() || undefined,
      // Só a entrada tem nota a conferir. Guardar o que a nota prometeu é o
      // que permite saber, depois, que faltou carga.
      quantidadeNota: movimento.tipo === 'Entrada' && Number(movimento.quantidadeNota) > 0
        ? Number(movimento.quantidadeNota)
        : undefined,
      etapaServicoId: etapa?.id,
      etapaServicoNome: etapa?.nome,
      finalidade: movimento.tipo === 'Saída' && movimento.finalidade === 'Consumo' ? 'Consumo' : undefined,
      destino: movimento.destino.trim() || undefined,
      origem: movimento.origem.trim() || undefined,
      servico: movimento.servico.trim() || undefined,
      responsavel,
      observacao: movimento.observacao.trim() || undefined,
      criadoEm: new Date().toISOString(),
    });
    setMovimento({ ...movimento, quantidade: 0, notaFiscal: '', placa: '', ticket: '', solicitacaoCompra: '', quantidadeNota: 0, destino: '', origem: '', servico: '', etapaServicoId: '', finalidade: undefined, observacao: '', valorTotal: 0 });
    setErro('');
    setMovimentoAberto(false);
  };

  const atualizarLinhaLote = (index: number, campo: keyof MaterialBatchRow, valor: string | number) => {
    setLinhasLote(linhas => linhas.map((linha, linhaIndex) => linhaIndex === index ? { ...linha, [campo]: valor } : linha));
  };

  const salvarLote = () => {
    const agora = new Date().toISOString();
    const preenchidas = linhasLote.filter(linha => linha.data || linha.materialId || Number(linha.quantidade) > 0 || linha.ticket || linha.placa || linha.destino);
    if (preenchidas.length === 0) {
      setErro('Preencha ao menos uma linha para salvar.');
      return;
    }
    const novosMovimentos: MovimentoMaterial[] = [];
    for (const [index, linha] of preenchidas.entries()) {
      const material = materiais.find(item => item.id === linha.materialId);
      if (!material) {
        setErro(`Linha ${index + 1}: selecione o material.`);
        return;
      }
      const candidato = {
        id: `mov-lote-${Date.now()}-${index}`,
        tipo: linha.tipo,
        materialId: linha.materialId,
        quantidade: Number(linha.quantidade),
      };
      const problema = validarMovimento([...movimentos, ...novosMovimentos], candidato);
      if (problema) {
        setErro(`Linha ${index + 1}: ${problema}`);
        return;
      }
      const fornecedor = empresas.find(item => item.id === linha.fornecedorId);
      novosMovimentos.push({
        id: candidato.id,
        data: linha.data || hoje,
        tipo: linha.tipo,
        materialId: material.id,
        materialDescricao: material.descricao,
        quantidade: Number(linha.quantidade),
        unidade: linha.unidade || material.unidade,
        fornecedorId: fornecedor?.id,
        fornecedorNome: fornecedor?.nome,
        placa: linha.placa.trim() || undefined,
        ticket: linha.ticket.trim() || undefined,
        destino: linha.destino.trim() || undefined,
        fatorConversao: Number(linha.fatorConversao) > 0 ? Number(linha.fatorConversao) : undefined,
        valorUnitario: Number(linha.valorUnitario) > 0 ? Number(linha.valorUnitario) : undefined,
        valorTotal: Number(linha.valorTotal) > 0
          ? Number(linha.valorTotal)
          : Number(linha.valorUnitario) > 0
            ? Number(linha.valorUnitario) * Number(linha.quantidade)
            : undefined,
        responsavel,
        observacao: linha.observacao.trim() || undefined,
        criadoEm: agora,
      });
    }
    novosMovimentos.forEach(onSaveMovimento);
    setLinhasLote([novaLinhaLote()]);
    setErro('');
    setLoteAberto(false);
    setAba('resumo');
  };

  const saldoAtualDoForm = movimento.materialId ? saldoDoMaterial(movimentos, movimento.materialId) : 0;
  const empresasPorId = new Map(empresas.map(empresa => [empresa.id, empresa.nome]));
  const posicaoColumns: DataTableColumn<PosicaoEstoque>[] = [
    { id: 'codigo', label: 'Código', sortValue: item => item.material.codigo, cell: item => <span className="font-mono text-slate-600">{item.material.codigo || '—'}</span> },
    { id: 'material', label: 'Material', sortValue: item => item.material.descricao, cell: item => <strong className="text-slate-800">{item.material.descricao}</strong> },
    { id: 'categoria', label: 'Categoria', sortValue: item => item.material.categoria, cell: item => <span className="text-slate-600">{item.material.categoria || '—'}</span> },
  ];
  if (aba === 'estoque') {
    posicaoColumns.push(
      { id: 'entradas', label: 'Entradas', sortValue: item => item.entradas, cell: item => <span className="font-mono text-slate-600">{numero(item.entradas)}</span> },
      { id: 'saidas', label: 'Saídas', sortValue: item => item.saidas, cell: item => <span className="font-mono text-slate-600">{numero(item.saidas)}</span> },
      { id: 'saldo', label: 'Saldo', sortValue: item => item.saldo, cell: item => <strong className={`font-mono ${item.abaixoDoMinimo ? 'text-amber-700' : 'text-slate-900'}`}>{numero(item.saldo)} {item.material.unidade}</strong> },
      { id: 'minimo', label: 'Mínimo', sortValue: item => item.material.estoqueMinimo, cell: item => <span className="text-slate-600">{item.material.estoqueMinimo ? numero(item.material.estoqueMinimo) : '—'}</span> },
    );
  } else {
    posicaoColumns.push(
      { id: 'unidade', label: 'Unidade', sortValue: item => item.material.unidade, cell: item => <span className="text-slate-600">{item.material.unidade}</span> },
      { id: 'minimo', label: 'Mínimo', sortValue: item => item.material.estoqueMinimo, cell: item => <span className="text-slate-600">{item.material.estoqueMinimo ? numero(item.material.estoqueMinimo) : '—'}</span> },
      { id: 'fornecedor', label: 'Fornecedor padrão', sortValue: item => empresasPorId.get(item.material.fornecedorPadraoId || '') || null, cell: item => <span className="text-slate-600">{empresasPorId.get(item.material.fornecedorPadraoId || '') || '—'}</span> },
    );
    if (podeEditar) posicaoColumns.push({
      id: 'acoes', label: 'Ações', align: 'right', cell: item => (
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => abrirCadastro(item.material)} className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700">Editar</button>
          <button type="button" onClick={() => excluirMaterial(item.material)} className="min-h-9 rounded-lg border border-rose-200 px-2.5 text-[11px] font-bold text-rose-700 transition-colors hover:bg-rose-50">Excluir</button>
        </div>
      ),
    });
  }

  return (
    <div ref={escopoMotion} id="materiais-tab" className="min-h-full w-full bg-white px-3 pb-12 pt-0 sm:px-4">
      <PageHeader
        title="Materiais"
        description="Cadastro, movimentação e estoque. O saldo vem da soma dos movimentos."
        className="-mt-3 sm:-mt-4"
        actions={podeEditar ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => abrirCadastro()} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700">Novo material</button>
            <button type="button" onClick={abrirMovimento} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-800">
              <Plus className="h-4 w-4" /> Novo lançamento <span className="hidden rounded border border-white/30 px-1.5 py-0.5 font-mono text-[9px] xl:inline">N</span>
            </button>
            <button
              type="button"
              onClick={() => { setErro(''); setLoteAberto(true); }}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition-colors hover:border-emerald-500 hover:text-emerald-700"
            >
              <Plus className="h-4 w-4" /> Lote
            </button>
          </div>
        ) : undefined}
      />

      {painelOperacionalVisivel && <section id="materials-dashboard" aria-label="Painel de materiais" className="mt-2 grid gap-3 lg:grid-cols-12">
        <div className="grid grid-cols-2 gap-2 lg:col-span-12 lg:grid-cols-4">
          {[
            { label: 'Materiais ativos', valor: String(estoqueResumo.total), detalhe: 'itens no cadastro operacional' },
            { label: 'Movimentos', valor: String(movimentos.length), detalhe: 'registros no histórico' },
            { label: 'Abaixo do mínimo', valor: String(estoqueResumo.abaixoDoMinimo), detalhe: 'pedem reposição' },
            { label: 'Sem saldo', valor: String(estoqueResumo.semSaldo), detalhe: 'sem disponibilidade' },
          ].map((item, index) => (
            <article key={item.label} className="renea-card rounded-lg border border-slate-200 bg-white p-3.5 sm:p-4" data-linha-lista data-card-index={index}>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{item.label}</p>
              <strong className="mt-1 block text-2xl font-black tabular-nums text-slate-950">{item.valor}</strong>
              <span className="mt-1 block text-[11px] leading-4 text-slate-500">{item.detalhe}</span>
            </article>
          ))}
        </div>

        <article className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-4" aria-labelledby="stock-coverage-title">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-700">Estoque</p>
              <h2 id="stock-coverage-title" className="mt-1 text-sm font-black text-slate-950">Cobertura operacional</h2>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">posição atual</span>
          </div>
          <div className="mt-3 flex items-center gap-5">
            <div className="relative size-28 shrink-0" role="img" aria-label={`${estoqueResumo.coberturaPercentual ?? 0}% dos materiais com saldo regular`}>
              <svg viewBox="0 0 112 112" className="size-28 -rotate-90" aria-hidden="true">
                <circle cx="56" cy="56" r="43" fill="none" stroke="#edf1ee" strokeWidth="10" />
                <circle
                  cx="56"
                  cy="56"
                  r="43"
                  fill="none"
                  stroke="#008b62"
                  strokeWidth="10"
                  strokeLinecap="round"
                  pathLength="100"
                  strokeDasharray={`${estoqueResumo.coberturaPercentual ?? 0} 100`}
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center text-center">
                <strong className="text-xl font-black tabular-nums text-slate-950">{estoqueResumo.coberturaPercentual == null ? '—' : `${estoqueResumo.coberturaPercentual}%`}</strong>
              </div>
            </div>
            <dl className="min-w-0 flex-1 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2"><dt className="text-slate-500">Regular</dt><dd className="font-black tabular-nums text-emerald-700">{estoqueResumo.regulares}</dd></div>
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2"><dt className="text-slate-500">Abaixo do mínimo</dt><dd className="font-black tabular-nums text-amber-700">{estoqueResumo.abaixoDoMinimo}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Sem saldo</dt><dd className="font-black tabular-nums text-rose-700">{estoqueResumo.semSaldo}</dd></div>
            </dl>
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-8" aria-labelledby="material-flow-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-700">Movimentação</p>
              <h2 id="material-flow-title" className="mt-1 text-sm font-black text-slate-950">Fluxo dos últimos 7 dias</h2>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wide text-slate-500" aria-label="Legenda do gráfico">
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-emerald-600" /> Entradas</span>
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-amber-500" /> Saídas</span>
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-slate-400" /> Transferências</span>
            </div>
          </div>
          <div className="mt-4 grid h-36 grid-cols-7 items-end gap-2 border-b border-slate-200" role="img" aria-label="Comparação diária entre entradas e saídas de materiais">
            {fluxoSemanal.map(item => (
              <div key={item.date} className="flex h-full min-w-0 flex-col justify-end gap-1 text-center">
                <div className="flex h-[104px] items-end justify-center gap-1">
                  <span title={`${numero(item.entradas)} em entradas`} className="w-2.5 min-h-0 bg-emerald-600" style={{ height: `${(item.entradas / maiorFluxo) * 100}%` }} />
                  <span title={`${numero(item.saidas)} em saídas`} className="w-2.5 min-h-0 bg-amber-500" style={{ height: `${(item.saidas / maiorFluxo) * 100}%` }} />
                  <span title={`${numero(item.transferencias)} em transferências`} className="w-2.5 min-h-0 bg-slate-400" style={{ height: `${(item.transferencias / maiorFluxo) * 100}%` }} />
                </div>
                <span className="pb-2 text-[9px] font-bold tabular-nums text-slate-400">{item.label}</span>
              </div>
            ))}
          </div>
        </article>
      </section>}

      {/* Carga que a nota prometeu e não chegou é nota paga sem material na
          obra. Fica antes do estoque porque é a conversa mais cara. */}
      {painelOperacionalVisivel && pendencias.length > 0 && (
        <section id="recebimentos-pendentes" className="mt-4 overflow-hidden rounded-lg border border-rose-200 bg-white">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-200 bg-rose-50 px-4 py-3">
            <p className="flex items-center gap-2 text-xs font-bold text-rose-900">
              <PackageX className="h-4 w-4 shrink-0 text-rose-600" />
              {pendencias.length} entrega(s) com carga faltando
            </p>
            <span className="text-[11px] font-bold text-rose-800">
              {recebimento.percentualRecebido}% do que as notas prometeram já chegou
            </span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-[#fafcfb] text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-3">Material</th>
                  <th className="p-3">SC / Nota</th>
                  <th className="p-3">Aplicação</th>
                  <th className="p-3 text-right">Nota</th>
                  <th className="p-3 text-right">Recebido</th>
                  <th className="p-3 text-right">Falta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendencias.map(item => (
                  <tr key={item.movimentoId} data-linha-lista>
                    <td className="p-3">
                      <strong className="block font-bold text-slate-900">{item.material}</strong>
                      <span className="text-[11px] text-slate-500">{item.data.split('-').reverse().join('/')}</span>
                    </td>
                    <td className="p-3 text-slate-600">
                      {[item.solicitacaoCompra, item.notaFiscal && `NF ${item.notaFiscal}`].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="p-3 text-slate-600">{item.destino || '—'}</td>
                    <td className="p-3 text-right tabular-nums text-slate-700">{item.quantidadeNota.toLocaleString('pt-BR')}</td>
                    <td className="p-3 text-right tabular-nums text-slate-700">{item.quantidadeRecebida.toLocaleString('pt-BR')}</td>
                    <td className="p-3 text-right font-black tabular-nums text-rose-700">
                      {item.faltante.toLocaleString('pt-BR')} {item.unidade}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {painelOperacionalVisivel && abaixoDoMinimo.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            {abaixoDoMinimo.length} material(is) abaixo do estoque mínimo
          </p>
          <p className="mt-1 text-[11px] text-amber-800">
            {abaixoDoMinimo.slice(0, 6).map(item => `${item.material.descricao} (${numero(item.saldo)} ${item.material.unidade})`).join(' · ')}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-stretch gap-2">
        <div className="flex flex-1 gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {([['resumo', 'Resumo atual'], ['utilizacao', 'Utilização por Ramo'], ['estoque', 'Estoque'], ['movimentos', 'Movimentos']] as const).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAba(id)}
              aria-pressed={aba === id}
              className={`min-h-10 flex-1 rounded-md text-xs font-bold transition-colors ${aba === id ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {rotulo}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {([['cadastro', 'Cadastro'], ['importacoes', 'Importações']] as const).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAba(id)}
              aria-pressed={aba === id}
              className={`min-h-10 rounded-md px-4 text-xs font-bold transition-colors ${aba === id ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-200'}`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {aba === 'resumo' ? (
        <section className="mt-3 space-y-3" aria-label="Resumo atual de materiais">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="grid gap-2 md:grid-cols-6">
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Início
                <input type="date" value={periodo.from} onChange={event => setPeriodo({ ...periodo, from: event.target.value })} className="mt-1 min-h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500" />
              </label>
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Fim
                <input type="date" value={periodo.to} onChange={event => setPeriodo({ ...periodo, to: event.target.value })} className="mt-1 min-h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500" />
              </label>
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Material
                <select value={filtrosResumo.material} onChange={event => setFiltrosResumo({ ...filtrosResumo, material: event.target.value })} className="mt-1 min-h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500">
                  <option value="">Todos</option>
                  {materiaisResumo.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Fornecedor
                <select value={filtrosResumo.fornecedor} onChange={event => setFiltrosResumo({ ...filtrosResumo, fornecedor: event.target.value })} className="mt-1 min-h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500">
                  <option value="">Todos</option>
                  {fornecedoresResumo.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Local
                <input list="materiais-locais-resumo" value={filtrosResumo.local} onChange={event => setFiltrosResumo({ ...filtrosResumo, local: event.target.value })} placeholder="Ramo, base, estoque..." className="mt-1 min-h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500" />
                <datalist id="materiais-locais-resumo">{locaisResumo.map(item => <option key={item} value={item} />)}</datalist>
              </label>
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Tipo
                <select value={filtrosResumo.tipo} onChange={event => setFiltrosResumo({ ...filtrosResumo, tipo: event.target.value })} className="mt-1 min-h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500">
                  <option value="">Todos</option>
                  {TIPOS.map(item => <option key={item}>{item}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <p className="text-xs font-bold text-slate-500">
                {resumoOperacional.filteredMovements.length} lançamento(s) no período · {numero(resumoOperacional.totals.quantidade)} em quantidade · {moeda(resumoOperacional.totals.valorTotal)}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setPeriodo(getDefaultMaterialsPeriod(hoje))} className="min-h-9 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:border-emerald-500 hover:text-emerald-700">Mês atual</button>
                <button type="button" onClick={() => setFiltrosResumo({ material: '', fornecedor: '', local: '', tipo: '' })} className="min-h-9 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:border-emerald-500 hover:text-emerald-700">Limpar filtros</button>
                <button type="button" onClick={exportarResumoCsv} disabled={resumoOperacional.filteredMovements.length === 0} className="inline-flex min-h-9 items-center gap-2 rounded-md bg-emerald-700 px-3 text-xs font-bold text-white disabled:opacity-40"><FileSpreadsheet className="h-4 w-4" /> Exportar CSV</button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <article className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Resumo atual</p>
                  <h2 className="text-sm font-black text-slate-950">Materiais no período</h2>
                </div>
                <BarChart3 className="h-5 w-5 text-slate-400" />
              </header>
              <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                {resumoOperacional.materials.slice(0, 12).map(item => {
                  const ativo = normalizeComparable(filtrosResumo.material) === normalizeComparable(item.material);
                  const { Icon, tone } = materialVisual(item.material);
                  const materialDoCard = materiais.find(material => normalizeComparable(material.descricao) === normalizeComparable(item.material));
                  return (
                    <button
                      key={item.material}
                      type="button"
                      onClick={() => setFiltrosResumo({ ...filtrosResumo, material: ativo ? '' : item.material })}
                      onDoubleClick={() => materialDoCard && abrirCadastro(materialDoCard)}
                      title={podeEditar ? 'Clique para filtrar. Duplo clique para editar o cadastro.' : 'Clique para filtrar.'}
                      className={`rounded-lg border p-3 text-left transition-colors ${ativo ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-300'}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border ${tone}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[11px] font-black uppercase tracking-wide text-slate-500">{item.material}</span>
                          <span className="block text-[10px] font-bold text-slate-400">tipo operacional</span>
                        </span>
                      </span>
                      <strong className="mt-1 block text-xl font-black tabular-nums text-slate-950">{numero(item.quantidade)} {item.unidade}</strong>
                      {(item.toneladas > 0 || item.metrosCubicos > 0) && (
                        <span className="mt-1 block text-[11px] font-bold text-emerald-700">
                          {[
                            item.toneladas > 0 ? `${numero(item.toneladas)} t` : null,
                            item.metrosCubicos > 0 ? `${numero(item.metrosCubicos)} m³` : null,
                            item.densidadeMedia ? `dens. ${item.densidadeMedia.toFixed(2)}` : null,
                          ].filter(Boolean).join(' · ')}
                        </span>
                      )}
                      <span className="mt-1 block text-[11px] font-bold text-slate-500">
                        {item.viagens} viagem(ns) · {item.custoMedio ? `${moeda(item.custoMedio)}/un` : 'sem custo'}
                      </span>
                      {podeEditar && materialDoCard && <span className="mt-2 block text-[10px] font-black uppercase tracking-wide text-emerald-700">duplo clique edita</span>}
                    </button>
                  );
                })}
                {resumoOperacional.materials.length === 0 && <EmptyState icon={Package} title="Sem lançamentos no período" description="Ajuste os filtros ou registre novos movimentos." />}
              </div>
            </article>

            <article className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Fornecedores</p>
                  <h2 className="text-sm font-black text-slate-950">Volume e custo</h2>
                </div>
                <Truck className="h-5 w-5 text-slate-400" />
              </header>
              <div className="divide-y divide-slate-100">
                {resumoOperacional.suppliers.slice(0, 8).map(item => (
                  <button key={item.fornecedor} type="button" onClick={() => setFiltrosResumo({ ...filtrosResumo, fornecedor: item.fornecedor })} className="grid w-full grid-cols-[1fr_auto] gap-3 px-4 py-3 text-left hover:bg-slate-50">
                    <span className="min-w-0">
                      <strong className="block truncate text-sm text-slate-900">{item.fornecedor}</strong>
                      <span className="text-[11px] font-bold text-slate-500">{item.viagens} viagem(ns)</span>
                    </span>
                    <span className="text-right">
                      <strong className="block font-mono text-sm text-slate-900">{numero(item.quantidade)}</strong>
                      <span className="text-[11px] font-bold text-emerald-700">{moeda(item.valorTotal)}</span>
                    </span>
                  </button>
                ))}
                {resumoOperacional.suppliers.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Sem fornecedor no filtro atual.</p>}
              </div>
            </article>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <article className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <header className="border-b border-slate-200 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Local x material</p>
                <h2 className="text-sm font-black text-slate-950">Totais por frente, estoque ou base</h2>
              </header>
              <TableShell minWidth={680}>
                <TableHead>
                  <tr>
                    <th className="p-3">Local</th>
                    <th className="p-3">Material</th>
                    <th className="p-3 text-right">Quantidade</th>
                    <th className="p-3 text-right">Custo</th>
                  </tr>
                </TableHead>
                <TableBody>
                  {resumoOperacional.locations.slice(0, 14).map(item => (
                    <tr key={`${item.local}-${item.material}`} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-800">{item.local}</td>
                      <td className="p-3 text-slate-600">{item.material}</td>
                      <td className="p-3 text-right font-mono text-slate-900">{numero(item.quantidade)} {item.unidade}</td>
                      <td className="p-3 text-right font-mono text-emerald-700">{moeda(item.valorTotal)}</td>
                    </tr>
                  ))}
                </TableBody>
              </TableShell>
            </article>

            <article className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <header className="border-b border-slate-200 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Viagens</p>
                <h2 className="text-sm font-black text-slate-950">Bota-fora e solo</h2>
              </header>
              <TableShell minWidth={560}>
                <TableHead>
                  <tr>
                    <th className="p-3">Local</th>
                    <th className="p-3 text-right">Lixo</th>
                    <th className="p-3 text-right">Solo contaminado</th>
                    <th className="p-3 text-right">Solo</th>
                  </tr>
                </TableHead>
                <TableBody>
                  {resumoOperacional.trips.slice(0, 12).map(item => (
                    <tr key={item.local} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-800">{item.local}</td>
                      <td className="p-3 text-right font-mono text-slate-900">{numero(item.lixo)}</td>
                      <td className="p-3 text-right font-mono text-slate-900">{numero(item.soloContaminado)}</td>
                      <td className="p-3 text-right font-mono text-slate-900">{numero(item.solo)}</td>
                    </tr>
                  ))}
                </TableBody>
              </TableShell>
              {resumoOperacional.trips.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Nenhuma viagem de bota-fora/solo encontrada no filtro atual.</p>}
            </article>
          </div>
        </section>
      ) : aba === 'utilizacao' ? (
        <MateriaisUtilizacaoPanel
          materiais={ativos}
          movimentos={movimentos}
          etapas={etapas}
          responsavel={responsavel}
          podeEditar={podeEditar}
          onSaveMovimentos={onSaveMovimentos}
          onUpdateMovimentos={onUpdateMovimentos}
        />
      ) : aba !== 'importacoes' && <><FilterBar label="Filtros de materiais" className="mt-3"><label className="relative block min-w-48 flex-1">

        <span className="sr-only">Buscar material</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={busca}
          onChange={event => setBusca(event.target.value)}
          placeholder="Código, descrição, categoria, fornecedor ou nota"
          className="min-h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-500"
        />
      </label></FilterBar>

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {aba === 'movimentos' ? (
          movimentosFiltrados.length === 0 ? (
            <EmptyState icon={Boxes} title="Nenhum movimento" description="Registre entradas, saídas, transferências e ajustes." />
          ) : (<>
            <TableShell minWidth={980}>
              <TableHead>
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Material</th>
                  <th className="p-3">Quantidade</th>
                  <th className="p-3">Origem / Destino</th>
                  <th className="p-3">Fornecedor / Nota</th>
                  <th className="p-3">Responsável</th>
                </tr>
              </TableHead>
              <TableBody>
                {movimentosFiltrados.slice(0, limiteMovimentos).map(item => (
                  <tr key={item.id} data-linha-lista className="transition-colors hover:bg-slate-50">
                    <td className="p-3 text-slate-600">{formatarData(item.data)}</td>
                    <td className="p-3">
                      <Badge tone={item.tipo === 'Entrada' ? 'success' : item.tipo === 'Saída' ? 'danger' : 'neutral'}>{item.tipo}</Badge>
                    </td>
                    <td className="p-3 font-bold text-slate-800">{item.materialDescricao}</td>
                    <td className="p-3 font-mono text-slate-900">{numero(item.quantidade)} {item.unidade}</td>
                    <td className="p-3 text-slate-600">{[item.origem, item.destino].filter(Boolean).join(' → ') || '—'}</td>
                    <td className="p-3 text-slate-600">{[item.fornecedorNome, item.notaFiscal && `NF ${item.notaFiscal}`].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="p-3 text-slate-600">{item.responsavel}</td>
                  </tr>
                ))}
              </TableBody>
            </TableShell>
            {movimentosFiltrados.length > limiteMovimentos && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
                <p className="text-xs font-semibold text-slate-600">
                  Mostrando os {numero(limiteMovimentos)} mais recentes de {numero(movimentosFiltrados.length)}. Use a busca para achar um movimento.
                </p>
                <button type="button" onClick={() => setLimiteMovimentos(atual => atual + PASSO_MOVIMENTOS)} className="min-h-10 rounded-md border border-slate-300 bg-white px-4 text-xs font-black text-slate-700 hover:border-emerald-500 hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f26a2e]/60">
                  Mostrar mais {PASSO_MOVIMENTOS}
                </button>
              </div>
            )}
          </>)
        ) : posicoesFiltradas.length === 0 ? (
          <EmptyState icon={Package} title="Nenhum material cadastrado" description="Cadastre os materiais que a obra usa." />
        ) : (
          <DataTable
            caption={aba === 'estoque' ? 'Posição de estoque por material' : 'Cadastro de materiais'}
            rows={posicoesFiltradas}
            columns={posicaoColumns}
            getRowId={item => item.material.id}
            minWidth={aba === 'cadastro' ? 900 : 760}
          />
        )}
      </div></>}

      {aba === 'importacoes' && podeEditar && <MateriaisImportacoesPanel materiais={materiais} movimentos={movimentos} responsavel={responsavel} etapas={etapas} onApply={onApplyImport} onError={setErro} />}

      <Modal
        open={materialAberto}
        title={formMaterial ? `Editar ${formMaterial.descricao}` : 'Novo material'}
        onSubmit={salvarMaterial}
        size="md"
        onClose={() => setMaterialAberto(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setMaterialAberto(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={salvarMaterial} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Salvar material</button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            Código
            <input value={cadastro.codigo} onChange={event => setCadastro({ ...cadastro, codigo: event.target.value })} placeholder="Ex: BR-01" className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Unidade
            <select value={cadastro.unidade} onChange={event => setCadastro({ ...cadastro, unidade: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500">
              {UNIDADES.map(item => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Descrição
            <input value={cadastro.descricao} onChange={event => setCadastro({ ...cadastro, descricao: event.target.value })} placeholder="Ex: Brita 1" className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Categoria
            <input value={cadastro.categoria} onChange={event => setCadastro({ ...cadastro, categoria: event.target.value })} placeholder="Ex: Agregado" className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Estoque mínimo
            <input type="number" min="0" step="0.001" value={cadastro.estoqueMinimo} onChange={event => setCadastro({ ...cadastro, estoqueMinimo: Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Diâmetro (mm)
            <input inputMode="decimal" placeholder="Ex: 800" value={cadastro.diametroMm} onChange={event => setCadastro({ ...cadastro, diametroMm: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Comprimento (m)
            <input inputMode="decimal" placeholder="Ex: 1,50" value={cadastro.comprimentoM} onChange={event => setCadastro({ ...cadastro, comprimentoM: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Fornecedor padrão
            <select value={cadastro.fornecedorPadraoId} onChange={event => setCadastro({ ...cadastro, fornecedorPadraoId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Sem fornecedor padrão</option>
              {empresas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Observação
            <textarea value={cadastro.observacao} onChange={event => setCadastro({ ...cadastro, observacao: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
        </div>
        {erro && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-700">{erro}</p>}
      </Modal>

      <Modal
        open={movimentoAberto}
        title="Movimentar material"
        size="md"
        onSubmit={salvarMovimento}
        onClose={() => setMovimentoAberto(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setMovimentoAberto(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={salvarMovimento} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Registrar <span className="ml-1 text-[10px] text-emerald-100">Ctrl+Enter</span></button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            Data
            <input type="date" value={movimento.data} onChange={event => setMovimento({ ...movimento, data: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Tipo
            <select value={movimento.tipo} onChange={event => {
              const tipo = event.target.value as TipoMovimentoMaterial;
              setMovimento({ ...movimento, tipo, finalidade: tipo === 'Saída' ? movimento.finalidade : undefined });
            }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500">
              {TIPOS.map(item => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Material
            <select value={movimento.materialId} onChange={event => setMovimento({ ...movimento, materialId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Selecione</option>
              {ativos.map(item => <option key={item.id} value={item.id}>{item.descricao}{item.codigo ? ` · ${item.codigo}` : ''}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Quantidade{movimento.tipo === 'Ajuste' ? ' (use sinal negativo para baixar)' : ''}
            <input type="number" step="0.001" value={movimento.quantidade} onChange={event => setMovimento({ ...movimento, quantidade: Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Fator / densidade
            <input type="number" min="0" step="0.001" value={movimento.fatorConversao} onChange={event => setMovimento({ ...movimento, fatorConversao: Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Placa
            <input value={movimento.placa} onChange={event => setMovimento({ ...movimento, placa: event.target.value.toUpperCase() })} placeholder="UFW-0D22" className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Ticket / vale
            <input value={movimento.ticket} onChange={event => setMovimento({ ...movimento, ticket: event.target.value })} placeholder="173353" className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Valor unitário
            <input type="number" min="0" step="0.01" value={movimento.valorUnitario || ''} onChange={event => setMovimento({ ...movimento, valorUnitario: Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Valor total
            <input type="number" min="0" step="0.01" value={movimento.valorTotal || ''} onChange={event => setMovimento({ ...movimento, valorTotal: Number(event.target.value) })} placeholder={movimento.valorUnitario && movimento.quantidade ? String((movimento.valorUnitario * movimento.quantidade).toFixed(2)) : ''} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          {movimento.tipo === 'Entrada' && (
            <>
              <label className="text-xs font-bold text-slate-600">
                Nota fiscal
                <input value={movimento.notaFiscal} onChange={event => setMovimento({ ...movimento, notaFiscal: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
              </label>
              <label className="text-xs font-bold text-slate-600">
                Quantidade na nota
                <input
                  type="number" min="0" step="0.01" inputMode="decimal"
                  value={movimento.quantidadeNota || ''}
                  onChange={event => setMovimento({ ...movimento, quantidadeNota: Number(event.target.value) })}
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500"
                />
                <span className="mt-1 block text-[11px] font-medium text-slate-400">
                  O que a nota promete. A quantidade acima é o que de fato chegou — a diferença vira pendência.
                </span>
              </label>
              <label className="text-xs font-bold text-slate-600">
                Solicitação de compra
                <input value={movimento.solicitacaoCompra} onChange={event => setMovimento({ ...movimento, solicitacaoCompra: event.target.value })} placeholder="SC 93011249" className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
              </label>
              <label className="text-xs font-bold text-slate-600 sm:col-span-2">
                Fornecedor
                <select value={movimento.fornecedorId} onChange={event => setMovimento({ ...movimento, fornecedorId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500">
                  <option value="">Sem fornecedor informado</option>
                  {empresas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
              </label>
            </>
          )}
          {movimento.tipo === 'Transferência' && (
            <label className="text-xs font-bold text-slate-600">
              Origem
              <input value={movimento.origem} onChange={event => setMovimento({ ...movimento, origem: event.target.value })} placeholder="De onde saiu" className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
            </label>
          )}
          {movimento.tipo !== 'Ajuste' && (
            <label className="text-xs font-bold text-slate-600">
              Destino / frente
              <input value={movimento.destino} onChange={event => setMovimento({ ...movimento, destino: event.target.value })} placeholder="Ex: Ramo 200" className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
            </label>
          )}
          {movimento.tipo !== 'Ajuste' && (
            <label className="text-xs font-bold text-slate-600">
              Ramo / trecho vinculado
              <select value={movimento.etapaServicoId} onChange={event => {
                const etapa = etapas.find(item => item.id === event.target.value);
                setMovimento({ ...movimento, etapaServicoId: event.target.value, destino: etapa?.nome || movimento.destino });
              }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500">
                <option value="">Sem vínculo estruturado</option>
                {etapas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
              <span className="mt-1 block text-[11px] font-medium text-slate-400">Somente este vínculo entra no percentual de utilização.</span>
            </label>
          )}
          {movimento.tipo === 'Saída' && (
            <label className="text-xs font-bold text-slate-600">
              Serviço
              <input value={movimento.servico} onChange={event => setMovimento({ ...movimento, servico: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
            </label>
          )}
          {movimento.tipo === 'Saída' && (
            <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={movimento.finalidade === 'Consumo'}
                onChange={event => setMovimento({ ...movimento, finalidade: event.target.checked ? 'Consumo' : undefined })}
                className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
              />
              Contabilizar esta saída como uso diário aprovado do ramo
            </label>
          )}
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Observação
            <textarea value={movimento.observacao} onChange={event => setMovimento({ ...movimento, observacao: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
        </div>
        {movimento.materialId && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            {movimento.tipo === 'Saída' ? <ArrowUpFromLine className="h-4 w-4 text-rose-600" /> : <ArrowDownToLine className="h-4 w-4 text-emerald-600" />}
            Saldo atual: <strong>{numero(saldoAtualDoForm)}</strong>
          </p>
        )}
        {erro && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-700">{erro}</p>}
      </Modal>

      <Modal
        open={loteAberto}
        title="Lançamento em lote"
        description="Uma linha por viagem ou movimento. Linhas vazias são ignoradas."
        size="xl"
        onSubmit={salvarLote}
        onClose={() => setLoteAberto(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={() => setLinhasLote(linhas => [...linhas, novaLinhaLote()])} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:border-emerald-500 hover:text-emerald-700">
              <Plus className="h-4 w-4" /> Adicionar linha
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setLoteAberto(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
              <button type="button" onClick={salvarLote} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Salvar lote <span className="ml-1 text-[10px] text-emerald-100">Ctrl+Enter</span></button>
            </div>
          </div>
        )}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-2">Data</th>
                <th className="p-2">Material</th>
                <th className="p-2">Tipo</th>
                <th className="p-2">Qtd.</th>
                <th className="p-2">Fator</th>
                <th className="p-2">Fornecedor</th>
                <th className="p-2">Placa</th>
                <th className="p-2">Ticket</th>
                <th className="p-2">Destino/local</th>
                <th className="p-2">Vl. unit.</th>
                <th className="p-2">Vl. total</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhasLote.map((linha, index) => {
                const material = materiais.find(item => item.id === linha.materialId);
                const totalSugerido = Number(linha.valorTotal) > 0 ? linha.valorTotal : Number(linha.valorUnitario || 0) * Number(linha.quantidade || 0);
                return (
                  <tr key={index} data-linha-lista className="hover:bg-slate-50">
                    <td className="p-2"><input type="date" value={linha.data} onChange={event => atualizarLinhaLote(index, 'data', event.target.value)} className="h-9 w-32 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-emerald-500" /></td>
                    <td className="p-2">
                      <select value={linha.materialId} onChange={event => atualizarLinhaLote(index, 'materialId', event.target.value)} className="h-9 w-52 rounded-md border border-slate-200 px-2 text-xs font-semibold outline-none focus:border-emerald-500">
                        <option value="">Selecione</option>
                        {ativos.map(item => <option key={item.id} value={item.id}>{item.descricao}</option>)}
                      </select>
                    </td>
                    <td className="p-2">
                      <select value={linha.tipo} onChange={event => atualizarLinhaLote(index, 'tipo', event.target.value as TipoMovimentoMaterial)} className="h-9 w-32 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-emerald-500">
                        {TIPOS.map(item => <option key={item}>{item}</option>)}
                      </select>
                    </td>
                    <td className="p-2"><input type="number" step="0.001" value={linha.quantidade || ''} onChange={event => atualizarLinhaLote(index, 'quantidade', Number(event.target.value))} className="h-9 w-28 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-emerald-500" /></td>
                    <td className="p-2"><input type="number" step="0.001" value={linha.fatorConversao || ''} onChange={event => atualizarLinhaLote(index, 'fatorConversao', Number(event.target.value))} className="h-9 w-24 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-emerald-500" /></td>
                    <td className="p-2">
                      <select value={linha.fornecedorId} onChange={event => atualizarLinhaLote(index, 'fornecedorId', event.target.value)} className="h-9 w-44 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-emerald-500">
                        <option value="">Sem fornecedor</option>
                        {empresas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                      </select>
                    </td>
                    <td className="p-2"><input value={linha.placa} onChange={event => atualizarLinhaLote(index, 'placa', event.target.value.toUpperCase())} className="h-9 w-28 rounded-md border border-slate-200 px-2 text-xs uppercase outline-none focus:border-emerald-500" /></td>
                    <td className="p-2"><input value={linha.ticket} onChange={event => atualizarLinhaLote(index, 'ticket', event.target.value)} className="h-9 w-28 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-emerald-500" /></td>
                    <td className="p-2"><input value={linha.destino} onChange={event => atualizarLinhaLote(index, 'destino', event.target.value)} placeholder="BASE DE REFORCO 1300" className="h-9 w-56 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-emerald-500" /></td>
                    <td className="p-2"><input type="number" step="0.01" value={linha.valorUnitario || ''} onChange={event => atualizarLinhaLote(index, 'valorUnitario', Number(event.target.value))} className="h-9 w-24 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-emerald-500" /></td>
                    <td className="p-2"><input type="number" step="0.01" value={linha.valorTotal || ''} onChange={event => atualizarLinhaLote(index, 'valorTotal', Number(event.target.value))} placeholder={totalSugerido ? totalSugerido.toFixed(2) : ''} className="h-9 w-28 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-emerald-500" /></td>
                    <td className="p-2 text-right">
                      <button type="button" onClick={() => setLinhasLote(linhas => linhas.length > 1 ? linhas.filter((_, linhaIndex) => linhaIndex !== index) : linhas)} disabled={linhasLote.length === 1} className="rounded-md p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40" title="Remover linha">
                        <X className="h-4 w-4" />
                      </button>
                      {material && <span className="sr-only">{material.unidade}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {erro && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-700">{erro}</p>}
      </Modal>
    </div>
  );
}
