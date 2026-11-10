import assert from 'node:assert/strict';
import test from 'node:test';
import * as presenca from '../src/utils/presencaPublicaAuth';

test('token de presença pública sem assinatura não existe mais (era forjável e não tinha uso)', () => {
  assert.equal('gerarTokenPresencaPublica' in presenca, false);
  assert.equal('validarTokenPresencaPublica' in presenca, false);
  assert.equal(typeof presenca.validarMatricula, 'function');
});
