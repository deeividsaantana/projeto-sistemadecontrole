import type { Funcionario, GrupoEquipe, PresencaApontamento } from '../types';
import { EFETIVO_OBRA_3_LEADERS } from '../data/efetivoObra3Reference';

const TEXT_KEYS = ['nome', 'name', 'label', 'descricao', 'grupoNome', 'value', 'text'] as const;

export const readableTeamText = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') {
    const text = value.trim();
    return text && text !== '[object Object]' ? text : fallback;
  }
  if (value && typeof value === 'object') {
    const item = value as Record<string, unknown>;
    for (const key of TEXT_KEYS) {
      const text = readableTeamText(item[key]);
      if (text) return text;
    }
  }
  return fallback;
};

const latestRecordByGroup = (records: PresencaApontamento[]) => {
  const latest = new Map<string, PresencaApontamento>();
  records.forEach(record => {
    const groupId = readableTeamText(record?.grupoId);
    if (!groupId) return;
    const current = latest.get(groupId);
    const stamp = `${readableTeamText(record.data)} ${readableTeamText(record.horaEnvio)} ${readableTeamText(record.updatedAt || record.createdAt)}`;
    const currentStamp = current ? `${readableTeamText(current.data)} ${readableTeamText(current.horaEnvio)} ${readableTeamText(current.updatedAt || current.createdAt)}` : '';
    if (!current || stamp >= currentStamp) latest.set(groupId, record);
  });
  return latest;
};

const mostCommonText = (values: unknown[]) => {
  const counts = new Map<string, number>();
  values.forEach(value => {
    const text = readableTeamText(value);
    if (text) counts.set(text, (counts.get(text) ?? 0) + 1);
  });
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))[0]?.[0] ?? '';
};

const isGenericName = (name: string, front: string) => {
  const normalized = name.trim().toLocaleUpperCase('pt-BR');
  return !normalized || normalized === front.trim().toLocaleUpperCase('pt-BR')
    || ['DIVERSOS', 'EQUIPE', 'SEM NOME', 'EQUIPE SEM NOME'].includes(normalized);
};

export const recoverTeamGroups = (groups: GrupoEquipe[], records: PresencaApontamento[] = [], employees: Funcionario[] = []): GrupoEquipe[] => {
  const latest = latestRecordByGroup(records);
  const employeeByRegistration = new Map(employees.map(employee => [readableTeamText(employee.matricula), employee] as const).filter(([registration]) => Boolean(registration)));
  const employeeById = new Map(employees.map(employee => [employee.id, employee]));
  return groups.map(group => {
    const id = readableTeamText(group?.id);
    const record = latest.get(id);
    const leaderRegistration = readableTeamText(group?.liderMatricula);
    const leader = employeeByRegistration.get(leaderRegistration);
    const spreadsheetLeader = EFETIVO_OBRA_3_LEADERS[leaderRegistration];
    const members = (Array.isArray(group?.funcionarioIds) ? group.funcionarioIds : []).map(employeeId => employeeById.get(employeeId)).filter((employee): employee is Funcionario => Boolean(employee));
    const memberLeaderName = mostCommonText(members.map(employee => employee.liderNome));
    const responsible = readableTeamText(group?.responsavel, readableTeamText(record?.responsavel, readableTeamText(leader?.nome, memberLeaderName || spreadsheetLeader?.name)));
    const storedFront = readableTeamText(group?.frenteServico);
    const front = storedFront && storedFront !== 'DIVERSOS' ? storedFront : readableTeamText(record?.frenteServico, spreadsheetLeader?.area || storedFront);
    const storedName = readableTeamText(group?.nome);
    const recordName = readableTeamText(record?.grupoNome);
    const recoveredName = !isGenericName(recordName, front) ? recordName : [front, responsible].filter(Boolean).join(' - ');
    const name = isGenericName(storedName, front) ? recoveredName : storedName;
    return { ...group, id, nome: name || 'Equipe sem nome', responsavel: responsible, frenteServico: front || 'Frente não informada', funcionarioIds: Array.isArray(group?.funcionarioIds) ? group.funcionarioIds.filter(Boolean) : [], funcionarioMatriculas: Array.isArray(group?.funcionarioMatriculas) ? group.funcionarioMatriculas.filter(Boolean) : [] };
  });
};

const comparable = (value: unknown) => readableTeamText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/gi, ' ').trim().toLocaleUpperCase('pt-BR');

export const teamRecordMatches = (group: GrupoEquipe, record: PresencaApontamento): boolean => {
  if (readableTeamText(group.id) && readableTeamText(group.id) === readableTeamText(record.grupoId)) return true;
  const groupName = comparable(group.nome);
  const recordName = comparable(record.grupoNome);
  if (groupName && recordName && groupName === recordName) return true;
  const responsible = comparable(group.responsavel);
  const recordResponsible = comparable(record.responsavel);
  return Boolean(responsible && (responsible === recordResponsible || recordName.endsWith(responsible) || groupName.endsWith(recordResponsible)));
};
