import type { Empresa, Equipamento, Funcionario } from '../types';

export const normalizeComparable = (value: unknown) => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

export const normalizePrefix = (value: unknown) => normalizeComparable(value).replace(/[^a-z0-9]/g, '').toUpperCase();
export const normalizePlate = (value: unknown) => normalizeComparable(value).replace(/[^a-z0-9]/g, '').toUpperCase();
export const normalizeEmployeeCode = (value: unknown) => normalizeComparable(value).replace(/[^a-z0-9]/g, '').toUpperCase();
export const normalizeRegistration = normalizeEmployeeCode;
export const normalizeCompanyName = (value: unknown) => normalizeComparable(value).replace(/\s+/g, ' ');

export const findEquipmentCanonical = (
  equipamentos: Equipamento[],
  reference: { id?: string; prefixo?: string; placa?: string; empresaId?: string },
) => equipamentos.find(item => item.id === reference.id)
  || equipamentos.find(item => normalizePrefix(item.prefixo) === normalizePrefix(reference.prefixo))
  || equipamentos.find(item => normalizePlate(item.placa || item.seriePlaca) === normalizePlate(reference.placa))
  || equipamentos.find(item => normalizePrefix(item.prefixo) === normalizePrefix(reference.prefixo) && item.empresaId === reference.empresaId);

export const findEmployeeCanonical = (
  funcionarios: Funcionario[],
  reference: { id?: string; matricula?: string },
) => funcionarios.find(item => item.id === reference.id)
  || funcionarios.find(item => normalizeEmployeeCode(item.matricula) === normalizeEmployeeCode(reference.matricula));

export const findCompanyCanonical = (
  empresas: Empresa[],
  reference: { id?: string; nome?: string },
) => empresas.find(item => item.id === reference.id)
  || empresas.find(item => normalizeCompanyName(item.nome) === normalizeCompanyName(reference.nome));

export const operationalRowKey = (input: {
  sourceId?: string; date?: string; prefix?: string; plate?: string; employeeCode?: string; time?: string; type?: string; origin?: string;
}) => input.sourceId
  ? `source:${normalizeComparable(input.sourceId)}`
  : [input.date, normalizePrefix(input.prefix), normalizePlate(input.plate), normalizeEmployeeCode(input.employeeCode), input.time, normalizeComparable(input.type), normalizeComparable(input.origin)].join('|');
