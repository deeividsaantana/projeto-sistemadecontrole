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
