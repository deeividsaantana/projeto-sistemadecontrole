/**
 * Histórico do diesel no modelo da planilha FORNECIMENTO DIESEL: abre na aba
 * do mês atual (21 a 20), com as mesmas colunas na mesma ordem e do primeiro
 * lançamento para o último, já no fim da lista. Dá para trocar de mês nas
 * abas, ordenar por coluna, escolher colunas, agrupar com subtotal, marcar
 * vários e abrir a ficha ao lado para editar, repetir ou excluir. A grade é
 * a TabelaPadrao (cabeçalho com aria-sort, linha que abre com Enter, cartões
 * no celular); as abas de mês vão no rodapé dela, junto com os totais.
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { gsap } from 'gsap';
import {
  CalendarDays, CheckSquare, Columns3, Copy, CopyX, Download, FileSpreadsheet, FileText,
  Filter, History, Layers, ListChecks, Pencil, Search, Trash2, X,
} from 'lucide-react';
import { OPCOES_POR_PAGINA, TabelaPadrao, paginarLinhas, type ColunaTabela } from '../../shared/ui/TabelaPadrao';
import { useTelaLarga } from '../../shared/hooks/useTelaLarga';
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
const TAMANHOS_PAGINA: readonly number[] = OPCOES_POR_PAGINA;

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

const NUMERICAS: ReadonlySet<ColunaHistorico> = new Set(['km', 'horimetro', 'litros', 'bombaInicial', 'bombaFinal']);
/** No cartão do celular ficam só os campos que a pessoa confere no campo. */
const FORA_DO_CARTAO: ReadonlySet<ColunaHistorico> = new Set(['combustivel', 'bombaInicial', 'bombaFinal', 'responsavel', 'observacao']);

const semAcento = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const numeroTexto = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const litrosTexto = (valor: number) => `${numeroTexto(valor)} L`;
const dataCurta = (dia: string) => (dia ? new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem data');
const dataLonga = (dia: string) => (dia ? new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }) : 'Sem data');
/** "OUTUBRO 2026" vira "OUT 2026": cabem todos os meses no rodapé de um notebook. */
const mesCurto = (aba: string) => nomeDoMes(aba).replace(/^(\S{3})\S*/, '$1');
const precisaConferir =(item: Abastecimento) => item.revisaoStatus === 'Pendente' || item.status === 'Pendente' || Boolean(item.alertas?.some(alerta => alerta.severidade !== 'info'));

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
  // Página contada de 1. Infinity = última: a lista abre no fim, onde estão os lançamentos mais novos.
  const [pagina, setPagina] = useState(Number.POSITIVE_INFINITY);
  const telaLarga = useTelaLarga();
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
  // Agrupado, cada grupo vem inteiro e seguido (na ordem em que aparece primeiro), com o subtotal do resultado todo.
  const gruposDoResultado = useMemo(
    () => (preferencias.agrupamento === 'nenhum' ? [] : agruparHistorico(filtrados, preferencias.agrupamento, nomes)),
    [filtrados, nomes, preferencias.agrupamento],
  );
  const linhasTabela = useMemo(() => (gruposDoResultado.length ? gruposDoResultado.flatMap(grupo => grupo.itens) : filtrados), [filtrados, gruposDoResultado]);
  const grupoDe = useMemo(() => new Map(gruposDoResultado.flatMap(grupo => grupo.itens.map(item => [item.id, grupo.chave] as const))), [gruposDoResultado]);
  const totaisGrupo = useMemo(() => new Map(gruposDoResultado.map(grupo => [grupo.chave, grupo])), [gruposDoResultado]);
  const { pagina: paginaAtual, totalPaginas } = paginarLinhas(linhasTabela, pagina, preferencias.tamanhoPagina);
  const colunasEscolhidas = COLUNAS_HISTORICO.filter(item => preferencias.colunas.includes(item.id));
  const aberto = abertoId ? abastecimentos.find(item => item.id === abertoId) : undefined;
  const selecionadosLista = filtrados.filter(item => selecionados.has(item.id));

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
  const irParaInicio = () => setPagina(naOrdemDaPlanilha ? Number.POSITIVE_INFINITY : 1);
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
    lista.scrollTop = naOrdemDaPlanilha && paginaAtual === totalPaginas ? lista.scrollHeight : 0;
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

  const alternarVarios = (ids: string[], marcar: boolean) => setSelecionados(atual => {
    const proximo = new Set(atual);
    ids.forEach(id => (marcar ? proximo.add(id) : proximo.delete(id)));
    return proximo;
  });

  const ordenar = (chave: string) => {
    const proxima = proximaOrdem(ordem, chave as ColunaOrdem);
    setOrdem(proxima);
    setPagina(proxima.coluna === 'data' && proxima.direcao === 'asc' ? Number.POSITIVE_INFINITY : 1);
  };

  const alternarGrupo = (chave: string) => setFechados(atual => {
    const proximo = new Set(atual);
    if (proximo.has(chave)) proximo.delete(chave); else proximo.add(chave);
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

  const numeroCelula = (valor: number) => (valor > 0 ? numeroTexto(valor) : '');
  const naoCadastrado = <span className="font-bold text-rose-700">NÃO CADASTRADO</span>;
  /** O que cada coluna da planilha mostra; a ordem e a escolha vêm de COLUNAS_HISTORICO. */
  /** Largura de cada coluna no notebook de 1366 px (cabe em 1280 px; as bombas ficam fora do padrão e abrem em Colunas). */
  const LARGURA_IDEAL: Record<ColunaHistorico, number> = {
    data: 92, prefixo: 80, descricao: 150, km: 72, horimetro: 104, litros: 70, hora: 54, comboio: 92,
    combustivel: 104, empresa: 205, bombaInicial: 84, bombaFinal: 84, responsavel: 120, observacao: 180,
  };
  const CELULA: Record<ColunaHistorico, Pick<ColunaTabela<Abastecimento>, 'render' | 'valorOrdenacao' | 'dica' | 'larguraMinima'>> = {
    data: { render: item => <span className="font-bold text-slate-900">{dataCurta(item.data)}</span>, valorOrdenacao: item => `${item.data}${item.hora || ''}` },
    prefixo: {
      render: item => (
        <span className="inline-flex min-w-0 items-center gap-1">
          <span className="font-mono font-black text-slate-950">{nomes.prefixo(item) || '—'}</span>
          {precisaConferir(item) && <span role="img" className="size-2 shrink-0 rounded-full bg-[#f26a2e]" title="Precisa conferir" aria-label="Precisa conferir" />}
          {repetidos.has(item.id) && <span className="shrink-0 rounded bg-rose-100 px-1 text-xs font-black uppercase text-rose-700" title="Mesma máquina, mesmo dia e mesmos litros de outro lançamento">2x</span>}
        </span>
      ),
      valorOrdenacao: item => nomes.prefixo(item),
      dica: item => nomes.prefixo(item),
    },
    descricao: { render: item => porId.get(item.equipamentoId)?.nome || naoCadastrado, dica: item => porId.get(item.equipamentoId)?.nome, larguraMinima: 170 },
    km: { render: item => numeroCelula(item.kmInicial), valorOrdenacao: item => Number(item.kmInicial || 0) },
    horimetro: { render: item => numeroCelula(item.horimetroInicial), valorOrdenacao: item => Number(item.horimetroInicial || 0) },
    litros: { render: item => <span className="font-black text-[#176b4d]">{numeroTexto(Number(item.quantidadeLitros || 0))}</span>, valorOrdenacao: item => Number(item.quantidadeLitros || 0) },
    hora: { render: item => item.hora || '' },
    comboio: { render: item => nomes.comboio(item), valorOrdenacao: item => nomes.comboio(item) },
    combustivel: { render: item => nomeCombustivel.get(item.tipoCombustivelId) || '' },
    empresa: { render: item => nomes.empresa(item) || naoCadastrado, valorOrdenacao: item => nomes.empresa(item), dica: item => nomes.empresa(item), larguraMinima: 190 },
    bombaInicial: { render: item => numeroCelula(item.bombaInicial) },
    bombaFinal: { render: item => numeroCelula(item.bombaFinal) },
    responsavel: { render: item => item.responsavel || '' },
    observacao: { render: item => item.observacao || '', larguraMinima: 140 },
  };
  const colunasTabela: ColunaTabela<Abastecimento>[] = colunasEscolhidas.map(coluna => {
    const { valorOrdenacao, ...resto } = CELULA[coluna.id];
    return {
      chave: coluna.id,
      titulo: coluna.rotulo,
      alinhamento: NUMERICAS.has(coluna.id) ? 'direita' : 'esquerda',
      larguraIdeal: LARGURA_IDEAL[coluna.id],
      noCartao: !FORA_DO_CARTAO.has(coluna.id),
      // A ordem é a da planilha (ordenarHistorico); a tabela só mostra a seta.
      ...(coluna.ordenavel ? { valorOrdenacao } : {}),
      ...resto,
    };
  });

  const mesesNav = (
    <nav ref={abasRef} aria-label="Meses" className="flex min-w-0 items-center gap-1 overflow-x-auto py-0.5" data-testid="historico-abas">
      {[...abas, ABA_TUDO].map(aba => {
        const ativa = filtros.aba === aba;
        return (
          <button key={aba} type="button" aria-pressed={ativa} onClick={() => escolherAba(aba)} data-testid={`historico-aba-${aba}`}
            title={aba === ABA_TUDO ? 'Todos os meses' : `${nomeDoMes(aba)}: ${getFuelCompetencePeriodLabel(aba)}`}            className={`min-h-11 shrink-0 whitespace-nowrap rounded-lg px-3 text-xs font-black uppercase tracking-wide transition md:min-h-8 ${ativa ? 'bg-white text-[#176b4d] shadow-sm ring-1 ring-inset ring-[#176b4d]/50' : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'} ${FOCO}`}>
            {aba === ABA_TUDO ? 'Tudo' : mesCurto(aba)}
          </button>
        );
      })}
    </nav>
  );

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

        <header className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-1 md:hidden" data-testid="historico-titulo">
          <h2 className="text-sm font-black uppercase tracking-wide text-slate-900">{tituloLista}</h2>
          <p className="text-sm font-semibold text-[#5b6870]">
            {/^\d{4}-\d{2}$/.test(filtros.aba) ? `${getFuelCompetencePeriodLabel(filtros.aba)} · ` : ''}
            Total <span className="font-black tabular-nums text-[#176b4d]">{litrosTexto(totalLitros)}</span>
          </p>
        </header>
        {/* No celular os meses ficam em cima da lista, para não sumirem depois de 100 cartões. */}
        {!telaLarga && <div className="shrink-0 rounded-2xl border border-slate-200 bg-[#f3f6f4] px-1">{mesesNav}</div>}

        <div data-comb-reveal className="flex min-h-[22rem] min-w-0 flex-1 flex-col">
          <TabelaPadrao
            titulo={tituloLista}
            linhas={linhasTabela}
            colunas={colunasTabela}
            idDaLinha={item => item.id}
            nomeDoItem={{ um: 'abastecimento', varios: 'abastecimentos' }}
            densa
            ordenacao={{ chave: ordem.coluna, direcao: ordem.direcao }}
            onOrdenar={ordenar}
            pagina={pagina}
            onPagina={setPagina}
            porPagina={preferencias.tamanhoPagina}
            onPorPagina={valor => setPreferencias(atual => ({ ...atual, tamanhoPagina: valor }))}
            selecao={{
              marcados: selecionados,
              onAlternar: alternarSelecao,
              onAlternarVarios: alternarVarios,
              rotulo: item => `Marcar ${nomes.prefixo(item) || 'máquina'} de ${dataCurta(item.data)}`,
            }}
            onAbrirLinha={abrir}
            linhaAtivaId={abertoId || null}
            testIdLinha="historico-linha"
            refArea={listaRef}
            grupos={gruposDoResultado.length ? {
              chaveDe: item => grupoDe.get(item.id) ?? '',
              fechados,
              onAlternar: alternarGrupo,
              cabecalho: chave => {
                const total = totaisGrupo.get(chave);
                return <>
                  <span className="min-w-0 flex-1 truncate font-black text-slate-900">{preferencias.agrupamento === 'dia' ? dataLonga(chave) : chave}</span>
                  <span className="shrink-0 text-xs font-semibold text-[#5b6870]">{(total?.itens.length ?? 0).toLocaleString('pt-BR')} abast.</span>
                  <span className="shrink-0 font-black tabular-nums text-[#176b4d]">{litrosTexto(total?.litros ?? 0)}</span>
                </>;
              },
            } : undefined}
            rodapeInicio={telaLarga ? mesesNav : undefined}
            resumo={filtrados.length > 0 && (
              <span className="max-lg:hidden">
                {' · '}{maquinas.toLocaleString('pt-BR')} máquinas
                {conferir > 0 && <> · <span className="font-bold text-[#c2410c]">{conferir.toLocaleString('pt-BR')} a conferir</span></>}
                {repetidosNoFiltro > 0 && !filtros.soRepetidos && <> · <button type="button" onClick={() => mudarFiltro('soRepetidos', true)} className={`inline-flex min-h-6 items-center gap-1 rounded font-bold text-rose-700 hover:underline ${FOCO}`} data-testid="historico-ver-repetidos"><CopyX className="size-3.5" aria-hidden="true" />{repetidosNoFiltro.toLocaleString('pt-BR')} repetidos</button></>}
                {' · '}Total <span className="font-black text-[#176b4d]">{litrosTexto(totalLitros)}</span>
              </span>
            )}
            vazio={(
              <div className="flex-1 px-4 py-14 text-center">
                <History className="mx-auto size-8 text-slate-300" aria-hidden="true" />
                <p className="mt-3 font-semibold text-slate-700">Nenhum abastecimento neste mês</p>
                <p className="mt-1 text-sm text-[#5b6870]">Toque em outro mês {telaLarga ? 'no rodapé' : 'logo acima'} ou em "Ver tudo".</p>
                <button type="button" onClick={() => { escolherAba(ABA_TUDO); limparFiltros(); }} className={`${BOTAO_SECUNDARIO} mt-4`}>Ver tudo</button>
              </div>
            )}
            testId="combustivel-lista-historico"
          />
        </div>
      </div>

      {aberto && (
        <section ref={fichaRef} aria-label="Ficha do abastecimento" className={`${CARTAO} flex shrink-0 flex-col overflow-hidden xl:w-80`} data-testid="historico-ficha">
          <header className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{dataLonga(aberto.data)} · {aberto.hora || 'sem hora'}</p>
              <h2 className="font-mono text-2xl font-black text-slate-950">{nomes.prefixo(aberto) || 'Sem prefixo'}</h2>
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
        </section>
      )}
    </div>
  );
}
