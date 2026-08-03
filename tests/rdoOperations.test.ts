import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  ApontamentoRamoRegistro,
  Equipamento,
  Funcionario,
  GrupoEquipe,
  ListaPresenca,
  MaterialRegistro,
  ObraLocal,
  OrdemServico,
  ParteDiariaEquipamento,
  PresencaApontamento,
  RdoDiario,
  TicketJazida,
} from '../src/types';
import {
  buildRdoDailyConsolidation,
  canTransitionRdo,
  prepareRdoVersion,
} from '../src/utils/rdoOperations';

const data = '2026-08-03';
const obra: ObraLocal = {
  id: 'obra-1',
  nome: 'Complexo Alto Tietê',
  endereco: '',
  responsavel: 'Engenharia',
  status: 'Ativa',
};
const funcionarios: Funcionario[] = ['1', '2', '3'].map(id => ({
  id: `fun-${id}`,
  nome: `Funcionário ${id}`,
  cargo: 'Operador',
  telefone: '',
  empresaId: 'empresa-1',
  ativo: true,
}));
const equipamento: Equipamento = {
  id: 'eq-1',
  prefixo: 'ESC-01',
  nome: 'Escavadeira 320',
  tipo: 'Escavadeira',
  marca: 'CAT',
  modelo: '320',
  seriePlaca: 'SERIE-01',
  empresaId: 'empresa-1',
  status: 'Ativo',
  localAtualId: obra.id,
  observacao: '',
};
const lista: ListaPresenca = {
  id: 'lista-1',
  data,
  obraId: obra.id,
  responsavel: 'Apontador',
  funcionarios: [
    { funcionarioId: 'fun-1', presente: true },
    { funcionarioId: 'fun-2', presente: true },
  ],
};
const grupo: GrupoEquipe = {
  id: 'grupo-1',
  nome: 'Equipe de campo',
  responsavel: 'Líder',
  frenteServico: 'Terraplenagem',
  obraId: obra.id,
  funcionarioIds: ['fun-2', 'fun-3'],
  status: 'ativo',
  token: 'token',
  linkAtivo: true,
  createdAt: `${data}T07:00:00.000Z`,
  updatedAt: `${data}T07:00:00.000Z`,
};
const presencasLink: PresencaApontamento[] = ['2', '3'].map(id => ({
  id: `presenca-${id}`,
  data,
  horaEnvio: '07:00',
  grupoId: grupo.id,
  grupoNome: grupo.nome,
  responsavel: grupo.responsavel,
  frenteServico: grupo.frenteServico,
  funcionarioId: `fun-${id}`,
  funcionarioNome: `Funcionário ${id}`,
  funcao: 'Operador',
  status: 'Presente',
  observacao: '',
  tokenUsado: grupo.token,
  createdAt: `${data}T07:00:00.000Z`,
}));
const apontamento: ApontamentoRamoRegistro = {
  id: 'apontamento-1',
  data,
  horaEnvio: '17:00',
  ramoId: 'ramo-1',
  canteiroNome: obra.nome,
  ramoNome: 'Ramo 500',
  empresa: 'RENEA',
  responsavel: 'Apontador',
  funcaoApontador: 'Encarregado',
  funcoes: [{ nome: 'Operador', quantidade: 4 }],
  equipamentos: [{ nome: equipamento.prefixo, quantidade: 1 }],
  clima: { Manhã: 'Nublado', Tarde: 'Ensolarado', Noite: 'Nublado' },
  condicao: { Manhã: 'Praticável', Tarde: 'Praticável', Noite: 'Praticável' },
  descricaoAtividade: 'Escavação e carga',
  observacao: '',
  tokenUsado: 'token-rdo',
  createdAt: `${data}T17:00:00.000Z`,
};
const parte: ParteDiariaEquipamento = {
  id: 'parte-1',
  numero: 'PD-001',
  data,
  obraId: obra.id,
  obraNome: obra.nome,
  equipamentoId: equipamento.id,
  prefixo: equipamento.prefixo,
  tipoEquipamento: equipamento.tipo,
  jornada: 10,
  operadorId: 'fun-1',
  operadorNome: 'Funcionário 1',
  matricula: '001',
  apontador: 'Apontador',
  encarregado: 'Encarregado',
  horimetroInicial: 100,
  horimetroFinal: 108,
  totalHorasTrabalhadas: 8,
  atividades: [{
    id: 'atividade-1',
    descricao: 'Escavação e carga',
    centroCusto: 'Ramo 500',
    codigoPerda: '',
    tipoMarcacao: 'Horímetro',
    inicial: '100',
    final: '108',
    totalHoras: 8,
  }],
  transportes: [],
  checklist: [],
  outrosProblemas: '',
  status: 'Pendente',
  observacao: 'Aguardando conferência do encarregado',
  criadoEm: `${data}T07:00:00.000Z`,
  atualizadoEm: `${data}T17:00:00.000Z`,
};
const ticket: TicketJazida = {
  id: 'ticket-1',
  data,
  ticketNumero: '0001',
  prefixo: 'CAM-01',
  placa: 'ABC1D23',
  horaSaida: '09:00',
  tipoMaterial: 'Solo',
  quantidadeM3: 12,
  destinoObra: obra.nome,
  responsavelLiberacao: 'Fiscal',
  nomeLegivel: 'Fiscal',
  empresa: 'RENEA',
  observacao: '',
  statusFluxo: 'Rascunho',
};
const material: MaterialRegistro = {
  id: 'material-1',
  data,
  aba: obra.nome,
  material: 'Brita',
  unidade: 'm³',
  quantidade: 10,
  valorUnitario: 50,
  total: 500,
  destino: obra.nome,
  status: 'Divergência',
};
const ordem: OrdemServico = {
  id: 'os-1',
  numero: 'OS-001',
  equipamentoId: equipamento.id,
  tipo: 'Corretiva',
  prioridade: 'Alta',
  descricao: 'Reparo hidráulico',
  status: 'Concluída',
  dataAbertura: data,
  dataConclusao: data,
  responsavel: 'Oficina',
  custoFinal: 300,
  observacao: '',
};

test('RDO consolida fontes sem duplicar funcionários e mantém divergências visíveis', () => {
  const result = buildRdoDailyConsolidation({
    data,
    obraId: obra.id,
    empresas: [],
    obras: [obra],
    equipamentos: [equipamento],
    funcionarios,
    listasPresenca: [lista],
    gruposEquipe: [grupo],
    presencasLink,
    apontamentos: [apontamento],
    partesDiarias: [parte],
    tickets: [ticket],
    materiais: [material],
    ordensServico: [ordem],
  });

  assert.deepEqual(result.efetivoFuncionarioIds.sort(), ['fun-1', 'fun-2', 'fun-3']);
  assert.equal(result.quantidadeEquipe, 4);
  assert.equal(result.equipamentosResumo.length, 1);
  assert.equal(result.equipamentosResumo[0].horasTrabalhadas, 8);
  assert.equal(result.viagensResumo.length, 1);
  assert.equal(result.materiaisResumo.length, 1);
  assert.equal(result.custoMateriais, 500);
  assert.equal(result.custoManutencao, 300);
  assert.equal(result.custoTotal, 800);
  assert.equal(result.divergencias.some(item => item.codigo === 'efetivo-divergente'), true);
  assert.equal(result.divergencias.some(item => item.codigo === 'material-material-1'), true);
  assert.equal(result.divergencias.some(item => item.codigo === 'parte-parte-1'), true);
});

test('RDO mantém apontamento de frente quando existe uma única obra operacional', () => {
  const result = buildRdoDailyConsolidation({
    data,
    obraId: obra.id,
    empresas: [],
    obras: [obra],
    equipamentos: [equipamento],
    funcionarios,
    listasPresenca: [],
    gruposEquipe: [],
    presencasLink: [],
    apontamentos: [{ ...apontamento, canteiroNome: 'Canteiro da Marginal' }],
    partesDiarias: [],
    tickets: [],
    materiais: [],
    ordensServico: [],
  });

  assert.equal(result.producaoItens.length, 1);
  assert.equal(result.fontes.apontamentos, 1);
  assert.equal(result.divergencias.some(item => item.codigo === 'apontamento-obra-apontamento-1'), true);
});

const approvedRdo: RdoDiario = {
  id: 'rdo-1',
  numero: 'RDO-20260803-01',
  data,
  empresaId: 'empresa-1',
  obraLocalId: obra.id,
  etapaServicoId: '',
  statusAtividade: 'Andamento',
  quantidadeEquipe: 4,
  equipamentosUtilizadosIds: [equipamento.id],
  servicoExecutado: 'Escavação',
  observacao: '',
  pendencias: '',
  proximasEtapas: '',
  statusDocumento: 'Aprovado',
  responsavelRdo: 'Engenheiro responsável',
  versao: 1,
  revisoes: [],
  aprovadoPor: 'Gestor',
  aprovadoEm: `${data}T18:00:00.000Z`,
};

test('edição após aprovação abre nova revisão e preserva histórico', () => {
  const result = prepareRdoVersion(
    approvedRdo,
    { ...approvedRdo, servicoExecutado: 'Escavação e carga' },
    'Gestor da obra',
    'Correção da medição diária.',
  );

  assert.equal(result.revisionCreated, true);
  assert.equal(result.rdo.statusDocumento, 'Em revisão');
  assert.equal(result.rdo.versao, 2);
  assert.equal(result.rdo.revisoes?.length, 1);
  assert.equal(result.rdo.revisoes?.[0].statusAnterior, 'Aprovado');
  assert.equal(result.rdo.aprovadoEm, undefined);
});

test('aprovação e fechamento exigem campos e ordem operacional', () => {
  assert.equal(canTransitionRdo({ ...approvedRdo, responsavelRdo: '' }, 'Aprovado').allowed, false);
  assert.equal(canTransitionRdo({ ...approvedRdo, statusDocumento: 'Rascunho' }, 'Fechado').allowed, false);
  assert.equal(canTransitionRdo(approvedRdo, 'Fechado').allowed, true);
});
