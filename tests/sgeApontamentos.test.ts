import assert from 'node:assert/strict';
import test from 'node:test';
import { aplicarCadastroSge, preverCadastroSge, preverImportacaoSge, registrosParaAplicar, type LinhaBrutaSge } from '../src/fleet/sgeApontamentos';
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

test('cadastro: o operador e o horímetro do dia mais recente vão para o equipamento', () => {
  const funcionarios = [motorista('103177', 'ADILSON PIRES DA CRUZ'), motorista('102863', 'ELADIO COSTA SILVA')];
  const previa = preverCadastroSge({
    linhas: [
      linha({ data: '29/09/2026', horimetroFinal: 1056, matriculaOperador: '102863', nomeOperador: 'ELADIO COSTA SILVA' }),
      linha({ data: '30/09/2026', horimetroFinal: 61, matriculaOperador: '103177', nomeOperador: 'ADILSON PIRES DA CRUZ' }),
    ],
    equipamentos, funcionarios,
  });

  assert.equal(previa.motoristasVinculados, 1);
  assert.equal(previa.horimetrosAtualizados, 1);
  const [cb770] = aplicarCadastroSge(equipamentos, previa, funcionarios);
  assert.equal(cb770.operadorResponsavelId, 'mot-103177');
  assert.equal(cb770.operadorResponsavelNome, 'ADILSON PIRES DA CRUZ');
  assert.equal(cb770.horimetroAtual, 61);
  assert.equal(cb770.horimetroAtualData, '2026-09-30');
});

test('cadastro: dia sem operador ("-") não apaga o motorista, vale o último dia com operador', () => {
  const previa = preverCadastroSge({
    linhas: [
      linha({ data: '29/09/2026' }),
      linha({ data: '30/09/2026', horimetroFinal: '140', matriculaOperador: '', nomeOperador: '-' }),
    ],
    equipamentos, funcionarios: motoristas,
  });

  const [cb770] = aplicarCadastroSge(equipamentos, previa, motoristas);
  assert.equal(cb770.operadorResponsavelNome, 'ADILSON PIRES DA CRUZ');
  assert.equal(cb770.horimetroAtual, 140);
});

test('cadastro: operador fora do cadastro de colaboradores vai para a revisão sem vínculo', () => {
  const previa = preverCadastroSge({
    linhas: [linha({ matriculaOperador: '999999', nomeOperador: 'FULANO SEM CADASTRO' })],
    equipamentos, funcionarios: motoristas,
  });

  assert.equal(previa.motoristasVinculados, 0);
  assert.match(previa.revisao.join(' '), /FULANO SEM CADASTRO/);
  assert.equal(aplicarCadastroSge(equipamentos, previa, motoristas)[0].operadorResponsavelId, undefined);
});

test('cadastro: motorista último em dois equipamentos fica no de dia mais recente', () => {
  const frota = [equipamento('eq-rc021', 'RC021'), equipamento('eq-rc042', 'RC042', { operadorResponsavelId: 'mot-103177', operadorResponsavelNome: 'ADILSON PIRES DA CRUZ' })];
  const previa = preverCadastroSge({
    linhas: [
      linha({ data: '28/09/2026', uaEquipamento: 'RC042' }),
      linha({ data: '30/09/2026', uaEquipamento: 'RC021' }),
    ],
    equipamentos: frota, funcionarios: motoristas,
  });

  const [rc021, rc042] = aplicarCadastroSge(frota, previa, motoristas);
  assert.equal(rc021.operadorResponsavelId, 'mot-103177');
  assert.equal(rc042.operadorResponsavelId, undefined, 'sai do equipamento antigo, como no vínculo à mão');
  assert.match(previa.revisao.join(' '), /ficou no RC021/);
});

test('cadastro: empate no mesmo dia não escolhe o equipamento sozinho', () => {
  const frota = [equipamento('eq-rc021', 'RC021'), equipamento('eq-rc042', 'RC042')];
  const previa = preverCadastroSge({
    linhas: [linha({ uaEquipamento: 'RC021' }), linha({ uaEquipamento: 'RC042' })],
    equipamentos: frota, funcionarios: motoristas,
  });

  assert.equal(previa.motoristasVinculados, 0);
  assert.match(previa.revisao.join(' '), /mesmo dia/);
});

test('cadastro: dois operadores no mesmo dia vale quem rodou horas', () => {
  const funcionarios = [motorista('103177', 'ADILSON PIRES DA CRUZ'), motorista('102863', 'ELADIO COSTA SILVA')];
  const previa = preverCadastroSge({
    linhas: [
      linha({ horasHorimetro: 0, matriculaOperador: '102863', nomeOperador: 'ELADIO COSTA SILVA' }),
      linha({ horasHorimetro: 6 }),
    ],
    equipamentos, funcionarios,
  });

  assert.equal(aplicarCadastroSge(equipamentos, previa, funcionarios)[0].operadorResponsavelNome, 'ADILSON PIRES DA CRUZ');
});

test('cadastro: leitura mais antiga que a do cadastro não volta o horímetro', () => {
  const frota = [equipamento('equipamento-cb770', 'CB770', { horimetroAtual: 200, horimetroAtualData: '2026-10-01' })];
  const previa = preverCadastroSge({ linhas: [linha({ data: '30/09/2026', horimetroFinal: 150 })], equipamentos: frota, funcionarios: motoristas });

  assert.equal(previa.horimetrosAtualizados, 0);
});

test('cadastro: horímetro numérico da planilha não é lido como milhar', () => {
  const previa = preverCadastroSge({ linhas: [linha({ horimetroFinal: 246.617 })], equipamentos, funcionarios: motoristas });

  assert.equal(previa.alteracoes[0].horimetro?.depois, 246.617);
});

test('cadastro: editar o equipamento à mão mantém o horímetro e o dia da leitura do SGE', async () => {
  const { montarRegistro, valoresIniciais } = await import('../src/components/cadastros/camposCadastro');
  const salvo = equipamento('equipamento-cb770', 'CB770', { empresaId: 'emp-1', horimetroAtual: 61, horimetroAtualData: '2026-09-30' });
  const dados = { equipamentos: [salvo], funcionarios: [], empresas: [{ id: 'emp-1', nome: 'Renea' }], obras: [], combustiveis: [] } as never;
  const valores = valoresIniciais('equipamentos', salvo, dados);
  assert.equal(valores.horimetroAtual, '61');
  const resultado = montarRegistro('equipamentos', valores, salvo, salvo.id, dados);
  assert.ok(resultado.ok);
  assert.equal((resultado.registro as Equipamento).horimetroAtualData, '2026-09-30');
});

test('cadastro: o dia do apontamento vai junto com o motorista, para o quadro saber qual é mais novo', () => {
  const previa = preverCadastroSge({ linhas: [linha({ data: '29/09/2026' })], equipamentos, funcionarios: motoristas });
  const [cb770] = aplicarCadastroSge(equipamentos, previa, motoristas);
  assert.equal(cb770.operadorResponsavelDesde, '2026-09-29');
});

test('botão da prévia diz só o que vai ser gravado', async () => {
  const { rotuloImportacaoSge } = await import('../src/fleet/sgeApontamentos');
  assert.equal(rotuloImportacaoSge(1381, 106), 'Importar 1381 lançamento(s) e atualizar 106 equipamento(s)');
  assert.equal(rotuloImportacaoSge(0, 106), 'Atualizar 106 equipamento(s)');
  assert.equal(rotuloImportacaoSge(12, 0), 'Importar 12 lançamento(s)');
  assert.equal(rotuloImportacaoSge(0, 0), 'Nada para gravar');
});

test('cadastro: motorista gravado pelo SGE sobrevive à mesclagem com a nuvem', async () => {
  const { mergeCloudTable } = await import('../src/cloudMerge');
  const naNuvem = equipamentos[0];
  const previa = preverCadastroSge({ linhas: [linha()], equipamentos, funcionarios: motoristas });
  const [local] = aplicarCadastroSge(equipamentos, previa, motoristas, '2026-10-01T15:00:00.000Z');
  assert.equal(local.atualizadoEm, '2026-10-01T15:00:00.000Z');

  const [mesclado] = mergeCloudTable([naNuvem], [local]) as Equipamento[];
  assert.equal(mesclado.operadorResponsavelNome, 'ADILSON PIRES DA CRUZ', 'sem a data, a versão da nuvem (sem motorista) ganhava');
});
