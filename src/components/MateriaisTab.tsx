/**
 * Materiais: cadastro, movimentação e estoque. O saldo é sempre a soma dos
 * movimentos — não existe contador guardado para divergir do histórico.
 */
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { CheckCircle2, Keyboard, Layers, MapPin, PackagePlus, Plus, Search, Undo2, X } from 'lucide-react';
import type { Empresa, EtapaServico, Material, MovimentoMaterial, TipoMovimentoMaterial } from '../types';
import { posicaoEstoque, type PosicaoEstoque } from '../utils/estoque';
import { cancelMaterialMovement } from '../modules/materials/materialFieldUse';
import { filtrarOpcoes } from '../modules/materials/lancamentoRapido';
import { avisosDeMateriais } from '../modules/materials/avisosMateriais';
import { normalizeComparable } from '../utils/canonicalIdentity';
import { numero } from '../utils/formato';
import MateriaisImportacoesPanel from './MateriaisImportacoesPanel';
import MateriaisUtilizacaoPanel from './MateriaisUtilizacaoPanel';
import MateriaisSecoes, { nomeDaSecao, type SecaoMateriais } from './materiais/MateriaisSecoes';
import MateriaisVisaoGeral from './materiais/MateriaisVisaoGeral';
import { CartoesMateriais, ListaMovimentos } from './materiais/MateriaisListas';
import FormLancamento from './materiais/FormLancamento';
import GradeViagens from './materiais/GradeViagens';
import { BOTAO_PERIGO, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, FOCO } from './cadastros/estilos';
import './materiais/Materiais.css';
import {
  ConfirmDialog,
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

type FiltroTipo = 'todos' | TipoMovimentoMaterial | 'desfeitos';
const FILTROS_TIPO: ReadonlyArray<{ id: FiltroTipo; nome: string }> = [
  { id: 'todos', nome: 'Todos' },
  { id: 'Entrada', nome: 'Entradas' },
  { id: 'Saída', nome: 'Saídas' },
  { id: 'Transferência', nome: 'Transportes' },
  { id: 'Ajuste', nome: 'Ajustes' },
  { id: 'desfeitos', nome: 'Desfeitos' },
];

// Números do teclado levam direto a cada parte, na ordem do menu.
const ORDEM_SECOES: readonly SecaoMateriais[] = ['resumo', 'utilizacao', 'estoque', 'movimentos', 'cadastro', 'importacoes'];

const ATALHOS: ReadonlyArray<{ teclas: string; oQueFaz: string; editar?: boolean }> = [
  { teclas: 'N', oQueFaz: 'Novo lançamento', editar: true },
  { teclas: 'V', oQueFaz: 'Várias viagens de uma vez', editar: true },
  { teclas: 'M', oQueFaz: 'Novo material', editar: true },
  { teclas: '/', oQueFaz: 'Buscar movimento' },
  { teclas: '1 a 6', oQueFaz: 'Ir para cada parte do menu' },
  { teclas: 'Shift+Enter', oQueFaz: 'Na janela de lançamento: salvar e lançar outro', editar: true },
  { teclas: 'Enter', oQueFaz: 'Na grade de viagens: descer para a linha de baixo', editar: true },
  { teclas: '?', oQueFaz: 'Mostrar esta lista' },
];

const Tecla = ({ children }: { children: string }) => (
  <kbd className="hidden rounded border border-current/30 px-1.5 text-xs font-semibold opacity-70 lg:inline">{children}</kbd>
);
const UNIDADES = ['m³', 't', 'kg', 'un', 'm', 'm²', 'L', 'sc'];


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
  const [cadastro, setCadastro] = useState({ codigo: '', descricao: '', categoria: '', unidade: 'm³', estoqueMinimo: 0, fornecedorPadraoId: '', observacao: '', diametroMm: '', comprimentoM: '' });
  const [avisoMaterial, setAvisoMaterial] = useState('');
  const [lancamentoAberto, setLancamentoAberto] = useState(false);
  const [editandoMovimento, setEditandoMovimento] = useState<MovimentoMaterial | null>(null);
  const [viagensAberto, setViagensAberto] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(() => new Set());
  const [trocarRamoAberto, setTrocarRamoAberto] = useState(false);
  const [trocaRamo, setTrocaRamo] = useState({ etapaServicoId: '', destino: '' });
  const [desfazerAberto, setDesfazerAberto] = useState(false);
  const [atalhosAberto, setAtalhosAberto] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);
  const descricaoRef = useRef<HTMLInputElement>(null);
  const focarBusca = useRef(false);

  const ativos = useMemo(() => materiais.filter(item => item.ativo !== false), [materiais]);
  // Uso desfeito fica na lista de movimentos, marcado; resumo e gráficos não somam ele.
  const movimentosVigentes = useMemo(() => movimentos.filter(item => !item.canceladoEm), [movimentos]);
  const posicoes = useMemo(() => posicaoEstoque(ativos, movimentos), [ativos, movimentos]);
  const avisos = useMemo(() => avisosDeMateriais(posicoes, movimentos, hoje), [hoje, movimentos, posicoes]);
  // A busca olha os 11 mil movimentos: a digitação vem primeiro, a lista acompanha.
  const termo = normalizeComparable(useDeferredValue(busca)).trim();
  const posicoesFiltradas = posicoes.filter(item => !termo
    || normalizeComparable(`${item.material.codigo} ${item.material.descricao} ${item.material.categoria}`).includes(termo));
  const movimentosFiltrados = useMemo(() => [...movimentos]
    .filter(item => (filtroTipo === 'todos' || (filtroTipo === 'desfeitos' ? Boolean(item.canceladoEm) : item.tipo === filtroTipo && !item.canceladoEm))
      && (!termo || normalizeComparable(`${item.materialDescricao} ${item.tipo} ${item.destino || ''} ${item.fornecedorNome || ''} ${item.notaFiscal || ''} ${item.placa || ''} ${item.ticket || ''}`).includes(termo)))
    .sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm)), [filtroTipo, movimentos, termo]);

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
    setAvisoMaterial('');
    setMaterialAberto(true);
  };

  const abrirLancamento = (movimento?: MovimentoMaterial) => {
    setErro('');
    setEditandoMovimento(movimento ?? null);
    setLancamentoAberto(true);
  };
  const abrirViagens = () => {
    setErro('');
    setViagensAberto(true);
  };
  const algumaJanela = materialAberto || lancamentoAberto || viagensAberto || trocarRamoAberto || desfazerAberto || atalhosAberto;
  const secoes: SecaoMateriais[] = podeEditar ? [...ORDEM_SECOES] : ORDEM_SECOES.filter(secao => secao !== 'importacoes');
  const escolherSecao = (secao: SecaoMateriais) => {
    setAba(secao);
    setBusca('');
    setMarcados(new Set());
  };

  // Atalhos só fora de campo de texto e com nenhuma janela aberta.
  useEffect(() => {
    if (algumaJanela) return undefined;
    const teclar = (event: KeyboardEvent) => {
      const alvo = event.target as HTMLElement | null;
      if (alvo?.matches('input, textarea, select, [contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey) return;
      const tecla = event.key.toLocaleLowerCase('pt-BR');
      const secao = secoes[Number(tecla) - 1];
      if (/^[1-9]$/.test(tecla) && secao) {
        event.preventDefault();
        escolherSecao(secao);
      } else if (tecla === '/') {
        event.preventDefault();
        focarBusca.current = true;
        if (aba === 'estoque' || aba === 'movimentos' || aba === 'cadastro') buscaRef.current?.focus();
        else escolherSecao('movimentos');
      } else if (tecla === '?') {
        event.preventDefault();
        setAtalhosAberto(true);
      } else if (podeEditar && tecla === 'n') {
        event.preventDefault();
        abrirLancamento();
      } else if (podeEditar && tecla === 'v') {
        event.preventDefault();
        abrirViagens();
      } else if (podeEditar && tecla === 'm') {
        event.preventDefault();
        abrirCadastro();
      }
    };
    window.addEventListener('keydown', teclar);
    return () => window.removeEventListener('keydown', teclar);
  });

  useEffect(() => {
    if (!focarBusca.current) return;
    focarBusca.current = false;
    buscaRef.current?.focus();
  }, [aba]);

  const salvarMaterial = (continuar = false) => {
    if (!cadastro.descricao.trim()) {
      setErro('Informe a descrição do material.');
      return;
    }
    const mesmoNome = ativos.find(item => item.id !== formMaterial?.id && normalizeComparable(item.descricao) === normalizeComparable(cadastro.descricao));
    if (mesmoNome) {
      setErro(`Já existe "${mesmoNome.descricao}" no cadastro. Edite o que existe em vez de cadastrar de novo.`);
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
    setErro('');
    if (continuar && !formMaterial) {
      // Unidade e categoria costumam se repetir numa leva de cadastros.
      setAvisoMaterial(`Cadastrado: ${cadastro.descricao.trim()}. Pode cadastrar o próximo.`);
      setCadastro(atual => ({ ...atual, codigo: '', descricao: '', estoqueMinimo: 0, observacao: '', diametroMm: '', comprimentoM: '' }));
      descricaoRef.current?.focus();
      return;
    }
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

  const salvarLancamento = (movimento: MovimentoMaterial, novo: boolean) => {
    if (novo) onSaveMovimento(movimento);
    else onUpdateMovimentos([movimento], `Editou ${movimento.tipo.toLocaleLowerCase('pt-BR')} de ${movimento.quantidade} ${movimento.unidade} de ${movimento.materialDescricao}.`);
  };

  const alternarMarcado = (id: string) => setMarcados(atual => {
    const proximo = new Set(atual);
    if (proximo.has(id)) proximo.delete(id); else proximo.add(id);
    return proximo;
  });
  const alternarVarios = (ids: string[], marcar: boolean) => setMarcados(atual => {
    const proximo = new Set(atual);
    ids.forEach(id => (marcar ? proximo.add(id) : proximo.delete(id)));
    return proximo;
  });
  const movimentosMarcados = marcados.size ? movimentos.filter(item => marcados.has(item.id)) : [];
  const marcadosValendo = movimentosMarcados.filter(item => !item.canceladoEm);

  // Desfazer não apaga: o lançamento fica no histórico, marcado, e sai do saldo.
  const desfazerMarcados = () => {
    const alterados = marcadosValendo.map(item => cancelMaterialMovement(item, responsavel));
    onUpdateMovimentos(alterados, `Desfez ${alterados.length} lançamento(s) de material de uma vez.`, 'Excluiu');
    setMarcados(new Set());
    setDesfazerAberto(false);
  };

  const trocarRamoDosMarcados = () => {
    const etapa = etapas.find(item => item.id === trocaRamo.etapaServicoId);
    const destino = trocaRamo.destino.trim();
    if (!etapa && !destino) {
      setErro('Escolha o ramo ou escreva o local.');
      return;
    }
    const alterados = movimentosMarcados
      .filter(item => item.tipo !== 'Ajuste')
      .map(item => ({
        ...item,
        ...(etapa ? { etapaServicoId: etapa.id, etapaServicoNome: etapa.nome } : {}),
        destino: destino || item.destino || etapa?.nome,
      }));
    onUpdateMovimentos(alterados, `Mudou ${alterados.length} lançamento(s) de material para ${etapa?.nome || destino}.`);
    setMarcados(new Set());
    setTrocarRamoAberto(false);
    setErro('');
  };

  const parecidos = materialAberto && cadastro.descricao.trim().length >= 3
    ? filtrarOpcoes(ativos.filter(item => item.id !== formMaterial?.id).map(item => ({ id: item.id, nome: item.descricao, apelido: item.codigo })), cadastro.descricao, 3)
    : [];

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

  const contar = (secao: SecaoMateriais) => {
    if (secao === 'estoque' || secao === 'cadastro') return ativos.length;
    if (secao === 'movimentos') return movimentos.length;
    return null;
  };
  const comBusca = aba === 'estoque' || aba === 'movimentos' || aba === 'cadastro';

  // Entrada do cabeçalho, do menu e dos blocos, no passo do Painel e de Cadastros.
  useGSAP(() => {
    const raiz = escopoMotion.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(raiz.querySelectorAll('[data-materiais-reveal]'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'power3.out', clearProps: 'transform,opacity' });
  }, { scope: escopoMotion, dependencies: [aba] });


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
              <button type="button" onClick={() => setAtalhosAberto(true)} className={`${BOTAO_SECUNDARIO} max-lg:hidden`} aria-label="Atalhos do teclado">
                <Keyboard className="size-5" aria-hidden="true" />
                <Tecla>?</Tecla>
              </button>
              <button type="button" onClick={() => abrirCadastro()} className={BOTAO_SECUNDARIO} aria-keyshortcuts="M">
                <PackagePlus className="size-5" aria-hidden="true" />
                Novo material
                <Tecla>M</Tecla>
              </button>
              <button type="button" onClick={abrirViagens} className={BOTAO_SECUNDARIO} aria-keyshortcuts="V" data-testid="materiais-varias-viagens">
                <Layers className="size-5" aria-hidden="true" />
                Várias viagens
                <Tecla>V</Tecla>
              </button>
              <button type="button" onClick={() => abrirLancamento()} data-testid="materiais-acao-principal" aria-keyshortcuts="N" className={`${BOTAO_PRIMARIO} max-sm:order-first px-5`}>
                <Plus className="size-5" aria-hidden="true" />
                Novo lançamento
                <Tecla>N</Tecla>
              </button>
            </>
          ) : undefined}
        />
      </div>

      {erro && !algumaJanela && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
          <span>{erro}</span>
          <button type="button" onClick={() => setErro('')} className={`shrink-0 rounded-lg p-1 text-rose-700 hover:bg-rose-100 ${FOCO}`} aria-label="Fechar aviso"><X className="size-5" aria-hidden="true" /></button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start">
        <MateriaisSecoes value={aba} secoes={secoes} contar={contar} avisos={secao => (secao === 'resumo' ? avisos.length : 0)} onSelect={escolherSecao} />

        <div className="min-w-0 space-y-3">
          {comBusca && (
            <div data-materiais-reveal className="lg:sticky lg:top-0 lg:z-20 lg:-mt-2 lg:bg-white lg:pb-2 lg:pt-2">
              <FilterBar label="Filtros de materiais" className="rounded-2xl border border-slate-200 bg-white p-3">
                <label className="relative block min-w-0 flex-1">
                  <span className="sr-only">Buscar material</span>
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    ref={buscaRef}
                    type="search"
                    aria-keyshortcuts="/"
                    value={busca}
                    onChange={event => setBusca(event.target.value)}
                    placeholder={aba === 'movimentos' ? 'Material, local, fornecedor, nota ou placa' : `Buscar em ${nomeDaSecao(aba).toLocaleLowerCase('pt-BR')}`}
                    className={`${CAMPO} pl-11`}
                  />
                </label>
                {aba === 'movimentos' && (
                  <div role="group" aria-label="Mostrar só" className="flex basis-full gap-2 overflow-x-auto pb-1">
                    {FILTROS_TIPO.map(filtro => (
                      <button
                        key={filtro.id}
                        type="button"
                        aria-pressed={filtroTipo === filtro.id}
                        onClick={() => setFiltroTipo(filtro.id)}
                        className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition duration-200 ${FOCO} ${filtroTipo === filtro.id
                          ? 'border-[#176b4d] bg-[#176b4d] text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500'}`}
                      >
                        {filtro.nome}
                      </button>
                    ))}
                  </div>
                )}
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
              avisos={avisos}
              onEditarMaterial={abrirCadastro}
              onVerMovimentos={termoAviso => { escolherSecao('movimentos'); setFiltroTipo('todos'); setBusca(termoAviso); }}
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

          {aba === 'movimentos' && (
            <div data-materiais-reveal className="space-y-3">
              {podeEditar && marcados.size > 0 && (
                <div role="region" aria-label="Movimentos marcados" data-testid="movimentos-barra-selecao" className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-2 shadow-sm sm:pl-4 lg:top-24">
                  <p className="basis-full px-2 pt-1 text-sm font-bold text-emerald-900 sm:mr-auto sm:basis-auto sm:p-0" aria-live="polite">
                    {marcados.size.toLocaleString('pt-BR')} {marcados.size === 1 ? 'marcado' : 'marcados'}
                  </p>
                  {marcados.size < movimentosFiltrados.length && movimentosFiltrados.length <= 2000 && (
                    <button type="button" onClick={() => alternarVarios(movimentosFiltrados.map(item => item.id), true)} className={`${BOTAO_SECUNDARIO} px-3 max-sm:flex-1`}>
                      Marcar os {movimentosFiltrados.length.toLocaleString('pt-BR')} da busca
                    </button>
                  )}
                  <button type="button" onClick={() => setMarcados(new Set())} className={`${BOTAO_SECUNDARIO} px-3 max-sm:flex-1`}>Desmarcar</button>
                  <button type="button" onClick={() => { setErro(''); setTrocaRamo({ etapaServicoId: '', destino: '' }); setTrocarRamoAberto(true); }} className={`${BOTAO_SECUNDARIO} px-3 max-sm:flex-1`} data-testid="movimentos-trocar-ramo">
                    <MapPin className="size-5" aria-hidden="true" />
                    Mudar ramo ou local
                  </button>
                  <button type="button" onClick={() => setDesfazerAberto(true)} disabled={!marcadosValendo.length} className={`${BOTAO_PERIGO} px-3 max-sm:basis-full`} data-testid="movimentos-desfazer">
                    <Undo2 className="size-5" aria-hidden="true" />
                    Desfazer lançamentos
                  </button>
                </div>
              )}
              <ListaMovimentos
                movimentos={movimentosFiltrados}
                chave={`${termo}|${filtroTipo}`}
                selecao={podeEditar ? { marcados, onAlternar: alternarMarcado, onAlternarVarios: alternarVarios } : undefined}
                onAbrir={podeEditar ? abrirLancamento : undefined}
              />
            </div>
          )}

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
        onSubmit={() => salvarMaterial()}
        size="md"
        onClose={() => setMaterialAberto(false)}
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setMaterialAberto(false)} className={BOTAO_SECUNDARIO}>Cancelar</button>
            {!formMaterial && <button type="button" onClick={() => salvarMaterial(true)} className={BOTAO_SECUNDARIO}>Salvar e cadastrar outro</button>}
            <button type="button" onClick={() => salvarMaterial()} className={BOTAO_PRIMARIO}>Salvar material</button>
          </div>
        )}
      >
        {avisoMaterial && (
          <p role="status" className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#176b4d]" aria-hidden="true" />
            {avisoMaterial}
          </p>
        )}
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
            <input ref={descricaoRef} value={cadastro.descricao} onChange={event => setCadastro({ ...cadastro, descricao: event.target.value })} placeholder="Ex: Brita 1" className={`mt-1 ${CAMPO}`} />
            {parecidos.length > 0 && (
              <span className="mt-1 block text-sm font-normal text-amber-800">
                Já tem parecido: {parecidos.map(item => item.nome).join(', ')}. Confira para não cadastrar duas vezes.
              </span>
            )}
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
        {erro && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{erro}</p>}
      </Modal>

      <FormLancamento
        aberto={lancamentoAberto}
        editando={editandoMovimento}
        hoje={hoje}
        materiais={materiais}
        movimentos={movimentos}
        empresas={empresas}
        etapas={etapas}
        responsavel={responsavel}
        onSalvar={salvarLancamento}
        onFechar={() => setLancamentoAberto(false)}
      />

      <GradeViagens
        aberto={viagensAberto}
        hoje={hoje}
        materiais={materiais}
        movimentos={movimentos}
        empresas={empresas}
        responsavel={responsavel}
        onSalvar={(novos, descricao) => { onSaveMovimentos(novos, descricao); escolherSecao('movimentos'); }}
        onFechar={() => setViagensAberto(false)}
      />

      <Modal
        open={trocarRamoAberto}
        title={`Mudar ramo ou local de ${marcados.size.toLocaleString('pt-BR')} lançamento(s)`}
        description="Ajustes ficam de fora, porque não têm local."
        size="sm"
        onSubmit={trocarRamoDosMarcados}
        onClose={() => setTrocarRamoAberto(false)}
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setTrocarRamoAberto(false)} className={BOTAO_SECUNDARIO}>Cancelar</button>
            <button type="button" onClick={trocarRamoDosMarcados} className={BOTAO_PRIMARIO}>Mudar</button>
          </div>
        )}
      >
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">
            Ramo ou trecho
            <select value={trocaRamo.etapaServicoId} onChange={event => setTrocaRamo({ ...trocaRamo, etapaServicoId: event.target.value })} className={`mt-1 ${CAMPO}`}>
              <option value="">Manter o que está</option>
              {etapas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Local ou frente
            <input value={trocaRamo.destino} onChange={event => setTrocaRamo({ ...trocaRamo, destino: event.target.value })} placeholder="Deixe em branco para manter" className={`mt-1 ${CAMPO}`} />
          </label>
          {erro && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{erro}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={desfazerAberto}
        title={`Desfazer ${marcadosValendo.length.toLocaleString('pt-BR')} lançamento(s)?`}
        description="Eles saem do saldo e da utilização, mas continuam na lista marcados como desfeitos. Para voltar um, abra o lançamento e toque em Voltar a valer."
        confirmLabel="Desfazer"
        onConfirm={desfazerMarcados}
        onCancel={() => setDesfazerAberto(false)}
      />

      <Modal open={atalhosAberto} title="Atalhos do teclado" size="sm" onClose={() => setAtalhosAberto(false)}>
        <dl className="divide-y divide-slate-100">
          {ATALHOS.filter(atalho => podeEditar || !atalho.editar).map(atalho => (
            <div key={atalho.teclas} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-sm text-slate-700">{atalho.oQueFaz}</dt>
              <dd><kbd className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm font-bold text-slate-700">{atalho.teclas}</kbd></dd>
            </div>
          ))}
        </dl>
      </Modal>
    </div>
  );
}
