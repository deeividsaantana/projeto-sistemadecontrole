import type { Equipamento, Funcionario, ObraLocal, ParteDiariaEquipamento } from '../src/types';

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

const base = (id: string, numero: string, prefixo: string, status: ParteDiariaEquipamento['status']): ParteDiariaEquipamento => ({
  id, numero, data: '2026-09-02', obraId: 'obr-1', obraNome: 'Complexo do Alto Tietê',
  equipamentoId: prefixo === 'CB770' ? 'eq-1' : 'eq-2', prefixo,
  tipoEquipamento: prefixo === 'CB770' ? 'Escavadeira hidráulica' : 'Basculante',
  jornada: 10, operadorId: 'f-1', operadorNome: 'José da Silva Costa', matricula: '103177',
  apontador: 'Aline Lima', encarregado: 'Renilson', horimetroInicial: 1200, horimetroFinal: 1208,
  totalHorasTrabalhadas: 8,
  atividades: [{ id: 'a1', descricao: 'Escavação de vala', centroCusto: 'CC-100', codigoPerda: '', tipoMarcacao: 'Horímetro', inicial: '1200', final: '1208', totalHoras: 8 }],
  transportes: [{ id: 't1', descricao: 'Bota-fora', centroCusto: 'CC-100', destino: 'Aterro', materialTransportado: 'Solo', quantidadeViagens: 6, equipamentoCarga: 'CB770' }],
  checklist: [
    { codigo: 'C01', descricao: 'Nível de óleo do motor', resposta: 'Sim', observacao: '' },
    { codigo: 'C02', descricao: 'Sistema de freios', resposta: status === 'Com deficiência' ? 'Não' : 'Sim', observacao: '' },
    { codigo: 'C03', descricao: 'Iluminação', resposta: 'N/A', observacao: '' },
  ],
  outrosProblemas: status === 'Com deficiência' ? 'Vazamento no cilindro da lança.' : '',
  status, observacao: '', criadoEm: '2026-09-02T10:00:00.000Z', atualizadoEm: '2026-09-02T18:00:00.000Z',
});

export const registros: ParteDiariaEquipamento[] = [
  base('p1', '000101', 'CB770', 'Conferido'),
  base('p2', '000102', 'CB1005', 'Com deficiência'),
  base('p3', '000103', 'CB770', 'Pendente'),
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
