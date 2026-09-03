import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileDown,
  FileSpreadsheet,
  Gauge,
  HardHat,
  ImageIcon,
  MapPin,
  Pencil,
  Plus,
  Route,
  Save,
  Search,
  Trash2,
  Truck,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import type {
  Empresa,
  Equipamento,
  Funcionario,
  ObraLocal,
  OrdemServico,
} from '../types';
import {
  buildMaintenanceFleetSummaries,
  deriveWorkOrderMetrics,
  type MaintenanceFleetSummary,
} from '../utils/equipmentOperations';
import fleetTruckPhoto from '../assets/equipment/optimized/fleet-truck.jpg';
import earthmovingPhoto from '../assets/equipment/optimized/earthmoving.jpg';
import liftingPilingPhoto from '../assets/equipment/optimized/lifting-piling.jpg';
import siteSupportPhoto from '../assets/equipment/optimized/site-support.jpg';
import concreteMixerPhoto from '../assets/equipment/optimized/concrete-mixer.jpg';
import truckCranePhoto from '../assets/equipment/optimized/truck-crane.jpg';
import fuelServiceTruckPhoto from '../assets/equipment/optimized/fuel-service-truck.jpg';
import bulldozerPhoto from '../assets/equipment/optimized/bulldozer.jpg';
import backhoePhoto from '../assets/equipment/optimized/backhoe.jpg';
import roadRollerPhoto from '../assets/equipment/optimized/road-roller.jpg';
import drillingRigPhoto from '../assets/equipment/optimized/drilling-rig.jpg';
import aerialPlatformPhoto from '../assets/equipment/optimized/aerial-platform.jpg';
import neutralTruckPhoto from '../assets/equipment/optimized/neutral-truck.jpg';
import neutralEarthmovingPhoto from '../assets/equipment/optimized/neutral-earthmoving.jpg';
import neutralLiftingPhoto from '../assets/equipment/optimized/neutral-lifting.jpg';
import neutralSupportPhoto from '../assets/equipment/optimized/neutral-support.jpg';

interface ManutencaoEquipamentosTabProps {
  equipamentos: Equipamento[];
  funcionarios: Funcionario[];
  obras: ObraLocal[];
  empresas: Empresa[];
  ordensServico: OrdemServico[];
  onSaveOrdemServico: (item: OrdemServico, isNew: boolean) => void;
  onDeleteOrdemServico: (id: string) => void;
  onSaveEquipamento: (item: Equipamento, isNew: boolean) => void;
  onUpdateEquipamentoStatus: (equipamentoId: string, status: Equipamento['status']) => void;
}

type MaintenanceView = 'frota' | 'ordens' | 'relatorio';
type WorkOrderForm = Omit<OrdemServico, 'id' | 'numero'>;

const STATUS_OPTIONS: OrdemServico['status'][] = [
  'Aberta',
  'Em Andamento',
  'Aguardando Peça',
  'Concluída',
  'Cancelada',
];
const TIPO_OPTIONS: OrdemServico['tipo'][] = ['Preventiva', 'Corretiva', 'Preditiva', 'Revisão'];
const PRIORIDADE_OPTIONS: OrdemServico['prioridade'][] = ['Baixa', 'Média', 'Alta', 'Urgente'];
const MOVIMENTACAO_OPTIONS: NonNullable<OrdemServico['movimentacao']>[] = [
  'Sem movimentação',
  'Mobilização',
  'Desmobilização',
];

const STATUS_STYLE: Record<OrdemServico['status'], string> = {
  Aberta: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  'Em Andamento': 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  'Aguardando Peça': 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  Concluída: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  Cancelada: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

const EQUIPMENT_STATUS_STYLE: Record<Equipamento['status'], string> = {
  Ativo: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  Parado: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  Manutenção: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  Mobilizado: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  Desmobilizado: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  'Esperando motorista': 'bg-violet-500/10 text-violet-300 border-violet-500/30',
};

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().split('T')[0];
};

const emptyForm = (equipamentoId = ''): WorkOrderForm => ({
  equipamentoId,
  tipo: 'Corretiva',
  prioridade: 'Média',
  descricao: '',
  status: 'Aberta',
  dataAbertura: today(),
  dataConclusao: '',
  responsavel: '',
  custoEstimado: undefined,
  custoFinal: undefined,
  observacao: '',
  motivo: '',
  motoristaId: '',
  motoristaNome: '',
  horimetroEntrada: undefined,
  horimetroSaida: undefined,
  horasMaquina: undefined,
  horasEquipamento: undefined,
  horasParadas: undefined,
  disponibilidadePercentual: undefined,
  dataSaida: '',
  horaSaida: '',
  localSaida: '',
  dataChegada: '',
  horaChegada: '',
  localChegada: '',
  movimentacao: 'Sem movimentação',
  saiuManutencaoEm: '',
});

const generateWorkOrderNumber = (orders: OrdemServico[]) => {
  const highest = orders.reduce((current, order) => {
    const suffix = order.numero.match(/(\d+)$/)?.[1];
    return Math.max(current, suffix ? Number(suffix) : 0);
  }, 0);
  return `OS-${String(highest + 1).padStart(4, '0')}`;
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const formatNumber = (value: number | null | undefined, suffix = '') => (
  value === null || value === undefined
    ? '—'
    : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${suffix}`
);

const fileDate = () => today().replaceAll('-', '');

const companyName = (equipment: Equipamento, companies: Empresa[]) => (
  companies.find(company => company.id === equipment.empresaId)?.nome || 'Empresa não vinculada'
);

const locationName = (equipment: Equipamento, locations: ObraLocal[]) => (
  locations.find(location => location.id === equipment.localAtualId)?.nome || 'Local não informado'
);

const compressEquipmentPhoto = (file: File): Promise<string> => new Promise((resolve, reject) => {
  if (!file.type.startsWith('image/')) {
    reject(new Error('Selecione uma imagem válida.'));
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    reject(new Error('A imagem deve ter no máximo 12 MB.'));
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error('A imagem selecionada está corrompida.'));
    image.onload = () => {
      const maximumWidth = 1000;
      const maximumHeight = 700;
      const scale = Math.min(1, maximumWidth / image.width, maximumHeight / image.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('O navegador não conseguiu processar a imagem.'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    image.src = String(reader.result);
  };
  reader.readAsDataURL(file);
});

const MetricCard = ({
  icon,
  label,
  value,
  helper,
  tone = 'text-slate-900',
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  helper: string;
  tone?: string;
}) => (
  <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <span className="text-slate-500">{icon}</span>
    </div>
    <p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p>
    <p className="mt-1 text-[11px] text-slate-500">{helper}</p>
  </div>
);

const representativeEquipmentPhoto = (equipment: Equipamento, isReneaOwned: boolean) => {
  if (equipment.foto) return equipment.foto;
  const type = `${equipment.tipo} ${equipment.nome} ${equipment.modelo}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (!isReneaOwned) {
    if (/escavadeira|retroescavadeira|trator|compactador|rolo/.test(type)) return neutralEarthmovingPhoto;
    if (/guindaste|grua|perfuratriz|bate estaca|pta|plataforma/.test(type)) return neutralLiftingPhoto;
    if (/gerador|compressor|bomba de agua/.test(type)) return neutralSupportPhoto;
    return neutralTruckPhoto;
  }
  if (/betoneira|bomba de concreto|caminhao bomba/.test(type)) return concreteMixerPhoto;
  if (/munck/.test(type)) return truckCranePhoto;
  if (/comboio|abastecimento/.test(type)) return fuelServiceTruckPhoto;
  if (/trator de esteira|bulldozer/.test(type)) return bulldozerPhoto;
  if (/retroescavadeira/.test(type)) return backhoePhoto;
  if (/compactador|rolo/.test(type)) return roadRollerPhoto;
  if (/perfuratriz|bate estaca/.test(type)) return drillingRigPhoto;
  if (/pta|plataforma/.test(type)) return aerialPlatformPhoto;
  if (/guindaste|grua/.test(type)) return liftingPilingPhoto;
  if (/escavadeira/.test(type)) return earthmovingPhoto;
  if (/gerador|compressor|bomba de agua/.test(type)) return siteSupportPhoto;
  return fleetTruckPhoto;
};

export default function ManutencaoEquipamentosTab({
  equipamentos,
  funcionarios,
  obras,
  empresas,
  ordensServico,
  onSaveOrdemServico,
  onDeleteOrdemServico,
  onSaveEquipamento,
  onUpdateEquipamentoStatus,
}: ManutencaoEquipamentosTabProps) {
  const [activeView, setActiveView] = useState<MaintenanceView>('frota');
  const reneaCompanyIds = useMemo(() => new Set(empresas.filter(company => company.nome.toLowerCase().includes('renea')).map(company => company.id)), [empresas]);
  const [searchQuery, setSearchQuery] = useState('');
  const [equipmentStatusFilter, setEquipmentStatusFilter] = useState('todos');
  const [orderStatusFilter, setOrderStatusFilter] = useState('todos');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<WorkOrderForm>(emptyForm());
  const [feedback, setFeedback] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const fleetSummaries = useMemo(
    () => buildMaintenanceFleetSummaries(equipamentos, ordensServico),
    [equipamentos, ordensServico],
  );
  const activeEmployees = useMemo(
    () => funcionarios.filter(employee => employee.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [funcionarios],
  );
  const filteredFleet = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('pt-BR');
    return fleetSummaries.filter(summary => {
      if (equipmentStatusFilter !== 'todos' && summary.equipment.status !== equipmentStatusFilter) return false;
      if (!query) return true;
      return [
        summary.equipment.prefixo,
        summary.equipment.nome,
        summary.equipment.placa,
        summary.equipment.familia,
        summary.driverName,
        companyName(summary.equipment, empresas),
        locationName(summary.equipment, obras),
      ].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(query));
    });
  }, [equipmentStatusFilter, empresas, fleetSummaries, obras, searchQuery]);
  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('pt-BR');
    return ordensServico
      .filter(order => {
        if (orderStatusFilter !== 'todos' && order.status !== orderStatusFilter) return false;
        if (!query) return true;
        const equipment = equipamentos.find(item => item.id === order.equipamentoId);
        return [
          order.numero,
          order.descricao,
          order.motivo,
          order.responsavel,
          order.motoristaNome,
          equipment?.prefixo,
          equipment?.nome,
        ].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(query));
      })
      .sort((first, second) => (
        `${second.dataAbertura}|${second.numero}`.localeCompare(`${first.dataAbertura}|${first.numero}`)
      ));
  }, [equipamentos, orderStatusFilter, ordensServico, searchQuery]);

  const selectedSummary = fleetSummaries.find(summary => summary.equipment.id === selectedEquipmentId) || null;
  const openOrders = ordensServico.filter(order => !['Concluída', 'Cancelada'].includes(order.status));
  const stoppedEquipment = equipamentos.filter(equipment => (
    equipment.status === 'Parado' || equipment.status === 'Manutenção'
  )).length;
  const withoutDriver = fleetSummaries.filter(summary => !summary.driverId).length;
  const averageAvailabilityValues = fleetSummaries
    .map(summary => summary.maintenanceAvailabilityPercent)
    .filter((value): value is number => value !== null);
  const averageAvailability = averageAvailabilityValues.length
    ? averageAvailabilityValues.reduce((total, value) => total + value, 0) / averageAvailabilityValues.length
    : null;
  const stoppedHours = fleetSummaries.reduce((total, summary) => total + summary.stoppedHours, 0);

  const openCreate = (equipmentId = '') => {
    const equipment = equipamentos.find(item => item.id === equipmentId);
    setFormData({
      ...emptyForm(equipmentId),
      motoristaId: equipment?.operadorResponsavelId || '',
      motoristaNome: equipment?.operadorResponsavelNome || '',
      localSaida: equipment ? locationName(equipment, obras) : '',
    });
    setEditingId(null);
    setIsFormOpen(true);
    setFeedback('');
  };

  const openEdit = (order: OrdemServico) => {
    setFormData({ ...emptyForm(order.equipamentoId), ...order });
    setEditingId(order.id);
    setIsFormOpen(true);
    setFeedback('');
  };

  const saveWorkOrder = (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.equipamentoId || !formData.descricao.trim() || !formData.motivo?.trim()) {
      setFeedback('Informe equipamento, motivo e manutenção/serviço executado.');
      return;
    }

    const employee = activeEmployees.find(item => item.id === formData.motoristaId);
    const metrics = deriveWorkOrderMetrics(formData as OrdemServico);
    const currentOrder = editingId ? ordensServico.find(order => order.id === editingId) : undefined;
    const completed = formData.status === 'Concluída';
    const finalOrder: OrdemServico = {
      ...formData,
      id: editingId || `os-${Date.now()}`,
      numero: currentOrder?.numero || generateWorkOrderNumber(ordensServico),
      motoristaNome: employee?.nome || formData.motoristaNome || '',
      horasMaquina: metrics.machineHours,
      horasEquipamento: metrics.equipmentHours,
      horasParadas: metrics.stoppedHours,
      disponibilidadePercentual: metrics.availabilityPercent ?? undefined,
      dataConclusao: completed ? formData.dataConclusao || today() : formData.dataConclusao || '',
      saiuManutencaoEm: completed
        ? formData.saiuManutencaoEm || new Date().toISOString()
        : formData.saiuManutencaoEm || '',
    };

    onSaveOrdemServico(finalOrder, editingId === null);
    const equipment = equipamentos.find(item => item.id === finalOrder.equipamentoId);
    if (equipment && (employee || finalOrder.motoristaNome)) {
      onSaveEquipamento({
        ...equipment,
        operadorResponsavelId: employee?.id || finalOrder.motoristaId,
        operadorResponsavelNome: employee?.nome || finalOrder.motoristaNome,
      }, false);
    }
    if (['Aberta', 'Em Andamento', 'Aguardando Peça'].includes(finalOrder.status)) {
      onUpdateEquipamentoStatus(finalOrder.equipamentoId, 'Manutenção');
    } else if (finalOrder.status === 'Concluída') {
      onUpdateEquipamentoStatus(finalOrder.equipamentoId, 'Ativo');
    }

    setIsFormOpen(false);
    setEditingId(null);
    setFeedback(`Ordem ${finalOrder.numero} salva com os indicadores operacionais.`);
  };

  const quickStatusChange = (order: OrdemServico, status: OrdemServico['status']) => {
    const updated: OrdemServico = {
      ...order,
      status,
      dataConclusao: status === 'Concluída' ? order.dataConclusao || today() : order.dataConclusao,
      saiuManutencaoEm: status === 'Concluída'
        ? order.saiuManutencaoEm || new Date().toISOString()
        : order.saiuManutencaoEm,
    };
    onSaveOrdemServico(updated, false);
    if (['Aberta', 'Em Andamento', 'Aguardando Peça'].includes(status)) {
      onUpdateEquipamentoStatus(order.equipamentoId, 'Manutenção');
    } else if (status === 'Concluída') {
      onUpdateEquipamentoStatus(order.equipamentoId, 'Ativo');
    }
  };

  const assignDriver = (summary: MaintenanceFleetSummary, employeeId: string) => {
    const employee = activeEmployees.find(item => item.id === employeeId);
    const nextStatus = employee
      ? summary.equipment.status === 'Esperando motorista' ? 'Ativo' : summary.equipment.status
      : summary.equipment.status === 'Ativo' ? 'Esperando motorista' : summary.equipment.status;
    onSaveEquipamento({
      ...summary.equipment,
      status: nextStatus,
      operadorResponsavelId: employee?.id || '',
      operadorResponsavelNome: employee?.nome || '',
    }, false);
    setFeedback(employee
      ? `${employee.nome} vinculado ao equipamento ${summary.equipment.prefixo}.`
      : `Equipamento ${summary.equipment.prefixo} ficou sem motorista definido.`);
  };

  const updatePhoto = async (summary: MaintenanceFleetSummary, file?: File) => {
    if (!file) return;
    try {
      const photo = await compressEquipmentPhoto(file);
      onSaveEquipamento({ ...summary.equipment, foto: photo }, false);
      setFeedback(`Foto do equipamento ${summary.equipment.prefixo} atualizada.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao processar a foto.');
    }
  };

  const exportExcel = async () => {
    setIsExporting(true);
    try {
      const [{ default: ExcelJS }, {
        addCorporateSummarySheet,
        configureCorporateWorkbook,
        downloadCorporateWorkbook,
        styleCorporateWorksheet,
      }] = await Promise.all([
        import('exceljs'),
        import('../utils/excelCorporate'),
      ]);
      const workbook = new ExcelJS.Workbook();
      configureCorporateWorkbook(workbook, 'Relatório profissional de manutenção e disponibilidade da frota');
      addCorporateSummarySheet(workbook, 'Manutenção e Disponibilidade da Frota', [
        ['Equipamentos cadastrados', equipamentos.length],
        ['Equipamentos parados ou em manutenção', stoppedEquipment],
        ['Ordens de serviço abertas', openOrders.length],
        ['Equipamentos sem motorista', withoutDriver],
        ['Horas paradas registradas', Number(stoppedHours.toFixed(2))],
        ['Disponibilidade média', averageAvailability === null ? 'Sem dados' : `${averageAvailability.toFixed(2)}%`],
      ]);

      const fleetSheet = workbook.addWorksheet('FROTA E MOTORISTAS');
      fleetSheet.addRow([]);
      fleetSheet.addRow([]);
      fleetSheet.addRow([
        'Prefixo', 'Equipamento', 'Categoria', 'Placa/Série', 'Empresa', 'Local atual',
        'Status', 'Motorista/Operador', 'OS abertas', 'Horas máquina', 'Horas equipamento',
        'Horas paradas', 'Disponibilidade', 'Meta', 'Última manutenção',
      ]);
      fleetSummaries.forEach(summary => fleetSheet.addRow([
        summary.equipment.prefixo,
        summary.equipment.nome,
        summary.equipment.categoriaFrota || summary.equipment.tipo,
        summary.equipment.placa || summary.equipment.seriePlaca,
        companyName(summary.equipment, empresas),
        locationName(summary.equipment, obras),
        summary.equipment.status,
        summary.driverName,
        summary.openWorkOrders,
        summary.machineHours,
        summary.equipmentHours,
        summary.stoppedHours,
        summary.maintenanceAvailabilityPercent,
        summary.targetPercent,
        summary.latestMaintenanceDate,
      ]));
      styleCorporateWorksheet(fleetSheet, {
        title: 'Frota, Motoristas e Disponibilidade',
        headerRow: 3,
        lastColumn: 15,
        recordCount: fleetSummaries.length,
      });
      fleetSheet.getColumn(13).numFmt = '0.00"%"';
      fleetSheet.getColumn(14).numFmt = '0.00"%"';

      const ordersSheet = workbook.addWorksheet('ORDENS DE SERVIÇO');
      ordersSheet.addRow([]);
      ordersSheet.addRow([]);
      ordersSheet.addRow([
        'OS', 'Prefixo', 'Equipamento', 'Tipo', 'Prioridade', 'Status', 'Abertura', 'Conclusão',
        'Motivo', 'Manutenção/Serviço', 'Responsável', 'Motorista', 'Horímetro entrada',
        'Horímetro saída', 'Horas máquina', 'Horas equipamento', 'Horas paradas', 'Disponibilidade',
        'Movimentação', 'Saída', 'Origem', 'Chegada', 'Destino', 'Custo estimado', 'Custo final',
        'Saída da manutenção', 'Observações',
      ]);
      ordensServico.forEach(order => {
        const equipment = equipamentos.find(item => item.id === order.equipamentoId);
        const metrics = deriveWorkOrderMetrics(order);
        ordersSheet.addRow([
          order.numero,
          equipment?.prefixo || '',
          equipment?.nome || '',
          order.tipo,
          order.prioridade,
          order.status,
          order.dataAbertura,
          order.dataConclusao || '',
          order.motivo || '',
          order.descricao,
          order.responsavel,
          order.motoristaNome || '',
          order.horimetroEntrada ?? '',
          order.horimetroSaida ?? '',
          metrics.machineHours,
          metrics.equipmentHours,
          metrics.stoppedHours,
          metrics.availabilityPercent ?? '',
          order.movimentacao || 'Sem movimentação',
          [order.dataSaida, order.horaSaida].filter(Boolean).join(' '),
          order.localSaida || '',
          [order.dataChegada, order.horaChegada].filter(Boolean).join(' '),
          order.localChegada || '',
          order.custoEstimado ?? '',
          order.custoFinal ?? '',
          order.saiuManutencaoEm || '',
          order.observacao,
        ]);
      });
      styleCorporateWorksheet(ordersSheet, {
        title: 'Histórico Completo de Ordens de Serviço',
        headerRow: 3,
        lastColumn: 27,
        recordCount: ordensServico.length,
      });
      ordersSheet.getColumn(18).numFmt = '0.00"%"';
      ordersSheet.getColumn(24).numFmt = 'R$ #,##0.00';
      ordersSheet.getColumn(25).numFmt = 'R$ #,##0.00';

      await downloadCorporateWorkbook(workbook, `RENEA_manutencao_profissional_${fileDate()}.xlsx`);
      setFeedback('Relatório Excel profissional gerado com frota, motoristas e histórico de OS.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportPdf = async () => {
    setIsExporting(true);
    try {
      const { generateUniversalPdfReport } = await import('../utils/universalPdfReport');
      await generateUniversalPdfReport({
        title: 'Relatório de Manutenção e Disponibilidade',
        subtitle: 'Frota, responsáveis, horas operacionais, disponibilidade e ordens de serviço',
        company: 'RENEA INFRAESTRUTURA · Sistema Integrado de Gestão Operacional',
        orientation: 'landscape',
        fileName: `RENEA_manutencao_profissional_${fileDate()}.pdf`,
        filters: [searchQuery ? `Busca: ${searchQuery}` : 'Toda a frota', equipmentStatusFilter !== 'todos' ? `Status: ${equipmentStatusFilter}` : 'Todos os status'],
        summary: [
          { label: 'Frota', value: equipamentos.length },
          { label: 'Parados / manutenção', value: stoppedEquipment },
          { label: 'OS abertas', value: openOrders.length },
          { label: 'Sem motorista', value: withoutDriver },
          { label: 'Disponibilidade média', value: formatNumber(averageAvailability, '%') },
        ],
        columns: [
          { header: 'Prefixo', dataKey: 'prefixo' },
          { header: 'Equipamento', dataKey: 'equipamento' },
          { header: 'Status', dataKey: 'status' },
          { header: 'Motorista / Operador', dataKey: 'motorista' },
          { header: 'Local', dataKey: 'local' },
          { header: 'OS abertas', dataKey: 'os' },
          { header: 'H. máquina', dataKey: 'maquina' },
          { header: 'H. equipamento', dataKey: 'equipamentoHoras' },
          { header: 'H. paradas', dataKey: 'paradas' },
          { header: 'Disponibilidade', dataKey: 'disponibilidade' },
          { header: 'Meta', dataKey: 'meta' },
        ],
        rows: fleetSummaries.map(summary => ({
          prefixo: summary.equipment.prefixo,
          equipamento: summary.equipment.nome,
          status: summary.equipment.status,
          motorista: summary.driverName,
          local: locationName(summary.equipment, obras),
          os: summary.openWorkOrders,
          maquina: formatNumber(summary.machineHours),
          equipamentoHoras: formatNumber(summary.equipmentHours),
          paradas: formatNumber(summary.stoppedHours),
          disponibilidade: formatNumber(summary.maintenanceAvailabilityPercent, '%'),
          meta: formatNumber(summary.targetPercent, '%'),
        })),
      });
      setFeedback('Relatório PDF profissional gerado com indicadores e histórico detalhado.');
    } finally {
      setIsExporting(false);
    }
  };

  const navButton = (view: MaintenanceView, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => {
        setActiveView(view);
        setIsFormOpen(false);
      }}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-colors ${
        activeView === view
          ? 'bg-emerald-600 text-white shadow-sm'
          : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="space-y-5" id="manutencao-equipamentos-tab-root">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                <Wrench className="h-4 w-4" />
                Gestão integrada da frota
              </div>
              <h1 className="mt-2 font-sans text-2xl font-black tracking-tight text-slate-900">
                Central de Manutenção e Disponibilidade
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                Consulta visual por equipamento, vínculo de motorista, movimentações, horas operacionais,
                manutenção e relatórios profissionais em uma única tela.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
              {navButton('frota', 'Consulta da frota', <Truck className="h-4 w-4" />)}
              {navButton('ordens', 'Ordens de serviço', <ClipboardList className="h-4 w-4" />)}
              {navButton('relatorio', 'Relatório completo', <BarChart3 className="h-4 w-4" />)}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          icon={<Truck className="h-5 w-5" />}
          label="Frota cadastrada"
          value={equipamentos.length}
          helper="Equipamentos, veículos e implementos"
        />
        <MetricCard
          icon={<Wrench className="h-5 w-5" />}
          label="OS abertas"
          value={openOrders.length}
          helper="Abertas, em andamento ou aguardando peça"
          tone={openOrders.length ? 'text-amber-600' : 'text-emerald-600'}
        />
        <MetricCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Parados"
          value={stoppedEquipment}
          helper="Parados ou em manutenção"
          tone={stoppedEquipment ? 'text-rose-600' : 'text-emerald-600'}
        />
        <MetricCard
          icon={<UserRound className="h-5 w-5" />}
          label="Sem motorista"
          value={withoutDriver}
          helper="Aguardando definição de responsável"
          tone={withoutDriver ? 'text-violet-600' : 'text-emerald-600'}
        />
        <MetricCard
          icon={<Gauge className="h-5 w-5" />}
          label="Disponibilidade média"
          value={formatNumber(averageAvailability, '%')}
          helper={`${formatNumber(stoppedHours, ' h')} paradas registradas`}
          tone={averageAvailability !== null && averageAvailability < 80 ? 'text-amber-600' : 'text-emerald-600'}
        />
      </div>

      {feedback && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" />{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} aria-label="Fechar mensagem">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {!isFormOpen && activeView !== 'relatorio' && (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-600" />
            <input
              type="search"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Buscar prefixo, equipamento, motorista, OS, motivo ou local..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-10 pr-3 text-xs text-white outline-none focus:border-emerald-500"
            />
          </div>
          {activeView === 'frota' ? (
            <select
              value={equipmentStatusFilter}
              onChange={event => setEquipmentStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 outline-none focus:border-emerald-500"
            >
              <option value="todos">Todos os status</option>
              {Object.keys(EQUIPMENT_STATUS_STYLE).map(status => <option key={status}>{status}</option>)}
            </select>
          ) : (
            <select
              value={orderStatusFilter}
              onChange={event => setOrderStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 outline-none focus:border-emerald-500"
            >
              <option value="todos">Todos os status</option>
              {STATUS_OPTIONS.map(status => <option key={status}>{status}</option>)}
            </select>
          )}
          <button
            type="button"
            onClick={() => openCreate(selectedEquipmentId)}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-500"
          >
            <Plus className="h-4 w-4" />
            Nova ordem de serviço
          </button>
        </div>
      )}

      {!isFormOpen && activeView === 'frota' && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.8fr)]">
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {filteredFleet.map(summary => (
              <button
                type="button"
                key={summary.equipment.id}
                onClick={() => setSelectedEquipmentId(summary.equipment.id)}
                className={`overflow-hidden rounded-2xl border bg-slate-900 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-emerald-600 ${
                  selectedEquipmentId === summary.equipment.id ? 'border-emerald-500 ring-1 ring-emerald-500/30' : 'border-slate-800'
                }`}
              >
                <div className="relative h-40 overflow-hidden">
                  <img
                    src={representativeEquipmentPhoto(summary.equipment, reneaCompanyIds.has(summary.equipment.empresaId))}
                    alt={`${summary.equipment.prefixo} - ${summary.equipment.nome}`}
                    className="h-full w-full object-cover"
                  />
                  <span className={`absolute left-3 top-3 rounded-lg border px-2 py-1 text-[9px] font-black uppercase ${EQUIPMENT_STATUS_STYLE[summary.equipment.status]}`}>
                    {summary.equipment.status}
                  </span>
                  {summary.activeWorkOrder && (
                    <span className="absolute right-3 top-3 rounded-lg bg-slate-950/90 px-2 py-1 text-[9px] font-black text-amber-300">
                      {summary.activeWorkOrder.numero}
                    </span>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-lg font-black text-white">{summary.equipment.prefixo}</span>
                      <ChevronRight className="h-4 w-4 text-slate-600" />
                    </div>
                    <p className="line-clamp-1 text-xs font-semibold text-slate-300">{summary.equipment.nome}</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
                    <UserRound className={`h-4 w-4 shrink-0 ${summary.driverId ? 'text-emerald-400' : 'text-violet-400'}`} />
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">Motorista / operador</p>
                      <p className="truncate text-[11px] font-bold text-slate-300">{summary.driverName}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-slate-950 p-2">
                      <p className="text-[9px] text-slate-600">Disponib.</p>
                      <p className="text-xs font-black text-emerald-300">
                        {formatNumber(summary.maintenanceAvailabilityPercent, '%')}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-950 p-2">
                      <p className="text-[9px] text-slate-600">Paradas</p>
                      <p className="text-xs font-black text-amber-300">{formatNumber(summary.stoppedHours, 'h')}</p>
                    </div>
                    <div className="rounded-lg bg-slate-950 p-2">
                      <p className="text-[9px] text-slate-600">OS abertas</p>
                      <p className="text-xs font-black text-white">{summary.openWorkOrders}</p>
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {filteredFleet.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-800 bg-slate-900/50 p-12 text-center">
                <Truck className="mx-auto h-10 w-10 text-slate-700" />
                <p className="mt-3 text-sm font-bold text-slate-400">Nenhum equipamento encontrado.</p>
              </div>
            )}
          </div>

          <aside className="h-fit rounded-2xl border border-slate-800 bg-slate-900 shadow-xl xl:sticky xl:top-4">
            {selectedSummary ? (
              <>
                <div className="relative h-52 overflow-hidden rounded-t-2xl">
                  <img
                    src={representativeEquipmentPhoto(selectedSummary.equipment, reneaCompanyIds.has(selectedSummary.equipment.empresaId))}
                    alt={selectedSummary.equipment.nome}
                    className="h-full w-full object-cover"
                  />
                  <label className="absolute bottom-3 right-3 flex cursor-pointer items-center gap-2 rounded-xl bg-slate-950/90 px-3 py-2 text-[10px] font-black text-white shadow-lg hover:bg-emerald-600">
                    <Camera className="h-4 w-4" />
                    {selectedSummary.equipment.foto ? 'Trocar foto' : 'Adicionar foto real'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={event => void updatePhoto(selectedSummary, event.target.files?.[0])}
                    />
                  </label>
                </div>
                <div className="space-y-5 p-5">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-black text-white">{selectedSummary.equipment.prefixo}</h2>
                        <p className="text-xs text-slate-400">{selectedSummary.equipment.nome}</p>
                      </div>
                      <span className={`rounded-lg border px-2 py-1 text-[9px] font-black uppercase ${EQUIPMENT_STATUS_STYLE[selectedSummary.equipment.status]}`}>
                        {selectedSummary.equipment.status}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-slate-600" />{companyName(selectedSummary.equipment, empresas)}</span>
                      <span className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-slate-600" />{locationName(selectedSummary.equipment, obras)}</span>
                      <span className="flex items-center gap-2"><HardHat className="h-3.5 w-3.5 text-slate-600" />{selectedSummary.equipment.familia || selectedSummary.equipment.tipo}</span>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Motorista / operador atual
                    </label>
                    <select
                      value={selectedSummary.driverId}
                      onChange={event => assignDriver(selectedSummary, event.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
                    >
                      <option value="">Sem motorista definido</option>
                      {activeEmployees.map(employee => (
                        <option key={employee.id} value={employee.id}>
                          {employee.nome} — {employee.cargo || 'Função não informada'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <p className="text-[9px] uppercase text-slate-600">Horas máquina</p>
                      <p className="mt-1 text-base font-black text-white">{formatNumber(selectedSummary.machineHours, ' h')}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <p className="text-[9px] uppercase text-slate-600">Horas paradas</p>
                      <p className="mt-1 text-base font-black text-amber-300">{formatNumber(selectedSummary.stoppedHours, ' h')}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <p className="text-[9px] uppercase text-slate-600">Disponibilidade</p>
                      <p className="mt-1 text-base font-black text-emerald-300">{formatNumber(selectedSummary.maintenanceAvailabilityPercent, '%')}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <p className="text-[9px] uppercase text-slate-600">Meta</p>
                      <p className="mt-1 text-base font-black text-white">{formatNumber(selectedSummary.targetPercent, '%')}</p>
                    </div>
                  </div>

                  {selectedSummary.activeWorkOrder ? (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                      <p className="text-[9px] font-black uppercase tracking-wider text-amber-400">Manutenção em aberto</p>
                      <p className="mt-1 text-xs font-bold text-white">
                        {selectedSummary.activeWorkOrder.numero} — {selectedSummary.activeWorkOrder.descricao}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        Desde {formatDate(selectedSummary.activeWorkOrder.dataAbertura)} · {selectedSummary.activeWorkOrder.status}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-[11px] text-emerald-200">
                      Nenhuma ordem de serviço aberta para este equipamento.
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => openCreate(selectedSummary.equipment.id)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-500"
                  >
                    <Plus className="h-4 w-4" />
                    Abrir OS para este equipamento
                  </button>
                </div>
              </>
            ) : (
              <div className="p-10 text-center">
                <ImageIcon className="mx-auto h-10 w-10 text-slate-700" />
                <p className="mt-3 text-sm font-bold text-slate-400">Selecione um equipamento</p>
                <p className="mt-1 text-xs text-slate-600">Veja foto, motorista, localização e histórico operacional.</p>
              </div>
            )}
          </aside>
        </div>
      )}

      {!isFormOpen && activeView === 'ordens' && (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/70 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">OS / equipamento</th>
                  <th className="px-4 py-3">Motivo e manutenção</th>
                  <th className="px-4 py-3">Motorista</th>
                  <th className="px-4 py-3">Horas</th>
                  <th className="px-4 py-3">Movimentação</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredOrders.map(order => {
                  const equipment = equipamentos.find(item => item.id === order.equipamentoId);
                  const metrics = deriveWorkOrderMetrics(order);
                  return (
                    <tr key={order.id} className="align-top hover:bg-slate-800/30">
                      <td className="px-4 py-4">
                        <p className="font-black text-emerald-300">{order.numero}</p>
                        <p className="mt-1 font-bold text-white">{equipment?.prefixo || 'Equipamento não localizado'}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">{equipment?.nome || ''}</p>
                      </td>
                      <td className="max-w-sm px-4 py-4">
                        <p className="font-bold text-slate-200">{order.motivo || 'Motivo não informado'}</p>
                        <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{order.descricao}</p>
                        <p className="mt-1 text-[10px] text-slate-600">{formatDate(order.dataAbertura)} → {formatDate(order.dataConclusao)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className="flex items-center gap-2 font-semibold text-slate-300">
                          <UserRound className="h-4 w-4 text-slate-600" />
                          {order.motoristaNome || equipment?.operadorResponsavelNome || 'Não definido'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-[11px] text-slate-400">
                        <p>Máquina: <strong className="text-slate-200">{formatNumber(metrics.machineHours, ' h')}</strong></p>
                        <p>Parada: <strong className="text-amber-300">{formatNumber(metrics.stoppedHours, ' h')}</strong></p>
                        <p>Disp.: <strong className="text-emerald-300">{formatNumber(metrics.availabilityPercent, '%')}</strong></p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="flex items-center gap-2 font-semibold text-slate-300">
                          <Route className="h-4 w-4 text-slate-600" />
                          {order.movimentacao || 'Sem movimentação'}
                        </p>
                        {(order.dataSaida || order.dataChegada) && (
                          <p className="mt-1 text-[10px] text-slate-500">
                            {formatDate(order.dataSaida)} → {formatDate(order.dataChegada)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={order.status}
                          onChange={event => quickStatusChange(order, event.target.value as OrdemServico['status'])}
                          className={`rounded-lg border px-2 py-1.5 text-[10px] font-black outline-none ${STATUS_STYLE[order.status]}`}
                        >
                          {STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(order)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-blue-500/10 hover:text-blue-300"
                            title="Editar ordem"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Excluir definitivamente a ordem ${order.numero}?`)) onDeleteOrdemServico(order.id);
                            }}
                            className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"
                            title="Excluir ordem"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredOrders.length === 0 && (
            <div className="p-12 text-center">
              <ClipboardList className="mx-auto h-10 w-10 text-slate-700" />
              <p className="mt-3 text-sm font-bold text-slate-400">Nenhuma ordem de serviço encontrada.</p>
            </div>
          )}
        </div>
      )}

      {!isFormOpen && activeView === 'relatorio' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">Relatório gerencial</p>
                <h2 className="mt-1 text-xl font-black text-white">Desempenho completo da manutenção</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Indicadores consolidados, disponibilidade por equipamento, motoristas e histórico integral de OS.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => void exportExcel()}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Exportar Excel
                </button>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={exportPdf}
                  className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs font-black text-slate-200 hover:border-emerald-500 disabled:opacity-50"
                >
                  <FileDown className="h-4 w-4" />
                  Exportar PDF
                </button>
              </div>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 lg:col-span-2">
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-emerald-400" />
                <h3 className="text-sm font-black text-white">Disponibilidade por equipamento</h3>
              </div>
              <div className="mt-5 space-y-4">
                {fleetSummaries
                  .slice()
                  .sort((first, second) => (
                    (first.maintenanceAvailabilityPercent ?? -1) - (second.maintenanceAvailabilityPercent ?? -1)
                  ))
                  .map(summary => {
                    const availability = summary.maintenanceAvailabilityPercent ?? 0;
                    const tone = summary.maintenanceAvailabilityPercent === null
                      ? 'bg-slate-700'
                      : summary.belowTarget ? 'bg-amber-500' : 'bg-emerald-500';
                    return (
                      <div key={summary.equipment.id}>
                        <div className="mb-1.5 flex items-center justify-between gap-4 text-[11px]">
                          <span className="font-bold text-slate-300">
                            {summary.equipment.prefixo} · {summary.equipment.nome}
                          </span>
                          <span className={summary.belowTarget ? 'font-black text-amber-300' : 'font-black text-emerald-300'}>
                            {formatNumber(summary.maintenanceAvailabilityPercent, '%')}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-950">
                          <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, availability)}%` }} />
                        </div>
                        <div className="mt-1 flex justify-between text-[9px] text-slate-600">
                          <span>{summary.driverName}</span>
                          <span>Meta {formatNumber(summary.targetPercent, '%')}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-400" />
                <h3 className="text-sm font-black text-white">Leitura executiva</h3>
              </div>
              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <p className="text-[9px] uppercase text-slate-600">Horas equipamento</p>
                  <p className="mt-1 text-xl font-black text-white">
                    {formatNumber(fleetSummaries.reduce((total, item) => total + item.equipmentHours, 0), ' h')}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <p className="text-[9px] uppercase text-slate-600">Horas paradas</p>
                  <p className="mt-1 text-xl font-black text-amber-300">{formatNumber(stoppedHours, ' h')}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <p className="text-[9px] uppercase text-slate-600">Custo final acumulado</p>
                  <p className="mt-1 text-xl font-black text-white">
                    {ordensServico.reduce((total, order) => total + (Number(order.custoFinal) || 0), 0)
                      .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <div className={`rounded-xl border p-3 ${
                  withoutDriver ? 'border-violet-500/20 bg-violet-500/10' : 'border-emerald-500/20 bg-emerald-500/10'
                }`}>
                  <p className="text-[9px] uppercase text-slate-500">Vínculos operacionais</p>
                  <p className={`mt-1 text-sm font-black ${withoutDriver ? 'text-violet-300' : 'text-emerald-300'}`}>
                    {withoutDriver ? `${withoutDriver} equipamento(s) sem motorista` : 'Toda a frota possui responsável'}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {isFormOpen && (
        <form onSubmit={saveWorkOrder} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-6 py-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                {editingId ? 'Atualização de histórico' : 'Novo atendimento'}
              </p>
              <h2 className="mt-1 text-lg font-black text-white">
                {editingId ? 'Editar ordem de serviço' : 'Abrir ordem de serviço completa'}
              </h2>
            </div>
            <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-7 p-6">
            <section>
              <div className="mb-4 flex items-center gap-2">
                <Truck className="h-4 w-4 text-emerald-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">Identificação e responsabilidade</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="xl:col-span-2">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Equipamento *</span>
                  <select
                    required
                    value={formData.equipamentoId}
                    onChange={event => {
                      const equipment = equipamentos.find(item => item.id === event.target.value);
                      setFormData(current => ({
                        ...current,
                        equipamentoId: event.target.value,
                        motoristaId: equipment?.operadorResponsavelId || current.motoristaId,
                        motoristaNome: equipment?.operadorResponsavelNome || current.motoristaNome,
                        localSaida: equipment ? locationName(equipment, obras) : current.localSaida,
                      }));
                    }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                  >
                    <option value="">Selecione...</option>
                    {equipamentos.map(equipment => (
                      <option key={equipment.id} value={equipment.id}>
                        {equipment.prefixo} — {equipment.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Motorista / operador</span>
                  <select
                    value={formData.motoristaId || ''}
                    onChange={event => {
                      const employee = activeEmployees.find(item => item.id === event.target.value);
                      setFormData(current => ({
                        ...current,
                        motoristaId: event.target.value,
                        motoristaNome: employee?.nome || '',
                      }));
                    }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                  >
                    <option value="">Não definido</option>
                    {activeEmployees.map(employee => (
                      <option key={employee.id} value={employee.id}>{employee.nome} — {employee.cargo}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Responsável manutenção</span>
                  <input
                    value={formData.responsavel}
                    onChange={event => setFormData(current => ({ ...current, responsavel: event.target.value }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                    placeholder="Equipe, oficina ou responsável"
                  />
                </label>
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-emerald-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">Manutenção e situação da OS</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label>
                  <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Tipo</span>
                  <select
                    value={formData.tipo}
                    onChange={event => setFormData(current => ({ ...current, tipo: event.target.value as OrdemServico['tipo'] }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                  >
                    {TIPO_OPTIONS.map(type => <option key={type}>{type}</option>)}
                  </select>
                </label>
                <label>
                  <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Prioridade</span>
                  <select
                    value={formData.prioridade}
                    onChange={event => setFormData(current => ({ ...current, prioridade: event.target.value as OrdemServico['prioridade'] }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                  >
                    {PRIORIDADE_OPTIONS.map(priority => <option key={priority}>{priority}</option>)}
                  </select>
                </label>
                <label>
                  <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Status</span>
                  <select
                    value={formData.status}
                    onChange={event => setFormData(current => ({ ...current, status: event.target.value as OrdemServico['status'] }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                  >
                    {STATUS_OPTIONS.map(status => <option key={status}>{status}</option>)}
                  </select>
                </label>
                <label>
                  <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Movimentação</span>
                  <select
                    value={formData.movimentacao || 'Sem movimentação'}
                    onChange={event => setFormData(current => ({
                      ...current,
                      movimentacao: event.target.value as NonNullable<OrdemServico['movimentacao']>,
                    }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                  >
                    {MOVIMENTACAO_OPTIONS.map(movement => <option key={movement}>{movement}</option>)}
                  </select>
                </label>
                <label className="md:col-span-2">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Motivo *</span>
                  <input
                    required
                    value={formData.motivo || ''}
                    onChange={event => setFormData(current => ({ ...current, motivo: event.target.value }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                    placeholder="Falha, revisão programada, avaria ou outro motivo"
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Manutenção / serviço executado *</span>
                  <input
                    required
                    value={formData.descricao}
                    onChange={event => setFormData(current => ({ ...current, descricao: event.target.value }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                    placeholder="Descreva o diagnóstico e o serviço realizado"
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Data abertura</span>
                  <input
                    type="date"
                    required
                    value={formData.dataAbertura}
                    onChange={event => setFormData(current => ({ ...current, dataAbertura: event.target.value }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Data conclusão</span>
                  <input
                    type="date"
                    value={formData.dataConclusao || ''}
                    onChange={event => setFormData(current => ({ ...current, dataConclusao: event.target.value }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Custo estimado</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.custoEstimado ?? ''}
                    onChange={event => setFormData(current => ({ ...current, custoEstimado: event.target.value ? Number(event.target.value) : undefined }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Custo final</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.custoFinal ?? ''}
                    onChange={event => setFormData(current => ({ ...current, custoFinal: event.target.value ? Number(event.target.value) : undefined }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                  />
                </label>
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center gap-2">
                <Gauge className="h-4 w-4 text-emerald-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">Horas e disponibilidade</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {([
                  ['horimetroEntrada', 'Horímetro entrada'],
                  ['horimetroSaida', 'Horímetro saída'],
                  ['horasMaquina', 'Horas máquina'],
                  ['horasEquipamento', 'Horas equipamento'],
                  ['horasParadas', 'Horas paradas'],
                ] as Array<[keyof WorkOrderForm, string]>).map(([field, label]) => (
                  <label key={field}>
                    <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">{label}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={(formData[field] as number | undefined) ?? ''}
                      onChange={event => setFormData(current => ({
                        ...current,
                        [field]: event.target.value ? Number(event.target.value) : undefined,
                      }))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                    />
                  </label>
                ))}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                  <span className="block text-[10px] font-bold uppercase text-emerald-500">Taxa disponibilidade</span>
                  <strong className="mt-2 block text-xl text-emerald-300">
                    {formatNumber(deriveWorkOrderMetrics(formData as OrdemServico).availabilityPercent, '%')}
                  </strong>
                  <span className="text-[9px] text-emerald-500/70">Calculada automaticamente</span>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center gap-2">
                <Route className="h-4 w-4 text-emerald-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">Saída, chegada e mobilização</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label>
                  <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Data saída</span>
                  <input type="date" value={formData.dataSaida || ''} onChange={event => setFormData(current => ({ ...current, dataSaida: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500" />
                </label>
                <label>
                  <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Hora saída</span>
                  <input type="time" value={formData.horaSaida || ''} onChange={event => setFormData(current => ({ ...current, horaSaida: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500" />
                </label>
                <label className="xl:col-span-2">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Origem / local de saída</span>
                  <input value={formData.localSaida || ''} onChange={event => setFormData(current => ({ ...current, localSaida: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500" />
                </label>
                <label>
                  <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Data chegada</span>
                  <input type="date" value={formData.dataChegada || ''} onChange={event => setFormData(current => ({ ...current, dataChegada: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500" />
                </label>
                <label>
                  <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Hora chegada</span>
                  <input type="time" value={formData.horaChegada || ''} onChange={event => setFormData(current => ({ ...current, horaChegada: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500" />
                </label>
                <label className="xl:col-span-2">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Destino / local de chegada</span>
                  <input value={formData.localChegada || ''} onChange={event => setFormData(current => ({ ...current, localChegada: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500" />
                </label>
              </div>
            </section>

            <section>
              <label>
                <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">Observações completas</span>
                <textarea
                  rows={4}
                  value={formData.observacao}
                  onChange={event => setFormData(current => ({ ...current, observacao: event.target.value }))}
                  className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                  placeholder="Peças aplicadas, pendências, condições de entrega, recomendações e demais observações..."
                />
              </label>
            </section>

            {feedback && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                {feedback}
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-800 bg-slate-950/50 px-6 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-black text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-500"
            >
              <Save className="h-4 w-4" />
              Salvar ordem completa
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-[10px] text-slate-600">
        <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Última atualização em tempo real</span>
        <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />Dados preservados automaticamente</span>
        <span className="flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5" />Disponibilidade calculada por horas registradas</span>
      </div>
    </div>
  );
}
