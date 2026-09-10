import assert from 'node:assert/strict';
import test from 'node:test';
import {
  diasAntes,
  efetivoPorEmpresa,
  efetivoPorFrente,
  faltasRepetidas,
} from '../src/utils/painelPresenca';
import type { Empresa, Funcionario, GrupoEquipe, PresencaApontamento } from '../src/types';

const registro = (over: Partial<PresencaApontamento>): PresencaApontamento => ({
  id: 'r', data: '2026-09-10', horaEnvio: '07:00', grupoId: 'g-1', grupoNome: 'Equipe A',
  responsavel: 'Renilson', frenteServico: 'Ramo 100', funcionarioId: 'c-1',
  funcionarioNome: 'João Batista', funcao: 'PEDREIRO', status: 'Presente', observacao: '',
  tokenUsado: '', createdAt: '', ...over,
});

const equipe = (id: string, frente: string, quantos: number): GrupoEquipe => ({
  id, nome: `Equipe ${id}`, responsavel: '', frenteServico: frente, status: 'ativo',
  funcionarioIds: Array.from({ length: quantos }, (_, i) => `${id}-p${i}`),
  token: '', linkAtivo: true, createdAt: '', updatedAt: '',
} as GrupoEquipe);

test('a frente junta as equipes que trabalham no mesmo ramo', () => {
  const linhas = efetivoPorFrente(
    [
      registro({ frenteServico: 'Ramo 100' }),
      registro({ frenteServico: 'Ramo 100', funcionarioId: 'c-2' }),
      registro({ frenteServico: 'Ramo 900', funcionarioId: 'c-3' }),
    ],
    [equipe('g-1', 'Ramo 100', 4), equipe('g-2', 'Ramo 100', 6), equipe('g-3', 'Ramo 900', 3)],
  );

  const ramo100 = linhas.find(item => item.chave === 'Ramo 100');
  assert.equal(ramo100?.previstos, 10, 'as duas equipes do Ramo 100 somam o previsto');
  assert.equal(ramo100?.confirmados, 2);
  assert.equal(ramo100?.percentual, 20);
});

test('a frente com mais gente faltando aparece primeiro — é ela que precisa de remanejo', () => {
  const linhas = efetivoPorFrente(
    [registro({ frenteServico: 'Ramo 100' })],
    [equipe('g-1', 'Ramo 100', 2), equipe('g-2', 'Ramo 900', 20)],
  );
  assert.equal(linhas[0].chave, 'Ramo 900', 'faltam 20 no Ramo 900 e 1 no Ramo 100');
});

test('sem previsto não se inventa percentual', () => {
  const linhas = efetivoPorFrente([registro({ frenteServico: 'Ramo 700' })], []);
  assert.equal(linhas[0].percentual, null, 'null é diferente de 0%');
});

test('ausência conta separada do presente, na frente certa', () => {
  const linhas = efetivoPorFrente(
    [
      registro({ frenteServico: 'Ramo 100', status: 'Ausente' }),
      registro({ frenteServico: 'Ramo 100', funcionarioId: 'c-2', status: 'Falta justificada' }),
      registro({ frenteServico: 'Ramo 100', funcionarioId: 'c-3' }),
    ],
    [equipe('g-1', 'Ramo 100', 3)],
  );
  assert.equal(linhas[0].confirmados, 1);
  assert.equal(linhas[0].ausentes, 2);
});

test('o efetivo por empresa usa o cadastro do colaborador, não o texto do apontamento', () => {
  const pessoas = [
    { id: 'c-1', empresaId: 'e-1' }, { id: 'c-2', empresaId: 'e-2' }, { id: 'c-3', empresaId: 'e-1' },
  ] as Funcionario[];
  const empresas = [{ id: 'e-1', nome: 'RENEA' }, { id: 'e-2', nome: 'Terceira' }] as Empresa[];

  const linhas = efetivoPorEmpresa([
    registro({ funcionarioId: 'c-1' }),
    registro({ funcionarioId: 'c-3' }),
    registro({ funcionarioId: 'c-2', status: 'Ausente' }),
  ], pessoas, empresas);

  assert.equal(linhas[0].rotulo, 'RENEA');
  assert.equal(linhas[0].confirmados, 2);
  assert.equal(linhas.find(item => item.rotulo === 'Terceira')?.ausentes, 1);
});

test('quem falta sempre aparece, com as datas — advertência sem data não se sustenta', () => {
  const faltas = faltasRepetidas([
    registro({ data: '2026-09-01', status: 'Ausente' }),
    registro({ data: '2026-09-03', status: 'Ausente' }),
    registro({ data: '2026-09-08', status: 'Falta justificada' }),
    registro({ data: '2026-09-09', funcionarioId: 'c-2', funcionarioNome: 'Maria', status: 'Ausente' }),
  ], { minimo: 3 });

  assert.equal(faltas.length, 1, 'quem faltou uma vez não entra');
  assert.equal(faltas[0].nome, 'João Batista');
  assert.equal(faltas[0].faltas, 3);
  assert.deepEqual(faltas[0].datas, ['2026-09-08', '2026-09-03', '2026-09-01'], 'da mais recente para a mais antiga');
});

test('o mesmo dia não conta duas vezes, mesmo se o registro foi corrigido', () => {
  const faltas = faltasRepetidas([
    registro({ id: 'a', data: '2026-09-01', status: 'Ausente' }),
    registro({ id: 'b', data: '2026-09-01', status: 'Ausente' }),
    registro({ id: 'c', data: '2026-09-02', status: 'Ausente' }),
  ], { minimo: 2 });

  assert.equal(faltas[0].faltas, 2, 'dois registros do mesmo dia são um dia de falta');
});

test('a janela de datas recorta o período pedido', () => {
  const todas = [
    registro({ data: '2026-08-01', status: 'Ausente' }),
    registro({ data: '2026-09-05', status: 'Ausente' }),
    registro({ data: '2026-09-06', status: 'Ausente' }),
  ];
  assert.equal(faltasRepetidas(todas, { minimo: 2 }).length, 1);
  assert.equal(faltasRepetidas(todas, { minimo: 2, desde: '2026-09-01' })[0].faltas, 2);
  assert.equal(faltasRepetidas(todas, { minimo: 3, desde: '2026-09-01' }).length, 0);
});

test('presente nunca vira falta', () => {
  assert.deepEqual(faltasRepetidas([
    registro({ data: '2026-09-01' }), registro({ data: '2026-09-02' }), registro({ data: '2026-09-03' }),
  ], { minimo: 1 }), []);
});

test('recuar dias atravessa a virada do mês', () => {
  assert.equal(diasAntes('2026-09-03', 14), '2026-08-20');
  assert.equal(diasAntes('2026-03-01', 1), '2026-02-28');
});
