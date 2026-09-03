import type { ControleEquipamentoDiario, Empresa, Equipamento, Funcionario, GrupoEquipe, OrdemServico } from '../types';
import { normalizeCompanyName, normalizeEmployeeCode, normalizePlate, normalizePrefix } from './canonicalIdentity';

export type IntegrityIssue = {
  id: string;
  category: 'Cadastro incompleto' | 'Problema de vínculo' | 'Divergência de dados' | 'Equipamento sem motorista';
  priority: 'Crítica' | 'Alta' | 'Média' | 'Baixa';
  title: string;
  detail: string;
  module: string;
};

const duplicates = <T,>(items: T[], key: (item: T) => string) => {
  const groups = new Map<string, T[]>();
  items.forEach(item => { const value = key(item); if (value) groups.set(value, [...(groups.get(value) || []), item]); });
  return [...groups.entries()].filter(([, values]) => values.length > 1);
};

export const auditOperationalIntegrity = (data: {
  empresas: Empresa[]; equipamentos: Equipamento[]; funcionarios: Funcionario[]; grupos: GrupoEquipe[];
  controles: ControleEquipamentoDiario[]; ordens: OrdemServico[];
}): IntegrityIssue[] => {
  const issues: IntegrityIssue[] = [];
  const companyIds = new Set(data.empresas.map(item => item.id));
  const equipmentIds = new Set(data.equipamentos.map(item => item.id));
  const employeeIds = new Set(data.funcionarios.map(item => item.id));
  const addDuplicate = (kind: string, key: string, count: number, module = 'cadastros') => issues.push({ id: `duplicate-${kind}-${key}`, category: 'Divergência de dados', priority: 'Alta', title: `${kind} duplicado`, detail: `${count} cadastros compartilham a chave normalizada ${key}.`, module });

  duplicates(data.empresas, item => normalizeCompanyName(item.nome)).forEach(([key, values]) => addDuplicate('Empresa', key, values.length));
  duplicates(data.equipamentos, item => normalizePrefix(item.prefixo)).forEach(([key, values]) => addDuplicate('Prefixo', key, values.length));
  duplicates(data.equipamentos, item => normalizePlate(item.placa || item.seriePlaca)).forEach(([key, values]) => addDuplicate('Placa', key, values.length));
  duplicates(data.funcionarios, item => normalizeEmployeeCode(item.matricula)).forEach(([key, values]) => addDuplicate('Matrícula', key, values.length));

  data.equipamentos.filter(item => item.empresaId && !companyIds.has(item.empresaId)).forEach(item => issues.push({ id: `equipment-company-${item.id}`, category: 'Problema de vínculo', priority: 'Crítica', title: `${item.prefixo} sem empresa válida`, detail: `O empresaId ${item.empresaId} não existe no cadastro canônico.`, module: 'cadastros' }));
  data.funcionarios.filter(item => item.empresaId && !companyIds.has(item.empresaId)).forEach(item => issues.push({ id: `employee-company-${item.id}`, category: 'Problema de vínculo', priority: 'Alta', title: `${item.nome} sem empresa válida`, detail: `A matrícula ${item.matricula || 'não informada'} aponta para uma empresa inexistente.`, module: 'cadastros' }));
  data.grupos.forEach(group => group.funcionarioIds.filter(id => !employeeIds.has(id)).forEach(id => issues.push({ id: `group-employee-${group.id}-${id}`, category: 'Problema de vínculo', priority: 'Alta', title: `${group.nome} contém colaborador órfão`, detail: `O ID ${id} não existe; reconciliar pela matrícula armazenada.`, module: 'presenca' })));
  data.controles.filter(item => item.equipamentoId && !equipmentIds.has(item.equipamentoId) && !data.equipamentos.some(eq => normalizePrefix(eq.prefixo) === normalizePrefix(item.prefixo))).forEach(item => issues.push({ id: `control-equipment-${item.id}`, category: 'Problema de vínculo', priority: 'Alta', title: `${item.prefixo} não reconciliado`, detail: 'Registro diário sem equipamento canônico correspondente.', module: 'controle-equipamentos' }));
  data.ordens.filter(item => !equipmentIds.has(item.equipamentoId)).forEach(item => issues.push({ id: `order-equipment-${item.id}`, category: 'Problema de vínculo', priority: 'Crítica', title: `${item.numero} sem equipamento válido`, detail: item.descricao, module: 'manutencao' }));
  data.equipamentos.filter(item => item.status === 'Esperando motorista' && !item.operadorResponsavelId).forEach(item => issues.push({ id: `equipment-driver-${item.id}`, category: 'Equipamento sem motorista', priority: 'Média', title: `${item.prefixo} aguardando motorista`, detail: item.nome, module: 'consulta-geral' }));
  return issues;
};
