/**
 * Manutenção: o dia da oficina (quem parou, por quanto tempo, até 10 h por
 * dia), a conferência de quem bateu o limite, o relatório do dia e as ordens
 * de serviço. As horas do dia saem dos eventos do controle diário da frota
 * (horasParadasDoDia); a OS guarda o atendimento.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { BarChart3, ClipboardCheck, ClipboardList, FileSpreadsheet, History, Plus, Search, Timer, Wrench } from 'lucide-react';
import type { ControleEquipamentoDiario, Equipamento, Funcionario, HistoryLog, OrdemServico } from '../types';
import { historicoDaManutencao } from '../utils/manutencaoHistorico';
import {
  FLUXO_MANUTENCAO,
  isOrdemEncerrada,
  proximoNumeroOrdemServico,
  proximoStatusManutencao,
} from '../utils/manutencao';
import { normalizeComparable } from '../utils/canonicalIdentity';
import {
  EQUIPMENT_FAMILIES,
  EQUIPMENT_FAMILY_LABELS,
  classifyEquipment,
  equipmentFamilyIcon,
  presentEquipment,
  type EquipmentFamily,
} from '../utils/equipmentPresentation';
import { downloadManutencaoWorkbook, downloadRelatorioManutencaoDia } from '../utils/manutencaoExport';
import { OBSERVACAO_LIMITE, horasMedidasDaOrdem } from '../utils/manutencaoLimite';
import { montarRelatorioManutencaoDia } from '../utils/relatorioManutencaoDia';
import { dataDeHoje, diasParaConferir, motivosDoDia, registrosDeManutencao } from '../utils/conferenciaManutencao';
import { buildMaintenanceQueue } from '../utils/maintenanceQueue';
import {
  Badge,
  ConfirmDialog,
  EmptyState,
  Modal,
  PageHeader,
  PeriodFilter,
  TabelaPadrao,
  buildPeriod,
  isoDay,
  statusTone,
  type ColunaTabela,
  type PeriodValue,
} from '../shared/ui';
import { AbasDaTela, idDaAba } from '../shared/ui/AbasDaTela';
import { TelaCheia } from '../shared/ui/TelaCheia';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO } from './cadastros/estilos';
import { Campo, Conferencia, Conferido, Etapa } from '../shared/ui/Lancamento';
import { ManutencaoHoje } from './manutencao/ManutencaoHoje';
import { FilaOficina } from './manutencao/FilaOficina';
import { ConferenciaManutencao } from './manutencao/ConferenciaManutencao';
import { RelatorioManutencaoDia } from './manutencao/RelatorioManutencaoDia';

interface ManutencaoTabProps {
  ordensServico: OrdemServico[];
  equipamentos: Equipamento[];
  /** Controle diário da frota: os eventos de entrada e liberação são a fonte das horas do dia. */
  controlesEquipamentos: ControleEquipamentoDiario[];
  /** Motoristas e operadores do Controle de Frotas, a mesma lista que o Quadro usa ao lançar. */
  motoristas?: Funcionario[];
  /** Quem está operando: entra como responsável e no log da alteração. */
  responsavel: string;
  podeEditar: boolean;
  /** Só o administrador muda uma decisão de conferência já tomada. */
  podeReabrirConferencia?: boolean;
  /** Histórico geral do sistema; a tela filtra o que é de manutenção. */
  historyLogs?: HistoryLog[];
  onSave: (ordem: OrdemServico, isNew: boolean) => void;
  /** "Liberar agora" e "Entrou em manutenção": o mesmo salvamento do Controle de Frotas e do Quadro. */
  onSaveControle: (registro: ControleEquipamentoDiario) => void;
  /** Decisão da conferência, com o texto do histórico (antes e depois). */
  onSalvarConferencia: (registro: ControleEquipamentoDiario, descricao: string) => void;
  /** Sem ele, a tela não mostra Excluir: só o administrador exclui (A7). */
  onDelete?: (id: string) => void;
  /** Busca já preenchida quando a tela abre vinda do Quadro. */
  buscaInicial?: string;
  /** Abre a máquina no Quadro de frotas. */
  onVerNoQuadro?: (prefixo: string) => void;
}

const TIPOS: OrdemServico['tipo'][] = ['Corretiva', 'Preventiva', 'Preditiva', 'Revisão'];
const PRIORIDADES: OrdemServico['prioridade'][] = ['Baixa', 'Média', 'Alta', 'Urgente'];
const STATUS_FILTRO = ['Todas', 'Em aberto', ...FLUXO_MANUTENCAO, 'Cancelada'] as const;
type Subtela = 'hoje' | 'conferencia' | 'relatorio' | 'ordens' | 'historico';

const prioridadeTone = (prioridade: OrdemServico['prioridade']) => {
  if (prioridade === 'Urgente') return 'danger' as const;
  if (prioridade === 'Alta') return 'warning' as const;
  if (prioridade === 'Média') return 'info' as const;
  return 'neutral' as const;
};

const formatarData = (valor?: string) => (valor ? valor.slice(0, 10).split('-').reverse().join('/') : '—');

const formularioVazio = (equipamentoId = '') => ({
  equipamentoId,
  tipo: 'Corretiva' as OrdemServico['tipo'],
  prioridade: 'Média' as OrdemServico['prioridade'],
  motivo: '',
  descricao: '',
  dataAbertura: isoDay(new Date()),
  horaAbertura: new Date().toTimeString().slice(0, 5),
  oficina: '',
  solucao: '',
  dataConclusao: '',
  horaConclusao: '',
  observacao: '',
});

export default function ManutencaoTab({
  ordensServico,
  equipamentos,
  controlesEquipamentos,
  motoristas = [],
  responsavel,
  podeEditar,
  podeReabrirConferencia = false,
  historyLogs = [],
  onSave,
  onSaveControle,
  onSalvarConferencia,
  onDelete,
  buscaInicial = '',
  onVerNoQuadro,
}: ManutencaoTabProps) {
  const escopo = useRef<HTMLElement>(null);
  // Quem chega do Quadro com um prefixo vai direto às ordens, onde fica a busca.
  const [subtela, setSubtela] = useState<Subtela>(buscaInicial ? 'ordens' : 'hoje');
  // As horas do dia correm com o relógio: refaz a conta a cada minuto.
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const relogio = window.setInterval(() => setAgora(new Date()), 60_000);
    return () => window.clearInterval(relogio);
  }, []);
  const hoje = dataDeHoje(agora);
  const [dataRelatorio, setDataRelatorio] = useState(hoje);
  const [busca, setBusca] = useState(buscaInicial);
  const [filtroStatus, setFiltroStatus] = useState<(typeof STATUS_FILTRO)[number]>('Em aberto');
  const [filtroFamilia, setFiltroFamilia] = useState<EquipmentFamily | 'todas'>('todas');
  const [filtroMotivo, setFiltroMotivo] = useState('todos');
  // Período amplo por padrão: a manutenção acompanha ordens que arrastam por
  // semanas, e abrir a tela já filtrando o mês esconderia OS ainda abertas.
  const [periodo, setPeriodo] = useState<PeriodValue>(() => buildPeriod('mes'));
  const [usarPeriodo, setUsarPeriodo] = useState(false);
  const [editando, setEditando] = useState<OrdemServico | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [form, setForm] = useState(formularioVazio());
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [exclusao, setExclusao] = useState<OrdemServico | null>(null);
  const [exportando, setExportando] = useState(false);
  const [avisoExport, setAvisoExport] = useState('');
  const equipamentoFieldRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches('input, textarea, select, [contenteditable="true"]');
      if (!formAberto && !isTyping && event.key.toLowerCase() === 'n' && !event.ctrlKey && !event.metaKey && podeEditar) {
        event.preventDefault();
        abrirNova();
      }
    };
    if (!formAberto) window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [formAberto, podeEditar]);

  /** O que já aconteceu com as ordens — abertura, edição e liberação. */
  const historico = useMemo(() => historicoDaManutencao(historyLogs), [historyLogs]);

  const registrosManutencao = useMemo(() => registrosDeManutencao(controlesEquipamentos), [controlesEquipamentos]);
  // Horas da OS = soma dos dias dela no controle da frota, cada dia até 10 h.
  // OS sem nenhum dia lançado não tem hora parada medida: fica vazio, não zero.
  const horasDaOrdem = (ordem: Pick<OrdemServico, 'id'>) => horasMedidasDaOrdem(ordem, registrosManutencao, agora);
  const relatorioHoje = useMemo(() => montarRelatorioManutencaoDia(hoje, registrosManutencao, ordensServico, agora), [hoje, registrosManutencao, ordensServico, agora]);
  const relatorioDoDia = useMemo(
    () => (dataRelatorio === hoje ? relatorioHoje : montarRelatorioManutencaoDia(dataRelatorio, registrosManutencao, ordensServico, agora)),
    [dataRelatorio, hoje, relatorioHoje, registrosManutencao, ordensServico, agora],
  );
  const motivosDoRelatorio = useMemo(() => motivosDoDia(relatorioDoDia, registrosManutencao, ordensServico), [relatorioDoDia, registrosManutencao, ordensServico]);
  const pendentes = useMemo(() => diasParaConferir(registrosManutencao, ordensServico, agora), [registrosManutencao, ordensServico, agora]);
  const paraConferir = pendentes.reduce((total, dia) => total + dia.aConferir, 0);

  const equipamentoPorId = useMemo(
    () => new Map(equipamentos.map(item => [item.id, item])),
    [equipamentos],
  );
  const prefixoDe = (equipamentoId: string) => equipamentoPorId.get(equipamentoId)?.prefixo || 'Frota não localizada';

  /** Motivos que realmente aparecem nas ordens — o filtro não inventa opção. */
  const motivosDisponiveis = useMemo(() => {
    const motivos = new Set<string>();
    ordensServico.forEach(ordem => {
      const motivo = (ordem.motivo || '').trim();
      if (motivo) motivos.add(motivo);
    });
    return Array.from(motivos).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [ordensServico]);

  const lista = useMemo(() => {
    const termo = normalizeComparable(busca).trim();
    return ordensServico
      .filter(ordem => {
        if (filtroStatus === 'Todas') return true;
        if (filtroStatus === 'Em aberto') return !isOrdemEncerrada(ordem.status);
        return ordem.status === filtroStatus;
      })
      .filter(ordem => (
        filtroFamilia === 'todas'
        || classifyEquipment(equipamentoPorId.get(ordem.equipamentoId)) === filtroFamilia
      ))
      .filter(ordem => filtroMotivo === 'todos' || (ordem.motivo || '').trim() === filtroMotivo)
      // O período olha a abertura: uma OS que começou dentro do recorte
      // pertence a ele mesmo que ainda não tenha liberação.
      .filter(ordem => !usarPeriodo || (
        ordem.dataAbertura >= periodo.from && ordem.dataAbertura <= periodo.to
      ))
      .filter(ordem => !termo || normalizeComparable(`${ordem.numero} ${prefixoDe(ordem.equipamentoId)} ${ordem.descricao} ${ordem.motivo || ''} ${ordem.responsavel} ${ordem.oficina || ''}`).includes(termo))
      .sort((a, b) => `${b.dataAbertura}${b.numero}`.localeCompare(`${a.dataAbertura}${a.numero}`));
  }, [ordensServico, filtroStatus, filtroFamilia, filtroMotivo, usarPeriodo, periodo.from, periodo.to, busca, equipamentoPorId]);

  // Os indicadores acompanham o recorte: com um filtro ativo, os números do
  // topo precisam falar do que está na tela, não do arquivo inteiro.
  const resumo = useMemo(() => {
    const abertas = lista.filter(ordem => !isOrdemEncerrada(ordem.status));
    return {
      abertas: abertas.length,
      aguardandoPeca: lista.filter(ordem => ordem.status === 'Aguardando Peça').length,
      concluidas: lista.filter(ordem => ordem.status === 'Concluída').length,
      pelaRegra: lista.filter(ordem => (ordem.observacao || '').includes(OBSERVACAO_LIMITE)).length,
      criticas: abertas.filter(ordem => ['Alta', 'Urgente'].includes(ordem.prioridade)).length,
    };
  }, [lista]);

  /** Fila de oficina: uma OS ativa por cartão, sem esconder equipamento sem cadastro. */
  const filaOperacional = useMemo(
    () => buildMaintenanceQueue(ordensServico, equipamentos, agora, controlesEquipamentos),
    [ordensServico, equipamentos, agora, controlesEquipamentos],
  );

  const familiasComOrdens = useMemo(() => {
    const contagem = new Map<EquipmentFamily, number>();
    ordensServico.forEach(ordem => {
      const familia = classifyEquipment(equipamentoPorId.get(ordem.equipamentoId));
      contagem.set(familia, (contagem.get(familia) || 0) + 1);
    });
    return EQUIPMENT_FAMILIES.filter(familia => contagem.has(familia))
      .map(familia => ({ familia, total: contagem.get(familia) || 0 }));
  }, [ordensServico, equipamentoPorId]);

  const filtrosAtivos = useMemo(() => [
    `Situação: ${filtroStatus}`,
    filtroFamilia === 'todas' ? '' : `Família: ${EQUIPMENT_FAMILY_LABELS[filtroFamilia]}`,
    filtroMotivo === 'todos' ? '' : `Motivo: ${filtroMotivo}`,
    usarPeriodo ? `Período: ${formatarData(periodo.from)} a ${formatarData(periodo.to)}` : '',
    busca.trim() ? `Busca: ${busca.trim()}` : '',
  ].filter(Boolean), [filtroStatus, filtroFamilia, filtroMotivo, usarPeriodo, periodo.from, periodo.to, busca]);

  const exportarExcel = async () => {
    if (exportando) return;
    setExportando(true);
    setAvisoExport('');
    try {
      if (subtela === 'relatorio') await downloadRelatorioManutencaoDia(relatorioDoDia);
      else await downloadManutencaoWorkbook({
        ordens: lista,
        registros: registrosManutencao,
        equipamentos,
        filtros: filtrosAtivos,
        periodo: usarPeriodo ? { from: periodo.from, to: periodo.to } : undefined,
      });
    } catch (error) {
      setAvisoExport(error instanceof Error ? error.message : 'Não foi possível gerar a planilha.');
    } finally {
      setExportando(false);
    }
  };

  const abrirNova = () => {
    setEditando(null);
    setForm(formularioVazio());
    setTentouSalvar(false);
    setFormAberto(true);
  };

  const abrirEdicao = (ordem: OrdemServico) => {
    setEditando(ordem);
    setForm({
      equipamentoId: ordem.equipamentoId,
      tipo: ordem.tipo,
      prioridade: ordem.prioridade,
      motivo: ordem.motivo || '',
      descricao: ordem.descricao || '',
      dataAbertura: ordem.dataAbertura || '',
      horaAbertura: ordem.horaAbertura || '',
      oficina: ordem.oficina || '',
      solucao: ordem.solucao || '',
      dataConclusao: ordem.dataConclusao || '',
      horaConclusao: ordem.horaConclusao || '',
      observacao: ordem.observacao || '',
    });
    setTentouSalvar(false);
    setFormAberto(true);
  };

  // Aviso de cada campo obrigatório, junto do campo; some quando a pessoa corrige.
  const errosCampo = tentouSalvar ? {
    equipamento: form.equipamentoId ? null : 'Selecione o equipamento da ordem.',
    descricao: form.descricao.trim() ? null : 'Descreva o problema para a oficina saber o que atender.',
    dataAbertura: form.dataAbertura ? null : 'Informe a data de abertura.',
  } : { equipamento: null, descricao: null, dataAbertura: null };

  const salvar = () => {
    setTentouSalvar(true);
    const primeiroInvalido = !form.equipamentoId ? 'os-equipamento' : !form.descricao.trim() ? 'os-descricao' : !form.dataAbertura ? 'os-dia' : null;
    if (primeiroInvalido) {
      document.getElementById(primeiroInvalido)?.focus();
      return;
    }
    const base: OrdemServico = {
      ...(editando || {
        id: `os-${Date.now()}`,
        numero: proximoNumeroOrdemServico(ordensServico),
        status: 'Aberta',
        responsavel,
        observacao: '',
      } as OrdemServico),
      equipamentoId: form.equipamentoId,
      tipo: form.tipo,
      prioridade: form.prioridade,
      motivo: form.motivo.trim(),
      descricao: form.descricao.trim(),
      dataAbertura: form.dataAbertura,
      horaAbertura: form.horaAbertura,
      oficina: form.oficina.trim(),
      solucao: form.solucao.trim(),
      dataConclusao: form.dataConclusao || undefined,
      horaConclusao: form.dataConclusao ? form.horaConclusao : undefined,
      observacao: form.observacao.trim(),
      responsavel: editando?.responsavel || responsavel,
    };
    // Horas paradas só congelam quando a ordem tem liberação; antes disso o
    // número é corrente e seria mentira gravar.
    const ordem: OrdemServico = {
      ...base,
      horasParadas: base.dataConclusao ? horasDaOrdem(base) : undefined,
    };
    onSave(ordem, !editando);
    setFormAberto(false);
    setEditando(null);
  };

  const avancar = (ordem: OrdemServico) => {
    const proximo = proximoStatusManutencao(ordem.status);
    if (!proximo) return;
    const hoje = new Date();
    const concluindo = proximo === 'Concluída';
    const atualizada: OrdemServico = {
      ...ordem,
      status: proximo,
      dataConclusao: concluindo ? (ordem.dataConclusao || isoDay(hoje)) : ordem.dataConclusao,
      horaConclusao: concluindo ? (ordem.horaConclusao || hoje.toTimeString().slice(0, 5)) : ordem.horaConclusao,
    };
    onSave({ ...atualizada, horasParadas: atualizada.dataConclusao ? horasDaOrdem(atualizada) : undefined }, false);
  };

  const colunasOrdens: ColunaTabela<OrdemServico>[] = [
    {
      chave: 'numero',
      titulo: 'OS',
      valorOrdenacao: ordem => ordem.numero,
      render: ordem => (
        <span className="flex flex-wrap items-center gap-1.5 lg:flex-nowrap">
          <strong className="whitespace-nowrap tabular-nums text-slate-900">{ordem.numero}</strong>
          <Badge tone={prioridadeTone(ordem.prioridade)}>{ordem.prioridade}</Badge>
        </span>
      ),
    },
    {
      chave: 'equipamento',
      titulo: 'Equipamento',
      larguraMinima: 110,
      valorOrdenacao: ordem => prefixoDe(ordem.equipamentoId),
      dica: ordem => [prefixoDe(ordem.equipamentoId), presentEquipment(equipamentoPorId.get(ordem.equipamentoId)).label].filter(Boolean).join(' · '),
      render: ordem => {
        const { Icon: EquipmentIcon, label: equipmentLabel } = presentEquipment(equipamentoPorId.get(ordem.equipamentoId));
        return (
          <span className="flex items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-800" aria-hidden="true">
              <EquipmentIcon className="size-4" strokeWidth={1.7} />
            </span>
            <span className="min-w-0 lg:truncate">
              <strong className="text-slate-800">{prefixoDe(ordem.equipamentoId)}</strong>
              {/* O tipo fica no cartão do celular e na dica: na tabela, a coluna estreita deixa as ações à vista a 1366 px. */}
              <small className="text-xs text-slate-500 md:hidden"> · {equipmentLabel}</small>
            </span>
          </span>
        );
      },
    },
    {
      chave: 'problema',
      titulo: 'Problema',
      larguraMinima: 100,
      valorOrdenacao: ordem => ordem.descricao || ordem.motivo,
      dica: ordem => ordem.descricao || ordem.motivo,
      render: ordem => ordem.descricao || ordem.motivo || '—',
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      dica: ordem => [ordem.status, (ordem.observacao || '').includes(OBSERVACAO_LIMITE) ? 'Pelo limite de 10 h' : ''].filter(Boolean).join(' · '),
      valorOrdenacao: ordem => ordem.status,
      render: ordem => (
        <span className="flex flex-wrap items-center gap-1 lg:flex-nowrap">
          <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${statusTone(ordem.status)}`}>{ordem.status}</span>
          {(ordem.observacao || '').includes(OBSERVACAO_LIMITE) && <span className="inline-flex whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">Pelo limite de 10 h</span>}
        </span>
      ),
    },
    {
      chave: 'abertura',
      titulo: 'Abertura',
      valorOrdenacao: ordem => `${ordem.dataAbertura} ${ordem.horaAbertura || ''}`,
      dica: ordem => `${formatarData(ordem.dataAbertura)}${ordem.horaAbertura ? ` às ${ordem.horaAbertura}` : ''}`,
      // Dia e mês na linha (o ano fica na dica): a coluna estreita deixa as ações à vista a 1366 px.
      render: ordem => <span className="whitespace-nowrap tabular-nums">{formatarData(ordem.dataAbertura).slice(0, 5)}{ordem.horaAbertura ? ` ${ordem.horaAbertura}` : ''}</span>,
    },
    {
      chave: 'horas',
      titulo: 'Horas',
      alinhamento: 'direita',
      valorOrdenacao: ordem => horasDaOrdem(ordem),
      dica: ordem => (isOrdemEncerrada(ordem.status) ? undefined : 'Em curso: conta até agora, no máximo 10 h por dia.'),
      render: ordem => {
        const horas = horasDaOrdem(ordem);
        if (horas === undefined) return '—';
        return (
          <span className="whitespace-nowrap">{`${horas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`}</span>
        );
      },
    },
  ];
  const BOTAO_LINHA = 'min-h-11 rounded-lg border bg-white px-2 text-[13px] font-bold transition-colors md:min-h-8';
  const acoesDaOrdem = podeEditar
    ? (ordem: OrdemServico) => {
      const proximo = proximoStatusManutencao(ordem.status);
      return (
        <>
          {proximo && <button type="button" onClick={() => avancar(ordem)} className={`${BOTAO_LINHA} border-emerald-300 text-emerald-800 hover:border-emerald-500`}>{proximo}</button>}
          <button type="button" onClick={() => abrirEdicao(ordem)} aria-label={`Editar OS ${ordem.numero}`} className={`${BOTAO_LINHA} border-slate-200 text-slate-700 hover:border-emerald-500 hover:text-emerald-800`}>Editar</button>
          {onDelete && <button type="button" onClick={() => setExclusao(ordem)} aria-label={`Excluir OS ${ordem.numero}`} className={`${BOTAO_LINHA} border-slate-200 text-rose-700 hover:border-rose-400`}>Excluir</button>}
        </>
      );
    }
    : undefined;

  useGSAP(() => {
    const raiz = escopo.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(raiz.querySelectorAll('[data-manutencao-reveal]'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power3.out', clearProps: 'transform,opacity' });
  }, { scope: escopo, dependencies: [subtela] });

  const subtelas = [
    { id: 'hoje' as const, rotulo: 'Hoje', curto: 'Hoje', icone: Timer, contador: relatorioHoje.linhas.filter(linha => linha.parada.periodos.some(periodo => periodo.fim === null)).length, contadorRotulo: 'parados agora', tom: 'neutro' as const },
    { id: 'conferencia' as const, rotulo: 'Conferência', curto: 'Conferir', icone: ClipboardCheck, contador: paraConferir, contadorRotulo: 'para conferir' },
    { id: 'ordens' as const, rotulo: 'Ordens de serviço', curto: 'OS', icone: ClipboardList },
    // Relatório do dia e Histórico dividem uma aba só: no máximo quatro no topo.
    {
      grupo: 'relatorios', rotulo: 'Relatórios', icone: BarChart3, abas: [
        { id: 'relatorio' as const, rotulo: 'Relatório do dia', curto: 'Do dia', icone: BarChart3 },
        { id: 'historico' as const, rotulo: 'Histórico', icone: History },
      ],
    },
  ];
  const exportaExcel = subtela === 'ordens' || subtela === 'relatorio';
  const semNadaParaExportar = subtela === 'relatorio' ? relatorioDoDia.linhas.length === 0 : lista.length === 0;

  return (
    <TelaCheia ref={escopo} id="manutencao-tab" rotulo="Manutenção"
      longa={subtela !== 'ordens'} idAbaAtiva={idDaAba('manutencao', subtela)} idDados="manutencao-dados" chaveRolagem={subtela}
      cabecalho={<PageHeader
       
        eyebrow="Frota"
        title="Manutenção"
        abas={<AbasDaTela<Subtela> id="manutencao" rotulo="Subtelas da manutenção" abas={subtelas} ativa={subtela} onTrocar={setSubtela} idPainel="manutencao-dados" testId="manutencao-aba" />}
        actions={<>
          {exportaExcel && (
            <button type="button" onClick={() => void exportarExcel()} disabled={exportando || semNadaParaExportar} className={BOTAO_SECUNDARIO}>
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> {exportando ? 'Gerando...' : 'Exportar Excel'}
            </button>
          )}
          {podeEditar && (
            <button type="button" onClick={abrirNova} className={BOTAO_PRIMARIO}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Abrir OS
            </button>
          )}
        </>}
      />}
      faixa={avisoExport && subtela === 'relatorio'
        ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{avisoExport}</p>
        : subtela === 'ordens' && <div data-manutencao-reveal className="space-y-2">
        {/* Números do recorte: acompanham os filtros logo abaixo. */}
        <ul aria-label="Números do recorte" className="flex flex-wrap items-center gap-1.5">
          {[
            { label: 'OS em aberto', valor: String(resumo.abertas), alerta: false },
            { label: 'Alta ou urgente', valor: String(resumo.criticas), alerta: resumo.criticas > 0 },
            { label: 'Aguardando peça', valor: String(resumo.aguardandoPeca), alerta: false },
            { label: 'Concluídas', valor: String(resumo.concluidas), alerta: false },
            { label: 'Pelo limite de 10 h', valor: String(resumo.pelaRegra), alerta: false },
          ].map(item => (
            <li key={item.label} className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-semibold ring-1 ring-inset ${item.alerta ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-white text-slate-600 ring-slate-200'}`}>
              {item.label} <strong className="tabular-nums text-slate-950">{item.valor}</strong>
            </li>
          ))}
        </ul>

        {avisoExport && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{avisoExport}</p>
        )}

        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="relative min-w-0 flex-1 sm:min-w-56">
            <span className="sr-only">Buscar ordem de serviço</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input
              type="search"
              value={busca}
              onChange={event => setBusca(event.target.value)}
              placeholder="Número, prefixo, problema, responsável..."
              className={`${CAMPO} pl-9 pr-3`}
            />
          </label>
          <select
            value={filtroStatus}
            onChange={event => setFiltroStatus(event.target.value as (typeof STATUS_FILTRO)[number])}
            aria-label="Filtrar por situação"
            className={`${CAMPO} sm:w-auto`}
          >
            {STATUS_FILTRO.map(item => <option key={item}>{item}</option>)}
          </select>
          <select
            value={filtroMotivo}
            onChange={event => setFiltroMotivo(event.target.value)}
            aria-label="Filtrar por motivo"
            className={`${CAMPO} sm:w-auto sm:max-w-[16rem]`}
          >
            <option value="todos">Todos os motivos</option>
            {motivosDisponiveis.map(motivo => <option key={motivo} value={motivo}>{motivo}</option>)}
          </select>
        </div>

        {familiasComOrdens.length > 1 && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por tipo de equipamento">
            <button
              type="button"
              onClick={() => setFiltroFamilia('todas')}
              aria-pressed={filtroFamilia === 'todas'}
              className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${filtroFamilia === 'todas' ? 'border-emerald-400 bg-emerald-50/80 text-emerald-800 shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
            >
              Todos <span className="tabular-nums text-slate-500">{ordensServico.length}</span>
            </button>
            {familiasComOrdens.map(({ familia, total }) => {
              const Icon = equipmentFamilyIcon(familia);
              const ativo = filtroFamilia === familia;
              return (
                <button
                  key={familia}
                  type="button"
                  onClick={() => setFiltroFamilia(ativo ? 'todas' : familia)}
                  aria-pressed={ativo}
                  title={EQUIPMENT_FAMILY_LABELS[familia]}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${ativo ? 'border-emerald-400 bg-emerald-50/80 text-emerald-800 shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                >
                  <Icon className="size-4" strokeWidth={1.7} aria-hidden="true" />
                  <span className="hidden sm:inline">{EQUIPMENT_FAMILY_LABELS[familia]}</span>
                  <span className="tabular-nums text-slate-500">{total}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
            <input
              type="checkbox"
              checked={usarPeriodo}
              onChange={event => setUsarPeriodo(event.target.checked)}
              className="size-6 accent-emerald-700"
            />
            Filtrar por período de abertura
          </label>
          {usarPeriodo && <PeriodFilter value={periodo} onChange={setPeriodo} />}
        </div>
      </div>}
    >
      {subtela === 'ordens' && (
        <TabelaPadrao
          exportar={false}
          titulo="Ordens de serviço"
          linhas={lista}
          colunas={colunasOrdens}
          idDaLinha={ordem => ordem.id}
          nomeDoItem={{ um: 'ordem de serviço', varios: 'ordens de serviço' }}
          acoes={acoesDaOrdem}
          onAbrirLinha={podeEditar ? abrirEdicao : undefined}
          vazio={<EmptyState icon={Wrench} title="Nenhuma ordem de serviço" description="Abra uma OS quando um equipamento precisar de atendimento." />}
        />
      )}

      {subtela === 'hoje' && (
        <>
          <ManutencaoHoje
            relatorio={relatorioHoje}
            registros={controlesEquipamentos}
            equipamentos={equipamentos}
            motoristas={motoristas}
            responsavel={responsavel}
            podeEditar={podeEditar}
            agora={agora}
            paraConferir={paraConferir}
            onAbrirConferencia={() => setSubtela('conferencia')}
            onSaveControle={onSaveControle}
            onSalvarConferencia={onSalvarConferencia}
          />
          <FilaOficina fila={filaOperacional} ordensServico={ordensServico} podeEditar={podeEditar} onAvancar={avancar} onEditar={abrirEdicao} onVerNoQuadro={onVerNoQuadro} />
        </>
      )}

      {subtela === 'conferencia' && (
        <ConferenciaManutencao
          registros={registrosManutencao}
          ordens={ordensServico}
          agora={agora}
          podeEditar={podeEditar}
          podeReabrir={podeReabrirConferencia}
          responsavel={responsavel}
          pendentes={pendentes}
          onSalvarConferencia={onSalvarConferencia}
        />
      )}

      {subtela === 'relatorio' && (
        <RelatorioManutencaoDia relatorio={relatorioDoDia} hoje={hoje} onData={setDataRelatorio} motivos={motivosDoRelatorio} />
      )}

      {/* Histórico: o que já aconteceu com as ordens, incluindo as abertas
          automaticamente pelo controle diário da frota. */}
      {subtela === 'historico' && (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" aria-label="Histórico de manutenção">
          <p className="border-b border-slate-200 px-4 py-2.5 text-sm text-slate-600">Aberturas, edições e liberações, inclusive as OS abertas pelo Controle de Frotas.</p>

          {historico.length === 0 ? (
            <EmptyState
              icon={History}
              title="Nenhum registro ainda"
              description="Assim que uma ordem for aberta, editada ou liberada, o movimento aparece aqui."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {historico.slice(0, 200).map(item => (
                <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                  <Badge tone={item.acao === 'Excluiu' ? 'danger' : item.acao === 'Criou' ? 'success' : 'info'}>
                    {item.acao}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-700">{item.descricao}</p>
                    <p className="mt-0.5 text-xs text-[#5b6870]">
                      {item.timestamp} · {item.usuario} · {item.tela}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {historico.length > 200 && (
            <p className="border-t border-slate-100 px-4 py-2 text-xs text-[#5b6870]">
              Mostrando os 200 movimentos mais recentes de {historico.length}.
            </p>
          )}
        </section>
      )}

      <Modal
        open={formAberto}
        title={editando ? `Editar ${editando.numero}` : 'Abrir ordem de serviço'}
        size="xl"
        onClose={() => setFormAberto(false)}
        onSubmit={salvar}
        initialFocusRef={equipamentoFieldRef}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setFormAberto(false)} className={BOTAO_SECUNDARIO}>Cancelar</button>
            <button type="button" onClick={salvar} className={BOTAO_PRIMARIO}>Salvar ordem</button>
          </div>
        )}
      >
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="grid min-w-0 gap-4">
            <Etapa numero={1} titulo="Qual equipamento e o que houve?" ajuda="O problema é o que a oficina lê primeiro." feita={Boolean(form.equipamentoId && form.descricao.trim())}>
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                <Campo rotulo="Equipamento" para="os-equipamento" obrigatorio erro={errosCampo.equipamento}>
                  <select id="os-equipamento" ref={equipamentoFieldRef} value={form.equipamentoId} onChange={event => setForm({ ...form, equipamentoId: event.target.value })} className={CAMPO}>
                    <option value="">Escolha</option>
                    {[...equipamentos]
                      .sort((a, b) => a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true }))
                      .map(item => <option key={item.id} value={item.id}>{item.prefixo} · {item.nome}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Categoria" para="os-tipo">
                  <select id="os-tipo" value={form.tipo} onChange={event => setForm({ ...form, tipo: event.target.value as OrdemServico['tipo'] })} className={CAMPO}>
                    {TIPOS.map(item => <option key={item}>{item}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Problema" para="os-motivo" className="sm:col-span-2">
                  <input id="os-motivo" value={form.motivo} onChange={event => setForm({ ...form, motivo: event.target.value })} placeholder="Quebra, preventiva, pneu, elétrica..." className={CAMPO} />
                </Campo>
                <Campo rotulo="Descrição" para="os-descricao" obrigatorio erro={errosCampo.descricao} className="sm:col-span-2">
                  <textarea id="os-descricao" value={form.descricao} onChange={event => setForm({ ...form, descricao: event.target.value })} rows={3} placeholder="O que aconteceu e o que precisa ser atendido" className={CAMPO} />
                </Campo>
              </div>
            </Etapa>

            <Etapa numero={2} titulo="Quando parou?" feita={Boolean(form.dataAbertura)}>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <Campo rotulo="Dia" para="os-dia" obrigatorio erro={errosCampo.dataAbertura}>
                  <input id="os-dia" type="date" value={form.dataAbertura} onChange={event => setForm({ ...form, dataAbertura: event.target.value })} className={CAMPO} />
                </Campo>
                <Campo rotulo="Hora" para="os-hora">
                  <input id="os-hora" type="time" value={form.horaAbertura} onChange={event => setForm({ ...form, horaAbertura: event.target.value })} className={CAMPO} />
                </Campo>
                <Campo rotulo="Prioridade" para="os-prioridade">
                  <select id="os-prioridade" value={form.prioridade} onChange={event => setForm({ ...form, prioridade: event.target.value as OrdemServico['prioridade'] })} className={CAMPO}>
                    {PRIORIDADES.map(item => <option key={item}>{item}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Oficina" para="os-oficina">
                  <input id="os-oficina" value={form.oficina} onChange={event => setForm({ ...form, oficina: event.target.value })} placeholder="Interna ou terceiro" className={CAMPO} />
                </Campo>
              </div>
            </Etapa>

            <Etapa numero={3} titulo="Quando voltou?" ajuda="Preencha só quando o equipamento for liberado." feita={Boolean(form.dataConclusao)}>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <Campo rotulo="Dia da liberação" para="os-dia-fim">
                  <input id="os-dia-fim" type="date" value={form.dataConclusao} onChange={event => setForm({ ...form, dataConclusao: event.target.value })} className={CAMPO} />
                </Campo>
                <Campo rotulo="Hora da liberação" para="os-hora-fim">
                  <input id="os-hora-fim" type="time" value={form.horaConclusao} onChange={event => setForm({ ...form, horaConclusao: event.target.value })} disabled={!form.dataConclusao} className={CAMPO} />
                </Campo>
                <Campo rotulo="Solução" para="os-solucao" className="col-span-2">
                  <textarea id="os-solucao" value={form.solucao} onChange={event => setForm({ ...form, solucao: event.target.value })} rows={2} placeholder="O que foi feito para liberar o equipamento" className={CAMPO} />
                </Campo>
                <Campo rotulo="Observação" para="os-obs" className="col-span-2">
                  <textarea id="os-obs" value={form.observacao} onChange={event => setForm({ ...form, observacao: event.target.value })} rows={2} className={CAMPO} />
                </Campo>
              </div>
            </Etapa>
          </div>

          <Conferencia subtitulo={editando ? editando.numero : 'A OS entra como Aberta.'}>
            <dl className="divide-y divide-slate-100">
              <Conferido rotulo="Equipamento" ok={Boolean(form.equipamentoId)} valor={equipamentos.find(item => item.id === form.equipamentoId)?.prefixo || 'falta'} />
              <Conferido rotulo="Descrição" ok={Boolean(form.descricao.trim())} valor={form.descricao.trim() ? (form.motivo.trim() || 'escrita') : 'falta'} />
              <Conferido rotulo="Parou" ok={Boolean(form.dataAbertura)} valor={form.dataAbertura ? `${form.dataAbertura.split('-').reverse().join('/')}${form.horaAbertura ? ` ${form.horaAbertura}` : ''}` : 'falta'} />
              <Conferido rotulo="Voltou" ok valor={form.dataConclusao ? `${form.dataConclusao.split('-').reverse().join('/')}${form.horaConclusao ? ` ${form.horaConclusao}` : ''}` : 'ainda parado'} />
            </dl>
            {editando && horasDaOrdem(editando) !== undefined && (
              <p className="rounded-xl bg-[#f7f8f6] px-3 py-2.5 text-sm text-slate-600">
                Horas paradas (até 10 h por dia): <strong>{horasDaOrdem(editando)?.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} h</strong>
              </p>
            )}
          </Conferencia>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(exclusao)}
        title={`Excluir ${exclusao?.numero}?`}
        description="A ordem sai da lista de manutenção. O histórico do sistema continua registrando a exclusão."
        confirmLabel="Excluir ordem"
        onCancel={() => setExclusao(null)}
        onConfirm={() => {
          if (exclusao) onDelete?.(exclusao.id);
          setExclusao(null);
        }}
      />
    </TelaCheia>
  );
}
