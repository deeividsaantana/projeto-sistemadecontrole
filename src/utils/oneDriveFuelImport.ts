import type {
  Abastecimento,
  AlertaCombustivel,
  Comboio,
  Equipamento,
  TipoCombustivel,
} from '../types';
import type { OneDriveFuelRow } from '../oneDriveFuelSync';
import { auditPumpContinuityByConvoy } from './fuelPumpSequence';

const normalize = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLowerCase();

const smallHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export const materializeOneDriveFuelRows = (
  rows: OneDriveFuelRow[],
  equipamentos: Equipamento[],
  comboios: Comboio[],
  combustiveis: TipoCombustivel[],
  existing: Abastecimento[],
  fileName = '',
) => {
  const equipmentByPrefix = new Map(equipamentos.map(item => [normalize(item.prefixo), item]));
  const convoyByKey = new Map(comboios.flatMap(item => [
    [normalize(item.nome), item] as const,
    [normalize(item.placa), item] as const,
  ]));
  const fuelByName = new Map(combustiveis.map(item => [normalize(item.nome), item]));
  const createdFuelTypes = new Map<string, TipoCombustivel>();
  const naturalKeys = new Map<string, string>();
  existing.forEach(item => {
    naturalKeys.set(`${item.data}|${normalize(item.prefixoInformado || equipamentos.find(eq => eq.id === item.equipamentoId)?.prefixo)}|${item.hora}|${Number(item.quantidadeLitros || 0)}|${Number(item.bombaInicial || 0)}`, item.id);
  });
  const now = new Date().toISOString();

  const records = rows.map(row => {
    const alerts: AlertaCombustivel[] = [];
    const equipment = equipmentByPrefix.get(normalize(row.prefixo));
    if (!equipment) {
      alerts.push({ codigo: 'PREFIXO_NAO_CADASTRADO', campo: 'prefixo', severidade: 'aviso', mensagem: `Prefixo "${row.prefixo || 'vazio'}" veio do OneDrive e aguarda cadastro.` });
    }
    const convoy = convoyByKey.get(normalize(row.comboio));
    if (row.comboio && !convoy) {
      alerts.push({ codigo: 'COMBOIO_NAO_CADASTRADO', campo: 'comboio', severidade: 'aviso', mensagem: `Comboio "${row.comboio}" não foi localizado no cadastro.` });
    }
    let fuel = fuelByName.get(normalize(row.tipoCombustivel));
    if (!fuel && row.tipoCombustivel) {
      const key = normalize(row.tipoCombustivel);
      fuel = createdFuelTypes.get(key) || { id: `fuel-onedrive-${smallHash(key)}`, nome: row.tipoCombustivel.trim() };
      createdFuelTypes.set(key, fuel);
      fuelByName.set(key, fuel);
    }
    if (!validDate(row.data)) alerts.push({ codigo: 'DATA_INVALIDA', campo: 'data', severidade: 'critico', mensagem: 'Data ausente ou inválida na planilha.' });
    if (!Number.isFinite(Number(row.quantidadeLitros)) || Number(row.quantidadeLitros) <= 0) {
      alerts.push({ codigo: 'QUANTIDADE_INVALIDA', campo: 'quantidadeLitros', severidade: 'critico', mensagem: `Quantidade inválida na planilha: ${row.quantidadeOriginal || 'vazio'}.` });
    }
    if (row.avisos) alerts.push({ codigo: 'AVISO_PLANILHA', campo: 'linha', severidade: 'aviso', mensagem: row.avisos });

    const data = String(row.data || '');
    const hora = validTime(row.hora) ? row.hora : String(row.hora || '');
    const naturalKey = `${data}|${normalize(row.prefixo)}|${hora}|${Number(row.quantidadeLitros || 0)}|${Number(row.bombaInicial || 0)}`;
    const duplicateId = naturalKeys.get(naturalKey);
    if (duplicateId && duplicateId !== row.sourceRowId) {
      alerts.push({ codigo: 'POSSIVEL_DUPLICIDADE', campo: 'registro', severidade: 'aviso', mensagem: 'Existe outro lançamento com a mesma data, prefixo, hora, litros e bomba inicial.' });
    }
    naturalKeys.set(naturalKey, row.sourceRowId);
    const existingRecord = existing.find(item => item.id === row.sourceRowId);
    const notes = [
      row.observacao,
      row.descricaoEquipamento && `Equipamento na planilha: ${row.descricaoEquipamento}`,
      row.empresa && `Empresa na planilha: ${row.empresa}`,
    ].filter(Boolean).join(' | ');

    return {
      id: row.sourceRowId,
      data,
      hora,
      equipamentoId: equipment?.id || '',
      prefixoInformado: row.prefixo,
      horimetroInicial: Number(row.horimetroInicial || 0),
      kmInicial: Number(row.kmInicial || 0),
      bombaInicial: Number(row.bombaInicial || 0),
      quantidadeLitros: Number(row.quantidadeLitros || 0),
      bombaFinal: Number(row.bombaFinal || 0),
      tipoCombustivelId: fuel?.id || '',
      comboioId: convoy?.id || '',
      responsavel: row.responsavel || 'Sincronização OneDrive',
      observacao: notes,
      status: alerts.some(alert => alert.severidade === 'critico')
        ? 'Erro de importação'
        : duplicateId && duplicateId !== row.sourceRowId ? 'Duplicado' : alerts.length ? 'Conferência necessária' : 'OK',
      origem: 'OneDrive',
      alertas: alerts,
      documentoOrigemNome: fileName,
      integracaoOrigemId: row.sourceRowId,
      integracaoAba: row.sheet,
      integracaoLinha: row.rowNumber,
      criadoEm: existingRecord?.criadoEm || now,
      atualizadoEm: now,
    } satisfies Abastecimento;
  });

  const incomingIds = new Set(records.map(record => record.id));
  const continuityIssues = new Map(
    auditPumpContinuityByConvoy([
      ...existing.filter(record => !incomingIds.has(record.id)),
      ...records,
    ]).map(issue => [issue.recordId, issue] as const),
  );
  const reviewedRecords = records.map(record => {
    const issue = continuityIssues.get(record.id);
    if (!issue) return record;
    const alert: AlertaCombustivel = {
      codigo: 'SEQUENCIA_BOMBA',
      campo: 'bombaInicial',
      severidade: 'aviso',
      mensagem: 'A bomba inicial difere da última bomba final deste mesmo comboio. O registro foi mantido porque pode ser retroativo, reinício de medidor ou leitura informada na planilha.',
      valorEsperado: issue.expectedStart.toLocaleString('pt-BR', { maximumFractionDigits: 2 }),
    };
    return {
      ...record,
      alertas: [...(record.alertas || []).filter(item => item.codigo !== 'SEQUENCIA_BOMBA'), alert],
      status: record.status === 'OK' ? 'Verificar sequência' as const : record.status,
    };
  });

  return { records: reviewedRecords, fuelTypes: Array.from(createdFuelTypes.values()) };
};
