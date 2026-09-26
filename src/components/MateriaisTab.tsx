/**
 * Materiais: cadastro, movimentação e estoque. O saldo é sempre a soma dos
 * movimentos — não existe contador guardado para divergir do histórico.
 */
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ArrowDownToLine, ArrowUpFromLine, Layers, PackagePlus, Plus, Search, X } from 'lucide-react';
import type { Empresa, EtapaServico, Material, MovimentoMaterial, TipoMovimentoMaterial } from '../types';
import { posicaoEstoque, saldoDoMaterial, validarMovimento, type PosicaoEstoque } from '../utils/estoque';
import { normalizeComparable } from '../utils/canonicalIdentity';
import { numero } from '../utils/formato';
import MateriaisImportacoesPanel from './MateriaisImportacoesPanel';
import MateriaisUtilizacaoPanel from './MateriaisUtilizacaoPanel';
import MateriaisSecoes, { nomeDaSecao, type SecaoMateriais } from './materiais/MateriaisSecoes';
import MateriaisVisaoGeral from './materiais/MateriaisVisaoGeral';
import { CartoesMateriais, ListaMovimentos } from './materiais/MateriaisListas';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, FOCO } from './cadastros/estilos';
import './materiais/Materiais.css';
import {
  DataTable,
  FilterBar,
  Modal,
  PageHeader,
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
  const [aba, setAba] = useState<SecaoMateriais>('resumo');
  const [busca, setBusca] = useState('');
  const escopoMotion = useEntradaDeLista<HTMLDivElement>([busca, aba]);
  const [erro, setErro] = useState('');
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
  // A busca olha os 11 mil movimentos: a digitação vem primeiro, a lista acompanha.
  const termo = normalizeComparable(useDeferredValue(busca)).trim();
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
    setAba('movimentos');
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
          <button type="button" onClick={() => abrirCadastro(item.material)} className={`min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition duration-200 hover:border-emerald-500 hover:text-[#176b4d] ${FOCO}`}>Editar</button>
          <button type="button" onClick={() => excluirMaterial(item.material)} className={`min-h-10 rounded-lg border border-rose-200 px-3 text-sm font-semibold text-rose-700 transition duration-200 hover:bg-rose-50 ${FOCO}`}>Excluir</button>
        </div>
      ),
    });
  }

  const secoes: SecaoMateriais[] = podeEditar
    ? ['resumo', 'utilizacao', 'estoque', 'movimentos', 'cadastro', 'importacoes']
    : ['resumo', 'utilizacao', 'estoque', 'movimentos', 'cadastro'];
  const contar = (secao: SecaoMateriais) => {
    if (secao === 'estoque' || secao === 'cadastro') return ativos.length;
    if (secao === 'movimentos') return movimentos.length;
    return null;
  };
  const escolherSecao = (secao: SecaoMateriais) => {
    setAba(secao);
    setBusca('');
  };
  const comBusca = aba === 'estoque' || aba === 'movimentos' || aba === 'cadastro';

  // Entrada do cabeçalho, do menu e dos blocos, no passo do Painel e de Cadastros.
  useGSAP(() => {
    const raiz = escopoMotion.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(raiz.querySelectorAll('[data-materiais-reveal]'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'power3.out', clearProps: 'transform,opacity' });
  }, { scope: escopoMotion, dependencies: [aba] });

  const nenhumaJanela = !materialAberto && !movimentoAberto && !loteAberto;

  return (
    <div ref={escopoMotion} id="materiais-tab" data-testid="materiais-tab" className="erp-module erp-module--materiais space-y-4">
      <div data-materiais-reveal>
        <PageHeader
          className="materiais-header"
          eyebrow="Suprimentos"
          title="Materiais"
          description="O que chegou, o que saiu e quanto sobra. O saldo é a soma dos movimentos."
          actions={podeEditar ? (
            <>
              <button type="button" onClick={() => abrirCadastro()} className={BOTAO_SECUNDARIO}>
                <PackagePlus className="size-5" aria-hidden="true" />
                Novo material
              </button>
              <button type="button" onClick={() => { setErro(''); setLoteAberto(true); }} className={BOTAO_SECUNDARIO}>
                <Layers className="size-5" aria-hidden="true" />
                Várias viagens
              </button>
              <button type="button" onClick={abrirMovimento} data-testid="materiais-acao-principal" className={`${BOTAO_PRIMARIO} max-sm:order-first px-5`}>
                <Plus className="size-5" aria-hidden="true" />
                Novo lançamento
              </button>
            </>
          ) : undefined}
        />
      </div>

      {erro && nenhumaJanela && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
          <span>{erro}</span>
          <button type="button" onClick={() => setErro('')} className={`shrink-0 rounded-lg p-1 text-rose-700 hover:bg-rose-100 ${FOCO}`} aria-label="Fechar aviso"><X className="size-5" aria-hidden="true" /></button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start">
        <MateriaisSecoes value={aba} secoes={secoes} contar={contar} onSelect={escolherSecao} />

        <div className="min-w-0 space-y-3">
          {comBusca && (
            <div data-materiais-reveal className="lg:sticky lg:top-0 lg:z-20 lg:-mt-2 lg:bg-white lg:pb-2 lg:pt-2">
              <FilterBar label="Filtros de materiais" className="rounded-2xl border border-slate-200 bg-white p-3">
                <label className="relative block min-w-0 flex-1">
                  <span className="sr-only">Buscar material</span>
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    type="search"
                    value={busca}
                    onChange={event => setBusca(event.target.value)}
                    placeholder={aba === 'movimentos' ? 'Buscar movimento' : `Buscar em ${nomeDaSecao(aba).toLocaleLowerCase('pt-BR')}`}
                    className={`${CAMPO} pl-11`}
                  />
                </label>
              </FilterBar>
            </div>
          )}

          {aba === 'resumo' && (
            <MateriaisVisaoGeral
              hoje={hoje}
              materiais={materiais}
              movimentos={movimentos}
              movimentosVigentes={movimentosVigentes}
              posicoes={posicoes}
              podeEditar={podeEditar}
              onEditarMaterial={abrirCadastro}
            />
          )}

          {aba === 'utilizacao' && (
            <div data-materiais-reveal>
              <MateriaisUtilizacaoPanel
                materiais={ativos}
                movimentos={movimentos}
                etapas={etapas}
                responsavel={responsavel}
                podeEditar={podeEditar}
                onSaveMovimentos={onSaveMovimentos}
                onUpdateMovimentos={onUpdateMovimentos}
              />
            </div>
          )}

          {aba === 'movimentos' && <div data-materiais-reveal><ListaMovimentos movimentos={movimentosFiltrados} chave={termo} /></div>}

          {(aba === 'estoque' || aba === 'cadastro') && (
            <div data-materiais-reveal>
              <div className="hidden md:block">
                <DataTable
                  caption={aba === 'estoque' ? 'Posição de estoque por material' : 'Cadastro de materiais'}
                  rows={posicoesFiltradas}
                  columns={posicaoColumns}
                  getRowId={item => item.material.id}
                  minWidth={aba === 'cadastro' ? 820 : 720}
                  emptyMessage={termo ? 'Nenhum material com essa busca.' : 'Nenhum material cadastrado. Use Novo material.'}
                />
              </div>
              <div className="md:hidden">
                <CartoesMateriais
                  posicoes={posicoesFiltradas}
                  modo={aba}
                  fornecedorDe={item => empresasPorId.get(item.material.fornecedorPadraoId || '') || ''}
                  podeEditar={podeEditar}
                  onEditar={item => abrirCadastro(item.material)}
                  onExcluir={item => excluirMaterial(item.material)}
                />
              </div>
            </div>
          )}

          {aba === 'importacoes' && podeEditar && (
            <MateriaisImportacoesPanel materiais={materiais} movimentos={movimentos} responsavel={responsavel} etapas={etapas} onApply={onApplyImport} onError={setErro} />
          )}
        </div>
      </div>

      <Modal
        open={materialAberto}
        title={formMaterial ? `Editar ${formMaterial.descricao}` : 'Novo material'}
        onSubmit={salvarMaterial}
        size="md"
        onClose={() => setMaterialAberto(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setMaterialAberto(false)} className={BOTAO_SECUNDARIO}>Cancelar</button>
            <button type="button" onClick={salvarMaterial} className={BOTAO_PRIMARIO}>Salvar material</button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">
            Código
            <input value={cadastro.codigo} onChange={event => setCadastro({ ...cadastro, codigo: event.target.value })} placeholder="Ex: BR-01" className={`mt-1 ${CAMPO}`} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Unidade
            <select value={cadastro.unidade} onChange={event => setCadastro({ ...cadastro, unidade: event.target.value })} className={`mt-1 ${CAMPO}`}>
              {UNIDADES.map(item => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
            Descrição
            <input value={cadastro.descricao} onChange={event => setCadastro({ ...cadastro, descricao: event.target.value })} placeholder="Ex: Brita 1" className={`mt-1 ${CAMPO}`} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Categoria
            <input value={cadastro.categoria} onChange={event => setCadastro({ ...cadastro, categoria: event.target.value })} placeholder="Ex: Agregado" className={`mt-1 ${CAMPO}`} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Estoque mínimo
            <input type="number" min="0" step="0.001" value={cadastro.estoqueMinimo} onChange={event => setCadastro({ ...cadastro, estoqueMinimo: Number(event.target.value) })} className={`mt-1 ${CAMPO}`} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Diâmetro (mm)
            <input inputMode="decimal" placeholder="Ex: 800" value={cadastro.diametroMm} onChange={event => setCadastro({ ...cadastro, diametroMm: event.target.value })} className={`mt-1 ${CAMPO}`} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Comprimento (m)
            <input inputMode="decimal" placeholder="Ex: 1,50" value={cadastro.comprimentoM} onChange={event => setCadastro({ ...cadastro, comprimentoM: event.target.value })} className={`mt-1 ${CAMPO}`} />
          </label>
          <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
            Fornecedor padrão
            <select value={cadastro.fornecedorPadraoId} onChange={event => setCadastro({ ...cadastro, fornecedorPadraoId: event.target.value })} className={`mt-1 ${CAMPO}`}>
              <option value="">Sem fornecedor padrão</option>
              {empresas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
            Observação
            <textarea value={cadastro.observacao} onChange={event => setCadastro({ ...cadastro, observacao: event.target.value })} rows={2} className={`mt-1 ${CAMPO} py-2`} />
          </label>
        </div>
        {erro && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-700">{erro}</p>}
      </Modal>

      <Modal
        open={movimentoAberto}
        title="Novo lançamento"
        size="md"
        onSubmit={salvarMovimento}
        onClose={() => setMovimentoAberto(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setMovimentoAberto(false)} className={BOTAO_SECUNDARIO}>Cancelar</button>
            <button type="button" onClick={salvarMovimento} className={BOTAO_PRIMARIO}>Registrar</button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">
            Data
            <input type="date" value={movimento.data} onChange={event => setMovimento({ ...movimento, data: event.target.value })} className={`mt-1 ${CAMPO}`} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Tipo
            <select value={movimento.tipo} onChange={event => {
              const tipo = event.target.value as TipoMovimentoMaterial;
              setMovimento({ ...movimento, tipo, finalidade: tipo === 'Saída' ? movimento.finalidade : undefined });
            }} className={`mt-1 ${CAMPO}`}>
              {TIPOS.map(item => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
            Material
            <select value={movimento.materialId} onChange={event => setMovimento({ ...movimento, materialId: event.target.value })} className={`mt-1 ${CAMPO}`}>
              <option value="">Selecione</option>
              {ativos.map(item => <option key={item.id} value={item.id}>{item.descricao}{item.codigo ? ` · ${item.codigo}` : ''}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Quantidade{movimento.tipo === 'Ajuste' ? ' (use sinal negativo para baixar)' : ''}
            <input type="number" step="0.001" value={movimento.quantidade} onChange={event => setMovimento({ ...movimento, quantidade: Number(event.target.value) })} className={`mt-1 ${CAMPO}`} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Fator / densidade
            <input type="number" min="0" step="0.001" value={movimento.fatorConversao} onChange={event => setMovimento({ ...movimento, fatorConversao: Number(event.target.value) })} className={`mt-1 ${CAMPO}`} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Placa
            <input value={movimento.placa} onChange={event => setMovimento({ ...movimento, placa: event.target.value.toUpperCase() })} placeholder="UFW-0D22" className={`mt-1 ${CAMPO}`} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Ticket / vale
            <input value={movimento.ticket} onChange={event => setMovimento({ ...movimento, ticket: event.target.value })} placeholder="173353" className={`mt-1 ${CAMPO}`} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Valor unitário
            <input type="number" min="0" step="0.01" value={movimento.valorUnitario || ''} onChange={event => setMovimento({ ...movimento, valorUnitario: Number(event.target.value) })} className={`mt-1 ${CAMPO}`} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Valor total
            <input type="number" min="0" step="0.01" value={movimento.valorTotal || ''} onChange={event => setMovimento({ ...movimento, valorTotal: Number(event.target.value) })} placeholder={movimento.valorUnitario && movimento.quantidade ? String((movimento.valorUnitario * movimento.quantidade).toFixed(2)) : ''} className={`mt-1 ${CAMPO}`} />
          </label>
          {movimento.tipo === 'Entrada' && (
            <>
              <label className="block text-sm font-semibold text-slate-700">
                Nota fiscal
                <input value={movimento.notaFiscal} onChange={event => setMovimento({ ...movimento, notaFiscal: event.target.value })} className={`mt-1 ${CAMPO}`} />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Quantidade na nota
                <input
                  type="number" min="0" step="0.01" inputMode="decimal"
                  value={movimento.quantidadeNota || ''}
                  onChange={event => setMovimento({ ...movimento, quantidadeNota: Number(event.target.value) })}
                  className={`mt-1 ${CAMPO}`}
                />
                <span className="mt-1 block text-[11px] font-medium text-slate-400">
                  O que a nota promete. A quantidade acima é o que de fato chegou — a diferença vira pendência.
                </span>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Solicitação de compra
                <input value={movimento.solicitacaoCompra} onChange={event => setMovimento({ ...movimento, solicitacaoCompra: event.target.value })} placeholder="SC 93011249" className={`mt-1 ${CAMPO}`} />
              </label>
              <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
                Fornecedor
                <select value={movimento.fornecedorId} onChange={event => setMovimento({ ...movimento, fornecedorId: event.target.value })} className={`mt-1 ${CAMPO}`}>
                  <option value="">Sem fornecedor informado</option>
                  {empresas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
              </label>
            </>
          )}
          {movimento.tipo === 'Transferência' && (
            <label className="block text-sm font-semibold text-slate-700">
              Origem
              <input value={movimento.origem} onChange={event => setMovimento({ ...movimento, origem: event.target.value })} placeholder="De onde saiu" className={`mt-1 ${CAMPO}`} />
            </label>
          )}
          {movimento.tipo !== 'Ajuste' && (
            <label className="block text-sm font-semibold text-slate-700">
              Destino / frente
              <input value={movimento.destino} onChange={event => setMovimento({ ...movimento, destino: event.target.value })} placeholder="Ex: Ramo 200" className={`mt-1 ${CAMPO}`} />
            </label>
          )}
          {movimento.tipo !== 'Ajuste' && (
            <label className="block text-sm font-semibold text-slate-700">
              Ramo / trecho vinculado
              <select value={movimento.etapaServicoId} onChange={event => {
                const etapa = etapas.find(item => item.id === event.target.value);
                setMovimento({ ...movimento, etapaServicoId: event.target.value, destino: etapa?.nome || movimento.destino });
              }} className={`mt-1 ${CAMPO}`}>
                <option value="">Sem vínculo estruturado</option>
                {etapas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
              <span className="mt-1 block text-[11px] font-medium text-slate-400">Somente este vínculo entra no percentual de utilização.</span>
            </label>
          )}
          {movimento.tipo === 'Saída' && (
            <label className="block text-sm font-semibold text-slate-700">
              Serviço
              <input value={movimento.servico} onChange={event => setMovimento({ ...movimento, servico: event.target.value })} className={`mt-1 ${CAMPO}`} />
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
          <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
            Observação
            <textarea value={movimento.observacao} onChange={event => setMovimento({ ...movimento, observacao: event.target.value })} rows={2} className={`mt-1 ${CAMPO} py-2`} />
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
        title="Lançar várias viagens"
        description="Uma linha por viagem. Linha vazia não é gravada."
        size="xl"
        onSubmit={salvarLote}
        onClose={() => setLoteAberto(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={() => setLinhasLote(linhas => [...linhas, novaLinhaLote()])} className={BOTAO_SECUNDARIO}>
              <Plus className="h-4 w-4" /> Adicionar linha
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setLoteAberto(false)} className={BOTAO_SECUNDARIO}>Cancelar</button>
              <button type="button" onClick={salvarLote} className={BOTAO_PRIMARIO}>Salvar viagens</button>
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
