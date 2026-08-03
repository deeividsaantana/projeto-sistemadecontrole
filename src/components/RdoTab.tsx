import { useMemo, useState } from 'react';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  CloudSun,
  FileDown,
  FileSpreadsheet,
  HardHat,
  ImagePlus,
  LockKeyhole,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import type {
  ApontamentoRamoRegistro,
  Empresa,
  Equipamento,
  EtapaServico,
  Funcionario,
  GrupoEquipe,
  ListaPresenca,
  MaterialRegistro,
  ObraLocal,
  OrdemServico,
  ParteDiariaEquipamento,
  PresencaApontamento,
  RdoDiario,
  RdoProducaoItem,
  StatusDocumentoRdo,
  TicketJazida,
} from '../types';
import {
  buildRdoDailyConsolidation,
  canTransitionRdo,
  generateRdoNumber,
  prepareRdoVersion,
} from '../utils/rdoOperations';
import {
  addCorporateSummarySheet,
  configureCorporateWorkbook,
  downloadCorporateWorkbook,
  styleCorporateWorksheet,
} from '../utils/excelCorporate';

interface RdoTabProps {
  rdos: RdoDiario[];
  empresas: Empresa[];
  obras: ObraLocal[];
  equipamentos: Equipamento[];
  funcionarios: Funcionario[];
  etapas: EtapaServico[];
  listasPresenca: ListaPresenca[];
  gruposEquipe: GrupoEquipe[];
  presencasLink: PresencaApontamento[];
  apontamentos: ApontamentoRamoRegistro[];
  partesDiarias: ParteDiariaEquipamento[];
  tickets: TicketJazida[];
  materiais: MaterialRegistro[];
  ordensServico: OrdemServico[];
  activeUserName: string;
  onSaveRdo: (item: RdoDiario, isNew: boolean) => void;
  onDeleteRdo: (id: string) => void;
}

type ViewMode = 'list' | 'editor';

const STATUS_OPTIONS: StatusDocumentoRdo[] = ['Rascunho', 'Em revisão', 'Aprovado', 'Fechado'];
const ACTIVITY_OPTIONS: RdoDiario['statusAtividade'][] = [
  'Andamento',
  'Concluído',
  'Paralisado Chuva',
  'Paralisado Quebrado',
];
const STATUS_STYLE: Record<StatusDocumentoRdo, string> = {
  Rascunho: 'border-slate-600 bg-slate-500/10 text-slate-300',
  'Em revisão': 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  Aprovado: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  Fechado: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
};
const FIELD_CLASS = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-500';
const LABEL_CLASS = 'mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500';

const today = () => new Date().toISOString().slice(0, 10);
const formatDate = (value?: string) => {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};
const formatMoney = (value?: number) => Number(value || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const statusOf = (rdo: RdoDiario): StatusDocumentoRdo => rdo.statusDocumento || 'Rascunho';
const normalizeRdo = (rdo: RdoDiario): RdoDiario => ({
  ...rdo,
  numero: rdo.numero || `RDO-${rdo.data.replaceAll('-', '')}`,
  statusDocumento: statusOf(rdo),
  responsavelRdo: rdo.responsavelRdo || '',
  ocorrencias: rdo.ocorrencias || '',
  fotos: rdo.fotos || [],
  efetivoFuncionarioIds: rdo.efetivoFuncionarioIds || [],
  equipamentosResumo: rdo.equipamentosResumo || [],
  viagensResumo: rdo.viagensResumo || [],
  materiaisResumo: rdo.materiaisResumo || [],
  producaoItens: rdo.producaoItens || [],
  divergencias: rdo.divergencias || [],
  versao: rdo.versao || 1,
  revisoes: rdo.revisoes || [],
});

const compressPhoto = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Não foi possível ler a foto.'));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error('A imagem selecionada não é válida.'));
    image.onload = () => {
      const scale = Math.min(1, 900 / image.width, 650 / image.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('O navegador não conseguiu processar a foto.'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.58));
    };
    image.src = String(reader.result || '');
  };
  reader.readAsDataURL(file);
});

const Section = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:p-5">
    <div className="mb-4">
      <h3 className="text-sm font-black text-white">{title}</h3>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
    {children}
  </section>
);

export default function RdoTab({
  rdos,
  empresas,
  obras,
  equipamentos,
  funcionarios,
  etapas,
  listasPresenca,
  gruposEquipe,
  presencasLink,
  apontamentos,
  partesDiarias,
  tickets,
  materiais,
  ordensServico,
  activeUserName,
  onSaveRdo,
  onDeleteRdo,
}: RdoTabProps) {
  const [view, setView] = useState<ViewMode>('list');
  const [editing, setEditing] = useState<RdoDiario | null>(null);
  const [original, setOriginal] = useState<RdoDiario | undefined>();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | StatusDocumentoRdo>('Todos');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [manualProduction, setManualProduction] = useState({
    ramoNome: '',
    descricao: '',
    quantidade: 0,
    unidade: 'un',
  });

  const filteredRdos = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    return [...rdos]
      .map(normalizeRdo)
      .filter(rdo => {
        const obra = obras.find(item => item.id === rdo.obraLocalId);
        const company = empresas.find(item => item.id === rdo.empresaId);
        const matchesQuery = !normalizedQuery || [
          rdo.numero,
          obra?.nome,
          company?.nome,
          rdo.responsavelRdo,
          rdo.servicoExecutado,
        ].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(normalizedQuery));
        return matchesQuery
          && (statusFilter === 'Todos' || statusOf(rdo) === statusFilter)
          && (!dateStart || rdo.data >= dateStart)
          && (!dateEnd || rdo.data <= dateEnd);
      })
      .sort((first, second) => second.data.localeCompare(first.data) || String(second.numero).localeCompare(String(first.numero)));
  }, [dateEnd, dateStart, empresas, obras, query, rdos, statusFilter]);

  const metrics = useMemo(() => ({
    total: rdos.length,
    pending: rdos.filter(item => ['Rascunho', 'Em revisão'].includes(statusOf(item))).length,
    approved: rdos.filter(item => statusOf(item) === 'Aprovado').length,
    closed: rdos.filter(item => statusOf(item) === 'Fechado').length,
    divergences: rdos.reduce((total, item) => total + (item.divergencias?.length || 0), 0),
  }), [rdos]);

  const consolidation = (data: string, obraId: string) => buildRdoDailyConsolidation({
    data,
    obraId,
    empresas,
    obras,
    equipamentos,
    funcionarios,
    listasPresenca,
    gruposEquipe,
    presencasLink,
    apontamentos,
    partesDiarias,
    tickets,
    materiais,
    ordensServico,
  });

  const createRdo = () => {
    const obra = obras.find(item => item.status === 'Ativa') || obras[0];
    const company = empresas[0];
    const data = today();
    const consolidated = consolidation(data, obra?.id || '');
    const now = new Date().toISOString();
    setOriginal(undefined);
    setEditing({
      id: `rdo-${Date.now()}`,
      numero: generateRdoNumber(data, rdos.filter(item => item.data === data).length),
      data,
      empresaId: company?.id || '',
      obraLocalId: obra?.id || '',
      etapaServicoId: '',
      statusAtividade: 'Andamento',
      servicoExecutado: consolidated.servicoExecutado,
      quantidadeEquipe: consolidated.quantidadeEquipe,
      equipamentosUtilizadosIds: consolidated.equipamentosUtilizadosIds,
      observacao: '',
      pendencias: consolidated.pendencias,
      proximasEtapas: '',
      statusDocumento: 'Rascunho',
      responsavelRdo: obra?.responsavel || activeUserName,
      ocorrencias: consolidated.ocorrencias,
      fotos: [],
      efetivoFuncionarioIds: consolidated.efetivoFuncionarioIds,
      fontes: consolidated.fontes,
      equipamentosResumo: consolidated.equipamentosResumo,
      viagensResumo: consolidated.viagensResumo,
      materiaisResumo: consolidated.materiaisResumo,
      producaoItens: consolidated.producaoItens,
      divergencias: consolidated.divergencias,
      clima: consolidated.clima,
      condicao: consolidated.condicao,
      custoMateriais: consolidated.custoMateriais,
      custoManutencao: consolidated.custoManutencao,
      custoTotal: consolidated.custoTotal,
      versao: 1,
      revisoes: [],
      criadoEm: now,
      atualizadoEm: now,
    });
    setFeedback('RDO pré-preenchido com os dados operacionais encontrados para hoje.');
    setView('editor');
  };

  const editRdo = (rdo: RdoDiario) => {
    const normalized = normalizeRdo(rdo);
    setOriginal(normalized);
    setEditing(normalized);
    setFeedback('');
    setView('editor');
  };

  const updateEditing = <K extends keyof RdoDiario>(field: K, value: RdoDiario[K]) => {
    setEditing(current => current ? { ...current, [field]: value } : current);
  };

  const refreshSources = () => {
    if (!editing) return;
    const consolidated = consolidation(editing.data, editing.obraLocalId);
    const manualItems = (editing.producaoItens || []).filter(item => item.origem === 'Manual');
    setEditing({
      ...editing,
      quantidadeEquipe: consolidated.quantidadeEquipe,
      equipamentosUtilizadosIds: consolidated.equipamentosUtilizadosIds,
      efetivoFuncionarioIds: consolidated.efetivoFuncionarioIds,
      fontes: consolidated.fontes,
      equipamentosResumo: consolidated.equipamentosResumo,
      viagensResumo: consolidated.viagensResumo,
      materiaisResumo: consolidated.materiaisResumo,
      producaoItens: [...consolidated.producaoItens, ...manualItems],
      divergencias: consolidated.divergencias,
      clima: consolidated.clima,
      condicao: consolidated.condicao,
      servicoExecutado: editing.servicoExecutado.trim() || consolidated.servicoExecutado,
      ocorrencias: editing.ocorrencias?.trim() || consolidated.ocorrencias,
      pendencias: consolidated.pendencias,
      custoMateriais: consolidated.custoMateriais,
      custoManutencao: consolidated.custoManutencao,
      custoTotal: consolidated.custoTotal,
    });
    setFeedback('Fontes atualizadas. Textos manuais e produção manual foram preservados.');
  };

  const saveRdo = (target: StatusDocumentoRdo = statusOf(editing as RdoDiario)) => {
    if (!editing) return;
    if (!editing.data || !editing.obraLocalId || !editing.empresaId) {
      setFeedback('Informe data, empresa e obra antes de salvar.');
      return;
    }
    const requestedTarget = original
      && ['Aprovado', 'Fechado'].includes(statusOf(original))
      && target === 'Rascunho'
      ? statusOf(original)
      : target;
    const transition = canTransitionRdo(editing, requestedTarget);
    if (!transition.allowed) {
      setFeedback(transition.message);
      return;
    }
    const now = new Date().toISOString();
    const next: RdoDiario = {
      ...editing,
      numero: editing.numero || generateRdoNumber(editing.data, rdos.filter(item => item.data === editing.data).length),
      statusDocumento: requestedTarget,
      versao: editing.versao || 1,
      revisoes: editing.revisoes || [],
      criadoEm: editing.criadoEm || now,
      atualizadoEm: now,
    };
    const prepared = prepareRdoVersion(original, next, activeUserName);
    let finalRdo = prepared.rdo;
    if (!prepared.revisionCreated && requestedTarget === 'Aprovado') {
      finalRdo = {
        ...finalRdo,
        statusDocumento: 'Aprovado',
        aprovadoPor: activeUserName,
        aprovadoEm: now,
        fechadoPor: undefined,
        fechadoEm: undefined,
      };
    }
    if (!prepared.revisionCreated && requestedTarget === 'Fechado') {
      finalRdo = {
        ...finalRdo,
        statusDocumento: 'Fechado',
        fechadoPor: activeUserName,
        fechadoEm: now,
      };
    }
    onSaveRdo(finalRdo, !original);
    setOriginal(finalRdo);
    setEditing(finalRdo);
    setFeedback(prepared.revisionCreated
      ? `Alteração registrada como revisão ${finalRdo.versao}. O RDO voltou para revisão e precisa de nova aprovação.`
      : requestedTarget === 'Fechado'
        ? 'RDO fechado. O documento passa a compor o fechamento e os snapshots de período.'
        : requestedTarget === 'Aprovado'
          ? 'RDO aprovado com responsável, data e versão auditáveis.'
          : 'RDO salvo com sucesso.');
  };

  const addManualProduction = () => {
    if (!editing || !manualProduction.descricao.trim()) {
      setFeedback('Descreva a produção manual antes de adicionar.');
      return;
    }
    const item: RdoProducaoItem = {
      id: `prod-manual-${Date.now()}`,
      origem: 'Manual',
      ramoNome: manualProduction.ramoNome.trim() || 'Geral',
      descricao: manualProduction.descricao.trim(),
      quantidade: Math.max(0, Number(manualProduction.quantidade) || 0),
      unidade: manualProduction.unidade.trim() || 'un',
    };
    updateEditing('producaoItens', [...(editing.producaoItens || []), item]);
    setManualProduction({ ramoNome: '', descricao: '', quantidade: 0, unidade: 'un' });
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!editing || !files?.length) return;
    const available = Math.max(0, 4 - (editing.fotos?.length || 0));
    if (!available) {
      setFeedback('O limite é de quatro fotos por RDO.');
      return;
    }
    try {
      const selected = Array.from(files).slice(0, available);
      const photos = await Promise.all(selected.map(compressPhoto));
      updateEditing('fotos', [...(editing.fotos || []), ...photos]);
      setFeedback(`${photos.length} foto(s) adicionada(s) e compactada(s).`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao processar as fotos.');
    }
  };

  const exportRdoExcel = async (rdoInput: RdoDiario) => {
    const rdo = normalizeRdo(rdoInput);
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      configureCorporateWorkbook(workbook, `Relatório Diário de Obra ${rdo.numero}`);
      const obra = obras.find(item => item.id === rdo.obraLocalId);
      const company = empresas.find(item => item.id === rdo.empresaId);
      addCorporateSummarySheet(workbook, `Relatório Diário de Obra ${rdo.numero}`, [
        ['Data', formatDate(rdo.data)],
        ['Empresa', company?.nome || 'Não localizada'],
        ['Obra', obra?.nome || 'Não localizada'],
        ['Status', statusOf(rdo)],
        ['Versão', rdo.versao || 1],
        ['Responsável', rdo.responsavelRdo || 'Não informado'],
        ['Efetivo', rdo.quantidadeEquipe],
        ['Equipamentos', rdo.equipamentosResumo?.length || rdo.equipamentosUtilizadosIds.length],
        ['Viagens', rdo.viagensResumo?.length || 0],
        ['Custo total', Number(rdo.custoTotal || 0)],
      ], [`Documento ${statusOf(rdo)}`, `Data ${formatDate(rdo.data)}`]);

      const detail = workbook.addWorksheet('RDO');
      detail.addRows([
        ['Campo', 'Informação'],
        ['Número', rdo.numero],
        ['Data', formatDate(rdo.data)],
        ['Empresa', company?.nome || ''],
        ['Obra', obra?.nome || ''],
        ['Etapa', etapas.find(item => item.id === rdo.etapaServicoId)?.nome || ''],
        ['Situação da atividade', rdo.statusAtividade],
        ['Status do documento', statusOf(rdo)],
        ['Versão', rdo.versao || 1],
        ['Responsável', rdo.responsavelRdo || ''],
        ['Serviços executados', rdo.servicoExecutado],
        ['Ocorrências', rdo.ocorrencias || ''],
        ['Observações', rdo.observacao],
        ['Pendências', rdo.pendencias],
        ['Próximas etapas', rdo.proximasEtapas],
        ['Custo de materiais', Number(rdo.custoMateriais || 0)],
        ['Custo de manutenção', Number(rdo.custoManutencao || 0)],
        ['Custo total', Number(rdo.custoTotal || 0)],
        ['Aprovado por/em', `${rdo.aprovadoPor || ''} ${rdo.aprovadoEm ? new Date(rdo.aprovadoEm).toLocaleString('pt-BR') : ''}`],
        ['Fechado por/em', `${rdo.fechadoPor || ''} ${rdo.fechadoEm ? new Date(rdo.fechadoEm).toLocaleString('pt-BR') : ''}`],
      ]);
      styleCorporateWorksheet(detail, { title: `RDO ${rdo.numero}`, headerRow: 1, lastColumn: 2, recordCount: 20 });
      detail.getColumn(1).width = 28;
      detail.getColumn(2).width = 90;

      const createTable = (name: string, headers: string[], rows: Array<Array<string | number>>) => {
        const sheet = workbook.addWorksheet(name);
        sheet.addRow(headers);
        rows.forEach(row => sheet.addRow(row));
        styleCorporateWorksheet(sheet, {
          title: `${rdo.numero} - ${name}`,
          headerRow: 1,
          lastColumn: headers.length,
          recordCount: rows.length,
        });
        return sheet;
      };
      createTable('Produção', ['Origem', 'Ramo / frente', 'Descrição', 'Quantidade', 'Unidade'], (rdo.producaoItens || []).map(item => [
        item.origem, item.ramoNome, item.descricao, item.quantidade, item.unidade,
      ]));
      createTable('Equipamentos', ['Prefixo', 'Equipamento', 'Operador', 'Horas', 'Origem'], (rdo.equipamentosResumo || []).map(item => [
        item.prefixo, item.nome, item.operador, item.horasTrabalhadas, item.origem,
      ]));
      createTable('Viagens', ['Ticket', 'Prefixo', 'Material', 'Volume m³', 'Destino', 'Status'], (rdo.viagensResumo || []).map(item => [
        item.ticketNumero, item.prefixo, item.material, item.quantidadeM3, item.destino, item.status,
      ]));
      createTable('Materiais', ['Material', 'Unidade', 'Quantidade', 'Fornecedor', 'Custo', 'Status'], (rdo.materiaisResumo || []).map(item => [
        item.material, item.unidade, item.quantidade, item.fornecedor, item.custo, item.status,
      ]));
      createTable('Divergências', ['Severidade', 'Origem', 'Descrição'], (rdo.divergencias || []).map(item => [
        item.severidade, item.origem, item.mensagem,
      ]));
      createTable('Revisões', ['Versão anterior', 'Status anterior', 'Alterado por', 'Alterado em', 'Motivo', 'Resumo'], (rdo.revisoes || []).map(item => [
        item.versao,
        item.statusAnterior,
        item.alteradoPor,
        new Date(item.alteradoEm).toLocaleString('pt-BR'),
        item.motivo,
        item.resumoAnterior,
      ]));
      await downloadCorporateWorkbook(workbook, `RENEA_${rdo.numero}_v${rdo.versao || 1}.xlsx`);
      setFeedback('Excel profissional do RDO gerado com rastreabilidade completa.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportRdoPdf = (rdoInput: RdoDiario) => {
    const rdo = normalizeRdo(rdoInput);
    setIsExporting(true);
    try {
      const document = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const obra = obras.find(item => item.id === rdo.obraLocalId);
      const company = empresas.find(item => item.id === rdo.empresaId);
      document.setFillColor(15, 23, 42);
      document.rect(0, 0, 210, 30, 'F');
      document.setTextColor(255, 255, 255);
      document.setFontSize(16);
      document.text('RENEA INFRAESTRUTURA', 14, 12);
      document.setFontSize(10);
      document.text(`RELATÓRIO DIÁRIO DE OBRA • ${rdo.numero}`, 14, 21);
      document.setTextColor(51, 65, 85);
      document.setFontSize(8);
      document.text(`Status: ${statusOf(rdo)} • Versão ${rdo.versao || 1}`, 145, 21);
      autoTable(document, {
        startY: 36,
        body: [
          ['Data', formatDate(rdo.data), 'Empresa', company?.nome || 'Não localizada'],
          ['Obra', obra?.nome || 'Não localizada', 'Responsável', rdo.responsavelRdo || 'Não informado'],
          ['Atividade', rdo.statusAtividade, 'Efetivo', String(rdo.quantidadeEquipe)],
          ['Clima', `M ${rdo.clima?.manha || '—'} | T ${rdo.clima?.tarde || '—'} | N ${rdo.clima?.noite || '—'}`, 'Equipamentos', String(rdo.equipamentosResumo?.length || 0)],
        ],
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', fillColor: [241, 245, 249] }, 2: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
        theme: 'grid',
      });
      const firstTableEnd = (document as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 70;
      document.setFontSize(10);
      document.setTextColor(15, 23, 42);
      document.text('Serviços executados', 14, firstTableEnd + 9);
      document.setFontSize(8);
      document.text(document.splitTextToSize(rdo.servicoExecutado || 'Não informado', 182), 14, firstTableEnd + 15);
      const serviceLines = document.splitTextToSize(rdo.servicoExecutado || 'Não informado', 182).length;
      autoTable(document, {
        startY: firstTableEnd + 18 + (serviceLines * 3),
        head: [['Produção / frente', 'Descrição', 'Quantidade']],
        body: (rdo.producaoItens || []).map(item => [
          item.ramoNome,
          item.descricao,
          `${item.quantidade.toLocaleString('pt-BR')} ${item.unidade}`,
        ]),
        styles: { fontSize: 7, cellPadding: 1.7 },
        headStyles: { fillColor: [6, 95, 70], textColor: 255 },
        alternateRowStyles: { fillColor: [241, 245, 249] },
      });
      let currentY = ((document as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 110) + 6;
      const equipmentRows = (rdo.equipamentosResumo || []).map(item => [
        item.prefixo, item.nome, item.operador || 'Não informado', item.horasTrabalhadas.toLocaleString('pt-BR'),
      ]);
      if (equipmentRows.length) {
        autoTable(document, {
          startY: currentY,
          head: [['Prefixo', 'Equipamento', 'Operador', 'Horas']],
          body: equipmentRows,
          styles: { fontSize: 7, cellPadding: 1.6 },
          headStyles: { fillColor: [15, 23, 42], textColor: 255 },
        });
        currentY = ((document as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || currentY) + 6;
      }
      const occurrenceRows = [
        ['Ocorrências', rdo.ocorrencias || 'Sem ocorrências registradas'],
        ['Observações', rdo.observacao || 'Sem observações'],
        ['Pendências', rdo.pendencias || 'Sem pendências'],
        ['Próximas etapas', rdo.proximasEtapas || 'Não informadas'],
      ];
      autoTable(document, {
        startY: currentY,
        body: occurrenceRows,
        styles: { fontSize: 7.5, cellPadding: 1.8 },
        columnStyles: { 0: { cellWidth: 32, fontStyle: 'bold', fillColor: [241, 245, 249] } },
        theme: 'grid',
      });
      document.addPage();
      document.setTextColor(15, 23, 42);
      document.setFontSize(12);
      document.text('Movimentações, custos e conferências', 14, 16);
      autoTable(document, {
        startY: 22,
        head: [['Tipo', 'Quantidade', 'Valor / situação']],
        body: [
          ['Viagens', rdo.viagensResumo?.length || 0, `${(rdo.viagensResumo || []).reduce((sum, item) => sum + item.quantidadeM3, 0).toLocaleString('pt-BR')} m³`],
          ['Materiais', rdo.materiaisResumo?.length || 0, formatMoney(rdo.custoMateriais)],
          ['Manutenção', 'OS relacionadas', formatMoney(rdo.custoManutencao)],
          ['Custo total diário', '', formatMoney(rdo.custoTotal)],
          ['Divergências visíveis', rdo.divergencias?.length || 0, (rdo.divergencias || []).some(item => item.severidade === 'Crítica') ? 'Possui item crítico' : 'Sem item crítico'],
        ],
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [6, 95, 70], textColor: 255 },
      });
      autoTable(document, {
        startY: ((document as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 65) + 7,
        head: [['Severidade', 'Origem', 'Divergência / conferência necessária']],
        body: (rdo.divergencias || []).map(item => [item.severidade, item.origem, item.mensagem]),
        styles: { fontSize: 7, cellPadding: 1.7 },
        headStyles: { fillColor: [180, 83, 9], textColor: 255 },
      });
      const auditY = ((document as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 100) + 10;
      document.setFontSize(8);
      document.text(`Aprovado por: ${rdo.aprovadoPor || '—'} ${rdo.aprovadoEm ? `em ${new Date(rdo.aprovadoEm).toLocaleString('pt-BR')}` : ''}`, 14, auditY);
      document.text(`Fechado por: ${rdo.fechadoPor || '—'} ${rdo.fechadoEm ? `em ${new Date(rdo.fechadoEm).toLocaleString('pt-BR')}` : ''}`, 14, auditY + 6);
      document.text(`Revisões anteriores: ${rdo.revisoes?.length || 0}`, 14, auditY + 12);
      (rdo.fotos || []).forEach((photo, index) => {
        if (index % 2 === 0) {
          document.addPage();
          document.setFontSize(12);
          document.text(`Registro fotográfico • ${rdo.numero}`, 14, 16);
        }
        const y = index % 2 === 0 ? 24 : 150;
        try {
          document.addImage(photo, 'JPEG', 14, y, 182, 116, undefined, 'FAST');
        } catch {
          document.setFontSize(8);
          document.text('Foto não pôde ser incorporada ao PDF.', 14, y + 10);
        }
      });
      document.save(`RENEA_${rdo.numero}_v${rdo.versao || 1}.pdf`);
      setFeedback('PDF profissional do RDO gerado com auditoria e anexos fotográficos.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportFilteredExcel = async () => {
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      configureCorporateWorkbook(workbook, 'Controle consolidado de RDOs');
      addCorporateSummarySheet(workbook, 'Controle Consolidado de RDOs', [
        ['RDOs filtrados', filteredRdos.length],
        ['Rascunho / revisão', filteredRdos.filter(item => ['Rascunho', 'Em revisão'].includes(statusOf(item))).length],
        ['Aprovados', filteredRdos.filter(item => statusOf(item) === 'Aprovado').length],
        ['Fechados', filteredRdos.filter(item => statusOf(item) === 'Fechado').length],
        ['Efetivo acumulado', filteredRdos.reduce((sum, item) => sum + item.quantidadeEquipe, 0)],
        ['Custo total', filteredRdos.reduce((sum, item) => sum + Number(item.custoTotal || 0), 0)],
      ], [
        dateStart ? `De ${formatDate(dateStart)}` : '',
        dateEnd ? `Até ${formatDate(dateEnd)}` : '',
        statusFilter !== 'Todos' ? `Status ${statusFilter}` : '',
      ]);
      const sheet = workbook.addWorksheet('RDOs');
      sheet.addRow(['Número', 'Data', 'Obra', 'Empresa', 'Status', 'Versão', 'Responsável', 'Efetivo', 'Equipamentos', 'Viagens', 'Divergências', 'Custo total']);
      filteredRdos.forEach(rdo => sheet.addRow([
        rdo.numero,
        formatDate(rdo.data),
        obras.find(item => item.id === rdo.obraLocalId)?.nome || 'Não localizada',
        empresas.find(item => item.id === rdo.empresaId)?.nome || 'Não localizada',
        statusOf(rdo),
        rdo.versao || 1,
        rdo.responsavelRdo || '',
        rdo.quantidadeEquipe,
        rdo.equipamentosResumo?.length || rdo.equipamentosUtilizadosIds.length,
        rdo.viagensResumo?.length || 0,
        rdo.divergencias?.length || 0,
        Number(rdo.custoTotal || 0),
      ]));
      styleCorporateWorksheet(sheet, {
        title: 'Controle Consolidado de RDOs',
        headerRow: 1,
        lastColumn: 12,
        recordCount: filteredRdos.length,
      });
      sheet.getColumn(12).numFmt = 'R$ #,##0.00';
      await downloadCorporateWorkbook(workbook, `RENEA_RDOs_${dateStart || 'inicio'}_${dateEnd || 'atual'}.xlsx`);
      setFeedback('Controle consolidado de RDOs exportado para Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  if (view === 'editor' && editing) {
    const locked = statusOf(editing) === 'Fechado';
    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setView('list')}
              className="rounded-xl border border-slate-700 p-2.5 text-slate-300 hover:border-emerald-500 hover:text-white"
              title="Voltar para os RDOs"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black text-white">{editing.numero || 'Novo RDO'}</h2>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${STATUS_STYLE[statusOf(editing)]}`}>
                  {statusOf(editing)}
                </span>
                <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[10px] font-black text-slate-400">
                  Versão {editing.versao || 1}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Consolidação diária sem redigitação, com revisão e fechamento auditáveis.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => exportRdoPdf(editing)} disabled={isExporting} className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs font-black text-slate-300 hover:border-emerald-500">
              <FileDown className="h-4 w-4" /> PDF
            </button>
            <button type="button" onClick={() => exportRdoExcel(editing)} disabled={isExporting} className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs font-black text-slate-300 hover:border-emerald-500">
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </button>
            <button type="button" onClick={refreshSources} className="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-black text-blue-300">
              <RefreshCw className="h-4 w-4" /> Atualizar fontes
            </button>
          </div>
        </div>

        {feedback && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-200">
            {feedback}
          </div>
        )}

        {locked && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
            <LockKeyhole className="h-4 w-4 shrink-0" />
            Documento fechado. Qualquer alteração operacional cria automaticamente uma nova revisão e exige nova aprovação.
          </div>
        )}

        <Section title="Identificação e responsabilidade" subtitle="Data, obra e cadastros mestres são a referência única do documento.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label>
              <span className={LABEL_CLASS}>Data</span>
              <input type="date" value={editing.data} onChange={event => updateEditing('data', event.target.value)} className={FIELD_CLASS} />
            </label>
            <label>
              <span className={LABEL_CLASS}>Empresa</span>
              <select value={editing.empresaId} onChange={event => updateEditing('empresaId', event.target.value)} className={FIELD_CLASS}>
                <option value="">Selecione</option>
                {empresas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
            </label>
            <label>
              <span className={LABEL_CLASS}>Obra / local</span>
              <select value={editing.obraLocalId} onChange={event => updateEditing('obraLocalId', event.target.value)} className={FIELD_CLASS}>
                <option value="">Selecione</option>
                {obras.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
            </label>
            <label>
              <span className={LABEL_CLASS}>Etapa</span>
              <select value={editing.etapaServicoId} onChange={event => updateEditing('etapaServicoId', event.target.value)} className={FIELD_CLASS}>
                <option value="">Geral / não informada</option>
                {etapas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
            </label>
            <label>
              <span className={LABEL_CLASS}>Responsável pelo RDO</span>
              <input value={editing.responsavelRdo || ''} onChange={event => updateEditing('responsavelRdo', event.target.value)} className={FIELD_CLASS} placeholder="Nome completo" />
            </label>
            <label>
              <span className={LABEL_CLASS}>Situação da atividade</span>
              <select value={editing.statusAtividade} onChange={event => updateEditing('statusAtividade', event.target.value as RdoDiario['statusAtividade'])} className={FIELD_CLASS}>
                {ACTIVITY_OPTIONS.map(item => <option key={item}>{item}</option>)}
              </select>
            </label>
            <div className="md:col-span-2">
              <span className={LABEL_CLASS}>Controle documental</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {STATUS_OPTIONS.map(item => (
                  <div key={item} className={`rounded-xl border px-3 py-2 text-center text-xs font-black ${STATUS_STYLE[item]} ${statusOf(editing) === item ? 'ring-2 ring-white/10' : 'opacity-50'}`}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Fontes automáticas do dia" subtitle="Os totais vêm dos módulos existentes; diferenças permanecem visíveis para conferência.">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {([
              ['Presença direta', editing.fontes?.presencasDiretas || 0, Users],
              ['Presença por link', editing.fontes?.presencasLink || 0, ShieldCheck],
              ['Pessoas apontadas', editing.fontes?.pessoasApontadas || 0, HardHat],
              ['Apontamentos', editing.fontes?.apontamentos || 0, ClipboardCheck],
              ['Partes diárias', editing.fontes?.partesDiarias || 0, Wrench],
              ['Viagens', editing.fontes?.viagens || 0, Truck],
              ['Materiais', editing.fontes?.materiais || 0, Package],
            ] as Array<[string, number, LucideIcon]>).map(([label, value, Icon]) => (
              <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <Icon className="mb-2 h-4 w-4 text-emerald-400" />
                <strong className="block text-lg text-white">{String(value)}</strong>
                <span className="text-[10px] font-bold uppercase text-slate-500">{String(label)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-800 p-3"><span className={LABEL_CLASS}>Efetivo consolidado</span><strong className="text-2xl text-white">{editing.quantidadeEquipe}</strong></div>
            <div className="rounded-xl border border-slate-800 p-3"><span className={LABEL_CLASS}>Equipamentos</span><strong className="text-2xl text-white">{editing.equipamentosResumo?.length || 0}</strong></div>
            <div className="rounded-xl border border-slate-800 p-3"><span className={LABEL_CLASS}>Custo materiais</span><strong className="text-lg text-white">{formatMoney(editing.custoMateriais)}</strong></div>
            <div className="rounded-xl border border-slate-800 p-3"><span className={LABEL_CLASS}>Custo total identificado</span><strong className="text-lg text-emerald-300">{formatMoney(editing.custoTotal)}</strong></div>
          </div>
        </Section>

        <Section title="Clima e condições de trabalho" subtitle="Preenchimento sugerido pelos apontamentos de campo, com edição permitida.">
          <div className="grid gap-3 md:grid-cols-3">
            {(['manha', 'tarde', 'noite'] as const).map(turn => (
              <div key={turn} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase text-slate-400">
                  <CloudSun className="h-4 w-4 text-amber-300" /> {turn}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={editing.clima?.[turn] || 'Nublado'}
                    onChange={event => updateEditing('clima', { ...(editing.clima || { manha: 'Nublado', tarde: 'Nublado', noite: 'Nublado' }), [turn]: event.target.value })}
                    className={FIELD_CLASS}
                  >
                    <option>Chuvoso</option><option>Nublado</option><option>Ensolarado</option>
                  </select>
                  <select
                    value={editing.condicao?.[turn] || 'Praticável'}
                    onChange={event => updateEditing('condicao', { ...(editing.condicao || { manha: 'Praticável', tarde: 'Praticável', noite: 'Praticável' }), [turn]: event.target.value })}
                    className={FIELD_CLASS}
                  >
                    <option>Praticável</option><option>Impraticável</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Produção e serviços executados" subtitle="Produção automática pode ser complementada manualmente sem apagar a origem.">
          <label>
            <span className={LABEL_CLASS}>Descrição consolidada dos serviços</span>
            <textarea value={editing.servicoExecutado} onChange={event => updateEditing('servicoExecutado', event.target.value)} rows={4} className={FIELD_CLASS} placeholder="Descreva os serviços executados no dia" />
          </label>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-950 text-[10px] uppercase text-slate-500">
                <tr><th className="px-3 py-2">Origem</th><th className="px-3 py-2">Frente</th><th className="px-3 py-2">Descrição</th><th className="px-3 py-2">Quantidade</th><th className="px-3 py-2" /></tr>
              </thead>
              <tbody>
                {(editing.producaoItens || []).map(item => (
                  <tr key={item.id} className="border-t border-slate-800 text-slate-300">
                    <td className="px-3 py-2">{item.origem}</td><td className="px-3 py-2">{item.ramoNome}</td><td className="px-3 py-2">{item.descricao}</td>
                    <td className="px-3 py-2">{item.quantidade.toLocaleString('pt-BR')} {item.unidade}</td>
                    <td className="px-3 py-2 text-right">
                      {item.origem === 'Manual' && (
                        <button type="button" onClick={() => updateEditing('producaoItens', (editing.producaoItens || []).filter(candidate => candidate.id !== item.id))} className="text-rose-400">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!editing.producaoItens?.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-600">Nenhuma produção encontrada.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="mt-3 grid gap-2 rounded-xl border border-dashed border-slate-700 p-3 md:grid-cols-[1fr_2fr_120px_100px_auto]">
            <input value={manualProduction.ramoNome} onChange={event => setManualProduction(current => ({ ...current, ramoNome: event.target.value }))} className={FIELD_CLASS} placeholder="Frente / ramo" />
            <input value={manualProduction.descricao} onChange={event => setManualProduction(current => ({ ...current, descricao: event.target.value }))} className={FIELD_CLASS} placeholder="Produção complementar" />
            <input type="number" min="0" value={manualProduction.quantidade} onChange={event => setManualProduction(current => ({ ...current, quantidade: Number(event.target.value) }))} className={FIELD_CLASS} placeholder="Qtd." />
            <input value={manualProduction.unidade} onChange={event => setManualProduction(current => ({ ...current, unidade: event.target.value }))} className={FIELD_CLASS} placeholder="Un." />
            <button type="button" onClick={addManualProduction} className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-3 text-xs font-black text-white hover:bg-slate-700"><Plus className="h-4 w-4" /> Adicionar</button>
          </div>
        </Section>

        <div className="grid gap-5 xl:grid-cols-2">
          <Section title="Equipamentos e operadores" subtitle="Horas e operador vêm das partes diárias e do cadastro mestre.">
            <div className="space-y-2">
              {(editing.equipamentosResumo || []).map(item => (
                <div key={item.equipamentoId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <div><strong className="text-sm text-white">{item.prefixo} • {item.nome}</strong><p className="text-xs text-slate-500">{item.operador || 'Operador não informado'} • {item.origem}</p></div>
                  <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-black text-emerald-300">{item.horasTrabalhadas.toLocaleString('pt-BR')} h</span>
                </div>
              ))}
              {!editing.equipamentosResumo?.length && <p className="py-6 text-center text-xs text-slate-600">Sem equipamento identificado.</p>}
            </div>
          </Section>
          <Section title="Viagens e materiais" subtitle="Resumo diário de transporte, recebimentos, consumo e custos.">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-800 p-3"><Truck className="mb-2 h-4 w-4 text-blue-400" /><strong className="block text-xl text-white">{editing.viagensResumo?.length || 0}</strong><span className="text-[10px] uppercase text-slate-500">viagens</span></div>
              <div className="rounded-xl border border-slate-800 p-3"><Package className="mb-2 h-4 w-4 text-amber-400" /><strong className="block text-xl text-white">{editing.materiaisResumo?.length || 0}</strong><span className="text-[10px] uppercase text-slate-500">movimentos</span></div>
            </div>
            <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
              {(editing.viagensResumo || []).map(item => <div key={item.ticketId} className="rounded-lg bg-slate-950/60 px-3 py-2 text-xs text-slate-300">Ticket {item.ticketNumero || 's/n'} • {item.prefixo} • {item.material} • {item.quantidadeM3.toLocaleString('pt-BR')} m³</div>)}
              {(editing.materiaisResumo || []).map(item => <div key={item.registroId} className="rounded-lg bg-slate-950/60 px-3 py-2 text-xs text-slate-300">{item.material} • {item.quantidade.toLocaleString('pt-BR')} {item.unidade} • {formatMoney(item.custo)}</div>)}
            </div>
          </Section>
        </div>

        <Section title="Ocorrências, pendências e sequência" subtitle="As divergências automáticas não são ocultadas nem impedem o registro do trabalho realizado.">
          <div className="grid gap-4 md:grid-cols-2">
            <label><span className={LABEL_CLASS}>Ocorrências</span><textarea value={editing.ocorrencias || ''} onChange={event => updateEditing('ocorrencias', event.target.value)} rows={3} className={FIELD_CLASS} /></label>
            <label><span className={LABEL_CLASS}>Observações</span><textarea value={editing.observacao} onChange={event => updateEditing('observacao', event.target.value)} rows={3} className={FIELD_CLASS} /></label>
            <label><span className={LABEL_CLASS}>Pendências</span><textarea value={editing.pendencias} onChange={event => updateEditing('pendencias', event.target.value)} rows={3} className={FIELD_CLASS} /></label>
            <label><span className={LABEL_CLASS}>Próximas etapas</span><textarea value={editing.proximasEtapas} onChange={event => updateEditing('proximasEtapas', event.target.value)} rows={3} className={FIELD_CLASS} /></label>
          </div>
          <div className="mt-4 space-y-2">
            {(editing.divergencias || []).map(item => (
              <div key={item.codigo} className={`flex gap-3 rounded-xl border p-3 text-xs ${item.severidade === 'Crítica' ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : item.severidade === 'Atenção' ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-blue-500/30 bg-blue-500/10 text-blue-200'}`}>
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <div><strong>{item.origem} • {item.severidade}</strong><p className="mt-1 opacity-80">{item.mensagem}</p></div>
              </div>
            ))}
            {!editing.divergencias?.length && <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-200"><CheckCircle2 className="h-4 w-4" /> Nenhuma divergência automática identificada.</div>}
          </div>
        </Section>

        <Section title="Registro fotográfico" subtitle="Até quatro fotos compactadas ficam vinculadas ao RDO e são incluídas no PDF.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(editing.fotos || []).map((photo, index) => (
              <div key={`${photo.slice(0, 24)}-${index}`} className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                <img src={photo} alt={`Registro fotográfico ${index + 1}`} className="h-40 w-full object-cover" />
                <button type="button" onClick={() => updateEditing('fotos', (editing.fotos || []).filter((_, photoIndex) => photoIndex !== index))} className="absolute right-2 top-2 rounded-lg bg-slate-950/80 p-2 text-rose-300 opacity-0 transition-opacity group-hover:opacity-100"><X className="h-4 w-4" /></button>
              </div>
            ))}
            {(editing.fotos?.length || 0) < 4 && (
              <label className="flex h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950/50 text-slate-500 hover:border-emerald-500 hover:text-emerald-300">
                <ImagePlus className="mb-2 h-6 w-6" />
                <span className="text-xs font-black">Adicionar foto</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={event => void handlePhotoUpload(event.target.files)} />
              </label>
            )}
          </div>
        </Section>

        {!!editing.revisoes?.length && (
          <Section title="Histórico de revisões" subtitle="Cada alteração posterior à aprovação mantém o resumo e o responsável pela revisão anterior.">
            <div className="space-y-2">
              {editing.revisoes.map(item => (
                <div key={`${item.versao}-${item.alteradoEm}`} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-xs">
                  <div className="flex flex-wrap justify-between gap-2"><strong className="text-white">Versão {item.versao} • {item.statusAnterior}</strong><span className="text-slate-500">{new Date(item.alteradoEm).toLocaleString('pt-BR')}</span></div>
                  <p className="mt-1 text-slate-400">{item.alteradoPor} • {item.motivo}</p>
                  <p className="mt-1 text-slate-600">{item.resumoAnterior}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        <div className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-900/95 p-3 shadow-2xl backdrop-blur md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-slate-500">Aprovação exige responsável e serviço. Fechamento exige aprovação vigente.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => saveRdo('Rascunho')} className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-black text-slate-200"><Save className="h-4 w-4" /> Salvar</button>
            <button type="button" onClick={() => saveRdo('Em revisão')} className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-black text-amber-300"><Clock3 className="h-4 w-4" /> Enviar à revisão</button>
            <button type="button" onClick={() => saveRdo('Aprovado')} className="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-xs font-black text-blue-300"><ShieldCheck className="h-4 w-4" /> Aprovar</button>
            <button type="button" onClick={() => saveRdo('Fechado')} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-500"><LockKeyhole className="h-4 w-4" /> Fechar dia</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400"><ClipboardCheck className="h-6 w-6" /></div>
            <div><h1 className="text-xl font-black text-white">RDO Integrado</h1><p className="mt-1 text-xs text-slate-500">Relatório diário com dados de campo, aprovação, fechamento e exportação profissional.</p></div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void exportFilteredExcel()} disabled={isExporting} className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-black text-slate-300 hover:border-emerald-500"><FileSpreadsheet className="h-4 w-4" /> Exportar controle</button>
          <button type="button" onClick={createRdo} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-500"><Plus className="h-4 w-4" /> Gerar RDO do dia</button>
        </div>
      </div>

      {feedback && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-200">{feedback}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {([
          ['Total de RDOs', metrics.total, ClipboardCheck, 'text-white'],
          ['Rascunho / revisão', metrics.pending, Clock3, 'text-amber-300'],
          ['Aprovados', metrics.approved, ShieldCheck, 'text-blue-300'],
          ['Fechados', metrics.closed, LockKeyhole, 'text-emerald-300'],
          ['Divergências', metrics.divergences, AlertTriangle, 'text-rose-300'],
        ] as Array<[string, number, LucideIcon, string]>).map(([label, value, Icon, color]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <Icon className={`mb-3 h-5 w-5 ${String(color)}`} />
            <strong className={`block text-2xl ${String(color)}`}>{String(value)}</strong>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{String(label)}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <label className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-600" />
          <input value={query} onChange={event => setQuery(event.target.value)} className={`${FIELD_CLASS} pl-10`} placeholder="Buscar número, obra, empresa ou responsável" />
        </label>
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'Todos' | StatusDocumentoRdo)} className={FIELD_CLASS}>
          <option>Todos</option>{STATUS_OPTIONS.map(item => <option key={item}>{item}</option>)}
        </select>
        <input type="date" value={dateStart} onChange={event => setDateStart(event.target.value)} className={FIELD_CLASS} title="Data inicial" />
        <input type="date" value={dateEnd} onChange={event => setDateEnd(event.target.value)} className={FIELD_CLASS} title="Data final" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">RDO / Data</th><th className="px-4 py-3">Obra</th><th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Operação</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredRdos.map(rdo => (
                <tr key={rdo.id} className="border-t border-slate-800 text-slate-300 hover:bg-slate-800/40">
                  <td className="px-4 py-3"><strong className="block text-white">{rdo.numero}</strong><span className="text-slate-500">{formatDate(rdo.data)} • v{rdo.versao || 1}</span></td>
                  <td className="px-4 py-3"><strong className="block">{obras.find(item => item.id === rdo.obraLocalId)?.nome || 'Obra não localizada'}</strong><span className="text-slate-500">{empresas.find(item => item.id === rdo.empresaId)?.nome || 'Empresa não localizada'}</span></td>
                  <td className="px-4 py-3">{rdo.responsavelRdo || 'Não informado'}</td>
                  <td className="px-4 py-3"><span className="block">{rdo.quantidadeEquipe} pessoa(s) • {rdo.equipamentosResumo?.length || rdo.equipamentosUtilizadosIds.length} equipamento(s)</span><span className="text-slate-500">{rdo.viagensResumo?.length || 0} viagem(ns) • {formatMoney(rdo.custoTotal)}</span></td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${STATUS_STYLE[statusOf(rdo)]}`}>{statusOf(rdo)}</span>{!!rdo.divergencias?.length && <span className="ml-2 text-[10px] font-black text-amber-300">{rdo.divergencias.length} alerta(s)</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => editRdo(rdo)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white" title="Consultar ou editar"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => exportRdoPdf(rdo)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white" title="Exportar PDF"><FileDown className="h-4 w-4" /></button>
                      {!['Aprovado', 'Fechado'].includes(statusOf(rdo)) && <button type="button" onClick={() => onDeleteRdo(rdo.id)} className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10" title="Excluir rascunho"><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredRdos.length && (
                <tr><td colSpan={6} className="px-4 py-16 text-center"><Camera className="mx-auto mb-3 h-8 w-8 text-slate-700" /><strong className="block text-sm text-slate-400">Nenhum RDO encontrado</strong><span className="mt-1 block text-xs text-slate-600">Gere o RDO do dia para consolidar os módulos operacionais.</span></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-xs text-slate-400"><Users className="mb-2 h-5 w-5 text-emerald-400" /><strong className="block text-white">Sem redigitação</strong>Presença, apontamento, parte diária, viagens e materiais alimentam o documento.</div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-xs text-slate-400"><BarChart3 className="mb-2 h-5 w-5 text-blue-400" /><strong className="block text-white">Produção e custos</strong>Indicadores operacionais e custos identificados ficam ligados ao dia e à obra.</div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-xs text-slate-400"><CalendarDays className="mb-2 h-5 w-5 text-amber-400" /><strong className="block text-white">Fechamento auditável</strong>RDO fechado entra no snapshot de período e alterações geram nova revisão.</div>
      </div>
    </div>
  );
}
