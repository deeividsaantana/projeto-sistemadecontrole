import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
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
import { ConfirmDialog, Modal } from '../../shared/ui';
import { lancamentoDoDia, operadorEmOutroEquipamento } from '../../fleet/duplicidadeDiaria';
import { BOTAO_SECUNDARIO, CAMPO } from '../cadastros/estilos';
import { Campo, Conferencia, Conferido, Etapa } from '../../shared/ui/Lancamento';

interface Props {
  record?: FleetPersistedRecord;
  /** Lançamento novo já com dia, prefixo ou matrícula (vindo da conferência do dia). */
  preset?: Partial<Pick<ControleEquipamentoDiario, 'data' | 'prefixo' | 'codigoFuncionario'>>;
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
  preset,
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
  const initialSnapshot = useRef<FormState | null>(null);
  const [form, setForm] = useState<FormState>(() => {
    const initial = initialForm(record || (preset as FleetPersistedRecord | undefined), equipment, employees, companies, teams);
    initialSnapshot.current = initial;
    return initial;
  });
  const [employeeLookupError, setEmployeeLookupError] = useState('');
  const [equipmentLookupError, setEquipmentLookupError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmarFecharSemSalvar, setConfirmarFecharSemSalvar] = useState(false);
  const [confirmouOperador, setConfirmouOperador] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const employeeCodeFieldRef = useRef<HTMLInputElement>(null);
  const prefixFieldRef = useRef<HTMLInputElement>(null);

  const temAlteracaoNaoSalva = JSON.stringify(form) !== JSON.stringify(initialSnapshot.current);

  // Fechar (X, Esc ou clique fora, todos vindos do Modal padrão) com algo
  // digitado e não salvo pede confirmação, pra não perder o lançamento à toa.
  const pedirFechar = () => {
    if (saving) return;
    if (temAlteracaoNaoSalva) {
      setConfirmarFecharSemSalvar(true);
      return;
    }
    onClose();
  };

  // Atalhos próprios da tela (mesmo padrão do painel do Quadro): Ctrl/Cmd+Enter
  // salva e Alt+1..4/P/M pulam direto pra situação ou campo certo. Escape e o
  // travamento de foco já vêm de graça do Modal compartilhado.
  useEffect(() => {
    const teclar = (event: KeyboardEvent) => {
      if (event.isComposing) return;
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
    document.addEventListener('keydown', teclar);
    return () => document.removeEventListener('keydown', teclar);
  });
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
  // Trava de lançamento repetido: um lançamento por equipamento por dia, e
  // aviso quando o mesmo operador já está em outro equipamento no dia.
  const lancamentoExistente = useMemo(
    () => (form.equipmentId || form.prefix.trim())
      ? lancamentoDoDia(records, { id: record?.id || form.id, data: form.date, equipamentoId: form.equipmentId, prefixo: form.prefix })
      : undefined,
    [form.date, form.equipmentId, form.id, form.prefix, record?.id, records],
  );
  const operadorOcupado = useMemo(
    () => operadorEmOutroEquipamento(records, {
      id: record?.id || form.id,
      data: form.date,
      equipamentoId: form.equipmentId,
      prefixo: form.prefix,
      codigoFuncionario: form.employeeCode,
      nomeMotorista: form.employeeName,
    }).filter(item => item.id !== lancamentoExistente?.id),
    [form.date, form.employeeCode, form.employeeName, form.equipmentId, form.id, form.prefix, lancamentoExistente?.id, record?.id, records],
  );
  useEffect(() => setConfirmouOperador(false), [form.employeeCode, form.employeeName, form.date]);
  const readyToSave = requiredChecks.every(item => item.ok);
  const horarioOk = requiredChecks.filter(item => item.label === 'Horário de saída' || item.label === 'Entrada na manutenção').every(item => item.ok);
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
    if (record && lancamentoExistente) {
      errors.push(`${form.prefix} já tem outro lançamento nesse dia. Troque o equipamento ou a data, ou edite o outro lançamento.`);
    }
    if (operadorOcupado.length && !confirmouOperador) {
      errors.push(`${form.employeeName || 'Este operador'} já está lançado nesse dia no ${operadorOcupado.map(item => item.prefixo).join(' e ')}. Confirme a troca de caminhão para salvar.`);
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
      // A lista chega tipada como o registro base, mas o módulo grava o formato
      // estendido — por isso a leitura dos campos extras precisa do tipo certo.
      const existing = record || (lancamentoExistente as FleetPersistedRecord | undefined);
      const key = existing?.chave || `${form.date}|${form.equipmentId || normalizePrefix(form.prefix)}`;
      const previousStatus = existing ? normalizeOperationalStatus(existing.status) : undefined;
      const nextLegacyStatus = toLegacyDailyStatus(form.operationalStatus);
      const tipoEvento = eventTypeForStatus(previousStatus, form.operationalStatus, form.releaseTime);
      const timelineEvent: EventoControleEquipamentoDiario = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ocorridoEm: now,
        hora: tipoEvento === 'ENTRADA_MANUTENCAO' ? form.maintenanceEntryTime : tipoEvento === 'LIBERACAO_MANUTENCAO' ? form.releaseTime : undefined,
        tipo: tipoEvento,
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
  return (
    <>
      <Modal
        open
        onClose={pedirFechar}
        busy={saving}
        size="xl"
        telaCheia="frota-lancamento"
        telaCheiaPadrao
        initialFocusRef={preset?.codigoFuncionario && !preset.prefixo ? prefixFieldRef : employeeCodeFieldRef}
        title={record ? `Editar lançamento · ${record.prefixo}` : 'Registrar situação da frota'}
        description="Quem opera, qual equipamento e a situação. O resto vem do cadastro."
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center">
            <button type="button" disabled={saving} onClick={() => formRef.current?.requestSubmit()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#176b4d] px-6 text-sm font-bold text-white transition hover:bg-[#125a40] active:scale-[0.99] disabled:cursor-wait disabled:opacity-60 sm:min-h-11 sm:w-auto"><Save size={17}/>{saving ? 'Salvando lançamento...' : record ? 'Salvar alterações' : 'Confirmar lançamento'}</button>
            <button type="button" disabled={saving} onClick={pedirFechar} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 sm:w-auto">Cancelar</button>
          </div>
        )}
      >
        <form ref={formRef} onSubmit={handleSubmit} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="grid min-w-0 gap-4">
            <Etapa numero={1} titulo="Quem está operando?" ajuda="Digite a matrícula ou escolha na lista." feita={Boolean(form.employeeId || (form.temporaryDriver && form.employeeName.trim()))}>
              <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                <Campo rotulo="Matrícula" para="frota-matricula">
                  <span className="relative block"><UserRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} aria-hidden="true"/><input id="frota-matricula" ref={employeeCodeFieldRef} value={form.employeeCode} onChange={event => update('employeeCode', event.target.value)} onBlur={lookupEmployeeCode} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); lookupEmployeeCode(); prefixFieldRef.current?.focus(); } }} placeholder="Ex.: 103206" className={`${CAMPO} pl-10 pr-3 tabular-nums`}/></span>
                </Campo>
                <Campo rotulo="Motorista" para="frota-motorista">
                  <select id="frota-motorista" value={form.employeeId} onChange={event => applyEmployee(event.target.value)} className={CAMPO}><option value="">Escolha ou use a matrícula</option>{[...activeEmployees].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).map(employee=><option key={employee.id} value={employee.id}>{employee.matricula ? `${employee.matricula} · ` : ''}{employee.nome}</option>)}</select>
                </Campo>
              </div>
              {form.employeeId && <p className="mt-3 text-sm text-slate-600">{form.employeeCompany || 'Empresa não informada'} · {form.teamName || 'sem equipe'}</p>}
              {!form.employeeId && !form.temporaryDriver && <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600"><span>Não achou?</span>{onOpenDriverRegistry&&<button type="button" onClick={onOpenDriverRegistry} className="min-h-11 font-bold text-[#176b4d] hover:underline">Ver a lista de motoristas</button>}<button type="button" onClick={()=>{update('temporaryDriver',true);setEmployeeLookupError('')}} className="inline-flex min-h-11 items-center gap-1 font-bold text-[#176b4d] hover:underline"><UserPlus size={15} aria-hidden="true"/>Digitar o nome</button></div>}
              {form.temporaryDriver && <div className="mt-3"><Campo rotulo="Nome do motorista" para="frota-motorista-nome" dica="Fica marcado para ligar ao cadastro depois."><input id="frota-motorista-nome" value={form.employeeName} onChange={event => update('employeeName', event.target.value.toUpperCase())} placeholder="Nome completo" className={CAMPO}/></Campo></div>}
              {employeeLookupError && <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900"><AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true"/><span>{employeeLookupError}</span></p>}
              {operadorOcupado.length > 0 && (
                <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900 ring-1 ring-inset ring-amber-200" data-testid="frota-operador-ocupado">
                  <p className="flex gap-2"><AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true"/><span>{form.employeeName || 'Este operador'} já está lançado nesse dia no {operadorOcupado.map(item => `${item.prefixo}${item.horaSaida ? ` (saída ${item.horaSaida})` : ''}`).join(' e ')}.</span></p>
                  <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-white px-3 font-bold ring-1 ring-inset ring-amber-200"><input type="checkbox" checked={confirmouOperador} onChange={event => setConfirmouOperador(event.target.checked)} className="size-4 accent-[#176b4d]"/>Ele trocou de caminhão, lançar mesmo assim</label>
                </div>
              )}
            </Etapa>

            <Etapa numero={2} titulo="Qual equipamento?" ajuda="Digite o prefixo; o resto vem do cadastro." feita={Boolean(form.equipmentId && form.prefix)}>
              <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                <Campo rotulo="Prefixo" para="frota-prefixo">
                  <span className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} aria-hidden="true"/><input id="frota-prefixo" ref={prefixFieldRef} value={form.prefix} onChange={event => update('prefix', event.target.value.toUpperCase())} onBlur={lookupPrefix} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); lookupPrefix(); } }} placeholder="Ex.: CB929" className={`${CAMPO} pl-10 pr-3 uppercase tabular-nums`}/></span>
                </Campo>
                <Campo rotulo="Equipamento" para="frota-equipamento">
                  <select id="frota-equipamento" value={form.equipmentId} onChange={event => applyEquipment(event.target.value)} className={CAMPO}><option value="">Escolha ou use o prefixo</option>{[...operationalFleet].sort((a,b)=>a.prefixo.localeCompare(b.prefixo,'pt-BR',{numeric:true})).map(item=>{const classification=classifyOperationalFleet(item);return <option key={item.id} value={item.id}>{item.prefixo} · {classification.equipmentType}</option>})}</select>
                </Campo>
              </div>
              {selectedEquipment && <p className="mt-3 text-sm text-slate-600">{classifyOperationalFleet(selectedEquipment).equipmentType} · {form.equipmentCompany || 'Empresa não informada'}{form.plate ? ` · placa ${form.plate}` : ''}</p>}
              {equipmentLookupError && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-bold text-rose-800"><span>{equipmentLookupError}</span>{onOpenEquipmentRegistry&&<button type="button" onClick={onOpenEquipmentRegistry} className="min-h-11 rounded-lg bg-white px-3 ring-1 ring-inset ring-rose-200">Cadastrar equipamento</button>}</div>}
              {lancamentoExistente && (
                <p className={`mt-3 flex gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${record ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-900'}`} data-testid="frota-lancamento-existente">
                  <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true"/>
                  <span>
                    <strong>{lancamentoExistente.prefixo} já foi lançado em {form.date.split('-').reverse().join('/')}</strong>: {lancamentoExistente.status}{lancamentoExistente.horaSaida ? `, saída ${lancamentoExistente.horaSaida}` : ''}{lancamentoExistente.nomeMotorista ? `, ${lancamentoExistente.nomeMotorista}` : ''}.{' '}
                    {record ? 'Não dá para ter dois lançamentos do mesmo equipamento no dia: troque o equipamento ou a data.' : 'Salvar atualiza esse lançamento; não entra um segundo.'}
                  </span>
                </p>
              )}
            </Etapa>

            <Etapa numero={3} titulo="Qual é a situação agora?" ajuda="Toque numa das quatro; as outras ficam na lista abaixo." feita={readyToSave}>
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">{QUICK_STATUSES.map(({value,label,icon:Icon,active})=><button key={value} type="button" aria-pressed={form.operationalStatus===value} onClick={()=>update('operationalStatus',value)} className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left text-sm font-bold transition ${form.operationalStatus===value?active:'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}><Icon size={17} aria-hidden="true"/>{label}</button>)}</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
                <Campo rotulo="Outras situações" para="frota-situacao">
                  <select id="frota-situacao" value={form.operationalStatus} onChange={event => update('operationalStatus', event.target.value as FleetOperationalStatus)} className={CAMPO}>{FLEET_STATUS_DEFINITIONS.filter(item=>item.value!==FLEET_OPERATIONAL_STATUS.unclassified).map(item=><option key={item.value}>{item.value}</option>)}</select>
                </Campo>
                <Campo rotulo="Dia" para="frota-dia">
                  <input id="frota-dia" required type="date" value={form.date} onChange={event => update('date', event.target.value)} className={`${CAMPO} tabular-nums`}/>
                </Campo>
                {requiresDriver && <Campo rotulo="Saída" para="frota-saida"><span className="flex gap-2"><input id="frota-saida" type="time" value={form.departureTime} onChange={event => update('departureTime', event.target.value)} className={`${CAMPO} min-w-0 flex-1 tabular-nums`}/><button type="button" onClick={()=>update('departureTime',nowTime())} className={BOTAO_SECUNDARIO}>Agora</button></span></Campo>}
                {isMaintenanceFlow && <Campo rotulo="Entrada na manutenção" para="frota-entrada"><span className="flex gap-2"><input id="frota-entrada" type="time" value={form.maintenanceEntryTime} onChange={event => update('maintenanceEntryTime', event.target.value)} className={`${CAMPO} min-w-0 flex-1 tabular-nums`}/><button type="button" onClick={()=>update('maintenanceEntryTime',nowTime())} className={BOTAO_SECUNDARIO}>Agora</button></span></Campo>}
                {form.operationalStatus===FLEET_OPERATIONAL_STATUS.available && <Campo rotulo="À disposição desde" para="frota-disposicao"><span className="flex gap-2"><input id="frota-disposicao" type="time" value={form.availableSince} onChange={event => update('availableSince', event.target.value)} className={`${CAMPO} min-w-0 flex-1 tabular-nums`}/><button type="button" onClick={()=>update('availableSince',nowTime())} className={BOTAO_SECUNDARIO}>Agora</button></span></Campo>}
              </div>
              {isMaintenanceFlow && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
                  <Campo rotulo="OS vinculada" para="frota-os"><select id="frota-os" value={form.maintenanceOrderId} onChange={event=>update('maintenanceOrderId',event.target.value)} className={CAMPO}><option value="">Sem OS</option>{relevantOrders.map(order=><option key={order.id} value={order.id}>{order.numero} · {order.status}</option>)}</select></Campo>
                  <Campo rotulo="Motivo" para="frota-motivo" className="sm:col-span-2"><textarea id="frota-motivo" value={form.maintenanceReason} onChange={event => update('maintenanceReason', event.target.value)} rows={2} className={`${CAMPO} p-3`} placeholder="Quebra, preventiva, pneu, elétrica..."/></Campo>
                </div>
              )}
              <details className="mt-4 rounded-xl border border-slate-200 px-4 py-2">
                <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-slate-700">Mais detalhes (local e observação)</summary>
                <div className="grid gap-4 pb-3 pt-2 sm:grid-cols-2">
                  <Campo rotulo="Local" para="frota-local"><span className="relative block"><MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} aria-hidden="true"/><input id="frota-local" value={form.location} onChange={event => update('location', event.target.value)} placeholder="Pátio, frente de serviço..." className={`${CAMPO} pl-10 pr-3`}/></span></Campo>
                  <Campo rotulo="Observação" para="frota-obs"><input id="frota-obs" value={form.note} onChange={event => update('note', event.target.value)} className={CAMPO} placeholder="Só o que o próximo turno precisa saber"/></Campo>
                </div>
              </details>
              {onOpenMaintenance && isMaintenanceFlow && <button type="button" onClick={onOpenMaintenance} className="mt-3 min-h-11 text-sm font-bold text-[#176b4d] hover:underline">Abrir a Manutenção</button>}
            </Etapa>
          </div>

          <Conferencia subtitulo="Ctrl + Enter salva · Esc fecha">
            <dl className="divide-y divide-slate-100">
              <Conferido rotulo="Equipamento" ok={Boolean(form.equipmentId && form.prefix)} valor={form.prefix || 'falta'} />
              <Conferido rotulo="Situação" ok valor={form.operationalStatus} />
              <Conferido rotulo="Motorista" ok={!requiresDriver || Boolean(form.employeeId || (form.temporaryDriver && form.employeeName.trim()))} valor={form.employeeName || (requiresDriver ? 'falta' : '—')} />
              <Conferido rotulo="Horário" ok={horarioOk} valor={form.departureTime || form.maintenanceEntryTime || form.availableSince || '—'} />
              <Conferido rotulo="Dia" ok={Boolean(form.date)} valor={form.date ? new Date(`${form.date}T12:00:00`).toLocaleDateString('pt-BR') : 'falta'} />
            </dl>
            {submitError
              ? <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-bold text-rose-700"><AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true"/>{submitError}</p>
              : <p role="status" className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm font-bold ${readyToSave ? 'bg-emerald-50 text-[#176b4d]' : 'bg-[#f7f8f6] text-slate-600'}`}>{readyToSave ? <Check size={16} className="mt-0.5 shrink-0" aria-hidden="true"/> : <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true"/>}{readyToSave ? 'Pronto para salvar.' : `Falta: ${requiredChecks.filter(item => !item.ok).map(item => item.label.toLowerCase()).join(', ')}.`}</p>}
          </Conferencia>
        </form>
      </Modal>
      <ConfirmDialog
        open={confirmarFecharSemSalvar}
        tone="warning"
        title="Fechar sem salvar?"
        description="O que você preencheu neste lançamento ainda não foi salvo. Se fechar agora, esse preenchimento se perde."
        confirmLabel="Fechar sem salvar"
        cancelLabel="Continuar preenchendo"
        onConfirm={() => { setConfirmarFecharSemSalvar(false); onClose(); }}
        onCancel={() => setConfirmarFecharSemSalvar(false)}
      />
    </>
  );
}
