/**
 * Histórico do diesel no modelo da planilha FORNECIMENTO DIESEL: abre na aba
 * do mês atual (21 a 20), com as mesmas colunas na mesma ordem e do primeiro
 * lançamento para o último, já no fim da lista. Dá para trocar de mês nas
 * abas, ordenar por coluna, escolher colunas, agrupar com subtotal, marcar
 * vários e abrir a ficha ao lado para editar, repetir ou excluir.
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { gsap } from 'gsap';
import {
  ArrowDown, ArrowUp, CalendarDays, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, Columns3, Copy, CopyX, Download, FileSpreadsheet, FileText,
  Filter, History, Layers, ListChecks, Pencil, Search, Square, Trash2, X,
} from 'lucide-react';
import type { Abastecimento, Comboio, Empresa, Equipamento, TipoCombustivel } from '../../types';
import {
  ABA_TUDO, AGRUPAMENTOS_HISTORICO, COLUNAS_HISTORICO, ORDEM_PADRAO, abaDoDia, abasDoHistorico, agruparHistorico, colunasValidas,
  intervaloDaAba, ordenarHistorico, proximaOrdem, type AgrupamentoHistorico, type ColunaHistorico, type ColunaOrdem, type NomesHistorico,
  type OrdemHistorico,
} from '../../modules/frota/historicoCombustivel';
import { getFuelCompetencePeriodLabel } from '../../modules/frota/fuelReport';
import { nomeDoMes, tituloDaAba } from '../../modules/frota/planilhaDiesel';
import { idsRepetidos } from '../../modules/frota/repetidosDiesel';
import { isoDay } from '../../shared/ui';
import { BOTAO_PERIGO_LEVE, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, ROTULO, reduzMovimento } from '../cadastros/estilos';

/** Pedido de filtro vindo de fora (o relatório abre a lista já filtrada). */
export interface PedidoFiltro {
  chave: number;
  dataInicio?: string;
  dataFim?: string;
  equipamentoId?: string;
  comboioId?: string;
  empresaId?: string;
  texto?: string;
  soRepetidos?: boolean;
  soConferir?: boolean;
}

export interface FiltrosExportacao {
  itens: Abastecimento[];
  filtros: string[];
  periodo: string;
}

interface Props {
  abastecimentos: readonly Abastecimento[];
  equipamentos: readonly Equipamento[];
  empresas: readonly Empresa[];
  comboios: readonly Comboio[];
  combustiveis: readonly TipoCombustivel[];
  buscaRef?: RefObject<HTMLInputElement | null>;
  exportando: '' | 'excel' | 'pdf';
  isParsingSpreadsheet: boolean;
  /** Lista aberta sozinha numa janela, sem a casca do app. */
  compacto?: boolean;
  onImportar: () => void;
  onExportarExcel: (dados: FiltrosExportacao) => void;
  onExportarPdf: (dados: FiltrosExportacao) => void;
  onEditar: (item: Abastecimento) => void;
  onRepetir: (item: Abastecimento) => void;
  /** Sem ele, quem não pode excluir não vê o botão. */
  onExcluir?: (itens: Abastecimento[]) => void;
  /** Trocar a data dos marcados; sem ele, o botão não aparece. */
  onTrocarData?: (itens: Abastecimento[]) => void;
  pedidoFiltro?: PedidoFiltro;
}

interface Filtros {
  texto: string;
  /** Mês do diesel ("2026-10"), "tudo" ou "personalizado" quando a pessoa digita as datas. */
  aba: string;
  dataInicio: string;
  dataFim: string;
  comboioId: string;
  equipamentoId: string;
  empresaId: string;
  combustivelId: string;
  soConferir: boolean;
  soRepetidos: boolean;
}

interface Preferencias {
  colunas: ColunaHistorico[];
  agrupamento: AgrupamentoHistorico;
  tamanhoPagina: number;
}

// v2: as colunas passaram a ser as da planilha; a escolha antiga não vale mais.
const CHAVE_PREFERENCIAS = 'renea_combustivel_historico_v2';
const TAMANHOS_PAGINA = [50, 100, 200];

const lerPreferencias = (): Preferencias => {
  const padrao: Preferencias = { colunas: colunasValidas(undefined), agrupamento: 'nenhum', tamanhoPagina: 100 };
  try {
    const salvo = JSON.parse(window.localStorage.getItem(CHAVE_PREFERENCIAS) || 'null');
    if (!salvo || typeof salvo !== 'object') return padrao;
    return {
      colunas: colunasValidas(salvo.colunas),
      agrupamento: AGRUPAMENTOS_HISTORICO.some(item => item.id === salvo.agrupamento) ? salvo.agrupamento : padrao.agrupamento,
      tamanhoPagina: TAMANHOS_PAGINA.includes(salvo.tamanhoPagina) ? salvo.tamanhoPagina : padrao.tamanhoPagina,
    };
  } catch {
    return padrao;
  }
};

const guardarPreferencias = (preferencias: Preferencias) => {
  try {
    window.localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(preferencias));
  } catch {
    // Sem espaço ou aba anônima: a escolha vale só até fechar a tela.
  }
};

// Somadas com as colunas da planilha, as larguras mínimas cabem num notebook
// de 1366 px com o menu aberto (cerca de 1.080 px de tabela) em zoom 100%.
const LARGURA: Record<ColunaHistorico, string> = {
  data: '5.4rem', prefixo: '4.2rem', descricao: 'minmax(7rem,1.6fr)', km: '4.4rem', horimetro: '4.4rem', litros: '3.6rem',
  hora: '3rem', comboio: 'minmax(4rem,0.6fr)', combustivel: 'minmax(5rem,1fr)', empresa: 'minmax(4.5rem,0.8fr)',
  bombaInicial: '4.6rem', bombaFinal: '4.6rem', responsavel: 'minmax(5rem,0.8fr)', observacao: 'minmax(6rem,1.2fr)',
};
const NUMERICAS: ReadonlySet<ColunaHistorico> = new Set(['km', 'horimetro', 'litros', 'bombaInicial', 'bombaFinal']);

const semAcento = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const numeroTexto = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const litrosTexto = (valor: number) => `${numeroTexto(valor)} L`;
const dataCurta = (dia: string) => (dia ? new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem data');
const dataLonga = (dia: string) => (dia ? new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }) : 'Sem data');
const precisaConferir = (item: Abastecimento) => item.revisaoStatus === 'Pendente' || item.status === 'Pendente' || Boolean(item.alertas?.some(alerta => alerta.severidade !== 'info'));

export default function HistoricoCombustivel({
  abastecimentos, equipamentos, empresas, comboios, combustiveis, buscaRef, exportando, isParsingSpreadsheet, compacto = false,
  onImportar, onExportarExcel, onExportarPdf, onEditar, onRepetir, onExcluir, onTrocarData, pedidoFiltro,
}: Props) {
  // A lista aberta sozinha (link ?lista=1) mostra no mínimo 100 por página.
  const [preferencias, setPreferencias] = useState<Preferencias>(() => {
    const salvas = lerPreferencias();
    return compacto ? { ...salvas, tamanhoPagina: Math.max(salvas.tamanhoPagina, 100) } : salvas;
  });
  // Como a planilha: abre na aba do mês atual.
  const [filtros, setFiltros] = useState<Filtros>(() => {
    const aba = abaDoDia(isoDay(new Date()));
    return { texto: '', aba, ...intervaloDaAba(aba), comboioId: '', equipamentoId: '', empresaId: '', combustivelId: '', soConferir: false, soRepetidos: false };
  });
  const [ordem, setOrdem] = useState<OrdemHistorico>(ORDEM_PADRAO);
  // Infinity = última página: a lista abre no fim, onde estão os lançamentos mais novos.
  const [pagina, setPagina] = useState(Number.POSITIVE_INFINITY);
  const listaRef = useRef<HTMLDivElement>(null);
  const abasRef = useRef<HTMLElement>(null);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [menu, setMenu] = useState<'' | 'colunas' | 'grupo'>('');
  const [selecionados, setSelecionados] = useState<ReadonlySet<string>>(() => new Set());
  const [abertoId, setAbertoId] = useState('');
  const [fechados, setFechados] = useState<ReadonlySet<string>>(() => new Set());
  const fichaRef = useRef<HTMLElement>(null);
  const menusRef = useRef<HTMLDivElement>(null);

  useEffect(() => guardarPreferencias(preferencias), [preferencias]);

  // Toque fora ou Esc fecha o menu de colunas ou de grupo.
  useEffect(() => {
    if (!menu) return undefined;
    const fora = (event: MouseEvent) => { if (!menusRef.current?.contains(event.target as Node)) setMenu(''); };
    const esc = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setMenu(''); } };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc, true); };
  }, [menu]);

  const porId = useMemo(() => new Map(equipamentos.map(item => [item.id, item])), [equipamentos]);
  const empresaPorId = useMemo(() => new Map(empresas.map(item => [item.id, item.nome])), [empresas]);
  const comboioPorId = useMemo(() => new Map(comboios.map(item => [item.id, item.nome])), [comboios]);
  const nomeCombustivel = useMemo(() => new Map(combustiveis.map(item => [item.id, item.nome])), [combustiveis]);
  const repetidos = useMemo(() => idsRepetidos(abastecimentos), [abastecimentos]);
  const nomes = useMemo<NomesHistorico>(() => ({
    prefixo: item => porId.get(item.equipamentoId)?.prefixo || item.prefixoInformado?.trim() || '',
    empresa: item => empresaPorId.get(porId.get(item.equipamentoId)?.empresaId || '') || '',
    comboio: item => comboioPorId.get(item.comboioId) || '',
  }), [comboioPorId, empresaPorId, porId]);

  const filtrados = useMemo(() => {
    const termo = semAcento(filtros.texto.trim());
    const lista = abastecimentos.filter(item => {
      const maquina = porId.get(item.equipamentoId);
      if (filtros.dataInicio && item.data < filtros.dataInicio) return false;
      if (filtros.dataFim && item.data > filtros.dataFim) return false;
      if (filtros.comboioId && item.comboioId !== filtros.comboioId) return false;
      if (filtros.equipamentoId && item.equipamentoId !== filtros.equipamentoId) return false;
      if (filtros.empresaId && maquina?.empresaId !== filtros.empresaId) return false;
      if (filtros.combustivelId && item.tipoCombustivelId !== filtros.combustivelId) return false;
      if (filtros.soConferir && !precisaConferir(item)) return false;
      if (filtros.soRepetidos && !repetidos.has(item.id)) return false;
      if (!termo) return true;
      return semAcento([
        item.data, dataCurta(item.data), item.hora, nomes.prefixo(item), maquina?.nome, nomes.empresa(item), nomes.comboio(item),
        nomeCombustivel.get(item.tipoCombustivelId), item.responsavel, item.operadorNome, item.localAbastecimento, item.observacao,
      ].filter(Boolean).join(' ')).includes(termo);
    });
    return ordenarHistorico(lista, ordem, nomes);
  }, [abastecimentos, filtros, nomeCombustivel, nomes, ordem, porId, repetidos]);

  const totalLitros = filtrados.reduce((soma, item) => soma + Number(item.quantidadeLitros || 0), 0);
  const maquinas = new Set(filtrados.map(item => item.equipamentoId || item.prefixoInformado).filter(Boolean)).size;
  const conferir = filtrados.filter(precisaConferir).length;
  const repetidosNoFiltro = filtrados.filter(item => repetidos.has(item.id)).length;
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / preferencias.tamanhoPagina));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const daPagina = filtrados.slice(paginaAtual * preferencias.tamanhoPagina, (paginaAtual + 1) * preferencias.tamanhoPagina);
  const grupos = agruparHistorico(daPagina, preferencias.agrupamento, nomes);
  const totaisGrupo = useMemo(() => new Map(agruparHistorico(filtrados, preferencias.agrupamento, nomes).map(grupo => [grupo.chave, grupo])), [filtrados, nomes, preferencias.agrupamento]);
  const colunas = COLUNAS_HISTORICO.filter(item => preferencias.colunas.includes(item.id));
  const gradeColunas = `2rem ${colunas.map(item => LARGURA[item.id]).join(' ')} 1.5rem`;
  const aberto = abertoId ? abastecimentos.find(item => item.id === abertoId) : undefined;
  const selecionadosLista = filtrados.filter(item => selecionados.has(item.id));
  const todosDaPaginaMarcados = daPagina.length > 0 && daPagina.every(item => selecionados.has(item.id));

  const textoFiltros = [
    filtros.dataInicio || filtros.dataFim ? `Período: ${filtros.dataInicio ? dataCurta(filtros.dataInicio) : 'início'} a ${filtros.dataFim ? dataCurta(filtros.dataFim) : 'hoje'}` : '',
    filtros.comboioId ? `Comboio: ${comboioPorId.get(filtros.comboioId) || ''}` : '',
    filtros.equipamentoId ? `Máquina: ${porId.get(filtros.equipamentoId)?.prefixo || ''}` : '',
    filtros.empresaId ? `Empresa: ${empresaPorId.get(filtros.empresaId) || ''}` : '',
    filtros.combustivelId ? `Combustível: ${nomeCombustivel.get(filtros.combustivelId) || ''}` : '',
    filtros.soConferir ? 'Só os que precisam conferir' : '',
    filtros.soRepetidos ? 'Só os repetidos' : '',
    filtros.texto.trim() ? `Busca: ${filtros.texto.trim()}` : '',
  ].filter(Boolean);
  const textoPeriodo = filtros.dataInicio || filtros.dataFim
    ? `${filtros.dataInicio ? dataCurta(filtros.dataInicio) : 'Início'} a ${filtros.dataFim ? dataCurta(filtros.dataFim) : 'Hoje'}`
    : 'Todo o período';
  const abas = useMemo(() => abasDoHistorico(abastecimentos, isoDay(new Date())), [abastecimentos]);
  const tituloLista = /^\d{4}-\d{2}$/.test(filtros.aba) ? tituloDaAba(filtros.aba) : filtros.aba === ABA_TUDO ? 'FORNECIMENTO DIESEL - TODOS OS MESES' : `FORNECIMENTO DIESEL - ${textoPeriodo.toUpperCase()}`;
  // Na ordem da planilha (do primeiro para o último) a lista começa no fim; nas outras, no começo.
  const naOrdemDaPlanilha = ordem.coluna === 'data' && ordem.direcao === 'asc';
  const irParaInicio = () => setPagina(naOrdemDaPlanilha ? Number.POSITIVE_INFINITY : 0);
  const filtrosExtras = [filtros.comboioId, filtros.equipamentoId, filtros.empresaId, filtros.combustivelId, filtros.soConferir, filtros.soRepetidos].filter(Boolean).length;

  const mudarFiltro = <K extends keyof Filtros>(campo: K, valor: Filtros[K]) => {
    setFiltros(atual => {
      const proximo = { ...atual, [campo]: valor };
      if (campo === 'dataInicio' || campo === 'dataFim') proximo.aba = 'personalizado';
      return proximo;
    });
    irParaInicio();
  };

  const escolherAba = (aba: string) => {
    setFiltros(atual => ({ ...atual, aba, ...intervaloDaAba(aba) }));
    irParaInicio();
  };

  const limparFiltros = () => {
    setFiltros(atual => ({ ...atual, texto: '', comboioId: '', equipamentoId: '', empresaId: '', combustivelId: '', soConferir: false, soRepetidos: false }));
    irParaInicio();
  };

  // O relatório pede a lista já filtrada (um dia, uma máquina, um comboio...).
  useEffect(() => {
    if (!pedidoFiltro?.chave) return;
    const { chave: _chave, ...pedido } = pedidoFiltro;
    const temDatas = Boolean(pedido.dataInicio || pedido.dataFim);
    setFiltros(atual => ({
      ...atual, texto: '', comboioId: '', equipamentoId: '', empresaId: '', combustivelId: '', soConferir: false, soRepetidos: false,
      ...pedido,
      // Período que é um mês do diesel abre na aba dele; o resto vira datas soltas.
      aba: !temDatas ? atual.aba
        : pedido.dataInicio && JSON.stringify(intervaloDaAba(abaDoDia(pedido.dataInicio))) === JSON.stringify({ dataInicio: pedido.dataInicio, dataFim: pedido.dataFim }) ? abaDoDia(pedido.dataInicio)
          : 'personalizado',
    }));
    setFiltrosAbertos(Boolean(pedido.equipamentoId || pedido.comboioId || pedido.empresaId || pedido.soRepetidos || pedido.soConferir));
    setSelecionados(new Set());
    setPagina(Number.POSITIVE_INFINITY);
    // Só quando chega um pedido novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoFiltro?.chave]);

  // Abrir uma aba ou voltar à ordem da planilha leva ao último lançamento, como a planilha salva.
  useEffect(() => {
    const lista = listaRef.current;
    if (!lista) return;
    lista.scrollTop = naOrdemDaPlanilha && paginaAtual === totalPaginas - 1 ? lista.scrollHeight : 0;
  }, [filtros.aba, naOrdemDaPlanilha, paginaAtual, totalPaginas]);

  // A aba do mês aberto fica à vista, mesmo no celular com muitos meses.
  useEffect(() => {
    const barra = abasRef.current;
    const ativa = barra?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (barra && ativa) barra.scrollLeft = Math.max(0, ativa.offsetLeft + ativa.offsetWidth - barra.clientWidth + 8);
  }, [filtros.aba]);

  const alternarColuna = (coluna: ColunaHistorico) => setPreferencias(atual => ({
    ...atual,
    colunas: colunasValidas(atual.colunas.includes(coluna) ? atual.colunas.filter(item => item !== coluna) : [...atual.colunas, coluna]),
  }));

  const alternarSelecao = (id: string) => setSelecionados(atual => {
    const proximo = new Set(atual);
    if (proximo.has(id)) proximo.delete(id); else proximo.add(id);
    return proximo;
  });

  const alternarPagina = () => setSelecionados(atual => {
    const proximo = new Set(atual);
    daPagina.forEach(item => (todosDaPaginaMarcados ? proximo.delete(item.id) : proximo.add(item.id)));
    return proximo;
  });

  const abrir = (item: Abastecimento) => {
    setAbertoId(item.id);
    setMenu('');
    // No celular a ficha fica embaixo da lista; leva a pessoa até ela.
    window.setTimeout(() => {
      if (window.matchMedia('(max-width: 1279px)').matches) fichaRef.current?.scrollIntoView({ behavior: reduzMovimento() ? 'auto' : 'smooth', block: 'start' });
    }, 40);
  };

  useEffect(() => {
    if (!fichaRef.current || reduzMovimento()) return;
    gsap.fromTo(fichaRef.current, { opacity: 0, x: 16 }, { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out', clearProps: 'transform,opacity' });
  }, [abertoId]);

  // Seleção de algo que saiu do filtro ou foi excluído não fica pendurada.
  useEffect(() => {
    setSelecionados(atual => {
      const ids = new Set(abastecimentos.map(item => item.id));
      const proximo = new Set([...atual].filter(id => ids.has(id)));
      return proximo.size === atual.size ? atual : proximo;
    });
    if (abertoId && !abastecimentos.some(item => item.id === abertoId)) setAbertoId('');
  }, [abastecimentos, abertoId]);

  const exportar = (tipo: 'excel' | 'pdf') => {
    const dados = { itens: filtrados, filtros: textoFiltros, periodo: textoPeriodo };
    if (tipo === 'excel') onExportarExcel(dados); else onExportarPdf(dados);
  };

  const cabecalhoOrdenavel = (id: ColunaHistorico, rotulo: string, ordenavel?: boolean) => {
    if (!ordenavel) return <span key={id} className={NUMERICAS.has(id) ? 'text-right' : ''}>{rotulo}</span>;
    const ativo = ordem.coluna === id;
    const Seta = ordem.direcao === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button key={id} type="button" onClick={() => { const proxima = proximaOrdem(ordem, id as ColunaOrdem); setOrdem(proxima); setPagina(proxima.coluna === 'data' && proxima.direcao === 'asc' ? Number.POSITIVE_INFINITY : 0); }}
        aria-label={`Ordenar por ${rotulo}`} aria-sort={ativo ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : undefined}
        className={`inline-flex min-h-8 items-center gap-1 rounded-md text-left uppercase tracking-wide transition hover:text-[#176b4d] ${NUMERICAS.has(id) ? 'justify-end text-right' : ''} ${ativo ? 'text-[#176b4d]' : ''} ${FOCO}`}>
        {rotulo}{ativo && <Seta className="size-3.5" aria-hidden="true" />}
      </button>
    );
  };

  const numeroCelula = (valor: number) => (valor > 0 ? numeroTexto(valor) : '');
  const celula = (coluna: ColunaHistorico, item: Abastecimento) => {
    const maquina = porId.get(item.equipamentoId);
    const numerica = 'text-right font-mono text-[13px] tabular-nums text-slate-700';
    switch (coluna) {
      case 'data': return <span key={coluna} className="font-mono text-[13px] font-bold tabular-nums text-slate-900">{dataCurta(item.data)}</span>;
      case 'prefixo': return (
        <span key={coluna} className="flex min-w-0 items-center gap-1">
          <span className="font-mono text-[13px] font-black text-slate-950">{nomes.prefixo(item) || '—'}</span>
          {precisaConferir(item) && <span className="size-2 shrink-0 rounded-full bg-[#f26a2e]" title="Precisa conferir" aria-label="Precisa conferir" />}
          {repetidos.has(item.id) && <span className="shrink-0 rounded bg-rose-100 px-1 text-xs font-black uppercase text-rose-700" title="Mesma máquina, mesmo dia e mesmos litros de outro lançamento">2x</span>}
        </span>
      );
      case 'descricao': return <span key={coluna} className={`truncate text-[13px] ${maquina?.nome ? 'text-slate-700' : 'font-bold text-rose-600'}`} title={maquina?.nome}>{maquina?.nome || 'NÃO CADASTRADO'}</span>;
      case 'km': return <span key={coluna} className={numerica}>{numeroCelula(item.kmInicial)}</span>;
      case 'horimetro': return <span key={coluna} className={numerica}>{numeroCelula(item.horimetroInicial)}</span>;
      case 'litros': return <span key={coluna} className="text-right text-[13px] font-black tabular-nums text-[#176b4d]">{numeroTexto(Number(item.quantidadeLitros || 0))}</span>;
      case 'hora': return <span key={coluna} className="font-mono text-[13px] tabular-nums text-slate-700">{item.hora || ''}</span>;
      case 'comboio': return <span key={coluna} className="truncate text-[13px] text-slate-700" title={nomes.comboio(item) || undefined}>{nomes.comboio(item)}</span>;
      case 'combustivel': return <span key={coluna} className="truncate text-[13px] text-slate-700" title={nomeCombustivel.get(item.tipoCombustivelId)}>{nomeCombustivel.get(item.tipoCombustivelId) || ''}</span>;
      case 'empresa': return <span key={coluna} className={`truncate text-[13px] ${nomes.empresa(item) ? 'text-slate-700' : 'font-bold text-rose-600'}`} title={nomes.empresa(item) || undefined}>{nomes.empresa(item) || 'NÃO CADASTRADO'}</span>;
      case 'bombaInicial': return <span key={coluna} className={numerica}>{numeroCelula(item.bombaInicial)}</span>;
      case 'bombaFinal': return <span key={coluna} className={numerica}>{numeroCelula(item.bombaFinal)}</span>;
      case 'responsavel': return <span key={coluna} className="truncate text-[13px] text-slate-600" title={item.responsavel || undefined}>{item.responsavel || ''}</span>;
      case 'observacao': return <span key={coluna} className="truncate text-[13px] text-slate-600" title={item.observacao || undefined}>{item.observacao || ''}</span>;
      default: return null;
    }
  };

  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-2 xl:flex-row ${compacto ? 'bg-slate-50' : ''}`} data-testid="combustivel-historico">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        <section data-comb-reveal aria-label="Filtros do histórico" className={`${CARTAO} shrink-0 p-2`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input ref={buscaRef} type="search" value={filtros.texto} onChange={event => mudarFiltro('texto', event.target.value)} placeholder="Buscar máquina, comboio, data, observação…" aria-label="Buscar no histórico" className={`${CAMPO} pl-9`} data-testid="combustivel-busca" />
            </span>
            <div ref={menusRef} className="flex flex-wrap items-center gap-2">
              <button type="button" aria-expanded={filtrosAbertos} onClick={() => setFiltrosAbertos(aberto => !aberto)} className={`${BOTAO_SECUNDARIO} min-h-10 px-3`} data-testid="historico-filtros">
                <Filter className="size-4" aria-hidden="true" />Filtros{filtrosExtras > 0 && <span className="rounded-full bg-emerald-100 px-1.5 text-xs text-emerald-800">{filtrosExtras}</span>}
              </button>
              <div className="relative">
                <button type="button" aria-expanded={menu === 'colunas'} onClick={() => setMenu(atual => (atual === 'colunas' ? '' : 'colunas'))} className={`${BOTAO_SECUNDARIO} min-h-10 px-3`} data-testid="historico-colunas">
                  <Columns3 className="size-4" aria-hidden="true" /><span className="max-sm:sr-only">Colunas</span>
                </button>
                {menu === 'colunas' && (
                  <div role="group" aria-label="Colunas que aparecem" className="absolute left-0 z-30 mt-1 max-h-[60vh] w-56 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                    <p className="px-2 pb-1 text-xs font-bold text-slate-500">Escolha o que aparece</p>
                    {COLUNAS_HISTORICO.map(item => (
                      <label key={item.id} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-semibold ${item.fixa ? 'text-slate-400' : 'text-slate-700 hover:bg-[#f7f8f6]'}`}>
                        <input type="checkbox" checked={preferencias.colunas.includes(item.id)} disabled={item.fixa} onChange={() => alternarColuna(item.id)} className="size-4 accent-[#176b4d]" />
                        {item.rotulo}{item.fixa && <span className="ml-auto text-xs font-bold uppercase">sempre</span>}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button type="button" aria-expanded={menu === 'grupo'} onClick={() => setMenu(atual => (atual === 'grupo' ? '' : 'grupo'))} className={`${BOTAO_SECUNDARIO} min-h-10 px-3`} data-testid="historico-agrupar">
                  <Layers className="size-4" aria-hidden="true" /><span className="max-sm:sr-only">{AGRUPAMENTOS_HISTORICO.find(item => item.id === preferencias.agrupamento)?.rotulo}</span>
                </button>
                {menu === 'grupo' && (
                  <div role="group" aria-label="Agrupar" className="absolute left-0 z-30 mt-1 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                    {AGRUPAMENTOS_HISTORICO.map(item => (
                      <button key={item.id} type="button" aria-pressed={preferencias.agrupamento === item.id} onClick={() => { setPreferencias(atual => ({ ...atual, agrupamento: item.id })); setFechados(new Set()); setMenu(''); }}
                        className={`flex min-h-10 w-full items-center rounded-lg px-2 text-left text-sm font-semibold ${preferencias.agrupamento === item.id ? 'bg-emerald-50 text-[#176b4d]' : 'text-slate-700 hover:bg-[#f7f8f6]'} ${FOCO}`}>
                        {item.rotulo}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => exportar('excel')} disabled={Boolean(exportando) || filtrados.length === 0} title="Excel usa todos os resultados filtrados, não só esta página" className={`${BOTAO_SECUNDARIO} min-h-10 px-3`}><Download className="size-4" aria-hidden="true" />{exportando === 'excel' ? 'Gerando…' : 'Excel'}</button>
              <button type="button" onClick={() => exportar('pdf')} disabled={Boolean(exportando) || filtrados.length === 0} className={`${BOTAO_SECUNDARIO} min-h-10 px-3`}><FileText className="size-4" aria-hidden="true" />{exportando === 'pdf' ? 'Gerando…' : 'PDF'}</button>
              <button type="button" onClick={onImportar} disabled={isParsingSpreadsheet} className={`${BOTAO_SECUNDARIO} min-h-10 px-3`} title="Importar planilha" aria-label="Importar planilha"><FileSpreadsheet className="size-4" aria-hidden="true" /><span className="hidden 2xl:inline">{isParsingSpreadsheet ? 'Lendo…' : 'Importar'}</span></button>
            </div>
          </div>

          {filtrosAbertos && (
            <div className="mt-2 grid gap-2 border-t border-slate-100 pt-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
              <label><span className={`${ROTULO} mb-1 block`}>De</span><input type="date" value={filtros.dataInicio} onChange={event => mudarFiltro('dataInicio', event.target.value)} className={CAMPO} /></label>
              <label><span className={`${ROTULO} mb-1 block`}>Até</span><input type="date" value={filtros.dataFim} onChange={event => mudarFiltro('dataFim', event.target.value)} className={CAMPO} /></label>
              <label><span className={`${ROTULO} mb-1 block`}>Máquina</span><select value={filtros.equipamentoId} onChange={event => mudarFiltro('equipamentoId', event.target.value)} className={CAMPO}><option value="">Todas</option>{[...equipamentos].sort((a, b) => a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true })).map(item => <option key={item.id} value={item.id}>{item.prefixo} · {item.nome}</option>)}</select></label>
              <label><span className={`${ROTULO} mb-1 block`}>Comboio</span><select value={filtros.comboioId} onChange={event => mudarFiltro('comboioId', event.target.value)} className={CAMPO}><option value="">Todos</option>{comboios.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
              <label><span className={`${ROTULO} mb-1 block`}>Empresa</span><select value={filtros.empresaId} onChange={event => mudarFiltro('empresaId', event.target.value)} className={CAMPO}><option value="">Todas</option>{empresas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
              <label><span className={`${ROTULO} mb-1 block`}>Combustível</span><select value={filtros.combustivelId} onChange={event => mudarFiltro('combustivelId', event.target.value)} className={CAMPO}><option value="">Todos</option>{combustiveis.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 self-end rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={filtros.soConferir} onChange={event => mudarFiltro('soConferir', event.target.checked)} className="size-4 accent-[#176b4d]" />Só os que precisam conferir
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 self-end rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={filtros.soRepetidos} onChange={event => mudarFiltro('soRepetidos', event.target.checked)} className="size-4 accent-[#176b4d]" data-testid="historico-so-repetidos" />Só os repetidos
              </label>
              <button type="button" onClick={limparFiltros} disabled={filtrosExtras === 0 && !filtros.texto} className={`${BOTAO_SECUNDARIO} self-end`}>Limpar filtros</button>
            </div>
          )}
        </section>

        <section data-comb-reveal aria-label="Resultado" className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:hidden">
          {[
            ['Abastecimentos', filtrados.length.toLocaleString('pt-BR'), textoPeriodo, 'text-slate-950'],
            ['Litros', litrosTexto(totalLitros), filtrados.length ? `média ${litrosTexto(totalLitros / filtrados.length)}` : 'nenhum lançamento', 'text-[#176b4d]'],
            ['Máquinas', maquinas.toLocaleString('pt-BR'), 'abastecidas no período', 'text-slate-950'],
            ['A conferir', conferir.toLocaleString('pt-BR'), conferir ? 'toque em Filtros para ver só eles' : 'tudo certo', conferir ? 'text-[#c2410c]' : 'text-slate-950'],
          ].map(([rotulo, valor, ajuda, cor]) => (
            <div key={rotulo} className={`${CARTAO} px-3 py-2`}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{rotulo}</p>
              <p className={`text-xl font-black tabular-nums ${cor}`}>{valor}</p>
              <p className="truncate text-xs text-slate-500">{ajuda}</p>
            </div>
          ))}
        </section>

        {selecionadosLista.length > 0 && (
          <div role="region" aria-label="Selecionados" className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl bg-[#176b4d] px-3 py-2 text-sm font-semibold text-white" data-testid="historico-selecao">
            <CheckSquare className="size-4" aria-hidden="true" />
            <span>{selecionadosLista.length} selecionado(s) · {litrosTexto(selecionadosLista.reduce((soma, item) => soma + Number(item.quantidadeLitros || 0), 0))}</span>
            {selecionadosLista.length < filtrados.length && (
              <button type="button" onClick={() => setSelecionados(new Set(filtrados.map(item => item.id)))} className={`inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-white/90 underline-offset-2 hover:underline ${FOCO}`} data-testid="historico-marcar-todos">
                <ListChecks className="size-4" aria-hidden="true" />Marcar os {filtrados.length.toLocaleString('pt-BR')} do resultado
              </button>
            )}
            <span className="ml-auto flex flex-wrap gap-2">
              <button type="button" onClick={() => setSelecionados(new Set())} className={`inline-flex min-h-9 items-center gap-1 rounded-lg px-3 text-white/90 hover:bg-white/10 ${FOCO}`}><X className="size-4" aria-hidden="true" />Desmarcar</button>
              {onTrocarData && <button type="button" onClick={() => onTrocarData(selecionadosLista)} className={`inline-flex min-h-9 items-center gap-1 rounded-lg bg-white px-3 font-bold text-[#176b4d] hover:bg-emerald-50 ${FOCO}`} data-testid="historico-trocar-data"><CalendarDays className="size-4" aria-hidden="true" />Trocar data</button>}
              {onExcluir && <button type="button" onClick={() => onExcluir(selecionadosLista)} className={`inline-flex min-h-9 items-center gap-1 rounded-lg bg-white px-3 font-bold text-rose-700 hover:bg-rose-50 ${FOCO}`}><Trash2 className="size-4" aria-hidden="true" />Excluir</button>}
            </span>
          </div>
        )}

        <section data-comb-reveal aria-label="Abastecimentos" className={`${CARTAO} flex min-h-[22rem] flex-1 flex-col overflow-hidden`}>
          <header className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-slate-200 px-3 py-1.5 lg:hidden" data-testid="historico-titulo">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">{tituloLista}</h3>
            <p className="text-sm font-semibold text-slate-500">
              {/^\d{4}-\d{2}$/.test(filtros.aba) ? `${getFuelCompetencePeriodLabel(filtros.aba)} · ` : ''}
              Total <span className="font-black tabular-nums text-[#176b4d]">{litrosTexto(totalLitros)}</span>
            </p>
          </header>
          <div ref={listaRef} className="min-h-0 flex-1 overflow-auto" data-testid="combustivel-lista-historico">
            <div className="sticky top-0 z-10 hidden items-center gap-2 border-b border-slate-300 bg-slate-100 px-3 py-0.5 text-xs font-black uppercase leading-tight tracking-wide text-slate-500 lg:grid" style={{ gridTemplateColumns: gradeColunas }}>
              <button type="button" onClick={alternarPagina} aria-label={todosDaPaginaMarcados ? 'Desmarcar a página' : 'Marcar a página'} className={`grid size-8 place-items-center rounded-md text-slate-500 hover:text-[#176b4d] ${FOCO}`}>
                {todosDaPaginaMarcados ? <CheckSquare className="size-4" aria-hidden="true" /> : <Square className="size-4" aria-hidden="true" />}
              </button>
              {colunas.map(item => cabecalhoOrdenavel(item.id, item.rotulo, item.ordenavel))}
              <span />
            </div>
            {filtrados.length === 0 ? (
              <div className="px-4 py-14 text-center">
                <History className="mx-auto size-8 text-slate-300" aria-hidden="true" />
                <p className="mt-3 font-semibold text-slate-700">Nenhum abastecimento neste mês</p>
                <p className="mt-1 text-sm text-slate-500">Toque em outro mês nas abas de baixo ou em "Ver tudo".</p>
                <button type="button" onClick={() => { escolherAba(ABA_TUDO); limparFiltros(); }} className={`${BOTAO_SECUNDARIO} mt-4`}>Ver tudo</button>
              </div>
            ) : grupos.map(grupo => {
              const total = totaisGrupo.get(grupo.chave);
              const fechado = fechados.has(grupo.chave);
              return (
                <div key={grupo.chave} role="rowgroup">
                  {preferencias.agrupamento !== 'nenhum' && (
                    <button type="button" aria-expanded={!fechado} onClick={() => setFechados(atual => { const proximo = new Set(atual); if (proximo.has(grupo.chave)) proximo.delete(grupo.chave); else proximo.add(grupo.chave); return proximo; })}
                      className={`sticky top-0 z-[5] flex w-full items-center gap-2 border-b border-slate-200 bg-emerald-50 px-3 py-2 text-left text-sm lg:top-[2.25rem] ${FOCO}`}>
                      <ChevronDown className={`size-4 shrink-0 text-[#176b4d] transition ${fechado ? '-rotate-90' : ''}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate font-black text-slate-900">{preferencias.agrupamento === 'dia' ? dataLonga(grupo.rotulo) : grupo.rotulo}</span>
                      <span className="shrink-0 text-xs font-semibold text-slate-500">{total?.itens.length ?? grupo.itens.length} abast.</span>
                      <span className="shrink-0 font-black tabular-nums text-[#176b4d]">{litrosTexto(total?.litros ?? grupo.litros)}</span>
                    </button>
                  )}
                  {!fechado && <ul className="divide-y divide-slate-200/70">
                    {grupo.itens.map((item, indice) => {
                      const marcado = selecionados.has(item.id);
                      const ativo = item.id === abertoId;
                      return (
                        <li key={item.id} className={`group relative transition-colors ${ativo ? 'bg-emerald-50' : marcado ? 'bg-emerald-50/50' : `${indice % 2 ? 'bg-[#f7f8f6]' : 'bg-white'} hover:bg-emerald-50/40`}`}>
                          <div className="hidden h-7 items-center gap-2 px-3 lg:grid" style={{ gridTemplateColumns: gradeColunas }}>
                            <button type="button" onClick={() => alternarSelecao(item.id)} aria-pressed={marcado} aria-label={`${marcado ? 'Desmarcar' : 'Marcar'} ${nomes.prefixo(item)} de ${dataCurta(item.data)}`} className={`relative z-[2] grid size-7 place-items-center rounded-md ${marcado ? 'text-[#176b4d]' : 'text-slate-400 hover:text-slate-700'} ${FOCO}`}>
                              {marcado ? <CheckSquare className="size-4" aria-hidden="true" /> : <Square className="size-4" aria-hidden="true" />}
                            </button>
                            {colunas.map(coluna => celula(coluna.id, item))}
                            <ChevronRight className={`size-4 justify-self-end ${ativo ? 'text-[#176b4d]' : 'text-slate-300 group-hover:text-slate-500'}`} aria-hidden="true" />
                          </div>
                          <div className="flex items-start gap-2 px-3 py-2.5 lg:hidden">
                            <button type="button" onClick={() => alternarSelecao(item.id)} aria-pressed={marcado} aria-label={`${marcado ? 'Desmarcar' : 'Marcar'} ${nomes.prefixo(item)} de ${dataCurta(item.data)}`} className={`relative z-[2] grid size-10 shrink-0 place-items-center rounded-lg ${marcado ? 'text-[#176b4d]' : 'text-slate-400'} ${FOCO}`}>
                              {marcado ? <CheckSquare className="size-5" aria-hidden="true" /> : <Square className="size-5" aria-hidden="true" />}
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="font-mono text-base font-black text-slate-950">{nomes.prefixo(item) || 'Sem prefixo'}</span>
                                <span className="text-lg font-black tabular-nums text-[#176b4d]">{litrosTexto(Number(item.quantidadeLitros || 0))}</span>
                              </div>
                              <p className="truncate text-sm text-slate-600">{porId.get(item.equipamentoId)?.nome || 'Sem cadastro'}</p>
                              <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs font-semibold text-slate-500">
                                <span>{dataCurta(item.data)} {item.hora}</span>
                                {nomes.comboio(item) && <span>{nomes.comboio(item)}</span>}
                                {item.horimetroInicial > 0 && <span>{numeroTexto(item.horimetroInicial)} h</span>}
                                {item.kmInicial > 0 && <span>{numeroTexto(item.kmInicial)} km</span>}
                                {precisaConferir(item) && <span className="text-amber-700">Conferir</span>}
                                {repetidos.has(item.id) && <span className="text-rose-700">Repetido</span>}
                              </p>
                            </div>
                          </div>
                          <button type="button" onClick={() => abrir(item)} aria-label={`Abrir abastecimento de ${nomes.prefixo(item) || 'máquina'} em ${dataCurta(item.data)}`} className={`absolute inset-0 z-[1] rounded-none ${FOCO}`} data-testid="historico-linha" />
                        </li>
                      );
                    })}
                  </ul>}
                </div>
              );
            })}
          </div>
          {/* No computador as abas de mês e a paginação dividem uma barra só, para sobrar altura para as linhas. */}
          <div className="contents lg:flex lg:shrink-0 lg:items-center lg:border-t lg:border-slate-200 lg:bg-slate-100">
          <nav ref={abasRef} aria-label="Meses" className="relative order-first flex shrink-0 items-end gap-1 overflow-x-auto border-b border-slate-200 bg-slate-100 px-2 pt-1 lg:order-none lg:min-w-0 lg:flex-1 lg:self-end lg:border-b-0" data-testid="historico-abas">
            {[...abas, ABA_TUDO].map(aba => {
              const ativa = filtros.aba === aba;
              return (
                <button key={aba} type="button" aria-pressed={ativa} onClick={() => escolherAba(aba)} data-testid={`historico-aba-${aba}`}
                  title={aba === ABA_TUDO ? 'Todos os meses' : getFuelCompetencePeriodLabel(aba)}
                  className={`min-h-10 shrink-0 whitespace-nowrap rounded-t-lg px-3 text-xs font-black uppercase tracking-wide transition sm:text-sm ${ativa ? 'border-b-2 border-[#176b4d] bg-white text-[#176b4d] shadow-sm' : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'} ${FOCO}`}>
                  {aba === ABA_TUDO ? 'Tudo' : nomeDoMes(aba)}
                </button>
              );
            })}
          </nav>
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 lg:flex-nowrap lg:border-t-0 lg:py-1">
            <p className="whitespace-nowrap text-xs font-semibold tabular-nums text-slate-500 lg:text-sm">
              {filtrados.length ? `${paginaAtual * preferencias.tamanhoPagina + 1}–${Math.min((paginaAtual + 1) * preferencias.tamanhoPagina, filtrados.length)} de ${filtrados.length.toLocaleString('pt-BR')}` : '0 abastecimentos'}
              <span className="hidden lg:inline"> · {maquinas.toLocaleString('pt-BR')} máquinas{conferir ? <> · <span className="font-bold text-[#c2410c]">{conferir.toLocaleString('pt-BR')} a conferir</span></> : ''}{repetidosNoFiltro && !filtros.soRepetidos ? <> · <button type="button" onClick={() => mudarFiltro('soRepetidos', true)} className={`inline-flex items-center gap-1 rounded font-bold text-rose-700 hover:underline ${FOCO}`} data-testid="historico-ver-repetidos"><CopyX className="size-3.5" aria-hidden="true" />{repetidosNoFiltro.toLocaleString('pt-BR')} repetidos</button></> : ''} · Total <span className="font-black text-[#176b4d]">{litrosTexto(totalLitros)}</span></span>
            </p>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                Mostrar
                <select value={preferencias.tamanhoPagina} onChange={event => { setPreferencias(atual => ({ ...atual, tamanhoPagina: Number(event.target.value) })); irParaInicio(); }} className={`min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 ${FOCO}`}>
                  {TAMANHOS_PAGINA.map(valor => <option key={valor} value={valor}>{valor}</option>)}
                </select>
              </label>
              <button type="button" aria-label="Página anterior" onClick={() => setPagina(Math.max(0, paginaAtual - 1))} disabled={paginaAtual === 0} className={`grid size-10 place-items-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 ${FOCO}`}><ChevronLeft className="size-4" aria-hidden="true" /></button>
              <span className="text-xs font-semibold tabular-nums text-slate-500">{paginaAtual + 1}/{totalPaginas}</span>
              <button type="button" aria-label="Próxima página" onClick={() => setPagina(Math.min(totalPaginas - 1, paginaAtual + 1))} disabled={paginaAtual >= totalPaginas - 1} className={`grid size-10 place-items-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 ${FOCO}`}><ChevronRight className="size-4" aria-hidden="true" /></button>
            </div>
          </footer>
          </div>
        </section>
      </div>

      {aberto && (
        <aside ref={fichaRef} aria-label="Ficha do abastecimento" className={`${CARTAO} flex shrink-0 flex-col overflow-hidden xl:w-80`} data-testid="historico-ficha">
          <header className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{dataLonga(aberto.data)} · {aberto.hora || 'sem hora'}</p>
              <h3 className="font-mono text-2xl font-black text-slate-950">{nomes.prefixo(aberto) || 'Sem prefixo'}</h3>
              <p className="truncate text-sm text-slate-600">{porId.get(aberto.equipamentoId)?.nome || 'Sem cadastro'}</p>
            </div>
            <button type="button" onClick={() => setAbertoId('')} aria-label="Fechar ficha" className={`grid size-10 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 ${FOCO}`}><X className="size-5" aria-hidden="true" /></button>
          </header>
          <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
            <p className="text-4xl font-black tabular-nums text-[#176b4d]">{litrosTexto(Number(aberto.quantidadeLitros || 0))}</p>
            {precisaConferir(aberto) && (
              <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 ring-1 ring-inset ring-amber-200">
                Precisa conferir{aberto.alertas?.length ? `: ${aberto.alertas.filter(alerta => alerta.severidade !== 'info').map(alerta => alerta.mensagem).join(' · ')}` : '.'}
              </p>
            )}
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
              {[
                ['Horímetro', aberto.horimetroInicial > 0 ? `${numeroTexto(aberto.horimetroInicial)} h` : '—'],
                ['KM', aberto.kmInicial > 0 ? numeroTexto(aberto.kmInicial) : '—'],
                ['Comboio', nomes.comboio(aberto) || '—'],
                ['Combustível', nomeCombustivel.get(aberto.tipoCombustivelId) || '—'],
                ['Bomba inicial', aberto.bombaInicial > 0 ? numeroTexto(aberto.bombaInicial) : '—'],
                ['Bomba final', aberto.bombaFinal > 0 ? numeroTexto(aberto.bombaFinal) : '—'],
                ['Empresa', nomes.empresa(aberto) || '—'],
                ['Quem lançou', aberto.responsavel || '—'],
                ['Operador', aberto.operadorNome || '—'],
                ['Local', aberto.localAbastecimento || '—'],
              ].map(([rotulo, valor]) => (
                <div key={rotulo} className="min-w-0"><dt className="text-xs font-bold text-slate-500">{rotulo}</dt><dd className="truncate font-semibold text-slate-900" title={valor}>{valor}</dd></div>
              ))}
            </dl>
            {repetidos.has(aberto.id) && (
              <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 ring-1 ring-inset ring-rose-200" data-testid="historico-ficha-repetido">
                Tem outro lançamento desta máquina no mesmo dia com os mesmos litros. Se for o mesmo abastecimento, exclua um dos dois.
              </p>
            )}
            {aberto.observacao && <p className="mt-3 rounded-xl bg-[#f7f8f6] px-3 py-2 text-sm text-slate-700"><span className="font-bold">Observação: </span>{aberto.observacao}</p>}
            {aberto.origem && aberto.origem !== 'Manual' && <p className="mt-3 text-xs text-slate-500">Veio de {aberto.origem.toLowerCase()}{aberto.integracaoAba ? `, aba ${aberto.integracaoAba}` : ''}{aberto.integracaoLinha ? `, linha ${aberto.integracaoLinha}` : ''}.</p>}
          </div>
          <footer className="grid grid-cols-2 gap-2 border-t border-slate-100 p-3">
            <button type="button" onClick={() => onEditar(aberto)} className={`${BOTAO_PRIMARIO} col-span-2`} data-testid="historico-editar"><Pencil className="size-4" aria-hidden="true" />Editar</button>
            <button type="button" onClick={() => onRepetir(aberto)} className={`${BOTAO_SECUNDARIO} whitespace-nowrap px-2 ${onExcluir ? '' : 'col-span-2'}`} title="Abre um lançamento novo já com a máquina e o comboio"><Copy className="size-4" aria-hidden="true" />Lançar outro</button>
            {onExcluir && <button type="button" onClick={() => onExcluir([aberto])} className={BOTAO_PERIGO_LEVE}><Trash2 className="size-4" aria-hidden="true" />Excluir</button>}
          </footer>
        </aside>
      )}
    </div>
  );
}
