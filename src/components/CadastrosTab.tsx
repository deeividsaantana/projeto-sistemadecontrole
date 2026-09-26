/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { AlertTriangle, CheckCircle, Download, Network, Plus, Search, SlidersHorizontal, Trash2, Upload, X } from 'lucide-react';
import type {
  Comboio,
  Empresa,
  Equipamento,
  EtapaServico,
  Funcionario,
  HistoryLog,
  ObraLocal,
  ProdutoLubrificacao,
  TipoCombustivel,
} from '../types';
import { validateCentralRecord } from '../masterData/centralRegistry';
import { exclusoesAtivas, type ExclusaoRegistro } from '../cloud/exclusoes';
import OrganizationChart from './OrganizationChart';
import SpreadsheetImportReview from './SpreadsheetImportReview';
import { FilterBar, PageHeader } from '../shared/ui';
import { useEntradaDeLista } from '../shared/hooks/useEntradaDeLista';
import { abaSugerida, type AbaPlanilha } from '../utils/planilhaAbas';
import { CADASTRO_CATEGORIAS, categoriaCadastro, type CadastroCategoriaId } from '../utils/cadastrosCategorias';
import {
  COLUNAS,
  FILTROS,
  TABELA_DA_CATEGORIA,
  contarSituacoes,
  filtrarLinhas,
  montarLinhas,
  opcoesDoFiltro,
  ordenarLinhas,
  temSituacao,
  type DadosCadastros,
  type LinhaCadastro,
  type RegistroCadastro,
  type SituacaoLista,
} from '../utils/cadastrosLista';
import CadastroTipos, { type VistaCadastros } from './cadastros/CadastroTipos';
import CadastroLista from './cadastros/CadastroLista';
import CadastroDetalhe, { type UsoCadastro } from './cadastros/CadastroDetalhe';
import CadastroFormulario from './cadastros/CadastroFormulario';
import CadastroConfirmacao, { type AcaoConfirmacao } from './cadastros/CadastroConfirmacao';
import CadastroLixeira from './cadastros/CadastroLixeira';
import CadastroConfirmacaoLote, { type ItemTravado } from './cadastros/CadastroConfirmacaoLote';
import { montarRegistro, novoId, valoresIniciais, type ValoresCadastro } from './cadastros/camposCadastro';
import { parseWorkbookFile } from './cadastros/lerPlanilhaCadastros';
import { BOTAO_PERIGO, BOTAO_PERIGO_LEVE, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, FOCO, reduzMovimento } from './cadastros/estilos';
import './cadastros/Cadastros.css';

type ResultadoExclusao = { ok: true; exclusaoId: string } | { ok: false; usos: UsoCadastro[]; mensagem?: string };

interface CadastrosTabProps {
  empresas: Empresa[];
  obras: ObraLocal[];
  equipamentos: Equipamento[];
  funcionarios: Funcionario[];
  comboios: Comboio[];
  combustiveis: TipoCombustivel[];
  lubrificantes: ProdutoLubrificacao[];
  etapas: EtapaServico[];
  historyLogs: HistoryLog[];
  exclusoes: ExclusaoRegistro[];
  podeEditar: boolean;
  podeExcluir: boolean;

  onSaveEmpresa: (item: Empresa, isNew: boolean, onError?: (error: Error) => void) => void;
  onSaveObra: (item: ObraLocal, isNew: boolean) => void;
  onSaveEquipamento: (item: Equipamento, isNew: boolean) => void;
  onSaveFuncionario: (item: Funcionario, isNew: boolean) => void;
  onSaveComboio: (item: Comboio, isNew: boolean) => void;
  onSaveTipoCombustivel: (item: TipoCombustivel, isNew: boolean) => void;
  onSaveProdutoLubrificacao: (item: ProdutoLubrificacao, isNew: boolean) => void;
  onSaveEtapaServico: (item: EtapaServico, isNew: boolean) => void;
  /** Inativa empresa, colaborador ou equipamento, mantendo o histórico. */
  onInativar: (tabela: string, id: string) => void;
  usosDoCadastro: (tabela: string, id: string) => UsoCadastro[];
  onExcluir: (tabela: string, id: string, rotulo: string) => ResultadoExclusao;
  onRestaurar: (exclusaoId: string) => { ok: boolean; mensagem: string };
  onExcluirVarios: (tabela: string, alvos: Array<{ id: string; rotulo: string }>) => {
    excluidos: Array<{ id: string; rotulo: string; exclusaoId: string }>;
    travados: Array<{ id: string; rotulo: string; usos: UsoCadastro[] }>;
    mensagem?: string;
  };
  onRestaurarVarios: (exclusaoIds: string[]) => { ok: boolean; mensagem: string };
  onApagarDeVez: (exclusaoIds: string[]) => { ok: boolean; mensagem: string };
  onImportCadastros: (target: CadastroCategoriaId, rows: Record<string, string>[]) => { success: boolean; message: string };
}

interface Aviso {
  tipo: 'ok' | 'erro';
  texto: string;
  desfazer?: () => void;
}

const TEMPO_DO_AVISO_MS = 10_000;

export default function CadastrosTab(props: CadastrosTabProps) {
  const {
    empresas, obras, equipamentos, funcionarios, comboios, combustiveis, lubrificantes, etapas,
    historyLogs, exclusoes, podeEditar, podeExcluir,
    onInativar, usosDoCadastro, onExcluir, onRestaurar, onApagarDeVez, onImportCadastros,
  } = props;

  const dados: DadosCadastros = useMemo(
    () => ({ empresas, obras, equipamentos, funcionarios, comboios, combustiveis, lubrificantes, etapas }),
    [empresas, obras, equipamentos, funcionarios, comboios, combustiveis, lubrificantes, etapas],
  );

  // O tipo escolhido fica guardado mesmo com a Lixeira aberta: é ele que o
  // botão principal e a importação usam.
  const [categoria, setCategoria] = useState<CadastroCategoriaId>('funcionarios');
  const [vista, setVista] = useState<VistaCadastros>('funcionarios');
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<SituacaoLista>('ativos');
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [ordem, setOrdem] = useState<{ coluna: string; direcao: 'asc' | 'desc' }>({ coluna: COLUNAS.funcionarios[0].id, direcao: 'asc' });
  const [pagina, setPagina] = useState(1);
  const [organograma, setOrganograma] = useState(false);
  const [organogramaAtivoId, setOrganogramaAtivoId] = useState<string | null>(null);

  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<{ editandoId: string | null; valores: ValoresCadastro } | null>(null);
  const [erroFormulario, setErroFormulario] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [confirmacao, setConfirmacao] = useState<{ acao: AcaoConfirmacao; linha: LinhaCadastro; usos: UsoCadastro[] } | null>(null);
  const [processando, setProcessando] = useState(false);
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null);
  // Itens da Lixeira esperando a confirmação de excluir de vez (um ou todos).
  const [apagando, setApagando] = useState<ExclusaoRegistro[] | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  // Marcados para excluir em lote. Valem só para o tipo aberto.
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(() => new Set());
  const [lote, setLote] = useState<{ livres: LinhaCadastro[]; travados: ItemTravado[] } | null>(null);
  const [exportando, setExportando] = useState(false);

  const arquivoRef = useRef<HTMLInputElement>(null);
  const [importacao, setImportacao] = useState<{ fileName: string; rows: Record<string, string>[] } | null>(null);
  const [escolhaDeAba, setEscolhaDeAba] = useState<{ fileName: string; abas: AbaPlanilha[]; sugerida: string | null; ocultas: number } | null>(null);
  const [confirmandoImportacao, setConfirmandoImportacao] = useState(false);

  const categoriaAtual = categoriaCadastro(categoria);
  const tabela = TABELA_DA_CATEGORIA[categoria];
  const comSituacao = temSituacao(categoria);

  const todasAsLinhas = useMemo(() => montarLinhas(categoria, dados), [categoria, dados]);
  const contagem = useMemo(() => contarSituacoes(todasAsLinhas), [todasAsLinhas]);
  const linhasFiltradas = useMemo(() => {
    const filtradas = filtrarLinhas(todasAsLinhas, { busca, situacao: comSituacao ? situacao : 'todos', filtros });
    return ordenarLinhas(filtradas, ordem.coluna, ordem.direcao);
  }, [todasAsLinhas, busca, situacao, comSituacao, filtros, ordem]);

  const lixeira = useMemo(
    () => Array.from(exclusoesAtivas(exclusoes).values()).filter(item => !item.apagadoEm).sort((a, b) => b.excluidoEm.localeCompare(a.excluidoEm)),
    [exclusoes],
  );

  const totais = useMemo(() => {
    const mapa = new Map<VistaCadastros, number>();
    CADASTRO_CATEGORIAS.forEach(item => mapa.set(item.id, montarLinhas(item.id, dados).filter(linha => linha.ativo).length));
    mapa.set('lixeira', lixeira.length);
    return mapa;
  }, [dados, lixeira.length]);

  const linhaDetalhe = detalheId ? todasAsLinhas.find(linha => linha.id === detalheId) : undefined;
  const usosDetalhe = useMemo(() => (linhaDetalhe ? usosDoCadastro(tabela, linhaDetalhe.id) : []), [linhaDetalhe, usosDoCadastro, tabela]);
  const historicoDetalhe = useMemo(
    () => (linhaDetalhe ? historyLogs.filter(log => log.registroId === linhaDetalhe.id).slice(0, 6) : []),
    [historyLogs, linhaDetalhe],
  );

  // Busca, filtro ou troca de tipo mudam o total de páginas: volta para a primeira.
  useEffect(() => setPagina(1), [categoria, busca, situacao, filtros, ordem]);

  useEffect(() => {
    if (!aviso) return undefined;
    const relogio = window.setTimeout(() => setAviso(null), TEMPO_DO_AVISO_MS);
    return () => window.clearTimeout(relogio);
  }, [aviso]);

  const escopo = useEntradaDeLista<HTMLDivElement>([vista, pagina, busca, situacao, filtros]);

  // Entrada do cabeçalho, dos tipos e da barra de filtros, no passo do Painel.
  useGSAP(() => {
    const raiz = escopo.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(raiz.querySelectorAll('[data-cadastros-reveal]'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power3.out', clearProps: 'transform,opacity' });
  }, { scope: escopo });

  const avisoRef = useRef<HTMLDivElement>(null);
  // No computador, busca, filtros e barra de marcados ficam presos no topo e só
  // a lista rola. A altura deles vira variável para o cabeçalho da tabela
  // parar logo abaixo.
  const topoFixoRef = useRef<HTMLDivElement>(null);
  const barraSelecaoRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const lista = listaRef.current;
    if (!lista || typeof ResizeObserver === 'undefined') return;
    const medir = () => {
      const filtros = topoFixoRef.current?.offsetHeight ?? 0;
      const barra = barraSelecaoRef.current?.offsetHeight ?? 0;
      lista.style.setProperty('--cad-filtros', `${filtros}px`);
      lista.style.setProperty('--cad-topo-lista', `${filtros + barra}px`);
    };
    medir();
    const observador = new ResizeObserver(medir);
    [topoFixoRef.current, barraSelecaoRef.current].forEach(alvo => { if (alvo) observador.observe(alvo); });
    return () => observador.disconnect();
  });
  useEffect(() => {
    if (!aviso || !avisoRef.current || reduzMovimento()) return;
    gsap.fromTo(avisoRef.current, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.25, ease: 'power2.out', clearProps: 'transform,opacity' });
  }, [aviso]);

  const escolherVista = (proxima: VistaCadastros) => {
    setVista(proxima);
    setDetalheId(null);
    setMarcados(new Set());
    if (proxima === 'lixeira') return;
    setCategoria(proxima);
    setBusca('');
    setFiltros({});
    setSituacao('ativos');
    setOrganograma(false);
    setOrdem({ coluna: COLUNAS[proxima][0].id, direcao: 'asc' });
  };

  const ordenar = (coluna: string) => setOrdem(atual => (
    atual.coluna === coluna ? { coluna, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' } : { coluna, direcao: 'asc' }
  ));

  const limparFiltros = () => {
    setBusca('');
    setFiltros({});
    setSituacao('ativos');
  };

  // ---- Gravar -------------------------------------------------------------

  // O Desfazer roda segundos depois. Ele usa as funções do App da última
  // renderização: as de antes ainda enxergam a lista sem a exclusão.
  const ultimas = useRef(props);
  ultimas.current = props;

  const gravar = (registro: RegistroCadastro, novo: boolean, onError?: (error: Error) => void, tabela = TABELA_DA_CATEGORIA[categoria]) => {
    const props = ultimas.current;
    if (tabela === 'empresas') props.onSaveEmpresa(registro as Empresa, novo, onError);
    else if (tabela === 'funcionarios') props.onSaveFuncionario(registro as Funcionario, novo);
    else if (tabela === 'equipamentos') props.onSaveEquipamento(registro as Equipamento, novo);
    else if (tabela === 'obras') props.onSaveObra(registro as ObraLocal, novo);
    else if (tabela === 'comboios') props.onSaveComboio(registro as Comboio, novo);
    else if (tabela === 'combustiveis') props.onSaveTipoCombustivel(registro as TipoCombustivel, novo);
    else if (tabela === 'lubrificantes') props.onSaveProdutoLubrificacao(registro as ProdutoLubrificacao, novo);
    else props.onSaveEtapaServico(registro as EtapaServico, novo);
  };

  const abrirNovo = () => {
    if (vista === 'lixeira') setVista(categoria);
    setErroFormulario('');
    setDetalheId(null);
    setFormulario({ editandoId: null, valores: valoresIniciais(categoria, undefined, dados) });
  };

  const abrirEdicao = (linha: LinhaCadastro) => {
    setErroFormulario('');
    setDetalheId(null);
    setFormulario({ editandoId: linha.id, valores: valoresIniciais(categoria, linha.registro, dados) });
  };

  const salvarFormulario = (valores: ValoresCadastro) => {
    if (!formulario) return;
    const anterior = formulario.editandoId ? todasAsLinhas.find(linha => linha.id === formulario.editandoId)?.registro : undefined;
    const id = formulario.editandoId || novoId(categoria, dados);
    const montado = montarRegistro(categoria, valores, anterior, id, dados);
    if (montado.ok === false) {
      setErroFormulario(montado.erro);
      return;
    }
    // Mesma checagem do App (matrícula, prefixo, CNPJ e nome repetidos), feita
    // aqui para o erro aparecer no formulário em vez de só no sino.
    if (['empresas', 'funcionarios', 'equipamentos', 'obras'].includes(tabela)) {
      const erros = validateCentralRecord({ empresas, equipamentos, funcionarios, obras, record: montado.registro as Empresa });
      if (erros.length > 0) {
        setErroFormulario(erros.join(' '));
        return;
      }
    }
    setSalvando(true);
    const novo = !formulario.editandoId;
    let falhou = false;
    gravar(montado.registro, novo, error => {
      falhou = true;
      setAviso({ tipo: 'erro', texto: `Salvo neste aparelho, mas não chegou à nuvem: ${error.message}` });
    });
    setSalvando(false);
    if (falhou) return;
    setFormulario(null);
    setDetalheId(id);
    setAviso({ tipo: 'ok', texto: novo ? `${montado.registro && 'nome' in montado.registro ? montado.registro.nome : 'Cadastro'} cadastrado.` : 'Alterações salvas.' });
  };

  // ---- Inativar, reativar, excluir e restaurar ---------------------------

  const registroComSituacao = (linha: LinhaCadastro, ativo: boolean): RegistroCadastro => {
    const registro = linha.registro;
    if (tabela === 'empresas') return { ...(registro as Empresa), status: ativo ? 'ATIVO' : 'INATIVO', atualizadoEm: new Date().toISOString() };
    if (tabela === 'funcionarios') return { ...(registro as Funcionario), status: ativo ? 'ATIVO' : 'DESMOBILIZADO', ativo };
    if (tabela === 'equipamentos') return { ...(registro as Equipamento), status: ativo ? 'Ativo' : 'Desmobilizado', mobilizado: ativo ? (registro as Equipamento).mobilizado : false };
    return { ...(registro as ObraLocal), status: ativo ? 'Ativa' : 'Concluída' };
  };

  const inativar = (linha: LinhaCadastro) => {
    if (tabela === 'obras') gravar(registroComSituacao(linha, false), false);
    else onInativar(tabela, linha.id);
    const original = linha.registro;
    const tabelaDoRegistro = tabela;
    setConfirmacao(null);
    setDetalheId(null);
    setAviso({ tipo: 'ok', texto: `${linha.titulo} inativado.`, desfazer: () => { gravar(original, false, undefined, tabelaDoRegistro); setAviso({ tipo: 'ok', texto: `${linha.titulo} voltou a ficar ativo.` }); } });
  };

  const reativar = (linha: LinhaCadastro) => {
    gravar(registroComSituacao(linha, true), false);
    setAviso({ tipo: 'ok', texto: `${linha.titulo} está ativo de novo.` });
  };

  const pedirExclusao = (linha: LinhaCadastro) => {
    setConfirmacao({ acao: 'excluir', linha, usos: usosDoCadastro(tabela, linha.id) });
  };

  const confirmar = () => {
    if (!confirmacao || processando) return;
    const { acao, linha } = confirmacao;
    if (acao === 'inativar') {
      inativar(linha);
      return;
    }
    setProcessando(true);
    const resultado = onExcluir(tabela, linha.id, linha.titulo);
    setProcessando(false);
    if (resultado.ok === false) {
      if (resultado.usos.length > 0) setConfirmacao({ acao, linha, usos: resultado.usos });
      else {
        setConfirmacao(null);
        setAviso({ tipo: 'erro', texto: resultado.mensagem || 'Não deu para excluir.' });
      }
      return;
    }
    setConfirmacao(null);
    setDetalheId(null);
    setAviso({
      tipo: 'ok',
      texto: `${linha.titulo} excluído.`,
      desfazer: () => {
        const volta = ultimas.current.onRestaurar(resultado.exclusaoId);
        setAviso({ tipo: volta.ok ? 'ok' : 'erro', texto: volta.mensagem });
      },
    });
  };

  // ---- Seleção e exclusão em lote ---------------------------------------

  const alternarMarcado = (id: string) => setMarcados(atual => {
    const proximo = new Set(atual);
    if (proximo.has(id)) proximo.delete(id);
    else proximo.add(id);
    return proximo;
  });

  const alternarPagina = (ids: string[], marcar: boolean) => setMarcados(atual => {
    const proximo = new Set(atual);
    ids.forEach(id => (marcar ? proximo.add(id) : proximo.delete(id)));
    return proximo;
  });

  const pedirExclusaoEmLote = () => {
    const escolhidas = todasAsLinhas.filter(linha => marcados.has(linha.id));
    const livres: LinhaCadastro[] = [];
    const travados: ItemTravado[] = [];
    escolhidas.forEach(linha => {
      const usos = usosDoCadastro(tabela, linha.id);
      if (usos.length > 0) travados.push({ id: linha.id, titulo: linha.titulo, usos });
      else livres.push(linha);
    });
    setLote({ livres, travados });
  };

  const confirmarLote = () => {
    if (!lote || processando) return;
    setProcessando(true);
    const deFora = lote.travados.length;
    const resultado = ultimas.current.onExcluirVarios(tabela, lote.livres.map(linha => ({ id: linha.id, rotulo: linha.titulo })));
    setProcessando(false);
    setLote(null);
    if (resultado.excluidos.length === 0) {
      setAviso({ tipo: 'erro', texto: resultado.mensagem || 'Nenhum cadastro foi excluído.' });
      return;
    }
    setMarcados(new Set());
    setDetalheId(null);
    const total = resultado.excluidos.length;
    // Os travados na janela nem foram enviados; o App ainda pode travar algum que ganhou uso no meio.
    const ficaram = deFora + resultado.travados.length;
    const ids = resultado.excluidos.map(item => item.exclusaoId);
    setAviso({
      tipo: 'ok',
      texto: `${total.toLocaleString('pt-BR')} ${total === 1 ? 'cadastro excluído' : 'cadastros excluídos'}.${ficaram > 0 ? ` ${ficaram.toLocaleString('pt-BR')} ${ficaram === 1 ? 'ficou' : 'ficaram'} por estar em uso.` : ''}`,
      desfazer: () => {
        const volta = ultimas.current.onRestaurarVarios(ids);
        setAviso({ tipo: volta.ok ? 'ok' : 'erro', texto: volta.mensagem });
      },
    });
  };

  const restaurar = (exclusao: ExclusaoRegistro) => {
    setRestaurandoId(exclusao.id);
    const resultado = onRestaurar(exclusao.id);
    setRestaurandoId(null);
    setAviso({ tipo: resultado.ok ? 'ok' : 'erro', texto: resultado.mensagem });
  };

  const confirmarApagarDeVez = () => {
    if (!apagando) return;
    const resultado = onApagarDeVez(apagando.map(item => item.id));
    setApagando(null);
    setAviso({ tipo: resultado.ok ? 'ok' : 'erro', texto: resultado.mensagem });
  };

  // ---- Importar e exportar ------------------------------------------------

  const importarArquivo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;
    try {
      const { abas, ocultas } = await parseWorkbookFile(arquivo);
      const comLinhas = abas.filter(aba => aba.linhas.length > 0);
      if (comLinhas.length === 0) {
        setAviso({ tipo: 'erro', texto: ocultas > 0 && abas.length === 0
          ? 'A planilha só tem abas ocultas. Reexiba a aba do cadastro no Excel e importe de novo.'
          : 'A planilha não tem linhas para importar.' });
        return;
      }
      if (comLinhas.length === 1) setImportacao({ fileName: arquivo.name, rows: comLinhas[0].linhas });
      else setEscolhaDeAba({ fileName: arquivo.name, abas: comLinhas, sugerida: abaSugerida(comLinhas, [categoriaAtual.label, categoria]), ocultas });
    } catch (error: unknown) {
      console.error('Erro ao importar planilha de cadastros:', error);
      setAviso({ tipo: 'erro', texto: error instanceof Error && error.message ? error.message : 'Não foi possível ler a planilha. Use CSV, TSV, XLSX ou XLSM.' });
    } finally {
      if (arquivoRef.current) arquivoRef.current.value = '';
    }
  };

  const confirmarImportacao = () => {
    if (!importacao || confirmandoImportacao) return;
    setConfirmandoImportacao(true);
    const resultado = onImportCadastros(categoria, importacao.rows);
    setAviso({ tipo: resultado.success ? 'ok' : 'erro', texto: resultado.message });
    setImportacao(null);
    setConfirmandoImportacao(false);
  };

  const exportar = async () => {
    if (exportando) return;
    setExportando(true);
    try {
      const { autoFitCorporateColumns, createCorporateWorkbook, downloadCorporateWorkbook, styleCorporateWorksheet } = await import('../utils/excelCorporate');
      const planilha = await createCorporateWorkbook();
      const aba = planilha.addWorksheet(categoriaAtual.label.slice(0, 31));
      const colunas = COLUNAS[categoria];
      aba.addRow([...colunas.map(coluna => coluna.label), ...(comSituacao ? ['Situação'] : []), 'Código']);
      linhasFiltradas.forEach(linha => aba.addRow([...colunas.map(coluna => linha.colunas[coluna.id] || ''), ...(comSituacao ? [linha.situacao] : []), linha.id]));
      styleCorporateWorksheet(aba, { title: categoriaAtual.label, headerRow: 1, freezeRows: 1, recordCount: linhasFiltradas.length });
      autoFitCorporateColumns(aba);
      const hoje = new Date();
      const dia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
      await downloadCorporateWorkbook(planilha, `RENEA_${categoria}_${dia}.xlsx`);
    } catch (error) {
      console.error('Erro ao exportar cadastros:', error);
      setAviso({ tipo: 'erro', texto: 'Não deu para gerar a planilha. Tente de novo.' });
    } finally {
      setExportando(false);
    }
  };

  // ---- Tela ---------------------------------------------------------------

  const filtrosDoTipo = FILTROS[categoria];
  const filtrosAtivos = Object.entries(filtros).filter(([, valor]) => valor);
  const temConsulta = Boolean(busca) || filtrosAtivos.length > 0 || situacao !== 'ativos';
  const emLixeira = vista === 'lixeira';

  return (
    <div ref={escopo} className="erp-module erp-module--cadastros space-y-4" id="cadastros-tab" data-testid="cadastros-tab">
      <div data-cadastros-reveal>
        <PageHeader
          className="cadastros-header"
          eyebrow="Base corporativa"
          title="Cadastros"
          description="Escolha o tipo, filtre e abra o cadastro. O que for gravado aqui vale para a obra inteira."
          actions={<>
            {!emLixeira && (
              <button type="button" onClick={exportar} disabled={exportando || linhasFiltradas.length === 0} className={`${BOTAO_SECUNDARIO} max-sm:hidden`}>
                <Download className="size-5" aria-hidden="true" />
                {exportando ? 'Gerando…' : 'Exportar lista'}
              </button>
            )}
            {podeEditar && (
              <button type="button" onClick={() => arquivoRef.current?.click()} className={BOTAO_SECUNDARIO}>
                <Upload className="size-5" aria-hidden="true" />
                Importar planilha
              </button>
            )}
            <input ref={arquivoRef} type="file" accept=".xlsx,.xlsm,.csv,.tsv" onChange={importarArquivo} className="hidden" />
            {podeEditar && (
              <button type="button" data-testid="cadastro-acao-principal" onClick={abrirNovo} className={`${BOTAO_PRIMARIO} max-sm:order-first px-5`}>
                <Plus className="size-5" aria-hidden="true" />
                {categoriaAtual.acaoNovo}
              </button>
            )}
          </>}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start">
        <CadastroTipos value={vista} contar={item => totais.get(item) ?? 0} onSelect={escolherVista} mostrarLixeira={podeExcluir || lixeira.length > 0} />

        <div ref={listaRef} className="min-w-0 space-y-3">
          {emLixeira ? (
            <>
              <div data-cadastros-reveal className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-slate-900">Lixeira</h2>
                  {podeExcluir && lixeira.length > 1 && (
                    <button type="button" onClick={() => setApagando(lixeira)} className={BOTAO_PERIGO_LEVE} data-testid="lixeira-esvaziar">
                      <Trash2 className="size-5" aria-hidden="true" />
                      Esvaziar Lixeira
                    </button>
                  )}
                </div>
                <p className="text-sm text-slate-500">Cadastros excluídos. Restaurar devolve o cadastro para a lista em todos os aparelhos. Excluir de vez tira daqui e não tem volta.</p>
              </div>
              <CadastroLixeira exclusoes={lixeira} podeRestaurar={podeExcluir} restaurandoId={restaurandoId} onRestaurar={restaurar} onExcluirDeVez={item => setApagando([item])} />
            </>
          ) : (
            <>
              <div ref={topoFixoRef} data-cadastros-reveal className="lg:sticky lg:top-0 lg:z-20 lg:-mt-2 lg:bg-white lg:pb-2 lg:pt-2">
                <FilterBar label="Filtros de cadastros" className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="w-full space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        <input
                          type="search"
                          aria-label="Buscar cadastros"
                          placeholder={`Buscar em ${categoriaAtual.label.toLowerCase()}`}
                          value={busca}
                          onChange={event => setBusca(event.target.value)}
                          className={`${CAMPO} pl-11`}
                        />
                      </div>
                      {comSituacao && (
                        <div role="radiogroup" aria-label="Situação" className="grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200 bg-white text-sm font-semibold">
                          {([
                            ['ativos', 'Ativos', contagem.ativos],
                            ['inativos', 'Inativos', contagem.inativos],
                            ['todos', 'Todos', contagem.todos],
                          ] as const).map(([valor, rotulo, total]) => (
                            <button
                              key={valor}
                              type="button"
                              role="radio"
                              aria-checked={situacao === valor}
                              onClick={() => setSituacao(valor)}
                              className={`flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap border-r border-slate-200 px-3 transition-colors duration-150 last:border-0 ${FOCO} ${situacao === valor ? 'bg-[#176b4d] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                              {rotulo}
                              <span className={`text-xs tabular-nums ${situacao === valor ? 'text-white/70' : 'text-slate-400'}`}>{total}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {filtrosDoTipo.length > 0 && (
                        <button
                          type="button"
                          aria-expanded={filtrosAbertos}
                          onClick={() => setFiltrosAbertos(atual => !atual)}
                          className={`${BOTAO_SECUNDARIO} sm:hidden`}
                        >
                          <SlidersHorizontal className="size-5" aria-hidden="true" />
                          {filtrosAtivos.length > 0 ? `Filtros · ${filtrosAtivos.length}` : 'Filtros'}
                        </button>
                      )}
                      {categoria === 'funcionarios' && (
                        <button
                          type="button"
                          aria-pressed={organograma}
                          onClick={() => setOrganograma(atual => !atual)}
                          className={`${BOTAO_SECUNDARIO} shrink-0 px-3 ${organograma ? 'border-emerald-500 text-[#176b4d]' : ''}`}
                        >
                          <Network className="size-5" aria-hidden="true" />
                          {organograma ? 'Esconder organograma' : 'Organograma'}
                        </button>
                      )}
                    </div>

                    {filtrosDoTipo.length > 0 && (
                      <div className={`${filtrosAbertos ? 'grid' : 'hidden'} gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-4`}>
                        {filtrosDoTipo.map(filtro => (
                          <label key={filtro.id} className="min-w-0">
                            <span className="sr-only">{filtro.label}</span>
                            <select
                              value={filtros[filtro.id] || ''}
                              onChange={event => setFiltros(atual => ({ ...atual, [filtro.id]: event.target.value }))}
                              className={`${CAMPO} cursor-pointer ${filtros[filtro.id] ? 'border-[#f26a2e]/60 bg-orange-50/40' : ''}`}
                            >
                              <option value="">{filtro.label}: todos</option>
                              {opcoesDoFiltro(todasAsLinhas, filtro.id).map(opcao => (
                                <option key={opcao.valor} value={opcao.valor}>{`${opcao.valor} (${opcao.total})`}</option>
                              ))}
                            </select>
                          </label>
                        ))}
                      </div>
                    )}

                    {(filtrosAtivos.length > 0 || temConsulta) && (
                      <div className="flex flex-wrap items-center gap-2">
                        {filtrosAtivos.map(([id, valor]) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setFiltros(atual => ({ ...atual, [id]: '' }))}
                            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#f26a2e]/40 bg-orange-50 px-3 text-sm font-medium text-slate-800 ${FOCO}`}
                          >
                            {filtrosDoTipo.find(filtro => filtro.id === id)?.label}: {valor}
                            <X className="size-4" aria-label="Tirar filtro" />
                          </button>
                        ))}
                        {temConsulta && (
                          <button type="button" onClick={limparFiltros} className={`min-h-9 rounded-lg px-2 text-sm font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline ${FOCO}`}>
                            Limpar filtros
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </FilterBar>
              </div>

              {organograma && categoria === 'funcionarios' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <OrganizationChart
                    funcionarios={linhasFiltradas.map(linha => linha.registro as Funcionario)}
                    empresas={empresas}
                    activeId={organogramaAtivoId}
                    onActiveIdChange={setOrganogramaAtivoId}
                  />
                </div>
              )}

              <section id="database-lists-viewport" aria-label={`Lista de ${categoriaAtual.label.toLowerCase()}`} className="space-y-3">
                {podeExcluir && marcados.size > 0 && (
                  <div role="region" aria-label="Cadastros marcados" ref={barraSelecaoRef} data-testid="cadastro-barra-selecao" className="sticky top-2 z-10 lg:top-[var(--cad-filtros,0px)] flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-2 shadow-sm sm:pl-4">
                    <p className="basis-full px-2 pt-1 text-sm font-bold text-emerald-900 sm:mr-auto sm:basis-auto sm:p-0" aria-live="polite">
                      {marcados.size.toLocaleString('pt-BR')} {marcados.size === 1 ? 'marcado' : 'marcados'}
                    </p>
                    {marcados.size < linhasFiltradas.length && (
                      <button type="button" onClick={() => alternarPagina(linhasFiltradas.map(linha => linha.id), true)} className={`${BOTAO_SECUNDARIO} px-3 max-sm:flex-1`} data-testid="cadastro-marcar-todos">
                        Marcar todos os {linhasFiltradas.length.toLocaleString('pt-BR')}
                      </button>
                    )}
                    <button type="button" onClick={() => setMarcados(new Set())} className={`${BOTAO_SECUNDARIO} px-3 max-sm:flex-1`}>
                      Desmarcar
                    </button>
                    <button type="button" onClick={pedirExclusaoEmLote} className={`${BOTAO_PERIGO} px-3 max-sm:basis-full`} data-testid="cadastro-excluir-marcados">
                      <Trash2 className="size-5" aria-hidden="true" />
                      Excluir marcados
                    </button>
                  </div>
                )}
                <CadastroLista
                  linhas={linhasFiltradas}
                  colunas={COLUNAS[categoria]}
                  mostrarSituacao={comSituacao}
                  ordem={ordem}
                  onOrdenar={ordenar}
                  pagina={pagina}
                  onPagina={setPagina}
                  selecionadoId={detalheId}
                  onAbrir={linha => setDetalheId(linha.id)}
                  selecao={podeExcluir ? { marcados, onAlternar: alternarMarcado, onAlternarPagina: alternarPagina } : undefined}
                  vazio={todasAsLinhas.length === 0
                    ? {
                        titulo: `Nenhum cadastro em ${categoriaAtual.label.toLowerCase()}`,
                        texto: podeEditar ? 'Cadastre o primeiro pelo botão verde ou importe uma planilha.' : 'Ainda não há nada cadastrado aqui.',
                        acao: podeEditar ? { label: categoriaAtual.acaoNovo, onClick: abrirNovo } : undefined,
                      }
                    : {
                        titulo: 'Nada encontrado',
                        texto: 'Nenhum cadastro bate com a busca e os filtros escolhidos.',
                        acao: { label: 'Limpar filtros', onClick: limparFiltros },
                      }}
                />
              </section>
            </>
          )}
        </div>
      </div>

      {linhaDetalhe && !formulario && !confirmacao && (
        <CadastroDetalhe
          categoria={categoria}
          linha={linhaDetalhe}
          dados={dados}
          usos={usosDetalhe}
          historico={historicoDetalhe}
          podeEditar={podeEditar}
          podeExcluir={podeExcluir}
          onEditar={() => abrirEdicao(linhaDetalhe)}
          onInativar={() => setConfirmacao({ acao: 'inativar', linha: linhaDetalhe, usos: [] })}
          onReativar={() => reativar(linhaDetalhe)}
          onExcluir={() => pedirExclusao(linhaDetalhe)}
          onFechar={() => setDetalheId(null)}
        />
      )}

      {formulario && (
        <CadastroFormulario
          key={formulario.editandoId || 'novo'}
          categoria={categoria}
          titulo={formulario.editandoId ? todasAsLinhas.find(linha => linha.id === formulario.editandoId)?.titulo || categoriaAtual.label : categoriaAtual.acaoNovo}
          editandoId={formulario.editandoId}
          valoresIniciais={formulario.valores}
          dados={dados}
          erro={erroFormulario}
          salvando={salvando}
          onSalvar={salvarFormulario}
          onFechar={() => setFormulario(null)}
        />
      )}

      {lote && (
        <CadastroConfirmacaoLote
          tipo={categoriaAtual.label}
          livres={lote.livres.length}
          travados={lote.travados}
          processando={processando}
          onConfirmar={confirmarLote}
          onCancelar={() => setLote(null)}
        />
      )}

      {apagando && (
        <CadastroConfirmacao
          acao="excluir-de-vez"
          nome={apagando.length === 1 ? apagando[0].rotulo : `${apagando.length.toLocaleString('pt-BR')} cadastros da Lixeira`}
          codigo=""
          usos={[]}
          podeInativar={false}
          processando={false}
          onConfirmar={confirmarApagarDeVez}
          onInativarNoLugar={() => setApagando(null)}
          onCancelar={() => setApagando(null)}
        />
      )}

      {confirmacao && (
        <CadastroConfirmacao
          acao={confirmacao.acao}
          nome={confirmacao.linha.titulo}
          codigo={confirmacao.linha.id}
          usos={confirmacao.usos}
          podeInativar={comSituacao}
          processando={processando}
          onConfirmar={confirmar}
          onInativarNoLugar={() => setConfirmacao({ acao: 'inativar', linha: confirmacao.linha, usos: [] })}
          onCancelar={() => setConfirmacao(null)}
        />
      )}

      {escolhaDeAba && createPortal(
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="cadastro-aba-titulo">
          <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6" data-testid="cadastro-escolher-aba">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#718087]">Importar {categoriaAtual.label.toLowerCase()}</p>
                <h2 id="cadastro-aba-titulo" className="mt-1 text-xl font-bold text-slate-900">Qual aba da planilha tem os cadastros?</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {escolhaDeAba.fileName} tem {escolhaDeAba.abas.length} abas com linhas.
                  {escolhaDeAba.ocultas > 0 && ` ${escolhaDeAba.ocultas} aba${escolhaDeAba.ocultas > 1 ? 's ocultas foram ignoradas' : ' oculta foi ignorada'}.`}
                </p>
              </div>
              <button type="button" onClick={() => setEscolhaDeAba(null)} aria-label="Cancelar importação" className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 ${FOCO}`}>
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-5 grid gap-2">
              {escolhaDeAba.abas.map(aba => {
                const sugerida = aba.nome === escolhaDeAba.sugerida;
                return (
                  <button
                    key={aba.nome}
                    type="button"
                    onClick={() => { setImportacao({ fileName: `${escolhaDeAba.fileName} · ${aba.nome}`, rows: aba.linhas }); setEscolhaDeAba(null); }}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 text-left transition duration-200 ${FOCO} ${sugerida ? 'border-[#176b4d] bg-emerald-50 hover:bg-emerald-100' : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50'}`}
                  >
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-base text-slate-900">{aba.nome}</strong>
                      <span className="text-sm text-slate-500">{aba.linhas.length.toLocaleString('pt-BR')} linha{aba.linhas.length === 1 ? '' : 's'}</span>
                    </span>
                    {sugerida && <span className="shrink-0 rounded-full bg-[#176b4d] px-2.5 py-1 text-xs font-bold text-white">Sugerida</span>}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-sm text-slate-500">Depois de escolher, você confere a amostra antes de gravar.</p>
          </div>
        </div>,
        document.body,
      )}

      <SpreadsheetImportReview
        open={Boolean(importacao)}
        title={`Importar ${categoriaAtual.label.toLowerCase()}`}
        fileName={importacao?.fileName || ''}
        validCount={importacao?.rows.length || 0}
        columns={importacao ? Object.keys(importacao.rows[0] || {}) : []}
        rows={importacao?.rows || []}
        note="Cadastros com a mesma chave são atualizados. Confira a amostra antes de gravar."
        confirming={confirmandoImportacao}
        onCancel={() => setImportacao(null)}
        onConfirm={confirmarImportacao}
      />

      {aviso && createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[115] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div
            ref={avisoRef}
            role="status"
            data-testid="cadastro-aviso"
            className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-2xl ${aviso.tipo === 'ok' ? 'bg-[#176b4d] text-white' : 'bg-rose-700 text-white'}`}
          >
            {aviso.tipo === 'ok' ? <CheckCircle className="size-5 shrink-0 text-white" aria-hidden="true" /> : <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />}
            <span className="min-w-0 flex-1">{aviso.texto}</span>
            {aviso.desfazer && (
              <button type="button" onClick={aviso.desfazer} className={`min-h-11 shrink-0 rounded-lg px-3 font-bold text-orange-300 hover:bg-white/10 ${FOCO}`}>
                Desfazer
              </button>
            )}
            <button type="button" aria-label="Fechar aviso" onClick={() => setAviso(null)} className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 ${FOCO}`}>
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
