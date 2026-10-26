import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { ControleEquipamentoDiario, Equipamento, Funcionario } from '../src/types';
import { disponibilidadeDaFrota } from '../src/modules/frota/disponibilidade';
import { calcularIndicadores, type CartaoFrota } from '../src/modules/frota/quadroFrota';
import { fleetSnapshot, fleetSummary } from '../src/utils/dashboardOperational';
import { buildWeeklyFleetReport } from '../src/fleet/weeklyReport';
import { buildTeamSyncPlan } from '../src/utils/teamSpreadsheetSync';

const ler = (arquivo: string) => readFileSync(arquivo, 'utf8');
const DIA = '2026-10-20';
const SITUACOES: ControleEquipamentoDiario['status'][] = [
  'Em operação', 'Em operação', 'Disponível', 'Aguardando motorista', 'Em manutenção', 'A confirmar', 'Desmobilizado',
];

test('A19: disponibilidade é fora da manutenção sobre quem tem posição no dia', () => {
  // 4 fora da manutenção de 5 com posição; A confirmar e Desmobilizado ficam fora.
  assert.equal(disponibilidadeDaFrota(SITUACOES), 80);
  assert.equal(disponibilidadeDaFrota(['A confirmar', undefined, 'Sem lançamento']), null);
  assert.equal(disponibilidadeDaFrota([]), null);
});

test('A19: Painel, Quadro e relatório semanal dão o mesmo número para o mesmo dia', () => {
  const equipamentos = SITUACOES.map((_, i) => ({ id: `eq-${i}`, prefixo: `CB${i}`, nome: 'Basculante', status: 'Ativo' }) as Equipamento);
  const registros = SITUACOES.map((status, i) => ({
    id: `r-${i}`, chave: `r-${i}`, data: DIA, equipamentoId: `eq-${i}`, prefixo: `CB${i}`, status,
    criadoEm: `${DIA}T10:00:00.000Z`,
  }) as ControleEquipamentoDiario);
  const painel = fleetSummary(fleetSnapshot(equipamentos, registros, DIA)).availability;
  const quadro = calcularIndicadores(SITUACOES.map(status => ({ status, grupo: 'operando' }) as unknown as CartaoFrota)).disponibilidade;
  const semanal = buildWeeklyFleetReport(registros, DIA).days.at(-1)?.availabilityRate;
  assert.equal(painel, 80);
  assert.equal(quadro, 80);
  assert.equal(semanal, 80);
});

test('M35: sem dado aparece "—", não 0%, e a média ignora dia vazio', () => {
  assert.match(ler('src/components/quadroFrota/QuadroFrota.tsx'), /texto: indicadores\.disponibilidade === null \? '—' : undefined/);
  assert.match(ler('src/components/fleet/PanoramaDoDia.tsx'), /metrics\.availabilityRate === null \? '—'/);
  const semana = buildWeeklyFleetReport([
    { id: 'a', chave: 'a', data: DIA, status: 'Em operação', prefixo: 'CB1', criadoEm: DIA } as ControleEquipamentoDiario,
  ], DIA);
  assert.equal(semana.averages.availabilityRate, 100);
  assert.equal(buildWeeklyFleetReport([], DIA).averages.availabilityRate, null);
});

test('A28: Meu dia não conta abastecimento inativado', () => {
  assert.match(ler('src/App.tsx'), /movimentosMaterial=\{materiaisMovimentos\}\s*abastecimentos=\{abastecimentosAtivos\}\s*controlesFrota=/);
});

test('M37: a planilha não desmobiliza outra empresa e reativa quem volta', () => {
  const pessoa = (matricula: string, empresaId: string, status: Funcionario['status'] = 'ATIVO') => ({
    id: `f-${matricula}`, matricula, nome: `Pessoa ${matricula}`, cargo: 'AJUDANTE', telefone: '', empresaId, ativo: status === 'ATIVO', status,
  }) as Funcionario;
  const linha = (matricula: string) => ({ matricula, nome: `Pessoa ${matricula}`, funcao: 'AJUDANTE', matriculaLider: '900', encarregado: 'Encarregado', area: '', responsavel: '' });
  const plano = buildTeamSyncPlan({
    linhas: [linha('1'), linha('3')],
    funcionarios: [pessoa('1', 'renea'), pessoa('2', 'renea'), pessoa('3', 'renea', 'DESMOBILIZADO'), pessoa('4', 'terceira')],
    gruposEquipe: [],
    obraId: 'obra',
    empresaId: 'outra-primeira-da-lista',
    criarToken: () => 'token',
    agoraIso: `${DIA}T12:00:00.000Z`,
  });
  assert.deepEqual(plano.colaboradoresParaDesmobilizar.map(item => item.matricula), ['2']);
  assert.deepEqual(plano.colaboradoresReativados.map(item => [item.matricula, item.status, item.ativo]), [['3', 'ATIVO', true]]);
});
