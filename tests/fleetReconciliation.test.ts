import assert from 'node:assert/strict';
import type { Empresa, Equipamento, Funcionario, GrupoEquipe } from '../src/types';
import {
  lookupDriverByCode,
  lookupEquipmentByPrefix,
  reconcileCompany,
  reconcileEmployee,
  reconcileEquipment,
} from '../src/fleet/reconciliation';

const companies: Empresa[] = [
  {
    id: 'company-renea',
    nome: 'RENEA INFRAESTRUTURA S.A.',
    cnpj: '12.345.678/0001-90',
    telefone: '',
    responsavel: 'Operação',
    status: 'ATIVO',
  },
];

const employees: Funcionario[] = [
  {
    id: 'employee-103177',
    matricula: '103177',
    nome: 'Adilson Pires da Cruz',
    cargo: 'Motorista',
    telefone: '',
    empresaId: 'company-renea',
    ativo: true,
    status: 'ATIVO',
  },
  {
    id: 'employee-102023',
    matricula: ' 102023 ',
    nome: 'Motorista Exemplo',
    cargo: 'Motorista',
    telefone: '',
    empresaId: 'company-renea',
    ativo: true,
    status: 'ATIVO',
  },
];

const equipment: Equipamento[] = [
  {
    id: 'equipment-cb770',
    prefixo: 'CB 770',
    nome: 'Caminhão Basculante',
    tipo: 'Caminhão Basculante',
    marca: 'Volkswagen',
    modelo: 'Constellation',
    seriePlaca: 'ABC-1D23',
    placa: 'ABC-1D23',
    empresaId: 'company-renea',
    status: 'Ativo',
    localAtualId: 'alto-tiete',
    observacao: '',
    familia: 'Basculantes',
  },
];

const teams: GrupoEquipe[] = [
  {
    id: 'team-basculantes',
    nome: 'Equipe de Basculantes',
    responsavel: 'Encarregado',
    frenteServico: 'Alto Tietê',
    funcionarioIds: ['employee-103177'],
    funcionarioMatriculas: ['103177'],
    status: 'ativo',
    token: 'token',
    linkAtivo: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
];

assert.equal(reconcileCompany('company-renea', undefined, companies).value?.nome, 'RENEA INFRAESTRUTURA S.A.');
assert.equal(reconcileCompany('old-id', 'renea infraestrutura s.a.', companies).confidence, 'normalized');
assert.equal(reconcileEmployee({ employeeCode: ' 103177 ' }, employees).value?.id, 'employee-103177');
assert.equal(reconcileEmployee({ employeeCode: 102023 as unknown as string }, employees).value?.id, 'employee-102023');
assert.equal(reconcileEquipment({ prefix: 'cb-770' }, equipment).value?.id, 'equipment-cb770');
assert.equal(reconcileEquipment({ plate: 'ABC1D23' }, equipment).value?.id, 'equipment-cb770');

const driver = lookupDriverByCode('103177', employees, companies, teams);
assert.equal(driver?.employeeName, 'Adilson Pires da Cruz');
assert.equal(driver?.companyName, 'RENEA INFRAESTRUTURA S.A.');
assert.equal(driver?.teamName, 'Equipe de Basculantes');
assert.equal(driver?.temporary, false);

const truck = lookupEquipmentByPrefix('CB770', equipment, companies);
assert.equal(truck?.equipmentId, 'equipment-cb770');
assert.equal(truck?.normalizedPrefix, 'CB770');
assert.equal(truck?.normalizedPlate, 'ABC1D23');
assert.equal(truck?.companyName, 'RENEA INFRAESTRUTURA S.A.');
