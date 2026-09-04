import type {
  ControleEquipamentoDiario, Equipamento, Funcionario, ObraLocal } from '../src/types';

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

// --- Painel de Controle ---
import type { Abastecimento, Comboio, OrdemServico, ProdutoLubrificacao, TicketJazida, TipoCombustivel } from '../src/types';

export const comboios: Comboio[] = [
  { id: 'cmb-1', nome: 'Comboio 01', placa: 'ABC1D23', capacidadeLitros: 8000 } as Comboio,
];
export const combustiveis: TipoCombustivel[] = [{ id: 'tc-1', nome: 'Diesel S10' } as TipoCombustivel];
export const lubrificantes: ProdutoLubrificacao[] = [{ id: 'pl-1', nome: 'Óleo 15W40' } as ProdutoLubrificacao];

const dia = (n: number) => `2026-09-${String(n).padStart(2, '0')}`;
export const abastecimentos: Abastecimento[] = Array.from({ length: 14 }, (_, i) => ({
  id: `ab-${i}`, data: dia((i % 3) + 1), hora: '07:30',
  equipamentoId: i % 2 ? 'eq-1' : 'eq-2', prefixoInformado: i % 2 ? 'CB770' : 'CB1005',
  horimetroInicial: 1000 + i, kmInicial: 0, bombaInicial: 1000 * i,
  quantidadeLitros: 120 + i * 7, bombaFinal: 1000 * i + 120,
  tipoCombustivelId: 'tc-1', comboioId: 'cmb-1',
  responsavel: 'José da Silva Costa', observacao: '',
} as Abastecimento));

// Sem cast: assim o TypeScript confere o fixture contra o tipo real.
export const ordensServico: OrdemServico[] = [
  {
    id: 'os-1', numero: 'OS-0100', equipamentoId: 'eq-1', tipo: 'Corretiva', prioridade: 'Alta',
    descricao: 'Troca de mangueira hidráulica', status: 'Em Andamento', dataAbertura: dia(2),
    responsavel: 'Manutenção', observacao: '', motivo: 'Vazamento',
  },
  {
    id: 'os-2', numero: 'OS-0101', equipamentoId: 'eq-2', tipo: 'Preventiva', prioridade: 'Média',
    descricao: 'Revisão preventiva 500h', status: 'Aguardando Peça', dataAbertura: dia(1),
    responsavel: 'Manutenção', observacao: '', motivo: 'Preventiva',
  },
];

export const ticketsJazida: TicketJazida[] = Array.from({ length: 6 }, (_, i) => ({
  id: `tk-${i}`, data: dia((i % 3) + 1), ticketNumero: String(2200 + i),
  tipoTicket: 'Liberação', prefixo: 'CB1005', placa: 'FEJ6753',
  tipoMaterial: 'Solo', quantidadeM3: 12, unidadeQuantidade: 'm³',
  destinoObra: 'Aterro', responsavelLiberacao: 'Renilson', nomeLegivel: 'Renilson',
  empresa: 'RENEA', observacao: '', statusFluxo: 'Enviado', origemRegistro: 'Link',
} as TicketJazida));

export const controlesEquipamentos: ControleEquipamentoDiario[] = Array.from({ length: 9 }, (_, i) => ({
  id: `cd-${i + 1}`,
  chave: `cd-${i + 1}`,
  data: `2026-09-0${(i % 3) + 1}`,
  funcionarioId: `f-${(i % 3) + 1}`,
  codigoFuncionario: `100${i + 1}`,
  nomeMotorista: ['RENILSON DOS SANTOS', 'ROBERSON DA SILVA', 'SERGIO CONCEICAO'][i % 3],
  equipamentoId: 'eq-1',
  prefixo: `CB${770 + i}`,
  familia: 'Caminhão basculante',
  status: (['Em operação', 'Em manutenção', 'Disponível'] as const)[i % 3],
  horaSaida: '07:10',
  horaEntradaManutencao: i % 3 === 1 ? '09:20' : '',
  horaLiberacao: '',
  motivoManutencao: i % 3 === 1 ? 'Troca de pneu dianteiro' : undefined,
  observacao: i % 2 ? 'Operando na frente 2.' : '',
  origem: 'SISTEMA',
  revisao: [],
  criadoEm: '2026-09-01T10:00:00.000Z',
  atualizadoEm: '2026-09-01T10:00:00.000Z',
} as ControleEquipamentoDiario));

/** Presenca de varios dias, para o painel e a tendencia de 7 dias. */
export const presencasHistorico: PresencaApontamento[] = ['2026-09-01','2026-09-02','2026-09-03'].flatMap((data, d) =>
  equipeFuncionarios.map((f, i) => ({
    id: `ph-${d}-${i}`,
    data,
    horaEnvio: '07:0' + (i % 9),
    grupoId: grupo.id,
    grupoNome: grupo.nome,
    responsavel: grupo.responsavel,
    frenteServico: grupo.frenteServico,
    funcionarioId: f.id,
    funcionarioNome: f.nome,
    funcao: f.cargo,
    status: (i % 5 === 0 ? 'Ausente' : i % 7 === 0 ? 'Atestado' : 'Presente') as PresencaApontamento['status'],
    observacao: i % 5 === 0 ? 'Sem transporte' : '',
    tokenUsado: 'validado-preview',
    createdAt: `${data}T10:00:00.000Z`,
  } as PresencaApontamento)),
);
