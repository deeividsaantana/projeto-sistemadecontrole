import type { Abastecimento, AlertaCombustivel, Equipamento, StatusRegistroCombustivel } from '../types';

const normalizeText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLowerCase();

const localIsoDate = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

export const isValidFuelDate = (value: string) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export const normalizeQuickTime = (input: string): { value: string; valid: boolean } => {
  const raw = String(input || '').trim();
  if (!raw) return { value: '', valid: false };

  const colon = raw.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colon) {
    const hour = Number(colon[1]);
    const minute = Number(colon[2]);
    return hour <= 23 && minute <= 59
      ? { value: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, valid: true }
      : { value: raw, valid: false };
  }

  const digits = raw.replace(/\D/g, '');
  if (!digits || digits.length > 4) return { value: raw, valid: false };

  let hour = 0;
  let minute = 0;
  if (digits.length <= 2) {
    hour = Number(digits);
  } else if (digits.length === 3) {
    hour = Number(digits.slice(0, 1));
    minute = Number(digits.slice(1));
  } else {
    hour = Number(digits.slice(0, 2));
    minute = Number(digits.slice(2));
    // Mantém compatibilidade com a macro antiga: 4000 -> 04:00 e 7300 -> 07:30.
    if (hour > 23 && digits.endsWith('0')) {
      hour = Number(digits.slice(0, 1));
      minute = Number(digits.slice(1, 3));
    }
  }

  if (hour > 23 || minute > 59) return { value: raw, valid: false };
  return { value: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, valid: true };
};

export const findEquipmentByPrefix = (value: string, equipamentos: Equipamento[]) => {
  const normalized = normalizeText(value);
  if (!normalized) return undefined;
  const exact = equipamentos.find(item => normalizeText(item.prefixo) === normalized)
    || equipamentos.find(item => normalizeText(item.seriePlaca) === normalized || normalizeText(item.placa || '') === normalized);
  if (exact || normalized.length < 4) return exact;
  const partial = equipamentos.filter(item => {
    const prefix = normalizeText(item.prefixo);
    return prefix.length >= 4 && (prefix.includes(normalized) || normalized.includes(prefix));
  });
  return partial.length === 1 ? partial[0] : undefined;
};

const toTimestamp = (item: Pick<Abastecimento, 'data' | 'hora'>) => `${item.data || ''}T${item.hora || '00:00'}`;

const getPreviousRecord = (
  current: Abastecimento,
  records: Abastecimento[],
  predicate: (item: Abastecimento) => boolean,
) => records
  .filter(item => item.id !== current.id && predicate(item) && toTimestamp(item) < toTimestamp(current))
  .sort((a, b) => toTimestamp(b).localeCompare(toTimestamp(a)))[0];

const addAlert = (
  list: AlertaCombustivel[],
  codigo: string,
  campo: string,
  severidade: AlertaCombustivel['severidade'],
  mensagem: string,
  valorEsperado?: string,
) => {
  const alert: AlertaCombustivel = { codigo, campo, severidade, mensagem };
  if (valorEsperado !== undefined) alert.valorEsperado = valorEsperado;
  list.push(alert);
};

const getQuantityLimit = (equipment?: Equipamento) => {
  const type = normalizeText(`${equipment?.tipo || ''} ${equipment?.nome || ''}`);
  if (/automovel|veiculoleve|pickup|utilitario|van/.test(type)) return 250;
  if (/caminhao|basculante|comboio|cavalomecanico/.test(type)) return 900;
  return 1500;
};

const getKmConsumptionRange = (equipment?: Equipamento) => {
  const type = normalizeText(`${equipment?.tipo || ''} ${equipment?.nome || ''}`);
  return /automovel|veiculoleve|pickup|utilitario|van/.test(type) ? [3, 25] : [0.5, 8];
};

export const validateFueling = (
  current: Abastecimento,
  records: Abastecimento[],
  equipamentos: Equipamento[],
): AlertaCombustivel[] => {
  const alerts: AlertaCombustivel[] = [];
  const equipment = equipamentos.find(item => item.id === current.equipamentoId);
  const quickTime = normalizeQuickTime(current.hora);

  if (!current.data) {
    addAlert(alerts, 'DATA_OBRIGATORIA', 'data', 'critico', 'Data não informada.');
  } else if (!isValidFuelDate(current.data)) {
    addAlert(alerts, 'DATA_INVALIDA', 'data', 'critico', 'Data inválida. Confira o documento original.');
  } else if (current.data > localIsoDate()) {
    addAlert(alerts, 'DATA_FUTURA', 'data', 'aviso', 'A data está no futuro. Confirme antes de gravar.');
  }
  if (!quickTime.valid) addAlert(alerts, 'HORA_INVALIDA', 'hora', 'critico', 'Hora inválida. Use o formato HH:MM.');
  if (!equipment) addAlert(alerts, 'FROTA_NAO_ENCONTRADA', 'equipamentoId', 'critico', 'Prefixo não localizado no cadastro de frota.');
  if (!current.tipoCombustivelId) addAlert(alerts, 'COMBUSTIVEL_OBRIGATORIO', 'tipoCombustivelId', 'critico', 'Tipo de combustível não informado.');
  if (!current.comboioId) addAlert(alerts, 'COMBOIO_OBRIGATORIO', 'comboioId', 'aviso', 'Comboio ou posto abastecedor não informado.');
  if (!current.responsavel?.trim()) addAlert(alerts, 'RESPONSAVEL_OBRIGATORIO', 'responsavel', 'critico', 'Responsável não informado.');

  if (!Number.isFinite(current.quantidadeLitros) || current.quantidadeLitros <= 0) {
    addAlert(alerts, 'QUANTIDADE_INVALIDA', 'quantidadeLitros', 'critico', 'Quantidade de litros deve ser maior que zero.');
  } else {
    const limit = getQuantityLimit(equipment);
    if (current.quantidadeLitros > limit) {
      addAlert(alerts, 'QUANTIDADE_FORA_FAIXA', 'quantidadeLitros', 'aviso', `Volume de ${current.quantidadeLitros.toLocaleString('pt-BR')} L acima da faixa usual para esta família.`, `Até ${limit.toLocaleString('pt-BR')} L`);
    }
  }

  const calculatedFinal = Number(current.bombaInicial || 0) + Number(current.quantidadeLitros || 0);
  if (current.comboioId && current.quantidadeLitros > 0 && current.bombaFinal <= 0) {
    addAlert(alerts, 'LEITURA_BOMBA_AUSENTE', 'bombaFinal', 'aviso', 'Bomba final não informada; a sequência do comboio não poderá ser conferida.');
  } else if (current.bombaFinal > 0 && Math.abs(current.bombaFinal - calculatedFinal) > 0.5) {
    addAlert(alerts, 'BOMBA_DIVERGENTE', 'bombaFinal', 'critico', 'Bomba final não fecha com bomba inicial + litros.', calculatedFinal.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
  }

  const previousEquipment = equipment
    ? getPreviousRecord(current, records, item => item.equipamentoId === current.equipamentoId)
    : undefined;
  if (previousEquipment) {
    if (current.horimetroInicial > 0 && previousEquipment.horimetroInicial > 0 && current.horimetroInicial < previousEquipment.horimetroInicial) {
      addAlert(alerts, 'HORIMETRO_REGREDIU', 'horimetroInicial', 'critico', 'Horímetro menor que a última leitura desta frota.', previousEquipment.horimetroInicial.toLocaleString('pt-BR'));
    } else if (current.horimetroInicial > 0 && previousEquipment.horimetroInicial > 0 && current.horimetroInicial === previousEquipment.horimetroInicial && current.quantidadeLitros > 0) {
      addAlert(alerts, 'HORIMETRO_NAO_AVANCOU', 'horimetroInicial', 'aviso', 'Horímetro repetido mesmo com novo abastecimento. Confirme a leitura.');
    }
    if (current.kmInicial > 0 && previousEquipment.kmInicial > 0 && current.kmInicial < previousEquipment.kmInicial) {
      addAlert(alerts, 'KM_REGREDIU', 'kmInicial', 'critico', 'Quilometragem menor que a última leitura desta frota.', previousEquipment.kmInicial.toLocaleString('pt-BR'));
    } else if (current.kmInicial > 0 && previousEquipment.kmInicial > 0 && current.kmInicial === previousEquipment.kmInicial && current.quantidadeLitros > 0) {
      addAlert(alerts, 'KM_NAO_AVANCOU', 'kmInicial', 'aviso', 'Quilometragem repetida mesmo com novo abastecimento. Confirme a leitura.');
    }

    if (current.horimetroInicial > 0 && previousEquipment.horimetroInicial > 0 && current.quantidadeLitros > 0) {
      const deltaHours = current.horimetroInicial - previousEquipment.horimetroInicial;
      if (deltaHours > 0) {
        const litersPerHour = current.quantidadeLitros / deltaHours;
        if (litersPerHour < 0.5 || litersPerHour > 120) {
          addAlert(alerts, 'CONSUMO_HORA_FORA_PADRAO', 'horimetroInicial', 'aviso', `Consumo calculado de ${litersPerHour.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L/h fora da faixa ampla de conferência.`, '0,5 a 120 L/h');
        }
      }
    } else if (current.kmInicial > 0 && previousEquipment.kmInicial > 0 && current.quantidadeLitros > 0) {
      const deltaKm = current.kmInicial - previousEquipment.kmInicial;
      if (deltaKm > 0) {
        const kmPerLiter = deltaKm / current.quantidadeLitros;
        const [min, max] = getKmConsumptionRange(equipment);
        if (kmPerLiter < min || kmPerLiter > max) {
          addAlert(alerts, 'CONSUMO_KM_FORA_PADRAO', 'kmInicial', 'aviso', `Média calculada de ${kmPerLiter.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km/L fora da faixa da família.`, `${min} a ${max} km/L`);
        }
      }
    }
  }

  if (current.comboioId) {
    const previousPump = getPreviousRecord(current, records, item => item.comboioId === current.comboioId);
    if (previousPump?.bombaFinal > 0 && Math.abs(current.bombaInicial - previousPump.bombaFinal) > 1) {
      addAlert(alerts, 'SEQUENCIA_BOMBA', 'bombaInicial', 'aviso', 'Bomba inicial não continua a última bomba final deste comboio.', previousPump.bombaFinal.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
    }
  }

  const duplicate = records.some(item => item.id !== current.id
    && item.data === current.data
    && item.hora === quickTime.value
    && item.equipamentoId === current.equipamentoId
    && Math.abs(Number(item.quantidadeLitros) - Number(current.quantidadeLitros)) < 0.01
    && item.tipoCombustivelId === current.tipoCombustivelId);
  if (duplicate) addAlert(alerts, 'REGISTRO_DUPLICADO', 'registro', 'critico', 'Já existe um abastecimento com a mesma data, hora, frota, produto e quantidade.');

  if (current.horimetroInicial <= 0 && current.kmInicial <= 0) {
    addAlert(alerts, 'LEITURA_AUSENTE', 'horimetroInicial', 'aviso', 'Horímetro e KM estão vazios; o consumo não poderá ser calculado.');
  } else if (current.horimetroInicial > 0 && current.kmInicial > 0) {
    addAlert(alerts, 'DUAS_LEITURAS_INFORMADAS', 'horimetroInicial', 'info', 'Horímetro e KM foram informados. Confirme qual medidor deve orientar o consumo desta frota.');
  }

  if (current.origem === 'PDF/Foto IA' && Number(current.confiancaExtracao || 0) < 0.75) {
    const reviewed = Boolean(current.camposRevisados?.length);
    addAlert(
      alerts,
      'BAIXA_CONFIANCA_IA',
      'documento',
      reviewed ? 'info' : Number(current.confiancaExtracao || 0) < 0.5 ? 'critico' : 'aviso',
      `Extração automática com ${Math.round(Number(current.confiancaExtracao || 0) * 100)}% de confiança; ${reviewed ? 'linha conferida manualmente.' : 'confira com o documento original.'}`,
    );
  }

  return alerts;
};

export const getFuelStatusFromAlerts = (alerts: AlertaCombustivel[]): StatusRegistroCombustivel => {
  const codes = new Set(alerts.map(item => item.codigo));
  if (codes.has('REGISTRO_DUPLICADO')) return 'Duplicado';
  if (codes.has('BOMBA_DIVERGENTE') || codes.has('LEITURA_BOMBA_AUSENTE')) return 'Verificar bomba';
  if (codes.has('HORIMETRO_REGREDIU') || codes.has('HORIMETRO_NAO_AVANCOU')) return 'Verificar horímetro';
  if (codes.has('KM_REGREDIU') || codes.has('KM_NAO_AVANCOU')) return 'Verificar KM';
  if (codes.has('SEQUENCIA_BOMBA')) return 'Verificar sequência';
  if (codes.has('QUANTIDADE_INVALIDA') || codes.has('QUANTIDADE_FORA_FAIXA')) return 'Verificar quantidade';
  if (codes.has('CONSUMO_HORA_FORA_PADRAO') || codes.has('CONSUMO_KM_FORA_PADRAO')) return 'Consumo fora do padrão';
  if (alerts.some(item => item.severidade === 'critico' || item.severidade === 'aviso')) return 'Conferência necessária';
  return 'OK';
};

export const getFuelQualityScore = (alerts: AlertaCombustivel[]) => Math.max(0, 100 - alerts.reduce((total, item) => (
  total + (item.severidade === 'critico' ? 30 : item.severidade === 'aviso' ? 12 : 4)
), 0));

export const normalizeFuelRecord = (
  record: Abastecimento,
  records: Abastecimento[],
  equipamentos: Equipamento[],
): Abastecimento => {
  const normalizedTime = normalizeQuickTime(record.hora);
  const normalized = { ...record, hora: normalizedTime.valid ? normalizedTime.value : record.hora };
  const alertas = validateFueling(normalized, records, equipamentos);
  return { ...normalized, alertas, status: getFuelStatusFromAlerts(alertas) };
};

export const auditFuelDataset = (records: Abastecimento[], equipamentos: Equipamento[]) => {
  const chronological = [...records].sort((a, b) => toTimestamp(a).localeCompare(toTimestamp(b)) || a.id.localeCompare(b.id));
  const previousEquipment = new Map<string, Abastecimento>();
  const previousPump = new Map<string, Abastecimento>();
  const duplicateKeys = new Map<string, Abastecimento>();
  const audited = new Map<string, Abastecimento>();

  chronological.forEach(record => {
    const normalizedTime = normalizeQuickTime(record.hora);
    const current = { ...record, hora: normalizedTime.valid ? normalizedTime.value : record.hora };
    const duplicateKey = `${current.data}|${current.hora}|${current.equipamentoId}|${current.quantidadeLitros}|${current.tipoCombustivelId}`;
    const context = [
      previousEquipment.get(current.equipamentoId),
      current.comboioId ? previousPump.get(current.comboioId) : undefined,
      duplicateKeys.get(duplicateKey),
    ].filter((item, index, array): item is Abastecimento => Boolean(item) && array.findIndex(other => other?.id === item?.id) === index);
    const alertas = validateFueling(current, context, equipamentos);
    audited.set(current.id, { ...current, alertas, status: getFuelStatusFromAlerts(alertas) });
    previousEquipment.set(current.equipamentoId, current);
    if (current.comboioId) previousPump.set(current.comboioId, current);
    if (!duplicateKeys.has(duplicateKey)) duplicateKeys.set(duplicateKey, current);
  });

  return records.map(record => audited.get(record.id) || record);
};
