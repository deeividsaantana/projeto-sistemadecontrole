import React, { useMemo, useState } from 'react';
import { AlertCircle, Save, UserPlus, X } from 'lucide-react';
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
import { classifyOperationalFleet, findEmployeeTeam, isOperationalFleet, lookupDriverByCode, lookupEquipmentByPrefix } from '../../fleet/reconciliation';
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
  onSave: (record: ControleEquipamentoDiario, isNew: boolean) => void | Promise<void>;
  onClose: () => void;
  onOpenEmployeeRegistration: () => void;
  onOpenDriverRegistry?: () => void;
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

export default function DailyRecordForm({
  record,
  records,
  equipment,
  employees,
  companies,
  teams,
  maintenanceOrders,
  onSave,
  onClose,
  onOpenDriverRegistry,
  onOpenMaintenance,
}: Props) {
  const [form, setForm] = useState<FormState>(
    () => initialForm(record, equipment, employees, companies, teams),
  );
  const [employeeLookupError, setEmployeeLookupError] = useState('');
  const [equipmentLookupError, setEquipmentLookupError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);
  const operationalFleet = useMemo(
    () => equipment.filter(item => isOperationalFleet(item) && item.status !== 'Desmobilizado'),
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
      const existing = record || records.find(item => item.chave === key);
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
        eventos: [...(existing?.eventos || []), timelineEvent],
        criadoEm: existing?.criadoEm || now,
        atualizadoEm: now,
        motoristaTemporario: form.temporaryDriver,
        empresaMotoristaId: selectedEmployee?.empresaId,
        equipeId: team?.id,
      };
      await onSave(saved, !existing);
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Não foi possível salvar o lançamento.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="daily-record-title" className="max-h-[100dvh] w-full overflow-y-auto bg-white sm:max-h-[94vh] sm:max-w-5xl sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">Controle operacional</p>
            <h2 id="daily-record-title" className="text-lg font-black text-slate-950">{record ? `Editar ${record.prefixo}` : 'Novo lançamento de frota'}</h2>
          </div>
          <button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-md border border-slate-200 text-slate-600" aria-label="Fechar formulário"><X size={18} /></button>
        </header>
        <form onSubmit={handleSubmit} className="space-y-5 p-4">
          <fieldset className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <legend className="px-2 text-[10px] font-black uppercase tracking-wider text-slate-600">Identificação operacional</legend>
            <label className="text-xs font-bold text-slate-700">Data<input required type="date" value={form.date} onChange={event => update('date', event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"/></label>
            <label className="text-xs font-bold text-slate-700">Matrícula / código<div className="mt-1 flex"><input value={form.employeeCode} onChange={event => update('employeeCode', event.target.value)} onBlur={lookupEmployeeCode} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); lookupEmployeeCode(); } }} placeholder="103177" className="h-10 min-w-0 flex-1 rounded-l-md border border-slate-300 px-3"/><button type="button" onClick={lookupEmployeeCode} className="rounded-r-md border border-l-0 border-slate-300 bg-slate-50 px-3 text-xs font-black">Buscar</button></div></label>
            <label className="text-xs font-bold text-slate-700">Motorista<select value={form.employeeId} onChange={event => applyEmployee(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2"><option value="">Selecione / informe manualmente</option>{activeEmployees.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).map(employee=><option key={employee.id} value={employee.id}>{employee.matricula ? `${employee.matricula} · ` : ''}{employee.nome}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-700">Nome apresentado<input value={form.employeeName} disabled={Boolean(form.employeeId)} onChange={event => update('employeeName', event.target.value)} placeholder="Nome do motorista" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 disabled:bg-slate-100"/></label>
            {!form.employeeId && !form.temporaryDriver && <button type="button" onClick={()=>{update('temporaryDriver',true);setEmployeeLookupError('')}} className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 text-xs font-black text-emerald-800"><UserPlus size={14}/>Adicionar motorista manual</button>}
            {form.temporaryDriver && <p className="self-end rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800">Preencha matrícula e nome. O motorista ficará registrado neste lançamento.</p>}
            {employeeLookupError && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 sm:col-span-2 lg:col-span-4"><div className="flex gap-2 text-xs text-amber-900"><AlertCircle size={16} className="shrink-0"/><span>{employeeLookupError}</span></div><div className="mt-2 flex flex-wrap gap-2">{onOpenDriverRegistry&&<button type="button" onClick={onOpenDriverRegistry} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-amber-300 bg-white px-3 text-xs font-black text-amber-800"><UserPlus size={14}/>Abrir mini lista</button>}<button type="button" onClick={()=>{update('temporaryDriver',true);setEmployeeLookupError('')}} className="min-h-9 rounded-md bg-amber-700 px-3 text-xs font-black text-white">Registrar temporariamente</button><button type="button" onClick={()=>{setEmployeeLookupError('');update('employeeCode','');update('employeeName','')}} className="min-h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-black">Cancelar</button></div></div>}
            <label className="text-xs font-bold text-slate-700">Empresa do motorista<input value={form.employeeCompany} readOnly placeholder="Preenchida pelo cadastro" className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-slate-100 px-3"/></label>
            <label className="text-xs font-bold text-slate-700">Equipe<input value={form.teamName} readOnly placeholder="Preenchida pelo vínculo" className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-slate-100 px-3"/></label>
            <label className="text-xs font-bold text-slate-700">Prefixo<div className="mt-1 flex"><input value={form.prefix} onChange={event => update('prefix', event.target.value.toUpperCase())} onBlur={lookupPrefix} placeholder="CB770" className="h-10 min-w-0 flex-1 rounded-l-md border border-slate-300 px-3 font-black"/><button type="button" onClick={lookupPrefix} className="rounded-r-md border border-l-0 border-slate-300 bg-slate-50 px-3 text-xs font-black">Buscar</button></div></label>
            <label className="text-xs font-bold text-slate-700">Frota / equipamento<select value={form.equipmentId} onChange={event => applyEquipment(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2"><option value="">Selecione</option>{operationalFleet.sort((a,b)=>a.prefixo.localeCompare(b.prefixo,'pt-BR',{numeric:true})).map(item=>{const classification=classifyOperationalFleet(item);return <option key={item.id} value={item.id}>{item.prefixo} · {classification.equipmentType}</option>})}</select></label>
            {equipmentLookupError && <p className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs font-bold text-rose-700 sm:col-span-2 lg:col-span-4">{equipmentLookupError}</p>}
            <label className="text-xs font-bold text-slate-700">Empresa do equipamento<input value={form.equipmentCompany} readOnly className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-slate-100 px-3"/></label>
          </fieldset>
          <fieldset className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <legend className="px-2 text-[10px] font-black uppercase tracking-wider text-slate-600">Situação e horários</legend>
            <label className="text-xs font-bold text-slate-700">Status operacional<select value={form.operationalStatus} onChange={event => update('operationalStatus', event.target.value as FleetOperationalStatus)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2">{FLEET_STATUS_DEFINITIONS.filter(item=>item.value!==FLEET_OPERATIONAL_STATUS.unclassified).map(item=><option key={item.value}>{item.value}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-700">Saída / Aracaré<input type="time" value={form.departureTime} onChange={event => update('departureTime', event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"/></label>
            <label className="text-xs font-bold text-slate-700">Entrada manutenção<input type="time" value={form.maintenanceEntryTime} onChange={event => update('maintenanceEntryTime', event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"/></label>
            <label className="text-xs font-bold text-slate-700">Liberação<input type="time" value={form.releaseTime} onChange={event => update('releaseTime', event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"/></label>
            <label className="text-xs font-bold text-slate-700">À disposição desde<input type="time" value={form.availableSince} onChange={event => update('availableSince', event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"/></label>
            <label className="text-xs font-bold text-slate-700">Local de saída<input value={form.location} onChange={event => update('location', event.target.value)} placeholder="Pátio Aracaré" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"/></label>
            <label className="text-xs font-bold text-slate-700">OS vinculada<select value={form.maintenanceOrderId} onChange={event=>update('maintenanceOrderId',event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2"><option value="">Sem OS</option>{relevantOrders.map(order=><option key={order.id} value={order.id}>{order.numero} · {order.status}</option>)}</select></label>
            {onOpenMaintenance && <button type="button" onClick={onOpenMaintenance} className="mt-auto h-10 rounded-md border border-emerald-300 bg-white px-3 text-xs font-black text-emerald-700">Abrir área de manutenção</button>}
            <label className="text-xs font-bold text-slate-700 sm:col-span-2">Ocorrência / motivo<textarea value={form.maintenanceReason} onChange={event => update('maintenanceReason', event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 p-3" placeholder="Quebra, preventiva, pneu, elétrica..."/></label>
            <label className="text-xs font-bold text-slate-700 sm:col-span-2">Observação operacional<textarea value={form.note} onChange={event => update('note', event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 p-3" placeholder="Liberado às 08:54; voltou à operação..."/></label>
          </fieldset>
          {submitError && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{submitError}</p>}
          <footer className="sticky bottom-0 -mx-4 -mb-4 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white p-4 sm:flex-row sm:justify-end"><button type="button" disabled={saving} onClick={onClose} className="min-h-11 rounded-md border border-slate-300 bg-white px-5 text-sm font-black text-slate-700">Cancelar</button><button type="submit" disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60"><Save size={16}/>{saving ? 'Salvando...' : 'Salvar e registrar histórico'}</button></footer>
        </form>
      </section>
    </div>
  );
}
