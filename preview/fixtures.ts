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
  { id: 'emp-2', nome: 'TERRAPLENAGEM PARCEIRA LTDA', cnpj: '', telefone: '', responsavel: '' },
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

// O dia anterior tem gente diferente do dia corrente: é assim que o e2e prova
// que trocar de dia na régua realmente trouxe outro dia, e não repintou o mesmo.
export const registrosDiaAnterior: PresencaApontamento[] = equipeFuncionarios.slice(3).map((f, i) => ({
  id: `pl-ontem-${i}`, data: '2026-09-02', funcionarioId: f.id, funcionarioNome: f.nome,
  funcao: f.cargo, grupoId: grupo.id, grupoNome: grupo.nome, status: 'Presente',
  observacao: '', responsavel: 'Renilson', frenteServico: 'Ramo 200', horaEnvio: '07:55',
} as PresencaApontamento));

// --- Painel de Controle ---
import type { Abastecimento, Comboio, Lubrificacao, OrdemServico, ProdutoLubrificacao, TicketJazida, TipoCombustivel } from '../src/types';

export const comboios: Comboio[] = [
  { id: 'cmb-1', nome: 'Comboio 01', placa: 'ABC1D23', capacidadeLitros: 8000 } as Comboio,
];
export const combustiveis: TipoCombustivel[] = [{ id: 'tc-1', nome: 'Diesel S10' } as TipoCombustivel];
export const lubrificantes: ProdutoLubrificacao[] = [{ id: 'pl-1', nome: 'Óleo 15W40' } as ProdutoLubrificacao];
export const lubrificacoes: Lubrificacao[] = [
  { id: 'lub-1', data: '2026-09-03', hora: '08:15', equipamentoId: 'eq-1', horimetro: 1240, produtoLubrificacaoId: 'pl-1', compartimento: 'Pinos do Braço / Caçamba', quantidade: 2, responsavel: 'Marcos de Souza', observacao: '' },
];

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
  horaSaida: '08:30', horaChegada: '09:15',
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

/**
 * Presença de várias equipes, ramos e canteiros nos últimos 14 dias contados a
 * partir de hoje — sem isso o painel abre sempre vazio no preview e não dá
 * para conferir gráfico, filtro nem hierarquia. É dado de demonstração e vive
 * só aqui; o sistema continua lendo os apontamentos reais.
 */
export const equipesPresenca: GrupoEquipe[] = [
  { id: 'g-1', nome: 'Equipe do Renilson', responsavel: 'Renilson', frenteServico: 'Ramo 200', obraId: 'obr-1', funcionarioIds: [], token: 'presenca-exemplo', status: 'ativo', linkAtivo: true, createdAt: '', updatedAt: '' },
  { id: 'g-2', nome: 'Equipe da Marginal', responsavel: 'Cleber', frenteServico: 'Marginal', obraId: 'obr-1', funcionarioIds: [], token: 'presenca-marginal', status: 'ativo', linkAtivo: true, createdAt: '', updatedAt: '' },
  { id: 'g-3', nome: 'Equipe do Vanderlei', responsavel: 'Vanderlei', frenteServico: 'Ramo 700', obraId: 'obr-1', funcionarioIds: [], token: 'presenca-r700', status: 'ativo', linkAtivo: true, createdAt: '', updatedAt: '' },
  { id: 'g-4', nome: 'Equipe da Fábrica', responsavel: 'Adriana', frenteServico: 'Fábrica', obraId: 'obr-1', funcionarioIds: [], token: 'presenca-fabrica', status: 'ativo', linkAtivo: true, createdAt: '', updatedAt: '' },
  { id: 'g-5', nome: 'Equipe do SP-066', responsavel: 'Josimar', frenteServico: 'SP-066', obraId: 'obr-1', funcionarioIds: [], token: 'presenca-sp066', status: 'ativo', linkAtivo: true, createdAt: '', updatedAt: '' },
].map(item => item as GrupoEquipe);

const FUNCOES_PRESENCA = ['AJUDANTE', 'OPERADOR', 'PEDREIRO', 'SERVENTE', 'ARMADOR', 'CARPINTEIRO', 'MOTORISTA', 'ENCARREGADO'];

export const efetivoPresenca: Funcionario[] = Array.from({ length: 46 }, (_, i) => ({
  id: `pf-${i}`,
  matricula: String(104000 + i),
  nome: ['João Batista dos Santos','Maria Aparecida Souza','Antônio Carlos Ferreira','Sebastião Rodrigues Lima','Francisco das Chagas Oliveira','Rita de Cássia Alves','Josué Pereira Nunes','Vanderlei Martins','Cleber Antunes','Adriana Moreira','Josimar da Silva','Renilson Barbosa'][i % 12] + ` ${i + 1}`,
  cargo: FUNCOES_PRESENCA[i % FUNCOES_PRESENCA.length],
  telefone: '', empresaId: i % 5 === 0 ? 'emp-2' : 'emp-1', ativo: true, status: 'ATIVO',
} as Funcionario));

const diasDePresenca = Array.from({ length: 14 }, (_, i) => {
  const dia = new Date();
  dia.setHours(12, 0, 0, 0);
  dia.setDate(dia.getDate() - (13 - i));
  return dia.toISOString().slice(0, 10);
});

export const presencasHistorico: PresencaApontamento[] = diasDePresenca.flatMap((data, d) =>
  efetivoPresenca.map((f, i) => {
    const equipe = equipesPresenca[i % equipesPresenca.length];
    const semente = (d * 7 + i * 3) % 17;
    const status = semente === 0 ? 'Ausente' : semente === 4 ? 'Atestado' : semente === 9 ? 'Atraso' : semente === 13 ? 'Falta justificada' : 'Presente';
    return {
      id: `ph-${d}-${i}`,
      data,
      horaEnvio: `0${6 + (i % 3)}:${String((i * 7) % 60).padStart(2, '0')}`,
      grupoId: equipe.id,
      grupoNome: equipe.nome,
      responsavel: equipe.responsavel,
      frenteServico: equipe.frenteServico,
      funcionarioId: f.id,
      funcionarioNome: f.nome,
      funcao: f.cargo,
      status: status as PresencaApontamento['status'],
      observacao: status === 'Ausente' ? 'Sem transporte' : '',
      tokenUsado: 'validado-preview',
      createdAt: `${data}T10:00:00.000Z`,
    } as PresencaApontamento;
  }).filter((_, i) => (d + i) % 9 !== 0),
);
