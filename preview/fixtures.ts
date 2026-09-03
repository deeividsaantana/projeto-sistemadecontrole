import type { Equipamento, Funcionario, ObraLocal } from '../src/types';

export const obras: ObraLocal[] = [
  { id: 'obr-1', nome: 'Complexo do Alto Tietê', endereco: 'SP', responsavel: 'Eng. Ricardo', status: 'Ativa' },
];
export const equipamentos: Equipamento[] = [
  { id: 'eq-1', prefixo: 'CB770', nome: 'Escavadeira', tipo: 'Escavadeira hidráulica', marca: 'CAT', modelo: '320', seriePlaca: 'X1', empresaId: 'emp-1', status: 'Ativo', observacao: '' } as Equipamento,
  { id: 'eq-2', prefixo: 'CB1005', nome: 'Caminhão basculante', tipo: 'Basculante', marca: 'Volvo', modelo: 'FH', seriePlaca: 'FEJ6753', empresaId: 'emp-1', status: 'Ativo', observacao: '' } as Equipamento,
];
export const funcionarios: Funcionario[] = [
  { id: 'f-1', matricula: '103177', nome: 'José da Silva Costa', cargo: 'OPERADOR', telefone: '', empresaId: 'emp-1', ativo: true, status: 'ATIVO' } as Funcionario,
  { id: 'f-2', matricula: '100787', nome: 'Marcos de Souza', cargo: 'MOTORISTA', telefone: '', empresaId: 'emp-1', ativo: true, status: 'ATIVO' } as Funcionario,
];

// --- Link público de presença ---
import type { Empresa, GrupoEquipe, PresencaApontamento } from '../src/types';

export const empresas: Empresa[] = [
  { id: 'emp-1', nome: 'RENEA INFRAESTRUTURA S.A.', cnpj: '', telefone: '', responsavel: '' },
];

export const equipeFuncionarios: Funcionario[] = [
  { id: 'c-1', matricula: '103177', nome: 'João Batista dos Santos', cargo: 'PEDREIRO', telefone: '', empresaId: 'emp-1', ativo: true, status: 'ATIVO' } as Funcionario,
  { id: 'c-2', matricula: '103180', nome: 'Maria Aparecida Souza', cargo: 'SERVENTE', telefone: '', empresaId: 'emp-1', ativo: true, status: 'ATIVO' } as Funcionario,
  { id: 'c-3', matricula: '103182', nome: 'Antônio Carlos Ferreira', cargo: 'CARPINTEIRO', telefone: '', empresaId: 'emp-1', ativo: true, status: 'ATIVO' } as Funcionario,
  { id: 'c-4', matricula: '103190', nome: 'Sebastião Rodrigues Lima', cargo: 'ARMADOR', telefone: '', empresaId: 'emp-1', ativo: true, status: 'ATIVO' } as Funcionario,
  { id: 'c-5', matricula: '103195', nome: 'Francisco das Chagas Oliveira', cargo: 'AJUDANTE', telefone: '', empresaId: 'emp-1', ativo: true, status: 'ATIVO' } as Funcionario,
];

export const grupo: GrupoEquipe = {
  id: 'g-1', nome: 'Equipe do Renilson', responsavel: 'Renilson', frenteServico: 'Ramo 200',
  obraId: 'obr-1', funcionarioIds: equipeFuncionarios.map(f => f.id),
  token: 'presenca-exemplo', status: 'ativo', linkAtivo: true, createdAt: '', updatedAt: '',
} as GrupoEquipe;

export const registrosEnviados: PresencaApontamento[] = equipeFuncionarios.slice(0, 3).map((f, i) => ({
  id: `pl-${i}`, data: '2026-09-03', funcionarioId: f.id, funcionarioNome: f.nome,
  funcao: f.cargo, grupoId: grupo.id, grupoNome: grupo.nome, status: i === 1 ? 'Ausente' : 'Presente',
  observacao: '', responsavel: 'Renilson', frenteServico: 'Ramo 200', horaEnvio: '08:02',
} as PresencaApontamento));
