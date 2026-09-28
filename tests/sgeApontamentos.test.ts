import assert from 'node:assert/strict';
import test from 'node:test';
import { preverImportacaoSge, registrosParaAplicar, type LinhaBrutaSge } from '../src/fleet/sgeApontamentos';
import type { ControleEquipamentoDiario, Equipamento, Funcionario } from '../src/types';

const equipamento = (id: string, prefixo: string, extra: Partial<Equipamento> = {}) => ({ id, prefixo, seriePlaca: `SERIE-${id}`, nome: 'Basculante', tipo: 'Caminhão Basculante', marca: 'Volvo', modelo: 'VM', status: 'Ativo', ...extra }) as unknown as Equipamento;
const motorista = (matricula: string, nome: string) => ({ id: `mot-${matricula}`, matricula, nome, cargo: 'Operador', ativo: true } as unknown as Funcionario);

const linha = (overrides: Partial<LinhaBrutaSge> = {}): LinhaBrutaSge => ({
  linha: 11,
  data: '01/09/2026',
  uaEquipamento: 'CB770',
  descricaoEquipamento: 'Caminhão Basculante',
  horimetroInicial: '120,0',
  horimetroFinal: '135,5',
  horasHorimetro: '15,5',
  matriculaOperador: '103177',
  nomeOperador: 'ADILSON PIRES DA CRUZ',
  observacoes: '-',
  ...overrides,
});

const equipamentos = [equipamento('equipamento-cb770', 'CB770')];
const motoristas = [motorista('103177', 'ADILSON PIRES DA CRUZ')];

test('linha com horas no horímetro vira lançamento Em operação com o operador', () => {
  const previa = preverImportacaoSge({ linhas: [linha()], equipamentos, registros: [], motoristas });

  assert.equal(previa.novos, 1);
  assert.equal(previa.linhas[0].disposicao, 'NOVO');
  assert.equal(previa.linhas[0].registro?.status, 'Em operação');
  assert.equal(previa.linhas[0].registro?.nomeMotorista, 'ADILSON PIRES DA CRUZ');
  assert.equal(previa.linhas[0].registro?.data, '2026-09-01');
  assert.match(previa.linhas[0].registro?.observacao || '', /120|135,5/);
});

test('linha sem horas no horímetro vira À disposição', () => {
  const previa = preverImportacaoSge({
    linhas: [linha({ horimetroInicial: '80', horimetroFinal: '80', horasHorimetro: '0' })],
    equipamentos, registros: [], motoristas,
  });

  assert.equal(previa.linhas[0].registro?.status, 'Disponível');
});

test('mesmo equipamento duas vezes no mesmo dia fica de fora das duas', () => {
  const previa = preverImportacaoSge({
    linhas: [linha({ linha: 11 }), linha({ linha: 12 })],
    equipamentos, registros: [], motoristas,
  });

  assert.equal(previa.linhas[0].disposicao, 'NOVO');
  assert.equal(previa.linhas[1].disposicao, 'DUPLICADO');
  assert.equal(previa.duplicados, 1);
  assert.equal(registrosParaAplicar(previa).length, 1);
});

test('lançamento manual (origem SISTEMA) não é sobrescrito pela planilha', () => {
  const manual: ControleEquipamentoDiario = {
    id: 'controle-manual', chave: '2026-09-01|equipamento-cb770', data: '2026-09-01',
    funcionarioId: '', codigoFuncionario: '', nomeMotorista: 'Outro motorista',
    equipamentoId: 'equipamento-cb770', prefixo: 'CB770', familia: 'Basculantes',
    status: 'Em operação', horaSaida: '07:00', horaEntradaManutencao: '', horaLiberacao: '',
    observacao: '', origem: 'SISTEMA', revisao: [], criadoEm: '', atualizadoEm: '',
  };

  const previa = preverImportacaoSge({ linhas: [linha()], equipamentos, registros: [manual], motoristas });

  assert.equal(previa.linhas[0].disposicao, 'PROTEGIDO');
  assert.equal(previa.protegidos, 1);
  assert.equal(registrosParaAplicar(previa).length, 0);
});

test('lançamento de uma importação anterior (origem PLANILHA) pode ser atualizado', () => {
  const anterior: ControleEquipamentoDiario = {
    id: 'sge-import-2026-09-01|equipamento-cb770', chave: '2026-09-01|equipamento-cb770', data: '2026-09-01',
    funcionarioId: '', codigoFuncionario: '', nomeMotorista: 'ADILSON PIRES DA CRUZ',
    equipamentoId: 'equipamento-cb770', prefixo: 'CB770', familia: 'Basculantes',
    status: 'Em operação', horaSaida: '', horaEntradaManutencao: '', horaLiberacao: '',
    observacao: '', origem: 'PLANILHA', revisao: [], criadoEm: '', atualizadoEm: '',
  };

  const previa = preverImportacaoSge({ linhas: [linha()], equipamentos, registros: [anterior], motoristas });

  assert.equal(previa.linhas[0].disposicao, 'ATUALIZA');
  assert.equal(previa.linhas[0].registro?.id, anterior.id);
  assert.equal(registrosParaAplicar(previa).length, 1);
});

test('equipamento fora do cadastro vira erro e não trava as outras linhas', () => {
  const previa = preverImportacaoSge({
    linhas: [linha({ uaEquipamento: 'ZZ999' }), linha({ linha: 13 })],
    equipamentos, registros: [], motoristas,
  });

  assert.equal(previa.linhas[0].disposicao, 'ERRO');
  assert.match(previa.linhas[0].mensagens[0], /ZZ999/);
  assert.equal(previa.linhas[1].disposicao, 'NOVO');
  assert.equal(previa.comErro, 1);
});

test('prefixo desconhecido nunca cai em outro equipamento sem placa cadastrada', () => {
  // A planilha do SGE não tem coluna de placa; um prefixo sem correspondência
  // não pode "casar" por engano com outra máquina que também não tem placa.
  const semPlaca = [
    equipamento('equipamento-cb770', 'CB770', { seriePlaca: undefined }),
    equipamento('equipamento-lo279', 'LO279', { seriePlaca: undefined }),
  ];
  const previa = preverImportacaoSge({ linhas: [linha({ uaEquipamento: 'LO375' })], equipamentos: semPlaca, registros: [], motoristas });

  assert.equal(previa.linhas[0].disposicao, 'ERRO');
  assert.equal(previa.linhas[0].registro, undefined);
});

test('máquina em manutenção não é mexida pela planilha mesmo vindo de uma importação anterior', () => {
  // origem PLANILHA para isolar essa regra da proteção por lançamento manual, testada acima.
  const emManutencao: ControleEquipamentoDiario = {
    id: 'controle-manutencao', chave: '2026-09-01|equipamento-cb770', data: '2026-09-01',
    funcionarioId: '', codigoFuncionario: '', nomeMotorista: '',
    equipamentoId: 'equipamento-cb770', prefixo: 'CB770', familia: 'Basculantes',
    status: 'Em manutenção', horaSaida: '', horaEntradaManutencao: '08:00', horaLiberacao: '',
    motivoManutencao: 'Pneu furado', observacao: '', origem: 'PLANILHA', revisao: [], criadoEm: '', atualizadoEm: '',
  };

  const previa = preverImportacaoSge({ linhas: [linha()], equipamentos, registros: [emManutencao], motoristas });

  assert.equal(previa.linhas[0].disposicao, 'PROTEGIDO');
});
