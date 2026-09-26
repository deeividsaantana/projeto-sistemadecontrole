import assert from 'node:assert/strict';
import test from 'node:test';
import { __testing } from '../api/public-presenca.js';

const { sanitizeGroup, textoLegivel } = __testing;

test('equipe com nome guardado como objeto não aparece como [object Object] no link', () => {
  const grupo = sanitizeGroup({
    id: 'g-1',
    nome: { nome: 'TERRAPLENAGEM - JOÃO' },
    responsavel: { label: 'JOÃO' },
    frenteServico: 'DIVERSOS',
  });
  assert.equal(grupo.nome, 'TERRAPLENAGEM - JOÃO');
  assert.equal(grupo.responsavel, 'JOÃO');
  assert.equal(grupo.frenteServico, 'DIVERSOS');
});

test('sem nome legível, a equipe usa frente e responsável', () => {
  const grupo = sanitizeGroup({ id: 'g-2', nome: '[object Object]', responsavel: { nome: 'MARIA' }, frenteServico: 'DRENAGEM' });
  assert.equal(grupo.nome, 'DRENAGEM - MARIA');
  assert.equal(textoLegivel({}), '');
});

test('registro sem nome legível de equipe conta só na equipe dele', async () => {
  const { teamRecordMatches } = await import('../src/utils/teamIdentity');
  const registro = { grupoId: 'g-1', grupoNome: '[object Object]', responsavel: '[object Object]' } as never;
  assert.equal(teamRecordMatches({ id: 'g-1', nome: 'CIVIL - ANA', responsavel: 'ANA' } as never, registro), true);
  assert.equal(teamRecordMatches({ id: 'g-2', nome: 'CIVIL - JOSE', responsavel: 'JOSE' } as never, registro), false);
});

test('equipe "DIVERSOS" sem responsável ganha o nome do encarregado, como no app', () => {
  const [grupo] = __testing.recuperarEquipes(
    [{ id: 'g-1', nome: { x: 1 }, responsavel: '', frenteServico: 'TERRAPLENAGEM', liderMatricula: '123', funcionarioIds: [] }],
    [{ id: 'f-1', matricula: '123', nome: 'EDSON MARTINS DA SILVA' }],
  );
  assert.equal(grupo.nome, 'TERRAPLENAGEM - EDSON MARTINS DA SILVA');
  assert.equal(grupo.responsavel, 'EDSON MARTINS DA SILVA');
  const [porMembros] = __testing.recuperarEquipes(
    [{ id: 'g-2', nome: 'DIVERSOS', frenteServico: 'DIVERSOS', funcionarioIds: ['f-2', 'f-3'] }],
    [{ id: 'f-2', liderNome: 'ANA' }, { id: 'f-3', liderNome: 'ANA' }],
  );
  assert.equal(porMembros.nome, 'DIVERSOS - ANA');
});

test('frente "DIVERSOS" usa a frente e o nome do último envio da equipe', () => {
  const [grupo] = __testing.recuperarEquipes(
    [{ id: 'g-1', nome: '', frenteServico: 'DIVERSOS', funcionarioIds: [] }],
    [],
    [{ grupoId: 'g-1', data: '2026-09-25', grupoNome: 'CIVIL - JOSE AUGUSTO', frenteServico: 'CIVIL', responsavel: 'JOSE AUGUSTO' }],
  );
  assert.equal(grupo.nome, 'CIVIL - JOSE AUGUSTO');
  assert.equal(grupo.frenteServico, 'CIVIL');
  assert.equal(grupo.responsavel, 'JOSE AUGUSTO');
});
