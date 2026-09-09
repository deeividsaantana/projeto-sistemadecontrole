import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  MapPin,
  Save,
  Search,
  Truck,
  UserRound,
  UserPlus,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import type {
  ControleEquipamentoDiario,
  Empresa,
  Equipamento,
  EventoControleEquipamentoDiario,
  Funcionario,
  GrupoEquipe,
  OrdemServico,
} from '../../types';
import {
  FLEET_OPERATIONAL_STATUS,
  type FleetOperationalStatus,
  type FleetPersistedRecord,
} from '../../fleet/domain';
import { FLEET_STATUS_DEFINITIONS, normalizeOperationalStatus, toLegacyDailyStatus } from '../../fleet/status';
import { classifyOperationalFleet, findEmployeeTeam, lookupDriverByCode, lookupEquipmentByPrefix } from '../../fleet/reconciliation';
import { getOperationalToday } from '../../fleet/time';
import { normalizeEmployeeCode, normalizePrefix } from '../../utils/canonicalIdentity';

interface Props {
  record?: FleetPersistedRecord;
  records: ControleEquipamentoDiario[];
  equipment: Equipamento[];
  employees: Funcionario[];
  companies: Empresa[];
  teams: GrupoEquipe[];
  maintenanceOrders: OrdemServico[];
  /** Quem está informando o lançamento; vai para o histórico do registro. */
  registeredBy: string;
  onSave: (record: ControleEquipamentoDiario, isNew: boolean) => void | Promise<void>;
  onClose: () => void;
  onOpenEmployeeRegistration: () => void;
  onOpenDriverRegistry?: () => void;
  onOpenEquipmentRegistry?: () => void;
  onOpenMaintenance?: () => void;
}

interface FormState {
  id: string;
  date: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  employeeCompany: string;
  teamName: string;
  temporaryDriver: boolean;
  equipmentId: string;
  prefix: string;
  plate: string;
  equipmentCompany: string;
  operationalStatus: FleetOperationalStatus;
  departureTime: string;
  maintenanceEntryTime: string;
  releaseTime: string;
  availableSince: string;
  location: string;
  maintenanceOrderId: string;
  maintenanceReason: string;
  note: string;
}

const initialForm = (
  record: FleetPersistedRecord | undefined,
  equipment: Equipamento[],
  employees: Funcionario[],
  companies: Empresa[],
  teams: GrupoEquipe[],
): FormState => {
  const selectedEquipment = equipment.find(item =>
    item.id === record?.equipamentoId
    || normalizePrefix(item.prefixo) === normalizePrefix(record?.prefixo));
  const selectedEmployee = employees.find(item =>
    item.id === record?.funcionarioId
    || normalizeEmployeeCode(item.matricula) === normalizeEmployeeCode(record?.codigoFuncionario));
  const employeeCompany = companies.find(company => company.id === selectedEmployee?.empresaId);
  const equipmentCompany = companies.find(company => company.id === selectedEquipment?.empresaId);
  const team = findEmployeeTeam(selectedEmployee, teams);
  return {
    id: record?.id || `controle-equip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: record?.data || getOperationalToday(),
    employeeId: selectedEmployee?.id || record?.funcionarioId || '',
    employeeCode: selectedEmployee?.matricula || record?.codigoFuncionario || '',
    employeeName: selectedEmployee?.nome || record?.nomeMotorista || '',
    employeeCompany: employeeCompany?.nome || '',
    teamName: team?.nome || '',
    temporaryDriver: record?.motoristaTemporario || false,
    equipmentId: selectedEquipment?.id || record?.equipamentoId || '',
    prefix: selectedEquipment?.prefixo || record?.prefixo || '',
    plate: selectedEquipment?.placa || selectedEquipment?.seriePlaca || '',
    equipmentCompany: equipmentCompany?.nome || '',
    operationalStatus: normalizeOperationalStatus(record?.status || 'Em operação'),
    departureTime: record?.horaSaida || '',
    maintenanceEntryTime: record?.horaEntradaManutencao || '',
    releaseTime: record?.horaLiberacao || '',
    availableSince: record?.disponivelDesde || '',
    location: record?.local || 'Pátio Aracaré',
    maintenanceOrderId: record?.ordemServicoId || '',
    maintenanceReason: record?.motivoManutencao || '',
    note: record?.observacao || '',
  };
};

const eventTypeForStatus = (
  previous: FleetOperationalStatus | undefined,
  next: FleetOperationalStatus,
  releaseTime: string,
): EventoControleEquipamentoDiario['tipo'] => {
  if (
    next === FLEET_OPERATIONAL_STATUS.maintenance
    || next === FLEET_OPERATIONAL_STATUS.waitingMaintenance
  ) return 'ENTRADA_MANUTENCAO';
  if (releaseTime && previous === FLEET_OPERATIONAL_STATUS.maintenance) {
    return 'LIBERACAO_MANUTENCAO';
  }
  if (next === FLEET_OPERATIONAL_STATUS.operating) return 'SAIDA_OPERACAO';
  return 'ALTERACAO_STATUS';
};

const QUICK_STATUSES = [
  { value: FLEET_OPERATIONAL_STATUS.operating, label: 'Em operação', hint: 'Alt + 1', icon: Truck, active: 'border-emerald-600 bg-emerald-50 text-emerald-800' },
  { value: FLEET_OPERATIONAL_STATUS.maintenance, label: 'Em manutenção', hint: 'Alt + 2', icon: Wrench, active: 'border-rose-500 bg-rose-50 text-rose-800' },
  { value: FLEET_OPERATIONAL_STATUS.available, label: 'À disposição', hint: 'Alt + 3', icon: CheckCircle2, active: 'border-sky-500 bg-sky-50 text-sky-800' },
  { value: FLEET_OPERATIONAL_STATUS.pending, label: 'A confirmar', hint: 'Alt + 4', icon: Clock3, active: 'border-amber-500 bg-amber-50 text-amber-900' },
] as const;

const nowTime = () => new Date().toLocaleTimeString('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
});

export default function DailyRecordForm({
  record,
  records,
  equipment,
  employees,
  companies,
  teams,
  maintenanceOrders,
  registeredBy,
  onSave,
  onClose,
  onOpenDriverRegistry,
  onOpenEquipmentRegistry,
  onOpenMaintenance,
}: Props) {
  const [form, setForm] = useState<FormState>(
    () => initialForm(record, equipment, employees, companies, teams),
  );
  const [employeeLookupError, setEmployeeLookupError] = useState('');
  const [equipmentLookupError, setEquipmentLookupError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const employeeCodeFieldRef = useRef<HTMLInputElement>(null);
  const prefixFieldRef = useRef<HTMLInputElement>(null);

  // Foco automático na matrícula ao abrir o lançamento: é o campo que inicia
  // a busca do motorista, o primeiro dado que o operador digita.
  useEffect(() => {
    const raf = requestAnimationFrame(() => employeeCodeFieldRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleRootKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      formRef.current?.requestSubmit();
      return;
    }
    if (event.altKey && ['1', '2', '3', '4'].includes(event.key)) {
      event.preventDefault();
      const selected = QUICK_STATUSES[Number(event.key) - 1];
      if (selected) update('operationalStatus', selected.value);
      return;
    }
    if (event.altKey && event.key.toLocaleLowerCase('pt-BR') === 'p') {
      event.preventDefault();
      prefixFieldRef.current?.focus();
    }
    if (event.altKey && event.key.toLocaleLowerCase('pt-BR') === 'm') {
      event.preventDefault();
      employeeCodeFieldRef.current?.focus();
    }
  };
  const operationalFleet = useMemo(
    () => equipment.filter(item => item.status !== 'Desmobilizado' && Boolean(item.prefixo?.trim())),
    [equipment],
  );
  const activeEmployees = useMemo(
    () => employees.filter(employee =>
      employee.ativo && !['INATIVO', 'DESMOBILIZADO'].includes(employee.status || '')),
    [employees],
  );
  const relevantOrders = useMemo(
    () => maintenanceOrders.filter(order =>
      order.equipamentoId === form.equipmentId
      && !['Concluída', 'Cancelada'].includes(order.status)),
    [form.equipmentId, maintenanceOrders],
  );
  const selectedEquipment = useMemo(
    () => operationalFleet.find(item => item.id === form.equipmentId),
    [form.equipmentId, operationalFleet],
  );
  const statusDefinition = useMemo(
    () => FLEET_STATUS_DEFINITIONS.find(item => item.value === form.operationalStatus),
    [form.operationalStatus],
  );
  const isMaintenanceFlow = form.operationalStatus === FLEET_OPERATIONAL_STATUS.maintenance
    || form.operationalStatus === FLEET_OPERATIONAL_STATUS.waitingMaintenance;
  const requiresDriver = form.operationalStatus === FLEET_OPERATIONAL_STATUS.operating;
  const requiredChecks = [
    { label: 'Equipamento', ok: Boolean(form.equipmentId && form.prefix) },
    ...(requiresDriver ? [
      { label: 'Motorista', ok: Boolean(form.employeeId || (form.temporaryDriver && form.employeeName.trim())) },
      { label: 'Horário de saída', ok: Boolean(form.departureTime) },
    ] : []),
    ...(isMaintenanceFlow ? [
      { label: 'Entrada na manutenção', ok: Boolean(form.maintenanceEntryTime) },
    ] : []),
  ];
  const readyToSave = requiredChecks.every(item => item.ok);
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(current => ({ ...current, [key]: value }));
  const applyEmployee = (employeeId: string) => {
    const employee = activeEmployees.find(item => item.id === employeeId);
    if (!employee) {
      setForm(current => ({
        ...current,
        employeeId: '',
        employeeCode: '',
        employeeName: '',
        employeeCompany: '',
        teamName: '',
      }));
      return;
    }
    const company = companies.find(item => item.id === employee.empresaId);
    const team = findEmployeeTeam(employee, teams);
    setEmployeeLookupError('');
    setForm(current => ({
      ...current,
      employeeId: employee.id,
      employeeCode: employee.matricula || '',
      employeeName: employee.nome,
      employeeCompany: company?.nome || 'Empresa não localizada',
      teamName: team?.nome || '',
      temporaryDriver: false,
    }));
  };
  const lookupEmployeeCode = () => {
    if (!form.employeeCode.trim()) {
      setEmployeeLookupError('');
      return;
    }
    const driver = lookupDriverByCode(form.employeeCode, activeEmployees, companies, teams);
    if (!driver) {
      setEmployeeLookupError('Motorista não localizado na mini lista operacional. Confira a matrícula ou registre temporariamente.');
      setForm(current => ({
        ...current,
        employeeId: '',
        employeeName: current.temporaryDriver ? current.employeeName : '',
        employeeCompany: '',
        teamName: '',
      }));
      return;
    }
    setEmployeeLookupError('');
    setForm(current => ({
      ...current,
      employeeId: driver.employeeId,
      employeeCode: driver.employeeCode,
      employeeName: driver.employeeName,
      employeeCompany: driver.companyName,
      teamName: driver.teamName || '',
      temporaryDriver: false,
    }));
  };
  const applyEquipment = (equipmentId: string) => {
    const selected = operationalFleet.find(item => item.id === equipmentId);
    if (!selected) {
      setForm(current => ({
        ...current,
        equipmentId: '',
        prefix: '',
        plate: '',
        equipmentCompany: '',
        maintenanceOrderId: '',
      }));
      return;
    }
    const company = companies.find(item => item.id === selected.empresaId);
    const order = maintenanceOrders.find(item =>
      item.equipamentoId === selected.id
      && !['Concluída', 'Cancelada'].includes(item.status));
    setEquipmentLookupError('');
    setForm(current => ({
      ...current,
      equipmentId: selected.id,
      prefix: selected.prefixo,
      plate: selected.placa || selected.seriePlaca || '',
      equipmentCompany: company?.nome || 'Empresa não localizada',
      maintenanceOrderId: order?.id || '',
      maintenanceReason: order?.motivo || order?.descricao || current.maintenanceReason,
    }));
  };
  const lookupPrefix = () => {
    if (!form.prefix.trim()) return;
    const selected = lookupEquipmentByPrefix(form.prefix, operationalFleet, companies);
    if (!selected) {
      setEquipmentLookupError('Frota operacional não localizada pelo prefixo.');
      return;
    }
    setEquipmentLookupError('');
    applyEquipment(selected.equipmentId);
  };
  const validate = (): string[] => {
    const errors: string[] = [];
    if (!form.date) errors.push('Informe a data operacional.');
    if (!form.equipmentId || !form.prefix) errors.push('Selecione uma frota operacional válida.');
    if (
      form.operationalStatus === FLEET_OPERATIONAL_STATUS.operating
      && !form.employeeId
      && !form.temporaryDriver
    ) errors.push('Em operação exige motorista cadastrado ou temporário identificado.');
    if (form.temporaryDriver && !form.employeeName.trim()) {
      errors.push('Informe o nome do motorista temporário.');
    }
    if (
      form.operationalStatus === FLEET_OPERATIONAL_STATUS.maintenance
      && !form.maintenanceEntryTime
    ) errors.push('Informe a entrada na manutenção.');
    if (form.releaseTime && !form.maintenanceEntryTime) {
      errors.push('A liberação exige uma entrada na manutenção.');
    }
    return errors;
  };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const validation = validate();
    if (validation.length) {
      setSubmitError(validation.join(' '));
      return;
    }
    setSubmitError('');
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const key = `${form.date}|${form.equipmentId || normalizePrefix(form.prefix)}`;
      // A lista chega tipada como o registro base, mas o módulo grava o formato
      // estendido — por isso a leitura dos campos extras precisa do tipo certo.
      const existing = record || (records.find(item => item.chave === key) as FleetPersistedRecord | undefined);
      const previousStatus = existing ? normalizeOperationalStatus(existing.status) : undefined;
      const nextLegacyStatus = toLegacyDailyStatus(form.operationalStatus);
      const timelineEvent: EventoControleEquipamentoDiario = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ocorridoEm: now,
        tipo: eventTypeForStatus(previousStatus, form.operationalStatus, form.releaseTime),
        statusAnterior: existing?.status,
        statusNovo: nextLegacyStatus,
        motivo: form.maintenanceReason,
        observacao: form.note,
        ordemServicoId: form.maintenanceOrderId,
        responsavel: registeredBy,
      };
      const selectedEquipment = equipment.find(item => item.id === form.equipmentId);
      const classification = selectedEquipment
        ? classifyOperationalFleet(selectedEquipment)
        : { group: 'Apoio', equipmentType: 'Equipamento operacional' };
      const selectedEmployee = employees.find(item => item.id === form.employeeId);
      const team = findEmployeeTeam(selectedEmployee, teams);
      const saved: FleetPersistedRecord = {
        id: existing?.id || form.id,
        chave: key,
        data: form.date,
        funcionarioId: form.employeeId,
        codigoFuncionario: form.employeeCode,
        nomeMotorista: form.employeeName,
        equipamentoId: form.equipmentId,
        prefixo: form.prefix,
        familia: classification.group,
        tipoEquipamento: classification.equipmentType,
        status: nextLegacyStatus,
        horaSaida: form.departureTime,
        horaEntradaManutencao: form.maintenanceEntryTime,
        horaLiberacao: form.releaseTime,
        disponivelDesde: form.availableSince,
        local: form.location,
        motivoManutencao: form.maintenanceReason,
        ordemServicoId: form.maintenanceOrderId,
        observacao: form.note,
        origem: existing?.origem || 'SISTEMA',
        revisao: form.temporaryDriver ? ['Motorista temporário requer cadastro/vínculo.'] : [],
        aprovacao: existing?.aprovacao || { status: 'PENDENTE', solicitadoEm: now, solicitadoPor: registeredBy },
        eventos: [...(existing?.eventos || []), timelineEvent],
        criadoEm: existing?.criadoEm || now,
        atualizadoEm: now,
        motoristaTemporario: form.temporaryDriver,
        empresaMotoristaId: selectedEmployee?.empresaId,
        equipeId: team?.id,
        frenteServico: team?.frenteServico,
        criadoPor: existing?.criadoPor || registeredBy,
        atualizadoPor: registeredBy,
      };
      await onSave(saved, !existing);
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Não foi possível salvar o lançamento.');
    } finally {
      setSaving(false);
    }
  };
  return createPortal(
    <div className="fixed inset-0 z-[100] bg-white backdrop-blur-[2px]" role="presentation" onKeyDown={handleRootKeyDown}>
      <section role="dialog" aria-modal="true" aria-labelledby="daily-record-title" className="fleet-entry-dialog ml-auto flex h-[100dvh] w-full max-w-[1180px] flex-col overflow-hidden bg-[#f4f7f5] shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700"><Zap size={13}/>Central de lançamento</div>
            <h2 id="daily-record-title" className="mt-1 truncate text-xl font-black tracking-[-0.025em] text-slate-950 sm:text-2xl">{record ? `Editar lançamento · ${record.prefixo}` : 'Registrar situação da frota'}</h2>
            <p className="mt-1 hidden text-xs text-slate-500 sm:block">Motorista, equipamento e situação em um único fluxo. Os dados vinculados são preenchidos automaticamente.</p>
          </div>
          <button type="button" onClick={onClose} className="ml-3 flex size-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 active:scale-95" aria-label="Fechar formulário"><X size={19} /></button>
        </header>

        <form ref={formRef} onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_330px] lg:overflow-hidden">
          <div className="overflow-visible px-4 py-5 sm:px-6 lg:overflow-y-auto lg:px-8">
            <div className="mx-auto max-w-3xl space-y-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_14px_38px_rgba(15,23,42,0.05)] sm:p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div><span className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Etapa 1</span><h3 className="mt-1 text-base font-black text-slate-950">Quem está operando?</h3></div>
                  <span className="hidden rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] font-bold text-slate-500 sm:inline">Alt + M</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <label className="text-xs font-bold text-slate-700">Matrícula / código<div className="relative mt-1"><UserRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input ref={employeeCodeFieldRef} value={form.employeeCode} onChange={event => update('employeeCode', event.target.value)} onBlur={lookupEmployeeCode} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); lookupEmployeeCode(); prefixFieldRef.current?.focus(); } }} placeholder="Ex.: 103206" className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 font-mono text-sm font-bold outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"/></div></label>
                  <label className="text-xs font-bold text-slate-700">Motorista<select value={form.employeeId} onChange={event => applyEmployee(event.target.value)} className="mt-1 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"><option value="">Selecione ou use a matrícula</option>{[...activeEmployees].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).map(employee=><option key={employee.id} value={employee.id}>{employee.matricula ? `${employee.matricula} · ` : ''}{employee.nome}</option>)}</select></label>
                </div>
                {form.employeeId && <div className="mt-3 grid gap-2 rounded-xl bg-emerald-50/70 p-3 text-xs sm:grid-cols-2"><span className="flex items-center gap-2 font-bold text-emerald-900"><Building2 size={14}/>{form.employeeCompany || 'Empresa não informada'}</span><span className="flex items-center gap-2 font-bold text-emerald-900"><UserRound size={14}/>{form.teamName || 'Equipe não vinculada'}</span></div>}
                {!form.employeeId && !form.temporaryDriver && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>Não encontrou?</span>{onOpenDriverRegistry&&<button type="button" onClick={onOpenDriverRegistry} className="font-black text-emerald-700 hover:underline">Abrir mini lista</button>}<button type="button" onClick={()=>{update('temporaryDriver',true);setEmployeeLookupError('')}} className="inline-flex items-center gap-1 font-black text-emerald-700 hover:underline"><UserPlus size={13}/>Adicionar motorista manual</button></div>}
                {form.temporaryDriver && <div className="mt-3 grid gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 sm:grid-cols-2"><label className="text-xs font-bold text-sky-900">Nome do motorista<input value={form.employeeName} onChange={event => update('employeeName', event.target.value.toUpperCase())} placeholder="Nome completo" className="mt-1 h-11 w-full rounded-lg border border-sky-200 bg-white px-3"/></label><p className="self-end text-xs leading-5 text-sky-800">Será marcado para vínculo posterior no cadastro.</p></div>}
                {employeeLookupError && <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900"><AlertCircle size={17} className="mt-0.5 shrink-0"/><span>{employeeLookupError}</span></div>}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_14px_38px_rgba(15,23,42,0.05)] sm:p-5">
                <div className="mb-4 flex items-start justify-between gap-3"><div><span className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Etapa 2</span><h3 className="mt-1 text-base font-black text-slate-950">Qual equipamento?</h3></div><span className="hidden rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] font-bold text-slate-500 sm:inline">Alt + P</span></div>
                <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <label className="text-xs font-bold text-slate-700">Prefixo<div className="relative mt-1"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input ref={prefixFieldRef} value={form.prefix} onChange={event => update('prefix', event.target.value.toUpperCase())} onBlur={lookupPrefix} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); lookupPrefix(); } }} placeholder="Ex.: CB929" className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 font-mono text-base font-black uppercase outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"/></div></label>
                  <label className="text-xs font-bold text-slate-700">Frota / equipamento<select value={form.equipmentId} onChange={event => applyEquipment(event.target.value)} className="mt-1 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"><option value="">Selecione ou use o prefixo</option>{[...operationalFleet].sort((a,b)=>a.prefixo.localeCompare(b.prefixo,'pt-BR',{numeric:true})).map(item=>{const classification=classifyOperationalFleet(item);return <option key={item.id} value={item.id}>{item.prefixo} · {classification.equipmentType}</option>})}</select></label>
                </div>
                {selectedEquipment && <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-slate-50 p-3 text-xs"><span className="font-black text-slate-900">{classifyOperationalFleet(selectedEquipment).equipmentType}</span><span className="text-slate-600">{form.equipmentCompany || 'Empresa não informada'}</span>{form.plate && <span className="font-mono text-slate-600">Placa {form.plate}</span>}</div>}
                {equipmentLookupError && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800"><span>{equipmentLookupError}</span>{onOpenEquipmentRegistry&&<button type="button" onClick={onOpenEquipmentRegistry} className="rounded-lg border border-rose-200 bg-white px-3 py-2">Cadastrar equipamento</button>}</div>}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_14px_38px_rgba(15,23,42,0.05)] sm:p-5">
                <div className="mb-4"><span className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Etapa 3</span><h3 className="mt-1 text-base font-black text-slate-950">Qual é a situação agora?</h3><p className="mt-1 text-xs text-slate-500">Use os botões principais ou escolha uma situação adicional.</p></div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{QUICK_STATUSES.map(({value,label,hint,icon:Icon,active})=><button key={value} type="button" onClick={()=>update('operationalStatus',value)} className={`group flex min-h-[76px] items-start gap-3 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-slate-400 active:translate-y-0 ${form.operationalStatus===value?active:'border-slate-200 bg-white text-slate-700'}`}><span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm"><Icon size={17}/></span><span><strong className="block text-sm">{label}</strong><small className="mt-1 block font-mono text-[9px] opacity-60">{hint}</small></span></button>)}</div>
                <label className="mt-3 block text-xs font-bold text-slate-700">Outras situações<select value={form.operationalStatus} onChange={event => update('operationalStatus', event.target.value as FleetOperationalStatus)} className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold sm:max-w-sm">{FLEET_STATUS_DEFINITIONS.filter(item=>item.value!==FLEET_OPERATIONAL_STATUS.unclassified).map(item=><option key={item.value}>{item.value}</option>)}</select></label>

                <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
                  {requiresDriver && <label className="text-xs font-bold text-slate-700">Horário de saída<div className="mt-1 flex gap-2"><input type="time" value={form.departureTime} onChange={event => update('departureTime', event.target.value)} className="h-12 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 font-mono text-sm font-bold"/><button type="button" onClick={()=>update('departureTime',nowTime())} className="rounded-xl border border-slate-300 bg-slate-50 px-3 text-xs font-black text-slate-700">Agora</button></div></label>}
                  {isMaintenanceFlow && <label className="text-xs font-bold text-slate-700">Entrada na manutenção<div className="mt-1 flex gap-2"><input type="time" value={form.maintenanceEntryTime} onChange={event => update('maintenanceEntryTime', event.target.value)} className="h-12 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 font-mono text-sm font-bold"/><button type="button" onClick={()=>update('maintenanceEntryTime',nowTime())} className="rounded-xl border border-slate-300 bg-slate-50 px-3 text-xs font-black text-slate-700">Agora</button></div></label>}
                  {form.operationalStatus===FLEET_OPERATIONAL_STATUS.available && <label className="text-xs font-bold text-slate-700">À disposição desde<div className="mt-1 flex gap-2"><input type="time" value={form.availableSince} onChange={event => update('availableSince', event.target.value)} className="h-12 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 font-mono text-sm font-bold"/><button type="button" onClick={()=>update('availableSince',nowTime())} className="rounded-xl border border-slate-300 bg-slate-50 px-3 text-xs font-black text-slate-700">Agora</button></div></label>}
                  <label className="text-xs font-bold text-slate-700">Data operacional<input required type="date" value={form.date} onChange={event => update('date', event.target.value)} className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 font-mono text-sm font-bold"/></label>
                  <label className="text-xs font-bold text-slate-700 sm:col-span-2">Local<div className="relative mt-1"><MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input value={form.location} onChange={event => update('location', event.target.value)} placeholder="Pátio Aracaré" className="h-12 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-sm"/></div><span className="mt-2 flex flex-wrap gap-2">{['Pátio Aracaré','Frente de serviço','Manutenção'].map(location=><button key={location} type="button" onClick={()=>update('location',location)} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-800">{location}</button>)}</span></label>
                </div>

                {isMaintenanceFlow && <div className="mt-4 grid gap-3 rounded-xl border border-rose-100 bg-rose-50/60 p-3 sm:grid-cols-2"><label className="text-xs font-bold text-rose-900">OS vinculada<select value={form.maintenanceOrderId} onChange={event=>update('maintenanceOrderId',event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-rose-200 bg-white px-3"><option value="">Sem OS</option>{relevantOrders.map(order=><option key={order.id} value={order.id}>{order.numero} · {order.status}</option>)}</select></label><label className="text-xs font-bold text-rose-900 sm:col-span-2">Ocorrência / motivo<textarea value={form.maintenanceReason} onChange={event => update('maintenanceReason', event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-rose-200 bg-white p-3" placeholder="Quebra, preventiva, pneu, elétrica..."/></label>{onOpenMaintenance&&<button type="button" onClick={onOpenMaintenance} className="justify-self-start text-xs font-black text-rose-800 hover:underline">Abrir área de manutenção</button>}</div>}
                <label className="mt-4 block text-xs font-bold text-slate-700">Observação operacional <span className="font-normal text-slate-400">(opcional)</span><textarea value={form.note} onChange={event => update('note', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" placeholder="Registre somente informações importantes para o próximo turno."/></label>
              </section>
              {submitError && <p role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800"><AlertCircle size={18} className="shrink-0"/>{submitError}</p>}
            </div>
          </div>

          <aside className="flex min-h-fit flex-col border-t border-slate-200 bg-white text-slate-800 lg:min-h-0 lg:border-l lg:border-t-0">
            <div className="flex-1 overflow-y-auto p-5 sm:p-6">
              <div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Conferência antes de salvar</p><span className={`size-2.5 rounded-full ${readyToSave?'bg-emerald-400':'bg-amber-400'}`}/></div>
              <h3 className="mt-5 font-mono text-4xl font-black tracking-[-0.06em] text-slate-800">{form.prefix || '—'}</h3>
              <p className="mt-1 text-sm font-semibold text-slate-700">{selectedEquipment ? classifyOperationalFleet(selectedEquipment).equipmentType : 'Equipamento ainda não selecionado'}</p>
              <div className={`mt-5 inline-flex rounded-lg border px-3 py-2 text-xs font-black ${statusDefinition?.textClass || 'text-slate-800'} ${statusDefinition?.backgroundClass || 'bg-white'} ${statusDefinition?.borderClass || 'border-slate-200'}`}>{form.operationalStatus}</div>
              <dl className="mt-6 divide-y divide-white/10 border-y border-white/10 text-sm"><div className="grid grid-cols-[90px_1fr] gap-3 py-3"><dt className="text-slate-500">Motorista</dt><dd className="text-right font-bold text-slate-700">{form.employeeName || 'Não informado'}</dd></div><div className="grid grid-cols-[90px_1fr] gap-3 py-3"><dt className="text-slate-500">Horário</dt><dd className="text-right font-mono font-bold text-slate-700">{form.departureTime || form.maintenanceEntryTime || form.availableSince || '—'}</dd></div><div className="grid grid-cols-[90px_1fr] gap-3 py-3"><dt className="text-slate-500">Local</dt><dd className="text-right font-bold text-slate-700">{form.location || 'Não informado'}</dd></div><div className="grid grid-cols-[90px_1fr] gap-3 py-3"><dt className="text-slate-500">Data</dt><dd className="text-right font-mono font-bold text-slate-700">{form.date ? new Date(`${form.date}T12:00:00`).toLocaleDateString('pt-BR') : '—'}</dd></div></dl>
              <div className="mt-6"><p className="text-xs font-black text-slate-800">Itens obrigatórios</p><ul className="mt-3 space-y-2">{requiredChecks.map(item=><li key={item.label} className={`flex items-center gap-2 text-xs font-semibold ${item.ok?'text-emerald-700':'text-slate-400'}`}><span className={`flex size-5 items-center justify-center rounded-full ${item.ok?'bg-emerald-400/15':'bg-white/5'}`}>{item.ok?<Check size={12}/>:<span className="size-1.5 rounded-full bg-slate-600"/>}</span>{item.label}</li>)}</ul></div>
            </div>
            <footer className="shrink-0 border-t border-white/10 bg-white p-4 sm:p-5"><button type="submit" disabled={saving} className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-black text-slate-950 transition hover:bg-emerald-400 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"><Save size={17}/>{saving ? 'Salvando lançamento...' : record ? 'Salvar alterações' : 'Confirmar lançamento'}</button><button type="button" disabled={saving} onClick={onClose} className="mt-2 min-h-10 w-full rounded-lg text-xs font-bold text-slate-400 hover:bg-white/5 hover:text-slate-800">Cancelar</button><p className="mt-3 text-center font-mono text-[9px] text-slate-600">Ctrl + Enter salva · Esc fecha</p></footer>
          </aside>
        </form>
      </section>
    </div>,
    document.body,
  );
}
