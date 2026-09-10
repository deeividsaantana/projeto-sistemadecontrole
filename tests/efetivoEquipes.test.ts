import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_FUNCIONARIOS, INITIAL_GRUPOS_EQUIPES, INITIAL_FRENTES_SERVICO } from '../src/utils/initialData';
import { RAMOS_ATIVOS } from '../src/utils/frenteServico';

test('toda equipe tem um encarregado e aponta para colaboradores que existem', () => {
  const ids = new Set(INITIAL_FUNCIONARIOS.map(item => item.id));
  assert.ok(INITIAL_GRUPOS_EQUIPES.length > 0, 'existe pelo menos uma equipe');
  for (const equipe of INITIAL_GRUPOS_EQUIPES) {
    assert.ok(equipe.responsavel.trim(), `equipe ${equipe.id} sem encarregado`);
    assert.ok(equipe.liderMatricula?.trim(), `equipe ${equipe.id} sem matrícula do encarregado`);
    for (const funcionarioId of equipe.funcionarioIds) {
      assert.ok(ids.has(funcionarioId), `${equipe.id} aponta para ${funcionarioId}, que não está no efetivo`);
    }
  }
});

test('cada encarregado tem uma única equipe — um link de presença por pessoa', () => {
  const porLider = INITIAL_GRUPOS_EQUIPES.map(equipe => equipe.liderMatricula);
  assert.equal(new Set(porLider).size, porLider.length, 'há encarregado com mais de uma equipe');
});

test('ninguém do efetivo anterior foi apagado: quem saiu ficou inativo', () => {
  const inativos = INITIAL_FUNCIONARIOS.filter(item => !item.ativo);
  assert.ok(inativos.length > 0, 'os colaboradores que não vieram na planilha continuam no cadastro');
  assert.ok(INITIAL_FUNCIONARIOS.every(item => item.matricula.trim()), 'todo colaborador tem matrícula');
});

test('há uma frente de serviço para cada ramo ativo, do 100 ao 2000', () => {
  const nomes = INITIAL_FRENTES_SERVICO.map(frente => frente.nome);
  assert.deepEqual(nomes, [...RAMOS_ATIVOS]);
  assert.ok(nomes.includes('Ramo 100') && nomes.includes('Ramo 2000'));
  assert.ok(INITIAL_FRENTES_SERVICO.every(frente => frente.ativo && frente.ramoLocal === frente.nome));
});
