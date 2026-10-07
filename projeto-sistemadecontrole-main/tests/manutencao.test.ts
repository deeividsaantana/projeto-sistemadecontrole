import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  FLUXO_MANUTENCAO,
  calcularHorasParadas,
  garantirOrdemAutomaticaDaFrota,
  isOrdemEncerrada,
  liberarMaquinasDaOrdemConcluida,
  proximoStatusManutencao,
  reconciliarHistoricoManutencaoDaFrota,
} from '../src/utils/manutencao';
import type { ControleEquipamentoDiario, OrdemServico } from '../src/types';

const registroBasculante = (overrides: Partial<ControleEquipamentoDiario> = {}): ControleEquipamentoDiario => ({
  id: 'controle-cb-770',
  chave: '2026-09-18|equipamento-cb-770',
  data: '2026-09-18',
  funcionarioId: '',
  codigoFuncionario: '',
  nomeMotorista: '',
  equipamentoId: 'equipamento-cb-770',
  prefixo: 'CB770',
  familia: 'Basculantes',
  tipoEquipamento: 'Caminhão Basculante',
  status: 'Em manutenção',
  horaSaida: '',
  horaEntradaManutencao: '08:15',
  horaLiberacao: '',
  motivoManutencao: 'Falha no sistema hidráulico',
  observacao: '',
  origem: 'SISTEMA',
  revisao: [],
  criadoEm: '2026-09-18T11:15:00.000Z',
  atualizadoEm: '2026-09-18T11:15:00.000Z',
  ...overrides,
});

test('fluxo segue a ordem definida para a manutenção', () => {
  assert.deepEqual(FLUXO_MANUTENCAO, ['Aberta', 'Em Análise', 'Em Andamento', 'Aguardando Peça', 'Concluída']);
  assert.equal(proximoStatusManutencao('Aberta'), 'Em Análise');
  assert.equal(proximoStatusManutencao('Em Análise'), 'Em Andamento');
  assert.equal(proximoStatusManutencao('Em Andamento'), 'Aguardando Peça');
  assert.equal(proximoStatusManutencao('Aguardando Peça'), 'Concluída');
});

test('ordem encerrada não avança mais', () => {
  assert.equal(proximoStatusManutencao('Concluída'), undefined);
  assert.equal(proximoStatusManutencao('Cancelada'), undefined);
  assert.equal(isOrdemEncerrada('Concluída'), true);
  assert.equal(isOrdemEncerrada('Aguardando Peça'), false);
});

test('horas paradas congelam entre abertura e liberação', () => {
  const horas = calcularHorasParadas({
    dataAbertura: '2026-09-01',
    horaAbertura: '08:00',
    dataConclusao: '2026-09-02',
    horaConclusao: '14:30',
  });
  assert.equal(horas, 30.5);
});

test('ordem aberta conta as horas até agora', () => {
  const agora = new Date('2026-09-01T12:00:00');
  const horas = calcularHorasParadas({ dataAbertura: '2026-09-01', horaAbertura: '09:00' }, agora);
  assert.equal(horas, 3);
});

test('sem abertura ou com liberação anterior à abertura não inventa número', () => {
  assert.equal(calcularHorasParadas({ dataAbertura: '', horaAbertura: '08:00' }), undefined);
  assert.equal(
    calcularHorasParadas({ dataAbertura: '2026-09-05', horaAbertura: '08:00', dataConclusao: '2026-09-01' }),
    undefined,
  );
});

test('hora ausente assume início do dia, sem quebrar o cálculo', () => {
  const horas = calcularHorasParadas({ dataAbertura: '2026-09-01', dataConclusao: '2026-09-01', horaConclusao: '06:00' });
  assert.equal(horas, 6);
});

test('basculante em manutenção cria OS aberta e vincula o lançamento', () => {
  const result = garantirOrdemAutomaticaDaFrota(registroBasculante(), [], 'Encarregado da frota');

  assert.equal(result.criada, true);
  assert.equal(result.registro.ordemServicoId, result.ordens[0].id);
  assert.deepEqual(result.ordens[0], {
    id: 'os-frota-controle-cb-770',
    numero: 'OS-0001',
    equipamentoId: 'equipamento-cb-770',
    tipo: 'Corretiva',
    prioridade: 'Média',
    descricao: 'Entrada em manutenção registrada no controle operacional do CB770.',
    status: 'Aberta',
    dataAbertura: '2026-09-18',
    horaAbertura: '08:15',
    responsavel: 'Encarregado da frota',
    observacao: 'OS criada automaticamente pelo Controle Operacional de Frotas.',
    motivo: 'Falha no sistema hidráulico',
  });
});

test('equipamento não basculante em manutenção também abre OS', () => {
  // A oficina precisa da ordem aberta para qualquer máquina parada, não só
  // para os basculantes: escavadeira, gerador e torre paravam sem registro.
  const escavadeira = registroBasculante({
    id: 'controle-es-101',
    equipamentoId: 'equipamento-es-101',
    prefixo: 'ES101',
    familia: 'Escavadeiras',
    tipoEquipamento: 'Escavadeira Hidráulica',
    motivoManutencao: 'Vazamento na lança',
  });
  const result = garantirOrdemAutomaticaDaFrota(escavadeira, [], 'Encarregado da frota');

  assert.equal(result.criada, true);
  assert.equal(result.ordens.length, 1);
  assert.equal(result.ordens[0].equipamentoId, 'equipamento-es-101');
  assert.equal(result.registro.ordemServicoId, result.ordens[0].id);
});

test('equipamento fora de manutenção não abre OS', () => {
  const operando = registroBasculante({ status: 'Em operação' });
  const result = garantirOrdemAutomaticaDaFrota(operando, [], 'Encarregado da frota');

  assert.equal(result.criada, false);
  assert.deepEqual(result.ordens, []);
});

test('basculante em manutenção reutiliza OS aberta sem duplicar', () => {
  const aberta: OrdemServico = {
    id: 'os-existente', numero: 'OS-0042', equipamentoId: 'equipamento-cb-770',
    tipo: 'Corretiva', prioridade: 'Alta', descricao: 'Reparo hidráulico', status: 'Em Andamento',
    dataAbertura: '2026-09-17', horaAbertura: '14:00', responsavel: 'Oficina', observacao: '',
  };
  const result = garantirOrdemAutomaticaDaFrota(registroBasculante(), [aberta], 'Encarregado da frota');

  assert.equal(result.criada, false);
  assert.equal(result.registro.ordemServicoId, 'os-existente');
  assert.deepEqual(result.ordens, [aberta]);
});

test('histórico de frota com vínculo de OS órfão volta a aparecer na manutenção', () => {
  const historico = registroBasculante({ ordemServicoId: 'os-removida' });

  const result = reconciliarHistoricoManutencaoDaFrota([historico], [], 'Encarregado da frota');

  assert.equal(result.ordens.length, 1);
  assert.equal(result.registros[0].ordemServicoId, result.ordens[0].id);
  assert.equal(result.criadas, 1);
});

test('OS concluída libera a máquina que ficou marcada em manutenção por causa dela', () => {
  const ordem: OrdemServico = {
    id: 'os-frota-controle-cb-770', numero: 'OS-0007', equipamentoId: 'equipamento-cb-770',
    tipo: 'Corretiva', prioridade: 'Alta', descricao: 'Reparo hidráulico', status: 'Concluída',
    dataAbertura: '2026-09-18', horaAbertura: '08:15', dataConclusao: '2026-09-18', horaConclusao: '15:40',
    responsavel: 'Oficina', observacao: '',
  };
  const registro = registroBasculante({ ordemServicoId: ordem.id });

  const resultado = liberarMaquinasDaOrdemConcluida(ordem, [registro], 'Encarregado da frota', '2026-09-18T15:40:00.000Z');

  assert.equal(resultado.liberados, 1);
  assert.equal(resultado.registros[0].status, 'Disponível');
  assert.equal(resultado.registros[0].horaLiberacao, '15:40');
  assert.equal(resultado.registros[0].ordemServicoId, ordem.id);
  const ultimoEvento = resultado.registros[0].eventos?.at(-1);
  assert.equal(ultimoEvento?.tipo, 'LIBERACAO_MANUTENCAO');
  assert.equal(ultimoEvento?.statusAnterior, 'Em manutenção');
  assert.match(ultimoEvento?.observacao || '', /OS-0007/);
});

test('OS cancelada também libera a máquina', () => {
  const ordem: OrdemServico = {
    id: 'os-frota-controle-cb-770', numero: 'OS-0008', equipamentoId: 'equipamento-cb-770',
    tipo: 'Corretiva', prioridade: 'Baixa', descricao: 'Chamado duplicado', status: 'Cancelada',
    dataAbertura: '2026-09-18', responsavel: 'Oficina', observacao: '',
  };
  const registro = registroBasculante({ status: 'Aguardando manutenção', ordemServicoId: ordem.id });

  const resultado = liberarMaquinasDaOrdemConcluida(ordem, [registro], 'Encarregado da frota');

  assert.equal(resultado.liberados, 1);
  assert.equal(resultado.registros[0].status, 'Disponível');
});

test('OS ainda aberta não mexe no lançamento, e outro equipamento não é afetado', () => {
  const ordem: OrdemServico = {
    id: 'os-frota-controle-cb-770', numero: 'OS-0009', equipamentoId: 'equipamento-cb-770',
    tipo: 'Corretiva', prioridade: 'Alta', descricao: 'Em andamento', status: 'Em Andamento',
    dataAbertura: '2026-09-18', responsavel: 'Oficina', observacao: '',
  };
  const registro = registroBasculante({ ordemServicoId: ordem.id });
  const registros = [registro];

  const emAndamento = liberarMaquinasDaOrdemConcluida(ordem, registros, 'Encarregado da frota');
  assert.equal(emAndamento.liberados, 0);
  assert.equal(emAndamento.registros, registros);

  const concluida: OrdemServico = { ...ordem, status: 'Concluída' };
  const outroEquipamento = registroBasculante({ id: 'controle-es-101', equipamentoId: 'equipamento-es-101', ordemServicoId: 'outra-os' });
  const resultado = liberarMaquinasDaOrdemConcluida(concluida, [registro, outroEquipamento], 'Encarregado da frota');
  assert.equal(resultado.liberados, 1);
  assert.equal(resultado.registros[1], outroEquipamento);
});

test('a tela de manutenção está ligada aos handlers do App', () => {
  // Os handlers antigos de OS existiam sem nenhuma tela chamando: viraram
  // código morto e ninguém conseguia abrir uma ordem pelo sistema.
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /activeTab === 'manutencao'/);
  assert.match(app, /onSave=\{handleSaveOrdemServico\}/);
  assert.match(app, /onDelete=\{handleDeleteOrdemServico\}/);
  assert.match(app, /setOrdensServico\(updated\)/);
});
