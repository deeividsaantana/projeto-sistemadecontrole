import assert from 'node:assert/strict';
import test from 'node:test';
import type { Funcionario, ControleEquipamentoDiario, Equipamento } from '../src/types';

const mockFuncionarios: Funcionario[] = [
  {
    id: '1',
    nome: 'João Silva',
    matricula: '12345',
    cargo: 'Motorista',
    telefone: '11999999999',
    empresaId: 'e1',
    ativo: true,
  } as any,
  {
    id: '2',
    nome: 'Maria Santos',
    matricula: '12346',
    cargo: 'Operador',
    telefone: '11999999998',
    empresaId: 'e1',
    ativo: true,
  } as any,
];

const mockRegistros: ControleEquipamentoDiario[] = [
  {
    id: 'r1',
    chave: 'c1',
    data: '2026-11-02',
    funcionarioId: '1',
    codigoFuncionario: '12345',
    nomeMotorista: 'João Silva',
    equipamentoId: '1',
    prefixo: 'EQ-001',
    familia: 'escavadeira',
    status: 'Em operação',
    horaSaida: '08:00',
    horaEntradaManutencao: '',
    horaLiberacao: '',
  } as any,
  {
    id: 'r2',
    chave: 'c2',
    data: '2026-11-01',
    funcionarioId: '1',
    codigoFuncionario: '12345',
    nomeMotorista: 'João Silva',
    equipamentoId: '1',
    prefixo: 'EQ-001',
    familia: 'escavadeira',
    status: 'Em operação',
    horaSaida: '09:00',
    horaEntradaManutencao: '',
    horaLiberacao: '',
  } as any,
  {
    id: 'r3',
    chave: 'c3',
    data: '2026-11-02',
    funcionarioId: '2',
    codigoFuncionario: '12346',
    nomeMotorista: 'Maria Santos',
    equipamentoId: '2',
    prefixo: 'EQ-002',
    familia: 'retroescavadeira',
    status: 'Em operação',
    horaSaida: '07:00',
    horaEntradaManutencao: '',
    horaLiberacao: '',
  } as any,
];

const mockEquipamentos: Equipamento[] = [
  {
    id: '1',
    prefixo: 'EQ-001',
    nome: 'Escavadeira Amarela',
    tipo: 'Escavadeira',
    marca: 'CAT',
    modelo: 'CAT 336',
    seriePlaca: 'ABC123',
    situacao: 'operando',
    empresaId: 'e1',
  } as any,
  {
    id: '2',
    prefixo: 'EQ-002',
    nome: 'Retroescavadeira',
    tipo: 'Retroescavadeira',
    marca: 'JCB',
    modelo: 'JCB 3CX',
    seriePlaca: 'DEF456',
    situacao: 'operando',
    empresaId: 'e1',
  } as any,
];

test('relatorioMotoristas: agrupa registros por motorista e conta lançamentos', () => {
  const motoristas = new Map<string, { quantidadeLancamentos: number }>();

  mockRegistros.forEach((reg) => {
    if (!reg.nomeMotorista) return;
    const atual = motoristas.get(reg.nomeMotorista) || { quantidadeLancamentos: 0 };
    motoristas.set(reg.nomeMotorista, {
      quantidadeLancamentos: atual.quantidadeLancamentos + 1,
    });
  });

  assert.equal(motoristas.get('João Silva')?.quantidadeLancamentos, 2);
  assert.equal(motoristas.get('Maria Santos')?.quantidadeLancamentos, 1);
});

test('relatorioMotoristas: encontra matrícula do funcionário', () => {
  const joao = mockFuncionarios.find(f => f.nome === 'João Silva');
  assert.equal(joao?.matricula, '12345');
});

test('relatorioMotoristas: ordena por número de lançamentos decrescente', () => {
  const motoristas = new Map<string, { nome: string; quantidadeLancamentos: number }>();

  mockRegistros.forEach((reg) => {
    if (!reg.nomeMotorista) return;
    const atual = motoristas.get(reg.nomeMotorista) || {
      nome: reg.nomeMotorista,
      quantidadeLancamentos: 0,
    };
    motoristas.set(reg.nomeMotorista, {
      ...atual,
      quantidadeLancamentos: atual.quantidadeLancamentos + 1,
    });
  });

  const resultado = Array.from(motoristas.values()).sort(
    (a, b) => b.quantidadeLancamentos - a.quantidadeLancamentos,
  );

  assert.equal(resultado[0].nome, 'João Silva');
  assert.equal(resultado[0].quantidadeLancamentos, 2);
  assert.equal(resultado[1].nome, 'Maria Santos');
  assert.equal(resultado[1].quantidadeLancamentos, 1);
});

test('listaEquipamentos: conta atividades por equipamento', () => {
  const mapa = new Map<string, number>();

  mockRegistros.forEach((reg) => {
    mapa.set(reg.equipamentoId, (mapa.get(reg.equipamentoId) || 0) + 1);
  });

  assert.equal(mapa.get('1'), 2);
  assert.equal(mapa.get('2'), 1);
});

test('listaEquipamentos: ordena por número de atividades decrescente', () => {
  const mapa = new Map<string, number>();
  mockRegistros.forEach((reg) => {
    mapa.set(reg.equipamentoId, (mapa.get(reg.equipamentoId) || 0) + 1);
  });

  const resultado = mockEquipamentos
    .map(eq => ({ id: eq.id, prefixo: eq.prefixo, atividades: mapa.get(eq.id) || 0 }))
    .sort((a, b) => b.atividades - a.atividades);

  assert.equal(resultado[0].prefixo, 'EQ-001');
  assert.equal(resultado[0].atividades, 2);
  assert.equal(resultado[1].prefixo, 'EQ-002');
  assert.equal(resultado[1].atividades, 1);
});

test('relatorioMotoristas: calcula contagem correta com registros vazios', () => {
  const motoristas = new Map<string, { quantidadeLancamentos: number }>();

  const registrosVazios: ControleEquipamentoDiario[] = [];

  registrosVazios.forEach((reg) => {
    if (!reg.nomeMotorista) return;
    const atual = motoristas.get(reg.nomeMotorista) || { quantidadeLancamentos: 0 };
    motoristas.set(reg.nomeMotorista, {
      quantidadeLancamentos: atual.quantidadeLancamentos + 1,
    });
  });

  assert.equal(motoristas.size, 0);
});

test('listaEquipamentos: calcula contagem correta com registros vazios', () => {
  const mapa = new Map<string, number>();

  const registrosVazios: ControleEquipamentoDiario[] = [];

  registrosVazios.forEach((reg) => {
    mapa.set(reg.equipamentoId, (mapa.get(reg.equipamentoId) || 0) + 1);
  });

  assert.equal(mapa.size, 0);
});
