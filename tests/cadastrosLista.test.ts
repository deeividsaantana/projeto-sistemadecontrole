import assert from 'node:assert/strict';
import test from 'node:test';
import type { Empresa, Equipamento, Funcionario, ObraLocal } from '../src/types';
import {
  contarSituacoes,
  filtrarLinhas,
  montarLinhas,
  opcoesDoFiltro,
  ordenarLinhas,
  type DadosCadastros,
} from '../src/utils/cadastrosLista';
import { usosDoCadastro, type CadastroUsage } from '../src/masterData/registryDependencies';
import { montarRegistro, valoresIniciais } from '../src/components/cadastros/camposCadastro';

const empresas: Empresa[] = [
  { id: 'emp-1', nome: 'RENEA Infraestrutura', cnpj: '12.345.678/0001-90', telefone: '', responsavel: '', tipos: ['EMPRESA'] },
  { id: 'emp-2', nome: 'Pedraforte Mineração', cnpj: '', telefone: '', responsavel: '', tipos: ['FORNECEDOR', 'MATERIAIS'] },
  { id: 'emp-3', nome: 'Terraplenagem Antiga', cnpj: '', telefone: '', responsavel: '', tipos: ['EMPRESA'], status: 'INATIVO' },
];
const funcionarios = [
  { id: 'f-1', matricula: '103177', nome: 'José da Silva Costa', cargo: 'OPERADOR', telefone: '', empresaId: 'emp-1', ativo: true, status: 'ATIVO' },
  { id: 'f-2', matricula: '100787', nome: 'Cleiton Barbosa', cargo: 'MOTORISTA', telefone: '', empresaId: 'emp-1', ativo: true, status: 'FÉRIAS', liderMatricula: '103177', liderNome: 'José da Silva Costa' },
  { id: 'f-3', matricula: '100100', nome: 'Antônio Ferreira', cargo: 'AJUDANTE', telefone: '', empresaId: 'emp-3', ativo: false, status: 'DESMOBILIZADO' },
] as Funcionario[];
const equipamentos = [
  { id: 'eq-1', prefixo: 'CB10', nome: 'Escavadeira', tipo: 'Escavadeira', empresaId: 'emp-1', status: 'Ativo', localAtualId: 'obr-1' },
  { id: 'eq-2', prefixo: 'CB9', nome: 'Rolo compactador', tipo: 'Rolo', empresaId: 'emp-1', status: 'Manutenção' },
  { id: 'eq-3', prefixo: 'VL02', nome: 'Caminhonete', tipo: 'Pickup', empresaId: 'emp-1', status: 'Ativo', categoriaFrota: 'Veículo', placa: 'FEJ6753' },
] as Equipamento[];
const obras: ObraLocal[] = [{ id: 'obr-1', nome: 'Complexo do Alto Tietê', endereco: 'SP', responsavel: 'Eng. Ricardo', status: 'Ativa' }];

const dados: DadosCadastros = {
  empresas, funcionarios, equipamentos, obras, comboios: [], combustiveis: [], lubrificantes: [], etapas: [],
};

test('lista de colaboradores resolve empresa e líder e marca férias como alerta', () => {
  const linhas = montarLinhas('funcionarios', dados);
  const cleiton = linhas.find(linha => linha.id === 'f-2');
  assert.equal(cleiton?.colunas.empresa, 'RENEA Infraestrutura');
  assert.equal(cleiton?.colunas.lider, 'José da Silva Costa');
  assert.equal(cleiton?.situacao, 'Férias');
  assert.equal(cleiton?.tom, 'alerta');
  assert.equal(linhas.find(linha => linha.id === 'f-3')?.ativo, false);
});

test('equipamentos e veículos ficam em listas separadas', () => {
  assert.deepEqual(montarLinhas('equipamentos', dados).map(linha => linha.id), ['eq-1', 'eq-2']);
  assert.deepEqual(montarLinhas('veiculos', dados).map(linha => linha.id), ['eq-3']);
  assert.equal(montarLinhas('equipamentos', dados)[0].colunas.local, 'Complexo do Alto Tietê');
});

test('fornecedores mostram só quem é fornecedor', () => {
  assert.deepEqual(montarLinhas('fornecedores', dados).map(linha => linha.id), ['emp-2']);
});

test('busca ignora acento e maiúscula e exige todas as palavras', () => {
  const linhas = montarLinhas('funcionarios', dados);
  const achar = (busca: string) => filtrarLinhas(linhas, { busca, situacao: 'todos', filtros: {} }).map(linha => linha.id);
  assert.deepEqual(achar('antonio'), ['f-3']);
  assert.deepEqual(achar('cleiton motor'), ['f-2']);
  assert.deepEqual(achar('cleiton operador'), []);
  assert.deepEqual(achar('100787'), ['f-2']);
});

test('situação e filtros restringem a lista, filtro vazio não', () => {
  const linhas = montarLinhas('funcionarios', dados);
  assert.deepEqual(filtrarLinhas(linhas, { busca: '', situacao: 'ativos', filtros: {} }).map(linha => linha.id), ['f-1', 'f-2']);
  assert.deepEqual(filtrarLinhas(linhas, { busca: '', situacao: 'inativos', filtros: {} }).map(linha => linha.id), ['f-3']);
  assert.deepEqual(filtrarLinhas(linhas, { busca: '', situacao: 'todos', filtros: { cargo: 'MOTORISTA', empresa: '' } }).map(linha => linha.id), ['f-2']);
  assert.deepEqual(contarSituacoes(linhas), { ativos: 2, inativos: 1, todos: 3 });
});

test('ordenação natural: CB9 vem antes de CB10, e vazio vai para o fim', () => {
  const linhas = montarLinhas('equipamentos', dados);
  assert.deepEqual(ordenarLinhas(linhas, 'prefixo', 'asc').map(linha => linha.colunas.prefixo), ['CB9', 'CB10']);
  assert.deepEqual(ordenarLinhas(linhas, 'prefixo', 'desc').map(linha => linha.colunas.prefixo), ['CB10', 'CB9']);
  assert.deepEqual(ordenarLinhas(linhas, 'local', 'asc').map(linha => linha.id), ['eq-1', 'eq-2']);
  assert.deepEqual(ordenarLinhas(linhas, 'local', 'desc').map(linha => linha.id), ['eq-1', 'eq-2']);
});

test('opções do filtro vêm das linhas, com quantidade', () => {
  const linhas = montarLinhas('funcionarios', dados);
  assert.deepEqual(opcoesDoFiltro(linhas, 'empresa'), [
    { valor: 'RENEA Infraestrutura', total: 2 },
    { valor: 'Terraplenagem Antiga', total: 1 },
  ]);
});

const usoVazio = (): CadastroUsage => ({
  abastecimentos: [], equipamentos: [], lubrificacoes: [], apontamentos: [],
  empresas: [], funcionarios: [], ordensServico: [], listasPresenca: [], presencasLink: [],
  gruposEquipe: [], controleEquipamentosDiario: [], materiaisMovimentos: [], colecoesDaObra: {},
});

test('cadastro sem uso pode ser excluído de verdade', () => {
  assert.deepEqual(usosDoCadastro('funcionarios', 'f-9', usoVazio()), []);
  assert.deepEqual(usosDoCadastro('equipamentos', 'eq-9', usoVazio()), []);
  assert.deepEqual(usosDoCadastro('empresas', 'emp-9', usoVazio()), []);
});

test('colaborador usado em presença, equipe e liderança fica travado', () => {
  const uso = usoVazio();
  uso.funcionarios = funcionarios;
  uso.presencasLink = [{ funcionarioId: 'f-1' }, { funcionarioId: 'f-1' }];
  uso.listasPresenca = [{ funcionarios: [{ funcionarioId: 'f-1' }] }] as unknown as CadastroUsage['listasPresenca'];
  uso.gruposEquipe = [{ funcionarioIds: ['f-1', 'f-2'] }];
  assert.deepEqual(usosDoCadastro('funcionarios', 'f-1', uso), [
    { collection: 'Presenças', count: 3 },
    { collection: 'Equipes', count: 1 },
    { collection: 'Liderados', count: 1 },
  ]);
});

test('equipamento com abastecimento e empresa com colaborador ficam travados', () => {
  const uso = usoVazio();
  uso.abastecimentos = [{ equipamentoId: 'eq-1' }] as unknown as CadastroUsage['abastecimentos'];
  uso.funcionarios = funcionarios;
  uso.equipamentos = equipamentos;
  assert.deepEqual(usosDoCadastro('equipamentos', 'eq-1', uso), [{ collection: 'Abastecimentos', count: 1 }]);
  assert.deepEqual(usosDoCadastro('empresas', 'emp-1', uso), [
    { collection: 'Colaboradores', count: 2 },
    { collection: 'Equipamentos', count: 3 },
  ]);
});

test('ramo usado em movimento de material fica travado', () => {
  const uso = usoVazio();
  uso.materiaisMovimentos = [{ etapaServicoId: 'et-1' }];
  assert.deepEqual(usosDoCadastro('etapas', 'et-1', uso), [{ collection: 'Movimentos de material', count: 1 }]);
});

test('formulário vazio avisa o que falta e campo opcional em branco não vira zero', () => {
  const vazio = montarRegistro('funcionarios', valoresIniciais('funcionarios', undefined, dados), undefined, 'COL-1', dados);
  assert.equal(vazio.ok, false);

  const valores = { ...valoresIniciais('funcionarios', undefined, dados), nome: 'Maria Souza', matricula: '105000', cargo: 'AJUDANTE', empresaId: 'emp-1' };
  const montado = montarRegistro('funcionarios', valores, undefined, 'COL-1', dados);
  assert.equal(montado.ok, true);
  const pessoa = (montado as { registro: Funcionario }).registro;
  assert.equal(pessoa.ativo, true);
  assert.equal(pessoa.dataMobilizacao, undefined);
  assert.equal(pessoa.liderMatricula, undefined);
});

test('editar mantém o que a tela não mostra', () => {
  const anterior = { ...funcionarios[0], codigoSge: 'SGE-77' } as Funcionario;
  const valores = { ...valoresIniciais('funcionarios', anterior, dados), cargo: 'ENCARREGADO' };
  const montado = montarRegistro('funcionarios', valores, anterior, anterior.id, dados);
  const pessoa = (montado as { registro: Funcionario & { codigoSge?: string } }).registro;
  assert.equal(pessoa.cargo, 'ENCARREGADO');
  assert.equal(pessoa.codigoSge, 'SGE-77');
});
